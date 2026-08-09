/**
 * Módulo de Interface e Lógica de Simulados (Maia.edu)
 * Controla o dashboard, criação, simulação online e compartilhamento
 */

import { get, ref } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { loadSidebarChats, renderUserButton } from '../app/telas.js';
import { renderLatexIn } from '../libs/loader.tsx';
import { auth, bancoState, db, onAuthStateChanged } from '../main.js';
import { _calcularComplexidade } from '../render/ComplexityCard.tsx';
import { renderizar_estrutura_alternativa, renderizarEstruturaHTML } from '../render/structure.js';
import {
  EloService,
  calcularPerfisEstudante,
  getEloRankTier,
  getEloState,
} from '../services/elo-service.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { showConfirmModal } from '../ui/modal-confirm.js';
import { showGenericModal } from '../ui/modal-generic.js';
import { gerarPDFSimulado } from './pdf-generator.js';
import { gerarSimuladoComIA } from './ai-simulado-generator.js';
import { renderDynamicAspectsCatalog } from './simulados-dinamicos.js';

import { mountModelSelectorModal } from '../ui/ModelSelectorModal.tsx';

function formatModelBadgeName(modelId) {
  if (!modelId) return 'Gemma 4 31B IT';
  if (modelId.includes('gemma-4-31b-it')) return 'Gemma 4 31B IT';
  if (modelId.includes('gemma-4-26b-a4b-it')) return 'Gemma 4 26B';
  if (modelId.includes('gemini-3.5-flash')) return 'Gemini 3.5 Flash';
  if (modelId.includes('gemini-3.1-flash-lite')) return 'Gemini 3.1 Lite';
  if (modelId.includes('gemini-3-flash-preview')) return 'Gemini 3 Preview';
  if (modelId.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  const cleaned = modelId
    .replace(/^models\//, '')
    .replace(/^vertex\//, '')
    .replace(/^puter\//, '');
  return cleaned.length > 18 ? `${cleaned.substring(0, 16)}...` : cleaned;
}

/**
 * Modal de Seleção de Modelo do Simulado via ModelSelectorModal oficial em modo 'simulado'
 */
function showSimuladoModelModal() {
  const currentModel =
    window.selectedModelSimulado ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('selectedModelSimulado') : null) ||
    'models/gemma-4-31b-it';

  mountModelSelectorModal(
    currentModel,
    (newModelId) => {
      window.selectedModelSimulado = newModelId;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('selectedModelSimulado', newModelId);
      }

      // Atualiza os badges na tela
      const badge = document.getElementById('simAiModelBadge');
      if (badge) {
        badge.textContent = `🤖 ${formatModelBadgeName(newModelId)}`;
      }
      const topBadge = document.getElementById('topModelBadge');
      if (topBadge) {
        topBadge.textContent = formatModelBadgeName(newModelId);
      }

      customAlert(`✅ Modelo alterado para ${newModelId.replace('models/', '')}`, 2000);
    },
    'simulado',
  );
}

// Estado local do módulo
let questionsPool = []; // Todas as questões do banco
let selectedQuestions = []; // Questões adicionadas ao simulado atual
let simuladoTitle = 'Simulado Maia.edu';
let simuladoType = 'teste'; // 'teste' (objetiva) ou 'dissertativa'
let evalMethod = 'convencional'; // 'convencional' ou 'maia'

// Estado da sessão de simulação ativa (aluno fazendo prova)
let activeSimIndex = 0;
let studentAnswers = {}; // key: questionId, value: escolhida (letter, text ou {chosen, certainties})
let isResultPhase = false;

// Inicializa a aba de simulados
export async function iniciarModoSimulados() {
  // Para qualquer animação de sugestão da tela inicial
  try {
    const { stopSuggestionRotation } = await import('../ui/dynamic-suggestions.js');
    stopSuggestionRotation();
  } catch (e) {}

  document.body.innerHTML = '';
  const viewer = document.getElementById('pdfViewerContainer');
  if (viewer) viewer.remove();

  const currentSimulatedModel =
    window.selectedModelSimulado ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('selectedModelSimulado') : null) ||
    'models/gemma-4-31b-it';

  // Renderiza layout básico do Dashboard de Simulados
  const dashboardHtml = `
    <div class="simulados-page-container fade-in">
      <!-- Header Superior Integrado com Abas Centralizadas -->
      <header class="simulados-top-header">
        <div class="simulados-top-left">
          <button class="simulados-header-btn js-voltar-inicio" title="Voltar para a Página Inicial">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Voltar ao Início</span>
          </button>
          <div class="simulados-brand-title">
            <img src="logo.png" alt="Logo" class="simulados-brand-logo">
            <span>Maia<strong>.edu</strong></span>
            <span class="simulados-brand-tag">/ Simulados</span>
          </div>
        </div>

        <!-- Seletor de Abas no Header Superior Integrado -->
        <div class="simulados-top-center-tabs">
          <button class="simulados-nav-tab-btn active" id="tabBtnTradicionais" data-tab="tradicionais">
            📝 Simulados Tradicionais
          </button>
          <button class="simulados-nav-tab-btn" id="tabBtnDinamicos" data-tab="dinamicos">
            ⚡ Simulados Dinâmicos
          </button>
        </div>

        <div class="simulados-top-right">
          <button class="simulados-header-btn js-config-model-simulado" id="btnTopConfigModel" title="Configurar Modelo de IA para Simulados">
            ⚙️ Modelo: <strong id="topModelBadge">${formatModelBadgeName(currentSimulatedModel)}</strong>
          </button>
          <button class="simulados-header-btn js-config-api" title="Configurar Chave API">
            🔑 Chave API
          </button>
        </div>
      </header>

      <!-- Container da Aba 1: Simulados Tradicionais -->
      <div class="simulados-tab-pane active" id="tabPaneTradicionais">
        <div class="simulados-layout">
          
          <!-- Painel Esquerdo: Busca de questões -->
          <div class="simulados-bank-pane">
            <!-- Card Gerador de Simulado por IA -->
            <div class="simulados-ai-card">
              <div class="simulados-ai-header">
                <div class="simulados-ai-title-group">
                  <span class="simulados-ai-icon">✨</span>
                  <span class="simulados-ai-title">Montar Simulado com IA</span>
                </div>
                <div class="simulados-ai-model-group">
                  <span class="simulados-ai-model-badge" id="simAiModelBadge" title="Modelo atualmente ativo">
                    🤖 ${formatModelBadgeName(currentSimulatedModel)}
                  </span>
                  <button class="simulados-ai-config-btn js-config-model-simulado" title="Alterar Modelo de IA">
                    ⚙️ Alterar
                  </button>
                </div>
              </div>

              <div class="simulados-ai-body">
                <div class="simulados-ai-input-wrapper">
                  <input 
                    type="text" 
                    class="simulados-ai-input" 
                    id="simAiPromptInput" 
                    placeholder="Ex: 'um simulado de 10 questões sobre embriologia'" />
                  <button class="simulados-ai-submit-btn" id="btnGerarSimuladoIa" title="Gerar Simulado com IA">
                    ✨ Gerar
                  </button>
                </div>

                <!-- Sugestões Rápidas / Chips -->
                <div class="simulados-ai-chips">
                  <button class="simulados-ai-chip" data-prompt="um simulado de 10 questões sobre embriologia">🧬 10 de Embriologia</button>
                  <button class="simulados-ai-chip" data-prompt="15 questões de geometria plana e espacial">📐 15 de Geometria</button>
                  <button class="simulados-ai-chip" data-prompt="5 questões difíceis de física elétrica do enem">⚡ 5 de Física (ENEM)</button>
                  <button class="simulados-ai-chip" data-prompt="10 questões sobre história do brasil republicano">📜 10 de História</button>
                </div>

                <!-- Feedback / Status Box -->
                <div class="simulados-ai-status" id="simAiStatusBox" style="display:none;"></div>
              </div>
            </div>

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
            
            <div style="margin-top: 10px;">
              <label style="font-size: 11px; font-weight: bold; color: var(--color-text-secondary); text-transform: uppercase;">Método de Avaliação</label>
              <div class="simulados-eval-selector">
                <button class="simulados-eval-btn ${evalMethod === 'convencional' ? 'active' : ''}" id="btnEvalConvencional">
                  📝 Convencional
                </button>
                <button class="simulados-eval-btn ${evalMethod === 'maia' ? 'active' : ''}" id="btnEvalMaia">
                  🎯 Método Maia (Certeza)
                </button>
              </div>
            </div>

            <div id="simMaiaInfoBox" class="simulados-maia-info-box" style="display: ${evalMethod === 'maia' ? 'block' : 'none'};">
              <strong>💡 Recomendação Maia</strong>
              Provas com calibração de certeza funcionam melhor com <strong>5 a 15 questões de maior complexidade.</strong>
            </div>
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
    </div>

    <!-- Container da Aba 2: Simulados Dinâmicos -->
    <div class="simulados-tab-pane" id="tabPaneDinamicos" style="display:none;">
      <div id="dynamicCatalogWrapper">
        <div style="text-align:center; padding: 40px; color:var(--color-text-secondary);">
          <div class="spinner" style="margin: 0 auto 10px auto;"></div>
          Carregando catálogo de aspectos...
        </div>
      </div>
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

  // Inicializa a seção do usuário caso presente na página
  if (document.getElementById('navUserSection')) {
    renderUserButton(auth.currentUser);
    onAuthStateChanged(auth, (user) => {
      renderUserButton(user);
    });
    loadSidebarChats().catch(console.error);
  }
}

// Busca questões diretamente do Firebase RTDB
async function fetchQuestionsPool() {
  try {
    const dbRef = ref(db, 'questoes');
    const snapshot = await get(dbRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      questionsPool = [];

      Object.entries(data).forEach(([nomeProva, mapQuestoes]) => {
        if (mapQuestoes && typeof mapQuestoes === 'object') {
          Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {
            if (!fullData.dados_questao) return;

            // Injeta dados de prova se faltarem
            if (!fullData.meta) fullData.meta = {};
            if (!fullData.meta.material_origem) {
              fullData.meta.material_origem = nomeProva.replace(/_/g, ' ');
            }

            const materias = fullData.dados_questao.materias_possiveis || [];
            const textPreview =
              (fullData.dados_questao.estrutura || []).map((b) => b.conteudo || '').join(' ') ||
              fullData.dados_questao.enunciado ||
              '';

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

    const catalogWrapper = document.getElementById('dynamicCatalogWrapper');
    if (catalogWrapper) {
      renderDynamicAspectsCatalog(questionsPool, catalogWrapper);
    }
  } catch (e) {
    console.error('Erro fetchQuestionsPool:', e);
    const container = document.getElementById('simBankList');
    if (container) {
      container.innerHTML = `<p style="color:var(--color-error); text-align:center;">Erro ao carregar banco: ${e.message}</p>`;
    }
  }
}

// Extrai ou converte o ELO de uma questão com base na porcentagem de dificuldade IA ou parâmetros IRT
export function getQuestionElo(qObj) {
  if (!qObj) return 1500;

  const qId = qObj.id;
  const fullData = qObj.fullData || {};
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};

  // 1. Se já possui ELO numérico direto ou IRT no banco
  if (typeof q.dificuldade_irt === 'number') return q.dificuldade_irt;
  if (typeof q.elo === 'number') return q.elo;
  if (typeof fullData.elo === 'number') return fullData.elo;

  // 2. Extrai percentual de complexidade IA (0 a 100%) da questão
  const complexObj =
    g.analise_complexidade || q.analise_complexidade || fullData.analise_complexidade;
  let pct = 50;

  if (complexObj) {
    if (complexObj.fatores) {
      const calc = _calcularComplexidade(complexObj);
      if (calc && typeof calc.pct === 'number') {
        pct = calc.pct;
      } else {
        pct = EloService.extrairDificuldadePercentualIA(complexObj);
      }
    } else {
      pct = EloService.extrairDificuldadePercentualIA(complexObj);
    }
  } else {
    const difRaw = String(
      q.dificuldade || fullData.meta?.dificuldade || g.dificuldade || '',
    ).toLowerCase();

    if (difRaw.includes('fác') || difRaw.includes('fac') || difRaw.includes('easy')) pct = 25;
    else if (difRaw.includes('desafio')) pct = 90;
    else if (difRaw.includes('dif') || difRaw.includes('hard')) pct = 75;
    else if (difRaw.includes('méd') || difRaw.includes('med') || difRaw.includes('medium'))
      pct = 50;
    else pct = 50;
  }

  // 3. Converte percentual (0-100%) em ELO usando a fórmula oficial do Maia.edu:
  // b_IA = 1500 + 400 * ((pct - 50) / 50)
  return EloService.calcularEloPriorIA(pct);
}

// Preenche o seletor de matérias
function populateSubjectDropdown() {
  const select = document.getElementById('simSubjectSelect');
  if (!select) return;

  const subjects = new Set();
  questionsPool.forEach((q) => {
    (q.subjects || []).forEach((s) => {
      subjects.add(s);
    });
  });

  const sortedSubjects = Array.from(subjects).sort();
  sortedSubjects.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

// Renderiza a listagem de questões do banco (com filtros aplicados)
function renderQuestionsBankList() {
  const container = document.getElementById('simBankList');
  if (!container) return;

  const queryText = (document.getElementById('simSearchInput')?.value || '').trim().toLowerCase();
  const subjectFilter = document.getElementById('simSubjectSelect')?.value || '';

  const filtered = questionsPool.filter((q) => {
    // Filtro por Matéria
    if (subjectFilter && !(q.subjects || []).includes(subjectFilter)) {
      return false;
    }
    // Filtro por Texto / ID
    if (queryText) {
      const idMatch = String(q.id).toLowerCase().includes(queryText);
      const textMatch = q.text.toLowerCase().includes(queryText);
      const subMatch = (q.subjects || []).join(' ').toLowerCase().includes(queryText);
      return idMatch || textMatch || subMatch;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--color-text-secondary);">Nenhuma questão correspondente encontrada.</div>`;
    return;
  }

  container.innerHTML = '';
  filtered.forEach((q) => {
    const isAdded = selectedQuestions.some((sq) => sq.id === q.id && sq.prova === q.prova);
    const eloVal = getQuestionElo(q);

    const card = document.createElement('div');
    card.className = 'simulados-item-card';

    // Pega o início do enunciado
    let textShort = q.text;
    if (textShort.length > 90) textShort = textShort.substring(0, 90) + '...';

    const labelMateria = q.subjects[0]
      ? `<span class="simulados-item-tag">${q.subjects[0]}</span>`
      : '';

    card.innerHTML = `
      <div class="simulados-item-info">
        <div class="simulados-item-meta">
          <span class="simulados-item-id">${q.id}</span>
          <span>•</span>
          <span class="simulados-item-elo-badge" style="background: rgba(33, 128, 141, 0.15); color: var(--color-primary); border: 1px solid rgba(33, 128, 141, 0.3); padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">⚡ ${eloVal} ELO</span>
          <span>•</span>
          <span>${q.fullData.meta?.material_origem || 'Banco'}</span>
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
        <button class="simulados-add-btn ${isAdded ? 'added' : ''}" 
                data-id="${q.id}" data-prova="${q.prova}">
          ${isAdded ? 'Adicionado' : 'Adicionar +'}
        </button>
      </div>
    `;

    // Configura o texto com markdown de forma segura
    const textDiv = card.querySelector('.simulados-item-text');
    textDiv.setAttribute('data-raw', textShort);
    textDiv.textContent = textShort;

    // Clique no card
    card.addEventListener('click', (e) => {
      if (e.target.closest('.simulados-add-btn') || e.target.closest('.simulados-preview-btn')) {
        return;
      }
      toggleAddQuestion(q);
    });

    // Clique no botão visualizar
    card.querySelector('.simulados-preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showQuestionPreviewModal(q);
    });

    // Clique no botão adicionar
    card.querySelector('.simulados-add-btn').addEventListener('click', (e) => {
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
  const eloVal = getQuestionElo(qObj);
  const labelMateria = qObj.subjects[0] ? ` • ${qObj.subjects[0]}` : '';
  const title = `Visualização da Questão ${qId} (${eloVal} ELO)${labelMateria}`;

  // Container principal do preview
  const previewContainer = document.createElement('div');
  previewContainer.className = 'question-preview-modal-body';
  previewContainer.style.cssText =
    'display: flex; flex-direction: column; gap: 20px; color: var(--color-text);';

  // Enunciado / Corpo da questão
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'simulados-exam-q-body';
  bodyDiv.innerHTML = renderizarEstruturaHTML(
    q.estrutura,
    q.fotos_originais || [],
    'simulado_q_preview',
    true,
  );

  previewContainer.appendChild(bodyDiv);

  // Alternativas ou Campo Dissertativo
  const isQDissert =
    q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;

  if (isQDissert) {
    const essayDiv = document.createElement('div');
    essayDiv.innerHTML = `
      <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary); text-transform: uppercase;">Questão Dissertativa</h4>
      <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: 8px; font-style: italic; color: var(--color-text-secondary);">
        Esta questão requer resposta dissertativa.
      </div>
    `;
    previewContainer.appendChild(essayDiv);
  } else {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'simulados-exam-options';

    // Gabarito oficial se disponível
    const correta = qObj.fullData?.dados_gabarito?.alternativa_correta || '';

    (q.alternativas || []).forEach((alt) => {
      const letter = String(alt.letra || '')
        .trim()
        .toUpperCase();
      let altText = '';
      if (alt.estrutura) {
        altText = renderizar_estrutura_alternativa(alt.estrutura, letter, [], 'banco');
      } else {
        altText = alt.texto || '';
      }

      const isCorrect = letter === correta;

      const optBtn = document.createElement('div');
      optBtn.className = `simulados-exam-opt-btn ${isCorrect ? 'correct' : ''}`;
      optBtn.style.cssText = `
        pointer-events: none;
        cursor: default;
        margin-bottom: 8px;
        ${isCorrect ? 'border-color: var(--color-success) !important; background: rgba(var(--color-success-rgb), 0.08) !important;' : ''}
      `;

      optBtn.innerHTML = `
        <span class="simulados-exam-opt-letter" style="${isCorrect ? 'color: var(--color-success);' : ''}">${letter})</span>
        <div class="simulados-exam-opt-content">${altText}</div>
        ${isCorrect ? `<span style="color: var(--color-success); font-weight: bold; margin-left: auto; font-size: 12px; display: flex; align-items: center; gap: 4px;">✔ Gabarito</span>` : ''}
      `;

      optionsDiv.appendChild(optBtn);
    });

    previewContainer.appendChild(optionsDiv);
  }

  // Se tiver Gabarito/Resolução, exibe a seção correspondente
  const g = qObj.fullData?.dados_gabarito || {};
  if ((g.explicacao && g.explicacao.length > 0) || g.resposta_modelo || g.respostaModelo) {
    const gabaritoDiv = document.createElement('div');
    gabaritoDiv.style.cssText =
      'margin-top: 10px; border-top: 1px dashed var(--color-border); padding-top: 15px;';

    gabaritoDiv.innerHTML = renderGabaritoCardSection(qObj, `preview_${qId}`);
    previewContainer.appendChild(gabaritoDiv);
  }

  // Abre a modal genérica
  showGenericModal({
    title,
    content: previewContainer,
    maxWidth: '90%',
  });

  // Renderiza Markdown/LaTeX após a inserção no DOM
  renderLatexIn(previewContainer);
}

// Adiciona ou remove questão do simulado
function toggleAddQuestion(q) {
  const index = selectedQuestions.findIndex((sq) => sq.id === q.id && sq.prova === q.prova);

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
  const container = document.getElementById('simSelectedList');
  const countSpan = document.getElementById('selectedCount');
  if (!container) return;

  if (countSpan) countSpan.textContent = selectedQuestions.length;

  // Atualiza desabilitar botões
  const hasItems = selectedQuestions.length > 0;
  document.getElementById('btnSimularOnline').disabled = !hasItems;
  document.getElementById('btnPDFProva').disabled = !hasItems;
  document.getElementById('btnPDFGabarito').disabled = !hasItems;
  document.getElementById('btnCopiarLink').disabled = !hasItems;

  if (!hasItems) {
    container.innerHTML = `
      <div style="text-align:center; padding: 30px; color:var(--color-text-secondary); border: 2px dashed var(--color-border); border-radius:8px; font-size:12px;">
        Nenhuma questão adicionada ainda. Clique em "+" ao lado de uma questão no painel esquerdo para começar!
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  selectedQuestions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'simulados-selected-card';

    const eloVal = getQuestionElo(q);

    let titleText = q.text;
    if (titleText.length > 35) titleText = titleText.substring(0, 35) + '...';

    card.innerHTML = `
      <span class="simulados-selected-num">${idx + 1}</span>
      <div class="simulados-selected-info" title="${q.id} (${eloVal} ELO): ${q.text}">
        <strong>${q.id}</strong> <span style="font-size: 10px; font-weight: bold; color: var(--color-primary); background: rgba(33,128,141,0.15); padding: 1px 5px; border-radius: 4px; margin-left: 2px;">⚡ ${eloVal} ELO</span>: ${titleText}
      </div>
      <div class="simulados-selected-controls">
        <button class="simulados-ctrl-btn move-up" data-idx="${idx}" title="Mover para Cima">🔼</button>
        <button class="simulados-ctrl-btn move-down" data-idx="${idx}" title="Mover para Baixo">🔽</button>
        <button class="simulados-ctrl-btn remove" data-idx="${idx}" title="Remover">❌</button>
      </div>
    `;

    // Click handlers para controles
    card.querySelector('.move-up').addEventListener('click', () => moveQuestion(idx, -1));
    card.querySelector('.move-down').addEventListener('click', () => moveQuestion(idx, 1));
    card.querySelector('.remove').addEventListener('click', () => {
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
  if (!questoes || questoes.length === 0) return 'teste';
  const hasObjective = questoes.some((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    return !(q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0);
  });
  const hasWritten = questoes.some((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    return q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;
  });

  if (hasObjective && hasWritten) return 'misto';
  if (hasWritten) return 'dissertativa';
  return 'teste';
}

// Configura ouvintes da aba Dashboard
function setupDashboardListeners() {
  const searchInput = document.getElementById('simSearchInput');
  const subjectSelect = document.getElementById('simSubjectSelect');
  const titleInput = document.getElementById('simTitleInput');

  // Alternância de Abas (Simulados Tradicionais vs Simulados Dinâmicos)
  const tabBtnTradicionais = document.getElementById('tabBtnTradicionais');
  const tabBtnDinamicos = document.getElementById('tabBtnDinamicos');
  const tabPaneTradicionais = document.getElementById('tabPaneTradicionais');
  const tabPaneDinamicos = document.getElementById('tabPaneDinamicos');

  if (tabBtnTradicionais && tabBtnDinamicos) {
    tabBtnTradicionais.addEventListener('click', () => {
      tabBtnTradicionais.classList.add('active');
      tabBtnDinamicos.classList.remove('active');
      if (tabPaneTradicionais) tabPaneTradicionais.style.display = 'block';
      if (tabPaneDinamicos) tabPaneDinamicos.style.display = 'none';
    });

    tabBtnDinamicos.addEventListener('click', () => {
      tabBtnDinamicos.classList.add('active');
      tabBtnTradicionais.classList.remove('active');
      if (tabPaneTradicionais) tabPaneTradicionais.style.display = 'none';
      if (tabPaneDinamicos) {
        tabPaneDinamicos.style.display = 'block';
        const catalogWrapper = document.getElementById('dynamicCatalogWrapper');
        if (catalogWrapper) {
          renderDynamicAspectsCatalog(questionsPool, catalogWrapper);
        }
      }
    });
  }

  // Listener para os botões de Configuração do Modelo de IA de Simulados
  document.querySelectorAll('.js-config-model-simulado').forEach((btn) => {
    btn.addEventListener('click', showSimuladoModelModal);
  });


  // Handler de Geração por IA
  const btnGerarIa = document.getElementById('btnGerarSimuladoIa');
  const promptInput = document.getElementById('simAiPromptInput');
  const statusBox = document.getElementById('simAiStatusBox');

  const executarGeracaoIa = async (promptTexto) => {
    if (!promptTexto || !promptTexto.trim()) {
      customAlert('Por favor, digite o tema ou descrição do simulado.', 3000);
      return;
    }

    if (btnGerarIa) {
      btnGerarIa.disabled = true;
      btnGerarIa.innerHTML = `<span class="sim-spinner-icon">⏳</span> <span>Gerando...</span>`;
    }
    if (promptInput) promptInput.disabled = true;

    const card = document.querySelector('.simulados-ai-card');
    if (card) card.classList.add('is-generating');

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = `
        <div class="sim-status-wrapper fade-in">
          <div class="sim-status-header">
            <span class="sim-status-pulse">🤖</span>
            <span class="sim-status-title">Processando Simulado por IA</span>
          </div>
          <div class="sim-status-progress-track">
            <div class="sim-status-progress-fill" id="simAiProgressBar" style="width: 5%;"></div>
          </div>
          <div class="sim-status-text" id="simAiStatusText">
            <div class="spinner-sm" style="display:inline-block; margin-right:6px;"></div> Conectando ao cérebro de IA...
          </div>
        </div>
      `;
    }

    try {
      const currentModel =
        window.selectedModelSimulado ||
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('selectedModelSimulado')
          : null) ||
        'models/gemma-4-31b-it';

      const result = await gerarSimuladoComIA(promptTexto, questionsPool, {
        model: currentModel,
        onStatus: (data) => {
          if (!statusBox) return;
          const bar = document.getElementById('simAiProgressBar');
          const txt = document.getElementById('simAiStatusText');

          if (typeof data === 'string') {
            if (txt)
              txt.innerHTML = `<div class="spinner-sm" style="display:inline-block; margin-right:6px;"></div> ${data}`;
          } else if (data && typeof data === 'object') {
            if (bar && typeof data.percent === 'number') {
              bar.style.width = `${data.percent}%`;
            }
            if (txt && data.message) {
              txt.innerHTML = `<div class="spinner-sm" style="display:inline-block; margin-right:6px;"></div> ${data.message}`;
            }
          }
        },
      });

      if (result && Array.isArray(result.selectedQuestions)) {
        selectedQuestions = result.selectedQuestions;
        simuladoTitle = result.title || simuladoTitle;
        const tInput = document.getElementById('simTitleInput');
        if (tInput) tInput.value = simuladoTitle;

        renderSelectedList();

        const bar = document.getElementById('simAiProgressBar');
        if (bar) bar.style.width = '100%';

        if (statusBox) {
          statusBox.innerHTML = `
            <div class="sim-status-wrapper sim-status-success fade-in">
              <div class="sim-status-header">
                <span class="sim-status-title">✅ Simulado Gerado com Sucesso!</span>
              </div>
              <div class="sim-status-text">
                <strong>"${simuladoTitle}"</strong> — ${selectedQuestions.length} questões selecionadas no banco.
              </div>
            </div>
          `;
        }

        // Foco visual na lista de questões selecionadas
        document
          .getElementById('simSelectedList')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      console.error('[Simulados AI Error]', err);
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.innerHTML = `
          <div class="sim-status-wrapper sim-status-error">
            ⚠️ Erro ao gerar simulado: ${err.message || 'Falha na conexão com a IA'}
          </div>
        `;
      }
    } finally {
      if (btnGerarIa) {
        btnGerarIa.disabled = false;
        btnGerarIa.innerHTML = `✨ Gerar`;
      }
      if (promptInput) promptInput.disabled = false;
      if (card) card.classList.remove('is-generating');
    }
  };

  if (btnGerarIa) {
    btnGerarIa.addEventListener('click', () => {
      executarGeracaoIa(promptInput?.value);
    });
  }

  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executarGeracaoIa(promptInput.value);
      }
    });
  }

  // Listener dos chips interativos
  document.querySelectorAll('.simulados-ai-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      const promptText = e.currentTarget.getAttribute('data-prompt');
      if (promptInput) promptInput.value = promptText;
      executarGeracaoIa(promptText);
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', renderQuestionsBankList);
  }
  if (subjectSelect) {
    subjectSelect.addEventListener('change', renderQuestionsBankList);
  }

  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      simuladoTitle = e.target.value;
    });
  }

  // Ouvintes de Método de Avaliação
  const btnConv = document.getElementById('btnEvalConvencional');
  const btnMaia = document.getElementById('btnEvalMaia');
  const infoBox = document.getElementById('simMaiaInfoBox');

  btnConv?.addEventListener('click', () => {
    evalMethod = 'convencional';
    btnConv.classList.add('active');
    btnMaia?.classList.remove('active');
    if (infoBox) infoBox.style.display = 'none';
  });

  btnMaia?.addEventListener('click', () => {
    evalMethod = 'maia';
    btnMaia.classList.add('active');
    btnConv?.classList.remove('active');
    if (infoBox) infoBox.style.display = 'block';
  });

  // Ações
  document.getElementById('btnPDFProva')?.addEventListener('click', () => {
    const activeType = detectarSimuladoType(selectedQuestions);
    gerarPDFSimulado(
      { titulo: simuladoTitle, tipo: activeType, evalMethod, questoes: selectedQuestions },
      false,
    );
  });

  document.getElementById('btnPDFGabarito')?.addEventListener('click', () => {
    const activeType = detectarSimuladoType(selectedQuestions);
    gerarPDFSimulado(
      { titulo: simuladoTitle, tipo: activeType, evalMethod, questoes: selectedQuestions },
      true,
    );
  });

  document.getElementById('btnSimularOnline')?.addEventListener('click', () => {
    const activeType = detectarSimuladoType(selectedQuestions);
    iniciarSimulacaoOnline(selectedQuestions, activeType, simuladoTitle);
  });

  document.getElementById('btnCopiarLink')?.addEventListener('click', (e) => {
    const activeType = detectarSimuladoType(selectedQuestions);
    const ids = selectedQuestions.map((q) => `${q.prova}:${q.id}`).join(',');
    const shareUrl = `${window.location.origin}${window.location.pathname}?mode=simular&type=${activeType}&eval=${evalMethod}&title=${encodeURIComponent(simuladoTitle)}&ids=${ids}`;

    // Mostra o link num popup simples estilizado
    const container = e.target.parentElement;
    const oldContainer = document.getElementById('shareLinkBox');
    if (oldContainer) oldContainer.remove();

    const linkBoxHtml = `
      <div id="shareLinkBox" class="simulados-share-url-container fade-in">
        <input type="text" class="simulados-share-url-input" value="${shareUrl}" readonly id="shareUrlInput">
        <button class="simulados-btn-primary" style="padding:6px 12px; font-size:11px; width:auto; margin:0;" id="btnCopyExec">Copiar</button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', linkBoxHtml);

    const input = document.getElementById('shareUrlInput');
    input.select();

    document.getElementById('btnCopyExec').addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl);
      customAlert('✅ Link copiado com sucesso!', 2000);
      document.getElementById('shareLinkBox').remove();
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
  document.body.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'simulados-exam-container';
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

  let contentHtml = '';

  if (isResultPhase) {
    // FASE DE GABARITO (RESULTADO)
    // Mostra se o aluno acertou ou errou na parte superior
    const isQDissert =
      q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;

    let correcaoHeaderHtml = '';
    if (isQDissert) {
      correcaoHeaderHtml = `
        <div style="background:rgba(var(--color-primary-rgb),0.08); border:1px solid var(--color-border); border-radius:8px; padding:15px; margin-bottom:20px;">
          <h4 style="margin:0 0 8px 0; color:var(--color-primary);">Sua resposta descrita:</h4>
          <p style="font-style:italic; margin:0; line-height:1.5; font-size:13px; color:var(--color-text); white-space:pre-wrap;">${
            studentAnswers[qId] || 'Sem resposta rascunhada.'
          }</p>
        </div>
      `;
    } else {
      const escolheu = studentAnswers[qId] || 'Nenhuma';
      const correta = qObj.fullData.dados_gabarito?.alternativa_correta || '';
      const acertou = escolheu === correta;

      correcaoHeaderHtml = `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-radius:8px; margin-bottom:20px; font-weight:bold;
             background:${acertou ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)'};
             border:1px solid ${acertou ? 'var(--color-success)' : 'var(--color-error)'};
             color:${acertou ? 'var(--color-success)' : 'var(--color-error)'};">
          <span style="font-size:20px;">${acertou ? '✅' : '❌'}</span>
          <span>Sua Resposta: ${escolheu} ${
            acertou ? '(Correto)' : `(Incorreto. O gabarito é: ${correta})`
          }</span>
        </div>
      `;
    }

    // Estrutura do card com gabarito oficial visível
    const { card, htmlAlts } = prepareResultAlternativesHtml(qObj, q, cardId);

    contentHtml = `
      <div class="simulados-exam-card fade-in" id="card_${qId}">
        <div class="simulados-exam-q-num">Questão ${String(activeSimIndex + 1).padStart(2, '0')}</div>
        <div class="simulados-exam-q-body">
          ${renderizarEstruturaHTML(q.estrutura, q.fotos_originais || [], 'simulado_q_view', true)}
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
    let workspaceHtml = '';

    const isQDissert =
      q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;

    const isMaia = evalMethod === 'maia';
    const chosenLetter = getChosenLetter(qId);

    if (isQDissert) {
      workspaceHtml = `
        <textarea 
          class="simulados-exam-essay-input" 
          id="simEssayArea"
          placeholder="Escreva ou rascunhe sua resposta dissertativa aqui..."
        >${typeof studentAnswers[qId] === 'string' ? studentAnswers[qId] : ''}</textarea>
      `;
    } else {
      workspaceHtml = `
        <div class="simulados-exam-options">
          ${(q.alternativas || [])
            .map((alt) => {
              const letter = String(alt.letra || '')
                .trim()
                .toUpperCase();
              let altText = '';
              if (alt.estrutura) {
                altText = renderizar_estrutura_alternativa(alt.estrutura, letter, [], 'banco');
              } else {
                altText = alt.texto || '';
              }

              const isSelected = chosenLetter === letter;

              let certaintyRulerHtml = '';
              if (isMaia) {
                const currentCert = studentAnswers[qId]?.certainties?.[letter] || 100;
                let certBtns = '';
                for (let p = 10; p <= 100; p += 10) {
                  let btnClass = '';
                  if (currentCert === p) btnClass = 'active';
                  else if (currentCert === p - 5 || currentCert === p + 5) btnClass = 'active-dual';

                  certBtns += `<button class="simulados-certainty-btn ${btnClass}" data-letter="${letter}" data-val="${p}">${p}%</button>`;
                }

                certaintyRulerHtml = `
                  <div class="simulados-certainty-wrapper" onclick="event.stopPropagation();">
                    <div class="simulados-certainty-header">
                      <span>Certeza nesta alternativa:</span>
                      <strong style="color: var(--color-primary);">${currentCert}%</strong>
                    </div>
                    <div class="simulados-certainty-ruler">
                      ${certBtns}
                    </div>
                  </div>`;
              }

              return `
                <div style="width: 100%; margin-bottom: 10px;">
                  <button class="simulados-exam-opt-btn ${
                    isSelected ? 'selected' : ''
                  }" data-letter="${letter}">
                    <span class="simulados-exam-opt-letter">${letter})</span>
                    <div class="simulados-exam-opt-content">${altText}</div>
                  </button>
                  ${certaintyRulerHtml}
                </div>`;
            })
            .join('')}
        </div>
      `;
    }

    const eloQ = getQuestionElo(qObj);
    contentHtml = `
      <div class="simulados-exam-card fade-in">
        <div class="simulados-exam-q-num">
          Questão ${activeSimIndex + 1} de ${total}
          <span style="font-size: 11px; font-weight: bold; background: rgba(33, 128, 141, 0.15); color: var(--color-primary); border: 1px solid rgba(33, 128, 141, 0.3); padding: 2px 8px; border-radius: 6px; margin-left: 8px;">⚡ ${eloQ} ELO</span>
        </div>
        <div class="simulados-exam-q-body">
          ${renderizarEstruturaHTML(q.estrutura, q.fotos_originais || [], 'simulado_q_solve', true)}
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
      <button class="simulados-nav-btn" id="btnSimPrev" ${activeSimIndex === 0 ? 'disabled' : ''}>
        ← Voltar
      </button>

      <div class="simulados-nav-dots" id="simNavDots">
        ${questoes
          .map((_, i) => {
            const hasAns = studentAnswers[questoes[i].id] !== undefined;
            let dotClass = '';
            if (activeSimIndex === i) dotClass = 'active';
            else if (hasAns) dotClass = 'answered';

            // Cores do resultado no gabarito
            if (isResultPhase) {
              const qs = questoes[i];
              const qst = qs.fullData?.dados_questao || {};
              const isQD =
                qst.tipo_resposta === 'dissertativa' ||
                !qst.alternativas ||
                qst.alternativas.length === 0;

              if (isQD) {
                dotClass += ' answered';
              } else {
                const escolheu = getChosenLetter(qs.id);
                const correta = qs.fullData.dados_gabarito?.alternativa_correta;
                if (escolheu === correta) {
                  dotClass += ' correct';
                } else {
                  dotClass += ' incorrect';
                }
              }
            }

            return `<span class="simulados-dot ${dotClass}" data-goto="${i}">${i + 1}</span>`;
          })
          .join('')}
      </div>

      <button class="simulados-nav-btn ${
        activeSimIndex === total - 1 ? 'finish' : ''
      }" id="btnSimNext">
        ${
          activeSimIndex === total - 1
            ? isResultPhase
              ? 'Resultado Geral'
              : 'Finalizar'
            : 'Avançar →'
        }
      </button>
    </div>
  `;

  // Compila LaTeX e Marked instantaneamente no corpo inserido
  renderLatexIn(container);

  // Scrolla o dot ativo para ser visível em celulares
  const activeDot = container.querySelector('.simulados-dot.active');
  activeDot?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  // Event Listeners
  document.getElementById('btnAbortExam').addEventListener('click', async () => {
    const confirmSair = await showConfirmModal(
      'Sair da Simulação',
      'Deseja mesmo sair desta simulação? Todo o progresso será perdido.',
      'Sair',
      'Cancelar',
      false,
    );
    if (confirmSair) {
      iniciarModoSimulados();
    }
  });

  // Listener para botões do dot nav
  container.querySelectorAll('.simulados-dot').forEach((dot) => {
    dot.addEventListener('click', (e) => {
      saveActiveResponse(tipo);
      activeSimIndex = Number(e.target.dataset.goto);
      renderActiveExamQuestion(container, questoes, tipo, titulo);
    });
  });

  // Voltar
  document.getElementById('btnSimPrev').addEventListener('click', () => {
    saveActiveResponse(tipo);
    activeSimIndex--;
    renderActiveExamQuestion(container, questoes, tipo, titulo);
  });

  // Avançar / Finalizar
  document.getElementById('btnSimNext').addEventListener('click', () => {
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
  const isQDissert =
    q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;
  if (!isResultPhase && !isQDissert) {
    container.querySelectorAll('.simulados-exam-opt-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const optionBtn = e.target.closest('.simulados-exam-opt-btn');
        const letter = optionBtn.dataset.letter;

        // Desmarca outras
        container.querySelectorAll('.simulados-exam-opt-btn').forEach((b) => {
          b.classList.remove('selected');
        });

        optionBtn.classList.add('selected');
        if (typeof studentAnswers[qId] === 'object' && studentAnswers[qId]) {
          studentAnswers[qId].chosen = letter;
        } else {
          studentAnswers[qId] = {
            chosen: letter,
            certainties: { A: 100, B: 100, C: 100, D: 100, E: 100 },
          };
        }

        // Atualiza status de respondida no header e dot nav sem dar re-render
        const totalRespondidas = Object.keys(studentAnswers).length;
        const progressText = container.querySelector('.simulados-exam-progress-text');
        if (progressText) {
          progressText.textContent = `Progresso: ${totalRespondidas}/${total} respondidas`;
        }

        const currentDot = container.querySelector(`.simulados-dot[data-goto="${activeSimIndex}"]`);
        if (currentDot && !currentDot.classList.contains('answered')) {
          currentDot.classList.add('answered');
        }
      });
    });

    // Ouvintes para botões de certeza do Método Maia (sem re-render total da página para evitar flicker)
    container.querySelectorAll('.simulados-certainty-btn').forEach((cBtn) => {
      cBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const letter = cBtn.dataset.letter;
        const val = Number(cBtn.dataset.val);

        if (!studentAnswers[qId] || typeof studentAnswers[qId] !== 'object') {
          studentAnswers[qId] = {
            chosen: null,
            certainties: { A: 100, B: 100, C: 100, D: 100, E: 100 },
          };
        }
        if (!studentAnswers[qId].certainties) {
          studentAnswers[qId].certainties = { A: 100, B: 100, C: 100, D: 100, E: 100 };
        }

        const prev = studentAnswers[qId].certainties[letter] || 100;
        let newCert = val;

        if (Math.abs(prev - val) === 10 || Math.abs(prev - val) === 5) {
          if (prev % 10 === 5) {
            newCert = val;
          } else {
            newCert = (prev + val) / 2;
          }
        } else {
          newCert = val;
        }

        studentAnswers[qId].certainties[letter] = newCert;

        // Atualização ultra-suave local no DOM (sem piscar nem disparar fade-in)
        const wrapper = cBtn.closest('.simulados-certainty-wrapper');
        if (wrapper) {
          const strongTag = wrapper.querySelector('.simulados-certainty-header strong');
          if (strongTag) strongTag.textContent = `${newCert}%`;

          wrapper.querySelectorAll('.simulados-certainty-btn').forEach((btn) => {
            const btnVal = Number(btn.dataset.val);
            btn.className = 'simulados-certainty-btn';
            if (newCert === btnVal) {
              btn.classList.add('active');
            } else if (newCert === btnVal - 5 || newCert === btnVal + 5) {
              btn.classList.add('active-dual');
            }
          });
        }
      });
    });
  }
}

// Retorna a letra da opção escolhida pelo estudante em qualquer modo
function getChosenLetter(qId) {
  const ans = studentAnswers[qId];
  if (!ans) return null;
  if (typeof ans === 'object') return ans.chosen;
  return ans;
}

// Salva a resposta da questão ativa atual no buffer
function saveActiveResponse(tipo) {
  const qObj = selectedQuestions[activeSimIndex];
  if (!qObj) return;

  const q = qObj.fullData?.dados_questao || {};
  const isQDissert =
    q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;

  if (isQDissert) {
    const area = document.getElementById('simEssayArea');
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
    msg += '\n\nAtenção: Questões não respondidas serão marcadas como erradas.';
  }

  const confirmFinalizar = await showConfirmModal(
    'Finalizar Simulado',
    msg,
    'Finalizar',
    'Voltar para a Prova',
    true,
  );

  if (confirmFinalizar) {
    isResultPhase = true;
    renderSimResultSummary(container, questoes, tipo, titulo);
  }
}

// Prepara o layout das alternativas na tela de gabarito/resultado
function prepareResultAlternativesHtml(qObj, q, cardId) {
  const g = qObj.fullData?.dados_gabarito || {};
  const escolheu = getChosenLetter(qObj.id);
  const correta = (g.alternativa_correta || '').trim().toUpperCase();

  const motivoMap = {};
  (g.alternativas_analisadas || []).forEach((aa) => {
    const letraKey = String(aa.letra || '')
      .trim()
      .toUpperCase();
    if (letraKey && aa.motivo) motivoMap[letraKey] = aa.motivo;
  });

  const isQDissert =
    q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;

  let htmlAlts = '';

  if (isQDissert) {
    htmlAlts = `
      <div class="q-dissert-container">
        <!-- O textarea deve conter o texto rascunhado pelo aluno para IA ler se clicado -->
        <textarea 
          class="q-dissert-input" 
          readonly
          style="background:rgba(255,255,255,0.03); opacity:0.85;"
          rows="4"
        >${typeof studentAnswers[qObj.id] === 'string' ? studentAnswers[qObj.id] : ''}</textarea>
        
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
        let altHtml = '';
        if (alt.estrutura) {
          altHtml = renderizar_estrutura_alternativa(alt.estrutura, letter, [], 'banco');
        } else {
          altHtml = alt.texto || '';
        }

        let stateClass = '';
        if (letter === correta) {
          stateClass = 'correct';
        }
        if (letter === escolheu && letter !== correta) {
          stateClass = 'incorrect-selected';
        }

        const motivoRaw = motivoMap[letter] || '';

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
                  : ''
              }
          </button>`;
      })
      .join('');
  }

  return { card: null, htmlAlts };
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Renders the correct answer details, justifications, steps and metadata
function renderGabaritoCardSection(qObj, cardId) {
  const g = qObj.fullData?.dados_gabarito || {};
  const confianca = Math.round((g.confianca || 0) * 100);

  // Converte passos de resolução para HTML
  let passosHtml = '';
  if (g.explicacao && g.explicacao.length > 0) {
    const listPassos = g.explicacao
      .map((p, i) => {
        const est = Array.isArray(p.estrutura)
          ? p.estrutura
          : [{ tipo: 'texto', conteudo: p.passo || '' }];

        const stepContentHtml = renderizarEstruturaHTML(est, [], `simulado_step_${i}`, true);

        // Metadados do passo
        const origemLabel = (p.origem || '').includes('extraido')
          ? '📄 Material Original'
          : '🤖 Gerado por IA';
        const origemCor = (p.origem || '').includes('extraido')
          ? 'var(--color-success)'
          : 'var(--color-primary)';

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
                    : ''
                }
              </div>
            </details>
          </div>`;
      })
      .join('');

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
  const resModeloRaw = g.resposta_modelo || g.respostaModelo || '';
  let respModeloHtml = '';
  if (resModeloRaw) {
    let padronizado = String(resModeloRaw)
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '');
    padronizado = padronizado
      .split('\n')
      .map((l) => l.trimStart())
      .join('\n')
      .trim();

    respModeloHtml = `
      <div style="margin-top: 15px;">
        <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Resposta Esperada (Tutor)</h4>
        <div class="markdown-content" data-raw="${escapeHtml(
          padronizado,
        )}" style="padding: 10px; background: rgba(34,197,94,0.05); border-left: 3px solid var(--color-success); border-radius: 4px; font-size:13px;"></div>
      </div>
    `;
  }

  // Fontes Externas
  let fontesHtml = '';
  if (g.fontes_externas && g.fontes_externas.length > 0) {
    const listFontes = g.fontes_externas
      .map(
        (f) => `
      <li>
        <a href="${f.uri}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary); text-decoration:none; font-size:0.85rem; display:inline-flex; align-items:center; gap:4px;">
          ${f.title || f.uri} ↗
        </a>
      </li>
    `,
      )
      .join('');

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
          g.alternativa_correta ? `Alternativa ${g.alternativa_correta}` : 'Dissertativa'
        }
        <span style="font-size:11px; color:var(--color-text-secondary); margin-left:8px;">(Confiança IA: ${confianca}%)</span>
      </div>

      <div style="margin-top: 10px; font-size: 13px; line-height: 1.5;">
        <strong>Justificativa:</strong>
        <span class="markdown-content" data-raw="${escapeHtml(
          g.justificativa_curta || 'Sem justificativa.',
        )}"></span>
      </div>

      ${respModeloHtml}
      ${passosHtml}
      ${fontesHtml}
    </div>
  `;
}

// Calculador de ELO e Análise Metacognitiva exclusivo e isolado da sessão do simulado
function calcularEloSimulado(questoes, studentAnswers, evalMethod) {
  let theta = 1500; // Todo simulado inicia estritamente em 1500 ELO
  const itemLogs = [];

  let countAcertos = 0;
  let countErros = 0;
  let sumCertAcertos = 0;
  let sumCertErros = 0;

  questoes.forEach((qObj, idx) => {
    const q = qObj.fullData?.dados_questao || {};
    const isQD =
      q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;

    if (isQD) return;

    // Dificuldade ELO da questão no banco de dados (beta_i)
    const beta = getQuestionElo(qObj);

    // Resposta e gabarito
    const escolheu = getChosenLetter(qObj.id);
    const correta = (qObj.fullData?.dados_gabarito?.alternativa_correta || '').trim().toUpperCase();
    const acertou = escolheu === correta;

    // Probabilidade esperada Rasch (1PL)
    const prob = 1 / (1 + Math.pow(10, (beta - theta) / 400));

    // Certeza assinalada (Método Maia)
    let certezaPct = 100;
    if (evalMethod === 'maia' && studentAnswers[qObj.id]?.certainties && escolheu) {
      certezaPct = studentAnswers[qObj.id].certainties[escolheu] || 100;
    }
    const certezaNorm = certezaPct / 100;

    // Ajuste Micro por questão
    const K = 36;
    let delta = 0;

    if (evalMethod === 'maia') {
      if (acertou) {
        const mult = 0.5 + 0.5 * certezaNorm;
        delta = Math.round(K * (1 - prob) * mult);
        countAcertos++;
        sumCertAcertos += certezaPct;
      } else {
        const mult = 0.7 + 0.6 * certezaNorm;
        delta = Math.round(K * (0 - prob) * mult);
        countErros++;
        sumCertErros += certezaPct;
      }
    } else {
      delta = Math.round(K * ((acertou ? 1 : 0) - prob));
      if (acertou) countAcertos++;
      else countErros++;
    }

    theta += delta;

    itemLogs.push({
      num: idx + 1,
      qId: qObj.id,
      beta,
      escolheu: escolheu || '—',
      correta,
      acertou,
      probPct: Math.round(prob * 100),
      certezaPct: evalMethod === 'maia' ? certezaPct : null,
      delta,
      newTheta: theta,
    });
  });

  // Ajuste Macro Metacognitivo (Método Maia)
  let deltaMacro = 0;
  let calibStatus = 'Bem Calibrado 🎯';
  let calibDesc = 'Sua percepção de certeza condiz com a sua precisão nas respostas.';
  let calibColor = 'var(--color-success)';

  const avgCertAcertos = countAcertos > 0 ? Math.round(sumCertAcertos / countAcertos) : 0;
  const avgCertErros = countErros > 0 ? Math.round(sumCertErros / countErros) : 0;

  if (evalMethod === 'maia') {
    if (avgCertErros >= 70) {
      calibStatus = 'Superconfiante 🔴';
      calibDesc = 'Você assinalou alta certeza em questões que continham erros ou distratores.';
      calibColor = 'var(--color-error)';
      deltaMacro = -35;
    } else if (avgCertAcertos < 60 && countAcertos > 0) {
      calibStatus = 'Subconfiante 🛡️';
      calibDesc =
        'Sua precisão empírica foi alta, mas sua confiança marcou valores prudente/baixos.';
      calibColor = '#3b82f6';
      deltaMacro = +20;
    } else if (countAcertos > 0) {
      deltaMacro = +15;
    }
  }

  const eloFinal = Math.max(800, Math.min(2400, Math.round(theta + deltaMacro)));
  const variacaoTotal = eloFinal - 1500;
  const rankTier = getEloRankTier(eloFinal);

  return {
    eloInicial: 1500,
    eloFinal,
    variacaoTotal,
    rankTier,
    itemLogs,
    evalMethod,
    countAcertos,
    countErros,
    totalObjetivas: countAcertos + countErros,
    avgCertAcertos,
    avgCertErros,
    deltaMacro,
    calibStatus,
    calibDesc,
    calibColor,
  };
}

// Renderiza a tela final de resumo do simulado (Score Geral, ELO do Simulado e Desempenho)
function renderSimResultSummary(container, questoes, tipo, titulo) {
  document.body.innerHTML = '';

  const total = questoes.length;
  const hasDissertative = questoes.some((qObj) => {
    const q = qObj.fullData?.dados_questao || {};
    return q.tipo_resposta === 'dissertativa' || !q.alternativas || q.alternativas.length === 0;
  });

  // Executa o motor ELO do simulado (sessão isolada iniciada em 1500 ELO)
  const eloSim = calcularEloSimulado(questoes, studentAnswers, evalMethod);
  const { rankTier } = eloSim;

  const percentage =
    eloSim.totalObjetivas > 0 ? Math.round((eloSim.countAcertos / eloSim.totalObjetivas) * 100) : 0;

  let circularScoreHtml = '';
  let summaryGridHtml = '';

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
        <span class="simulados-summary-val correct">${eloSim.countAcertos}</span>
        <span class="simulados-summary-lbl">Acertos</span>
      </div>
      <div class="simulados-summary-item">
        <span class="simulados-summary-val incorrect">${eloSim.countErros}</span>
        <span class="simulados-summary-lbl">Erros</span>
      </div>
      <div class="simulados-summary-item">
        <span class="simulados-summary-val">${total}</span>
        <span class="simulados-summary-lbl">Total</span>
      </div>
    `;
  }

  // Tabela de Evolução por Questão no Simulado
  let evolutionTableHtml = '';
  if (eloSim.itemLogs.length > 0) {
    const rowsHtml = eloSim.itemLogs
      .map(
        (log) => `
        <tr style="border-bottom: 1px solid var(--color-border); font-size: 12px;">
          <td style="padding: 8px; font-weight: bold;">Q${log.num}</td>
          <td style="padding: 8px; color: var(--color-text-secondary);">${log.beta} ELO</td>
          <td style="padding: 8px; font-weight: bold;">${log.escolheu}</td>
          <td style="padding: 8px; color: var(--color-success); font-weight: bold;">${log.correta}</td>
          ${
            evalMethod === 'maia'
              ? `<td style="padding: 8px; color: var(--color-primary);">${log.certezaPct}%</td>`
              : ''
          }
          <td style="padding: 8px; font-weight: bold; color: ${log.delta >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
            ${log.delta >= 0 ? '+' + log.delta : log.delta}
          </td>
          <td style="padding: 8px; font-weight: bold; text-align: right;">${log.newTheta}</td>
        </tr>`,
      )
      .join('');

    evolutionTableHtml = `
      <div style="margin-top: 20px; width: 100%; text-align: left;">
        <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--color-text-shine);">Evolução de ELO por Questão (Início: 1500 ELO)</h4>
        <div style="overflow-x: auto; background: rgba(0,0,0,0.15); border: 1px solid var(--color-border); border-radius: 8px; padding: 6px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1.5px solid var(--color-border); font-size: 11px; text-transform: uppercase; color: var(--color-text-secondary); text-align: left;">
                <th style="padding: 8px;">Nº</th>
                <th style="padding: 8px;">Dif. (DB)</th>
                <th style="padding: 8px;">Resp.</th>
                <th style="padding: 8px;">Gab.</th>
                ${evalMethod === 'maia' ? '<th style="padding: 8px;">Certeza</th>' : ''}
                <th style="padding: 8px;">Δ ELO</th>
                <th style="padding: 8px; text-align: right;">Novo ELO</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // Relatório de Calibração Metacognitiva (Método Maia)
  let maiaCalibrationHtml = '';
  if (evalMethod === 'maia' && !hasDissertative) {
    maiaCalibrationHtml = `
      <div style="background: rgba(33, 128, 141, 0.08); border: 1px solid rgba(33, 128, 141, 0.3); border-radius: var(--radius-md); padding: 16px; margin-top: 15px; text-align: left; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-text-shine);">Calibração Metacognitiva Maia</h4>
          <span style="font-weight: bold; font-size: 13px; color: ${eloSim.calibColor};">${eloSim.calibStatus}</span>
        </div>
        <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0 0 12px 0;">${eloSim.calibDesc}</p>
        <div style="display: flex; gap: 12px; font-size: 12px;">
          <div style="flex: 1; background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px;">
            <span style="color: var(--color-text-secondary); display: block; font-size: 10px;">Certeza Média nos Acertos</span>
            <strong style="color: var(--color-success); font-size: 14px;">${eloSim.avgCertAcertos}%</strong>
          </div>
          <div style="flex: 1; background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px;">
            <span style="color: var(--color-text-secondary); display: block; font-size: 10px;">Certeza Média nos Erros</span>
            <strong style="color: var(--color-error); font-size: 14px;">${eloSim.avgCertErros}%</strong>
          </div>
          <div style="flex: 1; background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px;">
            <span style="color: var(--color-text-secondary); display: block; font-size: 10px;">Ajuste Macro de Certeza</span>
            <strong style="color: var(--color-primary); font-size: 14px;">${eloSim.deltaMacro >= 0 ? '+' + eloSim.deltaMacro : eloSim.deltaMacro} ELO</strong>
          </div>
        </div>
      </div>`;
  }

  const varSign = eloSim.variacaoTotal >= 0 ? '+' : '';
  const varColor = eloSim.variacaoTotal >= 0 ? 'var(--color-success)' : 'var(--color-error)';

  const summaryCard = document.createElement('div');
  summaryCard.className = 'simulados-exam-container';

  summaryCard.innerHTML = `
    <div class="simulados-results-card fade-in" style="max-width: 720px;">
      <h2 style="margin:0; font-size:1.6rem; color:var(--color-text-shine);">Resultado do Simulado</h2>
      <p style="margin: -10px 0 15px 0; color:var(--color-text-secondary); font-size:13px;">${titulo} ${evalMethod === 'maia' ? '(Método Maia)' : '(Convencional)'}</p>

      <!-- HERO DE ELO DO SIMULADO -->
      <div class="simulados-result-hero" style="width: 100%; text-align: left;">
        <div style="font-size: 11px; font-weight: bold; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
          Elo Final Alcançado neste Simulado
        </div>
        <div class="simulados-result-elo-row">
          <div class="simulados-result-elo-score">
            <span class="simulados-result-elo-num">${eloSim.eloFinal}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 12px; font-weight: bold; color: var(--color-text-secondary);">ELO DO SIMULADO</span>
              <span style="font-size: 12px; font-weight: bold; color: ${varColor};">${varSign}${eloSim.variacaoTotal} ELO (Início: 1500)</span>
            </div>
          </div>
          <span class="simulados-result-tier-badge" style="background: ${rankTier.color || 'var(--color-primary)'}; box-shadow: 0 0 15px ${rankTier.glow || 'transparent'};">
            ${rankTier.badge || 'Competente'}
          </span>
        </div>
      </div>

      <div class="simulados-score-circle">
        ${circularScoreHtml}
      </div>

      <div class="simulados-summary-grid">
        ${summaryGridHtml}
      </div>

      ${maiaCalibrationHtml}
      ${evolutionTableHtml}

      <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:500px; margin-top:25px;">
        <button class="simulados-btn-primary" style="width:100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); font-weight:bold;" id="btnSyncEloProfileTraditional">
          💾 Sincronizar & Salvar ELO no Perfil (${varSign}${eloSim.variacaoTotal} pts)
        </button>
        <div style="display:flex; gap:10px; width:100%;">
          <button class="simulados-btn-primary" style="flex:1;" id="btnReviewExam">🔍 Revisar Respostas</button>
          <button class="simulados-btn-secondary" style="flex:1;" id="btnGoBackDash">Voltar ao Painel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(summaryCard);

  // Sincronizar ELO no perfil oficial
  const btnSyncTrad = document.getElementById('btnSyncEloProfileTraditional');
  if (btnSyncTrad) {
    btnSyncTrad.addEventListener('click', async () => {
      const confirmSync = await showConfirmModal(
        'Sincronizar ELO',
        `Deseja aplicar a variação de ELO deste simulado (${varSign}${eloSim.variacaoTotal} pontos) ao seu perfil oficial no Maia.edu?`,
        'Sim, Atualizar Perfil',
        'Não, Descartar',
        true
      );
      if (confirmSync) {
        const sessionHistory = eloSim.itemLogs.map((log) => ({
          questaoId: log.questaoId,
          opcaoSelecionada: log.escolheu,
          gabaritoCorreto: log.correta,
          certezas: log.certezas || {},
          complexidadeObj: log.complexidadeObj || null,
          fullData: log.fullData || null,
          tipoQuestao: tipo === 'dissertativa' ? 'dissertativa' : 'objetiva',
        }));
        EloService.sincronizarSessaoEloAoPerfil(sessionHistory);
        customAlert('✅ Perfil oficial atualizado com o ELO do simulado!', 3000);
      }
    });
  }

  // Voltar a revisar questões
  document.getElementById('btnReviewExam').addEventListener('click', () => {
    activeSimIndex = 0;
    renderExamUI(questoes, tipo, titulo);
  });

  // Voltar ao dashboard
  document.getElementById('btnGoBackDash').addEventListener('click', () => {
    iniciarModoSimulados();
  });
}

// ========================================================
// CARREGAMENTO DE SIMULADO COMPARTILHADO VIA DEEP LINK
// ========================================================

export async function carregarSimuladoCompartilhado(
  tipo,
  titulo,
  idsString,
  evalParam = 'convencional',
) {
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
    const entries = idsString.split(',');
    const promises = entries.map(async (entry) => {
      const parts = entry.split(':');
      const prova = parts[0];
      const id = parts[1];

      const dbRef = ref(db, `questoes/${prova}/${id}`);
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const fullData = snapshot.val();
        // Garante metadados
        if (!fullData.meta) fullData.meta = {};
        if (!fullData.meta.material_origem) {
          fullData.meta.material_origem = prova.replace(/_/g, ' ');
        }

        const q = fullData.dados_questao || {};
        const textPreview =
          (q.estrutura || []).map((b) => b.conteudo || '').join(' ') || q.enunciado || '';

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
      throw new Error('Nenhuma questão válida encontrada para este simulado.');
    }

    // Copia as questões para as variáveis locais do dashboard
    selectedQuestions = validQuestions;
    simuladoTitle = titulo || 'Simulado Compartilhado';
    simuladoType = tipo || detectarSimuladoType(validQuestions);
    evalMethod = evalParam || 'convencional';

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
