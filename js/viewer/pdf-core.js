import { viewerState } from '../main.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { validarProgressoImagens } from '../validation/metricas-imagens.js';
import { atualizarUIViewerModo } from './viewer-template.js';

// --- CONTROLE DE LAZY LOADING ---
let observer = null;
let pagesRenderedState = {}; // Cache para evitar re-render desnecessário via JS
let isProgrammaticScroll = false;
let programmaticScrollTimeout = null;

/**
 * Inicializa a observação de visibilidade das páginas
 */
function startIntersectionObserver() {
  if (observer) observer.disconnect();

  const container = document.getElementById('canvasContainer');
  if (!container) return;

  const options = {
    root: container,
    rootMargin: '400px', // Carrega páginas 400px antes de entrarem na tela (Aumentado para smooth scroll)
    threshold: [0, 0.1, 0.5] // Gatilhos mais granulares
  };

  observer = new IntersectionObserver(handleIntersection, options);

  // Observa todas as páginas já criadas no DOM
  const pages = document.querySelectorAll('.pdf-page');
  pages.forEach(page => observer.observe(page));
}

// NOVO: Import para atualizar overlay ao renderizar
import { refreshOverlayPosition } from '../cropper/selection-overlay.js';

/**
 * Handler do Observer (Debounced + Lock)
 * Lógica de "Dominância": A página atual é a que tem maior área visível (pixels) na tela
 */
function handleIntersection(entries) {
  if (isProgrammaticScroll) return;

  // Atualiza o estado de quem está visível
  entries.forEach(entry => {
    const pageNum = parseInt(entry.target.dataset.pageNum, 10);
    if (entry.isIntersecting) {
      // Renderiza se ainda não foi (Lazy)
      if (pageNum && !pagesRenderedState[pageNum]) {
        renderPage(pageNum);
      }
      // Registra razão de interseção para cálculo de dominância
      // Podemos usar um mapa global temporário ou apenas olhar entries atuais?
      // O Observer dispara para CADA mudança. O ideal é olhar o estado global.
    }
  });

  // CÁLCULO DE PÁGINA DOMINANTE
  // Percorremos todas as páginas visíveis para decidir quem manda.
  const container = document.getElementById('canvasContainer');
  if (!container) return;

  const visiblePages = Array.from(document.querySelectorAll('.pdf-page')).map(page => {
    const rect = page.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calcula intersecção vertical
    const intersectionTop = Math.max(rect.top, containerRect.top);
    const intersectionBottom = Math.min(rect.bottom, containerRect.bottom);
    const height = Math.max(0, intersectionBottom - intersectionTop);

    return {
      pageNum: parseInt(page.dataset.pageNum),
      visibleHeight: height
    };
  });

  // Ordena por maior altura visível
  visiblePages.sort((a, b) => b.visibleHeight - a.visibleHeight);

  if (visiblePages.length > 0) {
    const bestPage = visiblePages[0];
    // Só muda se tiver pelo menos 50px visíveis (pra não pegar pixel perdido)
    if (bestPage.visibleHeight > 50) {
      if (viewerState.pageNum !== bestPage.pageNum) {
        viewerState.pageNum = bestPage.pageNum;
        updateNavigationUI(bestPage.pageNum);
      }
    }
  }
}

function updateNavigationUI(pageNum) {
  const pageLabel = document.getElementById('page_num');
  const pageLabelMobile = document.getElementById('pageNumMobile'); // Mobile Sync

  if (viewerState.pdfDoc) {
    const text = `Pag ${pageNum} / ${viewerState.pdfDoc.numPages}`;
    if (pageLabel) pageLabel.textContent = text;
    if (pageLabelMobile) pageLabelMobile.textContent = text;
  }
}

/**
 * RECONSTRUÇÃO TOTAL DO LAYOUT (CHAMADA NO ZOOM OU LOAD INICIAL)
 * Preserva o scroll relativo visualmente.
 */
/**
 * RECONSTRUÇÃO TOTAL DO LAYOUT (CHAMADA NO ZOOM OU LOAD INICIAL)
 * Preserva o scroll relativo visualmente.
 */
export async function renderAllPages() {
  const container = document.getElementById('canvasContainer');
  if (!container || !viewerState.pdfDoc) return;

  const numPages = viewerState.pdfDoc.numPages;

  // --- 1. CAPTURA DO CENTRO ATUAL (Para restaurar scroll após zoom) ---
  let scrollRestoration = null;
  // Só tentamos restaurar se já houver conteúdo e não for render inicial
  if (container.children.length > 0 && viewerState.pdfScale) {
    const containerCenter = container.scrollTop + (container.clientHeight / 2);
    const wrappers = Array.from(container.children).filter(el => el.classList.contains('pdf-page'));
    for (let wrapper of wrappers) {
      const top = wrapper.offsetTop;
      const bottom = top + wrapper.offsetHeight;
      if (containerCenter >= top && containerCenter < bottom) {
        const pageNum = parseInt(wrapper.dataset.pageNum);
        const ratio = (containerCenter - top) / wrapper.offsetHeight;
        scrollRestoration = { pageNum, ratio };
        break;
      }
    }
  }

  // --- 2. SETUP DE DIMENSÕES BASE (PÁGINA 1) ---
  const page1 = await viewerState.pdfDoc.getPage(1);
  const viewport = page1.getViewport({ scale: viewerState.pdfScale });
  const dpr = window.devicePixelRatio || 1; // Considera DPR para CSS size

  // Dimensões CSS (visuais)
  const cssWidth = Math.floor(viewport.width); // O viewport do pdfjs já vem escalado pelo scale. Se quisermos CSS pixel accurate, ok.
  const cssHeight = Math.floor(viewport.height);

  // --- 3. ATUALIZAÇÃO / CRIAÇÃO DO DOM (DIFERENÇA: REUSO) ---

  // Garante que temos wrappers para todas as páginas
  // Se houver excesso (zoom out num doc que mudou? improvável mudar doc no zoom), removemos?
  // Assume-se que mudarZoom não muda o doc.

  // Se o número de páginas mudou (ex: novo doc), aí sim limpamos tudo
  const currentWrappers = container.querySelectorAll('.pdf-page');
  if (currentWrappers.length !== numPages) {
    // Reset total se mudou a estrutura do doc
    if (observer) observer.disconnect();

    // Remove APENAS wrappers antigos
    currentWrappers.forEach(p => p.remove());
    pagesRenderedState = {};

    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= numPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page';
      wrapper.id = `page-wrapper-${i}`;
      wrapper.dataset.pageNum = i;
      wrapper.style.width = cssWidth + 'px';
      wrapper.style.height = cssHeight + 'px';

      // Placeholder inicial
      const canvas = document.createElement('canvas');
      canvas.id = `page-canvas-${i}`;
      // Inicialmente vazio ou loading

      wrapper.appendChild(canvas);
      fragment.appendChild(wrapper);
    }

    const overlayEl = document.getElementById('selection-overlay');
    if (overlayEl) {
      container.insertBefore(fragment, overlayEl);
    } else {
      container.appendChild(fragment);
    }

    startIntersectionObserver();

  } else {
    // --- MODO UPDATE (ZOOM) ---
    // Apenas atualizamos as dimensões dos wrappers e canvas existentes
    // Isso estica a imagem atual (blur) até que o novo render substitua

    // Desconecta observer temporariamente pra não triggar renders loucos durante o loop
    if (observer) observer.disconnect();

    currentWrappers.forEach(wrapper => {
      wrapper.style.width = cssWidth + 'px';
      wrapper.style.height = cssHeight + 'px';

      const canvas = wrapper.querySelector('canvas');
      if (canvas) {
        // Truque: manter o canvas.width/height (físico) antigo, mas esticar via CSS
        // O novo render vai ajustar o físico depois.
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }

      // Invalida cache de render para forçar update visual na qualidade nova
      const pNum = wrapper.dataset.pageNum;
      pagesRenderedState[pNum] = false;
    });

    startIntersectionObserver();
  }

  // --- 4. RESTAURAÇÃO DO SCROLL ---
  if (scrollRestoration) {
    // Como não removemos os elementos, o offsetTop já deve refletir as novas alturas (pois alteramos styles acima)
    // O browser faz reflow síncrono ao pedir offsetTop
    const targetWrapper = document.getElementById(`page-wrapper-${scrollRestoration.pageNum}`);
    if (targetWrapper) {
      const newTop = targetWrapper.offsetTop;
      const newHeight = targetWrapper.offsetHeight; // deve ser cssHeight
      const scrollTarget = newTop + (newHeight * scrollRestoration.ratio) - (container.clientHeight / 2);
      container.scrollTo({ top: scrollTarget, behavior: 'auto' }); // auto/instant para não animar a correção de zoom
    }
  } else {
    // FIX: Assegura alinhamento exato ao topo da página atual (geralmente 1) no load inicial.
    // Isso evita que o "Smart Align" (na mudarPagina) detecte desalinhamento por poucos pixels (ex: margin) e consuma o primeiro clique.
    const targetWrapper = document.getElementById(`page-wrapper-${viewerState.pageNum}`);
    if (targetWrapper) {
      container.scrollTop = targetWrapper.offsetTop;
    } else {
      container.scrollTop = 0;
    }
  }

  // --- SYNC CRÍTICO: ATUALIZA OVERLAY AGORA ---
  // Precisamos garantir que o overlay (fundo escuro e box) acompanhe a mudança de layout IMEDIATAMENTE.
  refreshOverlayPosition();

  // --- 5. UI UPDATES ---
  const zoomLabel = document.getElementById('zoom_level');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(viewerState.pdfScale * 100)}%`;

  const zoomLabelMobile = document.getElementById('zoomLevelMobile');
  if (zoomLabelMobile) zoomLabelMobile.textContent = `${Math.round(viewerState.pdfScale * 100)}%`;

  // Renderiza visíveis
  // Prioridade de render
  const initialPage = scrollRestoration ? scrollRestoration.pageNum : viewerState.pageNum;
  await renderPage(initialPage);
  renderPage(initialPage + 1);
  if (initialPage > 1) renderPage(initialPage - 1);

  updateNavigationUI(initialPage);
}

/**
 * RENDERIZAÇÃO DE UMA ÚNICA PÁGINA COM DOUBLE BUFFERING
 * Evita tela branca ao redimensionar canvas
 */
export function renderPage(num) {
  // Se já estamos renderizando ou já foi, o cache decide.
  // Porém, no zoom, setamos pagesRenderedState[num] = false antes.
  if (pagesRenderedState[num] === true) return Promise.resolve();
  // Se estiver 'pending', devíamos esperar? Por simplificação, deixamos sobrescrever.

  pagesRenderedState[num] = 'pending';

  const wrapper = document.getElementById(`page-wrapper-${num}`);
  // Nota: Não buscamos canvas aqui porque ele pode nem existir ou vai ser substituído

  if (!wrapper || !viewerState.pdfDoc) {
    pagesRenderedState[num] = false;
    return Promise.resolve();
  }

  return viewerState.pdfDoc.getPage(num).then(page => {
    const dpr = window.devicePixelRatio || 1;
    const totalScale = viewerState.pdfScale * dpr;
    const viewport = page.getViewport({ scale: totalScale });

    // --- DOUBLE BUFFERING ---
    // Cria um canvas novo em memória, desenha nele, e só depois troca.
    const newCanvas = document.createElement('canvas');
    newCanvas.width = viewport.width;
    newCanvas.height = viewport.height;

    // Configura CSS do novo canvas para bater com o wrapper
    // wrapper já está com o tamanho certo (definido no zoom)
    newCanvas.style.width = '100%';
    newCanvas.style.height = '100%';
    newCanvas.id = `page-canvas-${num}`; // Mantém ID para referências futuras

    const ctx = newCanvas.getContext('2d');
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    return page.render(renderContext).promise.then(() => {
      // Swap!
      // Remove o canvas antigo existente no wrapper e insere o novo
      const oldCanvas = wrapper.querySelector('canvas');
      if (oldCanvas) {
        wrapper.replaceChild(newCanvas, oldCanvas);
      } else {
        wrapper.appendChild(newCanvas);
      }

      wrapper.setAttribute('data-loaded', 'true');
      pagesRenderedState[num] = true;

      // Se era a página atual, talvez precise retriggerar algo de UI?
    });

  }).catch(err => {
    console.error(`Erro render pag ${num}`, err);
    pagesRenderedState[num] = false;
  });
}

/**
 * FUNÇÕES PÚBLICAS DE CONTROLE
 */

/**
 * Carrega o documento PDF com suporte a Smart Recovery (proteção contra links quebrados)
 */
export async function carregarDocumentoPDF(url) {
  // Configuração do Worker (Fix)
  if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  try {
    console.log("PDF-Core: Loading:", url);
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    viewerState.pdfDoc = pdf;

    // Auto-Fit Zoom Implementation
    const page = await pdf.getPage(1);

    if (window.innerWidth <= 900) {
      const container = document.getElementById('canvasContainer');
      if (container) {
        const viewport = page.getViewport({ scale: 1.0 });
        const availableWidth = container.clientWidth - 24;
        const scale = availableWidth / viewport.width;
        viewerState.pdfScale = Math.max(0.5, Math.min(scale, 3.0));
      } else {
        viewerState.pdfScale = 1.0;
      }
    } else {
      viewerState.pdfScale = 1.0;
    }

    viewerState.pageNum = 1;
    await renderAllPages();
    return true;
  } catch (err) {
    console.error("PDF-Core: Load Error:", err);
    customAlert('Erro ao carregar PDF. O arquivo pode estar indisponível.', 3000);
    return false;
  }
}

export function mudarZoom(delta) {
  const newScale = viewerState.pdfScale + delta;
  if (newScale >= 0.1 && newScale <= 5.0) {
    viewerState.pdfScale = newScale;
    renderAllPages();
  }
}

export function mudarPagina(dir) {
  if (!viewerState.pdfDoc) return;
  const container = document.getElementById('canvasContainer');
  if (!container) return;

  // SMART ALIGN LOGIC:
  // Se o usuário está "perto" de uma página mas não alinhado ao topo, o primeiro clique apenas alinha.
  // Se já está alinhado, troca de página.

  const currentPageWrapper = document.getElementById(`page-wrapper-${viewerState.pageNum}`);

  if (currentPageWrapper) {
    const scrollTop = container.scrollTop;
    const pageTop = currentPageWrapper.offsetTop;
    const diff = Math.abs(scrollTop - pageTop); // diferença em pixels

    // Margem de tolerância: 10px. Se a diferença for maior que isso, consideramos "desalinhado".
    // Só aplicamos isso se o usuário estiver tentando sair da página (dir != 0)

    const isAligned = diff < 10;

    // Se não está alinhado E a direção é coerente (ex: next page mas estou no meio da atual)
    // Se estou no meio da p1 e clico next, tecnicamente quero ir pra p2.
    // Mas o usuário pediu: "não troca no primeiro clique, faz que nem fosse trocar pra mesma página"

    // UX Decision: 
    // Se clico NEXT e estou no meio da P1 -> Alinha P1 Top? Não faz sentido ir pra trás.
    // Se clico NEXT e estou no meio da P1 -> Vai pro topo da P2? Isso é comportamento padrão.
    // O usuário disse: "no primeiro clique faz que nem fosse trocar mas pra mesma página atual... detecta se o topo da janela está literalmente no lugar... se fica troca, se não tá não troca"

    // Interpretação: Ele quer snap to top da PÁGINA ATUAL antes de mudar.

    if (!isAligned) {
      // Scroll para o topo da página ATUAL
      container.scrollTo({ top: pageTop, behavior: 'smooth' });
      // Não muda pageNum ainda.
      // Mas precisamos atualizar a UI pra garantir q ele saiba q está na P1?
      return;
    }
  }

  const targetPage = viewerState.pageNum + dir;

  if (targetPage >= 1 && targetPage <= viewerState.pdfDoc.numPages) {
    // Atualiza estado IMEDIATAMENTE antes de scrollar
    viewerState.pageNum = targetPage;
    updateNavigationUI(targetPage);

    // LOCK: Impede que o scroll dispare eventos errados do observer enquanto anima
    isProgrammaticScroll = true;
    if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout);

    // Libera o lock após o tempo estimado da animação (500ms é seguro para 'smooth')
    programmaticScrollTimeout = setTimeout(() => {
      isProgrammaticScroll = false;
      // Garante renderização final se precisou
      renderPage(targetPage);
    }, 600);

    const wrapper = document.getElementById(`page-wrapper-${targetPage}`);
    if (wrapper) {
      const topPos = wrapper.offsetTop; // Removido o padding negativo para snap perfeito
      container.scrollTo({
        top: topPos,
        behavior: 'smooth'
      });
      // Pré-carrega a página alvo já
      renderPage(targetPage);
    }
  }
}

// Compatibilidade
export async function trocarModo(novoModo) {
  const permitido = await verificarBloqueiosTroca(novoModo);
  if (!permitido) return false;

  window.__modo = novoModo;
  window.modo = novoModo;
  window.__recortesAcumulados = [];
  atualizarUIViewerModo();

  let url = window.__pdfUrls.prova;
  if (novoModo === 'gabarito') {
    url = window.__pdfUrls.gabarito || window.__pdfUrls.prova;
  }

  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    viewerState.pdfDoc = pdf;
    viewerState.pageNum = 1;
    await renderAllPages();
    return true;
  } catch (err) {
    console.error('Erro ao trocar modo', err);
    customAlert('Erro ao carregar PDF.', 2000);
    return false;
  }
}

// --- Funções Auxiliares de Validação (Mantidas) ---
export function ensurePdfUrls() {
  if (!window.__pdfUrls) window.__pdfUrls = { prova: null, gabarito: null };
  const args = window.__viewerArgs;
  const fileProva = args?.fileProva;
  const fileGabarito = args?.fileGabarito;

  if (!window.__pdfUrls.prova && fileProva) window.__pdfUrls.prova = URL.createObjectURL(fileProva);
  if (!window.__pdfUrls.gabarito && fileGabarito) window.__pdfUrls.gabarito = URL.createObjectURL(fileGabarito);

  return !!window.__pdfUrls.prova;
}

export async function verificarBloqueiosTroca(novoModo) {
  if (!ensurePdfUrls()) return false;
  if (!document.getElementById('pdfViewerContainer')) return false;

  if (window.__modo === 'prova' && novoModo === 'gabarito') {
    const podeIr = await validarProgressoImagens();
    if (!podeIr) return false;
  }

  if (novoModo === 'gabarito') {
    if (window.__isProcessing) {
      customAlert('⏳ Aguarde...', 3000);
      return false;
    }
    if (!window.__ultimaQuestaoExtraida) {
      customAlert('⚠️ Capture a Questão primeiro!', 3000);
      return false;
    }
    if (window.questaoAtual && window.questaoAtual.isRecitation) {
      if (!window.confirm("Questão manual/recitation incompleta. Continuar?")) return false;
    }
  }
  return true;
}

// Mantido para compatibilidade com Cropper
export async function renderPageHighRes(num) {
  if (!viewerState.pdfDoc) return null;
  try {
    const page = await viewerState.pdfDoc.getPage(num);
    const dpi = 300;
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale: scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error("Erro HR", e);
    return null;
  }
}