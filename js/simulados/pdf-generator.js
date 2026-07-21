/**
 * Módulo de Geração de PDFs de Simulados (Maia.edu)
 * Cria leiautes de vestibular para provas Objetivas (ENEM/FUVEST) e Dissertativas
 */

import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { getProxyPdfUrl } from "../api/worker.js";

// Helper para converter PDF crop para Data URL (Base64)
// Helper para converter PDF crop para Data URL (Base64) com suporte a cache, crops específicos e fundo branco
export async function renderPdfCropToDataUrl(block, pdfCache = null) {
  try {
    const _fileUrl = block.pdf_url || null;
    const _pageNum = parseInt(block.pdf_page || 1, 10);
    const _cropDetails = block.cropDetails || {};
    const _cX = block.pdfjs_x ?? _cropDetails.pdfjs_x ?? 0;
    const _cY = block.pdfjs_y ?? _cropDetails.pdfjs_y ?? 0;
    const _cW = block.pdfjs_crop_w ?? _cropDetails.pdfjs_crop_w ?? 600;
    const _cH = block.pdfjs_crop_h ?? _cropDetails.pdfjs_crop_h ?? 400;
    const _globalPdfUrl = typeof window !== 'undefined' ? (window.__pdfOriginalUrl || window.__pdfDownloadUrl) : null;
    const _baseUrl = (_fileUrl && typeof _fileUrl === 'string' && _fileUrl.startsWith('blob:') && _globalPdfUrl) ? _globalPdfUrl : _fileUrl;
    const _embedCacheKey = `${_baseUrl}_${_pageNum}_${_cX}_${_cY}_${_cW}_${_cH}`;
    
    if (window.__pdfEmbedImagesCache && window.__pdfEmbedImagesCache.has(_embedCacheKey)) {
      console.log("[PDFGenerator] Usando imagem pré-carregada do cache:", _embedCacheKey);
      return window.__pdfEmbedImagesCache.get(_embedCacheKey);
    }

    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF.js não encontrado");

    // Configura worker do PDFjs se não configurado
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    let pdfDoc;
    let isCurrentLocal = false;
    if (window.__pdfLocalFile) {
      const isBlobOrEmpty = !block.pdf_url || block.pdf_url.startsWith("blob:");
      if (isBlobOrEmpty) {
        isCurrentLocal = true;
      } else {
        const localName = window.__pdfLocalFile.name.toLowerCase();
        const blockUrlDecoded = decodeURIComponent(block.pdf_url).toLowerCase();
        
        // Sanitiza os nomes de arquivos para comparação robusta
        const localNameSanitized = localName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/g, "");
        const blockUrlSanitized = blockUrlDecoded.replace(/\.[^/.]+$/, "").split("/").pop().replace(/[^a-z0-9]/g, "");
        
        if (blockUrlSanitized.includes(localNameSanitized) || localNameSanitized.includes(blockUrlSanitized)) {
          isCurrentLocal = true;
        } else if (window.__pdfOriginalUrl && block.pdf_url === window.__pdfOriginalUrl) {
          isCurrentLocal = true;
        } else if (window.__pdfDownloadUrl && block.pdf_url === window.__pdfDownloadUrl) {
          isCurrentLocal = true;
        }
      }
    }

    const cacheKey = isCurrentLocal ? "local-file" : (block.pdf_url || null);

    if (pdfCache && cacheKey && pdfCache.has(cacheKey)) {
      pdfDoc = pdfCache.get(cacheKey);
    } else {
      if (isCurrentLocal) {
        const arrayBuffer = await window.__pdfLocalFile.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
      } else if (block.pdf_url) {
        let url = block.pdf_url;
        try {
          // Garante Puter carregado para bypass CORS
          if (typeof window.puter === "undefined" && !window.__loadingPuter) {
            window.__loadingPuter = new Promise((resolve) => {
              const script = document.createElement("script");
              script.src = "https://js.puter.com/v2/";
              script.onload = () => resolve(window.puter);
              script.onerror = () => resolve(null);
              document.head.appendChild(script);
            });
          }
          if (window.__loadingPuter) {
            await window.__loadingPuter;
          }

          let arrayBuffer;
          // 1. Primary: Fetch via Worker Proxy
          try {
            const fetchUrl = getProxyPdfUrl(url);
            console.log("[PDFGenerator] Carregando PDF via fetch/proxy:", fetchUrl);
            const response = await fetch(fetchUrl);
            if (response.ok) {
              arrayBuffer = await response.arrayBuffer();
            } else {
              throw new Error(`Fetch HTTP ${response.status}`);
            }
          } catch (proxyErr) {
            console.warn("[PDFGenerator] Falha no Worker Proxy, tentando Puter fallback...", proxyErr);
            // 2. Fallback: Puter fetch
            if (typeof window.puter !== "undefined" && window.puter.auth && typeof window.puter.auth.isSignedIn === "function" && window.puter.auth.isSignedIn() && window.puter.net && window.puter.net.fetch) {
              console.log("[PDFGenerator] Carregando PDF via Puter.net.fetch:", url);
              const response = await window.puter.net.fetch(url);
              if (!response.ok) throw new Error(`Puter HTTP ${response.status}`);
              const blob = await response.blob();
              arrayBuffer = await blob.arrayBuffer();
            } else {
              throw proxyErr;
            }
          }

          const typedArray = new Uint8Array(arrayBuffer);
          pdfDoc = await pdfjsLib.getDocument({
            data: typedArray,
            disableRange: true,
            disableAutoFetch: true
          }).promise;
        } catch (err) {
          console.warn(`Erro ao carregar PDF de ${url}, tentando fallback com arquivo local:`, err);
          if (window.__pdfLocalFile) {
            const arrayBuffer = await window.__pdfLocalFile.arrayBuffer();
            const typedArray = new Uint8Array(arrayBuffer);
            pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
          } else {
            throw err;
          }
        }
      } else {
        return null;
      }

      if (pdfCache && cacheKey && pdfDoc) {
        pdfCache.set(cacheKey, pdfDoc);
      }
    }

    const pageNum = parseInt(block.pdf_page || 1, 10);
    const page = await pdfDoc.getPage(pageNum);

    const hasSpecificCrop = (
      block.pdfjs_x !== undefined ||
      block.pdfjs_y !== undefined ||
      block.pdfjs_crop_w !== undefined ||
      block.pdfjs_crop_h !== undefined ||
      (block.cropDetails && block.cropDetails.pdfjs_x !== undefined)
    );

    const cropDetails = block.cropDetails || {};
    const pdfjsSourceW = block.pdfjs_source_w ?? cropDetails.pdfjs_source_w ?? 2480;

    let finalWidth, finalHeight, offsetX, offsetY, scale;
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    if (hasSpecificCrop) {
      const pdfjsCropW = block.pdfjs_crop_w ?? cropDetails.pdfjs_crop_w ?? 600;
      const pdfjsCropH = block.pdfjs_crop_h ?? cropDetails.pdfjs_crop_h ?? 400;
      const pdfjsX = block.pdfjs_x ?? cropDetails.pdfjs_x ?? 0;
      const pdfjsY = block.pdfjs_y ?? cropDetails.pdfjs_y ?? 0;

      scale = pdfjsSourceW / unscaledViewport.width;
      finalWidth = pdfjsCropW;
      finalHeight = pdfjsCropH;
      offsetX = pdfjsX;
      offsetY = pdfjsY;
    } else {
      const targetWidth = 800;
      scale = targetWidth / unscaledViewport.width;
      const tempViewport = page.getViewport({ scale });
      finalWidth = tempViewport.width;
      finalHeight = tempViewport.height;
      offsetX = 0;
      offsetY = 0;
    }

    const canvas = document.createElement("canvas");
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    const context = canvas.getContext("2d");

    // Preencher fundo branco (para PDFs transparentes)
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, finalWidth, finalHeight);

    context.save();

    if (hasSpecificCrop) {
      context.translate(-offsetX, -offsetY);
    }

    const viewport = page.getViewport({ scale });

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    context.restore();

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("Erro ao converter recorte PDF para imagem:", e);
    return null;
  }
}

// Função para pré-carregar imagens de PDF em background
export async function preCarregarImagensEmBackground(questoes) {
  // 1. Extrair crops pendentes
  const pendingCrops = [];
  const cacheMap = window.__pdfEmbedImagesCache || (window.__pdfEmbedImagesCache = new Map());
  
  const checkBlock = (bloco) => {
    if (bloco.tipo === "imagem") {
      const isPdfCrop = bloco.pdf_page || bloco.pdfjs_x !== undefined || bloco.pdf_left !== undefined;
      if (isPdfCrop) {
        const fileUrl = bloco.pdf_url || null;
        const pageNum = parseInt(bloco.pdf_page || 1, 10);
        const cropDetails = bloco.cropDetails || {};
        const c = {
          X: bloco.pdfjs_x ?? cropDetails.pdfjs_x ?? 0,
          Y: bloco.pdfjs_y ?? cropDetails.pdfjs_y ?? 0,
          cW: bloco.pdfjs_crop_w ?? cropDetails.pdfjs_crop_w ?? 600,
          cH: bloco.pdfjs_crop_h ?? cropDetails.pdfjs_crop_h ?? 400
        };
        const globalPdfUrl = window.__pdfOriginalUrl || window.__pdfDownloadUrl || null;
        const baseUrl = (fileUrl && typeof fileUrl === 'string' && fileUrl.startsWith('blob:') && globalPdfUrl) ? globalPdfUrl : fileUrl;
        const effectiveUrl = baseUrl;
        const cacheKey = `${effectiveUrl}_${pageNum}_${c.X}_${c.Y}_${c.cW}_${c.cH}`;
        
        if (!cacheMap.has(cacheKey)) {
          pendingCrops.push({ bloco, cacheKey });
        }
      }
    }
  };

  questoes.forEach((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    const g = qObj.fullData?.dados_gabarito || {};
    
    if (q.estrutura && Array.isArray(q.estrutura)) {
      q.estrutura.forEach(checkBlock);
    }
    if (q.alternativas && Array.isArray(q.alternativas)) {
      q.alternativas.forEach((alt) => {
        if (alt.estrutura && Array.isArray(alt.estrutura)) {
          alt.estrutura.forEach(checkBlock);
        }
      });
    }
    if (g.explicacao && Array.isArray(g.explicacao)) {
      g.explicacao.forEach((step) => {
        if (step.estrutura && Array.isArray(step.estrutura)) {
          step.estrutura.forEach(checkBlock);
        }
      });
    }
  });

  if (pendingCrops.length === 0) {
    console.log("[PDFGenerator] Todas as imagens de PDF já estão em cache.");
    return;
  }

  console.log(`[PDFGenerator] Pré-carregando ${pendingCrops.length} crops em background...`);

  // Importar React/ReactDOM e PdfEmbedRenderer dinamicamente
  const [React, ReactDOMClient, { PdfEmbedRenderer }] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("../ui/PdfEmbedRenderer.tsx")
  ]);

  // Criar sandbox invisível no DOM
  const sandbox = document.createElement("div");
  sandbox.id = "pdf-generation-pre-render-sandbox";
  sandbox.style.position = "absolute";
  sandbox.style.left = "-9999px";
  sandbox.style.top = "-9999px";
  sandbox.style.width = "800px";
  sandbox.style.height = "600px";
  sandbox.style.overflow = "hidden";
  sandbox.style.opacity = "0";
  sandbox.style.pointerEvents = "none";
  document.body.appendChild(sandbox);

  const root = ReactDOMClient.createRoot(sandbox);

  return new Promise((resolve) => {
    const pendingKeys = new Set(pendingCrops.map(item => item.cacheKey));
    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('pdf-embed-crop-ready', handleCropReady);
      setTimeout(() => {
        try {
          root.unmount();
          sandbox.remove();
        } catch (e) {
          console.warn("[PDFGenerator] Erro ao desmontar sandbox:", e);
        }
      }, 500);
    };

    const handleCropReady = (e) => {
      const detail = e.detail;
      const key = `${detail.url}_${detail.page}_${detail.x}_${detail.y}_${detail.w}_${detail.h}`;
      if (pendingKeys.has(key)) {
        pendingKeys.delete(key);
        console.log(`[PDFGenerator] Crop carregado via background render: ${key}. Restam: ${pendingKeys.size}`);
        if (pendingKeys.size === 0) {
          cleanup();
          resolve();
        }
      }
    };

    window.addEventListener('pdf-embed-crop-ready', handleCropReady);

    // Timeout de segurança de 15 segundos
    timeoutId = setTimeout(() => {
      console.warn(`[PDFGenerator] Timeout no pré-carregamento. Pendentes:`, Array.from(pendingKeys));
      cleanup();
      resolve();
    }, 15000);

    // Renderizar componentes
    const PreRenderWrapper = () => {
      return React.createElement(
        "div",
        null,
        pendingCrops.map((item, index) => {
          const b = item.bloco;
          return React.createElement(PdfEmbedRenderer, {
            key: index,
            pdfUrl: b.pdf_url,
            pdf_page: b.pdf_page,
            pdf_zoom: b.pdf_zoom,
            pdf_left: b.pdf_left,
            pdf_top: b.pdf_top,
            pdf_width: b.pdf_width,
            pdf_height: b.pdf_height,
            pdfjs_source_w: b.pdfjs_source_w,
            pdfjs_source_h: b.pdfjs_source_h,
            pdfjs_x: b.pdfjs_x,
            pdfjs_y: b.pdfjs_y,
            pdfjs_crop_w: b.pdfjs_crop_w,
            pdfjs_crop_h: b.pdfjs_crop_h,
            scaleToFit: true,
            readOnly: true,
            forceRenderMode: 'puter'
          });
        })
      );
    };

    root.render(React.createElement(PreRenderWrapper));
  });
}

// Mostra modal simples de loading
function showPrintLoading() {
  const oldModal = document.getElementById("printLoadingModal");
  if (oldModal) oldModal.remove();

  const modalHtml = `
    <div id="printLoadingModal" style="
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: sans-serif;
    ">
      <div style="
        border: 4px solid rgba(255,255,255,0.1);
        border-top: 4px solid var(--color-primary, #21808d);
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      "></div>
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">Processando Simulado...</div>
      <div style="font-size: 13px; color: #aaa; text-align: center; max-width: 300px; line-height: 1.5;">
        Renderizando fórmulas matemáticas e recortes de PDF em alta resolução. Aguarde...
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function hidePrintLoading() {
  document.getElementById("printLoadingModal")?.remove();
}

// Escapa conteúdo para data-raw
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Helper para converter blocos de estrutura em tags HTML
function renderBlockToHtmlString(bloco) {
  const tipo = (bloco.tipo || "texto").toLowerCase();
  const conteudo = bloco.conteudo ? String(bloco.conteudo) : "";
  const escaped = escapeHtml(conteudo);

  switch (tipo) {
    case "texto":
      return `<div class="markdown-content print-block-text" data-raw="${escaped}"></div>`;
    case "citacao":
      return `<blockquote class="markdown-content print-block-citacao" data-raw="${escaped}"></blockquote>`;
    case "destaque":
      return `<div class="markdown-content print-block-destaque" data-raw="${escaped}"></div>`;
    case "titulo":
      return `<h3 class="markdown-content print-block-titulo" data-raw="${escaped}"></h3>`;
    case "subtitulo":
      return `<h4 class="markdown-content print-block-subtitulo" data-raw="${escaped}"></h4>`;
    case "fonte":
      return `<div class="markdown-content print-block-fonte" data-raw="${escaped}"></div>`;
    case "separador":
      return `<hr class="print-block-separador" />`;
    case "equacao":
      return `<div class="math-block">\\[${conteudo}\\]</div>`;
    case "tabela":
      return `<div class="markdown-content print-block-tabela" data-raw="${escaped}"></div>`;
    case "lista":
      return `<div class="markdown-content print-block-lista" data-raw="${escaped}"></div>`;
    case "codigo":
      return `<pre class="print-block-codigo"><code>${escaped}</code></pre>`;
    case "imagem":
      const src = bloco._printSrc || bloco.url || "";
      let imgHtml = "";
      if (src) {
        imgHtml = `<img src="${src}" style="max-width: 100%; max-height: 500px; display: block; margin: 12px auto; object-fit: contain;" />`;
      }
      const captionHtml = conteudo
        ? `<div class="markdown-content print-image-caption" data-raw="${escaped}" style="font-size: 8.5pt; text-align: center; font-style: italic; color: #555; margin-top: 4px;"></div>`
        : "";
      let creditHtml = "";
      const isPdfCrop = bloco.pdf_page || bloco.pdfjs_x !== undefined || bloco.pdf_left !== undefined;
      if (isPdfCrop) {
        const materialName = bloco._materialOrigem || "Prova Original";
        const pageNum = bloco.pdf_page || 1;
        creditHtml = `<div class="print-image-credit">Fonte: ${escapeHtml(materialName)} (p. ${pageNum})</div>`;
      }
      return `<div class="print-block-image-wrapper">${imgHtml}${captionHtml}${creditHtml}</div>`;
    default:
      return "";
  }
}

// Orquestrador de geração de PDF
export async function gerarPDFSimulado(simulado, modoGabarito = false) {
  showPrintLoading();

  try {
    const rawQuestoes = simulado.questoes || [];

    const objectiveQuestions = rawQuestoes.filter((qObj) => {
      const q = qObj.fullData?.dados_questao || {};
      return !(q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0);
    });
    const writtenQuestions = rawQuestoes.filter((qObj) => {
      const q = qObj.fullData?.dados_questao || {};
      return q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;
    });

    const hasObjective = objectiveQuestions.length > 0;
    const hasWritten = writtenQuestions.length > 0;
    const isMixed = hasObjective && hasWritten;

    // Se for misto, agrupa as objetivas no início e as dissertativas no final para numeração sequencial
    const questoes = isMixed ? [...objectiveQuestions, ...writtenQuestions] : rawQuestoes;

    function calcularDuracaoProva(questoesList) {
      let minObjective = 3; // minutos por questão objetiva
      let minWritten = 10;  // minutos por questão dissertativa
      let totalMinutes = 0;
      questoesList.forEach(qObj => {
        const q = qObj.fullData?.dados_questao || {};
        const isQDissert = q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;
        if (isQDissert) {
          totalMinutes += minWritten;
        } else {
          totalMinutes += minObjective;
        }
      });

      totalMinutes = Math.max(30, totalMinutes);
      // Arredonda para o múltiplo de 15 minutos mais próximo
      totalMinutes = Math.ceil(totalMinutes / 15) * 15;

      if (totalMinutes >= 300) {
        return "5 horas";
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours === 0) {
        return `${minutes} minutos`;
      } else if (minutes === 0) {
        return `${hours} ${hours === 1 ? "hora" : "horas"}`;
      } else {
        return `${hours} ${hours === 1 ? "hora" : "horas"} e ${minutes} minutos`;
      }
    }

    const duracaoCalculada = calcularDuracaoProva(questoes);

    // Pré-carregar todas as imagens de crop de PDF em background usando Puter/iframe render
    try {
      await preCarregarImagensEmBackground(questoes);
    } catch (preloadErr) {
      console.error("[PDFGenerator] Erro ao pré-carregar imagens em background:", preloadErr);
    }

    // 1. Processar todas as imagens do PDF em paralelo com cache
    const cropPromises = [];
    const pdfCache = new Map();

    questoes.forEach((qObj) => {
      const q = qObj.fullData?.dados_questao || {};
      const meta = qObj.fullData?.meta || {};
      const materialOrigem = meta.material_origem || qObj.prova?.replace(/_/g, " ") || "Prova Original";
      
      // Processa estrutura da questão
      if (q.estrutura && Array.isArray(q.estrutura)) {
        q.estrutura.forEach((bloco) => {
          if (bloco.tipo === "imagem") {
            const isPdfCrop = bloco.pdf_page || bloco.pdfjs_x !== undefined || bloco.pdf_left !== undefined;
            if (isPdfCrop) {
              bloco._materialOrigem = materialOrigem;
            }
            const promise = renderPdfCropToDataUrl(bloco, pdfCache).then((dataUrl) => {
              if (dataUrl) bloco._printSrc = dataUrl;
            });
            cropPromises.push(promise);
          }
        });
      }

      // Processa estrutura das alternativas
      if (q.alternativas && Array.isArray(q.alternativas)) {
        q.alternativas.forEach((alt) => {
          if (alt.estrutura && Array.isArray(alt.estrutura)) {
            alt.estrutura.forEach((bloco) => {
              if (bloco.tipo === "imagem") {
                const isPdfCrop = bloco.pdf_page || bloco.pdfjs_x !== undefined || bloco.pdf_left !== undefined;
                if (isPdfCrop) {
                  bloco._materialOrigem = materialOrigem;
                }
                const promise = renderPdfCropToDataUrl(bloco, pdfCache).then((dataUrl) => {
                  if (dataUrl) bloco._printSrc = dataUrl;
                });
                cropPromises.push(promise);
              }
            });
          }
        });
      }

      // Processa estrutura do gabarito
      const g = qObj.fullData?.dados_gabarito || {};
      if (g.explicacao && Array.isArray(g.explicacao)) {
        g.explicacao.forEach((step) => {
          if (step.estrutura && Array.isArray(step.estrutura)) {
            step.estrutura.forEach((bloco) => {
              if (bloco.tipo === "imagem") {
                const isPdfCrop = bloco.pdf_page || bloco.pdfjs_x !== undefined || bloco.pdf_left !== undefined;
                if (isPdfCrop) {
                  bloco._materialOrigem = materialOrigem;
                }
                const promise = renderPdfCropToDataUrl(bloco, pdfCache).then((dataUrl) => {
                  if (dataUrl) bloco._printSrc = dataUrl;
                });
                cropPromises.push(promise);
              }
            });
          }
        });
      }
    });

    // Aguarda todas as renderizações de imagens
    await Promise.all(cropPromises);

    // 2. Montar o documento de impressão
    const isTeste = simulado.tipo === "teste";
    const examTitle = (simulado.titulo || "Simulado Maia").toUpperCase();
    const subTitle = (isMixed
      ? "Prova de Conhecimentos Gerais e Específicos (Mista)"
      : hasObjective
        ? "Prova de Conhecimentos Gerais (Objetiva)"
        : "Prova de Conhecimentos Específicos (Dissertativa)").toUpperCase();

    let layoutHtml = "";
    let coverPageHtml = "";
    let answerSheetHtmlTemplate = "";

    if (modoGabarito) {
      // LEIAUTE DE RESOLUÇÕES / GABARITO (PAGINADO)
      const resolutionsPerPage = 3;
      const gabaritoPages = [];
      for (let i = 0; i < questoes.length; i += resolutionsPerPage) {
        gabaritoPages.push(questoes.slice(i, i + resolutionsPerPage));
      }

      layoutHtml = gabaritoPages
        .map((pageQuestoes, pageIdx) => {
          return `
            <div class="print-page gabarito-page">
              <div class="questions-header-line">
                <span>CONCURSO VESTIBULAR MAIA.EDU</span>
                <span>GABARITO OFICIAL &mdash; ${examTitle}</span>
              </div>
              <div class="print-gabarito-title" style="margin-bottom: 20px;">
                RESOLUÇÕES E GABARITO OFICIAL (PÁGINA ${pageIdx + 1} DE ${gabaritoPages.length})
              </div>
              <div style="display:flex; flex-direction:column; gap:20px;">
                ${pageQuestoes
                  .map((qObj, index) => {
                    const absoluteIndex = pageIdx * resolutionsPerPage + index;
                    const q = qObj.fullData?.dados_questao || {};
                    const g = qObj.fullData?.dados_gabarito || {};
                    const isQDissert =
                      q.tipo_resposta === "dissertativa" ||
                      !q.alternativas ||
                      q.alternativas.length === 0;

                    // Resolução passos
                    let passosHtml = "";
                    if (g.explicacao && Array.isArray(g.explicacao) && g.explicacao.length > 0) {
                      passosHtml = `
                      <div class="print-gabarito-steps">
                        <strong>Etapas de Resolução:</strong>
                        <ol style="margin: 5px 0 0 0; padding-left: 20px;">
                          ${g.explicacao
                            .map((p, i) => {
                              const est = Array.isArray(p.estrutura)
                                ? p.estrutura
                                : [{ tipo: "texto", conteudo: p.passo || "" }];
                              
                              const stepContentHtml = est
                                .map((bl) => renderBlockToHtmlString(bl))
                                .join("");
                              
                              return `<li class="print-gabarito-step">${stepContentHtml}</li>`;
                            })
                            .join("")}
                        </ol>
                      </div>`;
                    }

                    // Resposta modelo
                    const respModelo = g.resposta_modelo || g.respostaModelo || "";
                    const respModeloEscaped = escapeHtml(respModelo);
                    const respModeloHtml = respModelo
                      ? `<div style="margin-top: 8px;"><strong>Resposta Modelo Esperada:</strong> <div class="markdown-content print-gabarito-answer" data-raw="${respModeloEscaped}"></div></div>`
                      : "";

                    // Fontes externas
                    let fontesHtml = "";
                    if (g.fontes_externas && Array.isArray(g.fontes_externas) && g.fontes_externas.length > 0) {
                      fontesHtml = `
                      <div style="margin-top: 8px;">
                        <strong>Fontes Externas:</strong>
                        <ul style="list-style:none; padding:0; margin:5px 0 0 0; display:flex; flex-direction:column; gap:4px;">
                          ${g.fontes_externas
                            .map((f) => `
                              <li>
                                <a href="${f.uri}" target="_blank" rel="noopener noreferrer" style="color:#0284c7; text-decoration:none; font-size:0.85rem;">
                                  ${f.title || f.uri} ↗
                                </a>
                              </li>
                            `)
                            .join("")}
                        </ul>
                      </div>`;
                    }

                    return `
                    <div class="print-gabarito-item">
                      <strong>Questão ${String(absoluteIndex + 1).padStart(2, "0")}</strong>
                      <div style="margin-top: 4px;">
                        <strong>Gabarito Oficial:</strong> ${
                          isQDissert
                            ? "Dissertativa"
                            : `<span style="font-weight:bold; color:#10b981;">Alternativa ${
                                g.alternativa_correta || "—"
                              }</span>`
                        }
                      </div>
                      ${respModeloHtml}
                      <div style="margin-top: 8px;">
                        <strong>Justificativa:</strong> 
                        <span class="markdown-content" data-raw="${escapeHtml(
                          g.justificativa_curta || "Sem justificativa."
                        )}"></span>
                      </div>
                      ${passosHtml}
                      ${fontesHtml}
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      // LEIAUTE DE PROVA (ESTUDANTE)
      // Capa de Vestibular Estilizada Maia.edu (Autoral)
      coverPageHtml = `
        <div class="print-page cover-page">
          <div class="cover-header" style="position: relative; width: 100%; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', sans-serif; height: 65px;">
            <div style="font-size: 16pt; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">
              Maia<span style="font-weight: 300; color: #21808d;">.edu</span>
            </div>
            <div style="position: absolute; left: 50%; transform: translateX(-50%); display: flex; justify-content: center; align-items: center;">
              <img src="${window.location.origin}/monocromatic_logo.png" style="max-height: 60px; max-width: 150px; object-fit: contain; filter: brightness(0);" alt="Maia Logo" />
            </div>
            <div class="cover-version-box">V1</div>
          </div>
          
          <div class="cover-title-box">
            <div class="cover-title-main">Simulado Maia.edu</div>
            <div class="cover-title-sub">${examTitle} &mdash; ${subTitle}</div>
          </div>
          
          <div class="cover-instructions">
            <div class="cover-instructions-title">Instruções</div>
            <ol class="cover-instructions-list">
              <li>Só abra este caderno de questões quando o fiscal autorizar.</li>
              <li>Verifique se o seu nome está correto na folha de respostas e neste caderno de prova.</li>
              <li>Durante a prova, são vedadas a comunicação entre candidatos e a utilização de qualquer material de consulta, aparelhos eletrônicos ou telefones celulares.</li>
              <li>Duração da prova: até ${duracaoCalculada}. Cabe ao candidato controlar o tempo com base nas informações do fiscal.</li>
              <li>Para provas objetivas (teste), preencha o cartão de respostas no local indicado.</li>
              <li>Para provas dissertativas, responda estritamente dentro dos limites da caixa pautada sob cada questão.</li>
              <li>Preencha a folha de respostas com cuidado, utilizando caneta esferográfica de tinta azul ou preta.</li>
              <li>Ao final da prova, entregue a folha de respostas ao fiscal de sala.</li>
            </ol>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-top: 35px; margin-bottom: 25px; font-family: Arial, sans-serif;">
            <div class="vestibular-field"><span class="vestibular-field-label">NOME DO CANDIDATO:</span></div>
            <div class="vestibular-field"><span class="vestibular-field-label">TURMA:</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; margin-bottom: 35px; font-family: Arial, sans-serif;">
            <div class="vestibular-field"><span class="vestibular-field-label">IDENTIFICAÇÃO DO ESTUDANTE:</span></div>
            <div class="vestibular-field"><span class="vestibular-field-label">DATA DE REALIZAÇÃO:</span></div>
          </div>
          
          <div class="cover-declaration-box">
            <div class="cover-declaration-title">Declaração</div>
            <p class="cover-declaration-text">
              Declaro que li e estou ciente das instruções que constam na capa desta prova, na folha de respostas, bem como dos avisos que foram transmitidos pelo fiscal de sala.
            </p>
            <div class="cover-signature-line"></div>
            <div class="cover-signature-label">Assinatura do Candidato</div>
            <div class="cover-signature-warning">O candidato que não assinar a capa da prova poderá ter sua correção prejudicada.</div>
          </div>
        </div>
      `;

      // Constrói o HTML base da folha de respostas para a prova se aplicável
      answerSheetHtmlTemplate = "";
      if (hasObjective && !modoGabarito) {
        const totalQ = objectiveQuestions.length;
        let sheetRows = "";
        for (let i = 0; i < totalQ; i++) {
          sheetRows += `
            <div class="print-answer-sheet-row">
              <span class="print-answer-sheet-q">${String(i + 1).padStart(
                2,
                "0"
              )}</span>
              <div class="print-answer-sheet-bubbles">
                <span class="print-bubble">A</span>
                <span class="print-bubble">B</span>
                <span class="print-bubble">C</span>
                <span class="print-bubble">D</span>
                <span class="print-bubble">E</span>
              </div>
            </div>`;
        }
        answerSheetHtmlTemplate = `
          <div class="print-page answer-sheet-page">
            <div class="questions-header-line">
              <span>CONCURSO VESTIBULAR MAIA.EDU</span>
              <span>FOLHA DE RESPOSTAS - CARTÃO ÓPTICO</span>
            </div>
            <div class="print-answer-sheet-container">
              <h2 class="print-answer-sheet-title">FOLHA DE RESPOSTAS</h2>
              <p style="font-size: 9pt; text-align: center; color: #555; margin-bottom: 20px; font-family: Arial, sans-serif;">
                Preencha inteiramente os círculos correspondentes às suas respostas com caneta esferográfica azul ou preta.
              </p>
              <div class="print-answer-sheet-grid">
                ${sheetRows}
              </div>
            </div>
          </div>`;
      }
    } // Fim do bloco else (leiaute de estudante)

    const serializedQuestoes = JSON.stringify(questoes).replace(/</g, '\\u003c');

    // 3. Criar modal de visualização (popup) na página pai
    document.getElementById("pdf-preview-modal-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "pdf-preview-modal-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
      background-color: var(--color-background);
      width: 95vw;
      height: 90vh;
      max-width: 1200px;
      border-radius: 12px;
      border: 1px solid var(--color-border);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.95);
      transition: transform 0.3s ease;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      padding: 16px 24px;
      background-color: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--color-text);
      font-family: 'Inter', sans-serif;
    `;

    const titleSpan = document.createElement("span");
    titleSpan.style.cssText = `
      font-weight: 700;
      font-size: 1.1rem;
      letter-spacing: 0.5px;
      color: var(--color-text);
    `;
    titleSpan.textContent = modoGabarito ? `${examTitle} - Gabarito e Resoluções` : `${examTitle} - Caderno de Questões`;

    const btnGroup = document.createElement("div");
    btnGroup.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    const printBtn = document.createElement("button");
    printBtn.style.cssText = `
      background-color: var(--color-primary);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s, transform 0.1s;
      font-family: 'Inter', sans-serif;
    `;
    printBtn.innerHTML = modoGabarito ? "📥 Baixar Gabarito (PDF)" : "📥 Baixar Prova (PDF)";
    printBtn.onmouseover = () => printBtn.style.backgroundColor = "var(--color-primary-hover)";
    printBtn.onmouseout = () => printBtn.style.backgroundColor = "var(--color-primary)";

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = `
      background-color: var(--color-surface);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background-color 0.2s, border-color 0.2s;
      font-family: 'Inter', sans-serif;
    `;
    closeBtn.textContent = "Fechar";
    closeBtn.onmouseover = () => {
      closeBtn.style.backgroundColor = "var(--color-bg-1)";
      closeBtn.style.borderColor = "var(--color-text-secondary)";
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.backgroundColor = "var(--color-surface)";
      closeBtn.style.borderColor = "var(--color-border)";
    };

    const iframe = document.createElement("iframe");
    iframe.id = "pdf-preview-iframe";
    iframe.style.cssText = `
      flex: 1;
      width: 100%;
      border: none;
      background-color: var(--color-background);
    `;

    btnGroup.appendChild(printBtn);
    btnGroup.appendChild(closeBtn);
    header.appendChild(titleSpan);
    header.appendChild(btnGroup);
    modalContent.appendChild(header);
    modalContent.appendChild(iframe);
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.style.opacity = "0";
      modalContent.style.transform = "scale(0.95)";
      setTimeout(() => {
        overlay.remove();
      }, 300);
    };

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    window.closePdfPreviewModal = closeModal;

    // Auxiliar para estado de download do PDF no botão
    const originalBtnText = printBtn.innerHTML;
    window.setPdfDownloadingState = function(isDownloading) {
      if (isDownloading) {
        printBtn.disabled = true;
        printBtn.innerHTML = "⌛ Gerando PDF...";
      } else {
        printBtn.disabled = false;
        printBtn.innerHTML = originalBtnText;
      }
    };

    // Forçar reflow
    overlay.offsetHeight;
    overlay.style.opacity = "1";
    modalContent.style.transform = "scale(1)";

    const printWindow = iframe.contentWindow;
    
    printBtn.addEventListener("click", () => {
      if (printWindow.baixarPdfSimulado) {
        printWindow.baixarPdfSimulado();
      } else {
        printWindow.focus();
        printWindow.print();
      }
    });

    const colorScheme = document.documentElement.getAttribute("data-color-scheme") || "";
    const colorTheme = document.documentElement.getAttribute("data-theme") || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR" data-color-scheme="${colorScheme}" data-theme="${colorTheme}">
      <head>
        <meta charset="UTF-8">
        <title>${examTitle}</title>
        <!-- Estilos KaTeX -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
        <!-- Google Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        
        <!-- Copia todas as folhas de estilos ativas da janela pai (incluindo estilos injetados pelo Vite em dev e CDNs) -->
        ${getStylesFromParent()}
        <!-- Biblioteca html2pdf.js para downloads offline diretos -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <style>
          @media screen {
            .print-control-bar {
              display: none !important;
            }
            body.print-preview-mode {
              padding-top: 24px !important;
              background-color: var(--color-background) !important;
            }
          }
          /* Remove margins and shadows during PDF generation to prevent blank pages */
          body.generating-pdf .print-page {
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            height: 295mm !important; /* Slightly smaller than 297mm to prevent rounding overflow */
          }
          body.generating-pdf .print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* Force standard sans-serif font family stack and disable justification during PDF generation to prevent overlaps */
          body.generating-pdf,
          body.generating-pdf * {
            font-family: 'Inter', Arial, Helvetica, sans-serif !important;
            text-align: left !important; /* Prevents html2canvas justification spacing bugs */
          }
          /* Prevent inline elements from breaking/overlapping incorrectly in html2canvas */
          body.generating-pdf strong,
          body.generating-pdf em,
          body.generating-pdf b,
          body.generating-pdf i {
            display: inline-block !important;
          }
        </style>
      </head>
      <body class="print-preview-mode">
        
        <!-- Barra de controle para preview no navegador -->
        <div class="print-control-bar">
          <span class="print-control-title">${examTitle} - Visualização de Impressão</span>
          <div class="print-control-actions">
            <button class="print-btn" onclick="window.print()">🖨️ Imprimir Prova</button>
            <button class="print-btn cancel" onclick="window.close()">Fechar</button>
          </div>
        </div>

        <div class="print-container">
          <!-- Capa e Folha de Respostas estáticas se não for modo Gabarito -->
          ${modoGabarito ? "" : coverPageHtml}
          ${modoGabarito ? "" : answerSheetHtmlTemplate}
          <!-- Espaço reservado para as páginas geradas dinamicamente -->
          <div id="dynamic-pages-placeholder"></div>
        </div>

        <!-- KaTeX & Marked CDN para renderização no client -->
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        
        <script>
          // Override close for modal integration
          window.close = function() {
            if (window.parent && typeof window.parent.closePdfPreviewModal === 'function') {
              window.parent.closePdfPreviewModal();
            }
          };

          // Função de download direto do PDF usando html2pdf.js local
          window.baixarPdfSimulado = function() {
            const element = document.querySelector('.print-container');
            if (!element) return;

            // Substituir espaços por sublinhados. Escapado como \\s porque está dentro de uma template string do pai!
            const filenameTitle = (window.examTitle || 'simulado').toLowerCase().replace(/\\s+/g, '_');
            const filenameSuffix = window.modoGabarito ? 'gabarito' : 'prova';

            const opt = {
              margin:       0,
              filename:     filenameTitle + '_' + filenameSuffix + '.pdf',
              image:        { type: 'jpeg', quality: 0.98 },
              html2canvas:  { scale: 2, useCORS: true, logging: false },
              jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
              pagebreak:    { mode: ['css'] }
            };

            if (window.parent && typeof window.parent.setPdfDownloadingState === 'function') {
              window.parent.setPdfDownloadingState(true);
            }

            // Ativa classe para zerar margens e shadows temporariamente para que o html2pdf gere as páginas sem quebras fantasmas
            document.body.classList.add('generating-pdf');

            // Aguarda o carregamento completo de todas as fontes antes de renderizar para evitar overlapping de textos
            document.fonts.ready.then(() => {
              html2pdf().set(opt).from(element).save().then(() => {
                document.body.classList.remove('generating-pdf');
                if (window.parent && typeof window.parent.setPdfDownloadingState === 'function') {
                  window.parent.setPdfDownloadingState(false);
                }
              }).catch((err) => {
                console.error("Erro ao gerar PDF:", err);
                document.body.classList.remove('generating-pdf');
                if (window.parent && typeof window.parent.setPdfDownloadingState === 'function') {
                  window.parent.setPdfDownloadingState(false);
                }
              });
            });
          };

          window.questoesData = ${serializedQuestoes};
          window.isTeste = ${isTeste};
          window.hasObjective = ${hasObjective};
          window.hasWritten = ${hasWritten};
          window.examTitle = "${examTitle}";
          window.subTitle = "${subTitle}";
          window.modoGabarito = ${modoGabarito};

          // Configura marked para quebra de linhas automática
          marked.setOptions({
            breaks: true,
            gfm: true
          });

          function escapeHtml(text) {
            if (!text) return "";
            return String(text)
              .replace(/&/g, "&amp;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
          }

          function renderBlockToHtmlString(bloco) {
            const tipo = (bloco.tipo || "texto").toLowerCase();
            const conteudo = bloco.conteudo ? String(bloco.conteudo) : "";
            const escaped = escapeHtml(conteudo);
          
            switch (tipo) {
              case "texto":
                return '<div class="markdown-content print-block-text" data-raw="' + escaped + '"></div>';
              case "citacao":
                return '<blockquote class="markdown-content print-block-citacao" data-raw="' + escaped + '"></blockquote>';
              case "destaque":
                return '<div class="markdown-content print-block-destaque" data-raw="' + escaped + '"></div>';
              case "titulo":
                return '<h3 class="markdown-content print-block-titulo" data-raw="' + escaped + '"></h3>';
              case "subtitulo":
                return '<h4 class="markdown-content print-block-subtitulo" data-raw="' + escaped + '"></h4>';
              case "fonte":
                return '<div class="markdown-content print-block-fonte" data-raw="' + escaped + '"></div>';
              case "separador":
                return '<hr class="print-block-separador" />';
              case "equacao":
                return '<div class="math-block">\\\\[ ' + conteudo + ' \\\\]</div>';
              case "tabela":
                return '<div class="markdown-content print-block-tabela" data-raw="' + escaped + '"></div>';
              case "lista":
                return '<div class="markdown-content print-block-lista" data-raw="' + escaped + '"></div>';
              case "codigo":
                return '<pre class="print-block-codigo"><code>' + escaped + '</code></pre>';
              case "imagem":
                const src = bloco._printSrc || bloco.url || "";
                let imgHtml = "";
                if (src) {
                  imgHtml = '<img src="' + src + '" style="max-width: 100%; max-height: 500px; display: block; margin: 12px auto; object-fit: contain;" />';
                }
                const captionHtml = conteudo
                  ? '<div class="markdown-content print-image-caption" data-raw="' + escaped + '" style="font-size: 8.5pt; text-align: center; font-style: italic; color: #555; margin-top: 4px;"></div>'
                  : "";
                let creditHtml = "";
                const isPdfCrop = bloco.pdf_page || bloco.pdfjs_x !== undefined || bloco.pdf_left !== undefined;
                if (isPdfCrop) {
                  const materialName = bloco._materialOrigem || "Prova Original";
                  const pageNum = bloco.pdf_page || 1;
                  creditHtml = '<div class="print-image-credit">Fonte: ' + escapeHtml(materialName) + ' (p. ' + pageNum + ')</div>';
                }
                return '<div class="print-block-image-wrapper">' + imgHtml + captionHtml + creditHtml + '</div>';
              default:
                return "";
            }
          }

          function renderPageSubElements(elements) {
            let html = "";
            let currentQuestionId = null;
            let inBody = false;
            let inAlts = false;
            let inGabaritoSteps = false;
            let inStepLi = false; // Tracks whether we're inside a step <li> (for cross-page continuations)

            // Helper: wrap content in a clipping container if it's a slice
            function wrapSlice(el, contentHtml) {
              if (!el._isSlice) return contentHtml;
              // Use overflow:hidden + negative margin-top to show only the portion for this slice
              const offset = el._sliceOffset;
              const sliceH = el.height;
              const totalH = el._sliceTotalHeight;
              return '<div class="print-slice-container" style="height:' + sliceH + 'px; overflow:hidden;">' +
                       '<div style="margin-top:-' + offset + 'px;">' +
                         contentHtml +
                       '</div>' +
                     '</div>';
            }

            elements.forEach((el) => {
              if (el.questionId !== currentQuestionId) {
                if (inStepLi) {
                  html += '</li>';
                  inStepLi = false;
                }
                if (inGabaritoSteps) {
                  html += '</ol></div>';
                  inGabaritoSteps = false;
                }
                if (inAlts) {
                  html += '</div>';
                  inAlts = false;
                }
                if (inBody) {
                  html += '</div>';
                  inBody = false;
                }
                if (currentQuestionId !== null) {
                  html += '</div>';
                }

                currentQuestionId = el.questionId;
                
                const spacingStyle = window.isTeste ? "" : 'style="margin-bottom: 35px;"';
                const isContinuation = el.type !== 'header' && el.type !== 'gabarito-header';
                const continuedClass = isContinuation ? " print-question-continued print-gabarito-continued" : "";

                if (window.modoGabarito) {
                  let wrapperStyle = "";
                  const subElements = window.subElements || [];
                  const questionPageElements = elements.filter(x => x.questionId === el.questionId);
                  const lastPageEl = questionPageElements[questionPageElements.length - 1];
                  const globalIdx = subElements.indexOf(lastPageEl);
                  const isSplitBottom = (globalIdx !== -1 && globalIdx < subElements.length - 1) && 
                                        (subElements[globalIdx + 1].questionId === el.questionId);
                  if (isSplitBottom) {
                    wrapperStyle = ' style="border-bottom: none !important; margin-bottom: 0 !important; padding-bottom: 0 !important;"';
                  }
                  html += '<div class="print-gabarito-item' + continuedClass + '"' + wrapperStyle + ' data-id="' + el.questionId + '">';
                } else {
                  html += '<div class="print-question-block' + continuedClass + '" ' + spacingStyle + ' data-id="' + el.questionId + '">';
                }
              }

              if (el.type === 'body-block') {
                if (inAlts) { html += '</div>'; inAlts = false; }
                if (!inBody) { html += '<div class="print-question-body">'; inBody = true; }
                html += wrapSlice(el, el.html);
              } 
              else if (el.type === 'alternative') {
                if (inBody) { html += '</div>'; inBody = false; }
                if (!inAlts) { html += '<div class="print-alternatives-list">'; inAlts = true; }
                html += wrapSlice(el, el.html);
              } 
              else if (el.type === 'gabarito-steps-start') {
                inGabaritoSteps = true;
                html += el.html;
              }
              else if (el.type === 'gabarito-step') {
                if (!inGabaritoSteps) {
                  inGabaritoSteps = true;
                  const startIdx = el.stepIndex || 1;
                  html += '<div class="print-gabarito-steps"><ol style="margin: 5px 0 0 0; padding-left: 20px;" start="' + startIdx + '">';
                }
                html += wrapSlice(el, el.html);
              }
              else if (el.type === 'gabarito-step-sub') {
                // Sub-block within a step — ensure we're inside the steps context
                if (!inGabaritoSteps) {
                  inGabaritoSteps = true;
                  const startIdx = el.stepIndex || 1;
                  html += '<div class="print-gabarito-steps"><ol style="margin: 5px 0 0 0; padding-left: 20px;" start="' + startIdx + '">';
                }
                // Open <li> if this is the start of a step, or if we need one for a cross-page continuation
                if (el.isStepStart) {
                  if (inStepLi) { html += '</li>'; } // close any previous open step
                  html += '<li class="print-gabarito-step">';
                  inStepLi = true;
                } else if (!inStepLi) {
                  // Cross-page continuation — open a <li> for valid HTML
                  html += '<li class="print-gabarito-step print-gabarito-step-continued">';
                  inStepLi = true;
                }
                html += wrapSlice(el, el.html);
                if (el.isStepEnd) {
                  html += '</li>';
                  inStepLi = false;
                }
              }
              else if (el.type === 'gabarito-steps-end') {
                if (inStepLi) {
                  html += '</li>';
                  inStepLi = false;
                }
                if (inGabaritoSteps) {
                  html += el.html;
                  inGabaritoSteps = false;
                }
              }
              else {
                if (inAlts) { html += '</div>'; inAlts = false; }
                if (inBody) { html += '</div>'; inBody = false; }
                html += wrapSlice(el, el.html);
              }
            });

            if (inStepLi) { html += '</li>'; }
            if (inGabaritoSteps) { html += '</ol></div>'; }
            if (inAlts) { html += '</div>'; }
            if (inBody) { html += '</div>'; }
            if (currentQuestionId !== null) { html += '</div>'; }

            return html;
          }

          window.onload = function() {
            document.fonts.ready.then(function() {
              // 1. Mapear todas as questões/gabaritos para sub-elementos planos
              const subElements = [];
              window.subElements = subElements;
              window.questoesData.forEach((qObj, qIdx) => {
                if (window.modoGabarito) {
                  const q = qObj.fullData?.dados_questao || {};
                  const g = qObj.fullData?.dados_gabarito || {};
                  const isQDissert =
                    q.tipo_resposta === "dissertativa" ||
                    !q.alternativas ||
                    q.alternativas.length === 0;

                  // A. Gabarito Header
                  const headerHtml = '<strong>Questão ' + String(qIdx + 1).padStart(2, "0") + '</strong>' +
                    '<div style="margin-top: 4px;">' +
                      '<strong>Gabarito Oficial:</strong> ' +
                      (isQDissert
                        ? "Dissertativa"
                        : '<span style="font-weight:bold; color:#10b981;">Alternativa ' + (g.alternativa_correta || "—") + '</span>') +
                    '</div>';
                  subElements.push({
                    questionId: qObj.id,
                    questionIndex: qIdx,
                    type: 'gabarito-header',
                    rawHtml: headerHtml
                  });

                  // B. Resposta Modelo
                  const respModelo = g.resposta_modelo || g.respostaModelo || "";
                  if (respModelo) {
                    const respModeloEscaped = escapeHtml(respModelo);
                    const respModeloHtml = '<div style="margin-top: 8px;"><strong>Resposta Modelo Esperada:</strong> <div class="markdown-content print-gabarito-answer" data-raw="' + respModeloEscaped + '"></div></div>';
                    subElements.push({
                      questionId: qObj.id,
                      questionIndex: qIdx,
                      type: 'gabarito-item',
                      rawHtml: respModeloHtml
                    });
                  }

                  // C. Justificativa
                  const justificativa = g.justificativa_curta || "Sem justificativa.";
                  const justificativaHtml = '<div style="margin-top: 8px;">' +
                    '<strong>Justificativa:</strong> ' +
                    '<span class="markdown-content" data-raw="' + escapeHtml(justificativa) + '"></span>' +
                    '</div>';
                  subElements.push({
                    questionId: qObj.id,
                    questionIndex: qIdx,
                    type: 'gabarito-item',
                    rawHtml: justificativaHtml
                  });

                  // D. Passos — Granular sub-blocks per step
                  // Each step is broken into its individual estrutura blocks
                  // for finer-grained height measurement and page packing
                  if (g.explicacao && Array.isArray(g.explicacao) && g.explicacao.length > 0) {
                    const stepsStartHtml = '<div class="print-gabarito-steps"><strong>Etapas de Resolução:</strong><ol style="margin: 5px 0 0 0; padding-left: 20px;">';
                    subElements.push({
                      questionId: qObj.id,
                      questionIndex: qIdx,
                      type: 'gabarito-steps-start',
                      rawHtml: stepsStartHtml
                    });

                    g.explicacao.forEach((p, pIdx) => {
                      const est = Array.isArray(p.estrutura)
                        ? p.estrutura
                        : [{ tipo: "texto", conteudo: p.passo || "" }];
                      
                      // If step has only 1 block, keep as single element (no benefit in splitting)
                      if (est.length <= 1) {
                        const stepContentHtml = est
                          .map((bl) => renderBlockToHtmlString(bl))
                          .join("");
                        const stepHtml = '<li class="print-gabarito-step">' + stepContentHtml + '</li>';
                        subElements.push({
                          questionId: qObj.id,
                          questionIndex: qIdx,
                          type: 'gabarito-step',
                          stepIndex: pIdx + 1,
                          rawHtml: stepHtml
                        });
                      } else {
                        // Multi-block step: split into sub-blocks for granular packing
                        // First block gets the <li> wrapper (step-start)
                        est.forEach((bl, blIdx) => {
                          const blockHtml = renderBlockToHtmlString(bl);
                          if (blIdx === 0) {
                            // First sub-block opens the <li>
                            const stepHtml = '<li class="print-gabarito-step">' + blockHtml;
                            subElements.push({
                              questionId: qObj.id,
                              questionIndex: qIdx,
                              type: 'gabarito-step-sub',
                              stepIndex: pIdx + 1,
                              subBlockIndex: blIdx,
                              isStepStart: true,
                              totalSubBlocks: est.length,
                              rawHtml: stepHtml
                            });
                          } else if (blIdx === est.length - 1) {
                            // Last sub-block closes the <li>
                            subElements.push({
                              questionId: qObj.id,
                              questionIndex: qIdx,
                              type: 'gabarito-step-sub',
                              stepIndex: pIdx + 1,
                              subBlockIndex: blIdx,
                              isStepEnd: true,
                              totalSubBlocks: est.length,
                              rawHtml: blockHtml + '</li>'
                            });
                          } else {
                            // Middle sub-blocks
                            subElements.push({
                              questionId: qObj.id,
                              questionIndex: qIdx,
                              type: 'gabarito-step-sub',
                              stepIndex: pIdx + 1,
                              subBlockIndex: blIdx,
                              totalSubBlocks: est.length,
                              rawHtml: blockHtml
                            });
                          }
                        });
                      }
                    });

                    const stepsEndHtml = '</ol></div>';
                    subElements.push({
                      questionId: qObj.id,
                      questionIndex: qIdx,
                      type: 'gabarito-steps-end',
                      rawHtml: stepsEndHtml
                    });
                  }

                  // E. Fontes Externas
                  if (g.fontes_externas && Array.isArray(g.fontes_externas) && g.fontes_externas.length > 0) {
                    g.fontes_externas.forEach((f, idx) => {
                      const linkHtml = '<li><a href="' + f.uri + '" target="_blank" rel="noopener noreferrer" style="color:#0284c7; text-decoration:none; font-size:0.85rem;">' + (f.title || f.uri) + ' ↗</a></li>';
                      
                      let rawHtml = "";
                      if (idx === 0) {
                        rawHtml = '<div style="margin-top: 8px;"><strong>Fontes Externas:</strong><ul style="list-style:none; padding:0; margin:5px 0 0 0; display:flex; flex-direction:column; gap:4px;">' + linkHtml + '</ul></div>';
                      } else {
                        rawHtml = '<div style="margin-top: 4px;"><ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:4px;">' + linkHtml + '</ul></div>';
                      }
                      
                      subElements.push({
                        questionId: qObj.id,
                        questionIndex: qIdx,
                        type: 'gabarito-item',
                        rawHtml: rawHtml
                      });
                    });
                  }
                } else {
                  const q = qObj.fullData?.dados_questao || {};
                  
                  // A. Question Header
                  const headerHtml = '<span class="print-question-num">' + String(qIdx + 1).padStart(2, "0") + '</span>';
                  subElements.push({
                    questionId: qObj.id,
                    questionIndex: qIdx,
                    type: 'header',
                    rawHtml: headerHtml
                  });

                  // B. Body Blocks
                  if (q.estrutura && Array.isArray(q.estrutura)) {
                    q.estrutura.forEach((bloco) => {
                      subElements.push({
                        questionId: qObj.id,
                        questionIndex: qIdx,
                        type: 'body-block',
                        rawHtml: renderBlockToHtmlString(bloco)
                      });
                    });
                  } else {
                    const textHtml = '<div class="print-block-text">' + (q.enunciado || "").replace(/\\n/g, "<br>") + '</div>';
                    subElements.push({
                      questionId: qObj.id,
                      questionIndex: qIdx,
                      type: 'body-block',
                      rawHtml: textHtml
                    });
                  }

                  const isQDissert = q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;
                  if (!isQDissert) {
                    if (q.alternativas && Array.isArray(q.alternativas)) {
                      q.alternativas.forEach((alt) => {
                        const letter = String(alt.letra || "").trim().toUpperCase();
                        let altText = "";
                        if (alt.estrutura && Array.isArray(alt.estrutura)) {
                          altText = alt.estrutura
                            .map((bl) => renderBlockToHtmlString(bl))
                            .join("");
                        } else {
                          altText = alt.texto || "";
                        }
                        const altHtml = '<div class="print-alternative-item">' +
                          '<span class="print-alternative-letter">' + letter + '</span>' +
                          '<span class="print-alternative-text">' + altText + '</span>' +
                          '</div>';
                        subElements.push({
                          questionId: qObj.id,
                          questionIndex: qIdx,
                          type: 'alternative',
                          rawHtml: altHtml
                        });
                      });
                    }
                  } else {
                    const resolutionBoxHtml = '<div class="print-ruled-resolution-box">' +
                      '<span class="print-ruled-box-label">RESERVE ESTE ESPAÇO PARA A RESOLUÇÃO E RESPOSTA</span>' +
                      '</div>';
                    subElements.push({
                      questionId: qObj.id,
                      questionIndex: qIdx,
                      type: 'resolution-box',
                      rawHtml: resolutionBoxHtml
                    });
                  }
                }
              });

              // 2. Criar sandbox no DOM para compilar markdown/KaTeX e medir as alturas exatas
              const sandbox = document.createElement('div');
              sandbox.style.position = 'absolute';
              sandbox.style.left = '-9999px';
              sandbox.style.boxSizing = 'border-box';
              sandbox.style.width = '500mm';
              sandbox.className = 'print-sandbox';
              sandbox.style.padding = '0';
              sandbox.style.margin = '0';
              sandbox.style.height = 'auto';
              sandbox.style.minHeight = '0';
              sandbox.style.boxShadow = 'none';
              document.body.appendChild(sandbox);

              // 3. Compilar todos os sub-elementos no sandbox
              let sandboxHtml = "";
              subElements.forEach((item, idx) => {
                let wrapStart = '';
                let wrapEnd = '';
                
                let itemWidth = '180mm';
                if (!window.modoGabarito) {
                  const qObj = window.questoesData[item.questionIndex];
                  const q = qObj.fullData?.dados_questao || {};
                  const isQDissert = q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;
                  itemWidth = isQDissert ? '180mm' : '85mm';
                }

                if (window.modoGabarito) {
                  wrapStart = '<div class="print-gabarito-item" style="margin-bottom:0; border-bottom:none; padding-bottom:0; width:180mm; box-sizing:border-box; overflow:hidden;" data-idx="' + idx + '">';
                  wrapEnd = '</div>';
                  
                  if (item.type === 'gabarito-step') {
                    wrapStart += '<div class="print-gabarito-steps" style="margin-top:0;"><ol style="margin:0; padding-left:20px;"><li style="list-style-type:none;">';
                    wrapEnd = '</li></ol></div>' + wrapEnd;
                  } else if (item.type === 'gabarito-step-sub') {
                    // Sub-blocks within a step — wrap in a minimal context for accurate measurement
                    wrapStart += '<div class="print-gabarito-steps" style="margin-top:0;"><ol style="margin:0; padding-left:20px;"><li style="list-style-type:none;">';
                    wrapEnd = '</li></ol></div>' + wrapEnd;
                  }
                } else {
                  wrapStart = '<div class="print-question-block" style="margin-bottom:0; width:' + itemWidth + '; box-sizing:border-box; overflow:hidden;" data-idx="' + idx + '">';
                  wrapEnd = '</div>';
                  if (item.type === 'body-block') {
                    wrapStart += '<div class="print-question-body">';
                    wrapEnd = '</div>' + wrapEnd;
                  } else if (item.type === 'alternative') {
                    wrapStart += '<div class="print-alternatives-list">';
                    wrapEnd = '</div>' + wrapEnd;
                  }
                }

                sandboxHtml += wrapStart + item.rawHtml + wrapEnd;
              });

              sandbox.innerHTML = sandboxHtml;

              // Compila Markdown de uma vez
              sandbox.querySelectorAll('.markdown-content').forEach(el => {
                const raw = el.getAttribute('data-raw') || el.innerHTML || '';
                if (raw.trim()) el.innerHTML = marked.parse(raw);
              });

              // Compila KaTeX de uma vez
              if (window.renderMathInElement) {
                window.renderMathInElement(sandbox, {
                  delimiters: [
                    { left: '\\\\[', right: '\\\\]', display: true },
                    { left: '$$', right: '$$', display: true },
                    { left: '\\\\(', right: '\\\\)', display: false },
                    { left: '$', right: '$', display: false }
                  ],
                  throwOnError: false
                });
              }

              // Espera o carregamento de todas as imagens para garantir a medição de altura correta
              const images = Array.from(sandbox.querySelectorAll('img'));
              const imgPromises = images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                });
              });

              Promise.all(imgPromises).then(() => {
                // Extrai HTML compilado e mede a altura correta de cada bloco
                subElements.forEach((item, idx) => {
                  const wrapper = sandbox.querySelector('[data-idx="' + idx + '"]');
                  if (!wrapper) return;

                  if (window.modoGabarito) {
                    if (item.type === 'gabarito-step') {
                      item.html = wrapper.querySelector('.print-gabarito-step').outerHTML;
                    } else if (item.type === 'gabarito-step-sub') {
                      // Extract the compiled content from the sandbox wrapper
                      const stepLi = wrapper.querySelector('li');
                      item.html = stepLi ? stepLi.innerHTML : wrapper.innerHTML;
                    } else if (item.type === 'gabarito-steps-start') {
                      item.html = item.rawHtml;
                    } else if (item.type === 'gabarito-steps-end') {
                      item.html = item.rawHtml;
                    } else {
                      item.html = wrapper.innerHTML;
                    }
                  } else {
                    if (item.type === 'header') {
                      item.html = wrapper.querySelector('.print-question-num').outerHTML;
                    } else if (item.type === 'body-block') {
                      item.html = wrapper.querySelector('.print-question-body').firstElementChild.outerHTML;
                    } else if (item.type === 'alternative') {
                      item.html = wrapper.querySelector('.print-alternative-item').outerHTML;
                    } else if (item.type === 'resolution-box') {
                      item.html = wrapper.querySelector('.print-ruled-resolution-box').outerHTML;
                    }
                  }

                  item.height = wrapper.getBoundingClientRect().height;
                });

                document.body.removeChild(sandbox);

                // Executa a paginação e o bin-packing com as alturas corretas e definitivas
                executarBinPackingEPaginacao(subElements);
              });

              function executarBinPackingEPaginacao(subElements) {
                // 3.5 Calculate effective page content height (accounts for page headers)
                const maxColHeight = 840; // Raw A4 content height in px (column at 85mm width)
                // Gabarito headers are taller (header-line + gabarito-title ≈ 80px)
                // Regular question/dissertativa pages have a smaller header-line ≈ 40px
                const effectiveMaxHeight = window.modoGabarito ? 750 : 800;
                
                // Split oversized sub-elements into page-sized chunks using clip
                const splitSubElements = [];
                subElements.forEach((item) => {
                  if (item.height <= effectiveMaxHeight) {
                    splitSubElements.push(item);
                  } else {
                    // Element is taller than one page — split into clipped slices
                    const totalHeight = item.height;
                    let offset = 0;
                    let sliceIndex = 0;
                    while (offset < totalHeight) {
                      const sliceHeight = Math.min(effectiveMaxHeight, totalHeight - offset);
                      splitSubElements.push({
                        questionId: item.questionId,
                        questionIndex: item.questionIndex,
                        type: item.type,
                        stepIndex: item.stepIndex,
                        // Propagate step-sub properties for cross-page continuations
                        subBlockIndex: item.subBlockIndex,
                        totalSubBlocks: item.totalSubBlocks,
                        isStepStart: item.isStepStart && sliceIndex === 0, // Only first slice starts the step
                        isStepEnd: false, // Will be set on the last slice below
                        html: item.html,
                        rawHtml: item.rawHtml,
                        height: sliceHeight,
                        _isSlice: true,
                        _sliceIndex: sliceIndex,
                        _sliceOffset: offset,
                        _sliceTotalHeight: totalHeight
                      });
                      offset += sliceHeight;
                      sliceIndex++;
                    }
                    // Set isStepEnd on the last slice (if the original item had it)
                    if (item.isStepEnd && splitSubElements.length > 0) {
                      splitSubElements[splitSubElements.length - 1].isStepEnd = true;
                    }
                  }
                });

                // Replace subElements with the split version for bin-packing
                const finalSubElements = splitSubElements;

                // Agrupa sub-elementos por questão para garantir que a questão não seja cortada
                const questionsList = [];
                let currentQuestion = null;
                finalSubElements.forEach((el) => {
                  if (!currentQuestion || currentQuestion.id !== el.questionId) {
                    currentQuestion = {
                      id: el.questionId,
                      index: el.questionIndex,
                      elements: [],
                      totalHeight: 0
                    };
                    questionsList.push(currentQuestion);
                  }
                  currentQuestion.elements.push(el);
                  currentQuestion.totalHeight += el.height;
                });

                // 4. Algoritmo de Bin-Packing dinâmico para agrupar em páginas A4 com suporte a corte organizado
                const placeholder = document.getElementById('dynamic-pages-placeholder');

                const isMixed = !window.modoGabarito && window.hasObjective && window.hasWritten;

                if (window.modoGabarito) {
                  // Modo Gabarito (1 coluna) — Packing granular bloco-a-bloco
                  // Inspirado no sistema de sub-blocos da sessão de prova:
                  // Cada sub-elemento (header, justificativa, step individual, etc.)
                  // é empacotado independentemente para maximizar o uso da página
                  // e eliminar espaços em branco excessivos.
                  const pages = [];
                  let currentPage = { elements: [], height: 0 };
                  const GABARITO_FIRST_PAGE_LIMIT = 750;
                  const GABARITO_PAGE_LIMIT = 800;

                  // Função que calcula o limite da página atual considerando se é primeira página
                  function getCurrentGabaritoLimit() {
                    return pages.length === 0 ? GABARITO_FIRST_PAGE_LIMIT : GABARITO_PAGE_LIMIT;
                  }

                  // Flatten all sub-elements and pack element-by-element (granular)
                  // This ensures maximum page fill — no more full-question moves that waste space
                  finalSubElements.forEach((el) => {
                    // Skip structural markers (steps-start / steps-end) for height purposes
                    // They are 0-height wrappers that just open/close <ol> tags
                    if (el.type === 'gabarito-steps-start' || el.type === 'gabarito-steps-end') {
                      // Always keep with current page — they have no real height
                      currentPage.elements.push(el);
                      return;
                    }

                    const elHeight = el.height || 0;
                    const limit = getCurrentGabaritoLimit();

                    // Peek ahead: if this is a gabarito-header, try to keep it with 
                    // at least the next element (justificativa) to avoid orphan headers
                    if (el.type === 'gabarito-header') {
                      // Find the predicted height of the header + next meaningful block
                      const nextIdx = finalSubElements.indexOf(el) + 1;
                      let peekHeight = elHeight;
                      // Look for the next non-structural element
                      for (let ni = nextIdx; ni < finalSubElements.length && ni <= nextIdx + 3; ni++) {
                        const nextEl = finalSubElements[ni];
                        if (!nextEl) break;
                        if (nextEl.questionId !== el.questionId) break;
                        if (nextEl.type === 'gabarito-steps-start' || nextEl.type === 'gabarito-steps-end') continue;
                        peekHeight += (nextEl.height || 0);
                        break; // Only need the first real element
                      }

                      // If header + next block won't fit, start a new page
                      if (currentPage.height + peekHeight > limit && currentPage.elements.length > 0) {
                        pages.push(currentPage);
                        currentPage = { elements: [el], height: elHeight };
                        return;
                      }
                    }

                    // Standard granular packing: does this element fit on the current page?
                    if (currentPage.height + elHeight <= limit) {
                      currentPage.elements.push(el);
                      currentPage.height += elHeight;
                    } else {
                      // Current page is full — push it and start a new one
                      if (currentPage.elements.length > 0) {
                        pages.push(currentPage);
                      }
                      currentPage = { elements: [el], height: elHeight };
                    }
                  });

                  if (currentPage.elements.length > 0) {
                    pages.push(currentPage);
                  }

                  pages.forEach((pageData, pageIdx) => {
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'print-page gabarito-page';
                    
                    const headerText = 'GABARITO OFICIAL &mdash; ' + window.examTitle;
                    
                    let header = '<div class="questions-header-line"><span>CONCURSO VESTIBULAR MAIA.EDU</span><span>' + headerText + '</span></div>';
                    
                    if (pageIdx === 0) {
                      header += '<div class="print-gabarito-title" style="margin-bottom: 20px;">RESOLUÇÕES E GABARITO OFICIAL: ' + window.examTitle + '</div>';
                    }

                    const content = '<div class="print-one-column-layout">' + renderPageSubElements(pageData.elements) + '</div>';
                    
                    pageDiv.innerHTML = header + content;
                    placeholder.appendChild(pageDiv);
                  });
                } else if (isMixed) {
                  // MODO MISTO: Seção I (Objetivas, 2 colunas) e Seção II (Dissertativas, 1 coluna)
                  const objectiveQuestionsList = [];
                  const writtenQuestionsList = [];

                  questionsList.forEach((q) => {
                    const qDataObj = window.questoesData[q.index];
                    const qData = qDataObj.fullData?.dados_questao || {};
                    const isQDissert = qData.tipo_resposta === "dissertativa" || !qData.alternativas || qData.alternativas.length === 0;
                    if (isQDissert) {
                      writtenQuestionsList.push(q);
                    } else {
                      objectiveQuestionsList.push(q);
                    }
                  });

                  // 1. Paginar Seção I (Objetivas, 2 colunas)
                  const objectivePages = [];
                  let currentPage = { col1: [], col1Height: 0, col2: [], col2Height: 0 };

                  objectiveQuestionsList.forEach((q) => {
                    const isFirstPage = objectivePages.length === 0;
                    const limit = isFirstPage ? (effectiveMaxHeight - 40) : effectiveMaxHeight;

                    if (q.totalHeight <= limit) {
                      if (currentPage.col1Height + q.totalHeight <= limit) {
                        currentPage.col1.push(...q.elements);
                        currentPage.col1Height += q.totalHeight;
                      } else if (currentPage.col2Height + q.totalHeight <= limit) {
                        currentPage.col2.push(...q.elements);
                        currentPage.col2Height += q.totalHeight;
                      } else {
                        if (currentPage.col1.length > 0 || currentPage.col2.length > 0) {
                          objectivePages.push(currentPage);
                        }
                        currentPage = { col1: [...q.elements], col1Height: q.totalHeight, col2: [], col2Height: 0 };
                      }
                    } else {
                      q.elements.forEach((el) => {
                        const currentLimit = objectivePages.length === 0 ? (effectiveMaxHeight - 40) : effectiveMaxHeight;
                        if (currentPage.col1Height + el.height <= currentLimit) {
                          currentPage.col1.push(el);
                          currentPage.col1Height += el.height;
                        } else if (currentPage.col2Height + el.height <= currentLimit) {
                          currentPage.col2.push(el);
                          currentPage.col2Height += el.height;
                        } else {
                          if (currentPage.col1.length > 0 || currentPage.col2.length > 0) {
                            objectivePages.push(currentPage);
                          }
                          currentPage = { col1: [el], col1Height: el.height, col2: [], col2Height: 0 };
                        }
                      });
                    }
                  });
                  if (currentPage.col1.length > 0 || currentPage.col2.length > 0) {
                    objectivePages.push(currentPage);
                  }

                  objectivePages.forEach((pageData, index) => {
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'print-page questions-page';
                    const header = '<div class="questions-header-line"><span>CONCURSO VESTIBULAR MAIA.EDU</span><span>' + window.examTitle + ' &mdash; ' + window.subTitle + '</span></div>';
                    
                    let sectionHeaderHtml = '';
                    if (index === 0) {
                      sectionHeaderHtml = '<div class="print-section-header">SEÇÃO I &mdash; QUESTÕES OBJETIVAS</div>';
                    }

                    const col1Html = renderPageSubElements(pageData.col1);
                    const col2Html = renderPageSubElements(pageData.col2);

                    const colLayout = '<div class="print-columns-container">' +
                                        '<div class="print-column">' + col1Html + '</div>' +
                                        '<div class="print-column-divider"></div>' +
                                        '<div class="print-column">' + col2Html + '</div>' +
                                      '</div>';

                    pageDiv.innerHTML = header + sectionHeaderHtml + colLayout;
                    placeholder.appendChild(pageDiv);
                  });

                  // 2. Paginar Seção II (Dissertativas, 1 coluna)
                  const writtenPages = [];
                  let currentWPage = { elements: [], height: 0 };

                  writtenQuestionsList.forEach((q) => {
                    const isFirstPage = writtenPages.length === 0;
                    const limit = isFirstPage ? (effectiveMaxHeight - 40) : effectiveMaxHeight;

                    if (q.totalHeight <= limit) {
                      if (currentWPage.height + q.totalHeight <= limit) {
                        currentWPage.elements.push(...q.elements);
                        currentWPage.height += q.totalHeight;
                      } else {
                        if (currentWPage.elements.length > 0) {
                          writtenPages.push(currentWPage);
                        }
                        currentWPage = { elements: [...q.elements], height: q.totalHeight };
                      }
                    } else {
                      q.elements.forEach((el) => {
                        const currentLimit = writtenPages.length === 0 ? (effectiveMaxHeight - 40) : effectiveMaxHeight;
                        if (currentWPage.height + el.height <= currentLimit) {
                          currentWPage.elements.push(el);
                          currentWPage.height += el.height;
                        } else {
                          if (currentWPage.elements.length > 0) {
                            writtenPages.push(currentWPage);
                          }
                          currentWPage = { elements: [el], height: el.height };
                        }
                      });
                    }
                  });
                  if (currentWPage.elements.length > 0) {
                    writtenPages.push(currentWPage);
                  }

                  writtenPages.forEach((pageData, index) => {
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'print-page questions-page';
                    const header = '<div class="questions-header-line"><span>CONCURSO VESTIBULAR MAIA.EDU</span><span>' + window.examTitle + ' &mdash; ' + window.subTitle + '</span></div>';
                    
                    let sectionHeaderHtml = '';
                    if (index === 0) {
                      sectionHeaderHtml = '<div class="print-section-header">SEÇÃO II &mdash; QUESTÕES DISSERTATIVAS</div>';
                    }

                    const content = '<div class="print-one-column-layout">' + renderPageSubElements(pageData.elements) + '</div>';

                    pageDiv.innerHTML = header + sectionHeaderHtml + content;
                    placeholder.appendChild(pageDiv);
                  });
                } else if (window.hasObjective) {
                  // Apenas Provas Objetivas (2 colunas)
                  const pages = [];
                  let currentPage = { col1: [], col1Height: 0, col2: [], col2Height: 0 };

                  questionsList.forEach((q) => {
                    if (q.totalHeight <= effectiveMaxHeight) {
                      if (currentPage.col1Height + q.totalHeight <= effectiveMaxHeight) {
                        currentPage.col1.push(...q.elements);
                        currentPage.col1Height += q.totalHeight;
                      } else if (currentPage.col2Height + q.totalHeight <= effectiveMaxHeight) {
                        currentPage.col2.push(...q.elements);
                        currentPage.col2Height += q.totalHeight;
                      } else {
                        if (currentPage.col1.length > 0 || currentPage.col2.length > 0) {
                          pages.push(currentPage);
                        }
                        currentPage = { col1: [...q.elements], col1Height: q.totalHeight, col2: [], col2Height: 0 };
                      }
                    } else {
                      q.elements.forEach((el) => {
                        if (currentPage.col1Height + el.height <= effectiveMaxHeight) {
                          currentPage.col1.push(el);
                          currentPage.col1Height += el.height;
                        } else if (currentPage.col2Height + el.height <= effectiveMaxHeight) {
                          currentPage.col2.push(el);
                          currentPage.col2Height += el.height;
                        } else {
                          if (currentPage.col1.length > 0 || currentPage.col2.length > 0) {
                            pages.push(currentPage);
                          }
                          currentPage = { col1: [el], col1Height: el.height, col2: [], col2Height: 0 };
                        }
                      });
                    }
                  });
                  if (currentPage.col1.length > 0 || currentPage.col2.length > 0) {
                    pages.push(currentPage);
                  }

                  pages.forEach((pageData) => {
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'print-page questions-page';
                    
                    const header = '<div class="questions-header-line"><span>CONCURSO VESTIBULAR MAIA.EDU</span><span>' + window.examTitle + ' &mdash; ' + window.subTitle + '</span></div>';
                    
                    const col1Html = renderPageSubElements(pageData.col1);
                    const col2Html = renderPageSubElements(pageData.col2);
                    
                    const colLayout = '<div class="print-columns-container">' +
                                        '<div class="print-column">' + col1Html + '</div>' +
                                        '<div class="print-column-divider"></div>' +
                                        '<div class="print-column">' + col2Html + '</div>' +
                                      '</div>';
                    
                    pageDiv.innerHTML = header + colLayout;
                    placeholder.appendChild(pageDiv);
                  });
                } else {
                  // Apenas Provas Dissertativas (1 coluna)
                  const pages = [];
                  let currentPage = { elements: [], height: 0 };

                  questionsList.forEach((q) => {
                    if (q.totalHeight <= effectiveMaxHeight) {
                      if (currentPage.height + q.totalHeight <= effectiveMaxHeight) {
                        currentPage.elements.push(...q.elements);
                        currentPage.height += q.totalHeight;
                      } else {
                        if (currentPage.elements.length > 0) {
                          pages.push(currentPage);
                        }
                        currentPage = { elements: [...q.elements], height: q.totalHeight };
                      }
                    } else {
                      q.elements.forEach((el) => {
                        if (currentPage.height + el.height <= effectiveMaxHeight) {
                          currentPage.elements.push(el);
                          currentPage.height += el.height;
                        } else {
                          if (currentPage.elements.length > 0) {
                            pages.push(currentPage);
                          }
                          currentPage = { elements: [el], height: el.height };
                        }
                      });
                    }
                  });
                  if (currentPage.elements.length > 0) {
                    pages.push(currentPage);
                  }

                  pages.forEach((pageData) => {
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'print-page questions-page';
                    
                    const header = '<div class="questions-header-line"><span>CONCURSO VESTIBULAR MAIA.EDU</span><span>' + window.examTitle + ' &mdash; ' + window.subTitle + '</span></div>';
                    
                    const content = '<div class="print-one-column-layout">' + renderPageSubElements(pageData.elements) + '</div>';
                    
                    pageDiv.innerHTML = header + content;
                    placeholder.appendChild(pageDiv);
                  });
                }

                // 5. Adicionar rodapés enumerados em todas as páginas (incluindo Capa e Cartão Respostas)
                const allPages = document.querySelectorAll('.print-page');
                const totalPages = allPages.length;

                allPages.forEach((page, index) => {
                  const footer = document.createElement('div');
                  footer.className = 'print-page-footer';
                  
                  let footerText = '';
                  if (window.modoGabarito) {
                    footerText = 'RESOLUÇÕES — PÁGINA ' + (index + 1) + ' DE ' + totalPages;
                  } else {
                    if (index === 0) {
                      footerText = 'CAPA — PÁGINA 1 DE ' + totalPages;
                    } else if (index === 1 && window.hasObjective) {
                      footerText = 'FOLHA DE RESPOSTAS — PÁGINA 2 DE ' + totalPages;
                    } else {
                      footerText = 'PÁGINA ' + (index + 1) + ' DE ' + totalPages;
                    }
                  }
                  
                  footer.innerHTML = '<span>CONCURSO VESTIBULAR MAIA.EDU</span><span>' + footerText + '</span>';
                  page.appendChild(footer);
                });

                // 6. Emitir evento simulado-pdf-ready para fechar a barra de loading do pai
                if (window.opener && !window.opener.closed) {
                   try {
                      window.opener.dispatchEvent(new CustomEvent('simulado-pdf-ready'));
                   } catch(e) {}
                }
                if (window.parent && window.parent !== window.self) {
                   try {
                      window.parent.dispatchEvent(new CustomEvent('simulado-pdf-ready'));
                   } catch(e) {}
                }
              }
            });
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();

    // Remove loading do pai quando carregar
    window.addEventListener("simulado-pdf-ready", () => {
      hidePrintLoading();
    }, { once: true });

    // Fallback de remoção de loading
    setTimeout(() => {
      hidePrintLoading();
    }, 4000);

  } catch (e) {
    hidePrintLoading();
    customAlert(`❌ Erro ao gerar PDF: ${e.message}`, 4000);
  }
}

// Clona todas as style tags e links de estilos da aba pai e retorna a string HTML deles
function getStylesFromParent() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => {
      const clone = el.cloneNode(true);
      if (clone.tagName === "LINK") {
        const href = clone.getAttribute("href");
        if (href && !href.startsWith("http") && !href.startsWith("//")) {
          // Converte link relativo para absoluto para resolver no about:blank
          clone.setAttribute(
            "href",
            `${window.location.origin}${href.startsWith("/") ? "" : "/"}${href}`
          );
        }
      }
      return clone.outerHTML;
    })
    .join("\n");
}
