/**
 * perfil-screen.js
 * Interface Principal da Tela de Perfil e Estatísticas de Elo para Maia.edu
 */
import { EloService, calcularPerfisEstudante, getEloRankTier, getEloState } from '../services/elo-service.js';
import { openRankingModal } from './ranking-modal.js';
import { SVG_ICONS } from '../utils/svg-icons.js';

let currentSubTab = 'visao-geral';
let historySearchQuery = '';
let historyFilterResult = 'todos';

export function renderPerfilScreen(container) {
  if (!container) return;

  const state = getEloState();
  const user = state.user || {};
  const theta = user.theta || 1500;
  const total = user.total_respostas || 0;
  const acertos = user.total_acertos || 0;
  const taxaAcerto = total > 0 ? Math.round((acertos / total) * 100) : 0;

  const perfisData = calcularPerfisEstudante(state);
  const rankTier = perfisData.rankTier;
  const dominante = perfisData.dominante;
  const perfisAtivos = perfisData.perfisAtivos || [];
  const stats = perfisData.stats || {};

  container.style.backgroundColor = "var(--color-background-json)";

  container.innerHTML = `
    <div class="perfil-screen-container fade-in">
      <!-- CLEAN STATS HERO HEADER -->
      <div class="perfil-hero-card">
        <div class="perfil-user-info">
          <div class="perfil-user-details">
            <div class="perfil-user-title-row">
              <h1 class="perfil-user-name">Painel de Desempenho & Elo</h1>
              <span class="perfil-rank-badge" style="background: ${rankTier.color}; box-shadow: 0 0 15px ${rankTier.glow};">
                ${rankTier.badge}
              </span>
            </div>
            <p class="perfil-user-email">Análise metacognitiva, diagnóstico de IA e evolução por disciplinas</p>
          </div>
        </div>

        <div class="perfil-elo-score-box js-open-ranking" title="Clique para abrir o Ranking de Maestria">
          <div class="perfil-elo-header">
            <span class="perfil-elo-value">${theta} <small>ELO</small></span>
            <span class="perfil-elo-level-tag">${rankTier.tier}</span>
          </div>
          <div class="perfil-elo-progress-bar">
            <div class="perfil-elo-progress-fill" style="width: ${rankTier.progressPct}%; background: ${rankTier.color}"></div>
          </div>
          <span class="perfil-elo-next-text">
            ${rankTier.nextTier ? `Próximo: ${rankTier.nextTier} (${rankTier.progressPct}%)` : 'Grau Máximo Conquistado'}
          </span>
        </div>
      </div>

      <!-- ESTATÍSTICAS RÁPIDAS (METRICS GRID) -->
      <div class="perfil-metrics-grid">
        <div class="perfil-metric-card">
          <div class="metric-icon icon-cyan">${SVG_ICONS.target}</div>
          <div class="metric-data">
            <span class="metric-value">${taxaAcerto}%</span>
            <span class="metric-label">Taxa de Acerto Global (${acertos}/${total})</span>
          </div>
        </div>

        <div class="perfil-metric-card">
          <div class="metric-icon icon-purple">${SVG_ICONS.brain}</div>
          <div class="metric-data">
            <span class="metric-value">${Math.round((1 - (stats.avgBrier || 0)) * 100)}%</span>
            <span class="metric-label">Calibração Metacognitiva (Precisão)</span>
          </div>
        </div>

        <div class="perfil-metric-card">
          <div class="metric-icon icon-amber">${SVG_ICONS.sword}</div>
          <div class="metric-data">
            <span class="metric-value">${Math.round((stats.avgElimination || 0) * 100)}%</span>
            <span class="metric-label">Taxa de Eliminação de Distratores</span>
          </div>
        </div>

        <div class="perfil-metric-card">
          <div class="metric-icon icon-teal">${SVG_ICONS.scale}</div>
          <div class="metric-data">
            <span class="metric-value">${Math.round((stats.avgCoerencia || 0.5) * 100)}%</span>
            <span class="metric-label">Índice de Coerência Lógica</span>
          </div>
        </div>
      </div>

      <!-- SUB-ABAS NAVEGAÇÃO -->
      <div class="perfil-subtabs-nav">
        <button class="perfil-subtab-btn ${currentSubTab === 'visao-geral' ? 'active' : ''}" data-subtab="visao-geral">
          <span class="tab-btn-icon">${SVG_ICONS.sparkles}</span> Visão Geral & Perfis IA
        </button>
        <button class="perfil-subtab-btn ${currentSubTab === 'topicos' ? 'active' : ''}" data-subtab="topicos">
          <span class="tab-btn-icon">${SVG_ICONS.chart}</span> Análise por Tópicos (${Object.keys(state.aspectos || {}).length})
        </button>
        <button class="perfil-subtab-btn ${currentSubTab === 'historico' ? 'active' : ''}" data-subtab="historico">
          <span class="tab-btn-icon">${SVG_ICONS.history}</span> Histórico de Questões (${(user.historico || []).length})
        </button>
      </div>

      <!-- CONTEÚDO DAS SUB-ABAS -->
      <div id="perfilSubtabContent" class="perfil-subtab-content">
        <!-- Renderizado dinamicamente -->
      </div>
    </div>
  `;

  // Attach event listener for Ranking Modal
  container.querySelectorAll('.js-open-ranking, .js-open-ranking-header').forEach((el) => {
    el.addEventListener('click', () => {
      openRankingModal();
    });
  });

  // Subtab buttons listeners
  container.querySelectorAll('.perfil-subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSubTab = btn.dataset.subtab;
      container.querySelectorAll('.perfil-subtab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderSubtabContent(container, state, perfisData);
    });
  });

  renderSubtabContent(container, state, perfisData);
}

function renderSubtabContent(container, state, perfisData) {
  const contentEl = container.querySelector('#perfilSubtabContent');
  if (!contentEl) return;

  if (currentSubTab === 'visao-geral') {
    renderVisaoGeralTab(contentEl, perfisData, state);
  } else if (currentSubTab === 'topicos') {
    renderTopicosTab(contentEl, state);
  } else if (currentSubTab === 'historico') {
    renderHistoricoTab(contentEl, state.user?.historico || []);
  }
}

function renderVisaoGeralTab(container, perfisData, state) {
  const dominante = perfisData.dominante || {};
  const perfisAtivos = perfisData.perfisAtivos || [];
  const historico = state.user?.historico || [];

  container.innerHTML = `
    <div class="subtab-visao-geral-container">
      <!-- CARD ARQUÉTIPO DOMINANTE DA IA -->
      <div class="perfil-archetype-dominant-card">
        <div class="archetype-dominant-header">
          <span class="archetype-label-tag">ARQUÉTIPO DOMINANTE DIAGNOSTICADO PELA IA</span>
          <h2 class="archetype-title">${dominante.titulo ? dominante.titulo.replace(/[\u{1F300}-\u{1F9FF}]/gu, '') : 'Estudante em Evolução'}</h2>
        </div>
        <p class="archetype-desc">${dominante.descricao || 'Resolva mais questões no Banco para refinar a análise contínua do seu perfil.'}</p>
        <div class="archetype-recommendation">
          <strong>Direcionamento Pedagógico da IA:</strong>
          <p>${dominante.recomendacao || 'Mantenha constância na resolução diária para acelerar a subida de Elo.'}</p>
        </div>
      </div>

      <!-- EVOLUÇÃO TEMPORAL DO ELO (GRÁFICO COM CHART.JS) -->
      <div class="perfil-card-section">
        <div class="section-header-title">
          <h3>Curva de Evolução Temporal do Elo</h3>
          <span class="section-subtitle">Passe o mouse ou clique nos pontos para ver o detalhamento por questão</span>
        </div>
        <div id="mainEloChartContainer" class="elo-chart-container">
          <!-- Canvas renderizado via Chart.js -->
        </div>
      </div>

      <!-- ARQUÉTIPOS SECUNDÁRIOS ATIVOS -->
      <div class="perfil-card-section">
        <div class="section-header-title">
          <h3>Perfis & Arquétipos Ativos (${perfisAtivos.length})</h3>
          <span class="section-subtitle">Classificação em 7 eixos comportamentais</span>
        </div>

        <div class="archetypes-active-grid">
          ${
            perfisAtivos.length > 0
              ? perfisAtivos
                  .map(
                    (p) => `
                <div class="archetype-active-card" style="border-top-color: ${p.cor}">
                  <div class="archetype-card-header">
                    <span class="archetype-badge-chip" style="background: ${p.cor}22; color: ${p.cor}">${p.badge ? p.badge.replace(/[\u{1F300}-\u{1F9FF}]/gu, '') : 'Perfil'}</span>
                    <span class="archetype-eixo-name">${p.eixo}</span>
                  </div>
                  <h4 class="archetype-card-title">${p.titulo ? p.titulo.replace(/[\u{1F300}-\u{1F9FF}]/gu, '') : 'Perfil'}</h4>
                  <p class="archetype-card-desc">${p.descricao}</p>
                </div>
              `,
                  )
                  .join('')
              : '<p class="perfil-empty-text">Resolva mais questões no Banco de Questões para desbloquear arquétipos secundários!</p>'
          }
        </div>
      </div>
    </div>
  `;

  const chartContainerEl = container.querySelector('#mainEloChartContainer');
  if (chartContainerEl) {
    renderEloEvolutionChartCanvas(historico.slice().reverse(), chartContainerEl);
  }
}

function renderEloEvolutionChartCanvas(chartData, containerEl) {
  if (!chartData || chartData.length < 2) {
    containerEl.innerHTML = '<div class="elo-chart-empty">Resolva mais de 2 questões no Banco de Questões para visualizar a curva de evolução do seu Elo.</div>';
    return;
  }

  containerEl.innerHTML = `
    <div class="elo-chart-canvas-wrapper" style="position: relative; width: 100%; height: 260px;">
      <canvas id="eloEvolutionChartCanvas"></canvas>
    </div>
  `;

  setTimeout(() => {
    const canvas = containerEl.querySelector('#eloEvolutionChartCanvas');
    if (!canvas || !window.Chart) return;

    const ctx = canvas.getContext('2d');

    const labels = chartData.map((d, i) => {
      if (d.timestamp) {
        return new Date(d.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
      return `#${i + 1}`;
    });

    const dataPoints = chartData.map((d) => d.thetaAfter || 1500);
    const pointBgColors = chartData.map((d) => (d.acertou ? '#10b981' : '#ef4444'));

    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Elo Theta',
            data: dataPoints,
            borderColor: '#6366f1',
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            backgroundColor: gradient,
            pointBackgroundColor: pointBgColors,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
            pointRadius: chartData.length > 50 ? 3 : 5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (evt, activeEls) => {
          if (activeEls && activeEls.length > 0) {
            const index = activeEls[0].index;
            if (chartData[index]) {
              openQuestionDetailModal(chartData[index]);
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return formatQuestionTitle(chartData[idx]);
              },
              label: (item) => {
                const idx = item.dataIndex;
                const h = chartData[idx];
                const deltaStr = h.deltaTheta >= 0 ? `+${h.deltaTheta}` : `${h.deltaTheta}`;
                const status = h.acertou ? 'Correta' : 'Incorreta';
                return [
                  `Elo: ${h.thetaAfter} (${deltaStr})`,
                  `Resultado: ${status}`,
                  `Matéria: ${(h.materias || ['Geral'])[0]}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            ticks: { color: '#94a3b8' },
          },
        },
      },
    });
  }, 100);
}

function renderTopicosTab(container, state) {
  const aspectos = state.aspectos || {};
  const keys = Object.keys(aspectos);

  if (keys.length === 0) {
    container.innerHTML = `
      <div class="perfil-card-section">
        <p class="perfil-empty-text">Nenhum tópico ou disciplina registrada ainda. Resolva questões no Banco de Questões para acompanhar seu Elo por assunto!</p>
      </div>
    `;
    return;
  }

  const disciplinas = keys.filter((k) => aspectos[k].categoria === 'disciplina');
  const outros = keys.filter((k) => aspectos[k].categoria !== 'disciplina');

  container.innerHTML = `
    <div class="subtab-topicos-container">
      <div class="perfil-card-section">
        <div class="section-header-title">
          <h3>Elo por Matéria / Disciplina (${disciplinas.length})</h3>
          <span class="section-subtitle">Clique em qualquer matéria para abrir o gráfico de evolução do tópico!</span>
        </div>
        <div class="topicos-grid">
          ${disciplinas.map((k) => renderTopicoCard(k, aspectos[k])).join('')}
        </div>
      </div>

      <div class="perfil-card-section">
        <div class="section-header-title">
          <h3>Elo por Assunto / Tag (${outros.length})</h3>
          <span class="section-subtitle">Clique em qualquer tag para abrir a análise detalhada por assunto!</span>
        </div>
        <div class="topicos-grid">
          ${outros.map((k) => renderTopicoCard(k, aspectos[k])).join('')}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    container.querySelectorAll('.topico-card').forEach((card) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const key = card.dataset.aspkey;
        if (key && aspectos[key]) {
          openTopicoDetailModal(key, aspectos[key], state.user?.historico || []);
        }
      });
    });
  }, 50);
}

function renderTopicoCard(key, asp) {
  const theta = asp.theta || 1500;
  const tier = getEloRankTier(theta);
  const total = asp.total_respostas || 0;
  const acertos = asp.total_acertos || 0;
  const pct = total > 0 ? Math.round((acertos / total) * 100) : 0;

  return `
    <div class="topico-card" data-aspkey="${escapeHtml(key)}">
      <div class="topico-card-header">
        <span class="topico-title">${escapeHtml(asp.label || key)}</span>
        <span class="topico-elo-badge" style="background: ${tier.color}">${theta} ELO</span>
      </div>
      <div class="topico-stats-row">
        <span>Acurácia: <strong>${pct}%</strong> (${acertos}/${total})</span>
        <span>${tier.tier}</span>
      </div>
      <div class="topico-progress-track">
        <div class="topico-progress-fill" style="width: ${tier.progressPct}%; background: ${tier.color}"></div>
      </div>
    </div>
  `;
}

export function openTopicoDetailModal(aspKey, aspData, historico = []) {
  if (!aspData) return;

  const existing = document.getElementById('topicoDetailModalContainer');
  if (existing) existing.remove();

  const label = aspData.label || aspKey;
  const theta = aspData.theta || 1500;
  const tier = getEloRankTier(theta);
  const total = aspData.total_respostas || 0;
  const acertos = aspData.total_acertos || 0;
  const pct = total > 0 ? Math.round((acertos / total) * 100) : 0;

  const normLabel = removeAccents(label);
  const filteredHist = (historico || []).filter((h) => {
    if (!h) return false;
    const inMaterias = (h.materias || []).some((m) => removeAccents(m) === normLabel || removeAccents(m).includes(normLabel));
    const inKeys = (h.aspectosKeys || []).includes(aspKey);
    const inBanca = removeAccents(h.banca) === normLabel;
    return inMaterias || inKeys || inBanca;
  }).reverse();

  const modalHtml = `
    <div id="topicoDetailModalContainer" class="perfil-modal-overlay fade-in">
      <div class="perfil-modal-card topico-detail-modal zoom-in">
        <button class="perfil-modal-close" id="closeTopicoModal">&times;</button>

        <div class="topico-modal-header">
          <div class="topico-modal-title-group">
            <span class="topico-modal-badge" style="background: ${tier.color}">
              ${tier.badge}
            </span>
            <h2 class="topico-modal-title">${escapeHtml(label)}</h2>
            <span class="topico-modal-sub">Categoria: ${escapeHtml(aspData.categoriaLabel || aspData.categoria || 'Geral')}</span>
          </div>
        </div>

        <div class="topico-modal-stats-grid">
          <div class="topico-stat-card">
            <span class="stat-val">${theta} <small>ELO</small></span>
            <span class="stat-lbl">Proficiência Atual</span>
          </div>
          <div class="topico-stat-card">
            <span class="stat-val">${pct}%</span>
            <span class="stat-lbl">Acurácia (${acertos}/${total} acertos)</span>
          </div>
          <div class="topico-stat-card">
            <span class="stat-val">${tier.tier}</span>
            <span class="stat-lbl">Grau de Maestria</span>
          </div>
        </div>

        <div class="topico-chart-section">
          <h3>Curva de Evolução do Elo em ${escapeHtml(label)}</h3>
          <div id="topicoChartWrapper" class="topico-chart-wrapper" style="position: relative; width: 100%; height: 220px;">
            ${filteredHist.length < 2 
              ? '<div class="elo-chart-empty">Pouco histórico registrado para este tópico específico. Resolva mais questões no Banco para formar o gráfico de evolução!</div>' 
              : '<canvas id="topicoChartCanvas"></canvas>'}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalContainer = document.getElementById('topicoDetailModalContainer');
  const btnClose = document.getElementById('closeTopicoModal');

  const closeFn = () => modalContainer.remove();
  btnClose?.addEventListener('click', closeFn);
  modalContainer?.addEventListener('click', (e) => {
    if (e.target === modalContainer) closeFn();
  });

  if (filteredHist.length >= 2) {
    setTimeout(() => {
      const canvas = modalContainer.querySelector('#topicoChartCanvas');
      if (!canvas || !window.Chart) return;
      const ctx = canvas.getContext('2d');

      const labels = filteredHist.map((d, i) => `#${i + 1}`);
      const dataPoints = filteredHist.map((d) => d.thetaAfter || 1500);

      new window.Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: label,
              data: dataPoints,
              borderColor: '#32b8c6',
              borderWidth: 3,
              tension: 0.35,
              fill: false,
              pointBackgroundColor: filteredHist.map((d) => (d.acertou ? '#10b981' : '#ef4444')),
              pointRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { color: '#94a3b8' } },
          },
        },
      });
    }, 100);
  }
}

function renderHistoricoTab(container, historico) {
  container.innerHTML = `
    <div class="subtab-historico-container">
      <div class="historico-filters-bar">
        <div class="historico-search-box">
          <span class="search-icon">${SVG_ICONS.search || '🔍'}</span>
          <input type="text" id="historicoSearchInput" class="historico-search-input" placeholder="Pesquisar por título, exame, matérias ou código..." value="${escapeHtml(historySearchQuery)}">
        </div>
        <div class="historico-filter-buttons">
          <button class="historico-filter-btn ${historyFilterResult === 'todos' ? 'active' : ''}" data-filter="todos">Todas</button>
          <button class="historico-filter-btn ${historyFilterResult === 'acertos' ? 'active' : ''}" data-filter="acertos">Acertos</button>
          <button class="historico-filter-btn ${historyFilterResult === 'erros' ? 'active' : ''}" data-filter="erros">Erros</button>
        </div>
      </div>

      <div id="historicoItemsList" class="historico-items-list">
        <!-- Itens renderizados dinamicamente -->
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#historicoSearchInput');
  const filterBtns = container.querySelectorAll('.historico-filter-btn');

  searchInput?.addEventListener('input', (e) => {
    historySearchQuery = e.target.value;
    updateHistoricoList(container, historico);
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      historyFilterResult = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateHistoricoList(container, historico);
    });
  });

  updateHistoricoList(container, historico);
}

function updateHistoricoList(container, hist) {
  const listEl = container.querySelector('#historicoItemsList');
  if (!listEl) return;

  let filtered = [...hist];

  if (historyFilterResult === 'acertos') {
    filtered = filtered.filter((h) => h.acertou);
  } else if (historyFilterResult === 'erros') {
    filtered = filtered.filter((h) => !h.acertou);
  }

  if (historySearchQuery.trim()) {
    const qTokens = removeAccents(historySearchQuery).split(/\s+/).filter(Boolean);

    filtered = filtered.filter((h) => {
      const titleClean = formatQuestionTitle(h);
      const materiasStr = (h.materias || []).join(' ');
      const statusStr = h.acertou ? 'correta acerto acertou' : 'incorreta erro errou';

      const fullText = removeAccents(`
        ${titleClean} 
        ${h.questaoId || ''} 
        ${materiasStr} 
        ${h.banca || ''} 
        ${h.diagnosticoTitulo || ''} 
        ${h.tipoQuestao || ''} 
        ${statusStr}
      `);

      return qTokens.every((token) => fullText.includes(token));
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="perfil-empty-text">Nenhuma questão encontrada no histórico com os filtros selecionados.</p>';
    return;
  }

  listEl.innerHTML = filtered
    .map((item, idx) => {
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Recente';
      const deltaStr = item.deltaTheta >= 0 ? `+${item.deltaTheta}` : `${item.deltaTheta}`;
      const deltaClass = item.deltaTheta >= 0 ? 'delta-positive' : 'delta-negative';
      const resultBadge = item.acertou ? '<span class="badge-acerto">CORRETA</span>' : '<span class="badge-erro">INCORRETA</span>';
      const titleClean = formatQuestionTitle(item);
      const hasBrier = item.sBrier !== undefined && item.sBrier !== null && parseFloat(item.sBrier) > 0;
      const brierPercent = hasBrier ? Math.min(100, Math.max(0, Math.round((1 - parseFloat(item.sBrier)) * 100))) : null;

      return `
        <div class="historico-card-item" data-idx="${idx}">
          <div class="historico-item-header">
            <div class="historico-item-title-group">
              <span class="historico-id">${escapeHtml(titleClean)}</span>
              ${resultBadge}
              <span class="historico-materia-tag">${escapeHtml((item.materias || ['Geral'])[0])}</span>
            </div>
            <span class="historico-date">${dateStr}</span>
          </div>

          <div class="historico-item-details">
            <div class="historico-detail-cell">
              <span class="detail-label">Variação de Elo:</span>
              <span class="detail-value ${deltaClass}">${deltaStr} ELO (${item.thetaBefore} → ${item.thetaAfter})</span>
            </div>

            ${
              hasBrier
                ? `
              <div class="historico-detail-cell">
                <span class="detail-label">Precisão Brier:</span>
                <span class="detail-value">${brierPercent}%</span>
              </div>
            `
                : ''
            }

            <div class="historico-detail-cell">
              <span class="detail-label">Diagnóstico:</span>
              <span class="detail-value">${escapeHtml(item.diagnosticoTitulo || 'Diagnóstico Concluído')}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  setTimeout(() => {
    listEl.querySelectorAll('.historico-card-item').forEach((card) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const idx = card.dataset.idx;
        if (idx !== undefined && filtered[idx]) {
          openQuestionDetailModal(filtered[idx]);
        }
      });
    });
  }, 50);
}

export function openQuestionDetailModal(item) {
  if (!item) return;

  const existing = document.getElementById('questionDetailModalContainer');
  if (existing) existing.remove();

  const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : 'Data não registrada';
  const deltaStr = item.deltaTheta >= 0 ? `+${item.deltaTheta}` : `${item.deltaTheta}`;
  const deltaClass = item.deltaTheta >= 0 ? 'text-positive' : 'text-negative';
  const resultText = item.acertou ? '✓ RESPOSTA CORRETA' : '✗ RESPOSTA INCORRETA';
  const resultClass = item.acertou ? 'status-correct' : 'status-incorrect';
  const titleClean = formatQuestionTitle(item);

  const hasBrier = item.sBrier !== undefined && item.sBrier !== null && parseFloat(item.sBrier) > 0;
  const brierPercent = hasBrier ? Math.min(100, Math.max(0, Math.round((1 - parseFloat(item.sBrier)) * 100))) : 0;
  const eliminationPercent = Math.round((item.eRate || 0) * 100);

  const modalHtml = `
    <div id="questionDetailModalContainer" class="perfil-modal-overlay fade-in">
      <div class="perfil-modal-card question-detail-modal-redesign zoom-in">
        <button class="perfil-modal-close" id="closeDetailModal">&times;</button>

        <div class="qmodal-header ${resultClass}">
          <div class="qmodal-status-badge">
            ${resultText}
          </div>
          <h2 class="qmodal-title">${escapeHtml(titleClean)}</h2>
          <span class="qmodal-sub">ID da Questão: ${escapeHtml(String(item.questaoId || ''))}</span>
        </div>

        <div class="qmodal-body-grid">
          <div class="qmodal-card">
            <span class="qmodal-card-label">Variação no Elo Geral</span>
            <span class="qmodal-card-val ${deltaClass}">
              ${deltaStr} ELO
            </span>
            <span class="qmodal-card-sub">${item.thetaBefore} → ${item.thetaAfter} ELO</span>
          </div>

          <div class="qmodal-card">
            <span class="qmodal-card-label">Dificuldade Efetiva (Item)</span>
            <span class="qmodal-card-val">
              ${item.bBefore || 1500} → ${item.bAfter || 1500} ELO
            </span>
            <span class="qmodal-card-sub">Escala Rasch 1PL</span>
          </div>

          <div class="qmodal-card">
            <span class="qmodal-card-label">Precisão Metacognitiva</span>
            <span class="qmodal-card-val cyan">
              ${hasBrier ? `${brierPercent}%` : 'N/A'}
            </span>
            <span class="qmodal-card-sub">Calibração Brier Score</span>
          </div>

          <div class="qmodal-card">
            <span class="qmodal-card-label">Eliminação de Distratores</span>
            <span class="qmodal-card-val amber">
              ${eliminationPercent}%
            </span>
            <span class="qmodal-card-sub">Opções descarta/descartadas</span>
          </div>

          <div class="qmodal-card col-span-2">
            <span class="qmodal-card-label">Diagnóstico Metacognitivo da IA</span>
            <span class="qmodal-card-val text-purple">
              ${escapeHtml(item.diagnosticoTitulo || 'Diagnóstico Concluído')}
            </span>
            <span class="qmodal-card-sub">Data: ${dateStr}</span>
          </div>

          ${
            item.materias && item.materias.length > 0
              ? `
            <div class="qmodal-card col-span-2">
              <span class="qmodal-card-label">Disciplinas & Tópicos Afetados</span>
              <div class="qmodal-tags-list">
                ${item.materias.map((m) => `<span class="qmodal-tag">${escapeHtml(m)}</span>`).join('')}
                ${item.banca ? `<span class="qmodal-tag banca">${escapeHtml(item.banca)}</span>` : ''}
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const container = document.getElementById('questionDetailModalContainer');
  const btnClose = document.getElementById('closeDetailModal');

  const closeFn = () => container.remove();
  btnClose?.addEventListener('click', closeFn);
  container?.addEventListener('click', (e) => {
    if (e.target === container) closeFn();
  });
}

function formatQuestionTitle(item) {
  if (!item || !item.questaoId) return 'Questão Geral';
  let qid = String(item.questaoId);

  if (qid.includes('___')) {
    const parts = qid.split('___');
    const exam = parts[0].replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
    const rawNum = parts[1] || '';
    const numMatch = rawNum.match(/\d+/);
    const num = numMatch ? `#${numMatch[0]}` : rawNum.replace(/_/g, ' ');
    return `Questão ${num} (${exam})`;
  }

  const clean = qid.replace(/_/g, ' ').replace(/-/g, ' ');
  return `Questão ${clean}`;
}

function removeAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default renderPerfilScreen;
