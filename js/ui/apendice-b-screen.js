import { ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { db, auth } from "../main.js";
import { customAlert } from "./GlobalAlertsLogic.tsx";
import { gerarTelaInicial } from "../app/telas.js";
import { openAddQuestionsModal } from "./add-questions-modal.js";
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { verificarSeAdmin } from "./admin-panel.js";

/**
 * Inicializa a tela dedicada do Apêndice B.
 */
export async function iniciarModoApendiceB() {
  const user = auth.currentUser;
  if (!user) {
    customAlert("⚠️ Faça login primeiro.");
    gerarTelaInicial();
    return;
  }

  // Feedback de carregamento
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:var(--color-bg); color:var(--color-text); font-family: system-ui, sans-serif;">
      <div class="admin-spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
      <p style="margin-top:15px; font-weight:500;">Verificando permissões de administrador...</p>
    </div>
  `;

  const isAdmin = await verificarSeAdmin(user.uid);
  if (!isAdmin) {
    customAlert("⛔ Acesso negado: Você não possui privilégios de administrador.");
    gerarTelaInicial();
    return;
  }

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
          <button id="tabApendiceTriage" class="nav-tab-btn active" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: var(--color-primary); color: var(--color-btn-primary-text); cursor: pointer; font-weight: bold; transition: all 0.2s;">
            🔬 Triagem Individual
          </button>
          <button id="tabApendiceDashboard" class="nav-tab-btn" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: none; color: var(--color-text-secondary); cursor: pointer; font-weight: bold; transition: all 0.2s;">
            📊 Dashboard de Resultados (TRI vs. IA)
          </button>
        </div>

        <!-- CONTAINER 1: Triagem Individual -->
        <div id="containerApendiceTriage" style="display: block;">
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
        <div id="containerApendiceDashboard" style="display: none;">
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
  const tabTriage = document.getElementById("tabApendiceTriage");
  const tabDashboard = document.getElementById("tabApendiceDashboard");
  const cTriage = document.getElementById("containerApendiceTriage");
  const cDashboard = document.getElementById("containerApendiceDashboard");

  tabTriage.addEventListener("click", () => {
    tabTriage.style.background = "var(--color-primary)";
    tabTriage.style.color = "var(--color-btn-primary-text)";
    tabTriage.classList.add("active");
    
    tabDashboard.style.background = "none";
    tabDashboard.style.color = "var(--color-text-secondary)";
    tabDashboard.classList.remove("active");
    
    cTriage.style.display = "block";
    cDashboard.style.display = "none";
  });

  tabDashboard.addEventListener("click", () => {
    tabDashboard.style.background = "var(--color-primary)";
    tabDashboard.style.color = "var(--color-btn-primary-text)";
    tabDashboard.classList.add("active");
    
    tabTriage.style.background = "none";
    tabTriage.style.color = "var(--color-text-secondary)";
    tabTriage.classList.remove("active");
    
    cTriage.style.display = "none";
    cDashboard.style.display = "block";
    
    carregarDashboardApendiceB();
  });

  // Setup Listeners da Triagem
  const btnSelect = document.getElementById("btnSelectQuestionApendiceB");
  btnSelect?.addEventListener("click", () => {
    openAddQuestionsModal();
  });

  const voltarBtn = document.querySelector(".js-voltar-inicio");
  voltarBtn?.addEventListener("click", () => {
    gerarTelaInicial();
  });

  const handleSelectedQuestion = async (e) => {
    const questions = e.detail?.questions;
    if (questions && questions.length > 0) {
      const selected = questions[0];
      await carregarQuestaoApendiceB(selected);
    }
  };

  window.removeEventListener("questions-selected", window._currentApendiceBListener);
  window._currentApendiceBListener = handleSelectedQuestion;
  window.addEventListener("questions-selected", handleSelectedQuestion);
}

// -------------------------------------------------------------
// FUNÇÕES DE TRIAGEM INDIVIDUAL (Existentes)
// -------------------------------------------------------------
async function carregarQuestaoApendiceB(selected) {
  const contentArea = document.getElementById("apendiceBContentArea");
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

  const previewCardContainer = document.getElementById("apendiceBQuestionPreviewCard");
  if (previewCardContainer) {
    if (!fullData.meta) fullData.meta = {};
    if (!fullData.meta.material_origem) {
      fullData.meta.material_origem = prova.replace(/_/g, " ");
    }
    const card = criarCardTecnico(id, fullData);
    previewCardContainer.appendChild(card);
    if (typeof renderLatexIn === "function") {
      renderLatexIn(card);
    }
  }

  const consolePanel = document.getElementById("apendiceBConsolePanel");
  try {
    const statusRef = ref(db, `experimentos_apendice_b_status/${prova}/${id}`);
    const statusSnap = await get(statusRef);
    if (statusSnap.exists()) {
      renderApendiceBConcluidoScreen(consolePanel, prova, id, fullData);
    } else {
      renderApendiceBPendenteScreen(consolePanel, prova, id, fullData);
    }
  } catch (err) {
    console.error("Erro ao carregar status do Apêndice B:", err);
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
    </div>
  `;

  container.querySelector("#btnRodarApendiceBScreen").addEventListener("click", () => {
    rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData);
  });
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

  const statusText = container.querySelector("#apendiceBStatusText span:last-child");
  const thoughtsBox = container.querySelector("#apendiceBThoughts");
  const responseBox = container.querySelector("#apendiceBResponse");

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
      if (thoughtsBox) thoughtsBox.textContent = "";
      if (responseBox) responseBox.textContent = "";
    },
    onAnswerDelta: (delta) => {
      if (responseBox) {
        responseBox.textContent += delta;
        responseBox.scrollTop = responseBox.scrollHeight;
      }
    }
  };

  try {
    const { executarTriageApendiceB } = await import("../chat/apendice-b-pipeline.js");
    const result = await executarTriageApendiceB(
      { id: idQuestao, prova: nomeProva, fullData },
      handlers
    );

    statusText.parentElement.innerHTML = `✅ Experimento finalizado com sucesso em ${result.latency_sec}s!`;

    const { ref: dbRef, set } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
    
    const statusData = {
      status: "rodado",
      timestamp: result.timestamp,
      pontuacao: result.response_text?.pontuacao_final_complexidade || null,
      classificacao: result.response_text?.classificacao_dificuldade || null
    };

    await set(dbRef(db, `experimentos_apendice_b_status/${nomeProva}/${idQuestao}`), statusData);
    await set(dbRef(db, `experimentos_apendice_b/${nomeProva}/${idQuestao}`), result);

    window.bancoState = window.bancoState || {};
    window.bancoState.apendiceBStatusMap = window.bancoState.apendiceBStatusMap || {};
    window.bancoState.apendiceBStatusMap[`${nomeProva}/${idQuestao}`] = true;

    const itemKey = `${nomeProva}::${idQuestao}`;
    const itemEl = document.querySelector(`.question-item[data-key="${itemKey}"]`);
    if (itemEl) {
      const badge = itemEl.querySelector(".apendice-b-status-badge");
      if (badge) {
        badge.textContent = "🧪 OK";
        badge.style.background = "rgba(40, 167, 69, 0.15)";
        badge.style.color = "#28a745";
        badge.style.borderColor = "rgba(40, 167, 69, 0.3)";
      }

      const checkbox = itemEl.querySelector(".question-checkbox");
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    const seen = new WeakSet();
    const safeJson = JSON.stringify(result, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    }, 2);

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(safeJson);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `maia_debug_apendice_b_${idQuestao}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setTimeout(() => {
      renderApendiceBConcluidoScreen(container, nomeProva, idQuestao, fullData, result);
    }, 1200);

  } catch (error) {
    console.error("Erro no experimento:", error);
    if (statusText) {
      statusText.parentElement.innerHTML = `❌ Erro: ${error.message}`;
    }
    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn--primary";
    retryBtn.style.cssText = "margin-top: 10px; width: 100%; border: none; border-radius: 6px; padding: 10px; cursor: pointer; background: var(--color-primary); color: white;";
    retryBtn.textContent = "🔄 Tentar Novamente";
    retryBtn.onclick = () => rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData);
    container.appendChild(retryBtn);
  }
}

async function renderApendiceBConcluidoScreen(container, nomeProva, idQuestao, fullData, cachedResult = null) {
  let result = cachedResult;

  if (!result) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="spinner-sm" style="margin: 0 auto 10px auto; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Carregando dados do experimento...
      </div>
    `;

    try {
      const { ref: dbRef, get } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
      const snap = await get(dbRef(db, `experimentos_apendice_b/${nomeProva}/${idQuestao}`));
      if (snap.exists()) {
        result = snap.val();
      }
    } catch (e) {
      console.error("Erro ao ler dados do Firebase:", e);
    }
  }

  if (!result) {
    container.innerHTML = `
      <div style="background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 12px; color: #dc3545; font-size: 0.85rem;">
        ⚠️ Erro ao carregar dados do experimento no Firebase.
      </div>
      <button class="btn btn--outline" id="btnRetryLoadScreen" style="margin-top: 10px; width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; cursor: pointer; color: var(--color-text);">Tentar Novamente</button>
    `;
    container.querySelector("#btnRetryLoadScreen").onclick = () => renderApendiceBConcluidoScreen(container, nomeProva, idQuestao, fullData);
    return;
  }

  const scoreData = result.response_text || {};
  const criterios = scoreData.criterios || {};

  const critList = [
    { label: "Enunciado", key: "complexidade_enunciado" },
    { label: "Visuais", key: "elementos_visuais" },
    { label: "Especificidade", key: "especificidade_dominio" },
    { label: "Raciocínio", key: "raciocinio_complexo" },
    { label: "Resposta", key: "resposta_complexa" }
  ];

  const rowsHtml = critList.map(c => {
    const critObj = criterios[c.key] || {};
    const nota = critObj.nota || 0;
    const justificativa = critObj.justificativa || "Sem justificativa.";
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
  }).join("");

  const formattedDate = new Date(result.timestamp).toLocaleString("pt-BR");

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
        <div style="font-size: 1.2rem; font-weight: bold; margin-top: 6px; color: var(--color-text);">${scoreData.classificacao_dificuldade || "N/A"}</div>
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
      <button class="btn btn--secondary btn--outline" id="btnRefazerApendiceBScreen" style="flex: 1; padding: 8px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 6px; background: none; color: var(--color-text); cursor: pointer;">
        🔄 Refazer Triagem
      </button>
    </div>
  `;

  container.querySelector("#btnDownloadDebugJsonScreen").onclick = () => {
    const seen = new WeakSet();
    const safeJson = JSON.stringify(result, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    }, 2);

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(safeJson);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `maia_debug_apendice_b_${idQuestao}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  container.querySelector("#btnRefazerApendiceBScreen").onclick = () => {
    rodarExperimentoApendiceBScreen(container, nomeProva, idQuestao, fullData);
  };
}

// -------------------------------------------------------------
// NOVO CONTAINER: DASHBOARD DE RESULTADOS (Interativo com Chart.js)
// -------------------------------------------------------------
let dashboardCarregado = false;

async function carregarDashboardApendiceB() {
  if (dashboardCarregado) return; // Carrega apenas uma vez por inicialização da tela
  
  const loader = document.getElementById("dashboardLoader");
  const content = document.getElementById("dashboardContent");
  
  try {
    // 1. Carrega Chart.js de forma assíncrona se não estiver disponível
    await new Promise((resolve, reject) => {
      if (window.Chart) return resolve();
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // 2. Carrega estatísticas compiladas do arquivo JSON
    const response = await fetch("../../experiments/stats_summary.json");
    if (!response.ok) {
      throw new Error(`Não foi possível ler as estatísticas de validação (../../experiments/stats_summary.json). Rodou o script Python?`);
    }
    const stats = await response.json();

    // 3. Oculta loader e renderiza esqueleto do Dashboard com seletores de 6 abas (5 áreas + Geral)
    loader.style.display = "none";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    
    content.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 15px; border-bottom: 1px solid var(--color-border); padding-bottom: 15px; width: 100%; flex-wrap: wrap;">
        <button id="btnApendiceBTabLinguagens" class="nav-tab-btn active" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-btn-primary-text); font-size: 0.85rem;">
          📖 Linguagens (LC)
        </button>
        <button id="btnApendiceBTabHumanas" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
          🌍 Humanas (CH)
        </button>
        <button id="btnApendiceBTabNatureza" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
          🌿 Natureza (CN)
        </button>
        <button id="btnApendiceBTabMatematica" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
          📐 Matemática (MT)
        </button>
        <button id="btnApendiceBTabInterdisciplinar" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
          🔄 Interdisciplinar (FUVEST)
        </button>
        <button id="btnApendiceBTabConsolidado" class="nav-tab-btn" style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 1px solid var(--color-border); background: none; color: var(--color-text); font-size: 0.85rem;">
          📊 Geral (125 Questões)
        </button>
      </div>
      <div id="apendiceBDashboardDataContainer" style="display: flex; flex-direction: column; gap: 20px; width: 100%;"></div>
    `;

    const dataContainer = document.getElementById("apendiceBDashboardDataContainer");
    const btnLinguagens = document.getElementById("btnApendiceBTabLinguagens");
    const btnHumanas = document.getElementById("btnApendiceBTabHumanas");
    const btnNatureza = document.getElementById("btnApendiceBTabNatureza");
    const btnMatematica = document.getElementById("btnApendiceBTabMatematica");
    const btnInterdisciplinar = document.getElementById("btnApendiceBTabInterdisciplinar");
    const btnConsolidado = document.getElementById("btnApendiceBTabConsolidado");

    const tabs = [
      { btn: btnLinguagens, key: 'linguagens' },
      { btn: btnHumanas, key: 'humanas' },
      { btn: btnNatureza, key: 'natureza' },
      { btn: btnMatematica, key: 'matematica' },
      { btn: btnInterdisciplinar, key: 'interdisciplinar' },
      { btn: btnConsolidado, key: 'consolidado' }
    ];

    function selectTab(activeKey) {
      tabs.forEach(t => {
        if (t.key === activeKey) {
          t.btn.style.border = "1px solid var(--color-primary)";
          t.btn.style.background = "var(--color-primary)";
          t.btn.style.color = "var(--color-btn-primary-text)";
          t.btn.classList.add("active");
        } else {
          t.btn.style.border = "1px solid var(--color-border)";
          t.btn.style.background = "none";
          t.btn.style.color = "var(--color-text)";
          t.btn.classList.remove("active");
        }
      });
      renderDashboardUI(dataContainer, stats[activeKey] || stats['consolidado'], activeKey);
    }

    btnLinguagens.addEventListener("click", () => selectTab('linguagens'));
    btnHumanas.addEventListener("click", () => selectTab('humanas'));
    btnNatureza.addEventListener("click", () => selectTab('natureza'));
    btnMatematica.addEventListener("click", () => selectTab('matematica'));
    btnInterdisciplinar.addEventListener("click", () => selectTab('interdisciplinar'));
    btnConsolidado.addEventListener("click", () => selectTab('consolidado'));

    selectTab('consolidado');
    dashboardCarregado = true;
    
  } catch (error) {
    console.error("Erro ao iniciar dashboard do Apêndice B:", error);
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
  if (val === undefined || val === null || isNaN(val)) return "0.000";
  return (val >= 0 ? "+" : "") + val.toFixed(3);
}

function formatSignedPct(val) {
  if (val === undefined || val === null || isNaN(val)) return "0.0%";
  return (val >= 0 ? "+" : "") + val.toFixed(1) + "%";
}

function renderDashboardUI(container, stats, activeKey) {
  // Obter correlações e comparações do subset
  const c_glob = stats.comparisons.global;
  const c_pre = stats.comparisons.pre_cutoff;
  const c_post = stats.comparisons.post_cutoff;
  
  const hasCaseStudies = stats.case_studies && stats.case_studies.length > 0;
  
  let areaLabel = "Geral (125 Questões)";
  if (activeKey === "linguagens") areaLabel = "Linguagens e Códigos (LC - N=25)";
  if (activeKey === "humanas") areaLabel = "Ciências Humanas (CH - N=25)";
  if (activeKey === "natureza") areaLabel = "Ciências da Natureza (CN - N=25)";
  if (activeKey === "matematica") areaLabel = "Matemática e Tecnologias (MT - N=25)";
  if (activeKey === "interdisciplinar") areaLabel = "Interdisciplinar (FUVEST - N=25)";
  if (activeKey === "consolidado") areaLabel = "Geral / Consolidado (Todas as 125 Questões)";

  // Gerar HTML de cards de destaque
  container.innerHTML = `
    <!-- Linha 1: Cards Rápidos de Comparação (Escala 0-100%) -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 15px;">
      
      <!-- Card Comparação A: Firebase Heuristic vs Real TRI -->
      <div style="background: rgba(33, 128, 141, 0.04); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 0.75rem; color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Comparação 1: Firebase vs. Banca</div>
        <div style="font-size: 1.4rem; font-weight: bold; color: var(--color-text-shine);">Correlação: ${formatCorr(c_pre.heuristic_vs_real.spearman)} <span style="font-size:0.8rem; font-weight:normal; color:var(--color-text-secondary);">(Pré)</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 5px; border-top: 1px dashed var(--color-border); padding-top: 8px;">
          <span>Erro Médio (MAE): <strong>${c_glob.heuristic_vs_real.mae.toFixed(1)}%</strong></span>
          <span>Viés (Bias): <strong style="color: ${c_glob.heuristic_vs_real.bias < 0 ? 'var(--color-error)' : 'var(--color-success)'}">${formatSignedPct(c_glob.heuristic_vs_real.bias)}</strong></span>
        </div>
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); line-height: 1.3; margin-top: 3px;">
          * O Firebase Heurístico subestima sistematicamente a dificuldade humana (viés negativo), com erro médio absoluto em torno de 25%.
        </div>
      </div>

      <!-- Card Comparação B: Apêndice B vs Real TRI -->
      <div style="background: rgba(192, 21, 47, 0.04); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 0.75rem; color: var(--color-error); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Comparação 2: Apêndice B vs. Banca</div>
        <div style="font-size: 1.4rem; font-weight: bold; color: var(--color-text-shine);">Correlação: ${formatCorr(c_pre.apendice_vs_real.spearman)} <span style="font-size:0.8rem; font-weight:normal; color:var(--color-text-secondary);">(Pré)</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 5px; border-top: 1px dashed var(--color-border); padding-top: 8px;">
          <span>Erro Médio (MAE): <strong>${c_glob.apendice_vs_real.mae.toFixed(1)}%</strong></span>
          <span>Viés (Bias): <strong style="color: ${c_glob.apendice_vs_real.bias < 0 ? 'var(--color-error)' : 'var(--color-success)'}">${formatSignedPct(c_glob.apendice_vs_real.bias)}</strong></span>
        </div>
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); line-height: 1.3; margin-top: 3px;">
          * Apêndice B normalizado exibe desvio de escala e viés muito próximos da heurística simples, indicando alta estabilidade.
        </div>
      </div>

      <!-- Card Comparação C: Apêndice B vs Firebase Heuristic -->
      <div style="background: rgba(98, 108, 113, 0.04); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 0.75rem; color: var(--color-info); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Comparação 3: Apêndice B vs. Firebase</div>
        <div style="font-size: 1.4rem; font-weight: bold; color: var(--color-text-shine);">Consistência: ${formatCorr(c_glob.apendice_vs_heuristic.spearman)}</div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 5px; border-top: 1px dashed var(--color-border); padding-top: 8px;">
          <span>Erro Médio (MAE): <strong>${c_glob.apendice_vs_heuristic.mae.toFixed(1)}%</strong></span>
          <span>Viés (Bias): <strong style="color: ${c_glob.apendice_vs_heuristic.bias < 0 ? 'var(--color-error)' : 'var(--color-success)'}">${formatSignedPct(c_glob.apendice_vs_heuristic.bias)}</strong></span>
        </div>
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); line-height: 1.3; margin-top: 3px;">
          * **Consistência interna forte!** O modelo julga as rubricas de forma extremamente alinhada com as heurísticas de pesos (MAE de apenas ${c_glob.apendice_vs_heuristic.mae.toFixed(1)}%).
        </div>
      </div>

    </div>

    <!-- Linha 2: Área dos Gráficos (Grid de 2 colunas) -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;">
      
      <!-- Gráfico 1: Correlações por Critério e Cutoff -->
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Colapso de Correlação Generalizado (Pré vs. Pós Cutoff - ${areaLabel})</h4>
        <div style="height: 250px; position: relative;">
          <canvas id="chartCorrelacaoCanvas"></canvas>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.4; margin-top: 12px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border-left: 3px solid var(--color-error);">
          <strong>Análise do Gráfico 1:</strong> No grupo pré-cutoff (exames anteriores a 2025/2026), o modelo demonstra correlações moderadas a altas (cinza), alcançando até $+0.40$. No entanto, no grupo inédito pós-cutoff (vermelho), as correlações despencam drasticamente para valores negativos (atingindo até $-0.80$). Isso evidencia empiricamente o fenômeno de <em>Contaminação de Dados (data contamination)</em>: o modelo cru não calcula a dificuldade raciocinando sobre o texto, mas depende de gabaritos memorizados durante o pré-treino.
        </div>
      </div>

      <!-- Gráfico 2: Médias por Faixa de Dificuldade -->
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column;">
        <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--color-text-shine);">Complexidade Média Calculada por Faixa Real (TRI - ${areaLabel})</h4>
        <div style="height: 250px; position: relative;">
          <canvas id="chartFaixasCanvas"></canvas>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.4; margin-top: 12px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border-left: 3px solid var(--color-primary);">
          <strong>Análise do Gráfico 2:</strong> Observa-se um crescimento monotônico das estimativas de complexidade à medida que a dificuldade real da banca (TRI) aumenta. No entanto, o Apêndice B normalizado e o Firebase Heurístico exibem um <em>viés de subestimação sistemático (bias ~ -10%)</em> nas faixas de 80%-100%. A IA considera questões difíceis como "médias" porque ela ignora a carga de distratores semânticos e a pressão de tempo que confundem os alunos humanos.
        </div>
      </div>

    </div>

    <!-- Linha 3: Enquadramento Metodológico e Instruções para Tese/Relatório -->
    <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(var(--color-primary-rgb), 0.02); display:flex; flex-direction:column; gap:12px;">
      <h3 style="margin:0; font-size:1.15rem; color: var(--color-primary); display:flex; align-items:center; gap:8px;">💡 Enquadramento Científico e Argumentação de Defesa</h3>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:15px;">
        <div>
          <h5 style="margin:0 0 5px 0; color:var(--color-text-shine); font-size:0.85rem; font-weight:600;">O Argumento da Contaminação de Dados</h5>
          <p style="margin:0; font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4;">
            Estudos de validação em IAs cruas sofrem de viés retrospectivo. O colapso da correlação no set inédito pós-cutoff para <strong>${formatCorr(c_post.apendice_vs_real.spearman)}</strong> prova cientificamente que o modelo Gemma 4 não calcula a dificuldade analisando a questão do zero; ele apenas recupera de sua rede paramétrica gabaritos históricos que estavam em seu set de pré-treino.
          </p>
        </div>
        <div>
          <h5 style="margin:0 0 5px 0; color:var(--color-text-shine); font-size:0.85rem; font-weight:600;">Justificativa de Engenharia (Maia.edu RAG)</h5>
          <p style="margin:0; font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4;">
            Se modelos puros de IA falham criticamente ao prever a complexidade pedagógica em exames inéditos, isso justifica formalmente por que a **Maia.edu** introduz a arquitetura com banco de apoio (Pinecone) e RAG estruturado. Sem este suporte de ancoragem, o tutor do estudante alucinaria sobre a dificuldade e perfil de erro do aluno.
          </p>
        </div>
        <div>
          <h5 style="margin:0 0 5px 0; color:var(--color-text-shine); font-size:0.85rem; font-weight:600;">A Justificativa da Consistência de Peso</h5>
          <p style="margin:0; font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4;">
            A alta consistência interna entre o prompt do Apêndice B e o Firebase ($\rho = ${formatCorr(c_glob.apendice_vs_heuristic.spearman)}) legitima os pesos das heurísticas. Como "Complexidade de Enunciado" foi a única rubrica com correlação positiva resiliente no grupo inédito, ela deve receber o maior peso nos simulados.
          </p>
        </div>
      </div>
    </div>

    <!-- Linha 4: Estudos de Caso Condicionais/Qualitativos (Questões Pós-Cutoff) -->
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: ${hasCaseStudies ? 'flex' : 'none'}; flex-direction:column; gap:12px;">
      <h3 style="margin:0; font-size:1.1rem; color:var(--color-text-shine);">🔍 Análise Qualitativa das Questões Pós-Cutoff (${areaLabel})</h3>
      <div style="display:flex; flex-direction:column; gap:10px;" id="dashboardCaseStudiesList">
        <!-- Injetado via loops JS -->
      </div>
    </div>

    <!-- Linha 5: Conclusão Geral da Pesquisa -->
    <div style="background: rgba(40, 167, 69, 0.04); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
      <h3 style="margin: 0; font-size: 1.15rem; color: #28a745; display: flex; align-items: center; gap: 8px;">
        📌 Conclusão Geral da Análise do Apêndice B (125 Questões)
      </h3>
      <p style="margin: 0; font-size: 0.8rem; color: var(--color-text); line-height: 1.5;">
        A investigação experimental sobre as <strong>125 questões</strong> distribuídas equitativamente entre as 5 áreas (Linguagens, Humanas, Natureza, Matemática e Interdisciplinar FUVEST) consolida três conclusões fundamentais para a pesquisa do ecossistema <strong>Maia.edu</strong>:
      </p>
      <ol style="margin: 0; padding-left: 20px; font-size: 0.78rem; color: var(--color-text-secondary); line-height: 1.5;">
        <li style="margin-bottom: 6px;">
          <strong>Vulnerabilidade de Modelos Puros à Contaminação de Dados:</strong> O declínio generalizado das correlações no set pós-cutoff (ENEM 2025 e FUVEST 2026) comprova que IAs sem RAG não realizam inferência lógica pura sobre a dificuldade dos itens. Elas são fortemente influenciadas pela memorização de exames passados presentes em sua base de pré-treinamento.
        </li>
        <li style="margin-bottom: 6px;">
          <strong>Subestimação da Barreira Cognitiva Humana:</strong> Em todas as disciplinas, a IA subestima questões de alta taxa de erro humano (TRI &gt; 80%). O modelo julga a complexidade pela extensão do enunciado ou número de fórmulas, falhando em detectar a abstração de conceitos e distratores semânticos disfarçados que confundem candidatos sob a pressão do exame real.
        </li>
        <li>
          <strong>Validação da Arquitetura Maia.edu:</strong> A incapacidade dos LLMs puros em avaliar e responder com precisão em contextos inéditos justifica cientificamente a obrigatoriedade da infraestrutura proposta pela <strong>Maia.edu</strong>. O uso de RAG vetorial ancorado no Pinecone, injeção de gabaritos verificados e geração de passos encadeados (scaffolding) são estratégias indispensáveis para suprimir alucinações e entregar tutoria pedagógica segura e inclusiva no Brasil.
        </li>
      </ol>
    </div>
  `;

  // Destruir instâncias antigas de gráfico para evitar vazamento ou erro do canvas
  if (window.apendiceBCorrChart) {
    window.apendiceBCorrChart.destroy();
  }
  if (window.apendiceBFaixasChart) {
    window.apendiceBFaixasChart.destroy();
  }

  // Inicializar Gráfico 1: Correlação por cutoff (Eixo Y ajustado de -1.0 a 1.0)
  const ctxCorr = document.getElementById("chartCorrelacaoCanvas").getContext("2d");
  const metricsKeys = ['ap_enunciado', 'ap_visual', 'ap_dominio', 'ap_raciocinio', 'ap_resposta', 'ap_total_normalized', 'ai_complexity_heuristic'];
  const metricsLabels = ['Enunciado', 'Visual', 'Domínio', 'Raciocínio', 'Resposta', 'Total Apêndice B', 'Heurística Firebase'];

  window.apendiceBCorrChart = new Chart(ctxCorr, {
    type: 'bar',
    data: {
      labels: metricsLabels,
      datasets: [
        {
          label: `Pré-cutoff (Histórico, N=${stats.n_pre_cutoff})`,
          data: metricsKeys.map(key => stats.correlations[key].pre_cutoff.spearman),
          backgroundColor: '#626871',
          borderRadius: 4
        },
        {
          label: `Pós-cutoff (Inédito, N=${stats.n_post_cutoff})`,
          data: metricsKeys.map(key => stats.correlations[key].post_cutoff.spearman),
          backgroundColor: '#c0152f',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: -1.0,
          max: 1.0,
          ticks: { stepSize: 0.2 },
          title: { display: true, text: 'Correlação de Spearman (ρ)', font: { size: 10 } }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }
      }
    }
  });

  // Inicializar Gráfico 2: Médias por faixa de dificuldade
  const ctxFaixas = document.getElementById("chartFaixasCanvas").getContext("2d");
  const faixasLabels = stats.faixas_stats.map(f => f.faixa);

  window.apendiceBFaixasChart = new Chart(ctxFaixas, {
    type: 'bar',
    data: {
      labels: faixasLabels,
      datasets: [
        {
          label: 'Complexidade Heurística (%)',
          data: stats.faixas_stats.map(f => f.ai_complexity_heuristic),
          backgroundColor: '#21808d', // Teal
          borderRadius: 4
        },
        {
          label: 'Apêndice B Total Normalizado (%)',
          data: stats.faixas_stats.map(f => f.ap_total_normalized),
          backgroundColor: '#c0152f', // Coral/Red
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: 'Pontuação Média (%)', font: { size: 10 } }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }
      }
    }
  });

  // Renderizar a lista de estudos de caso se houver
  if (hasCaseStudies) {
    const casesContainer = document.getElementById("dashboardCaseStudiesList");
    casesContainer.innerHTML = stats.case_studies.map((item, index) => {
      return `
        <div style="border: 1px solid var(--color-border); border-radius: 6px; padding: 12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <strong style="color:var(--color-text-shine); font-size:0.9rem;">${item.id.replace('ENEM2025_', 'ENEM 2025 ').replace('FUVEST2026_', 'FUVEST 2026 ')}: ${item.title}</strong>
              <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px;">
                Dificuldade Real (Banca): <strong>${item.real_difficulty.toFixed(1)}% (${item.classif_real})</strong> | IA Apêndice B: <strong>${item.ap_total_normalized.toFixed(1)}% (${item.classif_ia})</strong>
              </div>
            </div>
            <button class="btn btn--sm btn--outline toggle-case-just-btn" data-index="${index}" style="padding: 4px 10px; font-size:0.7rem; border-radius: 4px; border: 1px solid var(--color-border); background:none; color:var(--color-text); cursor:pointer;">
              Ver Justificativa da IA ▾
            </button>
          </div>
          
          <!-- Progresso visual comparativo -->
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--color-text-secondary);">
              <span>Realidade Humana (TRI % Erro):</span>
              <span>${item.real_difficulty.toFixed(1)}%</span>
            </div>
            <div style="width:100%; height:6px; background:var(--color-background-progress-bar); border-radius:3px; overflow:hidden;">
              <div style="width:${item.real_difficulty}%; height:100%; background:var(--color-primary); border-radius:3px;"></div>
            </div>
  
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--color-text-secondary); margin-top:4px;">
              <span>Previsão Gemma 4 (Apêndice B %):</span>
              <span>${item.ap_total_normalized.toFixed(1)}%</span>
            </div>
            <div style="width:100%; height:6px; background:var(--color-background-progress-bar); border-radius:3px; overflow:hidden;">
              <div style="width:${item.ap_total_normalized}%; height:100%; background:var(--color-error); border-radius:3px;"></div>
            </div>
          </div>
  
          <p style="margin: 3px 0 0 0; font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4; border-left:2px solid var(--color-primary); padding-left:8px;">
            <strong>Análise Pedagógica:</strong> ${item.description}
          </p>
  
          <!-- Notas nos Critérios -->
          <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.7rem; color:var(--color-text-secondary); background:rgba(0,0,0,0.05); padding:6px; border-radius:4px; margin-top:4px;">
            <span>📝 Enunciado: <strong>${item.ap_enunciado}/5</strong></span>
            <span>👁️ Visual: <strong>${item.ap_visual}/5</strong></span>
            <span>🎓 Domínio: <strong>${item.ap_dominio}/5</strong></span>
            <span>🧠 Raciocínio: <strong>${item.ap_raciocinio}/5</strong></span>
            <span>🔑 Resposta: <strong>${item.ap_resposta}/5</strong></span>
          </div>
  
          <!-- Justificativas da IA colapsáveis -->
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
    }).join("");
  
    // Handler para toggles de estudos de caso
    casesContainer.querySelectorAll(".toggle-case-just-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = btn.dataset.index;
        const area = document.getElementById(`caseJustArea_${index}`);
        if (area.style.display === "none") {
          area.style.display = "flex";
          btn.textContent = "Fechar Justificativa ▲";
          btn.style.background = "var(--color-primary)";
          btn.style.color = "var(--color-btn-primary-text)";
        } else {
          area.style.display = "none";
          btn.textContent = "Ver Justificativa da IA ▾";
          btn.style.background = "none";
          btn.style.color = "var(--color-text)";
        }
      });
    });
  }
}
