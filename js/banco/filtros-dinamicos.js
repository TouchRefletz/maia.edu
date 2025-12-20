import { bancoState } from '../main.js';

export const preencher = (id, set, isObj = false) => {
  const sel = document.getElementById(id);
  if (!sel) return;
  const valorAtual = sel.value;
  const placeholder = sel.options[0].text;
  sel.innerHTML = `<option value="">${placeholder}</option>`;

  // Ordena e cria options
  const arrayOrdenado = Array.from(set).sort();

  arrayOrdenado.forEach((val) => {
    let value, label;
    if (isObj) {
      const o = JSON.parse(val);
      value = o.key;
      label = o.label;
    } else {
      value = val;
      label = val;
    }
    const opt = document.createElement('option');
    opt.value = value;
    opt.innerText = label;
    sel.appendChild(opt);
  });
  sel.value = valorAtual;
};

export function inicializarSetsFiltros() {
  return {
    materias: new Set(),
    instituicoes: new Set(),
    materiais: new Set(),
    anos: new Set(),
    assuntos: new Set(),
    fatores: new Set(),
  };
}

export function coletarFatoresComplexidade(fatoresObj, setFatores) {
  if (!fatoresObj) return;

  Object.entries(fatoresObj).forEach(([key, val]) => {
    if (val === true) {
      // Formata "texto_extenso" para "Texto Extenso"
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      // Guarda obj stringificado para usar key e label no select
      setFatores.add(JSON.stringify({ key, label }));
    }
  });
}

export function extrairDadosItemParaFiltros(item, sets) {
  const q = item.dados_questao || {};
  const g = item.dados_gabarito || {};
  const cred = g.creditos || {};
  const meta = item.meta || {};

  // 1. Arrays (Matérias e Assuntos)
  if (q.materias_possiveis)
    q.materias_possiveis.forEach((m) => sets.materias.add(m));
  if (q.palavras_chave) q.palavras_chave.forEach((p) => sets.assuntos.add(p));

  // 2. Campos Simples (Inst, Material, Ano)
  const inst = cred.autorouinstituicao || cred.autor_ou_instituicao;
  if (inst) sets.instituicoes.add(inst);

  const mat = cred.material || meta.material_origem;
  if (mat) sets.materiais.add(mat);

  const ano = cred.ano || cred.year;
  if (ano) sets.anos.add(ano);

  // 3. Fatores (Chama a auxiliar)
  coletarFatoresComplexidade(g.analise_complexidade?.fatores, sets.fatores);
}

export function atualizarSelectsFiltros(sets) {
  // Assume que a função 'preencher' já existe no seu escopo global
  preencher('filtroMateria', sets.materias);
  preencher('filtroInstituicao', sets.instituicoes);
  preencher('filtroMaterial', sets.materiais);
  preencher('filtroAno', sets.anos);
  preencher('filtroAssunto', sets.assuntos);
  preencher('filtroFator', sets.fatores, true);
}

export function popularFiltrosDinamicos() {
  // 1. Cria os containeres
  const sets = inicializarSetsFiltros();

  // 2. Loop de extração
  bancoState.todasQuestoesCache.forEach((item) => {
    extrairDadosItemParaFiltros(item, sets);
  });

  // 3. Atualiza a tela
  atualizarSelectsFiltros(sets);
}