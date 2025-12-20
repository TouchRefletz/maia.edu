import { configurarLinhaEditorPasso } from './steps-ui.js';
import { criarHtmlBlocoEditor } from './structure-editor.js';
import { initStepEditors } from './steps-ui.js';

/**
 * Configura o botão de excluir a linha inteira.
 */
export const configurarRemocaoPasso = (row) => {
  const btnRem = row.querySelector('.btn-remove-step');
  if (btnRem) {
    btnRem.onclick = () => {
      if (confirm('Remover este passo inteiro?')) {
        row.remove();
      }
    };
  }
};

/**
 * Configura o evento do botão "Adicionar Novo Passo".
 */
export const initBotaoAdicionarPasso = (container) => {
  const btnAddPasso = container.querySelector('#btnAddPassoGabarito');

  if (btnAddPasso) {
    btnAddPasso.onclick = () => {
      const containerPassos = container.querySelector('#editGabaritoPassos');
      if (containerPassos) {
        criarNovoPasso(containerPassos);
      }
    };
  }
};

/**
 * Lógica principal: Cria o elemento DOM, insere o HTML e inicializa os editores.
 */
export const criarNovoPasso = (containerPassos) => {
  const novoIndex = containerPassos.children.length;

  // 1. Cria o elemento container do passo
  const div = document.createElement('div');
  div.className = 'step-edit-row';
  div.dataset.stepIndex = novoIndex;
  div.style.cssText =
    'border:1px solid var(--color-border); padding:15px; border-radius:8px; margin-bottom:15px; background:var(--color-bg-1);';

  // 2. Gera o conteúdo HTML (Visual)
  const blocoTextoInicial = criarHtmlBlocoEditor('texto', '');
  div.innerHTML = gerarHtmlTemplatePasso(blocoTextoInicial);

  // 3. Insere no DOM
  containerPassos.appendChild(div);

  // 4. Inicializa os eventos do novo passo
  if (typeof initStepEditors === 'function') {
    initStepEditors();
  } else {
    // Fallback corrigido: usa o nome certo da função
    const novaRow = containerPassos.lastElementChild;
    configurarLinhaEditorPasso(novaRow);
  }

  // 5. Scroll suave para o novo passo
  div.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/**
 * Retorna apenas a string HTML da estrutura do passo.
 * Separa o "Design" da "Lógica".
 */
export const gerarHtmlTemplatePasso = (blocoInicialHtml) => {
  return `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
            <strong style="color:var(--color-primary);">Passo (Novo)</strong>
            <button type="button" class="btn btn--sm btn--outline btn-remove-step" style="color:var(--color-error); border-color:var(--color-error); font-size:11px;">✕ Remover Passo</button>
        </div>

        <div class="structure-editor-wrapper">
            <div class="structure-editor-container step-drag-container" style="min-height: 50px; background: var(--color-background);">
                ${blocoInicialHtml}
            </div>
            
            <div class="structure-toolbar step-add-toolbar" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--color-border); position:relative;">
                <button type="button" class="btn btn--sm btn--secondary btn--full-width btn-toggle-step-add" style="display:flex; justify-content:center; align-items:center; gap:5px; background:var(--color-bg-2);">
                    <span>+ Adicionar Bloco de Conteúdo</span>
                    <span style="font-size:10px; opacity:0.7;">▼</span>
                </button>
                <div class="step-menu-content hidden" style="position:absolute; top:100%; left:0; width:100%; z-index:100; display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:5px; padding:10px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.15); margin-top:5px;">
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="texto">Texto</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="imagem">Imagem</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="equacao">Equação</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="lista">Lista</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="destaque">Destaque</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="citacao">Citação</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="codigo">Código</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="titulo">Título</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="subtitulo">Subtítulo</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="fonte">Fonte</button>
                    <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="separador">Separador</button>
                </div>
            </div>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px; background:rgba(0,0,0,0.03); padding:10px; border-radius:6px;">
            <div style="flex:1;">
                <span class="field-label" style="font-size:10px;">Origem</span>
                <select class="form-control passo-origem" style="width:100%;"><option value="gerado_pela_ia">🤖 IA</option><option value="extraido_do_material">📄 Material</option></select>
            </div>
            <div style="flex:1;">
                <span class="field-label" style="font-size:10px;">Fonte</span>
                <input class="form-control passo-fonte" value="" style="width:100%;" />
            </div>
            <div style="grid-column:1/-1;">
                <span class="field-label" style="font-size:10px;">Evidência</span>
                <input class="form-control passo-evidencia" value="" style="width:100%;" />
            </div>
        </div>
    `;
};

// --- LÓGICA DE REATIVIDADE ROBUSTA ---
export const setupImageToggle = (checkboxId, containerId, targetObj) => {
  const chk = document.getElementById(checkboxId);
  const cont = document.getElementById(containerId);

  if (!chk || !cont) return;

  // Função que aplica o estado
  const applyState = () => {
    cont.style.display = chk.checked ? 'block' : 'none';
    // Persiste no objeto global
    if (targetObj) targetObj.possui_imagem = chk.checked;
  };

  // Estado inicial
  applyState();

  // Listener
  chk.addEventListener('change', applyState);
};

/**
 * 2. HELPER: FACTORY DE PASSO
 * Exatamente a mesma lógica da função interna 'createStep' original.
 */
export const _createStep = (estruturaArr, meta = {}) => ({
  estrutura: estruturaArr, // Array de blocos
  origem: String(meta.origem ?? 'geradopelaia'),
  fontematerial: String(meta.fontematerial ?? meta.fonteMaterial ?? ''),
  evidencia: String(meta.evidencia ?? ''),
});