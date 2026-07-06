import { TIPOS_ESTRUTURA_VALIDOS } from "../main.js";
// Importamos os geradores do novo arquivo React/TSX
import {
  generateAlternativeHtmlString,
  generateHtmlString,
} from "./StructureRender.tsx";

/**
 * 1. FUNÇÃO PRINCIPAL (Orquestradora)
 * Agora atua como um Adapter para o componente React MainStructure.
 */
export function renderizarEstruturaHTML(
  estrutura,
  imagensExternas = [],
  contexto = "questao",
  isReadOnly = false
) {
  // Delega a criação da string HTML para o React
  return generateHtmlString(estrutura, imagensExternas, contexto, isReadOnly);
}

/**
 * 2. RENDERIZADOR DE BLOCOS DE TEXTO/ESTRUTURA
 * Mantido apenas por compatibilidade caso algum outro arquivo chame diretamente,
 * mas idealmente deve ser depreciado. Retorna vazio ou erro se chamado fora do fluxo principal,
 * ou podemos reimplementar chamando um componente React isolado se necessário.
 *
 * NOTA: Se esta função for chamada externamente isolada, ela precisaria ser
 * reescrita para usar ReactDOMServer.renderToStaticMarkup(<TextBlock ... />).
 * Deixarei uma implementação stub baseada na lógica antiga caso seja crítica.
 */
export function renderizarBlocoTexto(tipo, conteudoRaw, conteudoSafe) {
  // Lógica simplificada legacy apenas para fallback, já que o React cuida disso agora
  // dentro do renderizarEstruturaHTML.
  const criarMarkdown = (classeExtra) => {
    return `<div class="structure-block ${classeExtra} markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>`;
  };

  switch (tipo) {
    case "texto":
      return criarMarkdown("structure-text");
    case "citacao":
      return criarMarkdown("structure-citacao");
    case "destaque":
      return criarMarkdown("structure-destaque");
    case "titulo":
      return criarMarkdown("structure-titulo");
    case "subtitulo":
      return criarMarkdown("structure-subtitulo");
    case "fonte":
      return criarMarkdown("structure-fonte");
    case "lista": {
      const linhas = String(conteudoRaw || '').split(/\n/).filter(l => l.trim().length > 0);
      const listaHtml = '<ul>' + linhas.map(l => {
        const escaped = String(l.trim()).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<li>${escaped}</li>`;
      }).join('') + '</ul>';
      return `<div class="structure-block structure-lista markdown-content" data-raw="${conteudoSafe}">${listaHtml}</div>`;
    }
    case "equacao":
      return `<div class="structure-block structure-equacao">\\[${conteudoRaw}\\]</div>`;
    case "codigo":
      return `<pre class="structure-block structure-codigo"><code>${conteudoRaw}</code></pre>`;
    case "separador":
      return `<hr class="structure-block structure-separador" />`;
    default:
      return "";
  }
}

/**
 * 3. RENDERIZADOR DE IMAGEM
 * Mantido por compatibilidade de exportação, mas o fluxo principal usa o React.
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
  // Se esta função for usada isoladamente em outro lugar, considere migrar quem a chama.
  // Por enquanto, mantemos a lógica antiga aqui apenas como backup seguro,
  // já que renderizarEstruturaHTML não passa mais por aqui.

  let src = bloco.imagem_url || bloco.url || imagensExternas?.[imgIndex];
  const currentIndex = imgIndex;

  if (src) {
    if (isReadOnly) {
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" title="Clique para ampliar" style="cursor:zoom-in;">
                ${conteudoRaw ? `<div class="structure-caption markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>` : ""}
            </div>`;
    } else {
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)">
                ${conteudoRaw ? `<div class="structure-caption markdown-content" data-raw="${conteudoSafe}">IA: ${conteudoRaw}</div>` : ""}
                <button class="btn-trocar-img js-captura-trigger" data-idx="${currentIndex}" data-ctx="${contexto}">
                    <span class="btn-ico">🔄</span><span>Trocar Imagem</span>
                </button>
            </div>`;
    }
  } else {
    if (isReadOnly) {
      return `<div class="structure-block" style="padding:10px; border:1px dashed #ccc; color:gray; font-size:11px; text-align:center;">(Imagem não disponível)</div>`;
    } else {
      return `
            <div class="structure-block structure-image-placeholder js-captura-trigger" data-idx="${currentIndex}" data-ctx="${contexto}">
                <div class="icon">📷</div><strong>Adicionar Imagem Aqui</strong>
                <div class="markdown-content" data-raw="${conteudoSafe}" style="font-size:11px;color:var(--color-text-secondary);margin-top:4px;">IA: ${conteudoRaw}</div>
            </div>`;
    }
  }
}

/**
 * 4. FUNÇÃO PRINCIPAL ALTERNATIVA
 * Adapter para o componente React AlternativeStructure.
 */
export function renderizar_estrutura_alternativa(
  estrutura,
  letra,
  imagensExternas = [],
  contexto = "questao"
) {
  return generateAlternativeHtmlString(
    estrutura,
    letra,
    imagensExternas,
    contexto
  );
}

/**
 * 5. AUXILIAR: RENDERIZADOR DE IMAGEM DA ALTERNATIVA
 * Mantido apenas para compatibilidade de exportação.
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
  // Implementação legacy de backup
  const src = bloco.imagem_url || imgsFallback[currentImgIdx];

  if (src) {
    if (isReadOnly) {
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" style="cursor:zoom-in" />
                ${temConteudo ? `<div class="structure-caption markdown-content" data-raw="${conteudoRawAttr}" style="font-size:0.9em; margin-top:5px; color:#555;">${conteudo}</div>` : ""}
            </div>`;
    } else {
      return `
            <div class="structure-block structure-image-wrapper">
                <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" />
                ${temConteudo ? `<div class="structure-caption markdown-content" data-raw="${conteudoRawAttr}" style="font-size:11px; margin-top:4px; color:var(--color-text-secondary);">IA: ${conteudo}</div>` : ""}
                <button class="btn-trocar-img" onclick="window.iniciar_captura_para_slot_alternativa('${letra}', ${currentImgIdx})">
                    <span class="btn-ico">🔄</span>
                </button>
            </div>`;
    }
  } else if (!isReadOnly) {
    return `
        <div class="structure-block structure-image-placeholder" onclick="window.iniciar_captura_para_slot_alternativa('${letra}', ${currentImgIdx})">
            <div class="icon">📷</div>
            ${temConteudo ? `<div class="markdown-content" data-raw="${conteudoRawAttr}" style="font-size:10px; color:gray; margin-top:4px; max-width:100%; overflow:hidden; text-overflow:ellipsis;">IA: ${conteudo}</div>` : ""}
        </div>`;
  }
  return "";
}

/**
 * NORMALIZADORES
 * Usam a lógica do TSX para manter consistência, mas verificam o TIPOS_ESTRUTURA_VALIDOS
 * localmente se necessário para garantir a regra da constante importada do main.js.
 */
export function normalizarBlocoEstrutura(bloco) {
  // Usamos a versão do TS para limpar strings, mas aplicamos a regra de validação do main.js aqui
  // para garantir fidelidade ao arquivo original que importava TIPOS_ESTRUTURA_VALIDOS

  const rawTipo = bloco?.tipo ?? "imagem";
  let tipo = String(rawTipo).toLowerCase().trim();

  if (!TIPOS_ESTRUTURA_VALIDOS.has(tipo)) {
    tipo = "imagem";
  }

  let conteudo = bloco?.conteudo ?? "";
  conteudo = String(conteudo);

  if (tipo === "separador") conteudo = conteudo.trim();

  return { tipo, conteudo };
}

export function normalizarEstrutura(estruturaLike) {
  if (!Array.isArray(estruturaLike)) return [];
  return estruturaLike.map(normalizarBlocoEstrutura);
}
