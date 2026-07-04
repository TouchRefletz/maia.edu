import {
  endBefore,
  get,
  limitToLast,
  orderByKey,
  query,
  ref,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { ensureLibsLoaded, renderLatexIn } from "../libs/loader.tsx";
import { TAMANHO_PAGINA, bancoState, db } from "../main.js";
import { criarCardTecnico } from "./card-template.js";
import { popularFiltrosDinamicos } from "./filtros-dinamicos.js";

export function construirConsultaFirebase(dbRef) {
  // Se não tem cursor anterior, pega as últimas X
  if (!bancoState.ultimoKeyCarregada) {
    return query(dbRef, orderByKey(), limitToLast(TAMANHO_PAGINA));
  }
  // Se tem cursor, pega as X anteriores a ele (paginação reversa)
  else {
    return query(
      dbRef,
      orderByKey(),
      endBefore(bancoState.ultimoKeyCarregada),
      limitToLast(TAMANHO_PAGINA),
    );
  }
}

export function processarDadosSnapshot(data) {
  // 1. Inverte para mostrar as mais recentes primeiro
  const listaProvas = Object.entries(data).reverse();

  // 2. Calcula o novo cursor para a próxima página
  const novoCursor = listaProvas[listaProvas.length - 1][0];

  // 3. Achata a estrutura: Prova -> Questões
  const questoesProcessadas = [];

  listaProvas.forEach(([nomeProva, mapQuestoes]) => {
    if (mapQuestoes && typeof mapQuestoes === "object") {
      Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {
        // Validação básica
        if (!fullData.dados_questao) return;

        // Injeta metadados (Nome da prova)
        if (!fullData.meta) fullData.meta = {};
        if (!fullData.meta.material_origem) {
          fullData.meta.material_origem = nomeProva.replace(/_/g, " ");
        }

        // Adiciona na lista plana
        questoesProcessadas.push({
          id: idQuestao,
          prova: nomeProva, // Needed for review path
          fullData: fullData,
        });
      });
    }
  });

  return { novoCursor, questoesProcessadas };
}

export function renderizarLoteQuestoes(listaQuestoes, container) {
  listaQuestoes.forEach((item) => {
    const { id, fullData } = item;

    // 1. Adiciona ao cache local global
    bancoState.todasQuestoesCache.push({ key: id, ...fullData });

    // 2. Renderiza o card
    const card = criarCardTecnico(id, fullData);
    container.appendChild(card);

    // 3. Renderiza LaTeX (Matemática)
    if (typeof renderLatexIn === "function") {
      renderLatexIn(card);
    }
  });
}

// Helper para buscar status
export function atualizarStatusSentinela(status, mensagem = "") {
  const s = document.getElementById("sentinelaScroll");
  if (!s) return;

  if (status === "fim") {
    s.innerHTML =
      '<p style="color:var(--color-text-secondary);">Fim do banco de questões.</p>';
    if (bancoState.observadorScroll) bancoState.observadorScroll.disconnect();
  } else if (status === "erro") {
    s.innerHTML = `<p style="color:var(--color-error);">Erro: ${mensagem}</p>`;
  }
}

export function configurarObserverScroll() {
  const sentinela = document.getElementById("sentinelaScroll");

  // Cria o observer
  bancoState.observadorScroll = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // Chama a função global de carregar dados
        carregarBancoDados();
      }
    },
    { rootMargin: "300px" },
  );

  // Começa a observar
  if (sentinela) bancoState.observadorScroll.observe(sentinela);
}

// Helper para buscar status
async function hidratarStatusRevisao(listaQuestoes) {
  if (!listaQuestoes || listaQuestoes.length === 0) return;

  const { get, ref, child } =
    await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
  const { db } = await import("../main.js");

  const promises = listaQuestoes.map(async (item) => {
    const path = `revisoes/${item.prova}/${item.id}/status`;
    try {
      const snap = await get(child(ref(db), path));
      if (snap.exists()) {
        item.fullData.reviewStatus = snap.val();

        // Atualiza cache se ja foi inserido (race condition com render)
        // O render acontece antes? Se sim, o objeto 'fullData' é referência?
        // Sim, objetos JS são referência. Se eu mudo aqui, muda no cache.
        // Mas não muda no DOM atributes. O filtro olha pro CACHE. entao ta safe.
      }
    } catch (e) {
      console.warn("Erro ao buscar status revisão:", path, e);
    }
  });

  await Promise.all(promises);
}

// Ingestão dinâmica e em lote do status do Apêndice B
async function hidratarStatusApendiceB(listaQuestoes) {
  if (!listaQuestoes || listaQuestoes.length === 0) return;

  const { get, ref, child } =
    await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
  const { db } = await import("../main.js");

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
          if (val && val.status === "rodado") {
            window.bancoState.apendiceBStatusMap[`${prova}/${idQuestao}`] = true;
          }
        });
      }
    } catch (e) {
      console.warn("Erro ao buscar status Apêndice B:", path, e);
    }
  });

  await Promise.all(promises);
}

export async function carregarBancoDados() {
  if (bancoState.carregandoMais) return;
  bancoState.carregandoMais = true;

  try {
    await ensureLibsLoaded();

    // 1. Busca os dados
    const dbRef = ref(db, "questoes");
    const consulta = construirConsultaFirebase(dbRef);
    const snapshot = await get(consulta);

    if (snapshot.exists()) {
      const data = snapshot.val();

      // 2. Processa os dados (Transforma e pega cursor)
      const { novoCursor, questoesProcessadas } = processarDadosSnapshot(data);

      // Atualiza variavel global de paginação
      bancoState.ultimoKeyCarregada = novoCursor;

      // 2.1 HIDRATAÇÃO DE STATUS (NOVO)
      // Buscamos em paralelo os status das revisoes e do Apêndice B
      await Promise.all([
        hidratarStatusRevisao(questoesProcessadas),
        hidratarStatusApendiceB(questoesProcessadas),
      ]);

      // 3. Renderiza na tela
      const container = document.getElementById("bankStream");
      renderizarLoteQuestoes(questoesProcessadas, container);

      // 4. Atualiza filtros
      if (typeof popularFiltrosDinamicos === "function") {
        popularFiltrosDinamicos();
      }
    } else {
      // Não existem mais dados
      atualizarStatusSentinela("fim");
    }
  } catch (e) {
    console.error("Erro ao carregar banco:", e);
    atualizarStatusSentinela("erro", e.message);
  } finally {
    bancoState.carregandoMais = false;
  }
}
