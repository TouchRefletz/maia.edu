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
    // Nota: Mantemos os IDs originais para garantir que o CSS legado funcione
    const renderAlert = () => {
        if (!alertState.message && !alertState.visible) return null;

        return (
            <div
                id="customAlert"
                className={alertState.visible ? 'visible' : ''}
            // Force reflow logic simulation: React handles DOM updates, but CSS transitions need the class toggle
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

// --- Funções Públicas (Lógica) ---

export function logicShowCustomAlert(message: string, duration: number) {
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
        }, 50); // 50ms é suficiente pro olho humano não perceber o delay, mas o navegador pegar a animação

        // 3. Define função de remoção
        const removeAlert = () => {
            if (setAlertStateGlobal) {
                // Passo 1: Tira a classe 'visible' para iniciar o fade-out visual
                setAlertStateGlobal({ message, visible: false });

                // Passo 2: Remove do DOM após o tempo da animação
                setTimeout(() => {
                    // A CORREÇÃO ESTÁ AQUI:
                    // 1. Use o '?.' antes dos parênteses para corrigir o erro vermelho (Optional Chaining).
                    // 2. Passe message: '' (vazio) para o React remover a DIV do HTML.
                    setAlertStateGlobal?.({ message: '', visible: false });
                }, 500);
            }
        };

        // 4. Configura timer de fechamento automático
        if (duration > 0) {
            alertTimerGlobal = setTimeout(removeAlert, duration);
        }

        // Retornamos os métodos de controle para o arquivo JS
        // (Isso será retornado pelo alerts.js)
        return {
            close: removeAlert,
            // O update chama a função principal recursivamente
            update: (newMsg: string) => logicShowCustomAlert(newMsg, duration)
        };
    }, 0);

    // Retorno imediato síncrono para manter compatibilidade, 
    // embora a ação real ocorra no next tick.
    // Criamos um wrapper "fake" inicial que será substituído ou funcionará.
    return {
        close: () => { if (alertTimerGlobal) clearTimeout(alertTimerGlobal); if (setAlertStateGlobal) setAlertStateGlobal({ message, visible: false }); },
        update: (newMsg: string) => logicShowCustomAlert(newMsg, duration)
    };
}

export function logicShowUndoToast(message: string, onUndo: () => void, duration: number) {
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