import { t } from './i18n.js?v=14';

export function isDialogOpen() {
  const overlay = document.querySelector('#app-dialog');
  return Boolean(overlay && !overlay.classList.contains('hidden'));
}

export function confirmDialog(options = {}) {
  const {
    title = '',
    message = '',
    confirmText = t('dialog_ok'),
    dismissText = t('cancel'),
    danger = false
  } = options;
  const overlay = document.querySelector('#app-dialog');
  const card = document.querySelector('#app-dialog-card');
  if (!overlay || !card) return Promise.resolve(false);
  return new Promise((resolve) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    const finish = (result) => {
      overlay.classList.add('hidden');
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      finish(false);
    };
    const onBackdrop = (event) => {
      if (event.target.id === 'app-dialog') finish(false);
    };
    card.innerHTML = `
      <div class="modal-header"><div><h3>${escapeHtml(title)}</h3></div><button class="icon-btn close-modal-btn" data-dialog-dismiss aria-label="${escapeAttr(t('cancel'))}">${icon('x')}</button></div>
      ${message ? `<p class="muted dialog-message">${escapeHtml(message)}</p>` : ''}
      <div class="modal-footer dialog-footer">
        <div class="footer-actions">
          <button class="btn btn-ghost" data-dialog-dismiss>${escapeHtml(dismissText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-dialog-confirm>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    overlay.classList.remove('hidden');
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    card.querySelector('[data-dialog-confirm]').addEventListener('click', () => finish(true));
    card.querySelectorAll('[data-dialog-dismiss]').forEach((button) => button.addEventListener('click', () => finish(false)));
    if (window.lucide) window.lucide.createIcons();
    const confirmButton = card.querySelector('[data-dialog-confirm]');
    if (confirmButton) confirmButton.focus();
  });
}

function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#039;');
}