/**
 * Prepara o ambiente: configura worker, limpa tela anterior,
 * define estados globais, gera as URLs dos blobs e busca link original do manifesto.
 */
export async function inicializarContextoViewer(args) {
  // 1. Configuração do Worker (só se não tiver)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // 2. Remove a tela de Upload anterior
  const uploadContainer = document.getElementById("pdfUploadContainer");
  if (uploadContainer) uploadContainer.remove();

  // Resolve "Auto-Detect" titles to the slug to prevent displaying generic title and database name clashes
  if (!args.rawTitle || args.rawTitle === 'Auto-Detect') {
    args.rawTitle = args.slug || 'Auto-Detect';
  }
  if (!args.title || args.title === 'Auto-Detect') {
    args.title = args.slug || 'Auto-Detect';
  }

  // 3. Define Estado Global Inicial
  window.__viewerArgs = args;

  // 4. Gerenciamento de URLs (Limpa antigas e cria novas)
  if (!window.__pdfUrls) window.__pdfUrls = {};
  if (window.__pdfUrls.prova) URL.revokeObjectURL(window.__pdfUrls.prova);

  // ============================================
  // SISTEMA DE IMAGENS VIA PDF
  // Variáveis globais para renderização de imagens
  // ============================================
  window.__pdfOriginalUrl = null; // URL pública do PDF (do manifesto)
  window.__pdfLocalFile = null; // Arquivo PDF local se usuário fizer upload
  window.__pdfDownloadUrl = null; // Link sugerido para download do PDF

  // [NEW] Accept override from arguments (passed by form-logic)
  if (args.originalPdfUrl) {
    window.__pdfOriginalUrl = args.originalPdfUrl;
    window.__pdfDownloadUrl = args.originalPdfUrl;
    console.log(
      "[Contexto] URL original definida via argumentos:",
      args.originalPdfUrl
    );
  }

  // 5. Tentar obter link original do manifesto (se tiver slug) - Só se ainda não tivermos
  if (args.slug && !args.isManualLocal && !window.__pdfOriginalUrl) {
    try {
      const manifestUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${args.slug}/manifest.json`;
      const res = await fetch(manifestUrl);

      if (res.ok) {
        const manifest = await res.json();
        // Manifesto pode ser array ou objeto com 'results'
        const items = Array.isArray(manifest)
          ? manifest
          : manifest.results || [];

        // Encontrar item da PROVA com link_origem
        const provaItem = items.find(
          (i) => i.tipo === "prova" || i.link_origem
        );

        if (provaItem?.link_origem) {
          window.__pdfOriginalUrl = provaItem.link_origem;
          window.__pdfDownloadUrl = provaItem.link_origem;
          console.log(
            "[Contexto] Link original do PDF encontrado no manifesto:",
            window.__pdfOriginalUrl
          );
        } else {
          // Fallback: tentar encontrar URL hospedada do HuggingFace
          const hostedItem = items.find((i) => i.url || i.filename);
          if (hostedItem) {
            const filename = hostedItem.filename;
            if (filename) {
              window.__pdfDownloadUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${args.slug}/files/${filename}`;
            } else if (hostedItem.url) {
              window.__pdfDownloadUrl = hostedItem.url;
            }
          }
        }
      }
    } catch (e) {
      console.warn(
        "[Contexto] Não foi possível obter link original do manifesto:",
        e.message
      );
    }
  }

  // Helper simples para lidar com File/Blob vs String URL
  const getUrl = (fileOrUrl) => {
    if (!fileOrUrl) return null;
    if (typeof fileOrUrl === "string") {
      // PROXY LOGIC: Se for URL externa (HuggingFace, etc), usa o proxy para evitar CORS/CORB
      if (
        fileOrUrl.startsWith("http") &&
        !fileOrUrl.includes("localhost") &&
        !fileOrUrl.includes("127.0.0.1") &&
        !fileOrUrl.includes("/proxy-pdf")
      ) {
        const workerUrl =
          "https://maia-api-worker.willian-campos-ismart.workers.dev";
        const encodedTarget = encodeURIComponent(fileOrUrl);
        return `${workerUrl}/proxy-pdf?url=${encodedTarget}`;
      }
      return fileOrUrl;
    }
    return URL.createObjectURL(fileOrUrl);
  };

  window.__pdfUrls.prova = getUrl(args.fileProva);

  // [FIX] Se fileProva for um File (não string), salva para uso do PdfEmbedRenderer
  if (
    args.fileProva &&
    typeof args.fileProva !== "string" &&
    args.fileProva instanceof File
  ) {
    window.__pdfLocalFile = args.fileProva;
    // Dispara evento para notificar componentes React
    window.dispatchEvent(new CustomEvent("pdfLocalFileLoaded"));
    console.log("[Contexto] Arquivo local definido:", args.fileProva.name);
  }

  // Retorna a URL inicial para quem chamou usar
  return window.__pdfUrls.prova;
}
