(function () {
    'use strict';
    let queue = Promise.resolve();
    function request(message, confirm) {
        const show = () => new Promise(resolve => {
            const previous = document.activeElement;
            const dialog = document.createElement('dialog');
            dialog.className = 'glass-system-dialog';
            dialog.setAttribute('aria-labelledby', 'glass-dialog-title');
            dialog.setAttribute('aria-describedby', 'glass-dialog-message');
            dialog.innerHTML = '<div class="modal-header"><h2 id="glass-dialog-title"></h2></div>' +
                '<div class="modal-body"><p class="glass-dialog-message" id="glass-dialog-message"></p></div>' +
                '<div class="modal-footer"><button type="button" class="glass-dialog-cancel">取消</button><button type="button" class="glass-dialog-confirm">确定</button></div>';
            dialog.querySelector('h2').textContent = confirm ? '请确认' : '提示';
            dialog.querySelector('p').textContent = String(message ?? '');
            dialog.querySelector('.glass-dialog-cancel').hidden = !confirm;
            let done = false;
            const finish = value => {
                if (done) return;
                done = true;
                if (typeof dialog.close === 'function' && dialog.open) dialog.close();
                dialog.remove();
                if (previous?.isConnected) previous.focus({ preventScroll: true });
                resolve(value);
            };
            dialog.querySelector('.glass-dialog-confirm').addEventListener('click', () => finish(true));
            dialog.querySelector('.glass-dialog-cancel').addEventListener('click', () => finish(false));
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(!confirm); });
            document.body.append(dialog);
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else { dialog.classList.add('glass-dialog-fallback'); dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); }
            dialog.querySelector(confirm ? '.glass-dialog-cancel' : '.glass-dialog-confirm').focus({ preventScroll: true });
        });
        const result = queue.then(show, show);
        queue = result.catch(() => {});
        return result;
    }
    window.TellDialogs = { alert: message => request(message, false), confirm: message => request(message, true) };
})();
