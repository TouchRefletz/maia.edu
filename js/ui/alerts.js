// alerts.js

import { logicShowCustomAlert, logicShowUndoToast } from './GlobalAlertsLogic.tsx';

/**
 * Exibe um alerta personalizado no topo da tela.
 * Mantém a mesma assinatura e retorno (objeto com close/update).
 * 
 * @param {string} message - A mensagem a ser exibida.
 * @param {number} duration - Duração em ms (padrão 5000).
 */
export function customAlert(message, duration = 5000) {
  // Delegamos para a lógica React
  return logicShowCustomAlert(message, duration);
}

/**
 * Exibe um toast com botão de desfazer.
 * 
 * @param {string} message - Mensagem do toast.
 * @param {function} onUndo - Callback ao clicar em Desfazer.
 * @param {number} duration - Duração em ms (padrão 6000).
 */
export function showUndoToast(message, onUndo, duration = 6000) {
  // Delegamos para a lógica React
  logicShowUndoToast(message, onUndo, duration);
}