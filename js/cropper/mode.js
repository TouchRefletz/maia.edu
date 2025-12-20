import { viewerState } from '../main.js';
import { renderizarQuestaoFinal } from '../render/final/render-questao.js';
import { esconderPainel } from '../viewer/sidebar.js';
import { iniciarCropper } from './cropper-core.js';

export function ativarModoRecorte() {
  if (viewerState.cropper) return;

  // Auto-hide do painel ao iniciar recorte (Pedido do usuário)
  if (window.innerWidth <= 900) esconderPainel();

  iniciarCropper();

  // Mostra botões flutuantes
  const floatParams = document.getElementById('floatingActionParams');
  if (floatParams) floatParams.classList.remove('hidden');

  // Desativa botão do header para feedback visual
  const btnHeader = document.getElementById('btnRecortarHeader');
  if (btnHeader) {
    btnHeader.style.opacity = '0.5';
    btnHeader.style.pointerEvents = 'none';
  }
}

/**
 * Inicia o modo de recorte especificamente para preencher um slot vazio na estrutura.
 */
export function iniciarCapturaParaSlot(index, contexto) {
  console.log(`Iniciando captura para slot ${index} do contexto ${contexto}`);

  // Define o alvo globalmente
  window.__targetSlotIndex = index;
  window.__targetSlotContext = contexto; // 'questao' ou 'gabarito'

  // Muda visualmente o botão flutuante para o usuário entender o que está fazendo
  ativarModoRecorte();

  const btnConfirm = document.querySelector(
    '#floatingActionParams .btn--success'
  );
  if (btnConfirm) {
    btnConfirm.innerText = '📍 Preencher Espaço';
    btnConfirm.classList.remove('btn--success');
    btnConfirm.classList.add('btn--primary');
  }
}

export function iniciarCapturaImagemQuestao() {
  window.__capturandoImagemFinal = true;
  ativarModoRecorte();

  // Feedback visual no botão flutuante
  const btnConfirm = document.querySelector(
    '#floatingActionParams .btn--success'
  );
  if (btnConfirm) {
    const destino = window.modo === 'gabarito' ? 'Gabarito' : 'Questão';
    btnConfirm.innerText = `💾 Salvar Figura (${destino})`;
    btnConfirm.classList.remove('btn--success');
    btnConfirm.classList.add('btn--warning');
  }
}

// Atualiza a função de clique para funcionar em ambos os modos
export function onClickImagemFinal() {
  // Agora permitimos nos dois modos!
  iniciarCapturaImagemQuestao();
}

export function removerImagemFinal(index, tipo) {
  // Tipo: 'questao' ou 'gabarito'
  if (tipo === 'gabarito') {
    if (window.__ultimoGabaritoExtraido?.imagens_suporte) {
      window.__ultimoGabaritoExtraido.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.gabarito_suporte.splice(index, 1); // Mantém sincronia
      renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
    }
  } else {
    if (window.__ultimaQuestaoExtraida?.imagens_suporte) {
      window.__ultimaQuestaoExtraida.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.questao_suporte.splice(index, 1);
      renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
    }
  }
}