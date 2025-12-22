import React from 'react';
import ReactDOMServer from 'react-dom/server';

// --- DEFINIÇÃO DE TIPOS ---

declare global {
  interface Window {
    __imagensLimpas?: {
      questao_original?: string[];
      gabarito_original?: string[];
      alternativas?: {
        questao?: Record<string, string[]>;
      };
    };
    expandirImagem?: (src: string) => void;
    iniciar_captura_para_slot_alternativa?: (letra: string, idx: number) => void;
  }
}

export interface EstruturaBloco {
  tipo?: string;
  conteudo?: string | number;
  imagem_base64?: string;
  imagem_url?: string;
  url?: string;
}

interface CommonProps {
  contexto: string;
  isReadOnly: boolean;
}

// --- HELPER DE SANITIZAÇÃO (Para manter compatibilidade com o regex original) ---
const sanitizeContent = (content: string) => {
  return content
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// --- COMPONENTE: BLOCO DE TEXTO (REUTILIZÁVEL) ---
// Adaptado para aceitar atributos extras se necessário
const StructureTextBlock: React.FC<{
  bloco: EstruturaBloco;
  className?: string;
  dataRaw?: string;
}> = ({ bloco, className = '', dataRaw }) => {
  const tipo = (bloco.tipo || 'texto').toLowerCase();
  const conteudoRaw = bloco.conteudo ? String(bloco.conteudo) : '';
  const conteudoSafe = dataRaw || sanitizeContent(conteudoRaw);

  const criarMarkdown = (classeExtra: string) => (
    <div
      className={`structure-block ${classeExtra} markdown-content ${className}`}
      data-raw={conteudoSafe}
      dangerouslySetInnerHTML={{ __html: conteudoRaw }}
    />
  );

  switch (tipo) {
    case 'texto': return criarMarkdown('structure-text');
    case 'citacao': return criarMarkdown('structure-citacao');
    case 'destaque': return criarMarkdown('structure-destaque');
    case 'titulo': return criarMarkdown('structure-titulo');
    case 'subtitulo': return criarMarkdown('structure-subtitulo');
    case 'fonte': return criarMarkdown('structure-fonte');
    case 'lista':
      // Adiciona 2 espaços antes da quebra de linha para forçar quebra no Markdown (Hard Line Break)
      const conteudoListaMarkdown = conteudoRaw.replace(/\n/g, '  \n');
      const conteudoListaSafe = sanitizeContent(conteudoListaMarkdown);

      // Também mantemos o HTML direto com <br> para caso o Markdown não seja aplicado
      const htmlLista = conteudoRaw.replace(/\n/g, '<br>');

      return (
        <div
          className={`structure-block structure-lista markdown-content ${className}`}
          data-raw={conteudoListaSafe}
          dangerouslySetInnerHTML={{ __html: htmlLista }}
        />
      );
    case 'equacao': return (
      <div className={`structure-block structure-equacao ${className}`}>{`\\[${conteudoRaw}\\]`}</div>
    );
    case 'codigo': return (
      <pre className={`structure-block structure-codigo ${className}`}>
        <code>{conteudoRaw}</code>
      </pre>
    );
    case 'separador': return <hr className={`structure-block structure-separador ${className}`} />;
    default: return null;
  }
};

// --- COMPONENTE: BLOCO DE IMAGEM (QUESTÃO) ---
const ImageBlock: React.FC<{
  bloco: EstruturaBloco;
  imgIndex: number;
  src: string | undefined;
  contexto: string;
  isReadOnly: boolean;
  conteudoRaw: string;
  conteudoSafe: string;
}> = ({ bloco, imgIndex, src, contexto, isReadOnly, conteudoRaw, conteudoSafe }) => {

  // Renderiza legenda se houver conteúdo
  const renderCaption = (prefixo = '') => {
    if (!conteudoRaw) return null;
    return (
      <div
        className="structure-caption markdown-content"
        data-raw={conteudoSafe}
        dangerouslySetInnerHTML={{ __html: `${prefixo}${conteudoRaw}` }}
      />
    );
  };

  if (src) {
    // CENÁRIO A: IMAGEM EXISTE
    return (
      <div className="structure-block structure-image-wrapper">
        <img
          src={src}
          className="structure-img"
          onClick={() => window.expandirImagem?.(src!)}
          title={isReadOnly ? "Clique para ampliar" : undefined}
          style={isReadOnly ? { cursor: 'zoom-in' } : undefined}
          alt=""
        />
        {renderCaption(isReadOnly ? '' : 'IA: ')}

        {!isReadOnly && (
          <button
            className="btn-trocar-img js-captura-trigger"
            data-idx={imgIndex}
            data-ctx={contexto}
          >
            <span className="btn-ico">🔄</span><span>Trocar Imagem</span>
          </button>
        )}
      </div>
    );
  } else {
    // CENÁRIO B: IMAGEM FALTANDO
    if (isReadOnly) {
      return (
        <div className="structure-block" style={{ padding: '10px', border: '1px dashed #ccc', color: 'gray', fontSize: '11px', textAlign: 'center' }}>
          (Imagem não disponível)
        </div>
      );
    } else {
      return (
        <div
          className="structure-block structure-image-placeholder js-captura-trigger"
          data-idx={imgIndex}
          data-ctx={contexto}
        >
          <div className="icon">📷</div><strong>Adicionar Imagem Aqui</strong>
          {conteudoRaw && (
            <div
              className="markdown-content"
              data-raw={conteudoSafe}
              style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}
            >
              IA: {conteudoRaw}
            </div>
          )}
        </div>
      );
    }
  }
};

// --- COMPONENTE: ESTRUTURA PRINCIPAL (ORQUESTRADOR) ---
export const MainStructure: React.FC<{
  estrutura: EstruturaBloco[];
  imagensExternas: string[];
  contexto: string;
}> = ({ estrutura, imagensExternas, contexto }) => {
  if (!estrutura || !Array.isArray(estrutura) || estrutura.length === 0) {
    return null;
  }

  const isReadOnly = contexto === 'banco';
  let globalImgCounter = 0; // Contador mutável para simular o imgIndex++ condicional

  return (
    <div className="structure-container">
      {estrutura.map((bloco, idx) => {
        const tipo = (bloco?.tipo || 'imagem').toLowerCase();
        const conteudoRaw = bloco?.conteudo ? String(bloco.conteudo) : '';
        const conteudoSafe = sanitizeContent(conteudoRaw);

        if (tipo === 'imagem' || !tipo) {
          const currentImgIndex = globalImgCounter++;
          const src = bloco.imagem_base64 || bloco.imagem_url || bloco.url || imagensExternas?.[currentImgIndex];

          return (
            <ImageBlock
              key={idx}
              bloco={bloco}
              imgIndex={currentImgIndex}
              src={src}
              contexto={contexto}
              isReadOnly={isReadOnly}
              conteudoRaw={conteudoRaw}
              conteudoSafe={conteudoSafe}
            />
          );
        } else {
          return <StructureTextBlock key={idx} bloco={bloco} />;
        }
      })}
    </div>
  );
};

// --- COMPONENTE: BLOCO DE IMAGEM (ALTERNATIVA) ---
const AlternativeImageBlock: React.FC<{
  bloco: EstruturaBloco;
  letra: string;
  imgIndex: number;
  src: string | undefined;
  isReadOnly: boolean;
  conteudo: string;
  conteudoRawAttr: string;
  temConteudo: boolean;
}> = ({ bloco, letra, imgIndex, src, isReadOnly, conteudo, conteudoRawAttr, temConteudo }) => {

  if (src) {
    return (
      <div className="structure-block structure-image-wrapper">
        <img
          src={src}
          className="structure-img"
          onClick={() => window.expandirImagem?.(src!)}
          style={isReadOnly ? { cursor: 'zoom-in' } : undefined}
          alt=""
        />
        {temConteudo && (
          <div
            className="structure-caption markdown-content"
            data-raw={conteudoRawAttr}
            style={isReadOnly
              ? { fontSize: '0.9em', marginTop: '5px', color: '#555' }
              : { fontSize: '11px', marginTop: '4px', color: 'var(--color-text-secondary)' }
            }
          >
            {isReadOnly ? conteudo : `IA: ${conteudo}`}
          </div>
        )}
        {!isReadOnly && (
          <button
            className="btn-trocar-img"
            onClick={() => window.iniciar_captura_para_slot_alternativa?.(letra, imgIndex)}
          >
            <span className="btn-ico">🔄</span>
          </button>
        )}
      </div>
    );
  } else if (!isReadOnly) {
    return (
      <div
        className="structure-block structure-image-placeholder"
        onClick={() => window.iniciar_captura_para_slot_alternativa?.(letra, imgIndex)}
      >
        <div className="icon">📷</div>
        {temConteudo && (
          <div
            className="markdown-content"
            data-raw={conteudoRawAttr}
            style={{ fontSize: '10px', color: 'gray', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            IA: {conteudo}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// --- COMPONENTE: ESTRUTURA ALTERNATIVA (ORQUESTRADOR) ---
export const AlternativeStructure: React.FC<{
  estrutura: EstruturaBloco[];
  letra: string;
  imagensExternas: string[];
  contexto: string;
}> = ({ estrutura, letra, imagensExternas, contexto }) => {
  if (!Array.isArray(estrutura) || estrutura.length === 0) return null;

  const isReadOnly = contexto === 'banco';

  // Lógica de Fallback de imagens
  const imgsFallback = (imagensExternas && imagensExternas.length > 0)
    ? imagensExternas
    : (typeof window !== 'undefined' ? window.__imagensLimpas?.alternativas?.questao?.[letra] || [] : []);

  let globalImgCounter = 0;

  return (
    <div className="alt-estrutura">
      {estrutura.map((bloco, idx) => {
        const tipo = String(bloco?.tipo || 'texto').toLowerCase();

        if (tipo !== 'imagem' && tipo !== '') {
          return <StructureTextBlock key={idx} bloco={bloco} />;
        }

        // Tipo Complexo (Imagem)
        const currentImgIdx = globalImgCounter++;
        const src = bloco.imagem_base64 || bloco.imagem_url || imgsFallback[currentImgIdx];
        const conteudo = String(bloco?.conteudo || '');
        const conteudoRawAttr = conteudo.replace(/"/g, '&quot;');
        const temConteudo = !!(bloco?.conteudo && String(bloco.conteudo).trim().length > 0);

        return (
          <AlternativeImageBlock
            key={idx}
            bloco={bloco}
            letra={letra}
            imgIndex={currentImgIdx}
            src={src}
            isReadOnly={isReadOnly}
            conteudo={conteudo}
            conteudoRawAttr={conteudoRawAttr}
            temConteudo={temConteudo}
          />
        );
      })}
    </div>
  );
};

// --- FUNÇÕES DE EXPORTAÇÃO (ADAPTERS) ---
// Estas funções geram a string HTML final para serem usadas pelo JS legado.

export const generateHtmlString = (
  estrutura: EstruturaBloco[],
  imagensExternas: string[],
  contexto: string
): string => {
  return ReactDOMServer.renderToStaticMarkup(
    <MainStructure
      estrutura={estrutura}
      imagensExternas={imagensExternas}
      contexto={contexto}
    />
  );
};

export const generateAlternativeHtmlString = (
  estrutura: EstruturaBloco[],
  letra: string,
  imagensExternas: string[],
  contexto: string
): string => {
  return ReactDOMServer.renderToStaticMarkup(
    <AlternativeStructure
      estrutura={estrutura}
      letra={letra}
      imagensExternas={imagensExternas}
      contexto={contexto}
    />
  );
};

export const normalizeStructureBlock = (bloco: any) => {
  const rawTipo = bloco?.tipo ?? 'imagem';
  let tipo = String(rawTipo).toLowerCase().trim();

  // Importante: TIPOS_ESTRUTURA_VALIDOS deve ser verificado fora ou passado, 
  // mas aqui seguimos a lógica de fallback 'imagem' se desconhecido.
  // Como não temos acesso direto à constante do main.js aqui, assumimos a lógica local.
  // Se quiser importar, precisaria mover a constante para um arquivo de tipos compartilhado.
  // Vou assumir a lógica padrão: se não for texto/lista/etc conhecido, é imagem.

  const knownTypes = new Set(['texto', 'citacao', 'destaque', 'titulo', 'subtitulo', 'fonte', 'lista', 'equacao', 'codigo', 'separador']);
  if (!knownTypes.has(tipo) && tipo !== 'imagem') {
    tipo = 'imagem';
  }

  let conteudo = bloco?.conteudo ?? '';
  conteudo = String(conteudo);
  if (tipo === 'separador') conteudo = conteudo.trim();

  return { tipo, conteudo };
};

export const normalizeStructure = (estruturaLike: any[]) => {
  if (!Array.isArray(estruturaLike)) return [];
  return estruturaLike.map(normalizeStructureBlock);
};