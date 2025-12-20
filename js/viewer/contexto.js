/**
 * Prepara o ambiente: configura worker, limpa tela anterior,
 * define estados globais e gera as URLs dos blobs.
 */
export function inicializarContextoViewer(args) {
  // 1. Configuração do Worker (só se não tiver)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // 2. Remove a tela de Upload anterior
  const uploadContainer = document.getElementById('pdfUploadContainer');
  if (uploadContainer) uploadContainer.remove();

  // 3. Define Estado Global Inicial
  window.__viewerArgs = args;
  window.__modo = 'prova';

  // 4. Gerenciamento de URLs (Limpa antigas e cria novas)
  // Garante que o objeto existe antes de tentar acessar
  if (!window.__pdfUrls) window.__pdfUrls = {};

  if (window.__pdfUrls.prova) URL.revokeObjectURL(window.__pdfUrls.prova);
  if (window.__pdfUrls.gabarito) URL.revokeObjectURL(window.__pdfUrls.gabarito);

  window.__pdfUrls.prova = URL.createObjectURL(args.fileProva);
  window.__pdfUrls.gabarito = args.fileGabarito
    ? URL.createObjectURL(args.fileGabarito)
    : null;

  // Retorna a URL inicial para quem chamou usar
  return window.__pdfUrls.prova;
}
