(function () {
    'use strict';
    const presets = [
        { id: 'sea', name: '海盐蓝', colors: ['#1769D2', '#16877E', '#F1F5FC'] },
        { id: 'mint', name: '薄荷青', colors: ['#087F70', '#627C35', '#EFF7F2'] },
        { id: 'sunset', name: '落日橙', colors: ['#B94A27', '#976523', '#FFF3E9'] },
        { id: 'violet', name: '薰衣草', colors: ['#6D4CC3', '#A44887', '#F6F1FC'] },
        { id: 'rose', name: '玫瑰雾', colors: ['#B43F68', '#8450A0', '#FFF1F5'] },
        { id: 'obsidian', name: '曜石金', colors: ['#D3A24A', '#91A4C0', '#181D25'] }
    ];
    const valid = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const mix = (a, b, ratio) => '#' + rgb(a).map((x, i) => Math.round(x * (1 - ratio) + rgb(b)[i] * ratio).toString(16).padStart(2, '0')).join('');
    const luminance = hex => rgb(hex).map(x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
    const alpha = (color, opacity) => `rgba(${rgb(color).join(',')},${opacity})`;
    const ink = hex => luminance(hex) > 0.179 ? '#151A23' : '#FFFFFF';
    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* optional persistence */ } }
    };
    let selected = presets[0];
    let custom = ['#1769D2', '#16877E', '#F1F5FC'];
    let running = false;
    let pending = null;
    try {
        const saved = JSON.parse(storage.get('tell-theme-v1'));
        if (saved?.colors?.length === 3 && saved.colors.every(valid)) selected = { id: saved.id || 'custom', name: saved.name || '自定义', colors: saved.colors };
        const savedCustom = JSON.parse(storage.get('tell-theme-custom'));
        if (savedCustom?.length === 3 && savedCustom.every(valid)) custom = savedCustom;
    } catch (_) { /* use defaults */ }

    function tokens(theme) {
        const [primary, accent, base] = theme.colors;
        const dark = document.body?.classList.contains('dark-mode') || luminance(base) < 0.15;
        const background = dark && luminance(base) >= 0.15 ? mix(primary, '#10151D', 0.94) : base;
        const surface = dark ? mix(background, '#FFFFFF', 0.065) : mix(background, '#FFFFFF', 0.90);
        return {
            '--talk-blue': primary, '--talk-dark-blue': mix(primary, '#000000', 0.16),
            '--theme-accent': accent, '--on-primary': ink(primary), '--on-accent': ink(accent),
            '--bg-color': background, '--white': surface, '--card-bg': surface,
            '--text-primary': dark ? '#F0F3F8' : '#202A38', '--text-secondary': dark ? '#BBC5D3' : '#566579',
            '--border-color': dark ? mix(surface, '#FFFFFF', 0.21) : mix(base, '#263448', 0.20),
            '--input-bg': dark ? mix(background, '#FFFFFF', 0.035) : mix(base, primary, 0.035),
            '--input-border': dark ? mix(surface, '#FFFFFF', 0.34) : mix(base, '#23344B', 0.35),
            '--theme-soft': mix(surface, primary, dark ? 0.25 : 0.12),
            '--glass-page': alpha(background, dark ? 0.90 : 0.85),
            '--glass-panel': alpha(surface, dark ? 0.87 : 0.76),
            '--glass-chrome': alpha(surface, dark ? 0.84 : 0.72),
            '--glass-section': alpha(surface, dark ? 0.38 : 0.30),
            '--glass-edge': alpha(mix(surface, primary, dark ? 0.45 : 0.27), dark ? 0.68 : 0.70),
            '--glass-highlight': dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.68)',
            '--glass-tint': alpha(primary, dark ? 0.10 : 0.07),
            '--glass-scrim': dark ? 'rgba(3,7,14,.57)' : 'rgba(20,34,54,.24)',
            '--glass-shadow': dark ? '0 24px 70px rgba(0,0,0,.48)' : '0 24px 70px rgba(28,45,72,.22)',
            '--shadow-sm': dark ? '0 2px 10px rgba(0,0,0,.24)' : '0 2px 10px rgba(27,43,68,.08)',
            '--shadow-md': dark ? '0 16px 48px rgba(0,0,0,.44)' : '0 16px 48px rgba(27,43,68,.18)'
        };
    }
    function apply(theme, persist = true) {
        selected = theme;
        const values = tokens(theme);
        for (const target of [document.documentElement, document.body].filter(Boolean)) {
            for (const [key, value] of Object.entries(values)) target.style.setProperty(key, value);
        }
        document.documentElement.dataset.themePalette = theme.id;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = values['--bg-color'];
        if (persist) storage.set('tell-theme-v1', JSON.stringify(theme));
        document.querySelectorAll('button[data-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === theme.id)));
        const label = document.getElementById('theme-current-name');
        if (label) label.textContent = theme.name;
        document.querySelectorAll('.theme-trigger-colors').forEach(triad => {
            Array.from(triad.children).forEach((dot, i) => { dot.style.background = theme.colors[i]; });
        });
        window.dispatchEvent(new CustomEvent('tell:theme-changed', { detail: { id: theme.id, colors: theme.colors } }));
    }
    apply(selected, false);

    async function change(theme) {
        if (!theme.colors?.every(valid)) return;
        if (running) { pending = theme; return; }
        running = true;
        const button = document.getElementById('theme-trigger');
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.documentElement.style.setProperty('--theme-origin', `${x}px ${y}px`);
        document.documentElement.style.setProperty('--theme-radius', `${radius}px`);
        document.documentElement.dataset.themeOrigin = `${x},${y}`;
        try {
            if (!reduce && document.startViewTransition) {
                document.documentElement.classList.add('theme-transition');
                const transition = document.startViewTransition(() => apply(theme));
                await transition.ready;
                document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                    { duration: 560, easing: 'cubic-bezier(.22,.72,.18,1)', pseudoElement: '::view-transition-new(root)', fill: 'both' });
                await transition.finished;
            } else if (!reduce && document.documentElement.animate) {
                // Old WebViews: a decorative ring, never a clone/replacement of the live page.
                const ring = document.createElement('div');
                ring.className = 'theme-fallback-ring';
                ring.style.cssText = `left:${x}px;top:${y}px;border-color:${theme.colors[0]};`;
                document.body.append(ring);
                apply(theme);
                const animation = ring.animate([{ width: '0px', height: '0px', opacity: .65 },
                    { width: `${radius * 2}px`, height: `${radius * 2}px`, opacity: 0 }], { duration: 560, easing: 'ease-out' });
                await animation.finished.catch(() => {});
                ring.remove();
            } else apply(theme);
        } catch (_) { apply(theme); }
        finally {
            document.documentElement.classList.remove('theme-transition');
            running = false;
            if (pending) { const next = pending; pending = null; void change(next); }
        }
    }

    function mount() {
        const button = document.createElement('button');
        button.type = 'button'; button.id = 'theme-trigger'; button.className = 'theme-trigger';
        button.setAttribute('aria-label', '选择主题配色'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'theme-picker');
        button.innerHTML = '<span class="theme-trigger-colors" aria-hidden="true"><i></i><i></i><i></i></span>';
        const picker = document.createElement('section');
        picker.id = 'theme-picker'; picker.className = 'theme-picker'; picker.hidden = true;
        picker.setAttribute('aria-label', '主题配色');
        picker.innerHTML = `<div class="theme-picker-heading"><div><strong>主题配色</strong><span id="theme-current-name" aria-live="polite"></span></div><button type="button" class="theme-close" aria-label="关闭配色面板">×</button></div>
            <div class="theme-preset-grid">${presets.map(theme => `<button type="button" data-palette="${theme.id}" aria-pressed="false"><span class="theme-swatches">${theme.colors.map(color => `<i style="background:${color}"></i>`).join('')}</span><span>${theme.name}</span></button>`).join('')}</div>
            <fieldset class="theme-custom"><legend>自定义三色</legend><div class="theme-custom-inputs">${['主色', '辅助色', '页面底色'].map((label, i) => `<label>${label}<input type="color" id="custom-theme-${i}" value="${custom[i]}" aria-label="自定义${label}"></label>`).join('')}</div><button type="button" id="apply-custom-theme">应用自定义配色</button></fieldset>`;
        const close = () => { picker.hidden = true; button.setAttribute('aria-expanded', 'false'); };
        button.addEventListener('click', () => { picker.hidden = !picker.hidden; button.setAttribute('aria-expanded', String(!picker.hidden)); });
        picker.querySelector('.theme-close').addEventListener('click', () => { close(); button.focus(); });
        document.addEventListener('pointerdown', event => { if (!picker.contains(event.target) && !button.contains(event.target)) close(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape' && !picker.hidden) { close(); button.focus(); } });
        picker.querySelectorAll('[data-palette]').forEach(control => control.addEventListener('click', () => {
            close(); void change(presets.find(theme => theme.id === control.dataset.palette));
        }));
        picker.querySelector('#apply-custom-theme').addEventListener('click', () => {
            custom = [0, 1, 2].map(i => picker.querySelector(`#custom-theme-${i}`).value);
            storage.set('tell-theme-custom', JSON.stringify(custom));
            close(); void change({ id: 'custom', name: '自定义', colors: custom });
        });
        document.body.append(button, picker);
        apply(selected, false);
        new MutationObserver(() => apply(selected, false)).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    window.TellTheme = { presets, change, get selected() { return selected; }, get running() { return running; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
