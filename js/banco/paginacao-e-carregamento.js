import { ensureLibsLoaded, renderLatexIn } from '../libs/loader.tsx';
import { bancoState, TAMANHO_PAGINA } from '../main.js';
import { attachDOMIntegrityObserver, generateSignedHeaders } from '../utils/security-guard.js';
import { criarCardTecnico } from './card-template.js';
import { popularFiltrosDinamicos } from './filtros-dinamicos.js';
import { capturarValoresFiltros, itemAtendeFiltros } from './filtros-ui.js';

const WORKER_BASE_URL =
  import.meta.env.VITE_WORKER_URL ||
  'https://maia-api-worker.willian-campos-ismart.workers.dev';

export async function buscarQuestoesPaginadasWorker(page = 1, limit = 20, prova = '', termo = '') {
  try {
    const signedHeaders = await generateSignedHeaders('/questoes-paginadas');
    const res = await fetch(`${WORKER_BASE_URL}/questoes-paginadas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...signedHeaders,
      },
      body: JSON.stringify({ page, limit, prova, termo }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Paginacao] Erro na busca via Worker:', err);
  }
  return { success: false, questoes: [], total: 0 };
}

export function processarDadosSnapshot(data) {
  // 1. Inverte para mostrar as mais recentes primeiro
  const listaProvas = Object.entries(data).reverse();
  const questoesProcessadas = [];

  listaProvas.forEach(([nomeProva, mapQuestoes]) => {
    if (mapQuestoes && typeof mapQuestoes === 'object') {
      Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {
        // Validação básica
        if (!fullData.dados_questao) return;

        // Injeta metadados (Nome da prova)
        if (!fullData.meta) fullData.meta = {};
        if (!fullData.meta.material_origem) {
          fullData.meta.material_origem = nomeProva.replace(/_/g, ' ');
        }

        // ID composto único para o DOM (evita conflito entre provas com mesma questão)
        const domId = `${nomeProva}___${idQuestao}`;

        // Adiciona na lista plana com a mesma estrutura esperada pelos filtros
        questoesProcessadas.push({
          key: domId, // Key para filtros e DOM
          id: idQuestao, // ID original do Firebase
          prova: nomeProva, // Nome da prova
          domId: domId, // ID único para DOM elements
          ...fullData, // Conteúdo original da questão
        });
      });
    }
  });

  return questoesProcessadas;
}

export function renderizarLoteQuestoes(listaQuestoes, container) {
  listaQuestoes.forEach((item) => {
    const { domId } = item;

    // Renderiza o card com o ID único
    const card = criarCardTecnico(domId, item);
    container.appendChild(card);

    // Renderiza LaTeX (Matemática)
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(card);
    }
  });
}

// Helper para buscar status da sentinela localmente
export function atualizarStatusSentinelaLocal() {
  const s = document.getElementById('sentinelaScroll');
  if (!s) return;

  const total = bancoState.questoesFiltradas.length;
  const rendered = bancoState.renderedCount;

  if (total === 0) {
    s.innerHTML =
      '<p style="color:var(--color-warning); font-weight: 500;">Nenhuma questão encontrada com esses filtros.</p>';
  } else if (rendered >= total) {
    s.innerHTML = `<p style="color:var(--color-text-secondary); font-size: 0.9rem;">Fim do banco de questões (${total} visíveis).</p>`;
    if (bancoState.observadorScroll) {
      bancoState.observadorScroll.disconnect();
    }
  } else {
    s.innerHTML = `
      <div class="spinner" style="margin: 0 auto; display: none;"></div>
      <p style="color:var(--color-primary); font-size: 0.9rem; font-weight: 500;">${rendered} de ${total} questões exibidas (role para carregar mais).</p>
    `;
    // Garante que o observer volte a observar se tem mais para carregar
    if (bancoState.observadorScroll) {
      bancoState.observadorScroll.observe(s);
    }
  }
}

// Helper genérico legado para exibir mensagens de status
export function atualizarStatusSentinela(status, mensagem = '') {
  const s = document.getElementById('sentinelaScroll');
  if (!s) return;

  if (status === 'fim') {
    s.innerHTML = '<p style="color:var(--color-text-secondary);">Fim do banco de questões.</p>';
    if (bancoState.observadorScroll) bancoState.observadorScroll.disconnect();
  } else if (status === 'erro') {
    s.innerHTML = `<p style="color:var(--color-error);">Erro: ${mensagem}</p>`;
  }
}

export function configurarObserverScroll() {
  // Desativado: A navegação agora é feita exclusivamente via barra de paginação numerada 10 em 10.
  if (bancoState.observadorScroll) {
    bancoState.observadorScroll.disconnect();
    bancoState.observadorScroll = null;
  }
}

// Helper para buscar status de revisão
async function hidratarStatusRevisao(listaQuestoes) {
  if (!listaQuestoes || listaQuestoes.length === 0) return;

  const { get, ref, child } = await import(
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
  );
  const { db } = await import('../main.js');

  const promises = listaQuestoes.map(async (item) => {
    const path = `revisoes/${item.prova}/${item.id}/status`;
    try {
      const snap = await get(child(ref(db), path));
      if (snap.exists()) {
        item.reviewStatus = snap.val();
      }
    } catch (e) {
      console.warn('Erro ao buscar status revisão:', path, e);
    }
  });

  await Promise.all(promises);
}

// Ingestão dinâmica e em lote do status do Apêndice B
async function hidratarStatusApendiceB(listaQuestoes) {
  if (!listaQuestoes || listaQuestoes.length === 0) return;

  const { get, ref, child } = await import(
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
  );
  const { db } = await import('../main.js');

  window.bancoState = window.bancoState || {};
  window.bancoState.apendiceBStatusMap = window.bancoState.apendiceBStatusMap || {};

  const provasUnicas = [...new Set(listaQuestoes.map((item) => item.prova))];

  const promises = provasUnicas.map(async (prova) => {
    const path = `experimentos_apendice_b_status/${prova}`;
    try {
      const snap = await get(child(ref(db), path));
      if (snap.exists()) {
        const statusMap = snap.val();
        Object.entries(statusMap).forEach(([idQuestao, val]) => {
          if (val && val.status === 'rodado') {
            window.bancoState.apendiceBStatusMap[`${prova}/${idQuestao}`] = true;
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao buscar status Apêndice B:', path, e);
    }
  });

  await Promise.all(promises);
}

// Helper para casar uma questão do experimento JSON com um item do cache
function matchExperimentoQuestao(expQ, item) {
  if (!expQ || !item) return false;
  const expIdLower = String(expQ.id || '').toLowerCase();
  const qIdStr = String(item.id || item.key || '').toLowerCase();
  const provaStr = String(item.prova || '').toLowerCase();
  const fullData = item;
  const gabarito = fullData.dados_gabarito || {};
  const creditos = gabarito.creditos || {};
  const textoRef = gabarito.texto_referencia || '';

  if (qIdStr.includes(expIdLower) || expIdLower.includes(qIdStr)) return true;

  const expYearMatch = expIdLower.match(/\d{4}/);
  const expYear = expYearMatch ? expYearMatch[0] : '';
  const selYear =
    String(creditos.ano || '').trim() ||
    (provaStr.match(/\d{4}/) ? provaStr.match(/\d{4}/)[0] : '');
  if (expYear && selYear && expYear !== selYear) return false;

  let selNum = null;
  const azulMatch = textoRef.match(/\*\*Caderno Azul:\*\* Questão (\d+)/i);
  if (azulMatch) {
    selNum = parseInt(azulMatch[1], 10);
  } else {
    const partsSel = qIdStr.split('_');
    for (const part of partsSel) {
      const m = part.match(/Q?(\d+)/i);
      if (m) {
        selNum = parseInt(m[1], 10);
        break;
      }
    }
  }

  const partsExp = expIdLower.split('_');
  let expNum = null;
  for (let i = 1; i < partsExp.length; i++) {
    const m = partsExp[i].match(/Q?(\d+)/i);
    if (m) {
      expNum = parseInt(m[1], 10);
      break;
    }
  }

  if (selNum !== null && expNum !== null && selNum !== expNum) return false;

  const isIngSel = qIdStr.includes('ing');
  const isIngExp = expIdLower.includes('ing');
  if (isIngSel !== isIngExp) return false;

  const isEspSel = qIdStr.includes('esp');
  const isEspExp = expIdLower.includes('esp');
  if (isEspSel !== isEspExp) return false;

  return true;
}

// Ingestão dinâmica e em lote do status do Projeto Científico
async function hidratarStatusProjetoCientifico(listaQuestoes) {
  if (!listaQuestoes || listaQuestoes.length === 0) return;

  const { get, ref, child, update } = await import(
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
  );
  const { db } = await import('../main.js');

  if (!bancoState.projetoCientificoMap) {
    bancoState.projetoCientificoMap = {};
  }

  if (!bancoState._projMapLoaded) {
    try {
      const snap = await get(child(ref(db), 'projeto_cientifico'));
      if (snap.exists()) {
        const val = snap.val();
        Object.entries(val).forEach(([provaKey, qMap]) => {
          if (qMap && typeof qMap === 'object') {
            Object.entries(qMap).forEach(([idKey, isProj]) => {
              if (isProj) {
                bancoState.projetoCientificoMap[`${provaKey}/${idKey}`] = true;
              }
            });
          }
        });
      }

      // Se ainda não houver mapa salvo no Firebase, preenche automaticamente com as 50 questões do projeto
      if (Object.keys(bancoState.projetoCientificoMap).length === 0) {
        try {
          const res = await fetch('../../experiments/questoes_experimento.json');
          if (res.ok) {
            const expJson = await res.json();
            const exp50 = expJson.filter((q) => q.grupo === 'Linguagens' || q.grupo === 'Humanas');
            const updatesToSave = {};

            listaQuestoes.forEach((item) => {
              const matchesExp = exp50.some((expQ) => matchExperimentoQuestao(expQ, item));
              if (matchesExp) {
                const mapKey = `${item.prova}/${item.id}`;
                bancoState.projetoCientificoMap[mapKey] = true;
                updatesToSave[`projeto_cientifico/${item.prova}/${item.id}`] = true;
              }
            });

            if (Object.keys(updatesToSave).length > 0) {
              update(ref(db), updatesToSave).catch((e) =>
                console.warn('Erro ao salvar semente do projeto_cientifico:', e),
              );
            }
          }
        } catch (errJson) {
          console.warn('Erro ao carregar questoes_experimento.json:', errJson);
        }
      }

      bancoState._projMapLoaded = true;
    } catch (e) {
      console.warn('Erro ao carregar projeto_cientifico:', e);
    }
  }

  listaQuestoes.forEach((item) => {
    const key = `${item.prova}/${item.id}`;
    item.isProjetoCientifico = !!bancoState.projetoCientificoMap[key];
  });
}

export async function navegarParaPagina(numeroPagina) {
  const container = document.getElementById('bankStream');
  if (!container) return;

  bancoState.paginaAtual = Math.max(1, numeroPagina);
  bancoState.carregandoMais = true;

  const s = document.getElementById('sentinelaScroll');
  if (s) {
    s.innerHTML = `
      <div class="spinner" style="margin: 20px auto;"></div>
      <p style="color:var(--color-text-secondary); font-size:12px; margin-top:10px;">Carregando página ${bancoState.paginaAtual} com segurança...</p>
    `;
  }

  // 1. Evicção total da memória do DOM anterior
  container.innerHTML = '';

  try {
    const filtros = typeof capturarValoresFiltros === 'function' ? capturarValoresFiltros() : {};
    const provaFiltro = Array.isArray(filtros.material)
      ? (filtros.material[0] || '')
      : (Array.isArray(filtros.origem) ? (filtros.origem[0] || '') : (filtros.origem || ''));
    const termoFiltro = String(filtros.texto || filtros.termo || '');

    const res = await buscarQuestoesPaginadasWorker(bancoState.paginaAtual, 10, provaFiltro, termoFiltro);
    bancoState.totalQuestoes = res.total || 0;
    bancoState.totalPaginas = res.totalPages || 1;

    if (res && res.questoes && res.questoes.length > 0) {
      const lote = res.questoes.map((item) => {
        const domId = `${item.prova || 'prova'}___${item.key || item.id}`;
        return {
          key: domId,
          id: item.key || item.id,
          prova: item.prova || '',
          domId: domId,
          ...item,
        };
      });

      // Hidrata status em lote para os 10 itens
      await Promise.all([
        hidratarStatusRevisao(lote),
        hidratarStatusApendiceB(lote),
        hidratarStatusProjetoCientifico(lote),
      ]);

      // Renderiza os 10 cards na tela
      renderizarLoteQuestoes(lote, container);

      // Renderiza barra de paginação numerada
      renderizarControlePaginacao(container, bancoState.paginaAtual, bancoState.totalPaginas, bancoState.totalQuestoes);

      if (s) s.innerHTML = '';
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      if (s) {
        s.innerHTML = '<p style="color:var(--color-warning); font-weight: 500;">Nenhuma questão encontrada nesta página.</p>';
      }
    }
  } catch (err) {
    console.error('Erro na paginação:', err);
    if (s) s.innerHTML = `<p style="color:var(--color-error);">Erro: ${err.message}</p>`;
  } finally {
    bancoState.carregandoMais = false;
  }
}

export function renderizarControlePaginacao(container, page, totalPages, total) {
  const existing = document.getElementById('bancoPaginationBar');
  if (existing) existing.remove();

  if (totalPages <= 1 && total <= 10) return;

  const paginationDiv = document.createElement('div');
  paginationDiv.id = 'bancoPaginationBar';
  paginationDiv.className = 'q-pagination-bar-docked';
  paginationDiv.style.cssText = `
    position: sticky;
    bottom: 24px;
    z-index: 99;
    margin: 40px auto 20px auto;
    width: fit-content;
    max-width: 95%;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
    padding: 8px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
    user-select: none;
    transition: all 0.25s ease;
  `;

  let pageButtonsHtml = '';
  const maxButtons = 5;
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  const btnBaseStyle = `
    min-width: 36px;
    height: 36px;
    padding: 0 12px;
    border-radius: 9999px;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
  `;

  if (startPage > 1) {
    pageButtonsHtml += `
      <button type="button" class="js-pg-num" data-page="1" style="${btnBaseStyle} border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #94a3b8;">1</button>
    `;
    if (startPage > 2) {
      pageButtonsHtml += `<span style="color: #64748b; font-size: 0.85rem; padding: 0 2px;">•••</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    const isCurrent = p === page;
    if (isCurrent) {
      pageButtonsHtml += `
        <button type="button" class="js-pg-num active-pg" data-page="${p}" style="${btnBaseStyle}
          border: 1px solid #38bdf8;
          background: linear-gradient(135deg, #0284c7, #2563eb);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.45);
        ">${p}</button>
      `;
    } else {
      pageButtonsHtml += `
        <button type="button" class="js-pg-num" data-page="${p}" style="${btnBaseStyle}
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
        " onmouseover="this.style.background='rgba(255,255,255,0.12)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.04)'; this.style.color='#cbd5e1';">${p}</button>
      `;
    }
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageButtonsHtml += `<span style="color: #64748b; font-size: 0.85rem; padding: 0 2px;">•••</span>`;
    }
    pageButtonsHtml += `
      <button type="button" class="js-pg-num" data-page="${totalPages}" style="${btnBaseStyle} border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #94a3b8;">${totalPages}</button>
    `;
  }

  paginationDiv.innerHTML = `
    <!-- Contador / Status -->
    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #94a3b8; padding-right: 12px; border-right: 1px solid rgba(255,255,255,0.1);">
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
      <span>Pág. <strong style="color: #38bdf8; font-weight: 700;">${page}</strong> de <strong style="color: #e2e8f0;">${totalPages}</strong></span>
      <span style="opacity: 0.5; font-size: 0.78rem;">(${total})</span>
    </div>

    <!-- Botões Numéricos -->
    <div style="display: flex; align-items: center; gap: 6px;">
      <button type="button" class="js-pg-prev" ${page <= 1 ? 'disabled style="' + btnBaseStyle + ' opacity: 0.3; cursor: not-allowed; border: 1px solid rgba(255,255,255,0.05); background: transparent; color: #64748b;"' : 'style="' + btnBaseStyle + ' border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #f1f5f9;" onmouseover="this.style.background=\'rgba(255,255,255,0.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.06)\''}>
        ◀ Anterior
      </button>

      ${pageButtonsHtml}

      <button type="button" class="js-pg-next" ${page >= totalPages ? 'disabled style="' + btnBaseStyle + ' opacity: 0.3; cursor: not-allowed; border: 1px solid rgba(255,255,255,0.05); background: transparent; color: #64748b;"' : 'style="' + btnBaseStyle + ' border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #f1f5f9;" onmouseover="this.style.background=\'rgba(255,255,255,0.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.06)\''}>
        Próxima ▶
      </button>
    </div>
  `;

  paginationDiv.querySelectorAll('.js-pg-num').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetPage = parseInt(btn.dataset.page, 10);
      if (targetPage && targetPage !== page) {
        navegarParaPagina(targetPage);
      }
    });
  });

  const btnPrev = paginationDiv.querySelector('.js-pg-prev');
  if (btnPrev && page > 1) {
    btnPrev.addEventListener('click', () => navegarParaPagina(page - 1));
  }

  const btnNext = paginationDiv.querySelector('.js-pg-next');
  if (btnNext && page < totalPages) {
    btnNext.addEventListener('click', () => navegarParaPagina(page + 1));
  }

  container.appendChild(paginationDiv);
}

/**
 * Carrega e gerencia a paginação e renderização de questões via Worker.
 */
export async function carregarBancoDados() {
  if (bancoState.carregandoMais) return;
  await navegarParaPagina(bancoState.paginaAtual || 1);
}
