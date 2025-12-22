// ApiKeyModal.tsx
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Supondo que GlobalAlertsLogic.tsx esteja acessível. Se der erro de TS, crie um alerts.d.ts ou use // @ts-ignore
import { customAlert } from './GlobalAlertsLogic';

// --- Tipagem para funções globais do sistema legado ---
declare global {
  interface Window {
    generatePDFUploadInterface?: () => void;
  }
}

// --- Funções Auxiliares (Lógica Pura) ---

export async function testarChaveReal(key: string): Promise<{ valido: boolean; msg?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { method: 'GET' }
    );
    if (response.ok) return { valido: true };
    const err = await response.json();
    return { valido: false, msg: err.error?.message || 'Erro na API.' };
  } catch (e) {
    return { valido: false, msg: 'Erro de conexão.' };
  }
}

function triggerSystemUpdate() {
  if (typeof window.generatePDFUploadInterface === 'function') {
    window.generatePDFUploadInterface();
  }
}

function mostrarToastSucesso(mensagem: string) {
  const toast = document.createElement('div');
  toast.innerText = mensagem;
  toast.style.cssText =
    'position:fixed; bottom:20px; right:20px; background:var(--color-success); color:white; padding:10px 20px; border-radius:4px; animation:fadeIn 0.5s; z-index:9999;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Funções Públicas (Re-exportadas para manter compatibilidade) ---

export function logicSalvarChave(key: string) {
  sessionStorage.setItem('GOOGLE_GENAI_API_KEY', key);
  mostrarToastSucesso('Chave salva com sucesso!');
  triggerSystemUpdate();
}

export function logicRemoverChave() {
  sessionStorage.removeItem('GOOGLE_GENAI_API_KEY');
  triggerSystemUpdate();
  if (typeof customAlert === 'function') {
    customAlert('Chave removida! O sistema voltará a usar a chave padrão.');
  }
}

// --- Componente React ---

interface ModalProps {
  onClose: () => void;
}

const ApiKeyModalComponent: React.FC<ModalProps> = ({ onClose }) => {
  const [isCustomKey, setIsCustomKey] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Verifica estado inicial
    const currentKey = sessionStorage.getItem('GOOGLE_GENAI_API_KEY');
    setIsCustomKey(!!currentKey);
  }, []);

  const handleRemove = () => {
    logicRemoverChave();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked || isLoading) return;

    const key = inputValue.trim();
    if (key.length < 10) {
      setErrorMsg('A chave parece muito curta.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null); // Limpa erro anterior

    const resultado = await testarChaveReal(key);

    if (resultado.valido) {
      logicSalvarChave(key);
      onClose();
    } else {
      setErrorMsg(`Chave inválida: ${resultado.msg}`);
      setIsLoading(false);
    }
  };

  return (
    <div id="apiKeyModal" className="modal-overlay" style={{ display: 'flex', animation: 'fadeIn 0.3s ease' }}>
      <div className="modal-content api-modal-content">
        {/* Lado Esquerdo: Formulário */}
        <div className="modal-form-col">
          <div className="modal-header" style={{ marginBottom: '20px' }}>
            <div className="icon-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Configuração de Chave</h2>
              <p style={{ margin: '5px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                {isCustomKey ? 'Você está usando sua própria chave.' : 'Uma chave padrão está ativa, mas você pode usar a sua.'}
              </p>
            </div>
          </div>

          <div className="modal-body" style={{ flex: 1 }}>
            {isCustomKey ? (
              // Estado: Chave já salva
              <>
                <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', color: 'var(--color-success-text)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                  <strong>✅ Chave Própria Ativa</strong><br />
                  Sua chave está salva no navegador e sendo usada preferencialmente.
                </div>
                <button onClick={handleRemove} className="btn btn--outline-danger btn--full-width" style={{ marginTop: 'auto' }}>
                  Remover minha chave (Voltar ao Padrão)
                </button>
                <button onClick={onClose} className="btn btn--ghost btn--full-width" style={{ marginTop: '10px' }}>
                  Fechar
                </button>
              </>
            ) : (
              // Estado: Formulário novo
              <>
                <div className="info-box" style={{ marginBottom: '20px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Sua chave será salva <strong>apenas na memória do seu navegador</strong>.</p>
                  <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="link-external" style={{ fontSize: '0.9rem', marginTop: '5px', display: 'inline-block' }}>
                    Gerar chave no Google AI Studio ↗
                  </a>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="apiKeyInput" className="form-label">Cole sua API Key aqui</label>
                    <div className="input-wrapper">
                      <input
                        type="password"
                        className="form-control"
                        placeholder="AIzaSy..."
                        autoComplete="on"
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          setErrorMsg(null); // Limpa erro ao digitar
                        }}
                        style={errorMsg ? { borderColor: 'var(--color-error)' } : {}}
                      />
                    </div>
                    {errorMsg && <span className="error-message">{errorMsg}</span>}
                  </div>

                  <div style={{ background: 'var(--color-bg-2)', border: '1px solid rgba(var(--color-warning-rgb), 0.3)', borderRadius: '8px', padding: '15px', margin: '15px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    <h1 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚠️ Atenção à Segurança
                    </h1>
                    <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
                      <li>Sua chave é salva apenas no <strong>Storage do navegador</strong>.</li>
                      <li>Extensões maliciosas ou scripts de terceiros podem ter acesso a ela.</li>
                      <li>Recomendamos usar uma chave exclusiva para este uso, com limites de cota definidos no Google AI Studio.</li>
                    </ul>
                  </div>

                  <div style={{ margin: '15px 0' }}>
                    <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={termsChecked}
                        onChange={(e) => setTermsChecked(e.target.checked)}
                        style={{ marginTop: '4px' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        Li e compreendo os riscos de armazenar minha chave no navegador (Client-Side). Assumo a responsabilidade pela segurança da minha credencial.
                      </span>
                    </label>
                  </div>

                  <div className="modal-footer" style={{ padding: 0, marginTop: '20px' }}>
                    <button
                      type="submit"
                      className="btn btn--primary btn--full-width"
                      disabled={!termsChecked || isLoading}
                      style={{ opacity: (!termsChecked || isLoading) ? 0.5 : 1, cursor: (!termsChecked || isLoading) ? 'not-allowed' : 'pointer' }}
                    >
                      {isLoading ? 'Verificando...' : 'Verificar e Salvar'}
                    </button>
                    <button type="button" onClick={onClose} className="btn btn--ghost btn--full-width" style={{ marginTop: '10px' }}>
                      Cancelar e usar Padrão
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Lado Direito: Benefícios */}
        <div className="modal-benefits-col">
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '20px' }}>Por que usar sua chave?</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <li style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔒</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text)' }}>Privacidade</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Sua chave fica no seu navegador. Nunca enviamos para servidores de terceiros.</span>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🚀</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text)' }}>Sem Limites</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Aproveite limites maiores de requisições e processamento mais rápido.</span>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text)' }}>Controle Total</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Evite filas compartilhadas e tenha a performance máxima do Gemini.</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// --- Função de Montagem (Exportada para o arquivo JS original usar) ---

export function mountApiKeyModal(forceShow: boolean = true) {
  if (!forceShow) return;

  const rootId = 'react-api-key-modal-root';
  // Remove anterior se existir
  const existing = document.getElementById(rootId);
  if (existing) existing.remove();

  // Cria container
  const container = document.createElement('div');
  container.id = rootId;
  document.body.appendChild(container);

  const root = createRoot(container);

  // Fecha e limpa o DOM
  const handleClose = () => {
    root.unmount();
    container.remove();
  };

  root.render(<ApiKeyModalComponent onClose={handleClose} />);
}