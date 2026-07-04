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

  // Renderiza layout do Painel do Apêndice B
  document.body.innerHTML = `
    <div class="admin-layout-wrapper" style="font-family: system-ui, sans-serif; background: var(--color-bg); min-height: 100vh; padding: 20px; box-sizing: border-box; color: var(--color-text);">
      <div class="admin-panel" style="max-width: 900px; margin: 0 auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; box-shadow: var(--chat-shadow-lg);">
        
        <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">🧪 Apêndice B</h1>
          <button class="btn btn--sm btn--outline js-voltar-inicio" style="border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 14px; background: none; color: var(--color-text); cursor: pointer;">← Voltar</button>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 16px 0; color: var(--color-text-secondary); font-size: 0.95rem; line-height: 1.5;">
            Selecione uma questão do banco de dados do projeto para avaliar a complexidade usando o modelo de inteligência artificial <strong>Gemma 4 31B IT</strong> de forma fixa.
          </p>
          <button id="btnSelectQuestionApendiceB" class="btn btn--primary" style="background: var(--color-primary); color: white; border: none; padding: 12px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            ➕ Selecionar Questão
          </button>
        </div>

        <!-- Conteúdo Principal -->
        <div id="apendiceBContentArea" style="display: flex; flex-direction: column; gap: 24px; min-height: 200px;">
          <div style="border: 2px dashed var(--color-border); border-radius: 8px; padding: 40px; text-align: center; color: var(--color-text-secondary);">
            Nenhuma questão selecionada. Clique no botão acima para escolher uma questão.
          </div>
        </div>

      </div>
    </div>
  `;

  // Setup Listeners
  const btnSelect = document.getElementById("btnSelectQuestionApendiceB");
  btnSelect?.addEventListener("click", () => {
    openAddQuestionsModal();
  });

  const voltarBtn = document.querySelector(".js-voltar-inicio");
  voltarBtn?.addEventListener("click", () => {
    gerarTelaInicial();
  });

  // Listener para captura do evento de seleção de questão
  const handleSelectedQuestion = async (e) => {
    const questions = e.detail?.questions;
    if (questions && questions.length > 0) {
      const selected = questions[0];
      await carregarQuestaoApendiceB(selected);
    }
  };

  // Remove listener anterior se houver para evitar duplicados
  window.removeEventListener("questions-selected", window._currentApendiceBListener);
  window._currentApendiceBListener = handleSelectedQuestion;
  window.addEventListener("questions-selected", handleSelectedQuestion);
}

async function carregarQuestaoApendiceB(selected) {
  const contentArea = document.getElementById("apendiceBContentArea");
  if (!contentArea) return;

  const { id, prova, fullData } = selected;

  contentArea.innerHTML = `
    <!-- Card Preview da Questão -->
    <div style="display: flex; flex-direction: column; gap: 15px; border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(255,255,255,0.01);">
      <h3 style="margin: 0; font-size: 1.1rem; color: var(--color-text);">Questão Selecionada:</h3>
      <div id="apendiceBQuestionPreviewCard"></div>
    </div>

    <!-- Painel de Execução do Experimento -->
    <div id="apendiceBConsolePanel" style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 15px;">
      <div style="text-align: center; padding: 20px;">
        <div class="admin-spinner" style="margin: 0 auto 10px auto;"></div>
        Verificando status do experimento no Firebase...
      </div>
    </div>
  `;

  // Renderiza o card técnico
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

  // Verifica status no Firebase
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
      
      <!-- Box de Pensamentos -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">💭 Cadeia de Raciocínio (Thoughts)</span>
        <div id="apendiceBThoughts" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; height: 200px; overflow-y: auto; font-size: 0.8rem; white-space: pre-wrap; color: var(--color-text-secondary); line-height: 1.4;"></div>
      </div>
      
      <!-- Box do JSON de Resposta -->
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

    // Persiste no Firebase
    const { ref: dbRef, set } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
    
    const statusData = {
      status: "rodado",
      timestamp: result.timestamp,
      pontuacao: result.response_text?.pontuacao_final_complexidade || null,
      classificacao: result.response_text?.classificacao_dificuldade || null
    };

    await set(dbRef(db, `experimentos_apendice_b_status/${nomeProva}/${idQuestao}`), statusData);
    await set(dbRef(db, `experimentos_apendice_b/${nomeProva}/${idQuestao}`), result);

    // Atualiza cache local
    window.bancoState = window.bancoState || {};
    window.bancoState.apendiceBStatusMap = window.bancoState.apendiceBStatusMap || {};
    window.bancoState.apendiceBStatusMap[`${nomeProva}/${idQuestao}`] = true;

    // Marca checkbox e atualiza o badge na lista principal se o modal ainda estiver aberto
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

    // Download do debug JSON
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
