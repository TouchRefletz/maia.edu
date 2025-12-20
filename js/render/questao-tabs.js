import { configurarEventosNovaAlternativa, gerarHtmlTemplateAlternativa } from '../editor/alternativas.js';
import { initBotaoAdicionarPasso, setupImageToggle } from '../editor/passos.js';
import { initStepEditors } from '../editor/steps-ui.js';
import { criarHtmlBlocoEditor, iniciarEditorEstrutura } from '../editor/structure-editor.js';
import { renderLatexIn } from '../libs/loader.js';
import { escapeHTML, joinLines } from '../normalize/primitives.js';
import { validarProgressoImagens } from '../validation/metricas-imagens.js';
import { renderAlternativas } from './alternativas.js';
import { renderizarTelaFinal } from './final/json-e-modal.js';
import { renderTags } from './final/render-components.js';
import { prepararDadosGabarito, renderAcoesGabarito, renderCartaoGabarito, renderFormularioEditor } from './gabarito-card.js';
import { renderizarEstruturaHTML } from './structure.js';

/**
 * Gera o HTML das abas e define qual deve estar visível inicialmente.
 */
export const _gerarHtmlAbas = (gabarito) => {
  // Lógica de visualização baseada no modo atual
  const displayQuestao =
    window.__modo === 'gabarito' && gabarito ? 'none' : 'block';
  const displayGabarito =
    window.__modo === 'gabarito' && gabarito ? 'block' : 'none';

  let htmlAbas = '';

  // Só renderiza abas se existir gabarito para mostrar
  if (gabarito) {
    htmlAbas = `
        <div class="tabs-header" style="display:flex; gap:5px; margin-bottom:15px; border-bottom:1px solid #ddd; padding-bottom:5px;">
            <button type="button" id="btnTabQuestao" class="btn btn--sm ${displayQuestao === 'block' ? 'btn--primary' : 'btn--secondary'}" style="flex:1;">Questão</button>
            <button type="button" id="btnTabGabarito" class="btn btn--sm ${displayGabarito === 'block' ? 'btn--primary' : 'btn--secondary'}" style="flex:1;">Gabarito</button>
        </div>`;
  }

  return { htmlAbas, displayQuestao, displayGabarito };
};

/**
 * Gera o HTML da visualização e dos blocos de edição da Questão.
 */
export const _gerarHtmlQuestao = (questao) => {
  // 1. Recupera as imagens locais (recortes manuais)
  const imagensLocaisQuestao = window.__imagensLimpas?.questao_original || [];

  // 2. Gera o HTML Visual (Preview)
  // Usa a função auxiliar renderizarEstruturaHTML passando o contexto 'questao'
  const htmlEstruturaVisual = renderizarEstruturaHTML(
    questao.estrutura,
    imagensLocaisQuestao,
    'questao'
  );

  // 3. Gera o HTML do Editor (Blocos arrastáveis)
  const estruturaAtual = questao.estrutura || [];
  const blocosHtml = estruturaAtual
    .map((bloco) => criarHtmlBlocoEditor(bloco.tipo, bloco.conteudo))
    .join('');

  return { htmlEstruturaVisual, blocosHtml };
};

/**
 * Gera o HTML do container do editor de estrutura e seus botões de ação.
 */
export const _gerarHtmlEditorEstrutura = (blocosHtml) => {
  return `
    <div class="structure-editor-wrapper">
        <div id="editor-drag-container" class="structure-editor-container">
        ${blocosHtml}
        </div>

        <div id="editor-add-buttons" class="structure-toolbar structure-toolbar--addmenu">
        <button type="button" id="btnToggleAddMenu" class="btn btn--primary btn--full-width btn-add-main">
            + Adicionar bloco
        </button>

        <div id="editorAddMenu" class="add-menu hidden">
            <button type="button" class="btn-add-block" data-add-type="texto">Texto</button>
            <button type="button" class="btn-add-block" data-add-type="titulo">Título</button>
            <button type="button" class="btn-add-block" data-add-type="subtitulo">Subtítulo</button>
            <button type="button" class="btn-add-block" data-add-type="citacao">Citação</button>
            <button type="button" class="btn-add-block" data-add-type="lista">Lista</button>
            <button type="button" class="btn-add-block" data-add-type="equacao">Equação</button>
            <button type="button" class="btn-add-block" data-add-type="codigo">Código</button>
            <button type="button" class="btn-add-block" data-add-type="destaque">Destaque</button>
            <button type="button" class="btn-add-block" data-add-type="separador">Separador</button>
            <button type="button" class="btn-add-block" data-add-type="fonte">Fonte</button>
            <button type="button" class="btn-add-block" data-add-type="imagem">Imagem</button>
        </div>
        </div>
    </div>
    `;
};

/**
 * Gera o HTML do modo de leitura da Questão.
 */
export const _gerarHtmlVisualizacaoQuestao = (questao, htmlEstruturaVisual) => {
  return `
    <div id="questaoView">
        <div class="field-group"><span class="field-label">Identificação</span><div class="data-box">${escapeHTML(questao.identificacao)}</div></div>
        
        <div class="field-group">
            <span class="field-label">Conteúdo da Questão</span>
            <div class="data-box scrollable" style="padding:15px;">
                ${htmlEstruturaVisual}
            </div>
        </div>
        
        <div style="display:flex; gap:10px; margin-top:10px;">
            <div class="field-group" style="flex:1;"><span class="field-label">Matéria</span><div class="data-box">${renderTags(questao.materias_possiveis, 'tag-subject')}</div></div>
        </div>
        <div class="field-group"><span class="field-label">Palavras-Chave</span><div class="tags-wrapper">${renderTags(questao.palavras_chave, 'tag-keyword')}</div></div>
        <div class="field-group"><span class="field-label">Alternativas (${questao.alternativas ? questao.alternativas.length : 0})</span><div class="alts-list">${renderAlternativas(questao.alternativas)}</div></div>
    </div>
    `;
};

/**
 * Gera o HTML do formulário de edição da Questão.
 */
export const _gerarHtmlEdicaoQuestao = (questao, htmlEstruturaEdit) => {
  // Gera o HTML das alternativas editáveis
  const htmlAlternativasEdit = (questao.alternativas || [])
    .map((alt, i) => {
      const letraSafe = escapeHTML(alt.letra ?? '');

      const estruturaAlt = Array.isArray(alt.estrutura)
        ? alt.estrutura
        : [{ tipo: 'texto', conteudo: String(alt.texto ?? '') }];

      const blocosAltHtml = estruturaAlt
        .map((b) => criarHtmlBlocoEditor(b.tipo, b.conteudo))
        .join('');

      return `
        <div class="alt-row alt-edit-row" data-alt-index="${i}" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
            <div style="display:flex;gap:5px;align-items:center;">
                <input class="form-control alt-letter" style="width:60px;text-align:center;" value="${letraSafe}" placeholder="Letra">
                <button type="button" class="btn btn--sm btn--outline btn-remove-alt" style="color:var(--color-error);border-color:var(--color-error);min-width:30px;" title="Remover alternativa">✕</button>
            </div>

            <div class="alt-editor">
                <div class="structure-editor-wrapper">
                    <div class="structure-editor-container alt-drag-container">
                        ${blocosAltHtml}
                    </div>

                    <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                        <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="texto">Texto</button>
                        <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="equacao">Equação</button>
                        <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="imagem">Imagem</button>
                    </div>
                </div>
            </div>
        </div>`;
    })
    .join('');

  return `
    <form id="questaoEdit" class="hidden">
        <div class="field-group"><span class="field-label">Identificação</span><input id="edit_identificacao" class="form-control" type="text" value="${escapeHTML(questao.identificacao)}"></div>
        
        <div class="field-group">
            <span class="field-label">Estrutura (Edição de Texto)</span>
            <div id="edit_estrutura_container">
                ${htmlEstruturaEdit}
            </div>
            <small style="color:gray; font-size:10px;">* Para alterar imagens, clique no botão "Trocar Imagem" na visualização acima.</small>
        </div>

        <div class="field-group"><span class="field-label">Matérias (1/linha)</span><textarea id="edit_materias" class="form-control" rows="2">${escapeHTML(joinLines(questao.materias_possiveis))}</textarea></div>
        <div class="field-group"><span class="field-label">Palavras-chave (1/linha)</span><textarea id="edit_palavras" class="form-control" rows="2">${escapeHTML(joinLines(questao.palavras_chave))}</textarea></div>
        
        <div class="field-group">
            <span class="field-label">Alternativas</span>
            <div id="edit_alts" class="alts-list">
                ${htmlAlternativasEdit}
            </div>
            <button type="button" class="btn btn--secondary btn--full-width" id="btnAddAlt" style="margin-top:5px;">+ Adicionar Alternativa</button>
        </div>
        
        <button type="button" class="btn btn--primary btn--full-width" id="btnSalvarEdicao" style="margin-top:15px;">💾 Salvar Alterações</button>
    </form>

    <form id="questaoEditActions" class="hidden">
        <div style="padding:10px; background:#eee; text-align:center; margin:10px 0;">Modo Edição</div>
        <button type="button" class="btn btn--secondary btn--full-width" id="btnCancelarEdicao">Cancelar</button>
    </form>
    `;
};

/**
 * Agrupa todo o HTML da aba Questão.
 */
export const _gerarHtmlAbaQuestao = (
  questao,
  displayQuestao,
  htmlEstruturaVisual,
  htmlEstruturaEdit,
  gabarito
) => {
  const htmlView = _gerarHtmlVisualizacaoQuestao(questao, htmlEstruturaVisual);
  const htmlEdit = _gerarHtmlEdicaoQuestao(questao, htmlEstruturaEdit);

  const btnConfirmar = !gabarito
    ? `<button type="button" class="btn btn--primary btn--full-width" id="btnConfirmarQuestao" style="margin-top:5px;">Confirmar e Extrair Gabarito ➡️</button>`
    : '';

  return `
    <div id="tabContentQuestao" style="display: ${displayQuestao};">
        <div class="result-header">
            <h3>Questão Extraída</h3>
            <span class="badge-success">Sucesso</span>
        </div>

        ${htmlView}
        ${htmlEdit}

        <div class="result-actions" id="actionsLeitura" style="margin-top:15px;">
            <button type="button" class="btn btn--secondary btn--full-width" id="btnEditar">✏️ Editar Conteúdo</button>
            ${btnConfirmar}
        </div>
    </div>`;
};

/**
 * Monta o HTML final (Abas + Questão + Gabarito se houver),
 * injeta no container e dispara o renderizador de LaTeX.
 */
export function atualizarInterfaceQuestao(
  container,
  questao,
  gabarito,
  htmlAbas,
  htmlQuestao,
  displayGabarito
) {
  let htmlGabarito = '';

  // 1. Se tiver gabarito, prepara os dados e renderiza os componentes
  if (gabarito) {
    const dadosGabarito = prepararDadosGabarito(gabarito, questao);

    htmlGabarito = `
            <div id="tabContentGabarito" style="display:${displayGabarito}">
                <div id="gabaritoView">
                    ${renderCartaoGabarito(dadosGabarito)}
                    ${renderAcoesGabarito()}
                </div>
                ${renderFormularioEditor(dadosGabarito)}
            </div>
        `;
  }

  // 2. Injeta tudo no DOM
  container.innerHTML = htmlAbas + htmlQuestao + htmlGabarito;

  // 3. Renderiza LaTeX (mesma lógica do timeout)
  setTimeout(() => {
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(container);
    }
  }, 0);
}

/**
 * Finaliza o processo: Gera o HTML, injeta na Sidebar e liga os scripts.
 */
export function aplicarAlteracoesNaTela(
  sidebar,
  container,
  questao,
  gabarito,
  htmlAbas,
  htmlQuestao,
  displayGabarito
) {
  // 1. Gera o HTML interno e dispara o LaTeX (lógica visual)
  atualizarInterfaceQuestao(
    container,
    questao,
    gabarito,
    htmlAbas,
    htmlQuestao,
    displayGabarito
  );

  // 2. Configura o botão de "Adicionar Passo" (antes de ir pra tela)
  initBotaoAdicionarPasso(container);

  // 3. LIMPEZA E INSERÇÃO NA DOM (O momento crítico)
  const oldResult = sidebar.querySelector('.extraction-result');
  if (oldResult) oldResult.remove();

  sidebar.appendChild(container); // <--- Agora o elemento existe na tela

  // 4. Inicializa os scripts que dependem do elemento estar visível
  initStepEditors(container); // Editores dos passos do gabarito
  iniciarEditorEstrutura(); // Editor da estrutura principal da questão
}

/**
 * Configura eventos secundários:
 * 1. Botões de adicionar blocos dentro das alternativas.
 * 2. Botão de remover alternativa.
 * 3. Inicialização do toggle de imagem do gabarito (com delay).
 */
export const configurarEventosAuxiliares = (container) => {
  // --- 1. Botões das Alternativas (Adicionar Bloco / Remover Alternativa) ---
  container.querySelectorAll('.alt-edit-row').forEach((row) => {
    const drag = row.querySelector('.alt-drag-container');
    if (!drag) return;

    // Botões "Adicionar [Texto/Imagem/Etc]" na alternativa
    row.querySelectorAll('.btn-alt-add').forEach((btn) => {
      btn.onclick = () => {
        const tipo = btn.dataset.addType;

        // Gera o HTML do bloco e insere
        const html = criarHtmlBlocoEditor(tipo, '');
        const temp = document.createElement('div');
        temp.innerHTML = html.trim();

        drag.appendChild(temp.firstChild);
      };
    });

    // Botão Remover Alternativa inteira
    row
      .querySelector('.btn-remove-alt')
      ?.addEventListener('click', () => row.remove());
  });

  // --- 2. Toggle de Imagem do Gabarito ---
  // Mantemos o setTimeout para garantir que os IDs existam na DOM
  setTimeout(() => {
    setupImageToggle(
      'editGabaritoPossuiImagem',
      'containerGaleriaGabarito',
      window.__ultimoGabaritoExtraido
    );
  }, 0);
};

/**
 * Configura os botões principais da interface:
 * 1. Botão "Editar Questão" (troca de visualização)
 * 2. Botão "Finalizar Tudo" (validação e envio)
 * 3. Botões de "Remover Alternativa" (para itens que já vieram carregados)
 */
export const configurarInteratividadeGeral = (container) => {
  // --- 1. Botão Editar (Entra no modo edição) ---
  const btnEditar = container.querySelector('#btnEditar');
  if (btnEditar) {
    btnEditar.onclick = () => {
      const view = container.querySelector('#questaoView');
      const edit = container.querySelector('#questaoEdit');
      const actions = container.querySelector('#actionsLeitura');

      if (view) view.classList.add('hidden');
      if (actions) actions.classList.add('hidden');
      if (edit) edit.classList.remove('hidden');
    };
  }

  // --- 2. Botão Finalizar Tudo (Validação) ---
  const btnFinalizarTudo = container.querySelector('#btnFinalizarTudo');
  if (btnFinalizarTudo) {
    btnFinalizarTudo.onclick = async () => {
      const tudoCerto = await validarProgressoImagens('gabarito');

      // Só avança se estiver tudo preenchido ou confirmado
      if (tudoCerto) {
        renderizarTelaFinal();
      }
    };
  }

  // --- 3. Remoção de Alternativas (Itens pré-existentes) ---
  // Nota: Os itens novos criados dinamicamente já têm seu próprio evento no momento da criação.
  // Isso aqui garante que os que vieram do HTML estático também funcionem.
  container.querySelectorAll('.btn-remove-alt').forEach((btn) => {
    btn.onclick = function () {
      // Remove o pai (a linha da alternativa)
      this.parentElement.remove();
    };
  });
};

/**
 * Inicializa o botão principal de "+ Adicionar Alternativa".
 */
export const initBotaoAdicionarAlternativa = (container) => {
  const btnAddAltEdit = container.querySelector('#btnAddAlt');

  if (btnAddAltEdit) {
    btnAddAltEdit.onclick = () => {
      const divAlts = container.querySelector('#edit_alts');
      if (divAlts) {
        adicionarNovaAlternativa(divAlts);
      }
    };
  }
};

/**
 * Cria a estrutura DOM da nova alternativa, injeta o HTML e configura os eventos.
 */
export const adicionarNovaAlternativa = (containerAlts) => {
  const novaLinha = document.createElement('div');
  novaLinha.className = 'alt-row alt-edit-row';
  novaLinha.style.cssText =
    'display:flex;flex-direction:column;gap:8px;margin-bottom:10px;';

  // Cria um passo novo já com 1 bloco de texto vazio
  const blocoTextoInicial = criarHtmlBlocoEditor('texto', '');

  // Injeta o Template Visual
  novaLinha.innerHTML = gerarHtmlTemplateAlternativa(blocoTextoInicial);

  // Configura os eventos (Botões de adicionar bloco e remover linha)
  configurarEventosNovaAlternativa(novaLinha);

  // Adiciona ao container
  containerAlts.appendChild(novaLinha);
};