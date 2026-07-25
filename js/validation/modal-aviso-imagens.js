export function mostrarModalAvisoImagens(
  esperados,
  preenchidos,
  onConfirm,
  onCancel,
  reportDetalhado = null,
) {
  const faltam = esperados - preenchidos;
  const idModal = 'missingImagesModal';

  // Remove anterior se existir
  document.getElementById(idModal)?.remove();

  let mensagemDetalhada = '';

  if (reportDetalhado) {
    const { faltamQuestao, faltamGabarito } = reportDetalhado;
    const partes = [];
    if (faltamQuestao > 0) partes.push(`<strong>${faltamQuestao}</strong> na Questão`);
    if (faltamGabarito > 0) partes.push(`<strong>${faltamGabarito}</strong> no Gabarito`);

    if (partes.length > 0) {
      mensagemDetalhada = `<div style="margin-top: 10px; font-size: 0.9em; color: var(--color-text-secondary);">
            Detalhamento: Faltam ${partes.join(' e ')}.
          </div>`;
    }
  }

  const overlay = document.createElement('div');
  overlay.id = idModal;
  overlay.className = 'modal-overlay'; // Usa a mesma classe do seu CSS existente
  overlay.innerHTML = `

    <div class="modal-content" style="max-width: 450px; border-top: 4px solid var(--color-error);">
      <div class="modal-header">
        <h2 style="color: var(--color-error); display:flex; align-items:center; gap:10px;">
           ⛔ Ação Bloqueada
        </h2>
      </div>

      <div class="modal-body">
        <p style="font-size: 1.1em; color: var(--color-text);">
            A estrutura pede <strong>${esperados}</strong> imagens, mas você recortou apenas <strong>${preenchidos}</strong>.
        </p>
        <div style="background: rgba(255, 0, 0, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
            <strong style="color: var(--color-error); font-size: 1.2em;">Faltam ${faltam} imagem(ns)</strong>
             ${mensagemDetalhada}
        </div>
        <p style="font-size: 0.95em; color: var(--color-text);">
            Para prosseguir, você deve <strong>recortar as imagens faltantes</strong> (na Questão ou Gabarito) ou <strong>editar a estrutura</strong> para remover os slots de imagem vazios.
        </p>
      </div>

      <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn btn--primary" id="btnCancelImg">Entendi, vou corrigir</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Lógica dos botões
  const btnCancel = document.getElementById('btnCancelImg');

  const close = () => overlay.remove();

  btnCancel.onclick = () => {
    close();
    onCancel();
  };
}
