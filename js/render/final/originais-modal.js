// 1. Recupera os dados das variáveis globais
export function obterImagensBackup() {
  const imgsQ =
    window.__BACKUP_IMGS_Q && window.__BACKUP_IMGS_Q.length > 0
      ? window.__BACKUP_IMGS_Q
      : window.__imagensLimpas?.questao_original || [];

  const imgsG =
    window.__BACKUP_IMGS_G && window.__BACKUP_IMGS_G.length > 0
      ? window.__BACKUP_IMGS_G
      : window.__imagensLimpas?.gabarito_original || [];

  return { imgsQ, imgsG };
}

// 2. Gera o HTML de uma lista de imagens (o antigo renderLista)
export function gerarHtmlListaImagens(lista) {
  if (lista.length === 0)
    return `<div style="color:gray; padding:10px;">Sem imagens</div>`;
  return lista
    .map(
      (src) => `
        <img src="${src}" class="img-content">
    `
    )
    .join('');
}

// 3. Monta o HTML completo do Modal
export function construirHtmlModalOriginais(imgsQ, imgsG) {
  return `
        <div class="img-close-container">
            <button class="img-close-btn" onclick="this.closest('.img-overlay').remove()">✕ Fechar</button>
        </div>
        
        <div class="img-modal-body">
            <div class="img-col">
                <div class="img-title" style="color:#00bfff;">
                    Questão Original (${imgsQ.length})
                </div>
                ${gerarHtmlListaImagens(imgsQ)}
            </div>

            <div class="img-divider"></div>

            <div class="img-col">
                <div class="img-title" style="color:#ffaa00;">
                    Gabarito Original (${imgsG.length})
                </div>
                ${gerarHtmlListaImagens(imgsG)}
            </div>
        </div>
    `;
}

// 4. Função Principal (A que será chamada no Listener Global)
export function verImagensOriginais() {
  const { imgsQ, imgsG } = obterImagensBackup();

  // Check if modal already exists
  if (document.querySelector('.img-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'img-overlay';
  overlay.innerHTML = construirHtmlModalOriginais(imgsQ, imgsG);

  document.body.appendChild(overlay);
}
