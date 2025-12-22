import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// --- Interfaces ---
interface AlertState {
    message: string;
    visible: boolean;
}

interface ToastState {
    message: string;
    visible: boolean;
    onUndo: (() => void) | null;
}

// --- Variáveis de Controle Externo (Bridge) ---
// Elas permitem que funções fora do componente React controlem o estado dele
let setAlertStateGlobal: ((state: AlertState) => void) | null = null;
let setToastStateGlobal: ((state: ToastState) => void) | null = null;

// Referências para limpar timers antigos (substitui o uiState)
let alertTimerGlobal: ReturnType<typeof setTimeout> | null = null;
let toastTimerGlobal: ReturnType<typeof setTimeout> | null = null;

// --- Componente Principal ---
const AlertsContainer: React.FC = () => {
    // Estado do Custom Alert
    const [alertState, setAlertState] = useState<AlertState>({ message: '', visible: false });

    // Estado do Undo Toast
    const [toastState, setToastState] = useState<ToastState>({ message: '', visible: false, onUndo: null });

    // Conecta os setters do React às variáveis globais do módulo
    useEffect(() => {
        setAlertStateGlobal = setAlertState;
        setToastStateGlobal = setToastState;
    }, []);

    // Lógica de Renderização do Custom Alert
    const renderAlert = () => {
        if (!alertState.message && !alertState.visible) return null;

        return (
            <div
                id="customAlert"
                className={alertState.visible ? 'visible' : ''}
            >
                <div id="alertMessage">{alertState.message}</div>
            </div>
        );
    };

    // Lógica de Renderização do Undo Toast
    const renderToast = () => {
        if (!toastState.visible) return null;

        return (
            <div id="undoToast" className="undo-toast">
                <span className="undo-msg">{toastState.message}</span>
                <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    id="undoBtn"
                    onClick={() => {
                        if (toastState.onUndo) toastState.onUndo();
                        // Fecha o toast imediatamente ao clicar
                        setToastState(prev => ({ ...prev, visible: false }));
                        if (toastTimerGlobal) clearTimeout(toastTimerGlobal);
                    }}
                >
                    Desfazer
                </button>
            </div>
        );
    };

    return (
        <>
            {renderAlert()}
            {renderToast()}
        </>
    );
};

// --- Funções de Inicialização ---

let isMounted = false;

function ensureMounted() {
    if (isMounted) return;

    const rootId = 'react-alerts-root';
    let container = document.getElementById(rootId);

    if (!container) {
        container = document.createElement('div');
        container.id = rootId;
        document.body.appendChild(container);
    }

    const root = createRoot(container);
    root.render(<AlertsContainer />);
    isMounted = true;
}

// --- Funções Públicas (Antigo GlobalAlertsLogic.tsx + Lógica) ---

/**
 * Exibe um alerta personalizado no topo da tela.
 * Substitui a antiga função 'logicShowCustomAlert' e o wrapper do JS.
 * * @param {string} message - A mensagem a ser exibida.
 * @param {number} duration - Duração em ms (padrão 5000 do antigo JS).
 */
export function customAlert(message: string, duration: number = 5000) {
    ensureMounted();

    // Pequeno delay para garantir que o componente montou e vinculou os setters
    setTimeout(() => {
        if (!setAlertStateGlobal) return;

        // 1. Limpa timer anterior
        if (alertTimerGlobal) clearTimeout(alertTimerGlobal);

        // Passo A: Coloca o elemento no DOM (mas invisível/sem a classe)
        setAlertStateGlobal({ message, visible: false });

        // Passo B: Dá um tempinho pro navegador "pintar" o elemento na tela
        setTimeout(() => {
            if (setAlertStateGlobal) {
                // Passo C: Adiciona a classe para ativar a animação CSS
                setAlertStateGlobal({ message, visible: true });
            }
        }, 50);

        // 3. Define função de remoção
        const removeAlert = () => {
            if (setAlertStateGlobal) {
                // Passo 1: Tira a classe 'visible' para iniciar o fade-out visual
                setAlertStateGlobal({ message, visible: false });

                // Passo 2: Remove do DOM após o tempo da animação
                setTimeout(() => {
                    setAlertStateGlobal?.({ message: '', visible: false });
                }, 500);
            }
        };

        // 4. Configura timer de fechamento automático
        if (duration > 0) {
            alertTimerGlobal = setTimeout(removeAlert, duration);
        }

        // Retornamos os métodos de controle (mantendo compatibilidade com o retorno antigo)
        return {
            close: removeAlert,
            update: (newMsg: string) => customAlert(newMsg, duration)
        };
    }, 0);

    // Retorno imediato síncrono para manter compatibilidade com chamadas que esperam o objeto de controle
    return {
        close: () => { 
            if (alertTimerGlobal) clearTimeout(alertTimerGlobal); 
            if (setAlertStateGlobal) setAlertStateGlobal({ message, visible: false }); 
        },
        update: (newMsg: string) => customAlert(newMsg, duration)
    };
}

/**
 * Exibe um toast com botão de desfazer.
 * Substitui a antiga função 'logicShowUndoToast' e o wrapper do JS.
 * * @param {string} message - Mensagem do toast.
 * @param {function} onUndo - Callback ao clicar em Desfazer.
 * @param {number} duration - Duração em ms (padrão 6000 do antigo JS).
 */
export function showUndoToast(message: string, onUndo: () => void, duration: number = 6000) {
    ensureMounted();

    setTimeout(() => {
        if (!setToastStateGlobal) return;

        // 1. Limpa timer anterior
        if (toastTimerGlobal) clearTimeout(toastTimerGlobal);

        // 2. Mostra o toast
        setToastStateGlobal({ message, onUndo, visible: true });

        // 3. Configura timer de fechamento
        toastTimerGlobal = setTimeout(() => {
            if (setToastStateGlobal) {
                setToastStateGlobal({ message: '', onUndo: null, visible: false });
            }
        }, duration);
    }, 0);
}