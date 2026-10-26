/* Small, dependency-free UI helpers. No document/page replacement on data updates. */
(function (root) {
    'use strict';
    const snapshots = new WeakMap();
    const messageViews = new WeakMap();
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const keyOf = node => node.nodeType === 1
        ? ['data-message-id', 'data-friend-id', 'data-group-id', 'data-row-id', 'id']
            .map(name => node.hasAttribute(name) ? `${name}:${node.getAttribute(name)}` : '').find(Boolean)
        : null;

    function morph(current, next) {
        if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
            current.replaceWith(next);
            return;
        }
        if (current.nodeType !== 1) {
            if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
            return;
        }
        for (const attr of Array.from(current.attributes)) {
            if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
        }
        for (const attr of Array.from(next.attributes)) {
            if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
        }
        // Keep editable controls and their live value, focus, selection and IME buffer.
        if (current.matches('input, textarea, select, [contenteditable]')) {
            if (current.matches('input[type="checkbox"], input[type="radio"]')) current.checked = next.checked;
            return;
        }
        reconcile(current, next);
    }

    function reconcile(container, template, added = []) {
        const keyed = new Map(Array.from(container.childNodes).map(node => [keyOf(node), node]).filter(([key]) => key));
        let cursor = container.firstChild;
        for (const next of Array.from(template.childNodes)) {
            const key = keyOf(next);
            let current = key ? keyed.get(key) : cursor && !keyOf(cursor) ? cursor : null;
            if (current && current.nodeName !== next.nodeName) current = null;
            if (current) {
                if (current !== cursor) container.insertBefore(current, cursor);
                morph(current, next);
                cursor = current.nextSibling;
            } else {
                container.insertBefore(next, cursor);
                if (next.nodeType === 1) added.push(next);
            }
        }
        while (cursor) {
            const next = cursor.nextSibling;
            cursor.remove();
            cursor = next;
        }
        return added;
    }

    function syncMarkup(container, html) {
        if (!container || snapshots.get(container) === html) return [];
        const template = document.createElement('template');
        template.innerHTML = html;
        const added = reconcile(container, template.content);
        snapshots.set(container, html);
        return added;
    }

    function syncMessages(container, html, conversation, forceBottom = false) {
        let view = messageViews.get(container);
        const changedConversation = !view || view.conversation !== conversation;
        if (changedConversation) {
            container.replaceChildren();
            snapshots.delete(container);
            view = { conversation, follow: true };
            messageViews.set(container, view);
        }
        const nearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 72;
        const follow = forceBottom || changedConversation || nearBottom;
        const anchor = Array.from(container.children).find(node => node.getBoundingClientRect().bottom > container.getBoundingClientRect().top);
        const anchorTop = anchor?.getBoundingClientRect().top;
        const previousTop = container.scrollTop;
        const added = syncMarkup(container, html);
        if (follow) container.scrollTop = container.scrollHeight;
        else if (anchor?.isConnected) container.scrollTop = previousTop + anchor.getBoundingClientRect().top - anchorTop;
        else container.scrollTop = previousTop;
        view.follow = follow;
        if (!container.dataset.scrollTracking) {
            container.dataset.scrollTracking = 'true';
            container.addEventListener('scroll', () => {
                const active = messageViews.get(container);
                if (active) active.follow = container.scrollHeight - container.clientHeight - container.scrollTop < 72;
            }, { passive: true });
            container.addEventListener('load', event => {
                if (event.target.tagName === 'IMG' && messageViews.get(container)?.follow) {
                    container.scrollTop = container.scrollHeight;
                }
            }, true);
        }
        if (!changedConversation && !root.matchMedia('(prefers-reduced-motion: reduce)').matches && added.length < 8) {
            for (const node of added) {
                if (node.matches('.message-item') && node.animate) node.animate([
                    { opacity: 0, transform: 'translateY(6px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 160, easing: 'ease-out' });
            }
        }
    }

    class Drafts {
        constructor(app) {
            this.app = app;
            this.owner = null;
            this.data = { drafts: {}, fields: {} };
            this.timer = null;
            document.addEventListener('input', event => this.capture(event.target));
            document.addEventListener('compositionend', event => this.capture(event.target));
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.flush();
            });
            root.addEventListener('pagehide', () => this.flush());
        }
        storageKey() { return `tell-ui-v1:${this.owner}`; }
        activate() {
            const owner = this.app.currentUser?.id;
            if (!owner || owner === this.owner) return;
            this.flush();
            this.owner = owner;
            try {
                const saved = JSON.parse(localStorage.getItem(this.storageKey()) || '{}');
                this.data = { drafts: saved.drafts || {}, fields: saved.fields || {}, tab: saved.tab, view: saved.view };
            } catch (_) { this.data = { drafts: {}, fields: {} }; }
            for (const [id, value] of Object.entries(this.data.fields)) {
                const input = document.getElementById(id);
                if (this.isField(input) && typeof value === 'string') input.value = value;
            }
            if (['chats', 'contacts', 'discover', 'me'].includes(this.data.tab)) this.app.switchTab(this.data.tab);
            this.restoredView = false;
        }
        isField(input) {
            return input?.matches('input[type="text"][id], input[type="search"][id], textarea[id]') &&
                !input.closest('#auth-screen') && !['message-input', 'group-message-input'].includes(input.id);
        }
        conversationKey(group, id) { return `${group ? 'group' : 'friend'}:${id}`; }
        capture(input) {
            if (!this.owner || this.owner !== this.app.currentUser?.id) return;
            if (input.id === 'message-input' && this.app.currentFriend) this.save(false, this.app.currentFriend.id, input.value);
            else if (input.id === 'group-message-input' && this.app.currentGroup) this.save(true, this.app.currentGroup.id, input.value);
            else if (this.isField(input)) { this.data.fields[input.id] = input.value; this.schedule(); }
        }
        save(group, id, value) {
            if (!this.owner) return;
            const key = this.conversationKey(group, id);
            if (value) this.data.drafts[key] = value;
            else delete this.data.drafts[key];
            this.schedule();
        }
        restore(group, id) {
            const input = document.getElementById(group ? 'group-message-input' : 'message-input');
            input.value = this.data.drafts[this.conversationKey(group, id)] || '';
        }
        restoreView() {
            if (this.restoredView) return;
            this.restoredView = true;
            const view = this.data.view;
            if (!view || this.app.currentFriend || this.app.currentGroup) return;
            const items = view.group ? this.app.groups : this.app.friends;
            if (!items.some(item => item.id === view.id)) return;
            const result = view.group ? this.app.openGroupChat(view.id) : this.app.openChat(view.id);
            Promise.resolve(result).then(() => {
                const active = view.group ? this.app.currentGroup : this.app.currentFriend;
                if (active?.id !== view.id || this.app.currentUser?.id !== this.owner) return;
                const container = document.getElementById(view.group ? 'group-messages-container' : 'messages-container');
                if (!view.follow && Number.isFinite(view.scrollTop)) container.scrollTop = view.scrollTop;
            });
        }
        schedule() {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.flush(), 200);
        }
        flush() {
            clearTimeout(this.timer);
            if (!this.owner) return;
            // IME input and navigation can happen before the debounce timer runs.
            for (const [group, conversation] of [[false, this.app.currentFriend], [true, this.app.currentGroup]]) {
                if (conversation) {
                    const input = document.getElementById(group ? 'group-message-input' : 'message-input');
                    const key = this.conversationKey(group, conversation.id);
                    if (input.value) this.data.drafts[key] = input.value;
                    else delete this.data.drafts[key];
                }
            }
            this.data.tab = this.app.currentTab;
            const group = !!this.app.currentGroup;
            const active = group ? this.app.currentGroup : this.app.currentFriend;
            const container = document.getElementById(group ? 'group-messages-container' : 'messages-container');
            this.data.view = active ? { group, id: active.id, scrollTop: container.scrollTop,
                follow: container.scrollHeight - container.clientHeight - container.scrollTop < 72 } : null;
            try { localStorage.setItem(this.storageKey(), JSON.stringify(this.data)); }
            catch (_) { /* Storage may be blocked/full; live inputs remain untouched. */ }
        }
        clear() {
            clearTimeout(this.timer);
            if (this.owner) {
                try { localStorage.removeItem(this.storageKey()); } catch (_) { /* optional storage */ }
            }
            this.owner = null;
            this.data = { drafts: {}, fields: {} };
            document.querySelectorAll('input[type="text"], input[type="search"], textarea').forEach(input => {
                if (!input.closest('#auth-screen')) input.value = '';
            });
        }
    }
    root.TellUI = { syncMarkup, syncMessages, escapeHTML, Drafts };
})(window);
