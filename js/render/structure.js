import { TIPOS_ESTRUTURA_VALIDOS } from '../main.js';

/**
 * 1. FUNÇÃO PRINCIPAL (Orquestradora)
 * Gerencia o loop, o índice das imagens e decide qual renderizador chamar.
 */
export function renderizarEstruturaHTML(
  estrutura,
  imagensExternas = [],
  contexto = 'questao'
) {
  if (!estrutura || !Array.isArray(estrutura) || estrutura.length === 0) {
    return '';
  }

  let imgIndex = 0;
  let html = `<div class="structure-container">`;
  const isReadOnly = contexto === 'banco';

  estrutura.forEach((bloco) => {
    const tipo = (bloco?.tipo || 'imagem').toLowerCase();

    // Prepara o conteúdo (Sanitização básica)
    const conteudoRaw = bloco?.conteudo ? String(bloco.conteudo) : '';
    const conteudoSafe = conteudoRaw
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // DECISÃO: É imagem ou texto/padrão?
    if (tipo === 'imagem' || !tipo) {
      // Lógica de Imagem isolada
      html += renderizarBlocoImagem(
        bloco,
        imgIndex,
        imagensExternas,
        contexto,
        isReadOnly,
        conteudoRaw,
        conteudoSafe
      );
      imgIndex++; // Incrementa índice apenas se for imagem
    } else {
      // Lógica de Texto/Estrutura isolada
      html += renderizarBlocoTexto(tipo, conteudoRaw, conteudoSafe);
    }
  });

  html += `</div>`;
  return html;
}

/**
 * 2. RENDERIZADOR DE BLOCOS DE TEXTO/ESTRUTURA
 * Cuida de títulos, parágrafos, listas, equações, código, etc.
 */
export function renderizarBlocoTexto(tipo, conteudoRaw, conteudoSafe) {
  // Helper interno para evitar repetição (closure)
  const criarMarkdown = (classeExtra) => {
    return `<div class="structure-block ${classeExtra} markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>`;
  };

  switch (tipo) {
    case 'texto':
      return criarMarkdown('structure-text');
    case 'citacao':
      return criarMarkdown('structure-citacao');
    case 'destaque':
      return criarMarkdown('structure-destaque');
    case 'titulo':
      return criarMarkdown('structure-titulo');
    case 'subtitulo':
      return criarMarkdown('structure-subtitulo');
    case 'fonte':
      return criarMarkdown('structure-fonte');

    case 'lista':
      // Mantém a lógica original da lista
      return `<div class="structure-block structure-lista markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>`;

    case 'equacao':
      return `<div class="structure-block structure-equacao">\\[${conteudoRaw}\\]</div>`;

    case 'codigo':
      return `<pre class="structure-block structure-codigo"><code>${conteudoRaw}</code></pre>`;

    case 'separador':
      return `<hr class="structure-block structure-separador" />`;

    default:
      return ''; // Tipo desconhecido
  }
}

/**
 * 3. RENDERIZADOR DE IMAGEM
 * Cuida da lógica de URL, placeholders, modo leitura vs edição.
 */
export function renderizarBlocoImagem(
  bloco,
  imgIndex,
  imagensExternas,
  contexto,
  isReadOnly,
  conteudoRaw,
  conteudoSafe
) {
  // 1. Resolução da URL (Prioridade: Base64 > URL no bloco > Array Externo)
  let src =
    bloco.imagem_base64 ||
    bloco.imagem_url ||
    bloco.url ||
    imagensExternas?.[imgIndex];
  const currentIndex = imgIndex;

  if (src) {
    // --- CENÁRIO A: IMAGEM EXISTE ---
    if (isReadOnly) {
      // Modo Banco: Apenas visualização com Zoom
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" title="Clique para ampliar" style="cursor:zoom-in;">
                ${conteudoRaw ? `<div class="structure-caption markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>` : ''}
            </div>`;
    } else {
      // Modo Editor: Com botões de trocar
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)">
                ${conteudoRaw ? `<div class="structure-caption markdown-content" data-raw="${conteudoSafe}">IA: ${conteudoRaw}</div>` : ''}
                <button class="btn-trocar-img js-captura-trigger" data-idx="${currentIndex}" data-ctx="${contexto}">
                    <span class="btn-ico">🔄</span><span>Trocar Imagem</span>
                </button>
            </div>`;
    }
  } else {
    // --- CENÁRIO B: IMAGEM FALTANDO (Placeholder) ---
    if (isReadOnly) {
      // Modo Banco: Aviso discreto
      return `<div class="structure-block" style="padding:10px; border:1px dashed #ccc; color:gray; font-size:11px; text-align:center;">(Imagem não disponível)</div>`;
    } else {
      // Modo Editor: Placeholder clicável para adicionar
      return `
            <div class="structure-block structure-image-placeholder js-captura-trigger" data-idx="${currentIndex}" data-ctx="${contexto}">
                <div class="icon">📷</div><strong>Adicionar Imagem Aqui</strong>
                <div class="markdown-content" data-raw="${conteudoSafe}" style="font-size:11px;color:var(--color-text-secondary);margin-top:4px;">IA: ${conteudoRaw}</div>
            </div>`;
    }
  }
}

/**
 * 1. FUNÇÃO PRINCIPAL
 * Itera sobre a estrutura da alternativa e delega a renderização de imagens.
 */
export function renderizar_estrutura_alternativa(
  estrutura,
  letra,
  imagensExternas = [],
  contexto = 'questao'
) {
  if (!Array.isArray(estrutura) || estrutura.length === 0) return '';

  let imgIndex = 0;
  const isReadOnly = contexto === 'banco';

  // Fallback para imagens externas se não estiverem no bloco
  const imgsFallback =
    imagensExternas && imagensExternas.length > 0
      ? imagensExternas
      : window.__imagensLimpas?.alternativas?.questao?.[letra] || [];

  let html = `<div class="alt-estrutura">`;

  estrutura.forEach((bloco) => {
    const tipo = String(bloco?.tipo || 'texto').toLowerCase();

    // Prepara o conteúdo (Sanitização)
    const conteudo = String(bloco?.conteudo || '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const conteudoRawAttr = String(bloco?.conteudo || '').replace(
      /"/g,
      '&quot;'
    );
    const temConteudo =
      bloco?.conteudo && String(bloco.conteudo).trim().length > 0;

    // --- TIPOS SIMPLES (Texto e Equação) ---
    if (tipo === 'texto') {
      html += `<div class="structure-block structure-text markdown-content" data-raw="${conteudoRawAttr}">${conteudo}</div>`;
      return;
    }
    if (tipo === 'equacao') {
      html += `<div class="structure-block structure-equacao">\\[${conteudo}\\]</div>`;
      return;
    }

    // --- TIPO COMPLEXO (Imagem) ---
    // Passamos todos os dados necessários para a função auxiliar
    html += renderizarBlocoImagemAlternativa(
      bloco,
      letra,
      imgIndex,
      imgsFallback,
      isReadOnly,
      conteudo,
      conteudoRawAttr,
      temConteudo
    );

    imgIndex++; // Incrementa contador apenas após processar uma imagem
  });

  html += `</div>`;
  return html;
}

/**
 * 2. AUXILIAR: RENDERIZADOR DE IMAGEM DA ALTERNATIVA
 * Lida com URL, placeholders, legendas e botões de captura específicos da alternativa.
 */
export function renderizarBlocoImagemAlternativa(
  bloco,
  letra,
  currentImgIdx,
  imgsFallback,
  isReadOnly,
  conteudo,
  conteudoRawAttr,
  temConteudo
) {
  // Prioridade: Base64 > URL no bloco > Array de Fallback
  const src =
    bloco.imagem_base64 || bloco.imagem_url || imgsFallback[currentImgIdx];

  if (src) {
    // CASO A: Imagem Existe
    if (isReadOnly) {
      // Modo Banco: Sem botões
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" style="cursor:zoom-in" />
                ${temConteudo ? `<div class="structure-caption markdown-content" data-raw="${conteudoRawAttr}" style="font-size:0.9em; margin-top:5px; color:#555;">${conteudo}</div>` : ''}
            </div>`;
    } else {
      // Modo Editor: Com botão de troca
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" />
                ${temConteudo ? `<div class="structure-caption markdown-content" data-raw="${conteudoRawAttr}" style="font-size:11px; margin-top:4px; color:var(--color-text-secondary);">IA: ${conteudo}</div>` : ''}
                <button class="btn-trocar-img" onclick="window.iniciar_captura_para_slot_alternativa('${letra}', ${currentImgIdx})">
                    <span class="btn-ico">🔄</span>
                </button>
            </div>`;
    }
  } else if (!isReadOnly) {
    // CASO B: Placeholder (apenas no modo editor)
    return `
        <div class="structure-block structure-image-placeholder" onclick="window.iniciar_captura_para_slot_alternativa('${letra}', ${currentImgIdx})">
            <div class="icon">📷</div>
            ${temConteudo ? `<div class="markdown-content" data-raw="${conteudoRawAttr}" style="font-size:10px; color:gray; margin-top:4px; max-width:100%; overflow:hidden; text-overflow:ellipsis;">IA: ${conteudo}</div>` : ''}
        </div>`;
  }

  // Caso C: Imagem faltando em modo leitura (retorna string vazia conforme original implícito)
  return '';
}

export function normalizarBlocoEstrutura(bloco) {
  const rawTipo = bloco?.tipo ?? 'imagem';
  let tipo = String(rawTipo).toLowerCase().trim();

  if (!TIPOS_ESTRUTURA_VALIDOS.has(tipo)) {
    tipo = 'imagem'; // regra: desconhecido => imagem
  }

  let conteudo = bloco?.conteudo ?? '';
  conteudo = String(conteudo);

  // opcional: se for separador, pode ignorar conteudo
  if (tipo === 'separador') conteudo = conteudo.trim();

  // opcional: se veio vazio e não é separador, mantém string vazia mesmo
  return { tipo, conteudo };
}

export function normalizarEstrutura(estruturaLike) {
  if (!Array.isArray(estruturaLike)) return [];
  return estruturaLike.map(normalizarBlocoEstrutura);
}