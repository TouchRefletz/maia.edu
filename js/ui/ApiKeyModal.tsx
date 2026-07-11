// ApiKeyModal.tsx
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { customAlert } from './GlobalAlertsLogic';

// --- Tipagem para funções globais ---
declare global {
  interface Window {
    generatePDFUploadInterface?: () => void;
  }
}

// --- Testar chave Gemini ---
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

function mostrarToastSucesso(mensagem: string) {
  const toast = document.createElement('div');
  toast.innerText = mensagem;
  toast.style.cssText =
    'position:fixed; bottom:20px; right:20px; background:var(--color-success); color:white; padding:10px 20px; border-radius:4px; animation:fadeIn 0.5s; z-index:9999;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Componente React ---
interface ModalProps {
  onClose: () => void;
}

const ApiKeyModalComponent: React.FC<ModalProps> = ({ onClose }) => {
  const [hasGemini, setHasGemini] = useState(false);
  const [hasGithub, setHasGithub] = useState(false);
  const [hasGroq, setHasGroq] = useState(false);
  const [hasPuter, setHasPuter] = useState(false);
  const [hasVertex, setHasVertex] = useState(false);

  const [geminiInput, setGeminiInput] = useState('');
  const [githubInput, setGithubInput] = useState('');
  const [groqInput, setGroqInput] = useState('');
  const [puterInput, setPuterInput] = useState('');
  
  const [vertexProjectIdInput, setVertexProjectIdInput] = useState('');
  const [vertexLocationInput, setVertexLocationInput] = useState('us-central1');
  const [vertexCredentialsInput, setVertexCredentialsInput] = useState('');

  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [groqError, setGroqError] = useState<string | null>(null);
  const [puterError, setPuterError] = useState<string | null>(null);
  const [vertexError, setVertexError] = useState<string | null>(null);

  const [termsChecked, setTermsChecked] = useState(false);

  useEffect(() => {
    setHasGemini(!!sessionStorage.getItem('GOOGLE_GENAI_API_KEY'));
    setHasGithub(!!sessionStorage.getItem('GITHUB_PAT_KEY'));
    setHasGroq(!!sessionStorage.getItem('GROQ_API_KEY'));
    setHasPuter(!!sessionStorage.getItem('PUTER_API_KEY'));
    setHasVertex(!!sessionStorage.getItem('VERTEX_PROJECT_ID') && !!sessionStorage.getItem('VERTEX_CREDENTIALS'));
  }, []);

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked || isLoadingGemini) return;

    const key = geminiInput.trim();
    if (key.length < 10) {
      setGeminiError('A chave parece muito curta.');
      return;
    }

    setIsLoadingGemini(true);
    setGeminiError(null);

    const resultado = await testarChaveReal(key);

    setIsLoadingGemini(false);
    if (resultado.valido) {
      sessionStorage.setItem('GOOGLE_GENAI_API_KEY', key);
      setHasGemini(true);
      setGeminiInput('');
      mostrarToastSucesso('Chave Gemini salva com sucesso!');
    } else {
      setGeminiError(`Chave inválida: ${resultado.msg}`);
    }
  };

  const handleRemoveGemini = () => {
    sessionStorage.removeItem('GOOGLE_GENAI_API_KEY');
    setHasGemini(false);
    setGeminiInput('');
    customAlert('Chave Gemini removida! O sistema voltará a usar a chave padrão.');
  };

  const handleSaveGithub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked) return;

    const token = githubInput.trim();
    if (token.length < 10) {
      setGithubError('O token do GitHub parece muito curto.');
      return;
    }

    sessionStorage.setItem('GITHUB_PAT_KEY', token);
    setHasGithub(true);
    setGithubInput('');
    setGithubError(null);
    mostrarToastSucesso('Token GitHub/OpenAI salvo com sucesso!');
  };

  const handleRemoveGithub = () => {
    sessionStorage.removeItem('GITHUB_PAT_KEY');
    setHasGithub(false);
    setGithubInput('');
    customAlert('Token GitHub/OpenAI removido! O sistema voltará a usar o token padrão.');
  };

  const handleSaveGroq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked) return;

    const token = groqInput.trim();
    if (token.length < 10) {
      setGroqError('A chave do Groq parece muito curta.');
      return;
    }

    sessionStorage.setItem('GROQ_API_KEY', token);
    setHasGroq(true);
    setGroqInput('');
    setGroqError(null);
    mostrarToastSucesso('Chave Groq salva com sucesso!');
  };

  const handleRemoveGroq = () => {
    sessionStorage.removeItem('GROQ_API_KEY');
    setHasGroq(false);
    setGroqInput('');
    customAlert('Chave Groq removida! O sistema voltará a usar a chave padrão.');
  };

  const handleSavePuter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked) return;

    const key = puterInput.trim();
    if (key.length < 10) {
      setPuterError('A chave do Puter parece muito curta.');
      return;
    }

    sessionStorage.setItem('PUTER_API_KEY', key);
    setHasPuter(true);
    setPuterInput('');
    setPuterError(null);
    mostrarToastSucesso('Chave Puter salva com sucesso!');
  };

  const handleRemovePuter = () => {
    sessionStorage.removeItem('PUTER_API_KEY');
    setHasPuter(false);
    setPuterInput('');
    customAlert('Chave Puter removida! O sistema voltará a usar o fluxo padrão do Puter.');
  };

  const handleSaveVertex = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked) return;

    const projectId = vertexProjectIdInput.trim();
    const location = vertexLocationInput.trim() || 'us-central1';
    const credentials = vertexCredentialsInput.trim();

    if (!projectId) {
      setVertexError('O ID do Projeto GCP é obrigatório.');
      return;
    }
    if (!credentials) {
      setVertexError('As credenciais do JSON da Conta de Serviço são obrigatórias.');
      return;
    }

    try {
      JSON.parse(credentials);
    } catch (err) {
      setVertexError('O JSON da Conta de Serviço parece inválido. Certifique-se de copiar todo o conteúdo do arquivo .json.');
      return;
    }

    sessionStorage.setItem('VERTEX_PROJECT_ID', projectId);
    sessionStorage.setItem('VERTEX_LOCATION', location);
    sessionStorage.setItem('VERTEX_CREDENTIALS', credentials);
    setHasVertex(true);
    setVertexProjectIdInput('');
    setVertexLocationInput('us-central1');
    setVertexCredentialsInput('');
    setVertexError(null);
    mostrarToastSucesso('Configurações do Vertex AI salvas com sucesso!');
  };

  const handleRemoveVertex = () => {
    sessionStorage.removeItem('VERTEX_PROJECT_ID');
    sessionStorage.removeItem('VERTEX_LOCATION');
    sessionStorage.removeItem('VERTEX_CREDENTIALS');
    setHasVertex(false);
    setVertexProjectIdInput('');
    setVertexLocationInput('us-central1');
    setVertexCredentialsInput('');
    customAlert('Configurações do Vertex AI removidas! O sistema voltará a usar o fluxo padrão do Gemini.');
  };

  return (
    <div id="apiKeyModal" className="modal-overlay" style={{ display: 'flex', animation: 'fadeIn 0.3s ease' }}>
      <div className="modal-content api-modal-content" style={{ maxWidth: '820px', width: '95%' }}>
        {/* Lado Esquerdo: Formulários */}
        <div className="modal-form-col" style={{ overflowY: 'auto', maxHeight: '80vh', paddingRight: '8px' }}>
          <div className="modal-header" style={{ marginBottom: '20px' }}>
            <div className="icon-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Chaves de Acesso (Client-Side)</h2>
              <p style={{ margin: '5px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Configure suas chaves de API próprias para evitar limites de cota.
              </p>
            </div>
          </div>

          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Seção 1: Google Gemini */}
            <div style={{ padding: '16px', background: 'var(--color-bg-2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ Google Gemini Key
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Usada para processar modelos da família Google Gemini.
              </p>
              
              {hasGemini ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✅ Chave Ativa e Configurada
                  </div>
                  <button type="button" onClick={handleRemoveGemini} className="btn btn--outline-danger btn--full-width" style={{ padding: '8px' }}>
                    Remover Chave Gemini
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveGemini} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>API Key do Google AI Studio</label>
                      <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                        Obter chave no AI Studio ↗
                      </a>
                    </div>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Cole sua API Key (AIzaSy...)"
                      value={geminiInput}
                      onChange={(e) => {
                        setGeminiInput(e.target.value);
                        setGeminiError(null);
                      }}
                      style={geminiError ? { borderColor: 'var(--color-error)' } : {}}
                    />
                    {geminiError && <span className="error-message" style={{ fontSize: '0.7rem' }}>{geminiError}</span>}
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={!termsChecked || isLoadingGemini} style={{ padding: '8px', opacity: (!termsChecked || isLoadingGemini) ? 0.5 : 1 }}>
                    {isLoadingGemini ? 'Verificando...' : 'Salvar Chave Gemini'}
                  </button>
                </form>
              )}
            </div>

            {/* Seção 2: GitHub PAT (OpenAI Models) */}
            <div style={{ padding: '16px', background: 'var(--color-bg-2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🟢 GitHub Access Token (OpenAI)
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Necessário para rodar os modelos OpenAI (GPT-5, o1, o3-mini) pela GitHub Models API.
              </p>
              
              {hasGithub ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✅ Token Ativo e Configurado
                  </div>
                  <button type="button" onClick={handleRemoveGithub} className="btn btn--outline-danger btn--full-width" style={{ padding: '8px' }}>
                    Remover Token GitHub
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveGithub} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>GitHub Personal Access Token (PAT)</label>
                      <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                        Obter token no GitHub ↗
                      </a>
                    </div>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Cole seu token do GitHub (github_pat_...)"
                      value={githubInput}
                      onChange={(e) => {
                        setGithubInput(e.target.value);
                        setGithubError(null);
                      }}
                      style={githubError ? { borderColor: 'var(--color-error)' } : {}}
                    />
                    {githubError && <span className="error-message" style={{ fontSize: '0.7rem' }}>{githubError}</span>}
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={!termsChecked} style={{ padding: '8px', opacity: !termsChecked ? 0.5 : 1 }}>
                    Salvar Token GitHub
                  </button>
                </form>
              )}
            </div>

            {/* Seção 3: Groq API Key */}
            <div style={{ padding: '16px', background: 'var(--color-bg-2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🟠 Groq API Key
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Necessária para rodar os modelos da Groq (como o GPT-OSS 120B).
              </p>
              
              {hasGroq ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✅ Chave Groq Ativa e Configurada
                  </div>
                  <button type="button" onClick={handleRemoveGroq} className="btn btn--outline-danger btn--full-width" style={{ padding: '8px' }}>
                    Remover Chave Groq
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveGroq} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Groq API Key</label>
                      <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                        Obter chave no Groq Console ↗
                      </a>
                    </div>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Cole sua API Key do Groq (gsk_...)"
                      value={groqInput}
                      onChange={(e) => {
                        setGroqInput(e.target.value);
                        setGroqError(null);
                      }}
                      style={groqError ? { borderColor: 'var(--color-error)' } : {}}
                    />
                    {groqError && <span className="error-message" style={{ fontSize: '0.7rem' }}>{groqError}</span>}
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={!termsChecked} style={{ padding: '8px', opacity: !termsChecked ? 0.5 : 1 }}>
                    Salvar Chave Groq
                  </button>
                </form>
              )}
            </div>

            {/* Seção 4: Puter API Key */}
            <div style={{ padding: '16px', background: 'var(--color-bg-2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💻 Puter API Key
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Necessária para rodar os modelos do Puter (como o Gemini 3.5 Flash) via chamadas estruturadas de API.
              </p>
              
              {hasPuter ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✅ Chave Puter Ativa e Configurada
                  </div>
                  <button type="button" onClick={handleRemovePuter} className="btn btn--outline-danger btn--full-width" style={{ padding: '8px' }}>
                    Remover Chave Puter
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSavePuter} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Puter Auth/API Token</label>
                      <a href="https://puter.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                        Obter token no Dashboard do Puter ↗
                      </a>
                    </div>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Cole sua API/Auth Key do Puter"
                      value={puterInput}
                      onChange={(e) => {
                        setPuterInput(e.target.value);
                        setPuterError(null);
                      }}
                      style={puterError ? { borderColor: 'var(--color-error)' } : {}}
                    />
                    {puterError && <span className="error-message" style={{ fontSize: '0.7rem' }}>{puterError}</span>}
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={!termsChecked} style={{ padding: '8px', opacity: !termsChecked ? 0.5 : 1 }}>
                    Salvar Chave Puter
                  </button>
                </form>
              )}
            </div>

            {/* Seção 5: Google Cloud Vertex AI */}
            <div style={{ padding: '16px', background: 'var(--color-bg-2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ☁️ Google Cloud Vertex AI
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Use sua conta do Google Cloud e credenciais da Vertex AI por meio de uma Conta de Serviço.
              </p>
              
              {/* Alerta de perigo de segurança sugerido */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '4px' }}>🔒 Segurança da Conta de Serviço:</strong>
                <ul style={{ margin: 0, paddingLeft: '14px', textAlign: 'left', lineHeight: 1.4 }}>
                  <li><strong>NUNCA</strong> cole o JSON de uma conta com acesso de Proprietário (Owner) ou Administrador Geral.</li>
                  <li>Crie uma Conta de Serviço limitada e atribua a ela exclusivamente a permissão de <strong>Usuário do Vertex AI (Vertex AI User / `roles/aiplatform.user`)</strong>.</li>
                </ul>
              </div>

              {hasVertex ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✅ Vertex AI Ativo e Configurado
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 'normal', lineHeight: 1.4 }}>
                      <strong>Project ID:</strong> {sessionStorage.getItem('VERTEX_PROJECT_ID')}<br/>
                      <strong>Região:</strong> {sessionStorage.getItem('VERTEX_LOCATION') || 'us-central1'}
                    </div>
                  </div>
                  <button type="button" onClick={handleRemoveVertex} className="btn btn--outline-danger btn--full-width" style={{ padding: '8px' }}>
                    Remover Configurações do Vertex AI
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveVertex} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>GCP Project ID</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: meu-projeto-gcp-123"
                      value={vertexProjectIdInput}
                      onChange={(e) => {
                        setVertexProjectIdInput(e.target.value);
                        setVertexError(null);
                      }}
                      style={vertexError ? { borderColor: 'var(--color-error)' } : {}}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>GCP Region/Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: us-central1"
                      value={vertexLocationInput}
                      onChange={(e) => {
                        setVertexLocationInput(e.target.value);
                        setVertexError(null);
                      }}
                      style={vertexError ? { borderColor: 'var(--color-error)' } : {}}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>JSON da Conta de Serviço</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder='Cole o conteúdo do arquivo .json completo aqui...'
                      value={vertexCredentialsInput}
                      onChange={(e) => {
                        setVertexCredentialsInput(e.target.value);
                        setVertexError(null);
                      }}
                      style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.75rem',
                        ...(vertexError ? { borderColor: 'var(--color-error)' } : {})
                      }}
                    />
                    {vertexError && <span className="error-message" style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>{vertexError}</span>}
                  </div>

                  <button type="submit" className="btn btn--primary" disabled={!termsChecked} style={{ padding: '8px', opacity: !termsChecked ? 0.5 : 1 }}>
                    Salvar Configurações do Vertex AI
                  </button>
                </form>
              )}
            </div>

            {/* Aviso de Segurança Comum */}
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ Segurança das Credenciais
              </h4>
              <ul style={{ margin: 0, paddingLeft: '16px', textAlign: 'left' }}>
                <li>Suas chaves são salvas apenas localmente no <strong>navegador (sessionStorage)</strong>.</li>
                <li>Nenhum dado de credencial é armazenado ou enviado permanentemente aos nossos servidores.</li>
              </ul>
            </div>

            {/* Checkbox de Aceite Termos */}
            <div>
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  style={{ marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Compreendo que as chaves serão salvas na sessão do meu navegador. Assumo a responsabilidade pela segurança destas credenciais.
                </span>
              </label>
            </div>

            {/* Botão de Fechar Geral */}
            <button type="button" onClick={onClose} className="btn btn--ghost btn--full-width" style={{ padding: '10px' }}>
              Fechar Configurações
            </button>
          </div>
        </div>

        {/* Lado Direito: Benefícios */}
        <div className="modal-benefits-col" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>Por que usar sua chave?</h3>
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
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Aproveite limites maiores de requisições e processamento mais rápido de IA.</span>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text)' }}>Performance Máxima</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Evite filas compartilhadas e tenha respostas rápidas no Gemini e OpenAI.</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// --- Função de Montagem ---
export function mountApiKeyModal(forceShow: boolean = true) {
  if (!forceShow) return;

  const rootId = 'react-api-key-modal-root';
  const existing = document.getElementById(rootId);
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = rootId;
  document.body.appendChild(container);

  const root = createRoot(container);

  const handleClose = () => {
    root.unmount();
    container.remove();
  };

  root.render(<ApiKeyModalComponent onClose={handleClose} />);
}