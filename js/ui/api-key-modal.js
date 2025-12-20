import { customAlert } from './alerts.js';

export function gerarHtmlModalApiKey(isCustomKey) {
  // Parte do HTML condicional (com ou sem chave salva)
  const htmlCorpo = isCustomKey
    ? `
            <div style="background:var(--color-success-bg); border:1px solid var(--color-success); color:var(--color-success-text); padding:15px; border-radius:8px; margin-bottom:20px;">
                <strong>✅ Chave Própria Ativa</strong><br>
                Sua chave está salva no navegador e sendo usada preferencialmente.
            </div>
            <button id="removeKeyBtn" class="btn btn--outline-danger btn--full-width" style="margin-top:auto;">
                Remover minha chave (Voltar ao Padrão)
            </button>
            <button onclick="document.getElementById('apiKeyModal').remove()" class="btn btn--ghost btn--full-width" style="margin-top:10px;">
                Fechar
            </button>
          `
    : `
            <div class="info-box" style="margin-bottom:20px;">
                <p style="margin:0; font-size:0.9rem;">Sua chave será salva <strong>apenas na memória do seu navegador</strong>.</p>
                <a href="https://aistudio.google.com/api-keys" target="_blank" class="link-external" style="font-size:0.9rem; margin-top:5px; display:inline-block;">
                    Gerar chave no Google AI Studio ↗
                </a>
            </div>

            <form id="apiKeyForm">
                <div class="form-group">
                    <label for="apiKeyInput" class="form-label">Cole sua API Key aqui</label>
                    <div class="input-wrapper">
                        <input type="password" id="apiKeyInput" name="apiKey" class="form-control" placeholder="AIzaSy..." autocomplete="on">
                    </div>
                    <span id="apiError" class="error-message hidden"></span>
                </div>

                <div style="background:var(--color-bg-2); border:1px solid rgba(var(--color-warning-rgb), 0.3); border-radius:8px; padding:15px; margin:15px 0; font-size:0.85rem; color:var(--color-text-secondary);">
                    <h1 style="margin:0 0 10px 0; font-size:1.2rem; color:var(--color-warning); display:flex; align-items:center; gap:6px;">
                        ⚠️ Atenção à Segurança
                    </h1>
                    <ul style="margin:0; padding-left:20px; text-align:left;">
                        <li>Sua chave é salva apenas no <strong>Storage do navegador</strong>.</li>
                        <li>Extensões maliciosas ou scripts de terceiros podem ter acesso a ela.</li>
                        <li>Recomendamos usar uma chave exclusiva para este uso, com limites de cota definidos no Google AI Studio.</li>
                    </ul>
                </div>

                <div style="margin:15px 0;">
                    <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
                        <input type="checkbox" id="termsCheck" style="margin-top:4px;">
                        <span style="font-size:0.85rem; color:var(--color-text-secondary); line-height:1.4;">
                            Li e compreendo os riscos de armazenar minha chave no navegador (Client-Side). Assumo a responsabilidade pela segurança da minha credencial.
                        </span>
                    </label>
                </div>

                <div class="modal-footer" style="padding:0; margin-top:20px;">
                    <button type="submit" id="saveApiKeyBtn" class="btn btn--primary btn--full-width" disabled style="opacity:0.5; cursor:not-allowed;">
                        Verificar e Salvar
                    </button>
                    <button type="button" onclick="document.getElementById('apiKeyModal').remove()" class="btn btn--ghost btn--full-width" style="margin-top:10px;">
                        Cancelar e usar Padrão
                    </button>
                </div>
            </form>
          `;

  // HTML Completo do Modal
  return `
    <div id="apiKeyModal" class="modal-overlay" style="display:flex; animation: fadeIn 0.3s ease;">
        <div class="modal-content api-modal-content">
            <!-- ESQUERDA: Formulário -->
            <div class="modal-form-col">
                <div class="modal-header" style="margin-bottom:20px;">
                    <div class="icon-wrapper">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                    </div>
                    <div>
                        <h2 style="margin:0; font-size:1.5rem;">Configuração de Chave</h2>
                        <p style="margin:5px 0 0; color:var(--color-text-secondary); font-size:0.9rem;">
                            ${isCustomKey ? 'Você está usando sua própria chave.' : 'Uma chave padrão está ativa, mas você pode usar a sua.'}
                        </p>
                    </div>
                </div>
                <div class="modal-body" style="flex:1;">
                    ${htmlCorpo}
                </div>
            </div>

            <!-- DIREITA: Propaganda / Benefícios -->
            <div class="modal-benefits-col">
                <h3 style="color:var(--color-primary); margin-bottom:20px;">Por que usar sua chave?</h3>
                <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:20px;">
                    <li style="display:flex; gap:10px;">
                        <span style="font-size:1.2rem;">🔒</span>
                        <div>
                            <strong style="display:block; color:var(--color-text);">Privacidade</strong>
                            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Sua chave fica no seu navegador. Nunca enviamos para servidores de terceiros.</span>
                        </div>
                    </li>
                    <li style="display:flex; gap:10px;">
                        <span style="font-size:1.2rem;">🚀</span>
                        <div>
                            <strong style="display:block; color:var(--color-text);">Sem Limites</strong>
                            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aproveite limites maiores de requisições e processamento mais rápido.</span>
                        </div>
                    </li>
                    <li style="display:flex; gap:10px;">
                        <span style="font-size:1.2rem;">⚡</span>
                        <div>
                            <strong style="display:block; color:var(--color-text);">Controle Total</strong>
                            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Evite filas compartilhadas e tenha a performance máxima do Gemini.</span>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>`;
}

export function configurarEventosModalApiKey(modal) {
  // 1. Caso de Remoção
  const btnRemove = document.getElementById('removeKeyBtn');
  if (btnRemove) {
    btnRemove.onclick = () => removerChaveSessao(modal);
    return;
  }

  // 2. Caso de Adição (Formulário)
  const form = document.getElementById('apiKeyForm');
  const checkTerms = document.getElementById('termsCheck');
  const saveBtn = document.getElementById('saveApiKeyBtn');
  const input = document.getElementById('apiKeyInput');
  const errorMsg = document.getElementById('apiError');

  // Listener do Checkbox de Termos
  if (checkTerms && saveBtn) {
    checkTerms.addEventListener('change', () => {
      saveBtn.disabled = !checkTerms.checked;
      saveBtn.style.opacity = checkTerms.checked ? '1' : '0.5';
      saveBtn.style.cursor = checkTerms.checked ? 'pointer' : 'not-allowed';
    });
  }

  // Listener de Submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (saveBtn.disabled) return;

      const key = input.value.trim();
      if (key.length < 10) {
        mostrarErroInput(input, errorMsg, 'A chave parece muito curta.');
        return;
      }

      // Estado de "Carregando"
      const btnOriginalText = saveBtn.innerText;
      saveBtn.innerText = 'Verificando...';
      saveBtn.disabled = true;

      // Teste e Resposta
      const resultado = await testarChaveReal(key);

      if (resultado.valido) {
        salvarChaveSessao(key);
        modal.remove();
      } else {
        mostrarErroInput(input, errorMsg, `Chave inválida: ${resultado.msg}`);
        saveBtn.innerText = btnOriginalText;
        saveBtn.disabled = false;
      }
    });
  }
}

export function generateAPIKeyPopUp(forceShow = true) {
  if (!forceShow) return;

  // Limpeza
  const existing = document.getElementById('apiKeyModal');
  if (existing) existing.remove();

  // Verificação de Estado
  const currentKey = sessionStorage.getItem('GOOGLE_GENAI_API_KEY') || '';
  const isCustomKey = !!currentKey;

  // Renderização
  const htmlModal = gerarHtmlModalApiKey(isCustomKey);
  document.body.insertAdjacentHTML('beforeend', htmlModal);

  // Configuração dos Eventos
  const modal = document.getElementById('apiKeyModal');
  configurarEventosModalApiKey(modal);
}

export async function testarChaveReal(key) {
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

export function salvarChaveSessao(key) {
  sessionStorage.setItem('GOOGLE_GENAI_API_KEY', key);
  mostrarToastSucesso('Chave salva com sucesso!');
  if (typeof generatePDFUploadInterface === 'function')
    generatePDFUploadInterface();
}

export function removerChaveSessao(modalElement) {
  sessionStorage.removeItem('GOOGLE_GENAI_API_KEY');
  modalElement.remove();
  if (typeof generatePDFUploadInterface === 'function')
    generatePDFUploadInterface();
  if (typeof customAlert === 'function')
    customAlert('Chave removida! O sistema voltará a usar a chave padrão.');
}

export function mostrarToastSucesso(mensagem) {
  const toast = document.createElement('div');
  toast.innerText = mensagem;
  toast.style.cssText =
    'position:fixed; bottom:20px; right:20px; background:var(--color-success); color:white; padding:10px 20px; border-radius:4px; animation:fadeIn 0.5s; z-index:9999;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function mostrarErroInput(inputElem, errorMsgElem, msg) {
  errorMsgElem.innerText = msg;
  errorMsgElem.classList.remove('hidden');
  inputElem.style.borderColor = 'var(--color-error)';
}