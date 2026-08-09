/**
 * EloPopupModal.js
 * Modal de alta precisão para exibir o resultado da resposta,
 * as alterações de ELO (Usuário e Questão), diagnóstico metacognitivo
 * e a recalibração individualizada por múltiplos aspectos e fatores da questão.
 */

export function exibirEloPopupModal(resultadoElo, onCloseCallback = null) {
  const { acertou, user, questao, aspectos = [], meta, diagnostico } = resultadoElo;

  // Remove popup anterior se existir
  const existing = document.getElementById('elo-popup-modal-overlay');
  if (existing) {
    existing.remove();
  }

  // Definição de Cores & Estética Profissional (Dark Glassmorphic sem emojis)
  const isGreen = acertou;
  const themeColor = isGreen ? '#10b981' : '#ef4444';
  const themeBg = isGreen ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
  const themeBorder = isGreen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  const statusBadgeBg = isGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const statusBadgeText = isGreen ? '#34d399' : '#f87171';

  const titleText = isGreen ? 'Resposta Correta' : 'Resposta Incorreta';
  const subtitleText = isGreen
    ? 'Proficiência atualizada e aspectos da questão recalibrados.'
    : 'Diagnóstico técnico gerado para orientar sua revisão.';

  // Formatação dos deltas ELO
  const userDeltaStr = user.deltaTheta >= 0 ? `+${user.deltaTheta}` : `${user.deltaTheta}`;
  const questaoDeltaStr = questao.deltaB >= 0 ? `+${questao.deltaB}` : `${questao.deltaB}`;

  // Limpa emojis do título do diagnóstico se houver
  const rawDiagTitulo = diagnostico?.titulo || (isGreen ? 'Acerto Registrado' : 'Análise de Erro');
  const diagTitulo = rawDiagTitulo
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .trim();
  const diagHtml =
    diagnostico?.orientacaoHtml || '<p>Continue praticando para consolidar seus resultados.</p>';

  // Agrupamento dos Aspectos por Categoria
  const categoriasMap = {};
  (aspectos || []).forEach((asp) => {
    const catName = asp.categoriaLabel || 'Outros Aspectos';
    if (!categoriasMap[catName]) {
      categoriasMap[catName] = [];
    }
    categoriasMap[catName].push(asp);
  });

  // Renderiza HTML da Aba 2 (Aspectos e Fatores)
  const renderAspectosHTML = () => {
    if (!aspectos || aspectos.length === 0) {
      return `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary, #94a3b8);">
          Nenhum aspecto específico mapeado para esta questão.
        </div>
      `;
    }

    return Object.entries(categoriasMap)
      .map(([catTitle, lista]) => {
        const cardsHtml = lista
          .map((asp, idx) => {
            const deltaStr = asp.deltaTheta >= 0 ? `+${asp.deltaTheta}` : `${asp.deltaTheta}`;
            const isPos = asp.deltaTheta >= 0;
            const deltaBg = isPos ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
            const deltaColor = isPos ? '#34d399' : '#f87171';

            return `
              <div class="elo-aspect-card" style="
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
                border-radius: 12px;
                padding: 14px 16px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 8px;
                transition: transform 0.2s ease, border-color 0.2s ease;
              ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <span style="font-weight: 600; font-size: 0.92rem; color: var(--color-text-primary, #f8fafc); line-height: 1.3;">
                    ${asp.label}
                  </span>
                  <span style="
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: ${deltaColor};
                    background: ${deltaBg};
                    padding: 3px 8px;
                    border-radius: 6px;
                    white-space: nowrap;
                  ">
                    ${deltaStr}
                  </span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.8rem; color: var(--color-text-secondary, #94a3b8); margin-top: 4px;">
                  <div>
                    <span>ELO: </span>
                    <strong style="color: #ffffff;" id="elo-counter-aspect-${idx}">
                      ${asp.thetaOld}
                    </strong>
                    <span style="opacity: 0.7;"> ➔ ${asp.thetaNew}</span>
                  </div>
                  <span style="font-size: 0.75rem; opacity: 0.7;">
                    ${asp.total_respostas} ${asp.total_respostas === 1 ? 'questão' : 'questões'}
                  </span>
                </div>
              </div>
            `;
          })
          .join('');

        return `
          <div style="margin-bottom: 22px;">
            <div style="
              font-size: 0.82rem;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              color: var(--color-primary, #60a5fa);
              margin-bottom: 10px;
              padding-bottom: 4px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            ">
              ${catTitle}
            </div>
            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
              gap: 12px;
            ">
              ${cardsHtml}
            </div>
          </div>
        `;
      })
      .join('');
  };

  // Renderiza resumo compacto dos aspectos na Aba 1
  const renderAspectosResumoHTML = () => {
    if (!aspectos || aspectos.length === 0) return '';

    const itemsHtml = aspectos
      .slice(0, 6)
      .map((asp) => {
        const deltaStr = asp.deltaTheta >= 0 ? `+${asp.deltaTheta}` : `${asp.deltaTheta}`;
        const isPos = asp.deltaTheta >= 0;
        return `
          <div style="
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            font-size: 0.82rem;
          ">
            <span style="color: var(--color-text-primary, #f1f5f9); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${asp.label}
            </span>
            <span style="
              font-weight: 700;
              font-size: 0.78rem;
              color: ${isPos ? '#34d399' : '#f87171'};
              background: ${isPos ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'};
              padding: 2px 6px;
              border-radius: 6px;
            ">
              ${deltaStr}
            </span>
          </div>
        `;
      })
      .join('');

    return `
      <div style="
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
        border-radius: 14px;
        padding: 14px 16px;
        margin-bottom: 18px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-secondary, #94a3b8);">
            Impacto nos Aspectos da Questão (${aspectos.length})
          </span>
          <button id="btn-switch-to-aspects-tab" style="
            background: transparent;
            border: none;
            color: var(--color-primary, #60a5fa);
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            padding: 0;
          ">
            Ver Todos →
          </button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
          ${itemsHtml}
        </div>
      </div>
    `;
  };

  const modalHtml = `
    <div id="elo-popup-modal-overlay" class="elo-popup-overlay" style="
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(8, 12, 22, 0.85);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: eloFadeIn 0.25s ease-out;
    ">
      <style>
        @keyframes eloFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes eloPopScale {
          from { transform: scale(0.92) translateY(15px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .elo-popup-content * {
          box-sizing: border-box;
        }
        .elo-card-stat {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border, rgba(255,255,255,0.08));
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
        }
        .elo-tab-btn {
          background: transparent;
          border: none;
          color: var(--color-text-secondary, #94a3b8);
          font-weight: 600;
          font-size: 0.9rem;
          padding: 12px 20px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .elo-tab-btn:hover {
          color: var(--color-text-primary, #ffffff);
        }
        .elo-tab-btn.active {
          color: ${themeColor};
          border-bottom-color: ${themeColor};
          font-weight: 700;
        }
        .elo-btn-continue {
          width: 100%;
          padding: 14px 24px;
          background: ${themeColor};
          color: #ffffff;
          font-weight: 700;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: filter 0.2s ease, transform 0.1s ease;
          box-shadow: 0 4px 20px ${themeColor}35;
        }
        .elo-btn-continue:hover {
          filter: brightness(1.1);
        }
        .elo-btn-continue:active {
          transform: translateY(1px);
        }
        .diag-text p {
          margin: 0 0 10px 0;
          line-height: 1.6;
          font-size: 0.88rem;
          color: var(--color-text-secondary, #cbd5e1);
        }
        .diag-text p:last-child {
          margin-bottom: 0;
        }
        .diag-text strong {
          color: var(--color-text-primary, #ffffff);
        }
        .elo-aspect-card:hover {
          border-color: rgba(255, 255, 255, 0.18) !important;
        }
      </style>

      <div class="elo-popup-content" style="
        background: var(--color-bg-1, #0f172a);
        border: 1px solid ${themeBorder};
        border-radius: 20px;
        width: 100%;
        max-width: 900px;
        max-height: 92vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 40px ${themeColor}20;
        overflow: hidden;
        animation: eloPopScale 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      ">

        <!-- Top Header Banner -->
        <div style="
          background: ${themeBg};
          border-bottom: 1px solid ${themeBorder};
          padding: 20px 28px 16px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        ">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="
                background: ${statusBadgeBg};
                color: ${statusBadgeText};
                font-size: 0.75rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 1px;
                padding: 4px 10px;
                border-radius: 6px;
                border: 1px solid ${themeColor}30;
              ">
                ${statusBadgeText === '#34d399' ? 'SUCESSO' : 'REVISÃO'}
              </span>
              <h2 style="
                margin: 0;
                color: var(--color-text-primary, #ffffff);
                font-size: 1.35rem;
                font-weight: 700;
                letter-spacing: -0.3px;
              ">${titleText}</h2>
            </div>
            <p style="
              margin: 4px 0 0 0;
              color: var(--color-text-secondary, #94a3b8);
              font-size: 0.85rem;
              font-weight: 400;
            ">${subtitleText}</p>
          </div>

          <button id="elo-popup-close-icon" style="
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #94a3b8;
            border-radius: 8px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1.1rem;
            transition: all 0.2s ease;
          ">
            ✕
          </button>
        </div>

        <!-- Navigation Tabs Bar -->
        <div style="
          display: flex;
          background: rgba(0, 0, 0, 0.25);
          border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
          padding: 0 28px;
          flex-shrink: 0;
        ">
          <button id="tab-btn-visao-geral" class="elo-tab-btn active">
            Visão Geral & Diagnóstico
          </button>
          <button id="tab-btn-aspectos" class="elo-tab-btn">
            Elo por Aspectos & Fatores (${aspectos.length})
          </button>
        </div>

        <!-- Scrollable Content Area -->
        <div style="padding: 24px 28px; overflow-y: auto; flex: 1;">

          <!-- TAB 1: VISÃO GERAL -->
          <div id="tab-panel-visao-geral" class="elo-tab-panel">

            <!-- ELO Cards (Usuário & Questão) -->
            <div style="display: flex; gap: 14px; margin-bottom: 20px;">
              
              <!-- ELO do Usuário -->
              <div class="elo-card-stat">
                <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: var(--color-text-secondary, #94a3b8); margin-bottom: 4px;">
                  Elo Proficiência Geral
                </span>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span id="elo-counter-user" style="font-size: 1.85rem; font-weight: 800; color: var(--color-text-primary, #ffffff);">
                    ${user.thetaOld}
                  </span>
                  <span style="
                    font-size: 0.9rem;
                    font-weight: 800;
                    color: ${user.deltaTheta >= 0 ? '#34d399' : '#f87171'};
                    background: ${user.deltaTheta >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
                    padding: 3px 8px;
                    border-radius: 6px;
                  ">
                    ${userDeltaStr}
                  </span>
                </div>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary, #64748b); margin-top: 2px;">
                  ${user.thetaOld} ➔ ${user.thetaNew}
                </span>
              </div>

              <!-- ELO da Questão -->
              <div class="elo-card-stat">
                <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: var(--color-text-secondary, #94a3b8); margin-bottom: 4px;">
                  Elo Dificuldade Questão
                </span>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span id="elo-counter-questao" style="font-size: 1.85rem; font-weight: 800; color: var(--color-text-primary, #ffffff);">
                    ${questao.bOld}
                  </span>
                  <span style="
                    font-size: 0.9rem;
                    font-weight: 800;
                    color: ${questao.deltaB >= 0 ? '#fb923c' : '#60a5fa'};
                    background: ${questao.deltaB >= 0 ? 'rgba(251, 146, 60, 0.15)' : 'rgba(96, 165, 250, 0.15)'};
                    padding: 3px 8px;
                    border-radius: 6px;
                  ">
                    ${questaoDeltaStr}
                  </span>
                </div>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary, #64748b); margin-top: 2px;">
                  N=${questao.N} respostas registradas
                </span>
              </div>

            </div>

            <!-- Métricas Metacognitivas Grid -->
            <div style="
              background: rgba(0,0,0,0.2);
              border: 1px solid var(--color-border, rgba(255,255,255,0.08));
              border-radius: 14px;
              padding: 12px 16px;
              margin-bottom: 20px;
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              text-align: center;
            ">
              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Brier Score</div>
                <strong style="font-size: 1.1rem; color: ${meta.sBrier >= 0.7 ? '#34d399' : '#fb923c'};">${Math.round(meta.sBrier * 100)}%</strong>
              </div>

              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Ilusão Conhec.</div>
                <strong style="font-size: 1.1rem; color: ${meta.iIlusao > 0.3 ? '#f87171' : '#34d399'};">${Math.round(meta.iIlusao * 100)}%</strong>
              </div>

              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Coerência</div>
                <strong style="font-size: 1.1rem; color: #38bdf8;">${Math.round(meta.bCoerencia * 100)}%</strong>
              </div>

              <div>
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Taxa Eliminação</div>
                <strong style="font-size: 1.1rem; color: #c084fc;">${Math.round(meta.eRate * 100)}%</strong>
              </div>
            </div>

            <!-- Resumo Rápido dos Aspectos Impactados -->
            ${renderAspectosResumoHTML()}

            <!-- Diagnóstico Pedagógico Aprofundado -->
            <div style="
              background: rgba(255,255,255,0.03);
              border: 1px solid ${themeBorder};
              border-radius: 14px;
              padding: 18px 20px;
              margin-bottom: 24px;
            ">
              <div style="
                font-weight: 700;
                font-size: 1rem;
                color: var(--color-text-primary, #ffffff);
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
              ">
                ${diagTitulo}
              </div>

              <div class="diag-text">
                ${diagHtml}
              </div>
            </div>

          </div>

          <!-- TAB 2: ELO POR ASPECTOS & FATORES -->
          <div id="tab-panel-aspectos" class="elo-tab-panel" style="display: none;">
            ${renderAspectosHTML()}
          </div>

          <!-- Botão de Ação CONTINUAR -->
          <button id="elo-popup-continue-btn" class="elo-btn-continue" style="margin-top: 10px;">
            Continuar
          </button>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById('elo-popup-modal-overlay');
  const btnContinue = document.getElementById('elo-popup-continue-btn');
  const btnCloseIcon = document.getElementById('elo-popup-close-icon');

  const tabBtnVisaoGeral = document.getElementById('tab-btn-visao-geral');
  const tabBtnAspectos = document.getElementById('tab-btn-aspectos');
  const panelVisaoGeral = document.getElementById('tab-panel-visao-geral');
  const panelAspectos = document.getElementById('tab-panel-aspectos');
  const btnSwitchToAspects = document.getElementById('btn-switch-to-aspects-tab');

  // Controle de Abas
  function ativarAba(aba) {
    if (aba === 'visao-geral') {
      tabBtnVisaoGeral.classList.add('active');
      tabBtnAspectos.classList.remove('active');
      panelVisaoGeral.style.display = 'block';
      panelAspectos.style.display = 'none';
    } else {
      tabBtnAspectos.classList.add('active');
      tabBtnVisaoGeral.classList.remove('active');
      panelAspectos.style.display = 'block';
      panelVisaoGeral.style.display = 'none';
    }
  }

  if (tabBtnVisaoGeral) tabBtnVisaoGeral.addEventListener('click', () => ativarAba('visao-geral'));
  if (tabBtnAspectos) tabBtnAspectos.addEventListener('click', () => ativarAba('aspectos'));
  if (btnSwitchToAspects) btnSwitchToAspects.addEventListener('click', () => ativarAba('aspectos'));

  // Animação de contadores numéricos
  animateCounter('elo-counter-user', user.thetaOld, user.thetaNew, 700);
  animateCounter('elo-counter-questao', questao.bOld, questao.bNew, 700);

  (aspectos || []).forEach((asp, idx) => {
    animateCounter(`elo-counter-aspect-${idx}`, asp.thetaOld, asp.thetaNew, 700);
  });

  let modalClosed = false;
  function fecharModal() {
    if (!overlay || modalClosed) return;
    modalClosed = true;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      overlay.remove();
      if (typeof onCloseCallback === 'function') {
        onCloseCallback();
      }
    }, 200);
  }

  if (btnContinue) {
    btnContinue.focus();
    btnContinue.addEventListener('click', fecharModal);
  }
  if (btnCloseIcon) {
    btnCloseIcon.addEventListener('click', fecharModal);
  }

  // Suporte a atalhos de teclado (Enter / Espaço / Esc)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      document.removeEventListener('keydown', handleKeyDown);
      fecharModal();
    }
  };
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Animação simples de número incrementando/decrementando
 */
function animateCounter(elementId, start, end, duration) {
  const el = document.getElementById(elementId);
  if (!el || start === end) return;

  const range = end - start;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
    const currentVal = Math.round(start + range * easeProgress);

    el.textContent = currentVal;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = end;
    }
  }

  requestAnimationFrame(step);
}

export default exibirEloPopupModal;
