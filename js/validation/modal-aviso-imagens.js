export function mostrarModalAvisoImagens(esperados, preenchidos, onConfirm, onCancel) {
  const faltam = esperados - preenchidos;
  const idModal = 'missingImagesModal';

  // Remove anterior se existir
  document.getElementById(idModal)?.remove();

  const overlay = document.createElement('div');
  overlay.id = idModal;
  overlay.className = 'modal-overlay'; // Usa a mesma classe do seu CSS existente
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 450px; border-top: 4px solid var(--color-warning);">
      <div class="modal-header">
        <h2 style="color: var(--color-warning); display:flex; align-items:center; gap:10px;">
           ⚠️ Faltam Imagens
        </h2>
      </div>

      <div class="modal-body">
        <p style="font-size: 1.1em; color: var(--color-text);">
            A estrutura da questão pede <strong>${esperados}</strong> imagens, mas você recortou apenas <strong>${preenchidos}</strong>.
        </p>
        <div style="background: rgba(255, 165, 0, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
            <strong style="color: var(--color-warning); font-size: 1.2em;">Faltam ${faltam} imagem(ns)</strong>
        </div>
        <p style="font-size: 0.9em; color: var(--color-text-secondary);">
            Se avançar agora, o gabarito pode ficar incompleto ou a IA pode alucinar sobre imagens que não viu.
        </p>
      </div>

      <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn btn--secondary" id="btnCancelImg">Voltar e Recortar</button>
        <button type="button" class="btn btn--primary" id="btnConfirmImg" style="background: var(--color-warning); border-color: var(--color-warning); color: var(--color-text);">Continuar mesmo assim</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Lógica dos botões
  const btnCancel = document.getElementById('btnCancelImg');
  const btnConfirm = document.getElementById('btnConfirmImg');

  const close = () => overlay.remove();

  btnCancel.onclick = () => {
    close();
    onCancel();
  };

  btnConfirm.onclick = () => {
    close();
    onConfirm();
  };
}
