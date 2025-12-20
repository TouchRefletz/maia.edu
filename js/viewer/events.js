import { cancelarRecorte, mudarPagina, mudarZoom } from '../cropper/cropper-core.js';
import { fecharModalConfirmacao } from '../cropper/gallery.js';
import { ativarModoRecorte } from '../cropper/mode.js';
import { salvarQuestao } from '../cropper/save-handlers.js';
import { confirmarEnvioIA } from '../envio/ui-estado.js';
import { viewerState } from '../main.js';
import { inicializarContextoViewer } from './contexto.js';
import { carregarDocumentoPDF, trocarModo } from './pdf-core.js';
import { configurarResizerSidebar } from './resizer.js';
import { atualizarUIViewerModo, montarTemplateViewer } from './viewer-template.js';

/**
 * Configura todos os listeners de clique da interface do visualizador.
 */
export function configurarEventosViewer() {
  // Helper para encurtar o código e evitar erros se o botão não existir
  const aoClicar = (id, callback) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.addEventListener('click', callback);
    } else {
      console.warn(`Botão não encontrado: #${id}`);
    }
  };

  // --- Controles Básicos ---
  aoClicar('btnFecharViewer', fecharVisualizador);

  // --- Navegação ---
  aoClicar('btn-prev', () => mudarPagina(-1));
  aoClicar('btn-next', () => mudarPagina(1));

  // --- Zoom ---
  aoClicar('btnZoomOut', () => mudarZoom(-0.2));
  aoClicar('btnZoomIn', () => mudarZoom(0.2));

  // --- Modos de Visualização ---
  aoClicar('btnModoProva', () => trocarModo('prova'));
  aoClicar('btnModoGabarito', () => trocarModo('gabarito'));

  // --- Ferramenta de Recorte (Header) ---
  aoClicar('btnRecortarHeader', ativarModoRecorte);

  // --- Ações Flutuantes (Durante o Recorte) ---
  aoClicar('btnConfirmarRecorte', salvarQuestao);
  aoClicar('btnCancelarRecorte', cancelarRecorte);

  // --- Modal de Confirmação ---
  aoClicar('btnModalMaisRecorte', fecharModalConfirmacao);
  aoClicar('btnModalProcessar', confirmarEnvioIA);
  aoClicar('btnModalCancelarTudo', fecharModalConfirmacao);
}

export function realizarLimpezaCompleta() {
  // 1. Encerra cropper com segurança
  try {
    if (typeof viewerState.cropper !== 'undefined' && viewerState.cropper) {
      viewerState.cropper.destroy();
      viewerState.cropper = null;
    }
  } catch (_) { }

  // 2. Limpeza do DOM (Visual)
  const idsParaRemover = [
    'pdfViewerContainer',
    'sidebarResizer',
    'viewerSidebar',
    'reopenSidebarBtn',
    'finalModal',
  ];

  idsParaRemover.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // Esconde/Reseta elementos persistentes
  document.getElementById('cropConfirmModal')?.classList.remove('visible');
  document.getElementById('floatingActionParams')?.classList.add('hidden');

  // 3. Gestão de Memória (URLs)
  try {
    if (window.__pdfUrls?.prova) URL.revokeObjectURL(window.__pdfUrls.prova);
    if (window.__pdfUrls?.gabarito)
      URL.revokeObjectURL(window.__pdfUrls.gabarito);
  } catch (_) { }

  // 4. Reset das Variáveis Globais (Estado)
  window.__pdfUrls = { prova: null, gabarito: null };
  window.__viewerArgs = null;
  window.__modo = 'prova';
  window.modo = 'prova';
  window.__isProcessing = false;
  window.__capturandoImagemFinal = false;

  window.__ultimaQuestaoExtraida = null;
  window.__ultimoGabaritoExtraido = null;
  window.questaoAtual = {};

  window.__recortesAcumulados = [];
  window.recortesAcumulados = [];

  window.__imagensLimpas = {
    questao_original: [],
    questao_suporte: [],
    gabarito_original: [],
    gabarito_suporte: [],
  };
}

export function fecharVisualizador() {
  // 1. Pergunta de Segurança
  const msg =
    'Tem certeza que deseja fechar e voltar ao início? \n\nTodo o progresso não salvo desta questão será perdido.';
  if (!confirm(msg)) {
    return;
  }

  // 2. Chama a Limpeza Pesada
  realizarLimpezaCompleta();

  // 3. Redireciona/Recarrega a Interface de Upload
  if (typeof generatePDFUploadInterface === 'function') {
    generatePDFUploadInterface(null); // Null garante form limpo
  }
}

/**
 * Renderiza a interface de visualização de PDF e anexa os eventos.
 */
export function gerarVisualizadorPDF(args) {
  // FASE 1: Preparação
  const urlProva = inicializarContextoViewer(args);

  // FASE 2: Injeção do HTML no DOM
  const viewerHTML = montarTemplateViewer(args);
  document.body.insertAdjacentHTML('beforeend', viewerHTML);

  // FASE 3: Eventos (Toda a mágica em uma linha)
  configurarEventosViewer();

  // Configurações finais (resize, etc)
  configurarResizerSidebar();

  atualizarUIViewerModo();

  carregarDocumentoPDF(urlProva);
}