import { get, ref } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { ensureLibsLoaded, renderLatexIn } from '../libs/loader.tsx';
import { bancoState, db, TAMANHO_PAGINA } from '../main.js';
import { criarCardTecnico } from './card-template.js';
import { popularFiltrosDinamicos } from './filtros-dinamicos.js';
import { capturarValoresFiltros, itemAtendeFiltros } from './filtros-ui.js';

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
  const sentinela = document.getElementById('sentinelaScroll');

  // Cria o observer
  bancoState.observadorScroll = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // Carrega mais do cache local de forma suave
        carregarBancoDados();
      }
    },
    { rootMargin: '300px' },
  );

  // Começa a observar
  if (sentinela) bancoState.observadorScroll.observe(sentinela);
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

/**
 * Carrega e gerencia a paginação e renderização de questões.
 * Carrega todo o banco do Firebase uma única vez no início e depois
 * gerencia filtros e paginação localmente de forma instantânea e sem travamento de UI.
 */
export async function carregarBancoDados() {
  if (bancoState.carregandoMais) return;
  bancoState.carregandoMais = true;

  try {
    await ensureLibsLoaded();

    const container = document.getElementById('bankStream');

    // 1. Carrega todo o banco do Firebase de uma única vez na inicialização
    if (!bancoState.dbCarregado) {
      const s = document.getElementById('sentinelaScroll');
      if (s) {
        s.innerHTML = `
          <div class="spinner" style="margin: 20px auto;"></div>
          <p style="color:var(--color-text-secondary); font-size:12px; margin-top:10px;">Carregando banco de dados do servidor...</p>
        `;
      }

      const dbRef = ref(db, 'questoes');
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        bancoState.todasQuestoesCache = processarDadosSnapshot(data);
        bancoState.dbCarregado = true;
        bancoState.renderedCount = 0;

        // Inicializa filtros com base no banco COMPLETO!
        if (typeof popularFiltrosDinamicos === 'function') {
          popularFiltrosDinamicos();
        }
      } else {
        bancoState.todasQuestoesCache = [];
        bancoState.dbCarregado = true;
      }
    }

    // Garante que o mapa do Projeto Científico esteja carregado antes de filtrar
    await hidratarStatusProjetoCientifico(bancoState.todasQuestoesCache);

    // 2. Filtra localmente com base nos filtros atuais selecionados na tela
    const filtros = capturarValoresFiltros();
    bancoState.questoesFiltradas = bancoState.todasQuestoesCache.filter((item) =>
      itemAtendeFiltros(item, filtros),
    );

    // 3. Determina o lote a ser renderizado a partir do cache filtrado
    const start = bancoState.renderedCount;
    const end = Math.min(start + TAMANHO_PAGINA, bancoState.questoesFiltradas.length);
    const loteParaRenderizar = bancoState.questoesFiltradas.slice(start, end);

    if (loteParaRenderizar.length > 0) {
      // 3.1 Busca status de revisão e experimentos em paralelo para o lote atual
      await Promise.all([
        hidratarStatusRevisao(loteParaRenderizar),
        hidratarStatusApendiceB(loteParaRenderizar),
        hidratarStatusProjetoCientifico(loteParaRenderizar),
      ]);

      // 3.2 Renderiza o lote suavemente no container DOM
      renderizarLoteQuestoes(loteParaRenderizar, container);

      bancoState.renderedCount = end;
    }

    // 4. Atualiza a mensagem e estado da sentinela de scroll
    atualizarStatusSentinelaLocal();
  } catch (e) {
    console.error('Erro ao carregar banco:', e);
    atualizarStatusSentinela('erro', e.message);
  } finally {
    bancoState.carregandoMais = false;
  }
}
