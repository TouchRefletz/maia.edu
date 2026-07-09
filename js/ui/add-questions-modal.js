/**
 * Modal para adicionar questões ao chat
 * Permite buscar provas e selecionar questões com preview
 */

import {
  endAt,
  get,
  limitToFirst,
  orderByKey,
  query,
  ref,
  startAt,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { db, auth } from "../main.js";

// Estado do modal
let selectedQuestions = new Map();
let expandedExam = null;
let modalOverlay = null;
let previewOverlay = null;

/**
 * Abre o modal de adicionar questões
 */
export function openAddQuestionsModal() {
  // Remove modal existente se houver
  closeAddQuestionsModal();

  // Cria overlay principal
  modalOverlay = document.createElement("div");
  modalOverlay.id = "addQuestionsModal";
  modalOverlay.className = "final-modal-overlay visible";
  modalOverlay.innerHTML = generateModalHTML();

  document.body.appendChild(modalOverlay);

  // Setup event listeners
  setupModalListeners();

  // Carrega provas iniciais
  loadInitialExams();
}

/**
 * Fecha o modal
 */
export function closeAddQuestionsModal() {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
  }
  if (previewOverlay) {
    previewOverlay.remove();
    previewOverlay = null;
  }
  selectedQuestions.clear();
  expandedExam = null;
}

/**
 * Gera HTML do modal principal
 */
function generateModalHTML() {
  return `
    <div class="add-questions-content">
      <!-- Header -->
      <div class="add-questions-header">
        <h2>📚 Adicionar Questões</h2>
        <div class="add-questions-search-wrapper">
          <input 
            type="text" 
            id="addQuestionsSearch" 
            placeholder="Buscar prova (ex: ENEM, FUVEST, ETEC...)" 
            autocomplete="off"
          >
          <span class="search-icon">🔍</span>
        </div>
        <button class="add-questions-close-btn" id="closeAddQuestionsModal">✕</button>
      </div>

      <!-- Body - Lista de Provas -->
      <div class="add-questions-body" id="addQuestionsBody">
        <div class="add-questions-loading" id="addQuestionsLoading">
          <div class="spinner"></div>
          <p>Carregando provas...</p>
        </div>
        <div class="add-questions-list" id="addQuestionsList"></div>
      </div>

      <!-- Footer -->
      <div class="add-questions-footer">
        <div class="add-questions-counter" id="addQuestionsCounter">
          <span id="selectedCount">0</span> questão(ões) selecionada(s)
        </div>
        <div class="add-questions-actions">
          <button class="btn btn--outline" id="cancelAddQuestions">Cancelar</button>
          <button class="btn btn--primary" id="confirmAddQuestions" disabled>
            Adicionar Selecionadas
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Configura listeners do modal
 */
function setupModalListeners() {
  // Fechar com X ou clique no overlay
  document
    .getElementById("closeAddQuestionsModal")
    ?.addEventListener("click", closeAddQuestionsModal);
  document
    .getElementById("cancelAddQuestions")
    ?.addEventListener("click", closeAddQuestionsModal);

  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeAddQuestionsModal();
  });

  // Confirmar seleção
  document
    .getElementById("confirmAddQuestions")
    ?.addEventListener("click", confirmSelection);

  // Busca com debounce
  const searchInput = document.getElementById("addQuestionsSearch");
  let debounceTimer;

  searchInput?.addEventListener("input", (e) => {
    const term = e.target.value.trim();
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      if (term.length > 0) {
        searchExams(term);
      } else {
        loadInitialExams();
      }
    }, 400);
  });

  // ESC para fechar
  document.addEventListener("keydown", handleEscKey);
}

function handleEscKey(e) {
  if (e.key === "Escape") {
    if (previewOverlay) {
      closePreview();
    } else if (modalOverlay) {
      closeAddQuestionsModal();
    }
    document.removeEventListener("keydown", handleEscKey);
  }
}

/**
 * Carrega provas iniciais (lista de chaves em questoes/)
 */
async function loadInitialExams() {
  const listContainer = document.getElementById("addQuestionsList");
  const loading = document.getElementById("addQuestionsLoading");

  if (!listContainer || !loading) return;

  loading.style.display = "flex";
  listContainer.innerHTML = "";

  try {
    const dbRef = ref(db, "questoes");
    const consulta = query(dbRef, orderByKey(), limitToFirst(50));
    const snapshot = await get(consulta);

    loading.style.display = "none";

    if (snapshot.exists()) {
      const data = snapshot.val();
      const provas = Object.keys(data).sort();

      provas.forEach((nomeProva) => {
        const questoes = data[nomeProva];
        const qtd = questoes ? Object.keys(questoes).length : 0;
        listContainer.appendChild(createExamCard(nomeProva, qtd));
      });
    } else {
      listContainer.innerHTML = `<p class="add-questions-empty">Nenhuma prova encontrada.</p>`;
    }
  } catch (e) {
    console.error("Erro ao carregar provas:", e);
    loading.style.display = "none";
    listContainer.innerHTML = `<p class="add-questions-error">Erro ao carregar: ${e.message}</p>`;
  }
}

/**
 * Smart Search - busca com variações de case
 */
async function searchExams(termo) {
  const listContainer = document.getElementById("addQuestionsList");
  const loading = document.getElementById("addQuestionsLoading");

  if (!listContainer || !loading) return;

  loading.style.display = "flex";
  listContainer.innerHTML = "";

  try {
    // Variações de case: exato, UPPERCASE, lowercase, Capitalized
    const variacoes = new Set();
    variacoes.add(termo);
    variacoes.add(termo.toUpperCase());
    variacoes.add(termo.toLowerCase());
    if (termo.length > 0) {
      variacoes.add(
        termo.charAt(0).toUpperCase() + termo.slice(1).toLowerCase(),
      );
    }

    const dbRef = ref(db, "questoes");

    // Buscas paralelas
    const promessas = Array.from(variacoes).map(async (termoBusca) => {
      const consulta = query(
        dbRef,
        orderByKey(),
        startAt(termoBusca),
        endAt(termoBusca + "\uf8ff"),
        limitToFirst(20),
      );
      return get(consulta);
    });

    const snapshots = await Promise.all(promessas);

    // Agrega resultados únicos
    const resultados = new Map();
    snapshots.forEach((snapshot) => {
      if (snapshot.exists()) {
        Object.entries(snapshot.val()).forEach(([key, value]) => {
          resultados.set(key, value);
        });
      }
    });

    loading.style.display = "none";

    if (resultados.size > 0) {
      const listaOrdenada = Array.from(resultados.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      listaOrdenada.forEach(([nomeProva, questoes]) => {
        const qtd = questoes ? Object.keys(questoes).length : 0;
        listContainer.appendChild(createExamCard(nomeProva, qtd));
      });
    } else {
      listContainer.innerHTML = `<p class="add-questions-empty">Nenhum resultado para "${termo}"</p>`;
    }
  } catch (e) {
    console.error("Erro na busca:", e);
    loading.style.display = "none";
    listContainer.innerHTML = `<p class="add-questions-error">Erro: ${e.message}</p>`;
  }
}

/**
 * Cria card de prova (accordion)
 */
function createExamCard(nomeProva, qtdQuestoes) {
  const card = document.createElement("div");
  card.className = "exam-card";
  card.dataset.exam = nomeProva;

  const nomeFormatado = nomeProva.replace(/_/g, " ");

  card.innerHTML = `
    <div class="exam-card-header">
      <div class="exam-card-info">
        <span class="exam-card-name">${nomeFormatado}</span>
        <span class="exam-card-badge">${qtdQuestoes} questões</span>
      </div>
      <span class="exam-card-chevron">▼</span>
    </div>
    <div class="exam-card-body" style="display: none;">
      <div class="exam-questions-loading">
        <div class="spinner-sm"></div>
        Carregando questões...
      </div>
      <div class="exam-questions-list"></div>
    </div>
  `;

  // Toggle accordion
  card.querySelector(".exam-card-header")?.addEventListener("click", () => {
    toggleExamCard(card, nomeProva);
  });

  return card;
}

/**
 * Toggle do accordion
 */
async function toggleExamCard(card, nomeProva) {
  const body = card.querySelector(".exam-card-body");
  const chevron = card.querySelector(".exam-card-chevron");
  const isExpanded = body.style.display !== "none";

  // Fecha todos os outros
  document.querySelectorAll(".exam-card-body").forEach((b) => {
    b.style.display = "none";
  });
  document.querySelectorAll(".exam-card-chevron").forEach((c) => {
    c.textContent = "▼";
    c.style.transform = "rotate(0deg)";
  });

  if (isExpanded) {
    body.style.display = "none";
    chevron.style.transform = "rotate(0deg)";
    expandedExam = null;
  } else {
    body.style.display = "block";
    chevron.style.transform = "rotate(180deg)";
    expandedExam = nomeProva;
    await loadExamQuestions(card, nomeProva);
  }
}

/**
 * Carrega questões de uma prova específica
 */
async function loadExamQuestions(card, nomeProva) {
  const loading = card.querySelector(".exam-questions-loading");
  const listContainer = card.querySelector(".exam-questions-list");

  loading.style.display = "flex";
  listContainer.innerHTML = "";

  try {
    const dbRef = ref(db, `questoes/${nomeProva}`);
    const snapshot = await get(dbRef);

    // Carrega em lote o status do Apêndice B para esta prova
    let statusMap = {};
    try {
      const statusRef = ref(db, `experimentos_apendice_b_status/${nomeProva}`);
      const statusSnapshot = await get(statusRef);
      if (statusSnapshot.exists()) {
        statusMap = statusSnapshot.val();
      }
    } catch (err) {
      console.warn("Erro ao buscar status do apêndice B:", err);
    }

    loading.style.display = "none";

    if (snapshot.exists()) {
      const questoes = snapshot.val();

      Object.entries(questoes).forEach(([idQuestao, fullData]) => {
        if (!fullData.dados_questao) return;

        const hasApendiceB = !!statusMap[idQuestao];
        const questionItem = createQuestionItem(idQuestao, fullData, nomeProva, hasApendiceB);
        listContainer.appendChild(questionItem);
      });
    } else {
      listContainer.innerHTML = `<p class="add-questions-empty">Sem questões</p>`;
    }
  } catch (e) {
    console.error("Erro ao carregar questões:", e);
    loading.style.display = "none";
    listContainer.innerHTML = `<p class="add-questions-error">Erro: ${e.message}</p>`;
  }
}

/**
 * Cria item de questão
 */
function createQuestionItem(idQuestao, fullData, nomeProva, hasApendiceB = false) {
  const q = fullData.dados_questao || {};
  const materias = (q.materias_possiveis || []).slice(0, 2).join(", ");

  // Extrai texto do enunciado para preview curto
  let previewText = "";
  if (q.estrutura && q.estrutura.length > 0) {
    for (const bloco of q.estrutura) {
      if (bloco.tipo === "texto" && bloco.conteudo) {
        previewText =
          bloco.conteudo.slice(0, 80) +
          (bloco.conteudo.length > 80 ? "..." : "");
        break;
      }
    }
  } else if (q.enunciado) {
    previewText =
      q.enunciado.slice(0, 80) + (q.enunciado.length > 80 ? "..." : "");
  }

  const questionKey = `${nomeProva}::${idQuestao}`;
  const isSelected = selectedQuestions.has(questionKey);

  const item = document.createElement("div");
  item.className = `question-item ${isSelected ? "selected" : ""}`;
  item.dataset.key = questionKey;

  item.innerHTML = `
    <label class="question-checkbox-wrapper">
      <input type="checkbox" class="question-checkbox" ${isSelected ? "checked" : ""}>
      <span class="question-checkmark"></span>
    </label>
    <div class="question-item-info">
      <div class="question-item-header" style="display: flex; align-items: center; gap: 8px; width: 100%;">
        <span class="question-item-id">${idQuestao}</span>
        ${materias ? `<span class="question-item-tags">${materias}</span>` : ""}
        <span class="apendice-b-status-badge" style="
          margin-left: auto;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: ${hasApendiceB ? "rgba(40, 167, 69, 0.15)" : "rgba(108, 117, 125, 0.1)"};
          color: ${hasApendiceB ? "#28a745" : "#6c757d"};
          border: 1px solid ${hasApendiceB ? "rgba(40, 167, 69, 0.3)" : "rgba(108, 117, 125, 0.2)"};
        ">
          🧪 ${hasApendiceB ? "OK" : "Pendente"}
        </span>
      </div>
      <p class="question-item-preview">${previewText || "Sem texto de preview"}</p>
    </div>
    <button class="question-preview-btn" title="Ver questão completa">
      👁️
    </button>
  `;

  // Checkbox handler
  const checkbox = item.querySelector(".question-checkbox");
  checkbox?.addEventListener("change", (e) => {
    e.stopPropagation();
    if (e.target.checked) {
      selectedQuestions.set(questionKey, {
        id: idQuestao,
        prova: nomeProva,
        fullData,
      });
      item.classList.add("selected");
    } else {
      selectedQuestions.delete(questionKey);
      item.classList.remove("selected");
    }
    updateCounter();
  });

  // Preview handler
  const previewBtn = item.querySelector(".question-preview-btn");
  previewBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openQuestionPreview(idQuestao, fullData, nomeProva);
  });

  // Click no item também marca checkbox
  item.addEventListener("click", (e) => {
    if (
      e.target !== checkbox &&
      e.target !== previewBtn &&
      !previewBtn?.contains(e.target)
    ) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  return item;
}

/**
 * Abre preview da questão (modal secundário) usando o card do banco
 */
function openQuestionPreview(idQuestao, fullData, nomeProva) {
  closePreview();

  // Injeta meta se não existir
  if (!fullData.meta) fullData.meta = {};
  if (!fullData.meta.material_origem) {
    fullData.meta.material_origem = nomeProva.replace(/_/g, " ");
  }

  previewOverlay = document.createElement("div");
  previewOverlay.id = "questionPreviewOverlay";
  previewOverlay.className = "question-preview-overlay";

  // Cria container do modal
  const modalContent = document.createElement("div");
  modalContent.className = "question-preview-content question-preview-card";

  // Header com botão fechar
  const header = document.createElement("div");
  header.className = "question-preview-header";
  header.innerHTML = `
    <h3>${nomeProva.replace(/_/g, " ")} - ${idQuestao}</h3>
    <button class="preview-close-btn" id="closeQuestionPreview">✕</button>
  `;
  modalContent.appendChild(header);

  // Body com o card do banco
  const body = document.createElement("div");
  body.className = "question-preview-body";

  // Usa criarCardTecnico do banco de questões
  const card = criarCardTecnico(idQuestao, fullData);
  body.appendChild(card);
  modalContent.appendChild(body);

  previewOverlay.appendChild(modalContent);
  document.body.appendChild(previewOverlay);

  // Renderiza LaTeX
  if (typeof renderLatexIn === "function") {
    renderLatexIn(card);
  }

  // Se for admin, busca o status do Firebase e insere controles
  const uid = auth.currentUser?.uid;
  if (uid) {
    const adminRef = ref(db, `admins/${uid}`);
    get(adminRef).then(async (adminSnap) => {
      const isAdmin = adminSnap.exists() && adminSnap.val() === true;
      if (!isAdmin) return;

      const apendicePanel = document.createElement("div");
      apendicePanel.id = "apendiceBControlPanel";
      apendicePanel.style.cssText = "margin-top: 15px; border-top: 1px dashed var(--color-border); padding-top: 15px; display: flex; flex-direction: column; gap: 12px; width: 100%;";
      body.appendChild(apendicePanel);

      // Carrega status
      try {
        const statusRef = ref(db, `experimentos_apendice_b_status/${nomeProva}/${idQuestao}`);
        const statusSnap = await get(statusRef);
        if (statusSnap.exists()) {
          renderApendiceBConcluido(apendicePanel, nomeProva, idQuestao, fullData);
        } else {
          renderApendiceBPendente(apendicePanel, nomeProva, idQuestao, fullData);
        }
      } catch (err) {
        console.error("Erro ao verificar role admin:", err);
      }
    }).catch(err => console.error("Erro ao verificar role admin:", err));
  }

  // Fecha ao clicar no X ou no overlay
  document
    .getElementById("closeQuestionPreview")
    ?.addEventListener("click", closePreview);
  previewOverlay.addEventListener("click", (e) => {
    if (e.target === previewOverlay) closePreview();
  });

  // Anima entrada
  requestAnimationFrame(() => {
    previewOverlay.classList.add("visible");
  });
}

/**
 * Fecha preview
 */
function closePreview() {
  if (previewOverlay) {
    previewOverlay.classList.remove("visible");
    setTimeout(() => {
      previewOverlay?.remove();
      previewOverlay = null;
    }, 200);
  }
}

/**
 * Atualiza contador de selecionados
 */
function updateCounter() {
  const countEl = document.getElementById("selectedCount");
  const confirmBtn = document.getElementById("confirmAddQuestions");

  if (countEl) countEl.textContent = selectedQuestions.size;
  if (confirmBtn) confirmBtn.disabled = selectedQuestions.size === 0;
}

/**
 * Confirma seleção e retorna questões
 */
function confirmSelection() {
  if (selectedQuestions.size === 0) return;

  const questoesArray = Array.from(selectedQuestions.values());

  // Dispara evento customizado
  window.dispatchEvent(
    new CustomEvent("questions-selected", {
      detail: { questions: questoesArray },
    }),
  );

  closeAddQuestionsModal();
}

// ==========================================
// FUNÇÕES AUXILIARES DO APÊNDICE B (ADMIN)
// ==========================================

function renderApendiceBPendente(container, nomeProva, idQuestao, fullData) {
  container.innerHTML = `
    <div style="background: rgba(255, 193, 7, 0.08); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px; color: #ffc107; font-family: system-ui, sans-serif;">
      <span style="font-size: 1.25rem;">⚠️</span>
      <div style="font-size: 0.85rem; font-weight: 500;">
        Este item ainda não possui experimento do Apêndice B executado.
      </div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn btn--primary" id="btnRodarApendiceB" style="flex: 1; padding: 10px 16px; font-weight: bold; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 6px; cursor: pointer;">
        🚀 Rodar Apêndice B (Gemma 4 31B IT)
      </button>
    </div>
  `;

  container.querySelector("#btnRodarApendiceB").addEventListener("click", () => {
    rodarExperimentoApendiceB(container, nomeProva, idQuestao, fullData);
  });
}

async function rodarExperimentoApendiceB(container, nomeProva, idQuestao, fullData) {
  container.innerHTML = `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; font-family: monospace;">
      <div id="apendiceBStatusText" style="font-size: 0.85rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px;">
        <span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></span>
        <span>Iniciando experimento...</span>
      </div>
      
      <!-- Box de Pensamentos (Thoughts) -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">💭 Cadeia de Raciocínio (Thoughts)</span>
        <div id="apendiceBThoughts" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; height: 180px; overflow-y: auto; font-size: 0.8rem; white-space: pre-wrap; color: var(--color-text-secondary); line-height: 1.4;"></div>
      </div>
      
      <!-- Box do JSON de Resposta -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.75rem; color: var(--color-success); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">📊 Resposta Estruturada (JSON)</span>
        <pre id="apendiceBResponse" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; margin: 0; height: 180px; overflow-y: auto; font-size: 0.8rem; color: #a9ffaf; line-height: 1.4; white-space: pre-wrap;"></pre>
      </div>
    </div>
  `;

  // Estilo para spinner de animação se não houver
  if (!document.getElementById("apendiceBSpinnerStyle")) {
    const style = document.createElement("style");
    style.id = "apendiceBSpinnerStyle";
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }

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

    // Marca checkbox e atualiza o badge na lista principal
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
      renderApendiceBConcluido(container, nomeProva, idQuestao, fullData, result);
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
    retryBtn.onclick = () => rodarExperimentoApendiceB(container, nomeProva, idQuestao, fullData);
    container.appendChild(retryBtn);
  }
}

async function renderApendiceBConcluido(container, nomeProva, idQuestao, fullData, cachedResult = null) {
  let result = cachedResult;

  if (!result) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; font-family: system-ui, sans-serif;">
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
      <div style="background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 12px; color: #dc3545; font-size: 0.85rem; font-family: system-ui, sans-serif;">
        ⚠️ Erro ao carregar dados do experimento no Firebase.
      </div>
      <button class="btn btn--outline" id="btnRetryLoad" style="margin-top: 10px; width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; cursor: pointer; color: var(--color-text);">Tentar Novamente</button>
    `;
    container.querySelector("#btnRetryLoad").onclick = () => renderApendiceBConcluido(container, nomeProva, idQuestao, fullData);
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
      <div style="display: flex; flex-direction: column; gap: 4px; padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: 6px; font-family: system-ui, sans-serif;">
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
    <div style="background: rgba(40, 167, 69, 0.08); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px; color: #28a745; font-family: system-ui, sans-serif;">
      <span style="font-size: 1.25rem;">✅</span>
      <div style="font-size: 0.85rem; font-weight: 500;">
        Apêndice B Executado com Sucesso! (${formattedDate})
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin-top: 5px; font-family: system-ui, sans-serif;">
      <div style="flex: 1; background: rgba(var(--color-primary-rgb), 0.05); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); text-transform: uppercase;">Pontuação Total</div>
        <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-primary);">${scoreData.pontuacao_final_complexidade || 0}/25</div>
      </div>
      <div style="flex: 1; background: rgba(var(--color-primary-rgb), 0.05); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--color-text-secondary); text-transform: uppercase;">Classificação</div>
        <div style="font-size: 1.2rem; font-weight: bold; margin-top: 6px; color: var(--color-text);">${scoreData.classificacao_dificuldade || "N/A"}</div>
      </div>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px; font-family: system-ui, sans-serif;">
      <span style="font-size: 0.75rem; color: var(--color-text-secondary); font-weight: bold;">Critérios do Apêndice B:</span>
      <div style="display: grid; grid-template-columns: 1fr; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 5px;">
        ${rowsHtml}
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; margin-top: 10px; font-family: system-ui, sans-serif;">
      <button class="btn btn--outline" id="btnDownloadDebugJson" style="flex: 1; padding: 8px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 6px; background: none; color: var(--color-text); cursor: pointer;">
        📥 Baixar Debug JSON
      </button>
      <button class="btn btn--secondary btn--outline" id="btnRefazerApendiceB" style="flex: 1; padding: 8px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 6px; background: none; color: var(--color-text); cursor: pointer;">
        🔄 Refazer Triagem
      </button>
    </div>
  `;

  container.querySelector("#btnDownloadDebugJson").onclick = () => {
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

  container.querySelector("#btnRefazerApendiceB").onclick = () => {
    rodarExperimentoApendiceB(container, nomeProva, idQuestao, fullData);
  };
}
