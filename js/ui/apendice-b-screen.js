import { get, ref } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { gerarTelaInicial } from '../app/telas.js';
import { criarCardTecnico } from '../banco/card-template.js';
import { renderLatexIn } from '../libs/loader.tsx';
import { auth, db } from '../main.js';
import { openAddQuestionsModal } from './add-questions-modal.js';
import { lerArquivoJson, normalizarJsonApendiceB, verificarSeAdmin } from './admin-panel.js';
import { customAlert } from './GlobalAlertsLogic.tsx';

/**
 * Inicializa a tela dedicada do Apêndice B.
 */
export async function iniciarModoApendiceB() {
  const user = auth.currentUser;

  // Feedback de carregamento
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:var(--color-bg); color:var(--color-text); font-family: system-ui, sans-serif;">
      <div class="admin-spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
      <p style="margin-top:15px; font-weight:500;">Carregando Apêndice B...</p>
    </div>
  `;

  const isAdmin = user ? await verificarSeAdmin(user.uid) : false;

  // Renderiza layout principal com barra de abas integradas (estilo Maia.edu)
  document.body.innerHTML = `
    <div class="admin-layout-wrapper" style="font-family: system-ui, sans-serif; background: var(--color-background); min-height: 100vh; padding: 20px; box-sizing: border-box; color: var(--color-text);">
      <div class="admin-panel" style="max-width: 1100px; margin: 0 auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-lg);">
        
        <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 16px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 1.8rem; display: flex; align-items: center; gap: 10px; color: var(--color-text-shine);">🧪 Apêndice B & Validação</h1>
          <button class="btn btn--sm btn--outline js-voltar-inicio" style="border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 14px; background: none; color: var(--color-text); cursor: pointer;">← Voltar</button>
        </div>

        <!-- Barra de Navegação Interna (Tabs) -->
        <div class="apendice-tabs-nav" style="display: flex; gap: 10px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: 24px;">
          <button id="tabApendiceTriage" class="nav-tab-btn ${isAdmin ? 'active' : ''}" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: ${isAdmin ? 'var(--color-primary)' : 'none'}; color: ${isAdmin ? 'var(--color-btn-primary-text)' : 'var(--color-text-secondary)'}; cursor: pointer; font-weight: bold; transition: all 0.2s; ${isAdmin ? '' : 'display: none;'}">
            🔬 Triagem Individual
          </button>
          <button id="tabApendiceDashboard" class="nav-tab-btn ${isAdmin ? '' : 'active'}" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: ${isAdmin ? 'none' : 'var(--color-primary)'}; color: ${isAdmin ? 'var(--color-text-secondary)' : 'var(--color-btn-primary-text)'}; cursor: pointer; font-weight: bold; transition: all 0.2s;">
            📊 Dashboard de Resultados (TRI vs. IA)
          </button>
        </div>

        <!-- CONTAINER 1: Triagem Individual -->
        <div id="containerApendiceTriage" style="display: ${isAdmin ? 'block' : 'none'};">
          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 16px 0; color: var(--color-text-secondary); font-size: 0.95rem; line-height: 1.5;">
              Selecione uma questão do banco de dados do projeto para avaliar a complexidade usando o modelo de inteligência artificial <strong>Gemma 4 31B IT</strong> de forma fixa.
            </p>
            <button id="btnSelectQuestionApendiceB" class="btn btn--primary" style="background: var(--color-primary); color: var(--color-btn-primary-text); border: none; padding: 12px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              ➕ Selecionar Questão
            </button>
          </div>

          <!-- Conteúdo Principal da Triagem -->
          <div id="apendiceBContentArea" style="display: flex; flex-direction: column; gap: 24px; min-height: 200px;">
            <div style="border: 2px dashed var(--color-border); border-radius: 8px; padding: 40px; text-align: center; color: var(--color-text-secondary);">
              Nenhuma questão selecionada. Clique no botão acima para escolher uma questão.
            </div>
          </div>
        </div>

        <!-- CONTAINER 2: Dashboard de Resultados -->
        <div id="containerApendiceDashboard" style="display: ${isAdmin ? 'none' : 'block'};">
          <div id="dashboardLoader" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px;">
            <div class="admin-spinner" style="width: 32px; height: 32px; border-width: 3px; border-top-color: var(--color-primary);"></div>
            <p style="margin-top: 12px; color: var(--color-text-secondary); font-size: 0.9rem;">Carregando estatísticas de validação...</p>
          </div>
          <div id="dashboardContent" style="display: none; flex-direction: column; gap: 30px;">
             <!-- Injetado dinamicamente via JS -->
          </div>
        </div>

      </div>
    </div>
  `;

  // Setup Listeners das Abas
  const tabTriage = document.getElementById('tabApendiceTriage');
  const tabDashboard = document.getElementById('tabApendiceDashboard');
  const cTriage = document.getElementById('containerApendiceTriage');
  const cDashboard = document.getElementById('containerApendiceDashboard');

  tabTriage?.addEventListener('click', () => {
    tabTriage.style.background = 'var(--color-primary)';
    tabTriage.style.color = 'var(--color-btn-primary-text)';
    tabTriage.classList.add('active');

    tabDashboard.style.background = 'none';
    tabDashboard.style.color = 'var(--color-text-secondary)';
    tabDashboard.classList.remove('active');

    cTriage.style.display = 'block';
    cDashboard.style.display = 'none';
  });

  tabDashboard?.addEventListener('click', () => {
    tabDashboard.style.background = 'var(--color-primary)';
    tabDashboard.style.color = 'var(--color-btn-primary-text)';
    tabDashboard.classList.add('active');

    if (tabTriage) {
      tabTriage.style.background = 'none';
      tabTriage.style.color = 'var(--color-text-secondary)';
      tabTriage.classList.remove('active');
    }

    cTriage.style.display = 'none';
    cDashboard.style.display = 'block';

    carregarDashboardApendiceB();
  });

  // Se o usuário não for admin, carrega o dashboard diretamente
  if (!isAdmin) {
    carregarDashboardApendiceB();
  }

  // Setup Listeners da Triagem
  const btnSelect = document.getElementById('btnSelectQuestionApendiceB');
  btnSelect?.addEventListener('click', () => {
    openAddQuestionsModal();
  });

  const voltarBtn = document.querySelector('.js-voltar-inicio');
  voltarBtn?.addEventListener('click', () => {
    gerarTelaInicial();
  });

  const handleSelectedQuestion = async (e) => {
    const questions = e.detail?.questions;
    if (questions && questions.length > 0) {
      const selected = questions[0];
      await carregarQuestaoApendiceB(selected);
    }
  };

  window.removeEventListener('questions-selected', window._currentApendiceBListener);
  window._currentApendiceBListener = handleSelectedQuestion;
  window.addEventListener('questions-selected', handleSelectedQuestion);
}

// -------------------------------------------------------------
// FUNÇÕES DE TRIAGEM INDIVIDUAL (Existentes)
// -------------------------------------------------------------
async function carregarQuestaoApendiceB(selected) {
  const contentArea = document.getElementById('apendiceBContentArea');
  if (!contentArea) return;

  const { id, prova, fullData } = selected;

  contentArea.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 15px; border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(255,255,255,0.01);">
      <h3 style="margin: 0; font-size: 1.1rem; color: var(--color-text);">Questão Selecionada:</h3>
      <div id="apendiceBQuestionPreviewCard"></div>
    </div>

    <div id="apendiceBConsolePanel" style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 15px;">
      <div style="text-align: center; padding: 20px;">
        <div class="admin-spinner" style="margin: 0 auto 10px auto;"></div>
        Verificando status do experimento no Firebase...
      </div>
    </div>
  `;

  const previewCardContainer = document.getElementById('apendiceBQuestionPreviewCard');
  if (previewCardContainer) {
    if (!fullData.meta) fullData.meta = {};
    if (!fullData.meta.material_origem) {
      fullData.meta.material_origem = prova.replace(/_/g, ' ');
    }
    const card = criarCardTecnico(id, fullData);
    previewCardContainer.appendChild(card);
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(card);
    }
  }

  const consolePanel = document.getElementById('apendiceBConsolePanel');
  try {
    const statusRef = ref(db, `experimentos_apendice_b_status/${prova}/${id}`);
    const statusSnap = await get(statusRef);
    if (statusSnap.exists()) {
      renderApendiceBConcluidoScreen(consolePanel, prova, id, fullData);
    } else {
      renderApendiceBPendenteScreen(consolePanel, prova, id, fullData);
    }
  } catch (err) {
    console.error('Erro ao carregar status do Apêndice B:', err);
    consolePanel.innerHTML = `<div style="color:var(--color-error);">Erro ao carregar status: ${err.message}</div>`;
  }
}

function renderApendiceBPendenteScreen(container, nomeProva, idQuestao, fullData) {
  container.innerHTML = `
    <div style="background: rgba(255, 193, 7, 0.08); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px; color: #ffc107;">
      <span style="font-size: 1.25rem;">⚠️</span>
      <div style="font-size: 0.85rem; font-weight: 500;">
        Esta questão ainda não possui experimento do Apêndice B executado.
      </div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn btn--primary" id="btnRodarApendiceBScreen" style="flex: 1; padding: 12px 20px; font-weight: bold; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 6px; cursor: pointer;">
        🚀 Rodar Apêndice B (Gemma 4 31B IT)
      </button>
      <button class="btn btn--secondary" id="btnImportarJsonPendente" style="flex: 1; padding: 12px 20px; font-weight: bold; background: rgba(255,255,255,0.05); color: var(--color-text); border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
        📂 Importar JSON Existente
      </button>
    </div>
  `;

  container.querySelector('#btnRodarApendiceBScreen').addEventListener('click', () => {
    rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData);
  });

  setupImportarJsonButton(
    container.querySelector('#btnImportarJsonPendente'),
    container,
    nomeProva,
    idQuestao,
    fullData,
  );
}

async function rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData) {
  container.innerHTML = `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; font-family: monospace;">
      <div id="apendiceBStatusText" style="font-size: 0.85rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px;">
        <span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></span>
        <span>Iniciando experimento...</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">💭 Cadeia de Raciocínio (Thoughts)</span>
        <div id="apendiceBThoughts" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; height: 200px; overflow-y: auto; font-size: 0.8rem; white-space: pre-wrap; color: var(--color-text-secondary); line-height: 1.4;"></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.75rem; color: var(--color-success); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">📊 Resposta Estruturada (JSON)</span>
        <pre id="apendiceBResponse" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; margin: 0; height: 200px; overflow-y: auto; font-size: 0.8rem; color: #a9ffaf; line-height: 1.4; white-space: pre-wrap;"></pre>
      </div>
    </div>
  `;

  const statusText = container.querySelector('#apendiceBStatusText span:last-child');
  const thoughtsBox = container.querySelector('#apendiceBThoughts');
  const responseBox = container.querySelector('#apendiceBResponse');

  const handlers = {
    onStatus: (msg) => {
      if (statusText) statusText.textContent = msg;
    },
    onThought: (thought) => {
      if (thoughtsBox) {
        thoughtsBox.textContent += thought;
        thoughtsBox.scrollTop = thoughtsBox.scrollHeight;
      }
    },
    onReset: () => {
      if (thoughtsBox) thoughtsBox.textContent = '';
      if (responseBox) responseBox.textContent = '';
    },
    onAnswerDelta: (delta) => {
      if (responseBox) {
        responseBox.textContent += delta;
        responseBox.scrollTop = responseBox.scrollHeight;
      }
    },
  };

  try {
    const { executarTriageApendiceB } = await import('../chat/apendice-b-pipeline.js');
    const result = await executarTriageApendiceB(
      { id: idQuestao, prova: nomeProva, fullData },
      handlers,
    );

    statusText.parentElement.innerHTML = `✅ Experimento finalizado com sucesso em ${result.latency_sec}s!`;

    const { ref: dbRef, set } = await import(
      'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
    );

    const statusData = {
      status: 'rodado',
      timestamp: result.timestamp,
      pontuacao: result.response_text?.pontuacao_final_complexidade || null,
      classificacao: result.response_text?.classificacao_dificuldade || null,
    };

    await set(dbRef(db, `experimentos_apendice_b_status/${nomeProva}/${idQuestao}`), statusData);
    await set(dbRef(db, `experimentos_apendice_b/${nomeProva}/${idQuestao}`), result);

    window.bancoState = window.bancoState || {};
    window.bancoState.apendiceBStatusMap = window.bancoState.apendiceBStatusMap || {};
    window.bancoState.apendiceBStatusMap[`${nomeProva}/${idQuestao}`] = true;

    const itemKey = `${nomeProva}::${idQuestao}`;
    const itemEl = document.querySelector(`.question-item[data-key="${itemKey}"]`);
    if (itemEl) {
      const badge = itemEl.querySelector('.apendice-b-status-badge');
      if (badge) {
        badge.textContent = '🧪 OK';
        badge.style.background = 'rgba(40, 167, 69, 0.15)';
        badge.style.color = '#28a745';
        badge.style.borderColor = 'rgba(40, 167, 69, 0.3)';
      }

      const checkbox = itemEl.querySelector('.question-checkbox');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    const seen = new WeakSet();
    const safeJson = JSON.stringify(
      result,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2,
    );

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(safeJson);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `maia_debug_apendice_b_${idQuestao}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setTimeout(() => {
      renderApendiceBConcluidoScreen(container, nomeProva, idQuestao, fullData, result);
    }, 1200);
  } catch (error) {
    console.error('Erro no experimento:', error);
    if (statusText) {
      statusText.parentElement.innerHTML = `❌ Erro: ${error.message}`;
    }
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn--primary';
    retryBtn.style.cssText =
      'margin-top: 10px; width: 100%; border: none; border-radius: 6px; padding: 10px; cursor: pointer; background: var(--color-primary); color: white;';
    retryBtn.textContent = '🔄 Tentar Novamente';
    retryBtn.onclick = () =>
      rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData);
    container.appendChild(retryBtn);
  }
}

async function renderApendiceBConcluidoScreen(
  container,
  nomeProva,
  idQuestao,
  fullData,
  cachedResult = null,
) {
  let result = cachedResult;

  if (!result) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="spinner-sm" style="margin: 0 auto 10px auto; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Carregando dados do experimento...
      </div>
    `;

    try {
      const { ref: dbRef, get } = await import(
        'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
      );
      const snap = await get(dbRef(db, `experimentos_apendice_b/${nomeProva}/${idQuestao}`));
      if (snap.exists()) {
        result = snap.val();
      }
    } catch (e) {
      console.error('Erro ao ler dados do Firebase:', e);
    }
  }

  if (!result) {
    container.innerHTML = `
      <div style="background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 12px; color: #dc3545; font-size: 0.85rem;">
        ⚠️ Erro ao carregar dados do experimento no Firebase.
      </div>
      <button class="btn btn--outline" id="btnRetryLoadScreen" style="margin-top: 10px; width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; cursor: pointer; color: var(--color-text);">Tentar Novamente</button>
    `;
    container.querySelector('#btnRetryLoadScreen').onclick = () =>
      renderApendiceBConcluidoScreen(container, nomeProva, idQuestao, fullData);
    return;
  }

  const scoreData = result.response_text || {};
  const criterios = scoreData.criterios || {};

  const critList = [
    { label: 'Enunciado', key: 'complexidade_enunciado' },
    { label: 'Visuais', key: 'elementos_visuais' },
    { label: 'Especificidade', key: 'especificidade_dominio' },
    { label: 'Raciocínio', key: 'raciocinio_complexo' },
    { label: 'Resposta', key: 'resposta_complexa' },
  ];

  const rowsHtml = critList
    .map((c) => {
      const critObj = criterios[c.key] || {};
      const nota = critObj.nota || 0;
      const justificativa = critObj.justificativa || 'Sem justificativa.';
      return `
      <div style="display: flex; flex-direction: column; gap: 4px; padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 0.85rem;">
          <span>${c.label}</span>
          <span style="color: var(--color-primary); font-size: 0.9rem;">${nota}/5</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.3;">
          ${justificativa}
        </div>
      </div>
    `;
    })
    .join('');

  const formattedDate = new Date(result.timestamp).toLocaleString('pt-BR');

  container.innerHTML = `
    <div style="background: rgba(40, 167, 69, 0.08); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px; color: #28a745;">
      <span style="font-size: 1.25rem;">✅</span>
      <div style="font-size: 0.85rem; font-weight: 500;">
        Apêndice B Executado com Sucesso! (${formattedDate})
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin-top: 5px;">
      <div style="flex: 1; background: rgba(var(--color-primary-rgb), 0.05); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); text-transform: uppercase;">Pontuação Total</div>
        <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-primary);">${scoreData.pontuacao_final_complexidade || 0}/25</div>
      </div>
      <div style="flex: 1; background: rgba(var(--color-primary-rgb), 0.05); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); text-transform: uppercase;">Classificação</div>
        <div style="font-size: 1.2rem; font-weight: bold; margin-top: 6px; color: var(--color-text);">${scoreData.classificacao_dificuldade || 'N/A'}</div>
      </div>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
      <span style="font-size: 0.75rem; color: var(--color-text-secondary); font-weight: bold;">Critérios do Apêndice B:</span>
      <div style="display: grid; grid-template-columns: 1fr; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 5px;">
        ${rowsHtml}
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; margin-top: 10px;">
      <button class="btn btn--outline" id="btnDownloadDebugJsonScreen" style="flex: 1; padding: 8px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 6px; background: none; color: var(--color-text); cursor: pointer;">
        📥 Baixar Debug JSON
      </button>
      <button class="btn btn--outline" id="btnImportarNovoJsonApendiceBScreen" style="flex: 1; padding: 8px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 6px; background: none; color: var(--color-text); cursor: pointer;">
        📂 Vincular Outro JSON
      </button>
      <button class="btn btn--secondary btn--outline" id="btnRefazerApendiceBScreen" style="flex: 1; padding: 8px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 6px; background: none; color: var(--color-text); cursor: pointer;">
        🔄 Refazer Triagem
      </button>
    </div>
  `;

  container.querySelector('#btnDownloadDebugJsonScreen').onclick = () => {
    const seen = new WeakSet();
    const safeJson = JSON.stringify(
      result,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2,
    );

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(safeJson);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `maia_debug_apendice_b_${idQuestao}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  setupImportarJsonButton(
    container.querySelector('#btnImportarNovoJsonApendiceBScreen'),
    container,
    nomeProva,
    idQuestao,
    fullData,
  );

  container.querySelector('#btnRefazerApendiceBScreen').onclick = () => {
    rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData);
  };
}

/**
 * Helper para importar arquivo .json do Apêndice B e salvar no Firebase RTDB
 */
function setupImportarJsonButton(button, container, nomeProva, idQuestao, fullData) {
  if (!button) return;
  button.addEventListener('click', () => {
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'file';
    hiddenInput.accept = '.json,application/json';
    hiddenInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const jsonObj = await lerArquivoJson(file);
        const { finalObj, statusData } = normalizarJsonApendiceB(jsonObj);

        const { ref: dbRef, set } = await import(
          'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
        );
        await Promise.all([
          set(dbRef(db, `experimentos_apendice_b_status/${nomeProva}/${idQuestao}`), statusData),
          set(dbRef(db, `experimentos_apendice_b/${nomeProva}/${idQuestao}`), finalObj),
        ]);

        window.bancoState = window.bancoState || {};
        window.bancoState.apendiceBStatusMap = window.bancoState.apendiceBStatusMap || {};
        window.bancoState.apendiceBStatusMap[`${nomeProva}/${idQuestao}`] = true;

        customAlert(`✅ JSON de Apêndice B vinculado com sucesso à questão "${idQuestao}"!`);
        renderApendiceBConcluidoScreen(container, nomeProva, idQuestao, fullData, finalObj);
      } catch (err) {
        console.error('Erro ao importar JSON:', err);
        customAlert(`❌ Falha ao importar JSON: ${err.message}`);
      }
    };
    hiddenInput.click();
  });
}

// -------------------------------------------------------------
// NOVO CONTAINER: DASHBOARD DE RESULTADOS (Interativo com Chart.js)
// -------------------------------------------------------------
let dashboardCarregado = false;

async function carregarDashboardApendiceB() {
  if (dashboardCarregado) return; // Carrega apenas uma vez por inicialização da tela

  const loader = document.getElementById('dashboardLoader');
  const content = document.getElementById('dashboardContent');

  try {
    // 1. Carrega Chart.js de forma assíncrona se não estiver disponível
    await new Promise((resolve, reject) => {
      if (window.Chart) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // 2. Carrega estatísticas compiladas do arquivo JSON
    const response = await fetch('../../experiments/stats_summary.json');
    if (!response.ok) {
      throw new Error(
        `Não foi possível ler as estatísticas de validação (../../experiments/stats_summary.json). Rodou o script Python?`,
      );
    }
    const stats = await response.json();

    // 3. Oculta loader e renderiza esqueleto do Dashboard com escopo 50 Questões (Geral 50, LC, CH). Exatas/Natureza/125 ocultas por padrão.
    loader.style.display = 'none';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--color-border); padding-bottom: 15px; width: 100%; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btnApendiceBTabHumanasLinguagens" class="nav-tab-btn active" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-btn-primary-text); font-size: 0.85rem;">
            📊 Geral (50 Questões)
          </button>
          <button id="btnApendiceBTabLinguagens" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
            📖 Linguagens (LC)
          </button>
          <button id="btnApendiceBTabHumanas" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
            🌍 Humanas (CH)
          </button>
        </div>
        <button id="btn-export-apendice-b-zip" class="btn btn--outline" style="display: inline-flex; align-items: center; gap: 8px; font-weight: bold; border-color: var(--color-primary); color: var(--color-primary); padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; background: rgba(33, 128, 141, 0.1); cursor: pointer; transition: all 0.2s;">
          📦 Baixar Gráficos e Cards (.ZIP)
        </button>
      </div>
      <div id="apendiceBDashboardDataContainer" style="display: flex; flex-direction: column; gap: 20px; width: 100%;"></div>
    `;

    const dataContainer = document.getElementById('apendiceBDashboardDataContainer');
    const btnHumanasLinguagens = document.getElementById('btnApendiceBTabHumanasLinguagens');
    const btnLinguagens = document.getElementById('btnApendiceBTabLinguagens');
    const btnHumanas = document.getElementById('btnApendiceBTabHumanas');

    const tabs = [
      { btn: btnHumanasLinguagens, key: 'humanas_linguagens' },
      { btn: btnLinguagens, key: 'linguagens' },
      { btn: btnHumanas, key: 'humanas' },
    ];

    let currentAreaKey = 'humanas_linguagens';

    function selectTab(activeKey) {
      currentAreaKey = activeKey;
      tabs.forEach((t) => {
        if (t.key === activeKey) {
          t.btn.style.border = '1px solid var(--color-primary)';
          t.btn.style.background = 'var(--color-primary)';
          t.btn.style.color = 'var(--color-btn-primary-text)';
          t.btn.classList.add('active');
        } else {
          t.btn.style.border = '1px solid var(--color-border)';
          t.btn.style.background = 'none';
          t.btn.style.color = 'var(--color-text)';
          t.btn.classList.remove('active');
        }
      });
      renderDashboardUI(
        dataContainer,
        stats[activeKey] || stats['humanas_linguagens'] || stats['consolidado'],
        activeKey,
      );
    }

    btnHumanasLinguagens.addEventListener('click', () => selectTab('humanas_linguagens'));
    btnLinguagens.addEventListener('click', () => selectTab('linguagens'));
    btnHumanas.addEventListener('click', () => selectTab('humanas'));

    const btnZipB = document.getElementById('btn-export-apendice-b-zip');
    if (btnZipB) {
      btnZipB.addEventListener('click', () => {
        exportApendiceBChartsAndCardsZIP(dataContainer, currentAreaKey, activeVariantKey, stats);
      });
    }

    selectTab('humanas_linguagens');
    dashboardCarregado = true;
  } catch (error) {
    console.error('Erro ao iniciar dashboard do Apêndice B:', error);
    loader.innerHTML = `
      <div style="background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 16px; color: var(--color-error); text-align: center; max-width: 500px;">
        <span style="font-size: 1.5rem; display:block; margin-bottom:10px;">⚠️ Falha no Carregamento</span>
        <p style="margin: 0; font-size: 0.85rem; line-height:1.4;">${error.message}</p>
        <button class="btn btn--outline" onclick="window.location.reload()" style="margin-top:15px; border-color: var(--color-border); color: var(--color-text);">Recarregar Página</button>
      </div>
    `;
  }
}

function formatCorr(val) {
  if (val === undefined || val === null || Number.isNaN(val)) return '0.000';
  return (val >= 0 ? '+' : '') + val.toFixed(3);
}

function formatSignedPct(val) {
  if (val === undefined || val === null || Number.isNaN(val)) return '0.0%';
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
}

let activeVariantKey = 'all';

function renderDashboardUI(container, stats, activeKey) {
  const c_glob = stats.comparisons.global;
  const c_pre = stats.comparisons.pre_cutoff;
  const c_post = stats.comparisons.post_cutoff;

  const hasCaseStudies = stats.case_studies && stats.case_studies.length > 0;

  let areaLabel = 'Geral (50 Questões)';
  if (activeKey === 'humanas_linguagens') areaLabel = 'Geral (50 Questões)';
  if (activeKey === 'linguagens') areaLabel = 'Linguagens e Códigos (LC - N=25)';
  if (activeKey === 'humanas') areaLabel = 'Ciências Humanas (CH - N=25)';

  container.innerHTML = `
    <!-- Linha de Navegação por Variante de Métricas -->
    <div style="display: flex; gap: 8px; margin-bottom: 15px; border-bottom: 1px dashed var(--color-border); padding-bottom: 12px; width: 100%; flex-wrap: wrap; align-items: center;">
      <span style="font-size: 0.8rem; font-weight: bold; color: var(--color-text-secondary); margin-right: 4px;">Comparativo:</span>
      <button id="btnVarAll" class="nav-tab-btn ${activeVariantKey === 'all' ? 'active' : ''}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; border: 1px solid ${activeVariantKey === 'all' ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${activeVariantKey === 'all' ? 'var(--color-primary)' : 'none'}; color: ${activeVariantKey === 'all' ? 'var(--color-btn-primary-text)' : 'var(--color-text)'};">
        📊 Visão Geral (Todas)
      </button>
      <button id="btnVarApendiceVsHeuristic" class="nav-tab-btn ${activeVariantKey === 'apendice_vs_heuristic' ? 'active' : ''}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; border: 1px solid ${activeVariantKey === 'apendice_vs_heuristic' ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${activeVariantKey === 'apendice_vs_heuristic' ? 'var(--color-primary)' : 'none'}; color: ${activeVariantKey === 'apendice_vs_heuristic' ? 'var(--color-btn-primary-text)' : 'var(--color-text)'};">
        🤖 Apêndice B x Heurística Firebase
      </button>
      <button id="btnVarHeuristicVsReal" class="nav-tab-btn ${activeVariantKey === 'heuristic_vs_real' ? 'active' : ''}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; border: 1px solid ${activeVariantKey === 'heuristic_vs_real' ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${activeVariantKey === 'heuristic_vs_real' ? 'var(--color-primary)' : 'none'}; color: ${activeVariantKey === 'heuristic_vs_real' ? 'var(--color-btn-primary-text)' : 'var(--color-text)'};">
        📐 Heurística Firebase x Banca
      </button>
      <button id="btnVarApendiceVsReal" class="nav-tab-btn ${activeVariantKey === 'apendice_vs_real' ? 'active' : ''}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; border: 1px solid ${activeVariantKey === 'apendice_vs_real' ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${activeVariantKey === 'apendice_vs_real' ? 'var(--color-primary)' : 'none'}; color: ${activeVariantKey === 'apendice_vs_real' ? 'var(--color-btn-primary-text)' : 'var(--color-text)'};">
        🎯 Apêndice B x Banca
      </button>
    </div>

    <!-- Contêiner do Conteúdo Dinâmico da Variante -->
    <div id="apendiceBVariantBody" style="display: flex; flex-direction: column; gap: 20px;"></div>
  `;

  const btnAll = document.getElementById('btnVarAll');
  const btnAph = document.getElementById('btnVarApendiceVsHeuristic');
  const btnHvr = document.getElementById('btnVarHeuristicVsReal');
  const btnAvr = document.getElementById('btnVarApendiceVsReal');

  const updateVariant = (vKey) => {
    activeVariantKey = vKey;
    renderDashboardUI(container, stats, activeKey);
  };

  btnAll?.addEventListener('click', () => updateVariant('all'));
  btnAph?.addEventListener('click', () => updateVariant('apendice_vs_heuristic'));
  btnHvr?.addEventListener('click', () => updateVariant('heuristic_vs_real'));
  btnAvr?.addEventListener('click', () => updateVariant('apendice_vs_real'));

  const body = document.getElementById('apendiceBVariantBody');
  if (!body) return;

  if (activeVariantKey === 'apendice_vs_heuristic') {
    renderViewApendiceVsHeuristic(body, stats, c_glob, c_pre, c_post, areaLabel);
  } else if (activeVariantKey === 'heuristic_vs_real') {
    renderViewHeuristicVsReal(body, stats, c_glob, c_pre, c_post, areaLabel);
  } else if (activeVariantKey === 'apendice_vs_real') {
    renderViewApendiceVsReal(body, stats, c_glob, c_pre, c_post, areaLabel);
  } else {
    renderViewConsolidada(body, stats, c_glob, c_pre, c_post, hasCaseStudies, areaLabel);
  }
}

function renderMetricTriCard(title, compPre, compPost, compGlob, accentColor) {
  return `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-left: 4px solid ${accentColor}; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-size: 0.8rem; color: ${accentColor}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
        <div style="background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--color-text-secondary); font-weight: bold;">Pré-Cutoff (Histórico)</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: var(--color-text-shine);">${formatCorr(compPre?.spearman)}</div>
          <div style="font-size: 0.7rem; color: var(--color-text-secondary);">MAE: ${compPre?.mae ? compPre.mae.toFixed(1) + '%' : 'N/A'} | Bias: ${formatSignedPct(compPre?.bias)}</div>
        </div>
        <div style="background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--color-text-secondary); font-weight: bold;">Pós-Cutoff (Inédito 2025)</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: var(--color-text-shine);">${formatCorr(compPost?.spearman)}</div>
          <div style="font-size: 0.7rem; color: var(--color-text-secondary);">MAE: ${compPost?.mae ? compPost.mae.toFixed(1) + '%' : 'N/A'} | Bias: ${formatSignedPct(compPost?.bias)}</div>
        </div>
        <div style="background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--color-text-secondary); font-weight: bold;">Global (Consolidado)</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: var(--color-text-shine);">${formatCorr(compGlob?.spearman)}</div>
          <div style="font-size: 0.7rem; color: var(--color-text-secondary);">MAE: ${compGlob?.mae ? compGlob.mae.toFixed(1) + '%' : 'N/A'} | Bias: ${formatSignedPct(compGlob?.bias)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderViewApendiceVsHeuristic(container, stats, c_glob, c_pre, c_post, areaLabel) {
  container.innerHTML = `
    ${renderMetricTriCard('Variante 1: Apêndice B x Heurística Firebase (Consistência Interna IA vs Algoritmo)', c_pre.apendice_vs_heuristic, c_post.apendice_vs_heuristic, c_glob.apendice_vs_heuristic, 'var(--color-info)')}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Correlação de Spearman das Dimensões do Apêndice B vs. Heurística Firebase (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartVarApendiceHeuristic"></canvas>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Pontuação Média (%) por Faixa TRI: Apêndice B vs. Heurística Firebase (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartVarFaixasHeuristic"></canvas>
        </div>
      </div>
    </div>

    <div style="background: rgba(33, 128, 141, 0.04); border: 1px solid rgba(33, 128, 141, 0.2); border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--color-primary);">💡 Conclusão da Variante 1</h4>
      <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.5;">
        A forte consistência entre o Apêndice B (Gemma 4 31B) e a Heurística determinística do Firebase (Spearman <strong>${formatCorr(c_glob.apendice_vs_heuristic.spearman)}</strong> no global, <strong>${formatCorr(c_pre.apendice_vs_heuristic.spearman)}</strong> pré-cutoff e <strong>${formatCorr(c_post.apendice_vs_heuristic.spearman)}</strong> pós-cutoff) comprova que o julgamento do modelo LLM segue de forma estável o arcabouço lógico das regras do Firebase.
      </p>
    </div>
  `;

  setTimeout(() => {
    const ctx1 = document.getElementById('chartVarApendiceHeuristic')?.getContext('2d');
    if (ctx1) {
      if (window.apendiceVar1Chart) window.apendiceVar1Chart.destroy();
      const dims = [
        'ap_enunciado',
        'ap_visual',
        'ap_dominio',
        'ap_raciocinio',
        'ap_resposta',
        'ap_total_normalized',
      ];
      const labels = [
        'Enunciado',
        'Visual',
        'Domínio',
        'Raciocínio',
        'Resposta',
        'Nota Global Apêndice B',
      ];
      window.apendiceVar1Chart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Pré-Cutoff (Histórico)',
              data: dims.map((d) => stats.correlations[d]?.pre_cutoff?.spearman || 0),
              backgroundColor: '#626871',
              borderRadius: 4,
            },
            {
              label: 'Pós-Cutoff (Inédito 2025)',
              data: dims.map((d) => stats.correlations[d]?.post_cutoff?.spearman || 0),
              backgroundColor: '#c0152f',
              borderRadius: 4,
            },
            {
              label: 'Global (Consolidado)',
              data: dims.map((d) => stats.correlations[d]?.global?.spearman || 0),
              backgroundColor: '#32b8c6',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: -1.0, max: 1.0, ticks: { stepSize: 0.2 } },
            x: { ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    const ctx2 = document.getElementById('chartVarFaixasHeuristic')?.getContext('2d');
    if (ctx2) {
      if (window.apendiceVar1FaixasChart) window.apendiceVar1FaixasChart.destroy();
      window.apendiceVar1FaixasChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: stats.faixas_stats.map((f) => f.faixa),
          datasets: [
            {
              label: 'Apêndice B / Gemma 4 (%)',
              data: stats.faixas_stats.map((f) => f.ap_total_normalized),
              backgroundColor: '#c0152f',
              borderRadius: 4,
            },
            {
              label: 'Heurística Firebase (%)',
              data: stats.faixas_stats.map((f) => f.ai_complexity_heuristic),
              backgroundColor: '#21808d',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100 } },
        },
      });
    }
  }, 50);
}

function renderViewHeuristicVsReal(container, stats, c_glob, c_pre, c_post, areaLabel) {
  container.innerHTML = `
    ${renderMetricTriCard('Variante 2: Heurística Firebase x Banca (Dificuldade Real TRI)', c_pre.heuristic_vs_real, c_post.heuristic_vs_real, c_glob.heuristic_vs_real, 'var(--color-primary)')}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Heurística Firebase: Correlação Spearman com a Banca TRI (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartVarHeuristicReal"></canvas>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Complexidade Heurística vs. Dificuldade Real da Banca por Faixa TRI (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartVarHeuristicError"></canvas>
        </div>
      </div>
    </div>

    <div style="background: rgba(249, 115, 22, 0.04); border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: #f97316;">💡 Conclusão da Variante 2</h4>
      <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.5;">
        A Heurística determinística do Firebase correlaciona com a banca no set pré-cutoff (<strong>${formatCorr(c_pre.heuristic_vs_real.spearman)}</strong>), porém sofre forte degradação em exames inéditos (<strong>${formatCorr(c_post.heuristic_vs_real.spearman)}</strong>) e mantém um desvio médio constante (MAE <strong>${c_glob.heuristic_vs_real.mae.toFixed(1)}%</strong>), pois estima a dificuldade priorizando características estruturais do texto.
      </p>
    </div>
  `;

  setTimeout(() => {
    const ctx1 = document.getElementById('chartVarHeuristicReal')?.getContext('2d');
    if (ctx1) {
      if (window.apendiceVar2Chart) window.apendiceVar2Chart.destroy();
      window.apendiceVar2Chart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: ['Pré-Cutoff (Histórico)', 'Pós-Cutoff (Inédito 2025)', 'Global (Consolidado)'],
          datasets: [
            {
              label: 'Correlação de Spearman (ρ)',
              data: [
                c_pre.heuristic_vs_real.spearman,
                c_post.heuristic_vs_real.spearman,
                c_glob.heuristic_vs_real.spearman,
              ],
              backgroundColor: ['#626871', '#c0152f', '#32b8c6'],
              borderRadius: 4,
              barThickness: 40,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: -1.0, max: 1.0, ticks: { stepSize: 0.2 } },
            x: { ticks: { font: { size: 10, weight: 'bold' } } },
          },
        },
      });
    }

    const ctx2 = document.getElementById('chartVarHeuristicError')?.getContext('2d');
    if (ctx2) {
      if (window.apendiceVar2ErrChart) window.apendiceVar2ErrChart.destroy();
      window.apendiceVar2ErrChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: stats.faixas_stats.map((f) => f.faixa),
          datasets: [
            {
              label: 'Heurística Firebase (%)',
              data: stats.faixas_stats.map((f) => f.ai_complexity_heuristic),
              backgroundColor: '#21808d',
              borderRadius: 4,
            },
            {
              label: 'Dificuldade Real (Banca TRI %)',
              data: stats.faixas_stats.map((f) => f.real_difficulty_mean || 50),
              backgroundColor: '#a75df4',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100 } },
        },
      });
    }
  }, 50);
}

function renderViewApendiceVsReal(container, stats, c_glob, c_pre, c_post, areaLabel) {
  container.innerHTML = `
    ${renderMetricTriCard('Variante 3: Apêndice B x Banca (Dificuldade Real TRI)', c_pre.apendice_vs_real, c_post.apendice_vs_real, c_glob.apendice_vs_real, 'var(--color-error)')}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Correlação por Dimensão do Apêndice B vs. Banca TRI (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartVarApendiceReal"></canvas>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Pontuação Média (%) por Faixa TRI: Apêndice B vs. Banca Real TRI (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartVarCutoffDegradation"></canvas>
        </div>
      </div>
    </div>

    <div style="background: rgba(192, 21, 47, 0.04); border: 1px solid rgba(192, 21, 47, 0.2); border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--color-error);">💡 Conclusão Científica da Variante 3</h4>
      <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.5;">
        O declínio nítido da correlação no set pós-cutoff (ENEM 2025: <strong>${formatCorr(c_post.apendice_vs_real.spearman)}</strong> vs. Pré-cutoff: <strong>${formatCorr(c_pre.apendice_vs_real.spearman)}</strong>) demonstra empiricamente a contaminação de dados nos modelos LLM puros em exames conhecidos, validando a necessidade da arquitetura RAG e gabaritos verificados do ecossistema <strong>Maia.edu</strong>.
      </p>
    </div>
  `;

  setTimeout(() => {
    const ctx1 = document.getElementById('chartVarApendiceReal')?.getContext('2d');
    if (ctx1) {
      if (window.apendiceVar3Chart) window.apendiceVar3Chart.destroy();
      const dims = [
        'ap_enunciado',
        'ap_visual',
        'ap_dominio',
        'ap_raciocinio',
        'ap_resposta',
        'ap_total_normalized',
      ];
      const labels = [
        'Enunciado',
        'Visual',
        'Domínio',
        'Raciocínio',
        'Resposta',
        'Nota Global Apêndice B',
      ];
      window.apendiceVar3Chart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Pré-Cutoff (Histórico)',
              data: dims.map((d) => stats.correlations[d]?.pre_cutoff?.spearman || 0),
              backgroundColor: '#626871',
              borderRadius: 4,
            },
            {
              label: 'Pós-Cutoff (Inédito 2025)',
              data: dims.map((d) => stats.correlations[d]?.post_cutoff?.spearman || 0),
              backgroundColor: '#c0152f',
              borderRadius: 4,
            },
            {
              label: 'Global (Consolidado)',
              data: dims.map((d) => stats.correlations[d]?.global?.spearman || 0),
              backgroundColor: '#32b8c6',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: -1.0, max: 1.0, ticks: { stepSize: 0.2 } },
            x: { ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    const ctx2 = document.getElementById('chartVarCutoffDegradation')?.getContext('2d');
    if (ctx2) {
      if (window.apendiceVar3CutoffChart) window.apendiceVar3CutoffChart.destroy();
      window.apendiceVar3CutoffChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: stats.faixas_stats.map((f) => f.faixa),
          datasets: [
            {
              label: 'Apêndice B / Gemma 4 (%)',
              data: stats.faixas_stats.map((f) => f.ap_total_normalized),
              backgroundColor: '#c0152f',
              borderRadius: 4,
            },
            {
              label: 'Dificuldade Real (Banca TRI %)',
              data: stats.faixas_stats.map((f) => f.real_difficulty_mean || 50),
              backgroundColor: '#a75df4',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100 } },
        },
      });
    }
  }, 50);
}

function renderViewConsolidada(container, stats, c_glob, c_pre, c_post, hasCaseStudies, areaLabel) {
  container.innerHTML = `
    <!-- Linha 1: Cards Rápidos com Pré, Pós e Global em Todos os 3 Pares -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 15px;">
      ${renderMetricTriCard('Comparação 1: Heurística Firebase x Banca', c_pre.heuristic_vs_real, c_post.heuristic_vs_real, c_glob.heuristic_vs_real, 'var(--color-primary)')}
      ${renderMetricTriCard('Comparação 2: Apêndice B x Banca', c_pre.apendice_vs_real, c_post.apendice_vs_real, c_glob.apendice_vs_real, 'var(--color-error)')}
      ${renderMetricTriCard('Comparação 3: Apêndice B x Heurística Firebase', c_pre.apendice_vs_heuristic, c_post.apendice_vs_heuristic, c_glob.apendice_vs_heuristic, 'var(--color-info)')}
    </div>

    <!-- Linha 2: Área dos Gráficos com Orientação Vertical Limpa -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Correlação com a Banca TRI: Apêndice B vs. Heurística Firebase (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartCorrelacaoCanvas"></canvas>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Complexidade Média: Heurística Firebase vs. Apêndice B vs. Banca TRI (${areaLabel})</h4>
        <div style="height: 320px; position: relative;">
          <canvas id="chartFaixasCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- Linha 3: Estudos de Caso com Citação do Firebase -->
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: ${hasCaseStudies ? 'flex' : 'none'}; flex-direction:column; gap:12px;">
      <h3 style="margin:0; font-size:1.1rem; color:var(--color-text-shine);">🔍 Análise Qualitativa das Questões Pós-Cutoff (${areaLabel})</h3>
      <div style="display:flex; flex-direction:column; gap:10px;" id="dashboardCaseStudiesList"></div>
    </div>

    <!-- Linha 4: Conclusão Geral da Pesquisa -->
    <div style="background: rgba(40, 167, 69, 0.04); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
      <h3 style="margin: 0; font-size: 1.15rem; color: #28a745; line-height: 1.4;">
        📌 Conclusão da Análise do Apêndice B (${stats.n_total} Questões)
      </h3>
      <p style="margin: 0; font-size: 0.8rem; color: var(--color-text); line-height: 1.5;">
        A investigação experimental sobre as <strong>${stats.n_total} questões</strong> do escopo (${areaLabel}) consolida três conclusões fundamentais para a pesquisa do ecossistema <strong>Maia.edu</strong>:
      </p>
      <ol style="margin: 0; padding-left: 20px; font-size: 0.78rem; color: var(--color-text-secondary); line-height: 1.5;">
        <li style="margin-bottom: 6px;">
          <strong>Vulnerabilidade de Modelos Puros à Contaminação de Dados:</strong> O declínio das correlações no set pós-cutoff (ENEM 2025) evidencia que IAs sem RAG dependem da memorização de exames passados presentes em sua base de pré-treinamento.
        </li>
        <li style="margin-bottom: 6px;">
          <strong>Subestimação da Barreira Cognitiva Humana:</strong> Nas áreas analisadas, a IA subestima questões de alta taxa de erro humano (TRI &gt; 80%), avaliando a complexidade majoritariamente pela extensão do enunciado.
        </li>
        <li>
          <strong>Validação da Arquitetura Maia.edu:</strong> A variação dos modelos em contextos inéditos valida cientificamente a necessidade de RAG vetorial ancorado no Pinecone, injeção de gabaritos verificados e tutoria socrática guiada.
        </li>
      </ol>
    </div>
  `;

  setTimeout(() => {
    const ctxCorr = document.getElementById('chartCorrelacaoCanvas')?.getContext('2d');
    if (ctxCorr) {
      if (window.apendiceBCorrChart) window.apendiceBCorrChart.destroy();
      const metricsKeys = [
        'ap_enunciado',
        'ap_visual',
        'ap_dominio',
        'ap_raciocinio',
        'ap_resposta',
        'ap_total_normalized',
        'ai_complexity_heuristic',
      ];
      const metricsLabels = [
        'Enunciado',
        'Visual',
        'Domínio',
        'Raciocínio',
        'Resposta',
        'Total Apêndice B',
        'Heurística Firebase',
      ];
      window.apendiceBCorrChart = new Chart(ctxCorr, {
        type: 'bar',
        data: {
          labels: metricsLabels,
          datasets: [
            {
              label: `Pré-cutoff (Histórico, N=${stats.n_pre_cutoff})`,
              data: metricsKeys.map((key) => stats.correlations[key]?.pre_cutoff?.spearman || 0),
              backgroundColor: '#626871',
              borderRadius: 4,
            },
            {
              label: `Pós-cutoff (Inédito, N=${stats.n_post_cutoff})`,
              data: metricsKeys.map((key) => stats.correlations[key]?.post_cutoff?.spearman || 0),
              backgroundColor: '#c0152f',
              borderRadius: 4,
            },
            {
              label: `Global (Consolidado, N=${stats.n_total})`,
              data: metricsKeys.map((key) => stats.correlations[key]?.global?.spearman || 0),
              backgroundColor: '#32b8c6',
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { min: -1.0, max: 1.0, ticks: { stepSize: 0.2 } },
            y: { ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    const ctxFaixas = document.getElementById('chartFaixasCanvas')?.getContext('2d');
    if (ctxFaixas) {
      if (window.apendiceBFaixasChart) window.apendiceBFaixasChart.destroy();
      window.apendiceBFaixasChart = new Chart(ctxFaixas, {
        type: 'bar',
        data: {
          labels: stats.faixas_stats.map((f) => f.faixa),
          datasets: [
            {
              label: 'Heurística Firebase (%)',
              data: stats.faixas_stats.map((f) => f.ai_complexity_heuristic),
              backgroundColor: '#21808d',
              borderRadius: 4,
            },
            {
              label: 'Apêndice B / Gemma 4 (%)',
              data: stats.faixas_stats.map((f) => f.ap_total_normalized),
              backgroundColor: '#c0152f',
              borderRadius: 4,
            },
            {
              label: 'Dificuldade Real (Banca TRI %)',
              data: stats.faixas_stats.map((f) => f.real_difficulty_mean || 50),
              backgroundColor: '#a75df4',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100 } },
        },
      });
    }

    function getPedagogicalAnalysis(item, heurVal) {
      const realVal = item.real_difficulty.toFixed(1);
      const gemmaVal = item.ap_total_normalized.toFixed(1);
      const firebaseVal = heurVal.toFixed(1);

      let commentary = '';
      switch (item.id) {
        case 'ENEM2025_LC_23':
          commentary = `O Gemma 4 (${gemmaVal}%) aproximou-se mais da alta dificuldade da banca (${realVal}%) do que a Heurística Firebase (${firebaseVal}%), pois identificou a densidade dos Elementos Visuais (${item.ap_visual}/5) e do Domínio (${item.ap_dominio}/5), enquanto a Heurística Firebase subestimou a questão por focar apenas no tamanho do texto de apoio.`;
          break;
        case 'ENEM2025_LC_13':
          commentary = `Com ${realVal}% de erro na banca (Muito Difícil), tanto o Gemma 4 (${gemmaVal}%) quanto a Heurística Firebase (${firebaseVal}%) subestimaram severamente a questão, tratando o emprego da norma-padrão como um fato gramatical escolar mecânico e ignorando a carga de distração dos distratores jurídicos.`;
          break;
        case 'ENEM2025_LC_39':
          commentary = `Ambos os modelos subestimaram o item (${gemmaVal}% Gemma 4 e ${firebaseVal}% Firebase vs ${realVal}% TRI Real) por assumirem que a síntese de tema principal em texto curto é direta, desconsiderando a presença de distratores semânticos quase idênticos.`;
          break;
        case 'ENEM2025_LC_26':
          commentary = `A Heurística Firebase (${firebaseVal}%) aproximou-se mais da facilidade empírica da banca (${realVal}%) ao ponderar o enunciado curto, enquanto o Gemma 4 (${gemmaVal}%) superestimou a complexidade ao classificar a "variação sociolinguística" como um domínio conceitual denso.`;
          break;
        case 'ENEM2025_CH_59':
          commentary = `A Heurística Firebase (${firebaseVal}%) registrou maior complexidade estrutural que o Gemma 4 (${gemmaVal}%), porém ambos subestimaram o erro real da banca (${realVal}%), pois relacionar o desmatamento ao regime de chuvas em escala continental exige abstração geográfica multiescala.`;
          break;
        case 'ENEM2025_CH_54':
          commentary = `A Heurística Firebase (${firebaseVal}%) cravou com precisão quase exata a dificuldade real da banca (${realVal}%), reconhecendo os termos demográficos formais do enunciado. Em contrapartida, o Gemma 4 (${gemmaVal}%) subestimou o item em cerca de 30%, pontuando o raciocínio apenas como moderado (3/5).`;
          break;
        case 'ENEM2025_CH_61':
          commentary = `A Heurística Firebase (${firebaseVal}%) chegou mais perto do nível de dificuldade média da banca (${realVal}%) do que o Gemma 4 (${gemmaVal}%), que tratou a classificação das formas de governo em Aristóteles como simples memorização direta.`;
          break;
        case 'ENEM2025_CN_119':
          commentary = `Tanto o Gemma 4 (${gemmaVal}%) quanto a Heurística Firebase (${firebaseVal}%) subestimaram fortemente o item em relação ao erro real (${realVal}%), pois não previram que os candidatos confundiriam a basicidade orgânica das aminas com compostos de pH ácido.`;
          break;
        case 'ENEM2025_CN_98':
          commentary = `Ambos os modelos previram a mesma complexidade baixa (20.0%), subestimando a dificuldade real da banca (${realVal}%) por reduzirem o circuito elétrico a um cálculo de resistência, desconsiderando a análise condicional das chaves.`;
          break;
        case 'ENEM2025_CN_95':
          commentary = `A Heurística Firebase (${firebaseVal}%) aproximou-se mais da dificuldade real da banca (${realVal}%) do que o Gemma 4 (${gemmaVal}%), que considerou a interpretação do heredograma uma leitura observacional simples.`;
          break;
        case 'ENEM2025_CN_100':
          commentary = `A Heurística Firebase (${firebaseVal}%) cravou a estimativa real da banca (${realVal}%) ao computar a estrutura da tabela e as variáveis térmicas, enquanto o Gemma 4 (${gemmaVal}%) subestimou severamente o item devido à simplicidade gramatical do texto.`;
          break;
        case 'ENEM2025_CN_96':
          commentary = `A Heurística Firebase (${firebaseVal}%) e o Gemma 4 (${gemmaVal}%) alinharam-se com precisão à faixa fácil da banca (${realVal}%), identificando a fotólise da água como um conceito direto de sala de aula.`;
          break;
        case 'ENEM2025_CN_94':
          commentary = `Excelente convergência entre Gemma 4 (${gemmaVal}%), Heurística Firebase (${firebaseVal}%) e a taxa de acerto empírica dos candidatos na banca (${realVal}% de erro) para ecologia e espécies invasoras.`;
          break;
        case 'ENEM2025_MT_168':
          commentary = `O Gemma 4 (${gemmaVal}%) aproximou-se melhor da dificuldade da banca (${realVal}%) ao pontuar 4/5 na dimensão de Raciocínio, superando a Heurística Firebase (${firebaseVal}%), que avaliou a geometria tridimensional apenas como um texto curto com números.`;
          break;
        case 'ENEM2025_MT_140':
          commentary = `Ambos os modelos (${gemmaVal}% Gemma 4 e ${firebaseVal}% Firebase) subestimaram a dificuldade real da banca (${realVal}%), tratando o cálculo de tabela como uma regra de três simples e ignorando a distração por variação de porções.`;
          break;
        case 'ENEM2025_MT_170':
          commentary = `A Heurística Firebase (${firebaseVal}%) ficou mais próxima da dificuldade real (${realVal}%) do que o Gemma 4 (${gemmaVal}%), que deu pontuação quase nula ao assumir que problemas de permutação são simples substituições de fórmula.`;
          break;
        case 'ENEM2025_MT_155':
          commentary = `Ótimo alinhamento entre o Gemma 4 (${gemmaVal}%), a Heurística Firebase (${firebaseVal}%) e a dificuldade mediana da banca (${realVal}%) no mapeamento do vértice da função quadrática.`;
          break;
        case 'ENEM2025_MT_153':
          commentary = `A Heurística Firebase (${firebaseVal}%) aproximou-se com alta acurácia do valor real da banca (${realVal}%), capturando a tabela de frequências acumuladas, enquanto o Gemma 4 (${gemmaVal}%) subestimou o item.`;
          break;
        case 'ENEM2025_MT_142':
          commentary = `O Gemma 4 (${gemmaVal}%) aproximou-se melhor do valor real fácil da banca (${realVal}%) do que a Heurística Firebase (${firebaseVal}%), na aplicação direta da razão de escala linear 1:N.`;
          break;
        case 'FUVEST2026_Q36':
          commentary = `O Gemma 4 (${gemmaVal}%) capturou a alta complexidade da FUVEST (${realVal}%) muito melhor do que a Heurística Firebase (${firebaseVal}%), ativando notas 4/5 para Raciocínio e Elementos Visuais na trigonometria topográfica.`;
          break;
        case 'FUVEST2026_Q34':
          commentary = `O Gemma 4 (${gemmaVal}%) aproximou-se mais da dificuldade real da FUVEST (${realVal}%) do que a Heurística Firebase (${firebaseVal}%), ao pontuar alto nas dimensões de Domínio (4/5) e Visual (4/5) em hidroquímica fluvial.`;
          break;
        case 'FUVEST2026_Q32':
          commentary = `Consistência entre o Gemma 4 (${gemmaVal}%) e a Heurística Firebase (${firebaseVal}%) na estimativa de complexidade mediana em relação ao valor da FUVEST (${realVal}%).`;
          break;
        case 'FUVEST2026_Q08':
          commentary = `Ambos os modelos (${gemmaVal}% Gemma 4 e ${firebaseVal}% Firebase) convergiram adequadamente com a facilidade da questão no vestibular da FUVEST (${realVal}% de erro).`;
          break;
        default:
          commentary = item.description || '';
      }

      return `Com Dificuldade Real da Banca de ${realVal}% (${item.classif_real}), o Gemma 4 estimou ${gemmaVal}% e a Heurística Firebase marcou ${firebaseVal}%. ${commentary}`;
    }

    if (hasCaseStudies) {
      const casesContainer = document.getElementById('dashboardCaseStudiesList');
      if (casesContainer) {
        casesContainer.innerHTML = stats.case_studies
          .map((item, index) => {
            const qMatch = (stats.questions_list || []).find((q) => q.id === item.id);
            const heurVal = qMatch ? qMatch.ai_complexity_heuristic : 30;
            const pedAnalysis = getPedagogicalAnalysis(item, heurVal);

            return `
            <div style="border: 1px solid var(--color-border); border-radius: 6px; padding: 12px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                  <strong style="color:var(--color-text-shine); font-size:0.9rem;">${item.id.replace('ENEM2025_', 'ENEM 2025 ').replace('FUVEST2026_', 'FUVEST 2026 ')}: ${item.title}</strong>
                  <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px;">
                    Dificuldade Real (Banca): <strong>${item.real_difficulty.toFixed(1)}% (${item.classif_real})</strong> | IA Apêndice B: <strong>${item.ap_total_normalized.toFixed(1)}% (${item.classif_ia})</strong> | Heurística Firebase: <strong>${heurVal.toFixed(1)}%</strong>
                  </div>
                </div>
                <button class="btn btn--sm btn--outline toggle-case-just-btn" data-index="${index}" style="padding: 4px 10px; font-size:0.7rem; border-radius: 4px; border: 1px solid var(--color-border); background:none; color:var(--color-text); cursor:pointer;">
                  Ver Justificativa da IA ▾
                </button>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--color-text-secondary);">
                  <span>Realidade Humana (TRI % Erro):</span>
                  <span>${item.real_difficulty.toFixed(1)}%</span>
                </div>
                <div style="width:100%; height:6px; background:var(--color-background-progress-bar); border-radius:3px; overflow:hidden;">
                  <div style="width:${item.real_difficulty}%; height:100%; background:#a75df4; border-radius:3px;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--color-text-secondary); margin-top:2px;">
                  <span>Previsão Gemma 4 (Apêndice B %):</span>
                  <span>${item.ap_total_normalized.toFixed(1)}%</span>
                </div>
                <div style="width:100%; height:6px; background:var(--color-background-progress-bar); border-radius:3px; overflow:hidden;">
                  <div style="width:${item.ap_total_normalized}%; height:100%; background:#c0152f; border-radius:3px;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--color-text-secondary); margin-top:2px;">
                  <span>Heurística Firebase (%):</span>
                  <span>${heurVal.toFixed(1)}%</span>
                </div>
                <div style="width:100%; height:6px; background:var(--color-background-progress-bar); border-radius:3px; overflow:hidden;">
                  <div style="width:${heurVal}%; height:100%; background:#21808d; border-radius:3px;"></div>
                </div>
              </div>

              <p style="margin: 3px 0 0 0; font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4; border-left:2px solid var(--color-primary); padding-left:8px;">
                <strong>Análise Pedagógica:</strong> ${pedAnalysis}
              </p>

              <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.7rem; color:var(--color-text-secondary); background:rgba(0,0,0,0.05); padding:6px; border-radius:4px; margin-top:4px;">
                <span>📝 Enunciado: <strong>${item.ap_enunciado}/5</strong></span>
                <span>👁️ Visual: <strong>${item.ap_visual}/5</strong></span>
                <span>🎓 Domínio: <strong>${item.ap_dominio}/5</strong></span>
                <span>🧠 Raciocínio: <strong>${item.ap_raciocinio}/5</strong></span>
                <span>🔑 Resposta: <strong>${item.ap_resposta}/5</strong></span>
              </div>

              <div id="caseJustArea_${index}" style="display:none; flex-direction:column; gap:6px; background:rgba(0,0,0,0.1); border:1px solid var(--color-border); border-radius:4px; padding:10px; font-size:0.7rem; margin-top:5px; max-height:250px; overflow-y:auto; line-height:1.4;">
                <strong style="color:var(--color-primary); font-size:0.75rem; text-transform:uppercase;">Justificativas Textuais do Gemma 4:</strong>
                <div><strong>Enunciado:</strong> ${item.justificativas.complexidade_enunciado || 'N/A'}</div>
                <div style="margin-top:4px;"><strong>Elementos Visuais:</strong> ${item.justificativas.elementos_visuais || 'N/A'}</div>
                <div style="margin-top:4px;"><strong>Especificidade Domínio:</strong> ${item.justificativas.especificidade_dominio || 'N/A'}</div>
                <div style="margin-top:4px;"><strong>Raciocínio Complexo:</strong> ${item.justificativas.raciocinio_complexo || 'N/A'}</div>
                <div style="margin-top:4px;"><strong>Resposta Complexa:</strong> ${item.justificativas.resposta_complexa || 'N/A'}</div>
              </div>
            </div>
          `;
          })
          .join('');

        casesContainer.querySelectorAll('.toggle-case-just-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const index = btn.dataset.index;
            const area = document.getElementById(`caseJustArea_${index}`);
            if (area.style.display === 'none') {
              area.style.display = 'flex';
              btn.textContent = 'Fechar Justificativa ▲';
              btn.style.background = 'var(--color-primary)';
              btn.style.color = 'var(--color-btn-primary-text)';
            } else {
              area.style.display = 'none';
              btn.textContent = 'Ver Justificativa da IA ▾';
              btn.style.background = 'none';
              btn.style.color = 'var(--color-text)';
            }
          });
        });
      }
    }
  }, 50);
}

async function ensureExportLibraries() {
  const promises = [];
  if (!window.JSZip) {
    promises.push(
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      }),
    );
  }
  if (!window.saveAs) {
    promises.push(
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      }),
    );
  }
  if (!window.html2canvas) {
    promises.push(
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      }),
    );
  }
  await Promise.all(promises);
}

async function exportApendiceBChartsAndCardsZIP(
  dataContainer,
  activeKey = 'humanas_linguagens',
  activeVariantKey = 'all',
  stats = null,
) {
  const btn = document.getElementById('btn-export-apendice-b-zip');
  const originalText = btn ? btn.innerHTML : '📦 Baixar Gráficos e Cards (.ZIP)';

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Carregando bibliotecas...';
    }

    await ensureExportLibraries();

    if (btn) {
      btn.innerHTML = '⏳ Preparando elementos do Apêndice B (Gemma 4)...';
    }

    const zip = new JSZip();

    const areaSlugMap = {
      humanas_linguagens: 'geral_50_questoes',
      linguagens: 'linguagens_lc',
      humanas: 'humanas_ch',
    };

    const areaSlug = areaSlugMap[activeKey] || activeKey;
    const folderName = `graficos_apendice_b_gemma_4_aba-${areaSlug}`;
    const folder = zip.folder(folderName);

    const activeStatsObj = stats
      ? stats[activeKey] || stats['humanas_linguagens'] || stats['consolidado']
      : null;

    if (!activeStatsObj) {
      throw new Error('Estatísticas do Apêndice B não encontradas.');
    }

    const body = document.getElementById('apendiceBVariantBody');
    const c_glob = activeStatsObj.comparisons?.global || {};
    const c_pre = activeStatsObj.comparisons?.pre_cutoff || {};
    const c_post = activeStatsObj.comparisons?.post_cutoff || {};
    const hasCaseStudies = activeStatsObj.case_studies && activeStatsObj.case_studies.length > 0;

    let areaLabel = 'Geral (50 Questões)';
    if (activeKey === 'linguagens') areaLabel = 'Linguagens (LC)';
    if (activeKey === 'humanas') areaLabel = 'Humanas (CH)';

    const variantsToExport = [
      { key: 'all', label: '01_visao_geral' },
      { key: 'apendice_vs_heuristic', label: '02_apendice_b_x_heuristica' },
      { key: 'heuristic_vs_real', label: '03_heuristica_x_banca' },
      { key: 'apendice_vs_real', label: '04_apendice_b_x_banca' },
    ];

    let overallIndex = 1;

    for (const vObj of variantsToExport) {
      const vKey = vObj.key;
      const vPrefix = vObj.label;

      if (btn) {
        btn.innerHTML = `⏳ Renderizando comparativo: ${vPrefix}...`;
      }

      if (vKey === 'apendice_vs_heuristic') {
        renderViewApendiceVsHeuristic(body, activeStatsObj, c_glob, c_pre, c_post, areaLabel);
      } else if (vKey === 'heuristic_vs_real') {
        renderViewHeuristicVsReal(body, activeStatsObj, c_glob, c_pre, c_post, areaLabel);
      } else if (vKey === 'apendice_vs_real') {
        renderViewApendiceVsReal(body, activeStatsObj, c_glob, c_pre, c_post, areaLabel);
      } else {
        renderViewConsolidada(
          body,
          activeStatsObj,
          c_glob,
          c_pre,
          c_post,
          hasCaseStudies,
          areaLabel,
        );
      }

      await new Promise((r) => setTimeout(r, 200));

      if (window.Chart) {
        body.querySelectorAll('canvas').forEach((canvasEl) => {
          const chartInst = Chart.getChart(canvasEl);
          if (chartInst) {
            try {
              chartInst.resize();
              chartInst.update('none');
            } catch (e) {}
          }
        });
      }

      await new Promise((r) => setTimeout(r, 100));

      const triCards = body.querySelectorAll('div[style*="border-left"]');
      let triIdx = 1;
      for (const card of triCards) {
        try {
          const cardCanvas = await html2canvas(card, {
            backgroundColor: '#1a1c1d',
            scale: 2,
            logging: false,
            useCORS: true,
            letterRendering: true,
          });
          const imgData = cardCanvas.toDataURL('image/png').split(',')[1];
          const titleEl = card.querySelector('div');
          const rawTitle = titleEl ? titleEl.textContent.trim() : `card_${triIdx}`;
          const cleanTitle = rawTitle
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 40);

          folder.file(
            `${String(overallIndex).padStart(2, '0')}_${vPrefix}_card_${cleanTitle}.png`,
            imgData,
            { base64: true },
          );
          overallIndex++;
          triIdx++;
        } catch (err) {
          console.warn('Erro ao exportar Tri-card:', err);
        }
      }

      const chartHeaders = body.querySelectorAll('h4');
      for (const h4 of chartHeaders) {
        try {
          const parentCard = h4.closest('div');
          const canvasEl = parentCard ? parentCard.querySelector('canvas') : null;
          if (canvasEl) {
            const rawTitle = h4.textContent.trim();
            const cleanTitle = rawTitle
              .replace(/^\d+\.\s*/, '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .slice(0, 45);

            const w =
              canvasEl.width > 300
                ? canvasEl.width
                : canvasEl.clientWidth
                  ? canvasEl.clientWidth * 2
                  : 1000;
            const h =
              canvasEl.height > 150
                ? canvasEl.height
                : canvasEl.clientHeight
                  ? canvasEl.clientHeight * 2
                  : 500;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
            ctx.fillStyle = '#1a1c1d';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(canvasEl, 0, 0, w, h);

            const imgBase64 = tempCanvas.toDataURL('image/png').split(',')[1];
            folder.file(
              `${String(overallIndex).padStart(2, '0')}_${vPrefix}_grafico_${cleanTitle}.png`,
              imgBase64,
              { base64: true },
            );
            overallIndex++;
          }
        } catch (chartErr) {
          console.warn('Erro ao capturar gráfico:', chartErr);
        }
      }

      if (vKey === 'all') {
        const caseStudiesList = body.querySelector('#dashboardCaseStudiesList');
        if (caseStudiesList) {
          const caseCards = caseStudiesList.querySelectorAll(':scope > div');
          let caseIdx = 1;
          for (const caseCard of caseCards) {
            try {
              if (btn)
                btn.innerHTML = `⏳ Exportando Estudo de Caso ${caseIdx}/${caseCards.length}...`;
              const cardCanvas = await html2canvas(caseCard, {
                backgroundColor: '#1a1c1d',
                scale: 2,
                logging: false,
                useCORS: true,
                letterRendering: true,
              });
              const imgData = cardCanvas.toDataURL('image/png').split(',')[1];

              const titleEl = caseCard.querySelector('strong');
              const rawTitle = titleEl ? titleEl.textContent.trim() : `questao_${caseIdx}`;
              const cleanTitle = rawTitle
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .slice(0, 45);

              folder.file(
                `${String(overallIndex).padStart(2, '0')}_estudo_de_caso_${cleanTitle}.png`,
                imgData,
                { base64: true },
              );
              overallIndex++;
              caseIdx++;
            } catch (caseErr) {
              console.warn('Erro ao capturar estudo de caso:', caseErr);
            }
          }
        }

        const conclusionCard = body.querySelector('div[style*="rgba(40, 167, 69"]');
        if (conclusionCard) {
          try {
            const cardCanvas = await html2canvas(conclusionCard, {
              backgroundColor: '#1a1c1d',
              scale: 2,
              logging: false,
              useCORS: true,
              letterRendering: true,
            });
            const imgData = cardCanvas.toDataURL('image/png').split(',')[1];
            folder.file(
              `${String(overallIndex).padStart(2, '0')}_conclusao_geral_apendice_b_gemma_4.png`,
              imgData,
              { base64: true },
            );
            overallIndex++;
          } catch (cErr) {
            console.warn('Erro ao capturar conclusão geral:', cErr);
          }
        }
      }
    }

    renderDashboardUI(dataContainer, activeStatsObj, activeKey);

    if (btn) {
      btn.innerHTML = '⏳ Comprimindo arquivo ZIP...';
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const today = new Date().toISOString().slice(0, 10);
    const zipFileName = `graficos_apendice_b_gemma_4_aba-${areaSlug}_${today}.zip`;

    saveAs(zipBlob, zipFileName);
  } catch (error) {
    console.error('Erro ao exportar ZIP do Apêndice B:', error);
    alert('Erro ao gerar arquivo ZIP: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}
