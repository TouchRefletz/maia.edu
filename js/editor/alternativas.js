import { criarHtmlBlocoEditor } from './structure-editor.js';

/**
 * Retorna apenas a string HTML da estrutura da alternativa.
 */
export const gerarHtmlTemplateAlternativa = (blocoInicialHtml) => {
  return `
        <div style="display:flex;gap:5px;align-items:center;">
            <input class="form-control alt-letter" style="width:60px;text-align:center;" value="" placeholder="Letra">
            <button type="button" class="btn btn--sm btn--outline btn-remove-alt" style="color:var(--color-error);border-color:var(--color-error);min-width:30px;" title="Remover alternativa">✕</button>
        </div>
        <div class="alt-editor">
            <div class="structure-editor-wrapper">
                <div class="structure-editor-container alt-drag-container">
                    ${blocoInicialHtml}
                </div>
                <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                    <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="texto">Texto</button>
                    <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="equacao">Equação</button>
                    <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="imagem">Imagem</button>
                </div>
            </div>
        </div>
    `;
};

/**
 * Liga os eventos (click) nos elementos recém-criados daquela linha.
 */
export const configurarEventosNovaAlternativa = (linhaElemento) => {
  // 1. Configura os botões de adicionar blocos (Texto, Equação, Imagem)
  linhaElemento.querySelectorAll('.btn-alt-add').forEach((btn) => {
    btn.onclick = () => {
      const tipo = btn.dataset.addType;
      const html = criarHtmlBlocoEditor(tipo, '');

      const temp = document.createElement('div');
      temp.innerHTML = html.trim();

      // Encontra o container de drag ESPECÍFICO desta linha e adiciona
      const dragContainer = linhaElemento.querySelector('.alt-drag-container');
      if (dragContainer) {
        dragContainer.appendChild(temp.firstChild);
      }
    };
  });

  // 2. Configura o botão de remover a própria linha
  const btnRemove = linhaElemento.querySelector('.btn-remove-alt');
  if (btnRemove) {
    btnRemove.onclick = function () {
      linhaElemento.remove();
    };
  }
};

/**
 * Cria o elemento DOM da alternativa, preenche o HTML e liga os eventos.
 */
export const criarEAnexarAlternativa = (containerDestino) => {
  const nova = document.createElement('div');
  nova.className = 'alt-row alt-edit-row';
  nova.style.cssText =
    'display:flex;flex-direction:column;gap:8px;margin-bottom:10px';

  // Gera o conteúdo visual
  const blocoInicial = criarHtmlBlocoEditor('texto', '');
  nova.innerHTML = gerarTemplateAlternativaSimples(blocoInicial);

  // Liga os eventos (Remover e Adicionar Bloco)
  configurarEventosAlternativa(nova);

  // Adiciona na tela
  containerDestino.appendChild(nova);
};

/**
 * Retorna o HTML da alternativa (Visual)
 */
export const gerarTemplateAlternativaSimples = (blocoInicial) => {
  return `
        <div style="display:flex;gap:5px;align-items:center">
          <input class="form-control alt-letter" style="width:60px;text-align:center" value="" placeholder="Letra">
          <button type="button" class="btn btn--sm btn--outline btn-remove-alt"
            style="color:var(--color-error);border-color:var(--color-error);min-width:30px" title="Remover alternativa">-</button>
        </div>

        <div class="alt-editor">
          <div class="structure-editor-wrapper">
            <div class="structure-editor-container alt-drag-container">${blocoInicial}</div>
            <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="texto">Texto</button>
              <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="equacao">Equação</button>
              <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="imagem">Imagem</button>
            </div>
          </div>
        </div>
    `;
};

/**
 * Liga os cliques dos botões internos da alternativa.
 */
export const configurarEventosAlternativa = (linhaElemento) => {
  // Botão Remover Linha
  const btnRemove = linhaElemento.querySelector('.btn-remove-alt');
  if (btnRemove) {
    btnRemove.onclick = () => linhaElemento.remove();
  }

  // Botões Adicionar Bloco (Texto, Imagem, etc)
  // Importante: No seu snippet original faltava ligar isso, mas adicionei para garantir que funcione!
  linhaElemento.querySelectorAll('.btn-alt-add').forEach((btn) => {
    btn.onclick = () => {
      const tipo = btn.dataset.addType;
      const html = criarHtmlBlocoEditor(tipo, '');

      const temp = document.createElement('div');
      temp.innerHTML = html.trim();

      const dragContainer = linhaElemento.querySelector('.alt-drag-container');
      if (dragContainer) dragContainer.appendChild(temp.firstChild);
    };
  });
};