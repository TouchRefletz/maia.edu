import { uiState } from '../main.js';

export function customAlert(message, duration = 5000) {
  let alertDiv = document.getElementById('customAlert');
  let messageDiv;

  if (!alertDiv) {
    alertDiv = document.createElement('div');
    alertDiv.id = 'customAlert';

    messageDiv = document.createElement('div');
    messageDiv.id = 'alertMessage';
    alertDiv.appendChild(messageDiv);

    document.body.appendChild(alertDiv);
  } else {
    messageDiv = document.getElementById('alertMessage');
  }

  messageDiv.innerText = message;

  void alertDiv.offsetWidth;

  alertDiv.classList.add('visible');

  if (uiState.alertTimeout) clearTimeout(uiState.alertTimeout);

  const removeAlert = () => {
    alertDiv.classList.remove('visible');
    setTimeout(() => {
      if (alertDiv && !alertDiv.classList.contains('visible')) {
        alertDiv.remove();
      }
    }, 500);
  };

  if (duration > 0) {
    uiState.alertTimeout = setTimeout(removeAlert, duration);
  }

  return {
    close: removeAlert,
    update: (newMsg) => customAlert(newMsg, duration),
  };
}

export function showUndoToast(message, onUndo, duration = 6000) {
  // Remove toast anterior (se houver)
  document.getElementById('undoToast')?.remove();
  if (uiState.undoToastTimer) clearTimeout(uiState.undoToastTimer);

  const toast = document.createElement('div');
  toast.id = 'undoToast';
  toast.className = 'undo-toast';
  toast.innerHTML = `
    <span class="undo-msg">${message}</span>
    <button type="button" class="btn btn--sm btn--outline" id="undoBtn">Desfazer</button>
  `;

  document.body.appendChild(toast);

  toast.querySelector('#undoBtn').onclick = () => {
    onUndo?.();
    toast.remove();
    if (uiState.undoToastTimer) clearTimeout(uiState.undoToastTimer);
  };

  uiState.undoToastTimer = setTimeout(() => toast.remove(), duration);
}