import { bancoState } from '../main.js';

export function gerarHtmlPainelFiltros() {
  return `
    <div class="filters-panel">
        <div class="filters-header">
            <span style="font-size:1.2em;">🌪️</span> Filtros Avançados
            <div style="margin-left:auto; display:flex; gap:10px;">
                <button class="btn btn--sm btn--outline js-limpar-filtros">Limpar</button>
                <button class="btn btn--sm btn--outline js-voltar-inicio">
                    ← Voltar
                </button>
            </div>
        </div>
        
        <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div class="filter-group">
                <label class="filter-label">Disciplina</label>
                <select id="filtroMateria" class="filter-control"><option value="">Todas</option></select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Instituição / Banca</label>
                <select id="filtroInstituicao" class="filter-control"><option value="">Todas</option></select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Material / Prova</label>
                <select id="filtroMaterial" class="filter-control"><option value="">Todos</option></select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Ano</label>
                <select id="filtroAno" class="filter-control"><option value="">Todos</option></select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Características</label>
                <select id="filtroFator" class="filter-control"><option value="">Qualquer</option></select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Imagens</label>
                <select id="filtroImagemPresence" class="filter-control">
                    <option value="">Indiferente</option>
                    <option value="com_imagem_enunciado">Com Imagem (Enunciado)</option>
                    <option value="sem_imagem_enunciado">Apenas Texto</option>
                    <option value="com_imagem_gabarito">Com Imagem (Resolução)</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Origem da Resolução</label>
                <select id="filtroOrigemRes" class="filter-control">
                    <option value="">Todas</option>
                    <option value="extraido_do_material">Oficial / Extraído</option>
                    <option value="gerado_pela_ia">Gerado por IA</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Palavra-chave / Assunto</label>
                <select id="filtroAssunto" class="filter-control"><option value="">Todos</option></select>
            </div>
            <div class="filter-group" style="grid-column: 1 / -1;">
                <label class="filter-label">Busca no Texto (Enunciado ou ID)</label>
                <input type="text" id="filtroTexto" class="filter-control" placeholder="Digite termos, ID ou trechos do enunciado...">
            </div>
            <button class="filter-search-btn js-aplicar-filtros" style="grid-column: 1 / -1;">
                🔎 Filtrar Questões
            </button>
        </div>
    </div>`;
}

export function limparFiltros() {
  document.querySelectorAll('.filter-control').forEach((el) => (el.value = ''));
  aplicarFiltrosBanco();
}

export function capturarValoresFiltros() {
  return {
    materia: document.getElementById('filtroMateria').value.toLowerCase(),
    inst: document.getElementById('filtroInstituicao').value.toLowerCase(),
    material: document.getElementById('filtroMaterial').value.toLowerCase(),
    ano: document.getElementById('filtroAno').value.toLowerCase(),
    fator: document.getElementById('filtroFator').value, // Case sensitive para chaves
    imagem: document.getElementById('filtroImagemPresence').value,
    origem: document.getElementById('filtroOrigemRes').value,
    assunto: document.getElementById('filtroAssunto').value.toLowerCase(),
    texto: document.getElementById('filtroTexto').value.toLowerCase(),
  };
}

export function verificarRegraImagem(q, g, filtroImagem) {
  // Se não tem filtro de imagem selecionado, passa sempre
  if (!filtroImagem) return true;

  // Verifica presença na questão
  const temImgEnunciado =
    !!q.possui_imagem ||
    (q.estrutura && q.estrutura.some((b) => b.tipo === 'imagem')) ||
    (q.imagens_urls && q.imagens_urls.length > 0);

  // Verifica presença no gabarito
  const temImgGabarito =
    (g.imagens_suporte && g.imagens_suporte.length > 0) ||
    (g.imagens_gabarito_original && g.imagens_gabarito_original.length > 0) ||
    (g.explicacao &&
      g.explicacao.some(
        (p) => p.estrutura && p.estrutura.some((b) => b.tipo === 'imagem')
      ));

  // Aplica a lógica exata do seu código original
  if (filtroImagem === 'com_imagem_enunciado' && !temImgEnunciado) return false;
  if (filtroImagem === 'sem_imagem_enunciado' && temImgEnunciado) return false;
  if (filtroImagem === 'com_imagem_gabarito' && !temImgGabarito) return false;

  return true;
}

export function itemAtendeFiltros(item, f) {
  const q = item.dados_questao || {};
  const g = item.dados_gabarito || {};
  const cred = g.creditos || {};
  const meta = item.meta || {};

  // 1. Texto (Enunciado ou ID)
  if (f.texto) {
    const blob = (q.enunciado + ' ' + q.identificacao).toLowerCase();
    if (!blob.includes(f.texto)) return false;
  }

  // 2. Matéria
  if (f.materia) {
    const mats = (q.materias_possiveis || []).map((m) => m.toLowerCase());
    if (!mats.some((m) => m.includes(f.materia))) return false;
  }

  // 3. Instituição
  if (f.inst) {
    const inst = (
      cred.autorouinstituicao ||
      cred.autor_ou_instituicao ||
      ''
    ).toLowerCase();
    if (!inst.includes(f.inst)) return false;
  }

  // 4. Material Específico
  if (f.material) {
    const mat = (cred.material || meta.material_origem || '').toLowerCase();
    if (!mat.includes(f.material)) return false;
  }

  // 5. Ano
  if (f.ano) {
    const ano = (cred.ano || cred.year || '').toString().toLowerCase();
    if (!ano.includes(f.ano)) return false;
  }

  // 6. Fator de Complexidade
  if (f.fator) {
    const fatores = g.analise_complexidade?.fatores || {};
    // Verifica camelCase ou snake_case (preservando sua lógica)
    const val =
      fatores[f.fator] ||
      fatores[f.fator.replace(/_([a-z])/g, (_, x) => x.toUpperCase())];
    if (val !== true) return false;
  }

  // 7. Origem da Resolução
  if (f.origem) {
    let origem = (cred.origemresolucao || cred.origem_resolucao || '')
      .toLowerCase()
      .replace(/_/g, '');
    let filtro = f.origem.toLowerCase().replace(/_/g, '');
    if (!origem.includes(filtro)) return false;
  }

  // 8. Assunto / Tags
  if (f.assunto) {
    const tags = (q.palavras_chave || []).map((t) => t.toLowerCase());
    if (!tags.some((t) => t.includes(f.assunto))) return false;
  }

  // 9. Imagens (Chama a função auxiliar)
  return verificarRegraImagem(q, g, f.imagem);
}

export function aplicarFiltrosBanco() {
  // 1. Captura valores (Objeto com todas as configurações)
  const filtros = capturarValoresFiltros();
  let visiveis = 0;

  // 2. Itera sobre o cache de dados
  bancoState.todasQuestoesCache.forEach((item) => {
    // Decide se mostra ou esconde usando a função "Juiz"
    const show = itemAtendeFiltros(item, filtros);

    // Atualiza DOM do Card
    const cardEl = document.getElementById(`card_${item.key}`);
    if (cardEl) {
      cardEl.style.display = show ? 'block' : 'none';
      if (show) visiveis++;
    }
  });

  // 3. Atualiza Feedback Visual (Sentinela)
  const s = document.getElementById('sentinelaScroll');
  if (s) {
    if (visiveis === 0) {
      s.innerHTML = `<p style="color:var(--color-warning);">Nenhuma questão encontrada com esses filtros.</p>`;
    } else {
      s.innerHTML = `<p style="color:var(--color-primary);">${visiveis} questões visíveis (carregue mais rolando para baixo).</p>`;
    }
  }
}