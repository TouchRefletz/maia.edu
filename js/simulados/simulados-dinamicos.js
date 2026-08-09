/**
 * Simulados Dinâmicos Adaptativos por Aspecto (Maia.edu)
 * Gerencia a aba de Simulados Dinâmicos, catálogo de aspectos, setup modal,
 * execução adaptativa questão por questão e relatório de encerramento.
 */

import {
  renderBotaoScanGabarito,
  renderCreditosCompleto,
  renderFontesExternas,
  renderMatrizComplexidade,
  renderPassosComDetalhes,
  renderRelatorioPesquisa,
} from '../banco/card-partes.js';
import { gerarHtmlAlternativas } from '../banco/card-template.js';
import { hydrateBankCard } from '../banco/bank-hydration.tsx';
import { prepararImagensVisualizacao } from '../banco/imagens.js';
import { renderizarEstruturaHTML } from '../render/structure.js';
import { EloService, getEloRankTier, getEloState, getQuestionElo } from '../services/elo-service.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { showConfirmModal } from '../ui/modal-confirm.js';
import { getQuestionElo as getQuestionEloMain, iniciarModoSimulados } from './simulados-main.js';

// Estado local da sessão dinâmica ativa
let currentSession = null;

/**
 * Extrai o objeto de complexidade/dificuldade da questão de qualquer um dos caminhos possíveis
 */
export function extractQuestionComplexityObj(qObj) {
  if (!qObj) return null;
  const fullData = qObj.fullData || {};
  const quest = fullData.dados_questao || {};
  const gab = fullData.dados_gabarito || {};
  const meta = fullData.meta || {};

  const baseComp = gab.analise_complexidade 
    || quest.analise_complexidade 
    || fullData.analise_complexidade 
    || {};

  const pontuacao = baseComp.pontuacao_final_complexidade 
    ?? baseComp.dificuldade_percentual 
    ?? quest.dificuldade_percentual
    ?? gab.dificuldade_percentual
    ?? meta.dificuldade_percentual;

  const nivel = baseComp.nivel 
    || baseComp.classificacao_dificuldade 
    || quest.dificuldade 
    || gab.dificuldade 
    || meta.dificuldade;

  return {
    ...baseComp,
    pontuacao_final_complexidade: pontuacao,
    nivel: nivel,
  };
}

/**
 * Retorna o valor numérico puro do ELO de uma questão usando o conversor do Maia.edu
 */
export function getNumericElo(qObj) {
  if (!qObj) return 1500;
  const computedElo = getQuestionEloMain(qObj);
  if (typeof computedElo === 'number' && !Number.isNaN(computedElo) && computedElo > 0) {
    return computedElo;
  }
  return 1500;
}

/**
 * Busca de forma resiliente o ELO específico de um aspecto/matéria no estado do aluno
 */
export function findAspectElo(userEloState, aspectInfo) {
  if (!userEloState || !userEloState.aspectos || !aspectInfo) return null;
  const aspectos = userEloState.aspectos;

  const rawId = String(aspectInfo.id || '').trim();
  const rawLabel = String(aspectInfo.label || '').trim();
  const cleanLabel = rawLabel.toLowerCase().replace(/\s+/g, '_');

  const candidates = [
    rawId,
    rawLabel,
    cleanLabel,
    `disciplina_${cleanLabel}`,
    `mat_${cleanLabel}`,
    `tag_${cleanLabel}`,
    `comp_${cleanLabel}`,
    rawId.replace(/^mat_/, 'disciplina_'),
    rawId.replace(/^mat_/, ''),
    rawId.replace(/^tag_/, ''),
    rawId.replace(/^comp_/, ''),
  ];

  for (const key of candidates) {
    if (aspectos[key] && typeof aspectos[key].theta === 'number') {
      return aspectos[key].theta;
    }
  }

  // Fallback case-insensitive
  const keysInState = Object.keys(aspectos);
  for (const k of keysInState) {
    const kLower = k.toLowerCase();
    if (kLower === cleanLabel || kLower.endsWith(`_${cleanLabel}`) || kLower.endsWith(`:${cleanLabel}`)) {
      if (typeof aspectos[k].theta === 'number') return aspectos[k].theta;
    }
  }

  return null;
}

/**
 * Extrai e categoriza profundamente os aspectos, tags, matérias e sub-tópicos do banco de questões
 */
export function extractAspectsFromBank(questionsPool) {
  const aspects = {
    geral: {
      id: 'geral',
      label: 'Simulado Geral Adaptativo',
      icon: '🎯',
      count: questionsPool.length,
      description: 'Mistura todas as matérias e níveis do banco de questões',
      filter: () => true,
    },
    comImagem: {
      id: 'com_imagem',
      label: 'Questões com Imagem',
      icon: '🖼️',
      count: 0,
      description: 'Exercícios com gráficos, mapas, tabelas ou ilustrações',
      filter: (q) => {
        const fullData = q.fullData || {};
        const quest = fullData.dados_questao || {};
        const meta = fullData.meta || {};
        const fotos = quest.fotos_originais || [];
        const estr = quest.estrutura || [];
        const temImgBloco = estr.some(
          (b) => b.tipo === 'imagem' || (b.conteudo && String(b.conteudo).includes('<img'))
        );
        return meta.tem_imagem || fotos.length > 0 || temImgBloco;
      },
    },
    materias: {},
    complexidade: {},
    tags: {},
  };

  questionsPool.forEach((q) => {
    const fullData = q.fullData || {};
    const quest = fullData.dados_questao || {};
    const gab = fullData.dados_gabarito || {};
    const meta = fullData.meta || {};

    // 1. Contagem de questões com imagem
    if (aspects.comImagem.filter(q)) {
      aspects.comImagem.count++;
    }

    // 2. Extração Completa de Matérias
    const setMaterias = new Set();
    if (Array.isArray(q.subjects)) q.subjects.forEach((s) => setMaterias.add(String(s).trim()));
    if (Array.isArray(quest.materias_possiveis)) quest.materias_possiveis.forEach((s) => setMaterias.add(String(s).trim()));
    if (quest.materia) setMaterias.add(String(quest.materia).trim());
    if (meta.materia) setMaterias.add(String(meta.materia).trim());

    setMaterias.forEach((cleanMat) => {
      if (!cleanMat || cleanMat.length < 2) return;
      if (!aspects.materias[cleanMat]) {
        aspects.materias[cleanMat] = {
          id: `mat_${cleanMat}`,
          label: cleanMat,
          icon: getSubjectIcon(cleanMat),
          count: 0,
          description: `Treino focado em ${cleanMat}`,
          filter: (item) => {
            const itemFull = item.fullData || {};
            const itemQuest = itemFull.dados_questao || {};
            const itemMeta = itemFull.meta || {};
            const itemMats = [
              ...(item.subjects || []),
              ...(itemQuest.materias_possiveis || []),
              itemQuest.materia,
              itemMeta.materia,
            ].filter(Boolean).map((m) => String(m).trim().toLowerCase());
            return itemMats.includes(cleanMat.toLowerCase());
          },
        };
      }
      aspects.materias[cleanMat].count++;
    });

    // 3. Extração Completa de Tags, Palavras-chave, Assuntos e Submátérias
    const rawTags = [
      ...(Array.isArray(quest.tags) ? quest.tags : []),
      ...(Array.isArray(quest.palavras_chave) ? quest.palavras_chave : []),
      ...(Array.isArray(gab.tags) ? gab.tags : []),
      ...(Array.isArray(gab.palavras_chave) ? gab.palavras_chave : []),
      ...(Array.isArray(meta.tags) ? meta.tags : []),
      ...(Array.isArray(meta.palavras_chave) ? meta.palavras_chave : []),
      quest.assunto,
      quest.topico,
      meta.topico,
      meta.submateria,
      meta.assunto,
    ].filter((t) => t && typeof t === 'string' && t.trim().length >= 2);

    const setTags = new Set(rawTags.map((t) => String(t).trim()));

    setTags.forEach((cleanTag) => {
      if (!cleanTag) return;
      if (!aspects.tags[cleanTag]) {
        aspects.tags[cleanTag] = {
          id: `tag_${cleanTag}`,
          label: cleanTag,
          icon: '🏷️',
          count: 0,
          description: `Exercícios sobre ${cleanTag}`,
          filter: (item) => {
            const itemFull = item.fullData || {};
            const itemQuest = itemFull.dados_questao || {};
            const itemGab = itemFull.dados_gabarito || {};
            const itemMeta = itemFull.meta || {};
            const allItemTags = [
              ...(itemQuest.tags || []),
              ...(itemQuest.palavras_chave || []),
              ...(itemGab.tags || []),
              ...(itemGab.palavras_chave || []),
              ...(itemMeta.tags || []),
              ...(itemMeta.palavras_chave || []),
              itemQuest.assunto,
              itemQuest.topico,
              itemMeta.topico,
              itemMeta.submateria,
              itemMeta.assunto,
            ].filter((t) => t && typeof t === 'string').map((t) => t.trim().toLowerCase());

            return allItemTags.includes(cleanTag.toLowerCase());
          },
        };
      }
      aspects.tags[cleanTag].count++;
    });

    // 4. Extração Completa de Aspectos de Complexidade / Habilidades
    const compObj = gab.analise_complexidade || quest.analise_complexidade || fullData.analise_complexidade;
    if (compObj && compObj.fatores && typeof compObj.fatores === 'object') {
      Object.keys(compObj.fatores).forEach((fatorKey) => {
        const fatorVal = compObj.fatores[fatorKey];
        if (fatorVal && (fatorVal.score > 30 || fatorVal.peso > 0 || fatorVal.ativo !== false)) {
          const labelFator = fatorVal.nome || fatorVal.label || fatorKey;
          if (!aspects.complexidade[fatorKey]) {
            aspects.complexidade[fatorKey] = {
              id: `comp_${fatorKey}`,
              label: labelFator,
              icon: '⚙️',
              count: 0,
              description: `Aprimorar habilidade: ${labelFator}`,
              filter: (item) => {
                const itemGab = item.fullData?.dados_gabarito || {};
                const itemQuest = item.fullData?.dados_questao || {};
                const cObj = itemGab.analise_complexidade || itemQuest.analise_complexidade || item.fullData?.analise_complexidade;
                return cObj?.fatores?.[fatorKey] !== undefined;
              },
            };
          }
          aspects.complexidade[fatorKey].count++;
        }
      });
    }
  });

  return aspects;
}

function getSubjectIcon(subjectName) {
  const name = subjectName.toLowerCase();
  if (name.includes('biol') || name.includes('embri') || name.includes('genét')) return '🧬';
  if (name.includes('fís') || name.includes('elétr') || name.includes('termo')) return '⚡';
  if (name.includes('quím') || name.includes('orgân')) return '🧪';
  if (name.includes('matem') || name.includes('geom') || name.includes('álgeb')) return '📐';
  if (name.includes('histó') || name.includes('brasil')) return '📜';
  if (name.includes('geog') || name.includes('cartog')) return '🌍';
  if (name.includes('port') || name.includes('gram') || name.includes('liter')) return '📖';
  if (name.includes('filo') || name.includes('soci')) return '🧠';
  if (name.includes('ingl') || name.includes('esp')) return '💬';
  return '📚';
}

/**
 * Renderiza o catálogo de aspectos na aba "Simulados Dinâmicos"
 */
export function renderDynamicAspectsCatalog(questionsPool, containerEl) {
  if (!containerEl) return;

  if (!questionsPool || questionsPool.length === 0) {
    containerEl.innerHTML = `
      <div style="text-align:center; padding: 60px 20px; color:var(--color-text-secondary);">
        <div class="spinner" style="margin: 0 auto 16px auto;"></div>
        <p style="font-size:1.1rem; font-weight:600; margin-bottom:6px;">Carregando banco de questões e extraindo tópicos...</p>
        <p style="font-size:13px;">O catálogo será atualizado automaticamente em instantes.</p>
      </div>
    `;
    return;
  }

  const aspects = extractAspectsFromBank(questionsPool);
  const userEloState = getEloState();

  const materiasArr = Object.values(aspects.materias).sort((a, b) => b.count - a.count);
  const compArr = Object.values(aspects.complexidade).sort((a, b) => b.count - a.count);
  const tagsArr = Object.values(aspects.tags).sort((a, b) => b.count - a.count);

  containerEl.innerHTML = `
    <div class="dynamic-catalog-container fade-in">
      <div class="dynamic-catalog-banner">
        <div class="dynamic-banner-content">
          <h2>⚡ Simulados Dinâmicos Adaptativos</h2>
          <p>Escolha um aspecto ou matéria para iniciar um treino focado. O algoritmo seleciona a dificuldade ideal a cada resposta e recalcula seu ELO em tempo real!</p>
        </div>
      </div>

      <!-- Seção Principal / Destaques -->
      <div class="dynamic-section">
        <h3 class="dynamic-section-title">🎯 Modalidades em Destaque</h3>
        <div class="dynamic-aspects-grid">
          <div class="dynamic-aspect-card featured-card js-select-aspect" data-aspect-id="geral">
            <div class="aspect-card-header">
              <span class="aspect-icon">${aspects.geral.icon}</span>
              <span class="aspect-badge">Geral</span>
            </div>
            <h4 class="aspect-title">${aspects.geral.label}</h4>
            <p class="aspect-desc">${aspects.geral.description}</p>
            <div class="aspect-footer">
              <span class="aspect-count">${aspects.geral.count} questões no banco</span>
              <button class="aspect-start-btn">Iniciar →</button>
            </div>
          </div>

          <div class="dynamic-aspect-card featured-card js-select-aspect" data-aspect-id="com_imagem">
            <div class="aspect-card-header">
              <span class="aspect-icon">${aspects.comImagem.icon}</span>
              <span class="aspect-badge image-badge">Visual</span>
            </div>
            <h4 class="aspect-title">${aspects.comImagem.label}</h4>
            <p class="aspect-desc">${aspects.comImagem.description}</p>
            <div class="aspect-footer">
              <span class="aspect-count">${aspects.comImagem.count} questões no banco</span>
              <button class="aspect-start-btn">Iniciar →</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Seção Por Matéria -->
      ${materiasArr.length > 0 ? `
        <div class="dynamic-section">
          <h3 class="dynamic-section-title">📚 Aprimorar por Matéria</h3>
          <div class="dynamic-aspects-grid">
            ${materiasArr.map((m) => {
              const specElo = findAspectElo(userEloState, m);
              return `
                <div class="dynamic-aspect-card js-select-aspect" data-aspect-id="${m.id}">
                  <div class="aspect-card-header">
                    <span class="aspect-icon">${m.icon}</span>
                    <span class="aspect-count-badge">${m.count} q</span>
                  </div>
                  <h4 class="aspect-title">${m.label}</h4>
                  <p class="aspect-desc">${m.description}</p>
                  ${specElo ? `<div class="aspect-elo-hint">🎯 ELO nesta matéria: <strong>${specElo}</strong></div>` : ''}
                  <div class="aspect-footer">
                    <button class="aspect-start-btn">Treinar Matéria →</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Seção Por Aspecto de Complexidade / Habilidades -->
      ${compArr.length > 0 ? `
        <div class="dynamic-section">
          <h3 class="dynamic-section-title">⚙️ Aspectos de Questão & Habilidades</h3>
          <div class="dynamic-aspects-grid">
            ${compArr.map((c) => {
              const specElo = findAspectElo(userEloState, c);
              return `
                <div class="dynamic-aspect-card js-select-aspect" data-aspect-id="${c.id}">
                  <div class="aspect-card-header">
                    <span class="aspect-icon">${c.icon}</span>
                    <span class="aspect-count-badge">${c.count} q</span>
                  </div>
                  <h4 class="aspect-title">${c.label}</h4>
                  <p class="aspect-desc">${c.description}</p>
                  ${specElo ? `<div class="aspect-elo-hint">🎯 ELO nesta habilidade: <strong>${specElo}</strong></div>` : ''}
                  <div class="aspect-footer">
                    <button class="aspect-start-btn">Treinar Habilidade →</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Seção Por Tags e Tópicos Específicos -->
      ${tagsArr.length > 0 ? `
        <div class="dynamic-section">
          <h3 class="dynamic-section-title">🏷️ Tópicos & Palavras-chave (${tagsArr.length} tópicos)</h3>
          <div class="dynamic-aspects-grid">
            ${tagsArr.map((t) => {
              const specElo = findAspectElo(userEloState, t);
              return `
                <div class="dynamic-aspect-card js-select-aspect" data-aspect-id="${t.id}">
                  <div class="aspect-card-header">
                    <span class="aspect-icon">${t.icon}</span>
                    <span class="aspect-count-badge">${t.count} q</span>
                  </div>
                  <h4 class="aspect-title">${t.label}</h4>
                  <p class="aspect-desc">${t.description}</p>
                  ${specElo ? `<div class="aspect-elo-hint">🎯 ELO neste tópico: <strong>${specElo}</strong></div>` : ''}
                  <div class="aspect-footer">
                    <button class="aspect-start-btn">Praticar Tópico →</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Mapeia por ID correto (ex: mat_Geografia, tag_Cartografia, etc.)
  const allAspectMap = {};
  allAspectMap['geral'] = aspects.geral;
  allAspectMap['com_imagem'] = aspects.comImagem;
  Object.values(aspects.materias).forEach((m) => { allAspectMap[m.id] = m; });
  Object.values(aspects.complexidade).forEach((c) => { allAspectMap[c.id] = c; });
  Object.values(aspects.tags).forEach((t) => { allAspectMap[t.id] = t; });

  containerEl.querySelectorAll('.js-select-aspect').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.aspectId;
      const aspectInfo = allAspectMap[id] || aspects.geral;
      showDynamicSetupModal(aspectInfo, questionsPool);
    });
  });
}

/**
 * Exibe a Modal de Configuração (Setup) do Simulado Dinâmico
 */
export function showDynamicSetupModal(aspectInfo, questionsPool) {
  const userEloState = getEloState();
  const currentGlobalElo = userEloState?.user?.theta || 1500;
  const aspectSpecificElo = findAspectElo(userEloState, aspectInfo);

  // Filtra as questões elegíveis para saber quantas existem no contexto
  const filteredPool = questionsPool.filter(aspectInfo.filter || (() => true));
  const maxAvailable = filteredPool.length;

  if (maxAvailable === 0) {
    customAlert(`⚠️ Nenhuma questão encontrada para o aspecto "${aspectInfo.label}".`, 3000);
    return;
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'dynamic-setup-overlay fade-in';
  modalOverlay.id = 'dynamicSetupModal';

  modalOverlay.innerHTML = `
    <div class="dynamic-setup-card">
      <div class="dynamic-setup-header">
        <div class="dynamic-setup-title-group">
          <span class="dynamic-setup-icon">${aspectInfo.icon || '🎯'}</span>
          <div>
            <h3>${aspectInfo.label}</h3>
            <span class="dynamic-setup-subtitle">${maxAvailable} questões disponíveis no banco</span>
          </div>
        </div>
        <button class="dynamic-setup-close" id="btnCloseSetupModal">✕</button>
      </div>

      <div class="dynamic-setup-body">
        <!-- 1. Quantidade de Questões -->
        <div class="setup-group">
          <label class="setup-label">1. Número de Questões do Simulado:</label>
          <div class="setup-btn-grid" id="qCountGrid">
            <button class="setup-opt-btn active" data-value="5">5 Questões</button>
            <button class="setup-opt-btn" data-value="10">10 Questões</button>
            <button class="setup-opt-btn" data-value="15">15 Questões</button>
            <button class="setup-opt-btn" data-value="20">20 Questões</button>
            <button class="setup-opt-btn" data-value="custom">Personalizado</button>
          </div>
          <div class="setup-custom-wrapper" id="customCountWrapper" style="display:none; margin-top:10px;">
            <input type="number" id="customCountInput" class="setup-number-input" min="1" max="${maxAvailable}" value="10" placeholder="Qtd de questões" />
            <span class="setup-input-hint">Máximo de ${maxAvailable} neste aspecto</span>
          </div>
        </div>

        <!-- 2. ELO Inicial da Prova -->
        <div class="setup-group">
          <label class="setup-label">2. ELO Inicial da Prova:</label>
          <div class="setup-radio-group">
            <label class="setup-radio-option">
              <input type="radio" name="eloInitialMode" value="aspect" ${aspectSpecificElo ? 'checked' : ''} />
              <div class="radio-content">
                <strong>🎯 ELO Específico em "${aspectInfo.label}" (${aspectSpecificElo || 1500} ELO)</strong>
                <span>${aspectSpecificElo ? 'Proficiência acumulada nesta matéria/tópico' : 'Sem histórico — inicia no padrão 1500'}</span>
              </div>
            </label>

            <label class="setup-radio-option">
              <input type="radio" name="eloInitialMode" value="user" ${!aspectSpecificElo ? 'checked' : ''} />
              <div class="radio-content">
                <strong>🌐 ELO Global Geral (${currentGlobalElo} ELO)</strong>
                <span>Sua média geral de proficiência em todas as disciplinas</span>
              </div>
            </label>

            <label class="setup-radio-option">
              <input type="radio" name="eloInitialMode" value="default" />
              <div class="radio-content">
                <strong>⚖️ ELO Padrão (1500 ELO)</strong>
                <span>Dificuldade média neutra para novos simulados</span>
              </div>
            </label>

            <label class="setup-radio-option">
              <input type="radio" name="eloInitialMode" value="custom" />
              <div class="radio-content">
                <strong>⚙️ ELO Personalizado</strong>
                <span>Defina um valor numérico de ELO de partida</span>
              </div>
            </label>
          </div>
          <div class="setup-custom-wrapper" id="customEloWrapper" style="display:none; margin-top:10px;">
            <input type="number" id="customEloInput" class="setup-number-input" min="800" max="3000" value="1500" placeholder="Ex: 1750" />
          </div>
        </div>

        <!-- 3. Modo de Resposta -->
        <div class="setup-group">
          <label class="setup-label">3. Modo de Resposta:</label>
          <div class="setup-radio-group horizontal">
            <label class="setup-radio-option">
              <input type="radio" name="responseMode" value="normal" checked />
              <div class="radio-content">
                <strong>Modo Normal</strong>
                <span>Escolha simples (A, B, C, D, E)</span>
              </div>
            </label>
            <label class="setup-radio-option">
              <input type="radio" name="responseMode" value="maia" />
              <div class="radio-content">
                <strong>Método Maia (Certeza)</strong>
                <span>Réguas de certeza % com análise metacognitiva</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="dynamic-setup-footer">
        <button class="setup-cancel-btn" id="btnCancelSetup">Cancelar</button>
        <button class="setup-start-btn" id="btnStartDynamicExam">🚀 Iniciar Simulado Dinâmico</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Behavior for Qty buttons
  let selectedCount = 5;
  const qCountGrid = modalOverlay.querySelector('#qCountGrid');
  const customCountWrapper = modalOverlay.querySelector('#customCountWrapper');
  const customCountInput = modalOverlay.querySelector('#customCountInput');

  qCountGrid.querySelectorAll('.setup-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      qCountGrid.querySelectorAll('.setup-opt-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.value;
      if (val === 'custom') {
        customCountWrapper.style.display = 'block';
        selectedCount = parseInt(customCountInput.value) || 10;
      } else {
        customCountWrapper.style.display = 'none';
        selectedCount = parseInt(val);
      }
    });
  });

  customCountInput.addEventListener('input', () => {
    let val = parseInt(customCountInput.value) || 1;
    if (val > maxAvailable) val = maxAvailable;
    selectedCount = val;
  });

  // Behavior for Elo initial mode
  const customEloWrapper = modalOverlay.querySelector('#customEloWrapper');
  const customEloInput = modalOverlay.querySelector('#customEloInput');
  modalOverlay.querySelectorAll('input[name="eloInitialMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      customEloWrapper.style.display = radio.value === 'custom' ? 'block' : 'none';
    });
  });

  // Close handlers
  const closeModal = () => modalOverlay.remove();
  modalOverlay.querySelector('#btnCloseSetupModal').addEventListener('click', closeModal);
  modalOverlay.querySelector('#btnCancelSetup').addEventListener('click', closeModal);

  // Start exam handler
  modalOverlay.querySelector('#btnStartDynamicExam').addEventListener('click', () => {
    let finalCount = selectedCount;
    const customBtnActive = modalOverlay.querySelector('.setup-opt-btn[data-value="custom"]');
    if (customBtnActive && customBtnActive.classList.contains('active')) {
      finalCount = Math.min(maxAvailable, Math.max(1, parseInt(customCountInput.value) || 10));
    }

    const eloMode = modalOverlay.querySelector('input[name="eloInitialMode"]:checked').value;
    let initialElo = 1500;
    if (eloMode === 'aspect') initialElo = aspectSpecificElo || 1500;
    else if (eloMode === 'user') initialElo = currentGlobalElo || 1500;
    else if (eloMode === 'custom') initialElo = parseInt(customEloInput.value) || 1500;
    initialElo = Number(initialElo) || 1500;

    const respMode = modalOverlay.querySelector('input[name="responseMode"]:checked').value;

    closeModal();
    startDynamicExamSession({
      aspectInfo,
      questionsPool: filteredPool,
      totalQuestions: finalCount,
      initialElo,
      responseMode: respMode,
    });
  });
}

/**
 * Inicia e gerencia a sessão de Simulado Dinâmico Adaptativo
 */
function startDynamicExamSession(config) {
  const { aspectInfo, questionsPool, totalQuestions, initialElo, responseMode } = config;
  const validElo = Number(initialElo) || 1500;

  currentSession = {
    aspectInfo,
    questionsPool,
    totalQuestions,
    responseMode,
    currentElo: validElo,
    initialElo: validElo,
    visitedQuestionIds: new Set(),
    history: [],
    currentQuestionIndex: 0,
    currentQuestion: null,
    isAnswered: false,
    selectedAnswer: null,
    selectedCertainties: {},
  };

  selectNextDynamicQuestion();
  renderDynamicExamLayout();
}

/**
 * Volta ao painel de Simulados Dinâmicos re-inicializando os eventos limpos
 */
async function exitToSimuladosDashboard() {
  currentSession = null;
  await iniciarModoSimulados();
  // Garante que muda para a aba de dinâmicos após restaurar
  const tabBtnDinamicos = document.getElementById('tabBtnDinamicos');
  if (tabBtnDinamicos) tabBtnDinamicos.click();
}

/**
 * Seleciona a próxima questão do pool de forma adaptativa com base no ELO atual da sessão
 */
function selectNextDynamicQuestion() {
  if (!currentSession) return;

  const pool = currentSession.questionsPool.filter(
    (q) => !currentSession.visitedQuestionIds.has(q.id)
  );

  if (pool.length === 0) {
    currentSession.finished = true;
    return;
  }

  const targetElo = Number(currentSession.currentElo) || 1500;

  let bestQuestion = pool[0];
  let minDiff = Math.abs(getNumericElo(pool[0]) - targetElo);

  pool.forEach((q) => {
    const eloQ = getNumericElo(q);
    const diff = Math.abs(eloQ - targetElo);
    if (diff < minDiff) {
      minDiff = diff;
      bestQuestion = q;
    }
  });

  currentSession.visitedQuestionIds.add(bestQuestion.id);
  currentSession.currentQuestion = bestQuestion;
  currentSession.isAnswered = false;
  currentSession.selectedAnswer = null;
  currentSession.selectedCertainties = {};
}

/**
 * Renderiza o layout da tela de execução do Simulado Dinâmico
 * com visual e recursos 100% IDÊNTICOS ao Banco de Questões
 */
function renderDynamicExamLayout() {
  const appContainer = document.body;

  if (!currentSession || !currentSession.currentQuestion) {
    renderDynamicFinalReport();
    return;
  }

  const q = currentSession.currentQuestion;
  const fullData = q.fullData || {};
  const quest = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};
  const qId = q.id;
  const cardId = `q_${qId}`;
  const eloQVal = getNumericElo(q);
  const sessionElo = Number(currentSession.currentElo) || 1500;
  const rankTier = getEloRankTier(sessionElo);
  const rankLabel = rankTier.tier || rankTier.label || rankTier.badge || 'Competidor';

  const progressPct = Math.round(
    ((currentSession.currentQuestionIndex + 1) / currentSession.totalQuestions) * 100
  );

  // Prepara imagens usando o pipeline do Banco de Questões
  const imgData = prepararImagensVisualizacao(fullData);

  // Gera alternativas identicamente ao Banco de Questões
  const htmlAlts = gerarHtmlAlternativas(
    cardId,
    quest,
    g,
    imgData.rawImgsQ || [],
    currentSession.responseMode === 'maia' ? 'graus_confianca' : 'binario'
  );

  const html = `
    <div class="dynamic-exam-page fade-in">
      <header class="dynamic-exam-header">
        <div class="dynamic-header-left">
          <button class="dynamic-exit-btn" id="btnExitDynamicExam" title="Voltar aos Simulados Dinâmicos">
            ← Voltar
          </button>
          <div class="dynamic-exam-title">
            <span class="dynamic-exam-icon">${currentSession.aspectInfo.icon || '🎯'}</span>
            <strong>${currentSession.aspectInfo.label}</strong>
          </div>
        </div>

        <div class="dynamic-header-center">
          <div class="dynamic-progress-info">
            <span>Questão <strong>${currentSession.currentQuestionIndex + 1}</strong> de ${currentSession.totalQuestions}</span>
            <div class="dynamic-progress-bar">
              <div class="dynamic-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
          </div>
        </div>

        <div class="dynamic-header-right">
          <div class="dynamic-elo-badge" title="Seu ELO acumulado nesta sessão">
            <span>ELO Sessão:</span>
            <strong class="elo-val">${sessionElo}</strong>
            <span class="rank-tier" style="color: ${rankTier.color}; font-weight:bold;">${rankLabel}</span>
          </div>
        </div>
      </header>

      <main class="dynamic-exam-main">
        <div class="q-card dynamic-question-card" id="card_${qId}">
          <div class="dynamic-card-top">
            <span class="q-number-badge">Questão ${String(currentSession.currentQuestionIndex + 1).padStart(2, '0')}</span>
            <span class="q-elo-badge" title="Dificuldade/ELO estimado da questão">
              🎯 ELO Questão: <strong>${eloQVal}</strong>
            </span>
          </div>

          <!-- Enunciado renderizado via React hydration (igual ao Banco) -->
          <div class="q-body dynamic-q-body">
            <div class="js-react-q-body" style="min-height: 50px;"></div>
          </div>

          <!-- Alternativas -->
          <div class="dynamic-q-options" id="${cardId}_opts">
            ${htmlAlts}
          </div>

          <!-- Gabarito & Resolução Completa do Banco -->
          <div class="dynamic-q-resolution" id="${cardId}_res" style="display:none;">
            ${renderGabaritoCardSection(q, cardId)}
          </div>
        </div>
      </main>

      <footer class="dynamic-exam-footer">
        <div class="dynamic-footer-info">
          <span id="answerNoticeText">⚠️ Responda a questão acima para revelar a correção e continuar.</span>
        </div>
        <button class="dynamic-next-btn" id="btnNextDynamicQuestion" disabled>
          ${currentSession.currentQuestionIndex + 1 === currentSession.totalQuestions ? 'Finalizar Simulado 🏁' : 'Próxima Questão →'}
        </button>
      </footer>
    </div>
  `;

  appContainer.innerHTML = html;

  // =====================================================================
  // HYDRATA o card via React (renderiza imagens, estrutura, passos)
  // =====================================================================
  const cardEl = document.getElementById(`card_${qId}`);
  if (cardEl) {
    cardEl._fullData = fullData;
    hydrateBankCard(cardEl, {
      q: quest,
      g: g,
      imgsOriginalQ: imgData.rawImgsQ || [],
      jsonImgsG: imgData.jsonImgsG || '[]',
    });
  }

  // Configura ouvintes de eventos da questão
  setupDynamicQuestionEvents(q, cardId);
}

/**
 * Renderiza o cartão de Gabarito & Resolução Completa identicamente ao Banco de Questões
 */
function renderGabaritoCardSection(qObj, cardId) {
  const g = qObj.fullData?.dados_gabarito || {};
  const imgData = prepararImagensVisualizacao(qObj.fullData || {});

  const htmlComplexidade = renderMatrizComplexidade(g);
  const htmlPassos = renderPassosComDetalhes(g);
  const htmlPesquisa = renderRelatorioPesquisa(g);
  const htmlFontes = renderFontesExternas(g);
  const htmlCreditos = renderCreditosCompleto(g, cardId);
  const htmlScan = renderBotaoScanGabarito(imgData.rawImgsG || [], imgData.jsonImgsG || '[]');

  let htmlExplicacaoLegada = '';
  if (typeof g.explicacao === 'string' && g.explicacao.trim()) {
    htmlExplicacaoLegada = `
      <div class="q-res-section">
        <span class="q-res-label">Explicação Comentada</span>
        <div class="gabarito-texto" style="font-size:13px; line-height:1.6; color:var(--color-text-secondary);">
          ${renderizarEstruturaHTML([{ tipo: 'texto', conteudo: g.explicacao }], [], `${cardId}_gab`, true)}
        </div>
      </div>
    `;
  }

  const correta = (g.alternativa_correta || '').trim().toUpperCase();

  return `
    <div class="gabarito-card-box" style="margin-top:24px; padding:24px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:14px;">
      <h3 style="margin:0 0 16px 0; color:var(--color-primary); font-size:1.1rem; display:flex; align-items:center; gap:8px;">
        🔑 Gabarito & Resolução Oficial
      </h3>

      ${correta ? `
        <div style="font-size:15px; margin-bottom:16px;">
          <strong>Alternativa Correta:</strong>
          <span style="background:var(--color-primary); color:#fff; padding:4px 12px; border-radius:6px; font-weight:bold; font-size:16px; margin-left:6px;">${correta}</span>
        </div>
      ` : ''}

      ${htmlPassos}
      ${htmlExplicacaoLegada}
      ${htmlComplexidade}
      ${htmlPesquisa}
      ${htmlFontes}
      ${htmlCreditos}
      ${htmlScan}
    </div>
  `;
}

/**
 * Configura ouvintes de resposta e navegação do Simulado Dinâmico
 */
function setupDynamicQuestionEvents(qObj, cardId) {
  const container = document.getElementById(`${cardId}_opts`);
  const btnNext = document.getElementById('btnNextDynamicQuestion');
  const btnExit = document.getElementById('btnExitDynamicExam');
  const resolutionEl = document.getElementById(`${cardId}_res`);
  const noticeText = document.getElementById('answerNoticeText');

  const gabaritoCorreto = (qObj.fullData?.dados_gabarito?.alternativa_correta || '').trim().toUpperCase();

  if (btnExit) {
    btnExit.addEventListener('click', async () => {
      const confirmExit = await showConfirmModal(
        'Sair do Simulado',
        'Tem certeza que deseja sair? O progresso desta sessão não será salvo.',
        'Sair',
        'Continuar'
      );
      if (confirmExit) {
        exitToSimuladosDashboard();
      }
    });
  }

  if (!container) return;

  const processAnswer = (chosenLetter, certezas) => {
    if (currentSession.isAnswered) return;
    currentSession.isAnswered = true;
    currentSession.selectedAnswer = chosenLetter;

    container.classList.add('answered');

    if (resolutionEl) resolutionEl.style.display = 'block';

    const compObj = extractQuestionComplexityObj(qObj);
    const eloSimul = EloService.simularRespostaElo({
      questaoId: qObj.id,
      opcaoSelecionada: chosenLetter,
      gabaritoCorreto,
      certezas,
      complexidadeObj: compObj,
      fullData: qObj.fullData,
      thetaSession: Number(currentSession.currentElo) || 1500,
    });

    currentSession.currentElo = eloSimul.thetaAfter;
    currentSession.history.push(eloSimul);

    const eloValEl = document.querySelector('.dynamic-elo-badge .elo-val');
    if (eloValEl) eloValEl.textContent = eloSimul.thetaAfter;

    if (btnNext) btnNext.disabled = false;
    if (noticeText) {
      noticeText.innerHTML = `✅ Resposta registrada. ${eloSimul.acertou ? 'Você acertou!' : 'Gabarito revelado abaixo.'}`;
      noticeText.style.color = eloSimul.acertou ? 'var(--color-success)' : 'var(--color-error)';
    }
  };

  // Modo Normal
  container.querySelectorAll('.q-opt-btn, .js-verificar-resp').forEach((optBtn) => {
    optBtn.addEventListener('click', () => {
      if (currentSession.isAnswered) return;
      const chosenLetter = (optBtn.dataset.letra || optBtn.querySelector('.q-opt-letter-badge')?.textContent || '').trim().toUpperCase();

      container.querySelectorAll('.q-opt-btn, .js-verificar-resp').forEach((b) => {
        const l = (b.dataset.letra || b.querySelector('.q-opt-letter-badge')?.textContent || '').trim().toUpperCase();
        if (l === gabaritoCorreto) b.classList.add('correct');
        if (l === chosenLetter && l !== gabaritoCorreto) b.classList.add('wrong');
        b.style.cursor = 'default';
        const motivo = b.dataset.motivo;
        if (motivo) {
          const motivoEl = b.querySelector('.q-opt-motivo');
          if (motivoEl) { motivoEl.textContent = motivo; motivoEl.style.display = 'block'; }
        }
      });

      const certezas = {};
      ['A', 'B', 'C', 'D', 'E'].forEach((l) => { certezas[l] = l === chosenLetter ? 100 : 0; });
      processAnswer(chosenLetter, certezas);
    });
  });

  // Modo Maia
  const btnEnviarConfianca = container.querySelector('.js-enviar-resposta-confianca');
  if (btnEnviarConfianca) {
    let selectedConfiancaLetter = null;

    container.querySelectorAll('.js-selecionar-alt-confianca').forEach((altBtn) => {
      altBtn.addEventListener('click', () => {
        if (currentSession.isAnswered) return;
        selectedConfiancaLetter = (altBtn.dataset.letra || '').trim().toUpperCase();
        container.querySelectorAll('.q-opt-btn-confianca').forEach((b) => b.classList.remove('selected'));
        altBtn.classList.add('selected');
        btnEnviarConfianca.disabled = false;
      });
    });

    btnEnviarConfianca.addEventListener('click', () => {
      if (currentSession.isAnswered || !selectedConfiancaLetter) return;
      btnEnviarConfianca.disabled = true;

      const certezas = {};
      container.querySelectorAll('.js-confianca-slider').forEach((slider) => {
        certezas[slider.dataset.letra] = parseInt(slider.value) || 50;
      });

      container.querySelectorAll('.q-opt-card-confianca').forEach((cardEl) => {
        const l = (cardEl.dataset.letra || '').trim().toUpperCase();
        if (l === gabaritoCorreto) cardEl.classList.add('correct');
        if (l === selectedConfiancaLetter && l !== gabaritoCorreto) cardEl.classList.add('wrong');
        const btn = cardEl.querySelector('.js-selecionar-alt-confianca');
        const motivo = btn?.dataset.motivo;
        if (motivo) {
          const motivoEl = cardEl.querySelector('.q-opt-motivo');
          if (motivoEl) { motivoEl.textContent = motivo; motivoEl.style.display = 'block'; }
        }
      });

      processAnswer(selectedConfiancaLetter, certezas);
    });
  }

  // Clique no botão Próxima Questão
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentSession.currentQuestionIndex++;
      if (currentSession.currentQuestionIndex >= currentSession.totalQuestions) {
        renderDynamicFinalReport();
      } else {
        selectNextDynamicQuestion();
        renderDynamicExamLayout();
      }
    });
  }
}

/**
 * Renderiza o Relatório Final do Simulado Dinâmico
 */
function renderDynamicFinalReport() {
  const appContainer = document.body;
  if (!currentSession) return;

  const total = currentSession.history.length;
  const acertos = currentSession.history.filter((h) => h.acertou).length;
  const pctAcertos = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const initialElo = currentSession.initialElo || 1500;
  const finalElo = currentSession.currentElo || 1500;
  const netDelta = finalElo - initialElo;
  const netDeltaText = netDelta >= 0 ? `+${netDelta}` : `${netDelta}`;

  const html = `
    <div class="dynamic-report-page fade-in">
      <header class="dynamic-report-header">
        <h2>🏁 Simulado Dinâmico Concluído!</h2>
        <p>Você finalizou o treino: <strong>${currentSession.aspectInfo.label}</strong></p>
      </header>

      <div class="dynamic-report-grid">
        <div class="dynamic-stat-card elo-card">
          <div class="stat-title">Resultado ELO da Sessão</div>
          <div class="stat-elo-main">
            <span class="elo-final">${finalElo}</span>
            <span class="elo-delta ${netDelta >= 0 ? 'pos' : 'neg'}">(${netDeltaText})</span>
          </div>
          <p class="stat-desc">ELO Inicial: ${initialElo} ➔ ELO Final: ${finalElo}</p>
        </div>

        <div class="dynamic-stat-card acc-card">
          <div class="stat-title">Taxa de Acertos</div>
          <div class="stat-acc-main">${pctAcertos}%</div>
          <p class="stat-desc">${acertos} acertos de ${total} questões</p>
        </div>
      </div>

      <div class="dynamic-chart-box">
        <h3>📈 Evolução do ELO Questão a Questão</h3>
        <div class="chart-canvas-container">
          <canvas id="eloTrajectoryCanvas" width="700" height="250"></canvas>
        </div>
      </div>

      <div class="dynamic-report-actions">
        <button class="report-action-btn secondary" id="btnExitReport">
          ← Voltar aos Simulados
        </button>
        <button class="report-action-btn primary" id="btnSyncEloProfile">
          💾 Sincronizar ELO no Perfil (${netDeltaText} pts)
        </button>
      </div>
    </div>
  `;

  appContainer.innerHTML = html;
  drawEloTrajectoryChart(initialElo, currentSession.history);

  document.getElementById('btnExitReport').addEventListener('click', () => {
    exitToSimuladosDashboard();
  });

  document.getElementById('btnSyncEloProfile').addEventListener('click', async () => {
    const confirmed = await showConfirmModal(
      'Sincronizar ELO',
      `Deseja aplicar a variação de ELO desta sessão (${netDeltaText} pontos) ao seu perfil?`,
      'Sim, Atualizar Perfil',
      'Não, Descartar',
      true
    );

    if (confirmed) {
      EloService.sincronizarSessaoEloAoPerfil(currentSession.history);
      customAlert(`✅ Perfil atualizado! Seu novo ELO é ${finalElo}.`, 3000);
      setTimeout(() => exitToSimuladosDashboard(), 1500);
    }
  });
}

/**
 * Desenha o gráfico de trajetória do ELO
 */
function drawEloTrajectoryChart(initialElo, history) {
  const canvas = document.getElementById('eloTrajectoryCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const dataPoints = [initialElo, ...history.map((h) => h.thetaAfter)];
  if (dataPoints.length < 2) return;

  const minElo = Math.min(...dataPoints) - 30;
  const maxElo = Math.max(...dataPoints) + 30;
  const padding = 40;

  const getX = (index) => padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);
  const getY = (val) => height - padding - ((val - minElo) / (maxElo - minElo)) * (height - 2 * padding);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = Math.round(minElo + (i / steps) * (maxElo - minElo));
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.fillText(`${val}`, 5, y + 4);
  }

  ctx.beginPath();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';

  dataPoints.forEach((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  dataPoints.forEach((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    const isCorrect = idx > 0 ? history[idx - 1].acertou : true;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = idx === 0 ? '#94a3b8' : isCorrect ? '#22c55e' : '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}
