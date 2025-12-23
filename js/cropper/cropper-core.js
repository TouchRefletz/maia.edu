import { viewerState } from '../main.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { renderPage, renderPageHighRes } from '../viewer/pdf-core.js';

export async function prepararImagemParaCropper() {
  const container = document.getElementById('canvasContainer');
  const sourceCanvas = document.getElementById('the-canvas');

  if (!sourceCanvas) return null;

  // 1. Captura estado do scroll (Usa a global scrollPos)
  viewerState.scrollPos.top = container.scrollTop;
  viewerState.scrollPos.left = container.scrollLeft;

  const currentWidth = sourceCanvas.style.width || sourceCanvas.width + 'px';
  const currentHeight = sourceCanvas.style.height || sourceCanvas.height + 'px';

  // 2. Gera a imagem em ALTA RESOLUÇÃO (Async)
  // Mostra um feedback visual rápido se necessário, mas o await já segura
  const highResDataUrl = await renderPageHighRes(viewerState.pageNum);

  if (!highResDataUrl) {
    console.error('Falha ao renderizar imagem HR');
    return null;
  }

  // 3. Cria a imagem temporária
  const imageForCropper = document.createElement('img');
  imageForCropper.id = 'temp-cropper-img';
  imageForCropper.src = highResDataUrl;

  // Estilos Críticos -> Força o tamanho VISUAL a ser igual ao do canvas anterior
  imageForCropper.style.width = currentWidth;
  imageForCropper.style.height = currentHeight;
  imageForCropper.style.maxWidth = 'none';
  imageForCropper.style.display = 'block';

  // 4. Limpa e prepara o container
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.width = currentWidth;
  wrapper.style.height = currentHeight;
  wrapper.style.position = 'relative';
  wrapper.style.margin = '0 auto';

  wrapper.appendChild(imageForCropper);
  container.appendChild(wrapper);

  // 5. Restaura Scroll inicial
  container.scrollTop = viewerState.scrollPos.top;
  container.scrollLeft = viewerState.scrollPos.left;

  return imageForCropper; // Retorna o elemento para ser usado depois
}

export function instanciarCropper(imageElement) {
  if (!imageElement) return;

  const container = document.getElementById('canvasContainer');

  const cropperOptions = {
    viewMode: 0,
    dragMode: 'crop',
    initialAspectRatio: NaN,
    restore: false,
    modal: true,
    guides: true,
    highlight: true,
    background: false,
    autoCrop: false,
    movable: false, // Não mover a imagem
    zoomable: false, // Não dar zoom na imagem
    rotatable: false,
    scalable: false,
    ready: function () {
      console.log('Cropper pronto.');
      // Garante o scroll novamente após o load da lib
      container.scrollTop = viewerState.scrollPos.top;
      container.scrollLeft = viewerState.scrollPos.left;
    },
  };

  setTimeout(() => {
    // Atribui à variável GLOBAL cropper
    viewerState.cropper = new Cropper(imageElement, cropperOptions);
  }, 50);
}

export async function iniciarCropper() {
  // Feedback para o usuário (pois o render 300dpi pode demorar ~500ms)
  customAlert('⏳ Preparando imagem em Alta Definição...', 1000);

  // 1. Prepara o HTML e pega a imagem (Agora é Async)
  const imgElement = await prepararImagemParaCropper();

  // 2. Se deu certo, inicia a biblioteca
  if (imgElement) {
    instanciarCropper(imgElement);
  }
}

import { canvasToBlob } from '../services/image-utils.js';

export async function obterImagemDoCropper() {
  // Verifica se cropper existe (variável global)
  if (typeof viewerState.cropper === 'undefined' || !viewerState.cropper) return null;

  const canvas = viewerState.cropper.getCroppedCanvas();
  if (!canvas) return null;

  try {
    const blob = await canvasToBlob(canvas, 'image/png', 1.0);
    const url = URL.createObjectURL(blob);
    return url; // Retorna URL ("blob:...") que é leve e renderizável
  } catch (error) {
    console.error('Erro ao gerar blob do cropper:', error);
    return null;
  }
}

export async function restaurarVisualizacaoOriginal() {
  // 1. Destrói o Cropper
  if (typeof viewerState.cropper !== 'undefined' && viewerState.cropper) {
    viewerState.cropper.destroy();
    viewerState.cropper = null;
  }

  // 2. Reseta o HTML do container
  const container = document.getElementById('canvasContainer');
  if (container) {
    container.innerHTML = '<canvas id="the-canvas"></canvas>';
  }

  // 3. Renderiza a página original e restaura o scroll
  // (Assumindo que pageNum e scrollPos são globais)
  await renderPage(viewerState.pageNum);

  if (container) {
    container.scrollTop = viewerState.scrollPos.top;
    container.scrollLeft = viewerState.scrollPos.left;
  }
}

export function resetarInterfaceBotoes() {
  // 1. Esconde botões flutuantes
  const floatParams = document.getElementById('floatingActionParams');
  if (floatParams) floatParams.classList.add('hidden');

  // 2. Reseta variável de estado de edição
  window.__capturandoImagemFinal = false;

  // 3. Reseta aparência do botão (de "Editar" para "Confirmar")
  const btnConfirm = document.querySelector(
    '#floatingActionParams .btn--warning'
  );
  const btnSuccess = document.querySelector(
    '#floatingActionParams .flyingBtn:first-child'
  );
  const btn = btnConfirm || btnSuccess;

  if (btn) {
    btn.innerText = '✅ Confirmar Seleção';
    btn.classList.remove('btn--warning');
    btn.classList.add('btn--success');
  }

  // 4. Reativa o botão de tesoura no header
  const btnHeader = document.getElementById('btnRecortarHeader');
  if (btnHeader) {
    btnHeader.style.opacity = '1';
    btnHeader.style.pointerEvents = 'auto';
  }
}

export function cancelarRecorte() {
  // Chama a limpeza lógica
  restaurarVisualizacaoOriginal(); // Não precisa de await se não for bloquear nada depois

  // Chama a limpeza visual
  resetarInterfaceBotoes();
}

export function mudarPagina(dir) {
  if (!viewerState.pdfDoc) return;
  const newPage = viewerState.pageNum + dir;
  if (newPage >= 1 && newPage <= viewerState.pdfDoc.numPages) {
    viewerState.pageNum = newPage;
    renderPage(viewerState.pageNum);
  }
}

export function mudarZoom(delta) {
  const newScale = viewerState.pdfScale + delta;
  if (newScale >= 0.5 && newScale <= 3.0) {
    // Limites de zoom
    viewerState.pdfScale = newScale;
    renderPage(viewerState.pageNum);
  }
}