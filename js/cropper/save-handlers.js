import { renderizarQuestaoFinal } from '../render/final/render-questao.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { mostrarPainel } from '../viewer/sidebar.js';
import { cancelarRecorte, obterImagemDoCropper } from './cropper-core.js';
import { renderizarGaleriaModal } from './gallery.js';

// --- CENÁRIO 0: Imagem em Alternativa ---
// --- CENÁRIO 0: Imagem em Alternativa ---
export function tratarSalvarAlternativa(imgSrc) {
  const letra = window.__target_alt_letra;
  const idx = window.__target_alt_index;

  // Garante estrutura
  if (!window.__imagensLimpas.alternativas) {
    window.__imagensLimpas.alternativas = { questao: {}, gabarito: {} };
  }
  if (!window.__imagensLimpas.alternativas.questao[letra]) {
    window.__imagensLimpas.alternativas.questao[letra] = [];
  }

  // Salva (agora é Blob URL)
  window.__imagensLimpas.alternativas.questao[letra][idx] = imgSrc;

  // Atualiza Render
  const questaoAtiva =
    window.__ultimaQuestaoExtraida || window.ultimaQuestaoExtraida;
  if (questaoAtiva) renderizarQuestaoFinal(questaoAtiva);

  customAlert('Imagem inserida na alternativa ' + letra + '!', 2000);

  // Limpa Flags
  window.__target_alt_letra = null;
  window.__target_alt_index = null;
}

// --- CENÁRIO: Gabarito Passos (Dinâmico) ---
export function tratarSalvarPassoGabarito(imgSrc) {
  const parts = window.__targetSlotContext.split('_');
  const passoIdx = parseInt(parts[2]);
  const imgIdx = window.__targetSlotIndex;

  if (!window.__imagensLimpas.gabarito_passos)
    window.__imagensLimpas.gabarito_passos = {};
  if (!window.__imagensLimpas.gabarito_passos[passoIdx])
    window.__imagensLimpas.gabarito_passos[passoIdx] = [];

  window.__imagensLimpas.gabarito_passos[passoIdx][imgIdx] = imgSrc;

  if (window.__ultimoGabaritoExtraido) {
    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
  }

  customAlert(`Imagem inserida no Passo ${passoIdx + 1}!`, 2000);

  // Limpa Flags
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
}

// --- CENÁRIO 1: Slots de Estrutura (Questão ou Gabarito) ---
export function tratarSalvarSlotEstrutura(imgSrc) {
  const ctx = window.__targetSlotContext;
  const idx = window.__targetSlotIndex;

  if (ctx === 'gabarito') {
    window.__imagensLimpas.gabarito_original[idx] = imgSrc;
    if (window.__ultimoGabaritoExtraido) {
      renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
    }
  } else {
    window.__imagensLimpas.questao_original[idx] = imgSrc;
    if (window.__ultimaQuestaoExtraida) {
      renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
    }
  }

  customAlert('✅ Imagem inserida no espaço selecionado!', 2000);

  // Limpa Flags
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
}

// --- CENÁRIO 2: Imagem de Suporte (Manual) ---
export function tratarSalvarSuporte(imgSrc) {
  if (window.modo === 'gabarito') {
    if (!window.__ultimoGabaritoExtraido) window.__ultimoGabaritoExtraido = {};
    if (!window.__ultimoGabaritoExtraido.imagens_suporte)
      window.__ultimoGabaritoExtraido.imagens_suporte = [];

    window.__ultimoGabaritoExtraido.imagens_suporte.push(imgSrc);
    window.__imagensLimpas.gabarito_suporte.push(imgSrc);

    customAlert('📸 Imagem de suporte adicionada ao GABARITO!', 2000);
    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
  } else {
    if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};
    if (!window.__ultimaQuestaoExtraida.imagens_suporte)
      window.__ultimaQuestaoExtraida.imagens_suporte = [];

    window.__ultimaQuestaoExtraida.imagens_suporte.push(imgSrc);
    window.__imagensLimpas.questao_suporte.push(imgSrc);

    customAlert('📸 Imagem de suporte adicionada à QUESTÃO!', 2000);
    renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
  }

  // Auto-reopening panel
  mostrarPainel(); // Ou mostrarPainel() se já refatorou

  window.__capturandoImagemFinal = false;
}

export async function salvarQuestao() {
  // 1. Obtém a imagem (agora async e retorna blob URL)
  const imgSrc = await obterImagemDoCropper();
  if (!imgSrc) return;

  // --- ROTEAMENTO DOS CENÁRIOS ---

  // Cenário 0: Alternativas
  if (
    window.__target_alt_letra !== null &&
    window.__target_alt_index !== null
  ) {
    tratarSalvarAlternativa(imgSrc);
    cancelarRecorte();
    return;
  }

  // Cenário: Gabarito Passos
  if (
    window.__targetSlotContext &&
    window.__targetSlotContext.startsWith('gabarito_passo_')
  ) {
    tratarSalvarPassoGabarito(imgSrc);
    cancelarRecorte();
    return;
  }

  // Cenário: OCR Field (NOVO)
  if (
    window.__targetSlotContext &&
    window.__targetSlotContext.startsWith('ocr_field_')
  ) {
    const elementId = window.__targetSlotContext.replace('ocr_field_', '');
    import('../services/OcrQueueService.ts').then(({ ocrService }) => {
      ocrService.addToQueue(imgSrc, elementId);
    });

    // Limpa Flags para evitar conflito com próximas capturas
    window.__targetSlotContext = null;
    window.__targetSlotIndex = null;

    cancelarRecorte();
    return;
  }

  // Cenário 1: Slots Genéricos
  if (
    window.__targetSlotIndex !== null &&
    window.__targetSlotContext !== null
  ) {
    tratarSalvarSlotEstrutura(imgSrc);
    cancelarRecorte();
    return;
  }

  // Cenário 2: Suporte
  if (window.__capturandoImagemFinal === true) {
    tratarSalvarSuporte(imgSrc);
    cancelarRecorte();
    return;
  }

  // --- CENÁRIO 3: FLUXO IA (PADRÃO) ---
  window.__recortesAcumulados.push(imgSrc);

  cancelarRecorte();

  // Atualiza modal e exibe
  renderizarGaleriaModal();
  document.getElementById('cropConfirmModal').classList.add('visible');
}