import { cancelarRecorte } from '../cropper/cropper-core.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';

export function limparElementosVisuais() {
  // 1. Remove o Modal Final
  const finalModal = document.getElementById('finalModal');
  if (finalModal) finalModal.remove();

  // Remove também o container do modal React (Novo)
  const finalModalReact = document.getElementById('finalModalReactContainer');
  if (finalModalReact) finalModalReact.remove();

  // 2. Limpa a UI da Sidebar (Onde ficava o texto extraído)
  const resultContainer = document.getElementById('extractionResult');
  if (resultContainer) resultContainer.remove();
}

export function resetarVariaveisGlobais() {
  window.__ultimaQuestaoExtraida = null;
  window.questaoAtual = {};
}

export function resetarBuffersImagem() {
  window.__recortesAcumulados = [];
  window.__imagensLimpas = {
    questao_original: [],
    questao_suporte: [],
  };
}

export function gerenciarEstadoInterface() {
  // [FIX] NÃO esconde mais a sidebar após salvar
  // O usuário quer continuar no Hub para processar mais questões
  // A linha abaixo foi removida pois causava a sidebar desaparecer:
  // if (typeof esconderPainel === "function") esconderPainel(false);

  // Cancela modo de recorte
  if (typeof cancelarRecorte === 'function') cancelarRecorte();

  // Feedback para o usuário
  customAlert('✅ Salvo! Pronto para a próxima questão.', 3000);
}

/**
 * Limpa os dados da questão atual para permitir processar a próxima
 * SEM fechar o PDF e SEM recarregar a página.
 */
export function resetarParaProximaQuestao() {
  limparElementosVisuais();
  resetarVariaveisGlobais();
  resetarBuffersImagem();
  gerenciarEstadoInterface();
}
