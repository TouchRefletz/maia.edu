import { exibirModalOriginais } from '../render/final/OriginaisModal.tsx';
import { showConfirmModal } from '../ui/modal-confirm.js';
import { EloService } from '../services/elo-service.js';
import { exibirEloPopupModal } from '../ui/EloPopupModal.js';
import { triggerRankTransitionIfAny } from '../ui/rank-animation.js';

export function toggleGabarito(cardId) {
  const el = document.getElementById(cardId + '_res');
  if (!el) return;

  // Alterna entre mostrar e esconder
  if (el.style.display === 'none') {
    el.style.display = 'block';
    // Opcional: faz scroll suave até a resolução
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    el.style.display = 'none';
  }
}

export async function toggleKeywordsDissertativa(btn, cardId) {
  const keywordsContainer = document.getElementById(cardId + '_keywords');
  if (!keywordsContainer) return;

  if (keywordsContainer.style.display === 'none') {
    const message =
      'Estas palavras-chave compõem a "resposta esperada" da questão. Recomendamos tentar responder à questão antes de visualizá-las para testar seu conhecimento. Deseja mostrar assim mesmo?';

    // Utilize the site's native custom modal
    const confirmed = await showConfirmModal(
      'Atenção',
      message,
      'Mostrar Palavras-Chave',
      'Cancelar',
      false, // false = negative/warning action (usually red button style)
    );

    if (confirmed) {
      keywordsContainer.style.display = 'flex';
      btn.style.display = 'none';
    }
  }
}

export function verificarRespostaBanco(btn, cardId, letraEscolhida, letraCorreta) {
  const container = document.getElementById(cardId + '_opts');
  const resolution = document.getElementById(cardId + '_res');

  if (!container || container.classList.contains('answered')) return;
  container.classList.add('answered');

  const todosBotoes = container.querySelectorAll('.q-opt-btn');
  letraCorreta = (letraCorreta || '').trim().toUpperCase();
  letraEscolhida = (letraEscolhida || '').trim().toUpperCase();

  todosBotoes.forEach((b) => {
    const letra = (
      b.dataset.letra ||
      b.querySelector('.q-opt-letter-badge, .q-opt-letter')?.innerText.replace(')', '') ||
      ''
    )
      .trim()
      .toUpperCase();

    if (letra === letraCorreta) {
      b.classList.add('correct');
    }
    if (letra === letraEscolhida && letra !== letraCorreta) {
      b.classList.add('wrong');
    }
    b.style.cursor = 'default';

    // Exibe justificativa individual (motivo) se existir
    const motivo = b.dataset.motivo;
    if (motivo) {
      const motivoEl = b.querySelector('.q-opt-motivo');
      if (motivoEl) {
        motivoEl.textContent = motivo;
        motivoEl.style.display = 'block';
      }
    }
  });

  // Em modo binário, 100% na opção escolhida
  const certezas = {};
  ['A', 'B', 'C', 'D', 'E'].forEach((l) => {
    certezas[l] = l === letraEscolhida ? 100 : 0;
  });

  const qKey = cardId.replace(/^q_/, '');
  const cardEl = container.closest('.q-card') || document.getElementById(`card_${qKey}`);
  const fullData = cardEl?._fullData;
  const complexidadeObj = fullData?.dados_gabarito?.analise_complexidade;

  const resultadoElo = EloService.processarResposta({
    questaoId: qKey,
    opcaoSelecionada: letraEscolhida,
    gabaritoCorreto: letraCorreta,
    certezas,
    complexidadeObj,
    fullData,
  });

  const eloCell = document.getElementById(`${cardId}_elo_efetivo_val`);
  if (eloCell) {
    eloCell.innerHTML = `<strong style="color: var(--color-primary, #3b82f6);">${resultadoElo.questao.bNew}</strong> <span style="font-size: 0.75rem; opacity: 0.75;">(N=${resultadoElo.questao.N} respostas)</span>`;
  }

  setTimeout(() => {
    exibirEloPopupModal(resultadoElo, () => {
      triggerRankTransitionIfAny(resultadoElo);
    });
  }, 100);

  // Delay e Revelação
  setTimeout(() => {
    if (resolution) {
      resolution.style.display = 'block';
      resolution.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 800);
}

import { renderLatexIn } from '../libs/loader.tsx';
import { gerarHtmlAlternativas } from './card-template.js';

export function selecionarAlternativaConfianca(btn, cardId, letra) {
  const container = document.getElementById(cardId + '_opts');
  if (!container || container.classList.contains('answered')) return;

  const allCards = container.querySelectorAll('.q-opt-card-confianca');
  allCards.forEach((cardEl) => {
    const l = cardEl.dataset.letra;
    const isThis = l === letra;
    cardEl.classList.toggle('selected', isThis);

    const labelEl = cardEl.querySelector('.q-slider-label');
    if (labelEl) {
      if (isThis) {
        labelEl.textContent = `Grau de certeza de que ${l} é CORRETA:`;
      } else {
        labelEl.textContent = `Certeza de que ${l} é FALSA:`;
      }
    }
  });

  container.dataset.opcaoSelecionada = letra;

  const submitBtn = container.querySelector('.js-enviar-resposta-confianca');
  if (submitBtn) {
    submitBtn.disabled = false;
    const btnText = submitBtn.querySelector('.js-btn-enviar-text');
    const btnBadge = submitBtn.querySelector('.js-btn-enviar-badge');
    if (btnText) btnText.textContent = 'Confirmar e Enviar Resposta';
    if (btnBadge) {
      btnBadge.textContent = `Alternativa ${letra}`;
      btnBadge.style.display = 'inline-flex';
    }
  }
}

export function atualizarSliderConfianca(slider) {
  const { cardId, letra } = slider.dataset;
  const val = slider.value;

  const badge = document.getElementById(`${cardId}_val_${letra}`);
  if (badge) {
    badge.textContent = `${val}%`;
  }

  slider.style.background = `linear-gradient(to right, var(--color-primary) ${val}%, var(--color-border) ${val}%)`;
}

export function submeterRespostaConfianca(btn, cardId, letraCorreta) {
  const container = document.getElementById(cardId + '_opts');
  const resolution = document.getElementById(cardId + '_res');

  if (!container || container.classList.contains('answered')) return;

  const selectedCard = container.querySelector('.q-opt-card-confianca.selected');
  if (!selectedCard) {
    customAlert(
      'Por favor, selecione qual alternativa você acredita que está correta antes de enviar a resposta.',
    );
    return;
  }

  const letraEscolhida = selectedCard.dataset.letra.trim().toUpperCase();
  letraCorreta = letraCorreta.trim().toUpperCase();

  // Coleta dados dos sliders (graus de certeza de 0 a 100)
  const certezas = {};
  const sliders = container.querySelectorAll('.js-confianca-slider');
  sliders.forEach((s) => {
    const l = s.dataset.letra;
    certezas[l] = parseInt(s.value, 10);
    s.disabled = true;
  });

  const respostaData = {
    cardId,
    modo: 'graus_confianca',
    opcaoSelecionada: letraEscolhida,
    gabaritoCorreto: letraCorreta,
    certezas,
    acertou: letraEscolhida === letraCorreta,
    timestamp: Date.now(),
  };

  if (typeof window !== 'undefined') {
    window.bancoState = window.bancoState || {};
    window.bancoState.respostasGraus = window.bancoState.respostasGraus || {};
    window.bancoState.respostasGraus[cardId] = respostaData;
  }
  container.dataset.respostaJson = JSON.stringify(respostaData);
  container.classList.add('answered');

  const optCards = container.querySelectorAll('.q-opt-card-confianca');
  optCards.forEach((c) => {
    const letra = c.dataset.letra;
    const btnOpt = c.querySelector('.q-opt-btn-confianca');

    if (letra === letraCorreta) {
      c.classList.add('correct');
    }
    if (letra === letraEscolhida && letra !== letraCorreta) {
      c.classList.add('wrong');
    }

    if (btnOpt) {
      const motivo = btnOpt.dataset.motivo;
      if (motivo) {
        const motivoEl = c.querySelector('.q-opt-motivo');
        if (motivoEl) {
          motivoEl.textContent = motivo;
          motivoEl.style.display = 'block';
        }
      }
    }
  });

  const qKey = cardId.replace(/^q_/, '');
  const cardEl = container.closest('.q-card') || document.getElementById(`card_${qKey}`);
  const fullData = cardEl?._fullData;
  const complexidadeObj = fullData?.dados_gabarito?.analise_complexidade;

  const resultadoElo = EloService.processarResposta({
    questaoId: qKey,
    opcaoSelecionada: letraEscolhida,
    gabaritoCorreto: letraCorreta,
    certezas,
    complexidadeObj,
    fullData,
  });

  respostaData.elo = resultadoElo;

  const eloCell = document.getElementById(`${cardId}_elo_efetivo_val`);
  if (eloCell) {
    eloCell.innerHTML = `<strong style="color: var(--color-primary, #3b82f6);">${resultadoElo.questao.bNew}</strong> <span style="font-size: 0.75rem; opacity: 0.75;">(N=${resultadoElo.questao.N} respostas)</span>`;
  }

  console.log('[BancoQuestões] Resposta final por Graus de Certeza submetida:', respostaData);

  setTimeout(() => {
    exibirEloPopupModal(resultadoElo, () => {
      triggerRankTransitionIfAny(resultadoElo);
    });
  }, 100);

  setTimeout(() => {
    if (resolution) {
      resolution.style.display = 'block';
      resolution.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 800);
}

export function atualizarModoTodasQuestoes(modoParam) {
  const novoModo =
    modoParam ||
    (typeof window !== 'undefined' && localStorage.getItem('banco_modo_resposta')) ||
    'graus_confianca';

  if (typeof window !== 'undefined') {
    if (window.bancoState) window.bancoState.modoResposta = novoModo;
    localStorage.setItem('banco_modo_resposta', novoModo);
  }

  const btnsConfianca = document.querySelectorAll('.js-set-modo-confianca');
  const btnsBinario = document.querySelectorAll('.js-set-modo-binario');
  btnsConfianca.forEach((b) => b.classList.toggle('active', novoModo === 'graus_confianca'));
  btnsBinario.forEach((b) => b.classList.toggle('active', novoModo === 'binario'));

  const cards = document.querySelectorAll('.q-card');
  cards.forEach((cardEl) => {
    const domId = cardEl.id.replace('card_', '');
    const cacheList = window.bancoState?.todasQuestoesCache || [];
    const itemData =
      cardEl._fullData ||
      cacheList.find((x) => x.domId === domId || x.key === domId || x.id === domId);

    if (itemData) {
      cardEl._fullData = itemData;
      const cardId = `q_${itemData.domId || itemData.key || domId}`;
      const optsContainer =
        cardEl.querySelector('.q-options') || document.getElementById(`${cardId}_opts`);

      if (optsContainer && !optsContainer.classList.contains('answered')) {
        const q = itemData.dados_questao || {};
        const g = itemData.dados_gabarito || {};
        const imgsOriginalQ = itemData.imgsOriginalQ || [];
        optsContainer.innerHTML = gerarHtmlAlternativas(cardId, q, g, imgsOriginalQ, novoModo);
        if (typeof renderLatexIn === 'function') {
          renderLatexIn(optsContainer);
        }
      }
    }
  });

  console.log(`[Banco] Modo de resposta trocado para: ${novoModo}`);
}

// Abrir Scan Original
// Abrir Scan Original (Refatorado para usar o novo Modal React com suporte a PDF Embed)
export function abrirScanOriginal(btn) {
  const jsonImgs = btn.dataset.imgs;
  if (!jsonImgs) return;

  try {
    const imgs = JSON.parse(jsonImgs);
    console.log('[Interacoes] Abrindo modal de originais com dados:', imgs);

    exibirModalOriginais(imgs);
  } catch (e) {
    console.error('Erro ao abrir imagens originais', e);
  }
}

import { bancoState } from '../main.js';
// Correção Dissertativa no Banco
import { checkAnswerWithAI, checkAnswerWithEmbeddings } from '../services/answer-checker.js';

function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

export async function avaliarRespostaDissertativa(btn, cardId, tipoCorrecao) {
  const container = document.getElementById(cardId + '_opts');
  const feedbackDiv = document.getElementById(cardId + '_feedback');
  const textarea = container.querySelector('.q-dissert-input');

  if (!textarea || !textarea.value.trim()) {
    alert('Por favor, escreva ou rascunhe sua resposta no campo antes de realizar a correção.');
    return;
  }

  const idFirebase = cardId.replace('q_', '').replace('card_', '');
  const fullData = bancoState.todasQuestoesCache.find((x) => x.key === idFirebase);

  if (!fullData) {
    alert('Não foi possível encontrar os dados originais da questão no cache.');
    return;
  }

  const userAnswer = textarea.value.trim();
  const apiKey = getApiKey();

  const g = fullData.dados_gabarito || {};
  const expectedAnswer = g.resposta_modelo || g.respostaModelo || '';

  // Desabilitar botões enquanto analisa
  const btns = container.querySelectorAll('.q-opt-btn');
  btns.forEach((b) => {
    b.disabled = true;
    b.style.opacity = '0.5';
    b.style.cursor = 'not-allowed';
  });

  feedbackDiv.style.display = 'block';
  feedbackDiv.innerHTML = `
    <div style="text-align:center; padding: 20px;">
        <div class="spinner" style="margin: 0 auto;"></div>
        <p style="margin-top:15px; color:var(--color-primary); font-weight:bold;">
           ${tipoCorrecao === 'ai' ? 'Analisando via Google Gemini AI...' : 'Extraindo similaridade e vetores via Embeddings Pinecone...'}
        </p>
    </div>`;

  try {
    let resultHTML = '';

    if (tipoCorrecao === 'ai') {
      const result = await checkAnswerWithAI(userAnswer, fullData, apiKey);

      if (result.method === 'error') {
        resultHTML = `<div style="color:var(--color-danger); padding:10px;"><b>Erro:</b> ${result.feedback_geral}</div>`;
      } else {
        const criteriosHTML =
          result.criterios_avaliados && result.criterios_avaliados.length > 0
            ? `<div style="margin-top:15px; background:var(--color-bg-2); border:1px solid var(--color-border); border-radius:8px; overflow:hidden;">
                   <div style="background:rgba(0,0,0,0.03); padding:10px 15px; border-bottom:1px solid var(--color-border); font-weight:600; font-size:13px;">📋 Critérios Avaliados</div>
                   <div style="display:flex; flex-direction:column;">
                     ${result.criterios_avaliados
                       .map(
                         (crit, idx) => `
                       <div style="padding:12px 15px; border-bottom:${idx < result.criterios_avaliados.length - 1 ? '1px solid var(--color-border)' : 'none'}; display:flex; gap:12px; align-items:flex-start;">
                         <div style="font-size:16px;">${crit.atendido ? '✅' : '❌'}</div>
                         <div>
                           <div style="font-weight:600; font-size:13px; color:var(--color-text); margin-bottom:4px;">${crit.criterio}</div>
                           <div style="font-size:12px; color:var(--color-text-secondary);">${crit.feedback}</div>
                         </div>
                       </div>
                     `,
                       )
                       .join('')}
                   </div>
                 </div>`
            : '';

        resultHTML = `
                <div style="font-family: inherit; margin-bottom: 10px;">
                    <h3 style="margin-top:0; color:var(--color-primary); display:flex; align-items:center; gap:8px;">
                      🤖 Correção via IA (Gemini)
                      <span style="margin-left:auto; padding:4px 10px; background:var(--color-primary); color:white; border-radius:6px; font-size:15px;">Nota Sugerida: ${result.score}/100</span>
                    </h3>
                    <p style="font-size: 0.95rem;"><b>Feedback do Tutor IA:</b> ${result.feedback_geral}</p>
                    
                    ${criteriosHTML}

                    <div style="display:flex; gap:10px; margin-top:15px; flex-wrap: wrap;">
                      <div style="flex:1; min-width: 250px; background:rgba(40,167,69,0.08); padding:15px; border-radius:6px; border-left:4px solid var(--color-success);">
                        <b style="color:var(--color-success)">🟢 Pontos Fortes e Cobertos:</b>
                        <ul style="margin:8px 0 0 20px; padding:0; font-size:0.9em; display:flex; flex-direction:column; gap:6px;">
                          ${result.pontos_fortes.map((p) => `<li>${p}</li>`).join('')}
                        </ul>
                      </div>
                      <div style="flex:1; min-width: 250px; background:rgba(220,53,69,0.08); padding:15px; border-radius:6px; border-left:4px solid var(--color-danger);">
                        <b style="color:var(--color-danger)">🔴 Elementos a Melhorar / Sugestões:</b>
                        <ul style="margin:8px 0 0 20px; padding:0; font-size:0.9em; display:flex; flex-direction:column; gap:6px;">
                          ${result.pontos_fracos.map((p) => `<li>${p}</li>`).join('')}
                          ${result.sugestoes.map((s) => `<li><i style="opacity:0.8">Sugestão:</i> ${s}</li>`).join('')}
                        </ul>
                      </div>
                    </div>
                </div>
            `;
      }
    } else {
      const result = await checkAnswerWithEmbeddings(userAnswer, expectedAnswer, fullData, apiKey);

      if (result.method === 'error') {
        resultHTML = `<div style="color:var(--color-danger); padding:10px;"><b>Erro:</b> ${result.feedback}</div>`;
      } else {
        resultHTML = `
                <div style="font-family: inherit; margin-bottom: 10px;">
                    <h3 style="margin-top:0; color:var(--color-text); display:flex; align-items:center; gap:8px;">
                      🔑 Simetria Semântica (Embeddings)
                      <span style="margin-left:auto; padding:4px 10px; background:var(--color-bg-1); border: 1px solid var(--color-border); color:var(--color-text); border-radius:6px; font-size:15px;">Adêrencia: ${(result.similarity * 100).toFixed(1)}%</span>
                    </h3>
                    <p style="font-size: 0.95rem;"><b>Resumo de Similaridade:</b> ${result.feedback}</p>
                    <div style="display:flex; gap:10px; margin-top:15px; flex-wrap: wrap;">
                      <div style="flex:1; min-width: 250px; background:rgba(40,167,69,0.08); padding:15px; border-radius:6px; border-left:4px solid var(--color-success);">
                        <b style="color:var(--color-success)">🟢 Palavras-Chave Contidas (${result.keywordsFound.length}):</b>
                        <div style="margin-top:8px; font-size:0.85em; display: flex; flex-wrap: wrap; gap: 4px;">${result.keywordsFound.map((k) => `<span style="margin:2px; display:inline-block; padding:4px 8px; background:var(--color-bg-1); border-radius:4px; border:1px solid var(--color-success);">${k}</span>`).join('') || '<span style="color:var(--color-text-secondary)">Nenhuma localizada.</span>'}</div>
                      </div>
                      <div style="flex:1; min-width: 250px; background:rgba(220,53,69,0.08); padding:15px; border-radius:6px; border-left:4px solid var(--color-danger);">
                        <b style="color:var(--color-danger)">🔴 Palavras-Chave Faltantes (${result.keywordsMissing.length}):</b>
                        <div style="margin-top:8px; font-size:0.85em; display: flex; flex-wrap: wrap; gap: 4px;">${result.keywordsMissing.map((k) => `<span style="margin:2px; display:inline-block; padding:4px 8px; background:var(--color-bg-1); border-radius:4px; border:1px dashed var(--color-danger); opacity:0.8;">${k}</span>`).join('') || '<span style="color:var(--color-text-secondary)">Nenhuma faltante de peso superior.</span>'}</div>
                      </div>
                    </div>
                </div>
            `;
      }
    }

    // Anexar botão "Ver Gabarito Completo" no pé do feedback
    resultHTML += `
      <div style="text-align:center; margin-top:20px; padding-top:15px; border-top:1px dashed var(--color-border);">
        <button class="btn btn--sm js-toggle-gabarito" data-card-id="${cardId}" style="border:1px solid var(--color-border); background:var(--color-bg-1); color: var(--color-text); padding: 8px 16px; font-weight: 500;">
          👁️ Ver Gabarito Modelado Completo da Questão
        </button>
      </div>
    `;

    feedbackDiv.innerHTML = resultHTML;
  } catch (e) {
    console.error(e);
    feedbackDiv.innerHTML = `<div style="color:var(--color-danger); padding: 10px;">Falha crítica ao avaliar a requisição: ${e.message}</div>`;
  } finally {
    btns.forEach((b) => {
      b.disabled = false;
      b.style.opacity = '1';
      b.style.cursor = 'pointer';
    });
  }
}
