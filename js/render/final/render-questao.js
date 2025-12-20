import { _atualizarEstadoGlobal } from '../../normalize/payload.js';
import { _garantirEstruturaSidebar } from '../../viewer/resizer.js';
import { _gerarHtmlAbaQuestao } from '../questao-tabs.js';
import { _gerarHtmlAbas } from '../questao-tabs.js';
import { _gerarHtmlEditorEstrutura } from '../questao-tabs.js';
import { _gerarHtmlQuestao } from '../questao-tabs.js';
import { _prepararContainerEBackups } from '../../normalize/payload.js';
import { _prepararDadosIniciais } from '../../normalize/payload.js';
import { _prepararInterfaceBasica } from '../../normalize/payload.js';
import { _processarDadosPayload } from '../../normalize/payload.js';
import { aplicarAlteracoesNaTela } from '../questao-tabs.js';
import { configurarBotoesControleQuestao } from '../../editor/questao-save.js';
import { configurarEventosAuxiliares } from '../questao-tabs.js';
import { configurarInteratividadeGeral } from '../questao-tabs.js';
import { configurarNavegacaoEdicao } from '../../editor/gabarito-save.js';
import { configurarTabs } from '../../ui/tabs.js';
import { initBotaoAdicionarAlternativa } from '../questao-tabs.js';
import { initBotaoSalvarGabarito } from '../../editor/gabarito-save.js';
import { initBotaoSalvarQuestao } from '../../editor/questao-save.js';

/**
 * Renderiza os dados finais da Questão na Sidebar.
 */
export function renderizarQuestaoFinal(dados, elementoAlvo = null) {
  var { root, isGabaritoData, dadosNorm } = _prepararDadosIniciais(dados);

  dadosNorm = _processarDadosPayload(root, isGabaritoData);

  _atualizarEstadoGlobal(dados, dadosNorm);

  let { questao, gabarito, viewerBody, main, sidebar, resizer } =
    _prepararInterfaceBasica(dadosNorm);

  // Atualizamos as variáveis sidebar e resizer com o resultado da função
  ({ sidebar, resizer } = _garantirEstruturaSidebar(
    viewerBody,
    main,
    sidebar,
    resizer
  ));

  let container = _prepararContainerEBackups(elementoAlvo, dados);

  let { htmlAbas, displayQuestao, displayGabarito } = _gerarHtmlAbas(gabarito);

  const { htmlEstruturaVisual, blocosHtml } = _gerarHtmlQuestao(questao);

  const htmlEstruturaEdit = _gerarHtmlEditorEstrutura(blocosHtml);

  const htmlQuestao = _gerarHtmlAbaQuestao(
    questao,
    displayQuestao,
    htmlEstruturaVisual,
    htmlEstruturaEdit,
    gabarito
  );

  aplicarAlteracoesNaTela(
    sidebar, // Sidebar onde vai entrar
    container, // O container criado em memória
    questao, // Dados
    gabarito, // Dados
    htmlAbas, // String HTML
    htmlQuestao, // String HTML
    displayGabarito // "block" ou "none"
  );

  configurarEventosAuxiliares(container);

  configurarInteratividadeGeral(container);

  initBotaoAdicionarAlternativa(container);

  configurarNavegacaoEdicao(container, gabarito);

  initBotaoSalvarGabarito(container, questao);

  configurarBotoesControleQuestao(container);

  initBotaoSalvarQuestao(container);

  configurarTabs(container, gabarito);
}