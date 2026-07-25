import { bancoState } from '../main.js';
import { FATORES_DEF } from '../utils/complexity-data.js';

const MAPA_LABELS_FATORES = FATORES_DEF.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

const MAPA_TIPO_ESTRUTURA = {
  texto: 'Texto',
  imagem: 'Imagem',
  citacao: 'Citação',
  titulo: 'Título',
  subtitulo: 'Subtítulo',
  lista: 'Lista',
  equacao: 'Equação',
  codigo: 'Código',
  destaque: 'Destaque',
  separador: 'Separador',
  fonte: 'Fonte',
  tabela: 'Tabela',
};

// Helper para formatar labels (Capitalize)
function formatLabel(str) {
  if (!str) return '';
  // Se for sigla comum, deixa upper (ex: INEP, ENEM, UNICAMP, USP, FUVEST)
  if (/^(inep|enem|unicamp|usp|fuvest|puc|ufrj)$/i.test(str)) {
    return str.toUpperCase();
  }
  // Se for texto, Capitalize Words
  return str.toLowerCase().replace(/(?:^|\s|["'([{])+\S/g, (match) => match.toUpperCase());
}

export const preencher = (id, optionsOrSet, isObj = false) => {
  const el = document.getElementById(id);
  if (!el) return;

  // Normaliza entrada para array de objetos {label, value, count}
  let options = [];

  // Caso 1: Array de Clusters ou Array pré-processado
  if (Array.isArray(optionsOrSet)) {
    // Verifica se é estrutura simple [{value, label}] ou já formatada.
    // Se não tiver count, assume 0 ou omite.
    options = optionsOrSet;
  }
  // Caso 2: Map (Novo formato com counts)
  else if (optionsOrSet instanceof Map) {
    const arr = Array.from(optionsOrSet.entries()).sort((a, b) => {
      // Ordena por string value normalmente
      return String(a[0]).localeCompare(String(b[0]));
    });

    options = arr.map(([val, count]) => {
      if (isObj) {
        const o = JSON.parse(val);
        return { value: o.key, label: o.label, count };
      }
      return { value: val, label: formatLabel(val), count };
    });
  }
  // Caso 3: Set Antigo (Fallback/Legado)
  else if (optionsOrSet instanceof Set) {
    const arr = Array.from(optionsOrSet).sort();
    options = arr.map((val) => {
      if (isObj) {
        const o = JSON.parse(val);
        return { value: o.key, label: o.label };
      }
      return { value: val, label: formatLabel(val) };
    });
  }

  // --- RENDERIZAÇÃO baseada no tipo de elemento ---

  // MODO 1: Select Simples
  if (el.tagName === 'SELECT') {
    const valorAtual = el.value;
    const placeholder = el.querySelector('option')?.text || 'Selecione';
    el.innerHTML = `<option value="">${placeholder}</option>`;

    options.forEach((optData) => {
      const opt = document.createElement('option');
      opt.value = optData.value;
      opt.innerText = optData.label + (optData.count ? ` (${optData.count})` : '');
      el.appendChild(opt);
    });

    if (valorAtual && options.some((o) => o.value === valorAtual)) {
      el.value = valorAtual;
    }
    return;
  }

  // MODO 2: Multi-Select Customizado (DIV)
  if (el.tagName === 'DIV' && el.classList.contains('multi-select-container')) {
    const placeholder = el.dataset.placeholder || 'Selecione';
    const valsSelecionados = new Set();

    el.querySelectorAll('input:checked').forEach((cb) => valsSelecionados.add(cb.value));

    el.innerHTML = '';

    // 1. Trigger
    const trigger = document.createElement('div');
    trigger.className = 'multi-select-trigger';
    trigger.innerHTML = `<span>${placeholder}</span>`;
    el.appendChild(trigger);

    // 2. Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'multi-select-dropdown';

    options.forEach((optData) => {
      const optDiv = document.createElement('label');
      optDiv.className = 'multi-select-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = optData.value;
      if (valsSelecionados.has(optData.value)) {
        checkbox.checked = true;
      }

      // Label + Count
      const spanText = document.createElement('span');
      spanText.innerText = optData.label;

      optDiv.appendChild(checkbox);
      optDiv.appendChild(spanText);

      // Badge de Contagem
      if (optData.count !== undefined) {
        const countBadge = document.createElement('span');
        countBadge.className = 'filter-item-count';
        countBadge.style.opacity = '0.6';
        countBadge.style.fontSize = '0.85em';
        countBadge.style.marginLeft = 'auto'; // Push to right if flex
        countBadge.innerText = `(${optData.count})`;
        optDiv.appendChild(countBadge);
      }

      dropdown.appendChild(optDiv);
    });

    el.appendChild(dropdown);

    // Atualiza trigger inicial (fictício)
    // A função global atualizarLabelTrigger em filtros-ui vai cuidar do real click,
    // mas aqui precisamos restaurar o visual.
    // Vamos disparar um evento custom ou chamar a função se estiver acessível?
    // Como estamos em módulo, 'window' ou re-implementação simples.
    // Simples placeholder restoration:
    const checkedCount = valsSelecionados.size;
    if (checkedCount > 0) {
      // Deixa a lógica do filtros-ui assumir no primeiro click ou refresh
      // Mas para ficar bonito já:
      if (checkedCount <= 2) {
        const labels = options.filter((o) => valsSelecionados.has(o.value)).map((o) => o.label);
        trigger.innerHTML = `<span>${labels.join(', ')}</span>`;
      } else {
        const labels = options.filter((o) => valsSelecionados.has(o.value)).map((o) => o.label);
        trigger.innerHTML = `<span>${labels.slice(0, 2).join(', ')}...</span>`;
      }
    } else {
      trigger.innerHTML = `<span>${placeholder}</span>`;
    }
  }
};

export function inicializarSetsFiltros() {
  // Agora usamos Map para contar frequencia
  return {
    materias: new Map(),
    instituicoes: new Map(),
    materiais: new Map(),
    anos: new Map(),
    assuntos: new Map(),
    fatores: new Map(),
    estQuestao: new Map(),
    estAlternativas: new Map(),
    estGabarito: new Map(),
    origem: new Map(), // Novo
    status: new Map(), // Novo
  };
}

// Helper para incrementar Map
function addCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

export function coletarFatoresComplexidade(fatoresObj, mapFatores) {
  if (!fatoresObj) return;

  Object.entries(fatoresObj).forEach(([key, val]) => {
    if (val === true) {
      let label = MAPA_LABELS_FATORES[key];
      if (!label) {
        label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }
      addCount(mapFatores, JSON.stringify({ key, label }));
    }
  });
}

export function extrairDadosItemParaFiltros(item, maps) {
  const q = item.dados_questao || {};
  const g = item.dados_gabarito || {};
  const cred = g.creditos || {};
  const meta = item.meta || {};

  // 1. Arrays
  if (q.materias_possiveis) q.materias_possiveis.forEach((m) => addCount(maps.materias, m));
  if (q.palavras_chave) q.palavras_chave.forEach((p) => addCount(maps.assuntos, p));

  // 2. Campos Simples
  const inst = cred.autorouinstituicao || cred.autor_ou_instituicao;
  if (inst) addCount(maps.instituicoes, inst);

  const mat = cred.material || meta.material_origem;
  if (mat) addCount(maps.materiais, mat);

  const ano = cred.ano || cred.year;
  if (ano) addCount(maps.anos, ano);

  // 3. Fatores
  coletarFatoresComplexidade(g.analise_complexidade?.fatores, maps.fatores);

  // Helper estrutura
  const addEstrutura = (arr, map) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((b) => {
      const t = (b.tipo || 'imagem').toLowerCase();
      const label = MAPA_TIPO_ESTRUTURA[t] || formatLabel(t);
      addCount(map, JSON.stringify({ key: t, label }));
    });
  };

  // 4. Estrutura Enunciado
  addEstrutura(q.estrutura, maps.estQuestao);

  // 5. Estrutura Alternativas
  if (q.alternativas && Array.isArray(q.alternativas)) {
    q.alternativas.forEach((alt) => addEstrutura(alt.estrutura, maps.estAlternativas));
  }

  // 6. Estrutura Gabarito
  if (g.explicacao && Array.isArray(g.explicacao)) {
    g.explicacao.forEach((passo) => addEstrutura(passo.estrutura, maps.estGabarito));
  }

  // 7. Origem da Resolução
  // Normaliza para 'extraido_do_material' ou 'gerado_pela_ia'
  let origemVal = (cred.origemresolucao || cred.origem_resolucao || '').toLowerCase();

  // Mapeia para labels bonitas se necessário, mas aqui contamos keys.
  // O preencher vai usar formatLabel no value se não passarmos objetos.
  // Vamos padronizar as keys para bater com o filtro.
  if (origemVal.includes('gerado') || origemVal.includes('artificial') || origemVal === 'ia')
    origemVal = 'gerado_pela_ia';
  else if (origemVal.includes('material') || origemVal.includes('oficial'))
    origemVal = 'extraido_do_material';

  if (origemVal) {
    // Cria objeto para ter label bonita
    const label = origemVal === 'gerado_pela_ia' ? 'Gerado por IA' : 'Oficial / Extraído';
    addCount(maps.origem, JSON.stringify({ key: origemVal, label }));
  }

  // 8. Status da Questão
  const statusVal = (item.reviewStatus || 'não revisada').toLowerCase();

  const MAPA_LABELS_STATUS = {
    'não revisada': 'Não Revisada',
    revisada: 'Revisada',
    verificada: 'Verificada',
    sinalizada: 'Sinalizada',
    invalidada: 'Invalidada',
  };

  const statusLabel = MAPA_LABELS_STATUS[statusVal] || formatLabel(statusVal);
  addCount(maps.status, JSON.stringify({ key: statusVal, label: statusLabel }));
}

export function atualizarSelectsFiltros(maps) {
  preencher('filtroMateria', maps.materias);
  preencher('filtroInstituicao', maps.instituicoes);
  preencher('filtroMaterial', maps.materiais);

  preencher('filtroAno', maps.anos);
  preencher('filtroAssunto', maps.assuntos);
  preencher('filtroFator', maps.fatores, true);

  preencher('filtroEstQuestao', maps.estQuestao, true);
  preencher('filtroEstAlternativas', maps.estAlternativas, true);
  preencher('filtroEstGabarito', maps.estGabarito, true);

  // 4. Origem e Status (Agora dinâmicos com contagem)
  preencher('filtroOrigemRes', maps.origem, true);
  preencher('filtroStatus', maps.status, true);
}

export async function popularFiltrosDinamicos() {
  const maps = inicializarSetsFiltros();
  bancoState.todasQuestoesCache.forEach((item) => {
    extrairDadosItemParaFiltros(item, maps);
  });
  await atualizarSelectsFiltros(maps);
}
