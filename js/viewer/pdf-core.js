import { viewerState } from '../main.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { validarProgressoImagens } from '../validation/metricas-imagens.js';
import { atualizarUIViewerModo } from './viewer-template.js';

export function renderPage(num) {
  // Retorna promessa vazia se estiver ocupado ou sem PDF
  if (!viewerState.pdfDoc || viewerState.isRendering) return Promise.resolve();
  viewerState.isRendering = true;

  return viewerState.pdfDoc.getPage(num).then(function (page) {
    const canvas = document.getElementById('the-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: viewerState.pdfScale });
    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const transform =
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
      transform: transform,
    };

    // Usa a variável global cropper
    if (typeof viewerState.cropper !== 'undefined' && viewerState.cropper) {
      viewerState.cropper.destroy();
      viewerState.cropper = null;
    }

    const renderTask = page.render(renderContext);

    return renderTask.promise.then(function () {
      viewerState.isRendering = false;
      document.getElementById('page_num').textContent =
        `Pag ${num} / ${viewerState.pdfDoc.numPages}`;
      document.getElementById('zoom_level').textContent =
        `${Math.round(viewerState.pdfScale * 100)}%`;

      const manager = document.getElementById('questionManager');
      const actions = document.querySelector('.sidebar-actions');

      // Verifica se actions existe para evitar erro
      if (
        manager &&
        !manager.classList.contains('hidden') &&
        actions &&
        actions.classList.contains('hidden')
      ) {
        iniciarCropper();
      }
    });
  });
}

export function carregarDocumentoPDF(url) {
  const loadingTask = pdfjsLib.getDocument(url);

  loadingTask.promise.then(function (pdf) {
    viewerState.pdfDoc = pdf;
    viewerState.pageNum = 1;
    renderPage(viewerState.pageNum);
  });
}

export function ensurePdfUrls() {
  // CORREÇÃO: Usar window.__pdfUrls (com duplo underscore)
  if (!window.__pdfUrls) window.__pdfUrls = { prova: null, gabarito: null };

  // CORREÇÃO: Usar window.__viewerArgs (com duplo underscore)
  const args = window.__viewerArgs;

  const fileProva = args?.fileProva;
  const fileGabarito = args?.fileGabarito;

  // se perdeu a URL da prova, recria
  if (!window.__pdfUrls.prova && fileProva) {
    window.__pdfUrls.prova = URL.createObjectURL(fileProva);
  }

  // se perdeu a URL do gabarito, recria (se existir)
  if (!window.__pdfUrls.gabarito && fileGabarito) {
    window.__pdfUrls.gabarito = URL.createObjectURL(fileGabarito);
  }

  return !!window.__pdfUrls.prova;
}

/**
 * Verifica todas as regras de segurança antes de permitir a troca de modo.
 * Retorna true se puder trocar, false se for bloqueado.
 */
export async function verificarBloqueiosTroca(novoModo) {
  // Validação básica de ambiente
  if (!ensurePdfUrls()) {
    console.warn(
      '[TrocarModo] Abortado: sem PDF da prova para reconstruir URL'
    );
    return false;
  }

  if (!document.getElementById('pdfViewerContainer')) {
    console.warn('[TrocarModo] Abortado: Viewer não está montado no DOM');
    return false;
  }

  // Validação: Prova -> Gabarito (Tem imagens pendentes?)
  if (window.__modo === 'prova' && novoModo === 'gabarito') {
    const podeIr = await validarProgressoImagens();
    if (!podeIr) return false;
  }

  // Validação: Indo para Gabarito (Processamento ou falta de questão)
  if (novoModo === 'gabarito') {
    if (window.__isProcessing) {
      console.warn('[TrocarModo] Bloqueado: Processamento em andamento.');
      customAlert('⏳ Aguarde Maia terminar de analisar a questão...', 3000);
      return false;
    }

    if (!window.__ultimaQuestaoExtraida) {
      console.warn('[TrocarModo] Bloqueado: Nenhuma questão extraída ainda.');
      customAlert('⚠️ Capture e processe a Questão (Prova) primeiro!', 3000);
      return false;
    }
  }

  // Validação de input inválido
  if (novoModo !== 'prova' && novoModo !== 'gabarito') return false;

  return true; // Passou por tudo, liberado!
}

export async function trocarModo(novoModo) {
  console.log(`[TrocarModo] Tentando ir para: ${novoModo}`);

  // 1. Pergunta para o "Guarda" se pode passar
  const permitido = await verificarBloqueiosTroca(novoModo);
  if (!permitido) return false;

  // Atualiza estados globais
  window.__modo = novoModo;
  window.modo = novoModo; // Compatibilidade

  // Limpa buffer de recortes para evitar duplicação
  window.__recortesAcumulados = [];
  window.recortesAcumulados = [];

  // Chama a função de UI refatorada (sem window)
  atualizarUIViewerModo();

  // Lógica de URL
  let url = window.__pdfUrls.prova; // Default

  if (novoModo === 'gabarito') {
    const temPdfGabarito = !!window.__pdfUrls.gabarito;
    if (temPdfGabarito) {
      window.__preferirPdfGabarito = true;
      url = window.__pdfUrls.gabarito;
    } else {
      url = window.__pdfUrls.prova;
    }
  }

  // Renderiza o PDF (Mantendo a lógica original do trecho)
  try {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;

    // AQUI: Acesso direto às globais, sem window.
    viewerState.pdfDoc = pdf;
    viewerState.pageNum = 1;

    await renderPage(viewerState.pageNum);
    return true;
  } catch (err) {
    console.error('Erro ao carregar PDF do modo ' + novoModo, err);
    customAlert('Erro ao carregar o PDF.', 2000);
    return false;
  }
}