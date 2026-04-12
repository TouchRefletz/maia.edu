import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { safeMarkdown } from '../normalize/primitives.js';

// --- DEFINIÇÃO DE TIPOS ---

export interface ChatContentBlock {
  tipo: string;
  conteudo?: string; // Conteúdo literal
  
  // Para layout_section
  layout?: ChatLayout;
  slots?: Record<string, ChatContentBlock[]>;
  
  props?: Record<string, any>;
}

export interface ChatLayout {
  id: string;
  params?: Record<string, any>;
}

export interface ChatResponse {
  sections?: ChatResponse[];
  layout?: ChatLayout;
  conteudo?: ChatContentBlock[]; // Legacy / Linear
  slots?: Record<string, ChatContentBlock[]>; // New structured
}

// --- HELPER DE SANITIZAÇÃO ---
const sanitizeContent = (content: string) => {
  return content
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// --- COMPONENTE: BLOCO DE CONTEÚDO (CHAT CONTENT BLOCK) ---
const ChatContentBlockRenderer: React.FC<{
  block: ChatContentBlock;
  className?: string;
}> = ({ block, className = '' }) => {
  const tipo = (block.tipo || 'texto').toLowerCase();

  // 1. Tratamento Especial para Layouts Aninhados
  if (tipo === 'layout_section') {
      if (!block.layout) return null;
      // Recursividade: Renderiza o layout aninhado usando o mesmo renderizador de Layout
      // Montamos um objeto "ChatResponse" fictício para passar para o componente
      const nestedResponse: ChatResponse = {
          layout: block.layout,
          slots: block.slots,
          // Se não tiver slots, mas tiver legacy content (improvável para layout_section mas possível)
          conteudo: [] 
      };
      
      return (
          <div className={`chat-block chat-layout-section ${className}`} style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
              <ChatLayoutRenderer data={nestedResponse} />
          </div>
      );
  }

  // 2. Conteúdo Literal Padrão
  const conteudoRaw = block.conteudo ? String(block.conteudo) : '';
  const conteudoSafe = sanitizeContent(conteudoRaw);

  const criarMarkdown = (classeExtra: string) => (
    <div
      className={`chat-block ${classeExtra} markdown-content ${className}`}
      data-raw={conteudoSafe}
      dangerouslySetInnerHTML={{ __html: safeMarkdown(conteudoRaw) }}
    />
  );

  switch (tipo) {
    case 'texto': return criarMarkdown('chat-text');
    case 'citacao': return criarMarkdown('chat-citacao');
    case 'destaque': return criarMarkdown('chat-destaque');
    case 'titulo': return criarMarkdown('chat-titulo');
    case 'subtitulo': return criarMarkdown('chat-subtitulo');
    case 'fonte': return criarMarkdown('chat-fonte');
    case 'tabela': return criarMarkdown('chat-tabela');
    case 'lista': return criarMarkdown('chat-lista');
    case 'equacao': return (
      <div className={`chat-block chat-equacao ${className}`}>{`\\[${conteudoRaw}\\]`}</div>
    );
    case 'codigo': 
      const langClass = block.props?.language ? `language-${block.props.language}` : '';
      return (
      <pre className={`chat-block chat-codigo ${className}`}>
        <code className={langClass}>{conteudoRaw}</code>
      </pre>
    );
    case 'separador': return <div className={`chat-block chat-separador ${className}`} />;
    case 'imagem':
      // Placeholder que será hidratado via JS (hydration.js)
      return (
        <div 
          className={`chat-block chat-dynamic-image-placeholder ${className}`}
          data-url={block.props?.url || ''}
          data-query={conteudoRaw}
          style={{
             padding: '20px',
             border: '1px dashed var(--color-border)',
             borderRadius: '8px',
             textAlign: 'center',
             color: 'var(--color-text-secondary)',
             margin: '10px 0'
          }}
        >
           <div className="chat-image-icon" style={{display:'block', marginBottom:'8px', fontSize:'1.2em'}}>🖼️</div>
           <div className="chat-image-desc markdown-content" style={{fontSize:'0.9em'}}>Buscando imagem: {conteudoSafe}...</div>
        </div>
      );
    case 'questao':
      // Placeholder que será hidratado pelo telas.js
      // Passamos a query e os filtros via dataset
      const filterData = {
          query: conteudoRaw,
          institution: block.props?.institution,
          year: block.props?.year,
          subject: block.props?.subject
      };
      
      return (
        <div 
            className={`chat-block chat-question-placeholder ${className}`}
            data-filter={JSON.stringify(filterData)}
        >
           <div className="q-placeholder-content" style={{
               padding: '20px',
               border: '1px dashed var(--color-border)',
               borderRadius: '8px',
               textAlign: 'center',
               color: 'var(--color-text-secondary)',
               margin: '10px 0'
           }}>
               <span style={{display:'block', marginBottom:'8px', fontSize:'1.2em'}}>🔍</span>
               <span>Buscando questão: {conteudoRaw}...</span>
           </div>
        </div>
      );
    case 'scaffolding':
      // Placeholder que será hidratado pelo telas.js (contém botões V/F e slider)
      return (
        <div 
            className={`chat-block chat-scaffolding-placeholder ${className}`}
            data-content={conteudoRaw} 
            data-props={JSON.stringify(block.props || {})}
        >
           <div className="scaffolding-skeleton" style={{
               padding: '24px',
               border: '1px solid var(--color-border)',
               borderRadius: '12px',
               background: 'var(--color-surface)',
               marginBottom: '16px'
           }}>
              <div style={{height:'24px', width:'60%', background:'var(--color-border)', borderRadius:'4px', marginBottom:'16px'}}></div>
              <div style={{display:'flex', gap:'12px'}}>
                  <div style={{height:'40px', flex:1, background:'var(--color-border)', borderRadius:'8px'}}></div>
                  <div style={{height:'40px', flex:1, background:'var(--color-border)', borderRadius:'8px'}}></div>
              </div>
           </div>
        </div>
      );
    default: return criarMarkdown('chat-unknown');
  }
};

// --- COMPONENTE: RENDERIZADOR DE LAYOUT (CHAT LAYOUT RENDERER) ---
const ChatLayoutRenderer: React.FC<{
  data: ChatResponse;
}> = ({ data }) => {
  if (!data || !data.layout) return null;
  
  const { layout, conteudo, slots } = data;
  const layoutId = layout.id || 'linear'; // Fallback para linear
  
  // 1. Caso Linear (Standard Chat)
  if (layoutId === 'linear' || (!slots && conteudo)) {
      // Se tiver 'slots' mas for linear, mapeia o slot 'content' se existir, ou fallback para conteudo
      const blocksToRender = (layoutId === 'linear' && slots?.content) 
          ? slots.content 
          : (conteudo || []);

      return (
        <div className={`chat-layout chat-layout--linear`}>
          {blocksToRender.map((block, idx) => (
            <ChatContentBlockRenderer key={idx} block={block} />
          ))}
        </div>
      );
  }

  // 2. Caso Layout Complexo (Slots)
  // Iteramos sobre os slots disponíveis no objeto `slots`
  // Nota: Poderíamos usar LAYOUT_SLOTS para ordenar, mas iterar chaves é mais flexível se o backend mandar slots opcionais
  const slotKeys = slots ? Object.keys(slots) : [];

  return (
    <div className={`chat-layout chat-layout--${layoutId}`}>
      {slotKeys.map((slotName) => (
          <div key={slotName} className={`slot-container slot-${slotName}`}>
              {slots?.[slotName]?.map((block, idx) => (
                  <ChatContentBlockRenderer key={idx} block={block} />
              ))}
          </div>
      ))}
    </div>
  );
};

// --- FUNÇÃO DE EXPORTAÇÃO ---
export const generateChatHtmlString = (data: ChatResponse | any): string => {
  // Suporte a múltiplas seções (Novo Schema)
  if (data?.sections && Array.isArray(data.sections)) {
      // Normalization fallback: se a seção não tiver layout, tratar como layout linear implícito
      const normalizedSections = data.sections.map((section: any) =>
        section.layout
          ? section
          : { layout: { id: "linear" }, conteudo: Array.isArray(section) ? section : [section] }
      );

      return ReactDOMServer.renderToStaticMarkup(
        <div className="chat-response-sections">
            {normalizedSections.map((section: ChatResponse, idx: number) => (
                <ChatLayoutRenderer key={idx} data={section} />
            ))}
        </div>
      );
  }

  // Se não tiver estrutura de layout, assume que é texto simples ou markdown direto
  if (!data?.layout && typeof data === 'string') {
      return safeMarkdown(data);
  }
  
  // Fallback para linear se layout não definido mas tem conteudo
  if (data && !data.layout && Array.isArray(data.conteudo)) {
      data.layout = { id: 'linear' };
  }

  return ReactDOMServer.renderToStaticMarkup(
    <ChatLayoutRenderer data={data} />
  );
};

