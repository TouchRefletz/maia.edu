import { renderizarQuestaoFinal } from '../render/final/render-questao.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { mostrarPainel } from '../viewer/sidebar.js';
import { cancelarRecorte, obterImagemDoCropper } from './cropper-core.js';
import { renderizarGaleriaModal } from './gallery.js';

// --- CENÁRIO 0: Imagem em Alternativa ---
export function tratarSalvarAlternativa(base64Image) {
  const letra = window.__target_alt_letra;
  const idx = window.__target_alt_index;

  // Garante estrutura
  if (!window.__imagensLimpas.alternativas) {
    window.__imagensLimpas.alternativas = { questao: {}, gabarito: {} };
  }
  if (!window.__imagensLimpas.alternativas.questao[letra]) {
    window.__imagensLimpas.alternativas.questao[letra] = [];
  }

  // Salva
  window.__imagensLimpas.alternativas.questao[letra][idx] = base64Image;

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
export function tratarSalvarPassoGabarito(base64Image) {
  const parts = window.__targetSlotContext.split('_');
  const passoIdx = parseInt(parts[2]);
  const imgIdx = window.__targetSlotIndex;

  if (!window.__imagensLimpas.gabarito_passos)
    window.__imagensLimpas.gabarito_passos = {};
  if (!window.__imagensLimpas.gabarito_passos[passoIdx])
    window.__imagensLimpas.gabarito_passos[passoIdx] = [];

  window.__imagensLimpas.gabarito_passos[passoIdx][imgIdx] = base64Image;

  if (window.__ultimoGabaritoExtraido) {
    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
  }

  customAlert(`Imagem inserida no Passo ${passoIdx + 1}!`, 2000);

  // Limpa Flags
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
}

// --- CENÁRIO 1: Slots de Estrutura (Questão ou Gabarito) ---
export function tratarSalvarSlotEstrutura(base64Image) {
  const ctx = window.__targetSlotContext;
  const idx = window.__targetSlotIndex;

  if (ctx === 'gabarito') {
    window.__imagensLimpas.gabarito_original[idx] = base64Image;
    if (window.__ultimoGabaritoExtraido) {
      renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
    }
  } else {
    window.__imagensLimpas.questao_original[idx] = base64Image;
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
export function tratarSalvarSuporte(base64Image) {
  if (window.modo === 'gabarito') {
    if (!window.__ultimoGabaritoExtraido) window.__ultimoGabaritoExtraido = {};
    if (!window.__ultimoGabaritoExtraido.imagens_suporte)
      window.__ultimoGabaritoExtraido.imagens_suporte = [];

    window.__ultimoGabaritoExtraido.imagens_suporte.push(base64Image);
    window.__imagensLimpas.gabarito_suporte.push(base64Image);

    customAlert('📸 Imagem de suporte adicionada ao GABARITO!', 2000);
    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
  } else {
    if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};
    if (!window.__ultimaQuestaoExtraida.imagens_suporte)
      window.__ultimaQuestaoExtraida.imagens_suporte = [];

    window.__ultimaQuestaoExtraida.imagens_suporte.push(base64Image);
    window.__imagensLimpas.questao_suporte.push(base64Image);

    customAlert('📸 Imagem de suporte adicionada à QUESTÃO!', 2000);
    renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
  }

  // Auto-reopening panel
  mostrarPainel(); // Ou mostrarPainel() se já refatorou

  window.__capturandoImagemFinal = false;
}

export function salvarQuestao() {
  // 1. Obtém a imagem
  const base64Image = obterImagemDoCropper();
  if (!base64Image) return;

  // --- ROTEAMENTO DOS CENÁRIOS ---

  // Cenário 0: Alternativas
  if (
    window.__target_alt_letra !== null &&
    window.__target_alt_index !== null
  ) {
    tratarSalvarAlternativa(base64Image);
    cancelarRecorte();
    return;
  }

  // Cenário: Gabarito Passos
  if (
    window.__targetSlotContext &&
    window.__targetSlotContext.startsWith('gabarito_passo_')
  ) {
    tratarSalvarPassoGabarito(base64Image);
    cancelarRecorte();
    return;
  }

  // Cenário 1: Slots Genéricos
  if (
    window.__targetSlotIndex !== null &&
    window.__targetSlotContext !== null
  ) {
    tratarSalvarSlotEstrutura(base64Image);
    cancelarRecorte();
    return;
  }

  // Cenário 2: Suporte
  if (window.__capturandoImagemFinal === true) {
    tratarSalvarSuporte(base64Image);
    cancelarRecorte();
    return;
  }

  // --- CENÁRIO 3: FLUXO IA (PADRÃO) ---
  window.__recortesAcumulados.push(base64Image);

  cancelarRecorte();

  // Atualiza modal e exibe
  renderizarGaleriaModal();
  document.getElementById('cropConfirmModal').classList.add('visible');
}