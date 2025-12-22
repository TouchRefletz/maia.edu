// --- START OF FILE originais-modal.js ---
import {
  exibirModalOriginais,
  obterImagensBackup as obterImagensBackupTS
} from './OriginaisModal'; // Importando do novo arquivo TSX

// 1. Recupera os dados (Redireciona para a lógica centralizada no TSX)
export function obterImagensBackup() {
  return obterImagensBackupTS();
}

/**
 * @deprecated Esta função retorna strings HTML. A renderização agora é feita via React no arquivo .tsx.
 * Mantida apenas para evitar quebras se algum outro script a chama diretamente.
 */
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

/**
 * @deprecated A estrutura do modal agora é um componente React.
 * Mantida para retrocompatibilidade de assinaturas.
 */
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

// 4. Função Principal (Agora chama o renderizador React)
export function verImagensOriginais() {
  // A lógica de verificação de duplicidade e criação do DOM 
  // agora está encapsulada dentro de exibirModalOriginais()
  exibirModalOriginais();
}