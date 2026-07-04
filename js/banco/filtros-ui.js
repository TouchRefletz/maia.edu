import { bancoState } from "../main.js";

export function gerarHtmlPainelFiltros() {
  // Get current corrector model name for display
  const correctorModelId = (typeof window !== 'undefined' && window.selectedModelCorrector) || localStorage.getItem('selectedModelCorrector') || 'models/gemini-3.5-flash';
  
  return `
    <div class="filters-panel">
        <div class="filters-header">
            <span style="font-size:1.2em;">🌪️</span> Filtros Avançados
            <div style="margin-left:auto; display:flex; gap:10px; align-items:center;">
                <button class="btn btn--sm btn--outline js-banco-model-selector" title="Configurar modelo de IA para correção de respostas dissertativas" style="display:flex; align-items:center; gap:6px; padding: 5px 10px; border: 1px solid rgba(139, 92, 246, 0.3); background: rgba(139, 92, 246, 0.08); color: #a78bfa; font-size: 0.75rem; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    <span class="js-banco-model-label">🤖 IA</span>
                </button>
                <button class="btn btn--sm btn--outline js-limpar-filtros">Limpar</button>
                <button class="btn btn--sm btn--outline js-voltar-inicio">
                    ← Voltar
                </button>
            </div>
        </div>
        
        <div class="filters-grid">
            <div class="filter-group">
                <label class="filter-label">Disciplina</label>
                <div id="filtroMateria" class="multi-select-container" data-placeholder="Todas">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Instituição / Banca</label>
                <div id="filtroInstituicao" class="multi-select-container" data-placeholder="Todas">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Material / Prova</label>
                <div id="filtroMaterial" class="multi-select-container" data-placeholder="Todos">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Ano</label>
                <div id="filtroAno" class="multi-select-container" data-placeholder="Todos">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Características</label>
                <div id="filtroFator" class="multi-select-container" data-placeholder="Qualquer">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>

            <div class="filter-group">
                <label class="filter-label">Status da Questão</label>
                <div id="filtroStatus" class="multi-select-container" data-placeholder="Qualquer">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>

            <div class="filter-group">
                <label class="filter-label">Estrutura (Enunciado)</label>
                <div id="filtroEstQuestao" class="multi-select-container" data-placeholder="Qualquer">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Estrutura (Alternativas)</label>
                <div id="filtroEstAlternativas" class="multi-select-container" data-placeholder="Qualquer">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <!-- Linha Customizada: 3 Colunas Iguais -->
            <div class="filter-group">
                <label class="filter-label">Estrutura (Gabarito)</label>
                <div id="filtroEstGabarito" class="multi-select-container" data-placeholder="Qualquer">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Origem da Resolução</label>
                <div id="filtroOrigemRes" class="multi-select-container" data-placeholder="Todas">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group">
                <label class="filter-label">Palavra-chave / Assunto</label>
                <div id="filtroAssunto" class="multi-select-container" data-placeholder="Todos">
                    <div class="filter-loading"><div class="spinner"></div><span>Carregando...</span></div>
                </div>
            </div>
            <div class="filter-group filter-full-width">
                <label class="filter-label">Busca no Texto (Todos os Campos)</label>
                <input type="text" id="filtroTexto" class="filter-control" placeholder="Pesquise em qualquer campo da questão...">
            </div>
            <button class="filter-search-btn js-aplicar-filtros filter-full-width">
                🔎 Filtrar Questões
            </button>
        </div>
    </div>`;
}

// Global Event Listener para Dropdowns (Delegation)
if (!window.__multiSelectListener) {
  document.addEventListener("click", (e) => {
    // Toggle Dropdown
    const trigger = e.target.closest(".multi-select-trigger");
    if (trigger) {
      const container = trigger.closest(".multi-select-container");
      const dropdown = container.querySelector(".multi-select-dropdown");

      // Fecha outros
      document.querySelectorAll(".multi-select-dropdown.open").forEach((d) => {
        if (d !== dropdown) d.classList.remove("open");
        if (d !== dropdown) d.previousElementSibling.classList.remove("active");
      });

      dropdown.classList.toggle("open");
      trigger.classList.toggle("active");
      return;
    }

    // Clicou fora -> Fecha todos
    if (!e.target.closest(".multi-select-container")) {
      document.querySelectorAll(".multi-select-dropdown.open").forEach((d) => {
        d.classList.remove("open");
        d.previousElementSibling.classList.remove("active");
      });
    }
  });

  // Evento de Change nos checkboxes para atualizar label
  document.addEventListener("change", (e) => {
    if (e.target.matches(".multi-select-option input[type='checkbox']")) {
      const container = e.target.closest(".multi-select-container");
      atualizarLabelTrigger(container);
    }
  });

  window.__multiSelectListener = true;
}

export function atualizarLabelTrigger(container) {
  const trigger = container.querySelector(".multi-select-trigger");
  const placeholder = container.dataset.placeholder || "Selecione";
  const checked = container.querySelectorAll("input[type='checkbox']:checked");

  if (checked.length === 0) {
    trigger.innerHTML = `<span>${placeholder}</span>`;
  } else {
    // Coleta os textos das labels assosciadas
    const labels = Array.from(checked).map((cb) => {
      // O label é o texto dentro do .multi-select-option vizinho ao input
      // Estrutura: <label> <input> <span>Texto</span> ... </label>
      // Vamos pegar o textContent do span ou do parent ignorando o badge
      const labelEl = cb.parentNode;
      // Pega o primeiro nó de texto ou span que não seja o badge
      // No meu render novo (filtro-dinamicos), fiz: checkbox, span(Texto), span(badge)
      // No filtroStatus (fixo no ui.js), fiz: checkbox, TextNode

      // Tenta achar span de texto
      const textSpan = labelEl.querySelector("span:not(.filter-item-count)");
      if (textSpan) return textSpan.textContent.trim();

      // Fallback: Pega todo o texto e remove o texto do badge se existir
      let fullText = labelEl.textContent;
      const badge = labelEl.querySelector(".filter-item-count");
      if (badge) {
        fullText = fullText.replace(badge.textContent, "");
      }
      return fullText.trim();
    });

    const finalText = labels.join(", ");
    trigger.innerHTML = `<span title="${finalText}">${finalText}</span>`;
  }
}

export function limparFiltros() {
  // Limpa inputs textuais
  document.querySelectorAll(".filter-control").forEach((el) => (el.value = ""));

  // Limpa checkboxes
  document
    .querySelectorAll(".multi-select-container input[type='checkbox']")
    .forEach((cb) => (cb.checked = false));

  // Reseta labels
  document
    .querySelectorAll(".multi-select-container")
    .forEach((c) => atualizarLabelTrigger(c));

  aplicarFiltrosBanco();
}

export function capturarValoresFiltros() {
  const getValues = (id) => {
    const container = document.getElementById(id);
    if (!container) return [];
    // Se for select normal (legado ou específico)
    if (container.tagName === "SELECT")
      return container.value ? [container.value] : [];

    // Se for Multi-Select
    const checked = container.querySelectorAll("input:checked");
    return Array.from(checked).map((cb) => cb.value.toLowerCase());
  };

  return {
    materia: getValues("filtroMateria"),
    inst: getValues("filtroInstituicao"),
    material: getValues("filtroMaterial"),
    ano: getValues("filtroAno"),
    year: getValues("filtroAno"),
    fator: getValues("filtroFator"),
    estQuestao: getValues("filtroEstQuestao"),
    estAlternativas: getValues("filtroEstAlternativas"),
    estGabarito: getValues("filtroEstGabarito"),
    origem: getValues("filtroOrigemRes"),
    assunto: getValues("filtroAssunto"),
    status: getValues("filtroStatus"),
    texto: document.getElementById("filtroTexto").value.toLowerCase(),
  };
}

/**
 * Extrai TODO o texto pesquisável de uma questão numa string única (com cache).
 * Cobre: enunciado, alternativas, motivos, resolução, relatório, justificativa,
 * créditos, palavras-chave, matérias, key do Firebase, etc.
 */
function buildSearchBlob(item) {
  if (item._searchBlob) return item._searchBlob;

  const parts = [];
  const push = (v) => {
    if (v) parts.push(v);
  };

  const q = item.dados_questao || {};
  const g = item.dados_gabarito || {};
  const cred = g.creditos || {};
  const meta = item.meta || {};

  // -- Key / ID do Firebase --
  push(item.key);

  // -- dados_questao --
  // estrutura (blocos de texto do enunciado)
  (q.estrutura || []).forEach((b) => push(b.conteudo));
  // alternativas
  (q.alternativas || []).forEach((alt) => {
    push(alt.letra);
    (alt.estrutura || []).forEach((b) => push(b.conteudo));
    push(alt.texto); // legado
  });
  // tags
  (q.palavras_chave || []).forEach(push);
  (q.materias_possiveis || []).forEach(push);
  // campos legados
  push(q.enunciado);
  push(q.identificacao);

  // -- dados_gabarito --
  push(g.alternativa_correta);
  push(g.justificativa_curta);
  push(g.texto_referencia);
  // alternativas analisadas (motivos)
  (g.alternativas_analisadas || []).forEach((aa) => {
    push(aa.letra);
    push(aa.motivo);
  });
  // explicacao (passos da resolução)
  (g.explicacao || []).forEach((passo) => {
    (passo.estrutura || []).forEach((b) => push(b.conteudo));
    push(passo.evidencia);
    push(passo.fonte_material);
  });
  // complexidade
  push(g.analise_complexidade?.justificativa_dificuldade);
  // créditos
  push(cred.material);
  push(cred.autor_ou_instituicao || cred.autorouinstituicao);
  push(cred.ano?.toString());

  // -- meta --
  push(meta.source_url);
  push(meta.material_origem);

  item._searchBlob = parts.join(" ").toLowerCase();
  return item._searchBlob;
}

export function itemAtendeFiltros(item, f) {
  const q = item.dados_questao || {};
  const g = item.dados_gabarito || {};
  const cred = g.creditos || {};
  const meta = item.meta || {};

  // 1. Texto (busca profunda em todos os campos)
  if (f.texto) {
    const blob = buildSearchBlob(item);
    if (!blob.includes(f.texto)) return false;
  }

  // Helper para match OR (se item tiver qualquer uma das selecionadas)
  const matchMulti = (selectedValues, itemValues) => {
    // Se filtro vazio, passa tudo
    if (!selectedValues || selectedValues.length === 0) return true;
    // Se item não tem valores, falha (pois filtro exige algo)
    if (!itemValues || itemValues.length === 0) return false;

    // Verifica intersecção
    return selectedValues.some((sv) =>
      itemValues.some((iv) => iv.includes(sv)),
    );
  };

  // Helper para valores simples (string vs array filter)
  const matchSimple = (selectedValues, itemValueStr) => {
    if (!selectedValues || selectedValues.length === 0) return true;
    if (!itemValueStr) return false;
    // Verifica se itemValueStr contém ALGUM dos valores selecionados
    return selectedValues.some((sv) => itemValueStr.includes(sv));
  };

  // 2. Matéria
  if (
    !matchMulti(
      f.materia,
      (q.materias_possiveis || []).map((m) => m.toLowerCase()),
    )
  )
    return false;

  // 3. Instituição
  const instItem = (
    cred.autorouinstituicao ||
    cred.autor_ou_instituicao ||
    ""
  ).toLowerCase();
  if (!matchSimple(f.inst, instItem)) return false;

  // 4. Material Específico
  const matItem = (cred.material || meta.material_origem || "").toLowerCase();
  if (!matchSimple(f.material, matItem)) return false;

  // 5. Ano
  // f.ano é array de strings "2023", "2024"...
  const anoItem = (cred.ano || cred.year || "").toString().toLowerCase();
  if (!matchSimple(f.ano, anoItem)) return false;

  // 6. Fator de Complexidade
  if (f.fator && f.fator.length > 0) {
    const fatores = g.analise_complexidade?.fatores || {};
    // Para passar, o item deve ter Pelo Menos Um dos fatores selecionados?
    // "Quero questões da Idade Média E Biodiversidade" -> Geralmente é OR em filtros de tags.
    // "Quero questões com Texto Extenso OU Dedução Lógica"
    const hasAny = f.fator.some((selKey) => {
      // Tenta casar a chave convertendo se preciso
      // Ex: selKey "texto_extenso". fatores = { texto_extenso: true } ou { textoExtenso: true }
      let val = fatores[selKey];
      if (val === undefined) {
        const camel = selKey.replace(/_([a-z])/g, (_, x) => x.toUpperCase());
        val = fatores[camel];
      }
      return val === true;
    });

    if (!hasAny) return false;
  }

  // 7. Origem da Resolução
  // Normaliza o valor do ITEM para bater com as keys do filtro (gerado_pela_ia, extraido_do_material)
  let origemItemRaw = (
    cred.origemresolucao ||
    cred.origem_resolucao ||
    ""
  ).toLowerCase();
  let origemItemNorm = "";

  if (
    origemItemRaw.includes("gerado") ||
    origemItemRaw.includes("artificial") ||
    origemItemRaw === "ia"
  ) {
    origemItemNorm = "gerado_pela_ia";
  } else if (
    origemItemRaw.includes("material") ||
    origemItemRaw.includes("oficial")
  ) {
    origemItemNorm = "extraido_do_material";
  } else {
    // Se não mapeou (ex: vazio), usamos o raw (embora o filtro não vá pegar se for key especifíca)
    origemItemNorm = origemItemRaw;
  }

  if (f.origem && f.origem.length > 0) {
    // f.origem tem as keys ["gerado_pela_ia", "extraido_do_material"]
    // Verifica se o normalizado está na lista
    if (!f.origem.includes(origemItemNorm)) return false;
  }

  // 8. Assunto / Tags
  if (
    !matchMulti(
      f.assunto,
      (q.palavras_chave || []).map((t) => t.toLowerCase()),
    )
  )
    return false;

  // 10. Estrutura do Enunciado
  if (f.estQuestao && f.estQuestao.length > 0) {
    const tiposEnunciado = (q.estrutura || []).map((b) =>
      (b.tipo || "imagem").toLowerCase(),
    );
    if (!matchMulti(f.estQuestao, tiposEnunciado)) return false;
  }

  // 11. Estrutura das Alternativas
  if (f.estAlternativas && f.estAlternativas.length > 0) {
    // Coleta todos os tipos presentes em TODAS as alternativas
    const tiposAlts = (q.alternativas || []).flatMap((alt) =>
      (alt.estrutura || []).map((b) => (b.tipo || "imagem").toLowerCase()),
    );
    // Basta que a lista combinada tenha o tipo procurado?
    // "Quero questões onde (qualquer) alternativa tenha Imagem" -> SIM.
    if (!matchMulti(f.estAlternativas, tiposAlts)) return false;
  }

  // 12. Estrutura do Gabarito/Explicação
  if (f.estGabarito && f.estGabarito.length > 0) {
    // Verifica explicacao (array de passos)
    const tiposExpl = (g.explicacao || []).flatMap((passo) =>
      (passo.estrutura || []).map((b) => (b.tipo || "imagem").toLowerCase()),
    );
    if (!matchMulti(f.estGabarito, tiposExpl)) return false;
  }

  // 13. Status da Questão
  if (f.status && f.status.length > 0) {
    // Se a questão não tem campo status, assume "não revisada"
    const statusItem = (item.reviewStatus || "não revisada").toLowerCase();

    // Verifica se o status do item está na lista de status selecionados
    if (!f.status.includes(statusItem)) return false;
  }

  return true;
}

export function aplicarFiltrosBanco() {
  const filtros = capturarValoresFiltros();
  let visiveis = 0;

  bancoState.todasQuestoesCache.forEach((item) => {
    const show = itemAtendeFiltros(item, filtros);
    const cardEl = document.getElementById(`card_${item.key}`);
    if (cardEl) {
      cardEl.style.display = show ? "block" : "none";
      if (show) visiveis++;
    }
  });

  const s = document.getElementById("sentinelaScroll");
  if (s) {
    if (visiveis === 0) {
      s.innerHTML = `<p style="color:var(--color-warning);">Nenhuma questão encontrada com esses filtros.</p>`;
    } else {
      s.innerHTML = `<p style="color:var(--color-primary);">${visiveis} questões visíveis (carregue mais rolando para baixo).</p>`;
    }
  }
}
