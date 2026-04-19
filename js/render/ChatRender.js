import React from "react";
import ReactDOMServer from "react-dom/server";
import { safeMarkdown } from "../normalize/primitives.js";
import { resolveCssVarsInChart } from "./hydration.js";
// --- HELPER DE SANITIZAÇÃO ---
const sanitizeContent = (content) => {
  return content
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};
// --- COMPONENTE: BLOCO DE CONTEÚDO (CHAT CONTENT BLOCK) ---
const ChatContentBlockRenderer = ({ block, className = "" }) => {
  const tipo = (block.tipo || "texto").toLowerCase();
  // 1. Tratamento Especial para Layouts Aninhados
  if (tipo === "layout_section") {
    if (!block.layout) return null;
    // Recursividade: Renderiza o layout aninhado usando o mesmo renderizador de Layout
    // Montamos um objeto "ChatResponse" fictício para passar para o componente
    const nestedResponse = {
      layout: block.layout,
      slots: block.slots,
      // Se não tiver slots, mas tiver legacy content (improvável para layout_section mas possível)
      conteudo: [],
    };
    return React.createElement(
      "div",
      {
        className: `chat-block chat-layout-section ${className}`,
        style: {
          padding: 0,
          border: "none",
          background: "transparent",
          boxShadow: "none",
        },
      },
      React.createElement(ChatLayoutRenderer, { data: nestedResponse }),
    );
  }
  // 2. Conteúdo Literal Padrão
  const conteudoRaw = block.conteudo ? String(block.conteudo) : "";
  const conteudoSafe = sanitizeContent(conteudoRaw);
  const criarMarkdown = (classeExtra) => {
     // Aprimoramento: Resolve variáveis CSS no conteúdo Markdown também
     const conteudoProcessado = resolveCssVarsInChart(conteudoRaw);
     return React.createElement("div", {
       className: `chat-block ${classeExtra} markdown-content ${className}`,
       "data-raw": sanitizeContent(conteudoRaw),
       dangerouslySetInnerHTML: { __html: safeMarkdown(conteudoProcessado) },
     });

  };
  switch (tipo) {
    case "texto":
      return criarMarkdown("chat-text");
    case "citacao":
      return criarMarkdown("chat-citacao");
    case "destaque":
      return criarMarkdown("chat-destaque");
    case "titulo":
      return criarMarkdown("chat-titulo");
    case "subtitulo":
      return criarMarkdown("chat-subtitulo");
    case "fonte":
      return criarMarkdown("chat-fonte");
    case "tabela":
      return criarMarkdown("chat-tabela");
    case "lista":
      return criarMarkdown("chat-lista");
    case "equacao":
      return React.createElement(
        "div",
        { className: `chat-block chat-equacao ${className}` },
        `\\[${conteudoRaw}\\]`,
      );
    case "codigo":
      // Mermaid: render como placeholder para hidratação posterior
      if (block.props?.language === "mermaid") {
        return React.createElement("div", {
          className: `chat-block chat-mermaid-placeholder ${className}`,
          "data-chart": conteudoRaw,
          style: {
            padding: "20px",
            border: "1px dashed var(--color-border)",
            borderRadius: "12px",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            background: "rgba(var(--color-surface-rgb), 0.3)",
            margin: "10px 0",
            minHeight: "80px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }, "📊 Carregando diagrama...");
      }
      return React.createElement(
        "pre",
        { className: `chat-block chat-codigo ${className}` },
        React.createElement("code", { className: block.props?.language ? `language-${block.props.language}` : "" }, conteudoRaw),
      );
    case "separador":
      return React.createElement("div", {
        className: `chat-block chat-separador ${className}`,
      });
    case "imagem":
      // Placeholder que será hidratado via JS (hydration.js)
      return React.createElement(
        "div",
        {
          className: `chat-block chat-dynamic-image-placeholder ${className}`,
          "data-url": block.props?.url || "",
          "data-query": conteudoRaw,
          style: {
            padding: "20px",
            border: "1px dashed var(--color-border)",
            borderRadius: "8px",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            margin: "10px 0",
          },
        },
        React.createElement(
          "div",
          {
            className: "chat-image-icon",
            style: { display: "block", marginBottom: "8px", fontSize: "1.2em" },
          },
          "\uD83D\uDDBC\uFE0F",
        ),
        React.createElement(
          "div",
          {
            className: "chat-image-desc markdown-content",
            style: { fontSize: "0.9em" },
          },
          `Buscando imagem: ${conteudoSafe}...`,
        ),
      );
    case "questao":
      const filterData = {
        query: conteudoRaw,
        institution: block.props?.institution,
        year: block.props?.year,
        subject: block.props?.subject,
      };
      return React.createElement(
        "div",
        {
          className: `chat-block chat-question-placeholder ${className}`,
          "data-filter": JSON.stringify(filterData),
        },
        React.createElement(
          "div",
          {
            className: "q-placeholder-content",
            style: {
              padding: "20px",
              border: "1px dashed var(--color-border)",
              borderRadius: "8px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              margin: "10px 0",
            },
          },
          React.createElement(
            "span",
            {
              style: {
                display: "block",
                marginBottom: "8px",
                fontSize: "1.2em",
              },
            },
            "🔍",
          ),
          React.createElement(
            "span",
            null,
            `Buscando questão: ${conteudoRaw}...`,
          ),
        ),
      );
    case "scaffolding":
      // Combina props legados com os novos campos flat do schema
      const scaffoldingProps = {
        ...(block.props || {}),
        savedState: block.savedState,
        raciocinio_adaptativo: block.raciocinio_adaptativo,
        status: block.status,
        tipo_pergunta: block.tipo_pergunta,
        enunciado: block.enunciado,
        resposta_correta: block.resposta_correta,
        feedback_v: block.feedback_v,
        feedback_f: block.feedback_f,
        dica: block.dica,
      };

      // Placeholder que será hidratado pelo telas.js (contém botões V/F e slider)
      return React.createElement(
        "div",
        {
          className: `chat-block chat-scaffolding-placeholder ${className}`,
          "data-content": block.enunciado || conteudoRaw,
          "data-props": JSON.stringify(scaffoldingProps),
        },
        React.createElement(
          "div",
          {
            className: "scaffolding-skeleton",
            style: {
              padding: "24px",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              background: "var(--color-surface)",
              marginBottom: "16px",
            },
          },
          React.createElement("div", {
            style: {
              height: "24px",
              width: "60%",
              background: "var(--color-border)",
              borderRadius: "4px",
              marginBottom: "16px",
            },
          }),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "12px" } },
            React.createElement("div", {
              style: {
                height: "40px",
                flex: 1,
                background: "var(--color-border)",
                borderRadius: "8px",
              },
            }),
            React.createElement("div", {
              style: {
                height: "40px",
                flex: 1,
                background: "var(--color-border)",
                borderRadius: "8px",
              },
            }),
          ),
        ),
      );
    default:
      return criarMarkdown("chat-unknown");
  }
};
// --- COMPONENTE: RENDERIZADOR DE LAYOUT (CHAT LAYOUT RENDERER) ---
const ChatLayoutRenderer = ({ data }) => {
  if (!data || !data.layout) return null;
  const { layout, conteudo, slots } = data;
  const layoutId = layout.id || "linear"; // Fallback para linear
  // 1. Caso Linear (Standard Chat)
  if (layoutId === "linear" || (!slots && conteudo)) {
    // Se tiver 'slots' mas for linear, mapeia o slot 'content' se existir, ou fallback para conteudo
    const blocksToRender =
      layoutId === "linear" && slots?.content ? slots.content : conteudo || [];
    return React.createElement(
      "div",
      { className: `chat-layout chat-layout--linear` },
      blocksToRender.map((block, idx) =>
        React.createElement(ChatContentBlockRenderer, {
          key: idx,
          block: block,
        }),
      ),
    );
  }
  // 2. Caso Interactive Carousel (Layout Específico)
  if (layoutId === "interactive_carousel") {
    const slides = slots?.slides || [];
    return React.createElement(
      "div",
      { className: "carousel-root" },
      // Wrapper de Conteúdo (Slider + Botões) para centralização vertical correta
      React.createElement(
        "div",
        { className: "carousel-content-wrapper" },
        // Container Principal do Slider
        React.createElement(
          "div",
          { className: "carousel-slider-container" },
          React.createElement(
            "div",
            { className: "carousel-track" },
            slides.map((blockOrSlide, idx) => {
              // Normalização do conteúdo do slide
              let slideBlocks = [];
              if (
                blockOrSlide &&
                typeof blockOrSlide === "object" &&
                (Array.isArray(blockOrSlide.content) ||
                  Array.isArray(blockOrSlide.conteudo))
              ) {
                slideBlocks = blockOrSlide.content || blockOrSlide.conteudo;
              } else {
                // Se for um bloco solto, trata como slide único
                slideBlocks = [blockOrSlide];
              }

              return React.createElement(
                "div",
                { className: `carousel-slide slide-${idx}`, key: idx },
                slideBlocks.map((b, i) =>
                  React.createElement(ChatContentBlockRenderer, {
                    key: i,
                    block: b,
                  }),
                ),
              );
            }),
          ),
        ),
        // Controles de Navegação (Prev/Next) - Agora dentro do wrapper
        React.createElement(
          "button",
          { className: "carousel-prev", "aria-label": "Anterior" },
          React.createElement(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              width: "24",
              height: "24",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              className: "lucide lucide-chevron-left",
            },
            React.createElement("path", { d: "m15 18-6-6 6-6" }),
          ),
        ),
        React.createElement(
          "button",
          { className: "carousel-next", "aria-label": "Próximo" },
          React.createElement(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              width: "24",
              height: "24",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              className: "lucide lucide-chevron-right",
            },
            React.createElement("path", { d: "m9 18 6-6-6-6" }),
          ),
        ),
      ),
      // Dots de Paginação (Fora do Wrapper)
      React.createElement(
        "div",
        { className: "carousel-dots" },
        slides.map((_, idx) =>
          React.createElement("button", {
            key: idx,
            className: `carousel-dot`,
            "data-index": idx,
            "aria-label": `Ir para slide ${idx + 1}`,
          }),
        ),
      ),
    );
  }

  // 3. Caso Layout Complexo Genérico (Slots)
  // Iteramos sobre os slots disponíveis no objeto `slots`
  // Nota: Poderíamos usar LAYOUT_SLOTS para ordenar, mas iterar chaves é mais flexível se o backend mandar slots opcionais
  const slotKeys = slots ? Object.keys(slots) : [];
  return React.createElement(
    "div",
    { className: `chat-layout chat-layout--${layoutId}` },
    slotKeys.map((slotName) =>
      React.createElement(
        "div",
        { key: slotName, className: `slot-container slot-${slotName}` },
        slots?.[slotName]?.map((block, idx) =>
          React.createElement(ChatContentBlockRenderer, {
            key: idx,
            block: block,
          }),
        ),
      ),
    ),
  );
};
// --- COMPONENTE: RODAPÉ DE FONTES (SOURCES FOOTER) ---
// --- COMPONENTE: RODAPÉ DE FONTES (SOURCES FOOTER) ---
const SourcesFooter = ({ sources, report }) => {
  if (!sources || sources.length === 0) return null;

  return React.createElement(
    "div",
    { 
      className: "chat-sources-container",
      "data-sources": encodeURIComponent(JSON.stringify(sources)),
      "data-report": report ? encodeURIComponent(report) : ""
    },
    // Compact View (Favicons) - Only this is shown in the chat stream
    React.createElement(
      "div",
      { 
        className: "chat-sources-footer-compact",
        "data-onclick": "window.showSourcesModal(this)",
        "data-sources": encodeURIComponent(JSON.stringify(sources)),
        "data-report": report ? encodeURIComponent(report) : ""
      },
      React.createElement(
        "div",
        { className: "chat-sources-compact-inner" },
        React.createElement(
          "div",
          { className: "chat-sources-stacked-favicons" },
          sources.slice(0, 3).map((src, idx) => {
            const urlObj = src.uri ? new URL(src.uri) : { hostname: "Fonte externa" };
            const faviconUrl = src.uri ? `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico` : null;
            if (!faviconUrl) return null;
            return React.createElement("a", { 
              key: idx,
              href: src.uri, 
              target: "_blank",
              className: `chat-source-stacked-link stack-${idx}`,
              "data-onclick": "event.stopPropagation()",
              "title": src.title || urlObj.hostname
            }, React.createElement("img", { 
              src: faviconUrl, 
              className: "chat-source-stacked-icon", 
              alt: "",
              "data-onerror": `this.onerror=function(){this.parentElement.style.display='none'};this.src='https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64';`
            }));
          })
        ),
        React.createElement("span", { className: "chat-sources-label" }, `${sources.length} fontes pesquisadas`)
      )
    )
  );
};



// --- FUNÇÃO DE EXPORTAÇÃO ---
export const generateChatHtmlString = (data) => {
  // Se for apenas string, converte para objeto básico
  if (typeof data === "string") {
    data = { layout: { id: "linear" }, conteudo: [data] };
  }

  // Suporte a múltiplas seções (Novo Schema)
  if (data?.sections && Array.isArray(data.sections)) {
    const normalizedSections = data.sections.map((section) =>
      section.layout
        ? section
        : { layout: { id: "linear" }, conteudo: Array.isArray(section) ? section : [section] }
    );

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        "div",
        { className: "chat-response-sections" },
        normalizedSections.map((section, idx) =>
          React.createElement(ChatLayoutRenderer, { key: idx, data: section }),
        ),
        React.createElement(SourcesFooter, { 
          sources: data.sources || data.fontes_externas, 
          report: data.report || data.texto_referencia 
        })
      ),
    );

    return html
      .replace(/data-onclick="/g, 'onclick="')
      .replace(/data-onerror="/g, 'onerror="');
  }


  // Fallback para linear se layout não definido mas tem conteudo
  if (data && !data.layout && (Array.isArray(data.conteudo) || typeof data === "object")) {
     if (!data.layout) data.layout = { id: "linear" };
  }

  // Renderização Padrão (Linear ou Layout Único)
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      "div",
      { className: "chat-response-wrapper" },
      React.createElement(ChatLayoutRenderer, { data: data }),
      React.createElement(SourcesFooter, { 
        sources: data.sources || data.fontes_externas, 
        report: data.report || data.texto_referencia 
      })
    )
  );

  // Limpeza de atributos para silenciar avisos do React mas manter funcionalidade HTML
  return html
    .replace(/data-onclick="/g, 'onclick="')
    .replace(/data-onerror="/g, 'onerror="');
};

