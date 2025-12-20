import { cancelarRecorte } from '../cropper/cropper-core.js';
import { customAlert } from '../ui/alerts.js';
import { trocarModo } from '../viewer/pdf-core.js';
import { esconderPainel } from '../viewer/sidebar.js';

export function limparElementosVisuais() {
  // 1. Remove o Modal Final
  const finalModal = document.getElementById('finalModal');
  if (finalModal) finalModal.remove();

  // 2. Limpa a UI da Sidebar (Onde ficava o texto extraído)
  const resultContainer = document.getElementById('extractionResult');
  if (resultContainer) resultContainer.remove();
}

export function resetarVariaveisGlobais() {
  window.__ultimaQuestaoExtraida = null;
  window.__ultimoGabaritoExtraido = null;
  window.questaoAtual = {};
  window.__isProcessing = false;
  window.__capturandoImagemFinal = false;

  // LIMPEZA DOS NOVOS BACKUPS
  window.__BACKUP_IMGS_Q = null;
  window.__BACKUP_IMGS_G = null;
  window.__BACKUP_IMG_Q = null; // Limpa legado
  window.__BACKUP_IMG_G = null; // Limpa legado
}

export function resetarBuffersImagem() {
  window.__recortesAcumulados = [];
  window.__imagensLimpas = {
    questao_original: [],
    questao_suporte: [],
    gabarito_original: [],
    gabarito_suporte: [],
  };
}

export function gerenciarEstadoInterface() {
  // Recolhe a sidebar (se existir a função)
  if (typeof esconderPainel === 'function') esconderPainel();

  // Cancela modo de recorte
  if (typeof cancelarRecorte === 'function') cancelarRecorte();

  // Feedback para o usuário
  customAlert('✅ Salvo! Pronto para a próxima questão.', 3000);

  // Voltar para a visualização da Prova se estiver no Gabarito
  if (window.__modo === 'gabarito' && typeof trocarModo === 'function') {
    trocarModo('prova');
  }
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