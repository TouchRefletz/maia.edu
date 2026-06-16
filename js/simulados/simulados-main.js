/**
 * Módulo de Interface e Lógica de Simulados (Maia.edu)
 * Controla o dashboard, criação, simulação online e compartilhamento
 */

import {
  get,
  ref,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { db, bancoState, auth, onAuthStateChanged } from "../main.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { renderUserButton, loadSidebarChats } from "../app/telas.js";
import {
  renderizarEstruturaHTML,
  renderizar_estrutura_alternativa,
} from "../render/structure.js";
import { gerarPDFSimulado } from "./pdf-generator.js";
import { showConfirmModal } from "../ui/modal-confirm.js";
import { showGenericModal } from "../ui/modal-generic.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";

// Estado local do módulo
let questionsPool = []; // Todas as questões do banco
let selectedQuestions = []; // Questões adicionadas ao simulado atual
let simuladoTitle = "Simulado Maia";
let simuladoType = "teste"; // 'teste' (objetiva) ou 'dissertativa'

// Estado da sessão de simulação ativa (aluno fazendo prova)
let activeSimIndex = 0;
let studentAnswers = {}; // key: questionId, value: escolhida (letter ou text)
let isResultPhase = false;

// Inicializa a aba de simulados
export async function iniciarModoSimulados() {
  // Para qualquer animação de sugestão da tela inicial
  try {
    const { stopSuggestionRotation } = await import("../ui/dynamic-suggestions.js");
    stopSuggestionRotation();
  } catch (e) {}

  document.body.innerHTML = "";
  const viewer = document.getElementById("pdfViewerContainer");
  if (viewer) viewer.remove();

  // Renderiza layout básico do Dashboard (Split View)
  const dashboardHtml = `
    <!-- Botão Hamburger -->
    <button class="hamburger-btn js-toggle-nav" aria-label="Abrir menu">☰</button>
    
    <!-- Botão Sair -->
    <button class="exit-btn js-voltar-inicio" aria-label="Sair da tela de simulados" title="Voltar para a Página Inicial">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      <span>Sair</span>
    </button>
    
    <!-- Overlay escuro -->
    <div class="nav-sidebar-overlay js-close-nav"></div>
    
    <!-- Sidebar Navigation -->
    <nav class="nav-sidebar">
      <button class="nav-sidebar-close-btn js-close-nav" aria-label="Fechar menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div class="nav-sidebar-header">
        <div class="nav-brand-group">
            <img src="logo.png" alt="Logo" class="nav-sidebar-logo">
            <span class="nav-sidebar-title">Maia<strong>.edu</strong></span>
        </div>
        <div id="navUserSection" class="nav-user-section">
            <!-- Injected via JS -->
            <button class="nav-header-key-btn js-config-api" title="Configurar Chave API">
                🔑
            </button>
        </div>
      </div>
      <div class="nav-sidebar-items">
        <button class="nav-sidebar-item nav-item--home js-voltar-inicio">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">
            <span class="nav-title">Página Inicial</span>
            <span class="nav-desc">Estudos e Conversação IA</span>
          </span>
        </button>
        <button class="nav-sidebar-item nav-item--banco js-iniciar-estudante">
          <span class="nav-icon">📚</span>
          <span class="nav-label">
            <span class="nav-title">Banco de Questões</span>
            <span class="nav-desc">Repertório completo</span>
          </span>
        </button>
        <button class="nav-sidebar-item nav-item--search js-iniciar-busca">
          <span class="nav-icon">🔍</span>
          <span class="nav-label">
            <span class="nav-title">Pesquisar Questões</span>
            <span class="nav-desc">Busque e extraia da web</span>
          </span>
        </button>
        <button class="nav-sidebar-item nav-item--upload js-iniciar-upload">
          <span class="nav-icon">✨</span>
          <span class="nav-label">
            <span class="nav-title">Extrair Exercícios</span>
            <span class="nav-desc">Através de IA em arquivos PDF</span>
          </span>
        </button>
        <button class="nav-sidebar-item nav-item--revisao js-iniciar-revisao">
          <span class="nav-icon">📝</span>
          <span class="nav-label">
            <span class="nav-title">Revisar Questões</span>
            <span class="nav-desc">Valide e corrigja dados</span>
          </span>
        </button>
        <button class="nav-sidebar-item nav-item--simulados active">
          <span class="nav-icon">🎯</span>
          <span class="nav-label">
            <span class="nav-title">Simulados</span>
            <span class="nav-desc">Monte provas e gere PDFs</span>
          </span>
        </button>
        <a href="/docs/" target="_blank" class="nav-sidebar-item" style="text-decoration: none; color: inherit;">
          <span class="nav-icon">📖</span>
          <span class="nav-label">
            <span class="nav-title">Documentação</span>
            <span class="nav-desc">Guias, tutoriais e manuais</span>
          </span>
        </a>
        
        <div class="nav-divider" style="height: 1px; background: var(--color-border); margin: 10px 0;"></div>
        <div class="nav-section-title" style="padding: 0 16px; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Histórico</div>
        <div id="navChatList" class="nav-chat-list" style="display:flex; flex-direction:column; gap:4px;"></div>
      </div>
    </nav>

    <!-- Layout Dividido -->
    <div class="simulados-layout fade-in">
      
      <!-- Painel Esquerdo: Busca de questões -->
      <div class="simulados-bank-pane">
        <div class="simulados-bank-header">
          <h2 style="margin:0 0 10px 0; font-size:1.4rem;">Banco de Exercícios</h2>
          <div class="simulados-bank-search-row">
            <input type="text" class="simulados-search-input" id="simSearchInput" placeholder="Buscar por termo ou ID...">
            <select class="simulados-subject-select" id="simSubjectSelect">
              <option value="">Todas as matérias</option>
            </select>
          </div>
        </div>
        <div class="simulados-bank-list" id="simBankList">
          <div style="text-align:center; padding: 40px; color:var(--color-text-secondary);">
            <div class="spinner" style="margin: 0 auto 10px auto;"></div>
            Carregando banco de questões do servidor...
          </div>
        </div>
      </div>

      <!-- Painel Direito: Lista de Questões Selecionadas -->
      <div class="simulados-sidebar-pane">
        <div class="simulados-config-section">
          <h3 style="margin:0; font-size: 1.1rem; color: var(--color-text-shine);">Configurar Simulado</h3>
          <input type="text" class="simulados-input-title" id="simTitleInput" value="${simuladoTitle}" placeholder="Título do Simulado">
        </div>

        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 8px; display:flex; justify-content:space-between;">
          <span>Questões Selecionadas</span>
          <span id="selectedCount" style="color:var(--color-primary);">0</span>
        </div>

        <div class="simulados-selected-list" id="simSelectedList">
          <div style="text-align:center; padding: 30px; color:var(--color-text-secondary); border: 2px dashed var(--color-border); border-radius:8px; font-size:12px;">
            Nenhuma questão adicionada ainda. Clique em "+" ao lado de uma questão no painel esquerdo para começar!
          </div>
        </div>

        <div class="simulados-actions-section">
          <button class="simulados-btn-primary" id="btnSimularOnline" disabled>
            ⚡ Iniciar Simulação Online
          </button>
          <div style="display:flex; gap:8px;">
            <button class="simulados-btn-secondary" id="btnPDFProva" style="flex:1;" disabled>🖨️ PDF Prova</button>
            <button class="simulados-btn-secondary" id="btnPDFGabarito" style="flex:1;" disabled>🔑 PDF Gabarito</button>
          </div>
          <button class="simulados-btn-secondary" id="btnCopiarLink" disabled>🔗 Compartilhar Prova</button>
        </div>
      </div>

    </div>
  `;

  document.body.innerHTML = dashboardHtml;

  // Carrega e preenche o pool se vazio
  if (questionsPool.length === 0) {
    await fetchQuestionsPool();
  } else {
    renderQuestionsBankList();
    populateSubjectDropdown();
  }

  renderSelectedList();
  setupDashboardListeners();

  // Inicializa o menu lateral completo (User Section e Chats Recentes)
  renderUserButton(auth.currentUser);
  onAuthStateChanged(auth, (user) => {
    renderUserButton(user);
  });
  loadSidebarChats().catch(console.error);
}

// Busca questões diretamente do Firebase RTDB
async function fetchQuestionsPool() {
  try {
    const dbRef = ref(db, "questoes");
    const snapshot = await get(dbRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      questionsPool = [];

      Object.entries(data).forEach(([nomeProva, mapQuestoes]) => {
        if (mapQuestoes && typeof mapQuestoes === "object") {
          Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {
            if (!fullData.dados_questao) return;

            // Injeta dados de prova se faltarem
            if (!fullData.meta) fullData.meta = {};
            if (!fullData.meta.material_origem) {
              fullData.meta.material_origem = nomeProva.replace(/_/g, " ");
            }

            const materias = fullData.dados_questao.materias_possiveis || [];
            const textPreview =
              (fullData.dados_questao.estrutura || [])
                .map((b) => b.conteudo || "")
                .join(" ") ||
              fullData.dados_questao.enunciado ||
              "";

            questionsPool.push({
              id: idQuestao,
              prova: nomeProva,
              fullData: fullData,
              subjects: materias,
              text: textPreview,
            });
          });
        }
      });
      
      // Inverte para as mais recentes virem primeiro
      questionsPool.reverse();
    }

    renderQuestionsBankList();
    populateSubjectDropdown();
  } catch (e) {
    console.error("Erro fetchQuestionsPool:", e);
    const container = document.getElementById("simBankList");
    if (container) {
      container.innerHTML = `<p style="color:var(--color-error); text-align:center;">Erro ao carregar banco: ${e.message}</p>`;
    }
  }
}

// Preenche o seletor de matérias
function populateSubjectDropdown() {
  const select = document.getElementById("simSubjectSelect");
  if (!select) return;

  const subjects = new Set();
  questionsPool.forEach((q) => {
    (q.subjects || []).forEach((s) => subjects.add(s));
  });

  const sortedSubjects = Array.from(subjects).sort();
  sortedSubjects.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

// Renderiza a listagem de questões do banco (com filtros aplicados)
function renderQuestionsBankList() {
  const container = document.getElementById("simBankList");
  if (!container) return;

  const queryText = (document.getElementById("simSearchInput")?.value || "")
    .trim()
    .toLowerCase();
  const subjectFilter =
    document.getElementById("simSubjectSelect")?.value || "";

  const filtered = questionsPool.filter((q) => {
    // Filtro por Matéria
    if (subjectFilter && !(q.subjects || []).includes(subjectFilter)) {
      return false;
    }
    // Filtro por Texto / ID
    if (queryText) {
      const idMatch = String(q.id).toLowerCase().includes(queryText);
      const textMatch = q.text.toLowerCase().includes(queryText);
      const subMatch = (q.subjects || [])
        .join(" ")
        .toLowerCase()
        .includes(queryText);
      return idMatch || textMatch || subMatch;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--color-text-secondary);">Nenhuma questão correspondente encontrada.</div>`;
    return;
  }

  container.innerHTML = "";
  filtered.forEach((q) => {
    const isAdded = selectedQuestions.some(
      (sq) => sq.id === q.id && sq.prova === q.prova
    );

    const card = document.createElement("div");
    card.className = "simulados-item-card";

    // Pega o início do enunciado
    let textShort = q.text;
    if (textShort.length > 90) textShort = textShort.substring(0, 90) + "...";

    const labelMateria = q.subjects[0]
      ? `<span class="simulados-item-tag">${q.subjects[0]}</span>`
      : "";

    card.innerHTML = `
      <div class="simulados-item-info">
        <div class="simulados-item-meta">
          <span class="simulados-item-id">${q.id}</span>
          <span>•</span>
          <span>${q.fullData.meta?.material_origem || "Banco"}</span>
          ${labelMateria}
        </div>
        <div class="simulados-item-text markdown-content"></div>
      </div>
      <div class="simulados-item-actions" style="display:flex; gap:8px; align-items:center;">
        <button class="simulados-preview-btn" title="Visualizar Questão" style="
          background: rgba(255,255,255,0.05); 
          color: var(--color-text-secondary); 
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: all var(--duration-fast);
          display: flex; align-items: center; justify-content: center;
        ">
          👁️
        </button>
        <button class="simulados-add-btn ${isAdded ? "added" : ""}" 
                data-id="${q.id}" data-prova="${q.prova}">
          ${isAdded ? "Adicionado" : "Adicionar +"}
        </button>
      </div>
    `;

    // Configura o texto com markdown de forma segura
    const textDiv = card.querySelector(".simulados-item-text");
    textDiv.setAttribute("data-raw", textShort);
    textDiv.textContent = textShort;

    // Clique no card
    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".simulados-add-btn") ||
        e.target.closest(".simulados-preview-btn")
      ) {
        return;
      }
      toggleAddQuestion(q);
    });

    // Clique no botão visualizar
    card.querySelector(".simulados-preview-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      showQuestionPreviewModal(q);
    });

    // Clique no botão adicionar
    card.querySelector(".simulados-add-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isAdded) toggleAddQuestion(q);
    });

    container.appendChild(card);
  });

  // Renderiza LaTeX no banco compacto se necessário
  renderLatexIn(container);
}

// Abre um popup (modal genérica) para exibir a questão com enunciado (Markdown/LaTeX) e alternativas/gabarito
function showQuestionPreviewModal(qObj) {
  const q = qObj.fullData?.dados_questao || {};
  const qId = qObj.id;
  const labelMateria = qObj.subjects[0] ? ` • ${qObj.subjects[0]}` : "";
  const title = `Visualização da Questão ${qId}${labelMateria}`;

  // Container principal do preview
  const previewContainer = document.createElement("div");
  previewContainer.className = "question-preview-modal-body";
  previewContainer.style.cssText = "display: flex; flex-direction: column; gap: 20px; color: var(--color-text);";

  // Enunciado / Corpo da questão
  const bodyDiv = document.createElement("div");
  bodyDiv.className = "simulados-exam-q-body";
  bodyDiv.innerHTML = renderizarEstruturaHTML(
    q.estrutura,
    q.fotos_originais || [],
    "simulado_q_preview",
    true
  );

  previewContainer.appendChild(bodyDiv);

  // Alternativas ou Campo Dissertativo
  const isQDissert =
    q.tipo_resposta === "dissertativa" ||
    !q.alternativas ||
    q.alternativas.length === 0;

  if (isQDissert) {
    const essayDiv = document.createElement("div");
    essayDiv.innerHTML = `
      <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary); text-transform: uppercase;">Questão Dissertativa</h4>
      <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: 8px; font-style: italic; color: var(--color-text-secondary);">
        Esta questão requer resposta dissertativa.
      </div>
    `;
    previewContainer.appendChild(essayDiv);
  } else {
    const optionsDiv = document.createElement("div");
    optionsDiv.className = "simulados-exam-options";
    
    // Gabarito oficial se disponível
    const correta = qObj.fullData?.dados_gabarito?.alternativa_correta || "";

    (q.alternativas || []).forEach((alt) => {
      const letter = String(alt.letra || "").trim().toUpperCase();
      let altText = "";
      if (alt.estrutura) {
        altText = renderizar_estrutura_alternativa(
          alt.estrutura,
          letter,
          [],
          "banco"
        );
      } else {
        altText = alt.texto || "";
      }

      const isCorrect = letter === correta;

      const optBtn = document.createElement("div");
      optBtn.className = `simulados-exam-opt-btn ${isCorrect ? "correct" : ""}`;
      optBtn.style.cssText = `
        pointer-events: none;
        cursor: default;
        margin-bottom: 8px;
        ${isCorrect ? "border-color: var(--color-success) !important; background: rgba(var(--color-success-rgb), 0.08) !important;" : ""}
      `;

      optBtn.innerHTML = `
        <span class="simulados-exam-opt-letter" style="${isCorrect ? "color: var(--color-success);" : ""}">${letter})</span>
        <div class="simulados-exam-opt-content">${altText}</div>
        ${isCorrect ? `<span style="color: var(--color-success); font-weight: bold; margin-left: auto; font-size: 12px; display: flex; align-items: center; gap: 4px;">✔ Gabarito</span>` : ""}
      `;

      optionsDiv.appendChild(optBtn);
    });

    previewContainer.appendChild(optionsDiv);
  }

  // Se tiver Gabarito/Resolução, exibe a seção correspondente
  const g = qObj.fullData?.dados_gabarito || {};
  if ((g.explicacao && g.explicacao.length > 0) || g.resposta_modelo || g.respostaModelo) {
    const gabaritoDiv = document.createElement("div");
    gabaritoDiv.style.cssText = "margin-top: 10px; border-top: 1px dashed var(--color-border); padding-top: 15px;";
    
    gabaritoDiv.innerHTML = renderGabaritoCardSection(qObj, `preview_${qId}`);
    previewContainer.appendChild(gabaritoDiv);
  }

  // Abre a modal genérica
  showGenericModal({
    title,
    content: previewContainer,
    maxWidth: "90%"
  });

  // Renderiza Markdown/LaTeX após a inserção no DOM
  renderLatexIn(previewContainer);
}

// Adiciona ou remove questão do simulado
function toggleAddQuestion(q) {
  const index = selectedQuestions.findIndex(
    (sq) => sq.id === q.id && sq.prova === q.prova
  );

  if (index === -1) {
    selectedQuestions.push(q);
  } else {
    selectedQuestions.splice(index, 1);
  }

  renderQuestionsBankList();
  renderSelectedList();
}

// Renderiza a lista de selecionadas no painel direito
function renderSelectedList() {
  const container = document.getElementById("simSelectedList");
  const countSpan = document.getElementById("selectedCount");
  if (!container) return;

  if (countSpan) countSpan.textContent = selectedQuestions.length;

  // Atualiza desabilitar botões
  const hasItems = selectedQuestions.length > 0;
  document.getElementById("btnSimularOnline").disabled = !hasItems;
  document.getElementById("btnPDFProva").disabled = !hasItems;
  document.getElementById("btnPDFGabarito").disabled = !hasItems;
  document.getElementById("btnCopiarLink").disabled = !hasItems;

  if (!hasItems) {
    container.innerHTML = `
      <div style="text-align:center; padding: 30px; color:var(--color-text-secondary); border: 2px dashed var(--color-border); border-radius:8px; font-size:12px;">
        Nenhuma questão adicionada ainda. Clique em "+" ao lado de uma questão no painel esquerdo para começar!
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  selectedQuestions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "simulados-selected-card";

    let titleText = q.text;
    if (titleText.length > 40) titleText = titleText.substring(0, 40) + "...";

    card.innerHTML = `
      <span class="simulados-selected-num">${idx + 1}</span>
      <div class="simulados-selected-info" title="${q.id}: ${q.text}">
        <strong>${q.id}</strong>: ${titleText}
      </div>
      <div class="simulados-selected-controls">
        <button class="simulados-ctrl-btn move-up" data-idx="${idx}" title="Mover para Cima">🔼</button>
        <button class="simulados-ctrl-btn move-down" data-idx="${idx}" title="Mover para Baixo">🔽</button>
        <button class="simulados-ctrl-btn remove" data-idx="${idx}" title="Remover">❌</button>
      </div>
    `;

    // Click handlers para controles
    card.querySelector(".move-up").addEventListener("click", () => moveQuestion(idx, -1));
    card.querySelector(".move-down").addEventListener("click", () => moveQuestion(idx, 1));
    card.querySelector(".remove").addEventListener("click", () => {
      selectedQuestions.splice(idx, 1);
      renderQuestionsBankList();
      renderSelectedList();
    });

    container.appendChild(card);
  });
}

// Move questão para cima ou baixo
function moveQuestion(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= selectedQuestions.length) return;

  const temp = selectedQuestions[index];
  selectedQuestions[index] = selectedQuestions[targetIndex];
  selectedQuestions[targetIndex] = temp;

  renderSelectedList();
}

// Detecta dinamicamente o tipo de simulado com base nas questões selecionadas
function detectarSimuladoType(questoes) {
  if (!questoes || questoes.length === 0) return "teste";
  const hasObjective = questoes.some((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    return !(q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0);
  });
  const hasWritten = questoes.some((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    return q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;
  });

  if (hasObjective && hasWritten) return "misto";
  if (hasWritten) return "dissertativa";
  return "teste";
}

// Configura ouvintes da aba Dashboard
function setupDashboardListeners() {
  const searchInput = document.getElementById("simSearchInput");
  const subjectSelect = document.getElementById("simSubjectSelect");
  const titleInput = document.getElementById("simTitleInput");

  if (searchInput) {
    searchInput.addEventListener("input", renderQuestionsBankList);
  }
  if (subjectSelect) {
    subjectSelect.addEventListener("change", renderQuestionsBankList);
  }

  if (titleInput) {
    titleInput.addEventListener("input", (e) => {
      simuladoTitle = e.target.value;
    });
  }

  // Ações
  document.getElementById("btnPDFProva")?.addEventListener("click", () => {
    const activeType = detectarSimuladoType(selectedQuestions);
    gerarPDFSimulado({ titulo: simuladoTitle, tipo: activeType, questoes: selectedQuestions }, false);
  });

  document.getElementById("btnPDFGabarito")?.addEventListener("click", () => {
    const activeType = detectarSimuladoType(selectedQuestions);
    gerarPDFSimulado({ titulo: simuladoTitle, tipo: activeType, questoes: selectedQuestions }, true);
  });

  document.getElementById("btnSimularOnline")?.addEventListener("click", () => {
    const activeType = detectarSimuladoType(selectedQuestions);
    iniciarSimulacaoOnline(selectedQuestions, activeType, simuladoTitle);
  });

  document.getElementById("btnCopiarLink")?.addEventListener("click", (e) => {
    const activeType = detectarSimuladoType(selectedQuestions);
    const ids = selectedQuestions.map((q) => `${q.prova}:${q.id}`).join(",");
    const shareUrl = `${window.location.origin}${window.location.pathname}?mode=simular&type=${activeType}&title=${encodeURIComponent(simuladoTitle)}&ids=${ids}`;
    
    // Mostra o link num popup simples estilizado
    const container = e.target.parentElement;
    const oldContainer = document.getElementById("shareLinkBox");
    if (oldContainer) oldContainer.remove();

    const linkBoxHtml = `
      <div id="shareLinkBox" class="simulados-share-url-container fade-in">
        <input type="text" class="simulados-share-url-input" value="${shareUrl}" readonly id="shareUrlInput">
        <button class="simulados-btn-primary" style="padding:6px 12px; font-size:11px; width:auto; margin:0;" id="btnCopyExec">Copiar</button>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", linkBoxHtml);

    const input = document.getElementById("shareUrlInput");
    input.select();

    document.getElementById("btnCopyExec").addEventListener("click", () => {
      navigator.clipboard.writeText(shareUrl);
      customAlert("✅ Link copiado com sucesso!", 2000);
      document.getElementById("shareLinkBox").remove();
    });
  });
}

// ========================================================
// SESSÃO DE RESOLUÇÃO ONLINE (PLAYER DE SIMULADO)
// ========================================================

export function iniciarSimulacaoOnline(questoes, tipo, titulo) {
  // 1. Zera estados de simulado
  activeSimIndex = 0;
  studentAnswers = {};
  isResultPhase = false;

  // 2. Registra as questões no cache local do banco para garantir que
  // as funções nativas de correção/explicacao de card funcionem (interacoes.js)
  questoes.forEach((q) => {
    if (!bancoState.todasQuestoesCache.some((x) => x.key === q.id)) {
      bancoState.todasQuestoesCache.push({ key: q.id, ...q.fullData });
    }
  });

  renderExamUI(questoes, tipo, titulo);
}

// Renderiza a casca do simulador
function renderExamUI(questoes, tipo, titulo) {
  document.body.innerHTML = "";
  
  const container = document.createElement("div");
  container.className = "simulados-exam-container";
  document.body.appendChild(container);

  renderActiveExamQuestion(container, questoes, tipo, titulo);
}

// Renderiza a questão ativa e os botões de navegação
function renderActiveExamQuestion(container, questoes, tipo, titulo) {
  const total = questoes.length;
  const qObj = questoes[activeSimIndex];
  const q = qObj.fullData?.dados_questao || {};
  const qId = qObj.id;
  const cardId = `q_${qId}`;

  // Calcula progresso
  const totalRespondidas = Object.keys(studentAnswers).length;

  let contentHtml = "";

  if (isResultPhase) {
    // FASE DE GABARITO (RESULTADO)
    // Mostra se o aluno acertou ou errou na parte superior
    const isQDissert =
      q.tipo_resposta === "dissertativa" ||
      !q.alternativas ||
      q.alternativas.length === 0;

    let correcaoHeaderHtml = "";
    if (isQDissert) {
      correcaoHeaderHtml = `
        <div style="background:rgba(var(--color-primary-rgb),0.08); border:1px solid var(--color-border); border-radius:8px; padding:15px; margin-bottom:20px;">
          <h4 style="margin:0 0 8px 0; color:var(--color-primary);">Sua resposta descrita:</h4>
          <p style="font-style:italic; margin:0; line-height:1.5; font-size:13px; color:var(--color-text); white-space:pre-wrap;">${
            studentAnswers[qId] || "Sem resposta rascunhada."
          }</p>
        </div>
      `;
    } else {
      const escolheu = studentAnswers[qId] || "Nenhuma";
      const correta = qObj.fullData.dados_gabarito?.alternativa_correta || "";
      const acertou = escolheu === correta;

      correcaoHeaderHtml = `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-radius:8px; margin-bottom:20px; font-weight:bold;
             background:${
               acertou ? "rgba(40,167,69,0.08)" : "rgba(220,53,69,0.08)"
             };
             border:1px solid ${acertou ? "var(--color-success)" : "var(--color-error)"};
             color:${acertou ? "var(--color-success)" : "var(--color-error)"};">
          <span style="font-size:20px;">${acertou ? "✅" : "❌"}</span>
          <span>Sua Resposta: ${escolheu} ${
        acertou ? "(Correto)" : `(Incorreto. O gabarito é: ${correta})`
      }</span>
        </div>
      `;
    }

    // Estrutura do card com gabarito oficial visível
    const { card, htmlAlts } = prepareResultAlternativesHtml(qObj, q, cardId);

    contentHtml = `
      <div class="simulados-exam-card fade-in" id="card_${qId}">
        <div class="simulados-exam-q-num">Questão ${String(activeSimIndex + 1).padStart(2, "0")}</div>
        <div class="simulados-exam-q-body">
          ${renderizarEstruturaHTML(
            q.estrutura,
            q.fotos_originais || [],
            "simulado_q_view",
            true
          )}
        </div>

        ${correcaoHeaderHtml}

        <div class="q-options" id="${cardId}_opts" style="margin-bottom:20px;">
          ${htmlAlts}
        </div>

        <!-- Gabarito / Resolução Completa -->
        ${renderGabaritoCardSection(qObj, cardId)}
      </div>
    `;
  } else {
    // FASE DE RESOLUÇÃO (TESTANDO CONHECIMENTO)
    let workspaceHtml = "";

    const isQDissert =
      q.tipo_resposta === "dissertativa" ||
      !q.alternativas ||
      q.alternativas.length === 0;

    if (isQDissert) {
      workspaceHtml = `
        <textarea 
          class="simulados-exam-essay-input" 
          id="simEssayArea"
          placeholder="Escreva ou rascunhe sua resposta dissertativa aqui..."
        >${studentAnswers[qId] || ""}</textarea>
      `;
    } else {
      workspaceHtml = `
        <div class="simulados-exam-options">
          ${(q.alternativas || [])
            .map((alt) => {
              const letter = String(alt.letra || "")
                .trim()
                .toUpperCase();
              let altText = "";
              if (alt.estrutura) {
                altText = renderizar_estrutura_alternativa(
                  alt.estrutura,
                  letter,
                  [],
                  "banco"
                );
              } else {
                altText = alt.texto || "";
              }

              const isSelected = studentAnswers[qId] === letter;

              return `
              <button class="simulados-exam-opt-btn ${
                isSelected ? "selected" : ""
              }" data-letter="${letter}">
                <span class="simulados-exam-opt-letter">${letter})</span>
                <div class="simulados-exam-opt-content">${altText}</div>
              </button>`;
            })
            .join("")}
        </div>
      `;
    }

    contentHtml = `
      <div class="simulados-exam-card fade-in">
        <div class="simulados-exam-q-num">Questão ${activeSimIndex + 1} de ${total}</div>
        <div class="simulados-exam-q-body">
          ${renderizarEstruturaHTML(
            q.estrutura,
            q.fotos_originais || [],
            "simulado_q_solve",
            true
          )}
        </div>
        ${workspaceHtml}
      </div>
    `;
  }

  // Injeta na casca
  container.innerHTML = `
    <div class="simulados-exam-header">
      <div class="simulados-exam-title-group">
        <span class="simulados-exam-title">${titulo}</span>
        <span class="simulados-exam-progress-text">Progresso: ${totalRespondidas}/${total} respondidas</span>
      </div>
      <button class="simulados-btn-secondary" style="padding:6px 12px; width:auto;" id="btnAbortExam">Sair</button>
    </div>

    ${contentHtml}

    <!-- Menu Inferior (Bottom Nav) -->
    <div class="simulados-bottom-nav">
      <button class="simulados-nav-btn" id="btnSimPrev" ${
        activeSimIndex === 0 ? "disabled" : ""
      }>
        ← Voltar
      </button>

      <div class="simulados-nav-dots" id="simNavDots">
        ${questoes
          .map((_, i) => {
            const hasAns = studentAnswers[questoes[i].id] !== undefined;
            let dotClass = "";
            if (activeSimIndex === i) dotClass = "active";
            else if (hasAns) dotClass = "answered";

            // Cores do resultado no gabarito
            if (isResultPhase) {
              const qs = questoes[i];
              const qst = qs.fullData?.dados_questao || {};
              const isQD =
                qst.tipo_resposta === "dissertativa" ||
                !qst.alternativas ||
                qst.alternativas.length === 0;

              if (isQD) {
                dotClass += " answered";
              } else {
                const escolheu = studentAnswers[qs.id];
                const correta = qs.fullData.dados_gabarito?.alternativa_correta;
                if (escolheu === correta) {
                  dotClass += " correct";
                } else {
                  dotClass += " incorrect";
                }
              }
            }

            return `<span class="simulados-dot ${dotClass}" data-goto="${i}">${
              i + 1
            }</span>`;
          })
          .join("")}
      </div>

      <button class="simulados-nav-btn ${
        activeSimIndex === total - 1 ? "finish" : ""
      }" id="btnSimNext">
        ${
          activeSimIndex === total - 1
            ? isResultPhase
              ? "Resultado Geral"
              : "Finalizar"
            : "Avançar →"
        }
      </button>
    </div>
  `;

  // Compila LaTeX e Marked instantaneamente no corpo inserido
  renderLatexIn(container);

  // Scrolla o dot ativo para ser visível em celulares
  const activeDot = container.querySelector(".simulados-dot.active");
  activeDot?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

  // Event Listeners
  document.getElementById("btnAbortExam").addEventListener("click", async () => {
    const confirmSair = await showConfirmModal(
      "Sair da Simulação",
      "Deseja mesmo sair desta simulação? Todo o progresso será perdido.",
      "Sair",
      "Cancelar",
      false
    );
    if (confirmSair) {
      iniciarModoSimulados();
    }
  });

  // Listener para botões do dot nav
  container.querySelectorAll(".simulados-dot").forEach((dot) => {
    dot.addEventListener("click", (e) => {
      saveActiveResponse(tipo);
      activeSimIndex = Number(e.target.dataset.goto);
      renderActiveExamQuestion(container, questoes, tipo, titulo);
    });
  });

  // Voltar
  document.getElementById("btnSimPrev").addEventListener("click", () => {
    saveActiveResponse(tipo);
    activeSimIndex--;
    renderActiveExamQuestion(container, questoes, tipo, titulo);
  });

  // Avançar / Finalizar
  document.getElementById("btnSimNext").addEventListener("click", () => {
    saveActiveResponse(tipo);
    if (activeSimIndex === total - 1) {
      if (isResultPhase) {
        renderSimResultSummary(container, questoes, tipo, titulo);
      } else {
        finishExamSession(container, questoes, tipo, titulo);
      }
    } else {
      activeSimIndex++;
      renderActiveExamQuestion(container, questoes, tipo, titulo);
    }
  });

  // Clique nas alternativas no modo responder
  const isQDissert = q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;
  if (!isResultPhase && !isQDissert) {
    container.querySelectorAll(".simulados-exam-opt-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const optionBtn = e.target.closest(".simulados-exam-opt-btn");
        const letter = optionBtn.dataset.letter;

        // Desmarca outras
        container.querySelectorAll(".simulados-exam-opt-btn").forEach((b) => {
          b.classList.remove("selected");
        });

        optionBtn.classList.add("selected");
        studentAnswers[qId] = letter;
      });
    });
  }
}

// Salva a resposta da questão ativa atual no buffer
function saveActiveResponse(tipo) {
  const qObj = selectedQuestions[activeSimIndex];
  if (!qObj) return;

  const q = qObj.fullData?.dados_questao || {};
  const isQDissert = q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;

  if (isQDissert) {
    const area = document.getElementById("simEssayArea");
    if (area) {
      const val = area.value.trim();
      if (val) {
        studentAnswers[qObj.id] = val;
      } else {
        delete studentAnswers[qObj.id];
      }
    }
  }
}

// Finaliza a sessão de respostas e computa o gabarito
async function finishExamSession(container, questoes, tipo, titulo) {
  const total = questoes.length;
  const respondidas = Object.keys(studentAnswers).length;

  let msg = `Você respondeu ${respondidas} de ${total} questões.`;
  if (respondidas < total) {
    msg += "\n\nAtenção: Questões não respondidas serão marcadas como erradas.";
  }

  const confirmFinalizar = await showConfirmModal(
    "Finalizar Simulado",
    msg,
    "Finalizar",
    "Voltar para a Prova",
    true
  );

  if (confirmFinalizar) {
    isResultPhase = true;
    activeSimIndex = 0; // Volta para Q1 para revisão
    renderActiveExamQuestion(container, questoes, tipo, titulo);
  }
}

// Prepara o layout das alternativas na tela de gabarito/resultado
function prepareResultAlternativesHtml(qObj, q, cardId) {
  const g = qObj.fullData?.dados_gabarito || {};
  const escolheu = studentAnswers[qObj.id];
  const correta = (g.alternativa_correta || "").trim().toUpperCase();

  const motivoMap = {};
  (g.alternativas_analisadas || []).forEach((aa) => {
    const letraKey = String(aa.letra || "").trim().toUpperCase();
    if (letraKey && aa.motivo) motivoMap[letraKey] = aa.motivo;
  });

  const isQDissert =
    q.tipo_resposta === "dissertativa" ||
    !q.alternativas ||
    q.alternativas.length === 0;

  let htmlAlts = "";

  if (isQDissert) {
    htmlAlts = `
      <div class="q-dissert-container">
        <!-- O textarea deve conter o texto rascunhado pelo aluno para IA ler se clicado -->
        <textarea 
          class="q-dissert-input" 
          readonly
          style="background:rgba(255,255,255,0.03); opacity:0.85;"
          rows="4"
        >${studentAnswers[qObj.id] || ""}</textarea>
        
        <div class="q-dissert-actions">
          <button 
              class="q-dissert-btn q-dissert-btn-simple js-check-dissert-embedding" 
              data-card-id="${cardId}" 
              title="Correção rápida baseada na presença das palavras-chave esperadas"
          >
              <span class="btn-icon">🔑</span> Corrigir Simples (Palavras-Chave)
          </button>
          <button 
              class="q-dissert-btn q-dissert-btn-ai js-check-dissert-ai" 
              data-card-id="${cardId}" 
              title="Correção detalhada usando Inteligência Artificial (Gemini)"
          >
              <span class="btn-icon">🤖</span> Corrigir Completo (com IA)
          </button>
        </div>

        <div class="q-dissert-warning" style="margin-top: 8px; font-size: 0.75rem; color: var(--color-text-secondary); text-align: center; border: 1px dashed var(--color-border); padding: 8px; border-radius: 8px; background: rgba(255, 193, 7, 0.05); display: flex; align-items: center; justify-content: center; gap: 6px;">
            ⚠️ As correções automáticas de respostas dissertativas são baseadas em IA e podem conter imprecisões. <a href="/docs/guia/limitacoes-ia.html#correcao-dissertativa" target="_blank" style="color: var(--color-primary); text-decoration: underline; font-weight: 500;">Saiba mais</a>
        </div>

        <div id="${cardId}_feedback" class="q-dissert-feedback" style="display: none; margin-top:15px;"></div>
      </div>`;
  } else {
    htmlAlts = (q.alternativas || [])
      .map((alt) => {
        const letter = alt.letra.trim().toUpperCase();
        let altHtml = "";
        if (alt.estrutura) {
          altHtml = renderizar_estrutura_alternativa(alt.estrutura, letter, [], "banco");
        } else {
          altHtml = alt.texto || "";
        }

        let stateClass = "";
        if (letter === correta) {
          stateClass = "correct";
        }
        if (letter === escolheu && letter !== correta) {
          stateClass = "incorrect-selected";
        }

        const motivoRaw = motivoMap[letter] || "";

        return `
          <button 
              class="simulados-exam-opt-btn disabled ${stateClass}" 
              disabled
              data-letra="${letter}"
              style="flex-direction: column; align-items: stretch; gap: 8px;"
          >
              <div style="display: flex; align-items: flex-start; width: 100%;">
                <span class="simulados-exam-opt-letter">${letter})</span>
                <div class="simulados-exam-opt-content">${altHtml}</div>
              </div>
              ${
                motivoRaw
                  ? `<div class="q-opt-motivo" style="display:block; margin-top:8px; font-size:11px; opacity:0.8; font-style:italic; padding-left: 28px; width: 100%; border-top: 1px dashed var(--color-border); padding-top: 6px;">${motivoRaw}</div>`
                  : ""
              }
          </button>`;
      })
      .join("");
  }

  return { card: null, htmlAlts };
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Renders the correct answer details, justifications, steps and metadata
function renderGabaritoCardSection(qObj, cardId) {
  const g = qObj.fullData?.dados_gabarito || {};
  const confianca = Math.round((g.confianca || 0) * 100);

  // Converte passos de resolução para HTML
  let passosHtml = "";
  if (g.explicacao && g.explicacao.length > 0) {
    const listPassos = g.explicacao
      .map((p, i) => {
        const est = Array.isArray(p.estrutura)
          ? p.estrutura
          : [{ tipo: "texto", conteudo: p.passo || "" }];

        const stepContentHtml = renderizarEstruturaHTML(est, [], `simulado_step_${i}`, true);

        // Metadados do passo
        const origemLabel = (p.origem || "").includes("extraido")
          ? "📄 Material Original"
          : "🤖 Gerado por IA";
        const origemCor = (p.origem || "").includes("extraido")
          ? "var(--color-success)"
          : "var(--color-primary)";

        return `
          <div class="q-step-wrapper">
            <div class="q-step-header">
              <div class="q-step-bullet">${i + 1}</div>
              <div class="step-content-wrapper" style="flex:1; min-width:0; font-size:13px;">
                ${stepContentHtml}
              </div>
            </div>
            <details class="q-step-details">
              <summary>Metadados</summary>
              <div class="q-step-meta-box">
                <div class="q-step-row">
                  <span class="q-step-key">Origem:</span>
                  <span style="color:${origemCor}; font-weight:bold;">${origemLabel}</span>
                </div>
                ${
                  p.fontematerial
                    ? `<div class="q-step-row"><span class="q-step-key">Fonte:</span><span>${p.fontematerial}</span></div>`
                    : ""
                }
              </div>
            </details>
          </div>`;
      })
      .join("");

    passosHtml = `
      <div style="margin-top:20px;">
        <h4 style="margin:0 0 10px 0; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Etapas de Resolução</h4>
        <div style="display:flex; flex-direction:column; gap:0;">
          ${listPassos}
        </div>
      </div>
    `;
  }

  // Resposta modelo
  const resModeloRaw = g.resposta_modelo || g.respostaModelo || "";
  let respModeloHtml = "";
  if (resModeloRaw) {
    let padronizado = String(resModeloRaw)
      .replace(/```[a-zA-Z]*\n?/g, "")
      .replace(/```/g, "");
    padronizado = padronizado
      .split("\n")
      .map((l) => l.trimStart())
      .join("\n")
      .trim();

    respModeloHtml = `
      <div style="margin-top: 15px;">
        <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Resposta Esperada (Tutor)</h4>
        <div class="markdown-content" data-raw="${escapeHtml(
          padronizado
        )}" style="padding: 10px; background: rgba(34,197,94,0.05); border-left: 3px solid var(--color-success); border-radius: 4px; font-size:13px;"></div>
      </div>
    `;
  }

  // Fontes Externas
  let fontesHtml = "";
  if (g.fontes_externas && g.fontes_externas.length > 0) {
    const listFontes = g.fontes_externas
      .map(
        (f) => `
      <li>
        <a href="${f.uri}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary); text-decoration:none; font-size:0.85rem; display:inline-flex; align-items:center; gap:4px;">
          ${f.title || f.uri} ↗
        </a>
      </li>
    `
      )
      .join("");

    fontesHtml = `
      <div style="margin-top: 15px;">
        <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Fontes Externas</h4>
        <ul style="list-style:none; padding:0; margin:5px 0 0 0; display:flex; flex-direction:column; gap:6px;">
          ${listFontes}
        </ul>
      </div>
    `;
  }

  return `
    <div id="${cardId}_res" style="border-top: 1px dashed var(--color-border); padding-top:15px; margin-top:20px;">
      <h3 style="margin:0 0 12px 0; color:var(--color-primary); font-size:1rem;">Gabarito & Justificativas</h3>
      
      <div>
        <strong>Gabarito Oficial:</strong> ${
          g.alternativa_correta
            ? `Alternativa ${g.alternativa_correta}`
            : "Dissertativa"
        }
        <span style="font-size:11px; color:var(--color-text-secondary); margin-left:8px;">(Confiança IA: ${confianca}%)</span>
      </div>

      <div style="margin-top: 10px; font-size: 13px; line-height: 1.5;">
        <strong>Justificativa:</strong>
        <span class="markdown-content" data-raw="${escapeHtml(
          g.justificativa_curta || "Sem justificativa."
        )}"></span>
      </div>

      ${respModeloHtml}
      ${passosHtml}
      ${fontesHtml}
    </div>
  `;
}

// Renderiza a tela final de resumo do simulado (Score Geral)
function renderSimResultSummary(container, questoes, tipo, titulo) {
  document.body.innerHTML = "";

  const total = questoes.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let hasDissertative = false;

  questoes.forEach((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    const isQD =
      q.tipo_resposta === "dissertativa" ||
      !q.alternativas ||
      q.alternativas.length === 0;

    if (isQD) {
      hasDissertative = true;
    } else {
      const escolheu = studentAnswers[qObj.id];
      const correta = qObj.fullData.dados_gabarito?.alternativa_correta;
      if (escolheu === correta) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
  });

  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  let circularScoreHtml = "";
  let summaryGridHtml = "";

  if (hasDissertative) {
    circularScoreHtml = `
      <div style="font-size: 50px;">📝</div>
      <div style="font-size:18px; font-weight:bold; margin-top:5px;">Simulado Dissertativo</div>
      <div style="font-size:12px; color:var(--color-text-secondary);">Realize a correção individual das questões</div>
    `;

    summaryGridHtml = `
      <div class="simulados-summary-item">
        <span class="simulados-summary-val pending">${total}</span>
        <span class="simulados-summary-lbl">Questões</span>
      </div>
      <div class="simulados-summary-item" style="grid-column: span 2;">
        <span class="simulados-summary-val" style="color:var(--color-primary);">Prontas</span>
        <span class="simulados-summary-lbl">Para avaliação por IA ou chave</span>
      </div>
    `;
  } else {
    circularScoreHtml = `
      <div class="simulados-score-num">${percentage}%</div>
      <div class="simulados-score-label">Acertos</div>
    `;

    summaryGridHtml = `
      <div class="simulados-summary-item">
        <span class="simulados-summary-val correct">${correctCount}</span>
        <span class="simulados-summary-lbl">Acertos</span>
      </div>
      <div class="simulados-summary-item">
        <span class="simulados-summary-val incorrect">${incorrectCount}</span>
        <span class="simulados-summary-lbl">Erros</span>
      </div>
      <div class="simulados-summary-item">
        <span class="simulados-summary-val">${total}</span>
        <span class="simulados-summary-lbl">Total</span>
      </div>
    `;
  }

  const summaryCard = document.createElement("div");
  summaryCard.className = "simulados-exam-container";

  summaryCard.innerHTML = `
    <div class="simulados-results-card fade-in">
      <h2 style="margin:0; font-size:1.6rem; color:var(--color-text-shine);">Resultado do Simulado</h2>
      <p style="margin: -10px 0 10px 0; color:var(--color-text-secondary); font-size:13px;">${titulo}</p>

      <div class="simulados-score-circle">
        ${circularScoreHtml}
      </div>

      <div class="simulados-summary-grid">
        ${summaryGridHtml}
      </div>

      <div style="display:flex; gap:10px; width:100%; max-width:400px; margin-top:10px;">
        <button class="simulados-btn-primary" style="flex:1;" id="btnReviewExam">🔍 Revisar Respostas</button>
        <button class="simulados-btn-secondary" style="flex:1;" id="btnGoBackDash">Voltar ao Painel</button>
      </div>
    </div>
  `;

  document.body.appendChild(summaryCard);

  // Voltar a revisar questões
  document.getElementById("btnReviewExam").addEventListener("click", () => {
    activeSimIndex = 0;
    renderExamUI(questoes, tipo, titulo);
  });

  // Voltar ao dashboard
  document.getElementById("btnGoBackDash").addEventListener("click", () => {
    iniciarModoSimulados();
  });
}

// ========================================================
// CARREGAMENTO DE SIMULADO COMPARTILHADO VIA DEEP LINK
// ========================================================

export async function carregarSimuladoCompartilhado(tipo, titulo, idsString) {
  // Mostra indicador de carregamento
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--color-background);
      color: var(--color-text);
      font-family: sans-serif;
    ">
      <div class="spinner" style="margin-bottom: 20px;"></div>
      <h3 style="margin:0 0 8px 0;">Carregando simulado compartilhado...</h3>
      <p style="font-size:12px; color:var(--color-text-secondary); margin:0;">Buscando as questões no banco de dados.</p>
    </div>
  `;

  try {
    const entries = idsString.split(",");
    const promises = entries.map(async (entry) => {
      const parts = entry.split(":");
      const prova = parts[0];
      const id = parts[1];

      const dbRef = ref(db, `questoes/${prova}/${id}`);
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const fullData = snapshot.val();
        // Garante metadados
        if (!fullData.meta) fullData.meta = {};
        if (!fullData.meta.material_origem) {
          fullData.meta.material_origem = prova.replace(/_/g, " ");
        }

        const q = fullData.dados_questao || {};
        const textPreview = (q.estrutura || [])
          .map((b) => b.conteudo || "")
          .join(" ") ||
          q.enunciado ||
          "";

        return {
          id: id,
          prova: prova,
          fullData: fullData,
          text: textPreview,
        };
      } else {
        console.warn(`Questão não localizada: ${prova}/${id}`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validQuestions = results.filter((q) => q !== null);

    if (validQuestions.length === 0) {
      throw new Error("Nenhuma questão válida encontrada para este simulado.");
    }

    // Copia as questões para as variáveis locais do dashboard
    selectedQuestions = validQuestions;
    simuladoTitle = titulo || "Simulado Compartilhado";
    simuladoType = tipo || detectarSimuladoType(validQuestions);

    // Inicializa a tela de simulados no painel principal
    await iniciarModoSimulados();

  } catch (e) {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--color-background);
        color: var(--color-text);
        font-family: sans-serif;
        padding: 20px;
        text-align: center;
      ">
        <div style="font-size: 40px; margin-bottom: 15px;">⚠️</div>
        <h3 style="margin:0 0 10px 0; color:var(--color-error);">Erro ao carregar simulado</h3>
        <p style="font-size:13px; color:var(--color-text-secondary); margin:0 0 20px 0; max-width:300px; line-height:1.5;">${e.message}</p>
        <button class="simulados-btn-primary" style="width:auto; padding: 10px 20px;" onclick="window.location.href = window.location.origin + window.location.pathname">Página Inicial</button>
      </div>
    `;
  }
}
