import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
  title: "maia.edu — Docs",
  description:
    "Documentação técnica exaustiva da plataforma educacional maia.edu",
  lang: "pt-BR",
  base: "/docs/",

  head: [
    ["link", { rel: "icon", type: "image/png", href: "/docs/logo.png" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "maia.edu, documentação, IA educacional, vestibular, ENEM, Gemini, PDF viewer",
      },
    ],
  ],

  themeConfig: {
    logo: "/logo.png",
    siteTitle: "maia.edu",

    nav: [
      { text: "Início", link: "/" },
      { text: "Guia", link: "/guia/introducao" },
      {
        text: "Sistemas",
        items: [
          { text: "Infraestrutura", link: "/infra/visao-geral" },
          { text: "API Worker", link: "/api-worker/arquitetura" },
          { text: "Motor de IA", link: "/chat/visao-geral" },
          { text: "PDF Viewer", link: "/pdf/core" },
          { text: "Cropper", link: "/cropper/visao-geral" },
          { text: "Banco de Questões", link: "/banco/visao-geral" },
        ],
      },
      {
        text: "Dados",
        items: [
          { text: "Memória", link: "/memoria/visao-geral" },
          { text: "Embeddings", link: "/embeddings/pipeline" },
          { text: "Normalização", link: "/normalizacao/primitives" },
          { text: "Firebase", link: "/firebase/init" },
        ],
      },
      {
        text: "Frontend",
        items: [
          { text: "Componentes", link: "/render/render-components" },
          { text: "UI", link: "/ui/scanner-ui" },
          { text: "CSS", link: "/css/design-tokens" },
        ],
      },
    ],

    // =========================================================================
    // SIDEBAR GLOBAL — Todas as seções visíveis em qualquer página
    // =========================================================================
    sidebar: [
      // SEÇÃO 0 — FUNDAÇÃO E VISÃO GERAL
      {
        text: "🏠 Fundação",
        collapsed: false,
        items: [
          { text: "Introdução e Missão", link: "/guia/introducao" },
          { text: "Arquitetura Geral", link: "/guia/arquitetura" },
          { text: "Começando (Setup)", link: "/guia/setup" },
          { text: "Glossário Técnico", link: "/guia/glossario" },
          { text: "Guia de Contribuição", link: "/guia/contribuicao" },
        ],
      },

      // SEÇÃO 1 — INFRAESTRUTURA, CI/CD E BUILD
      {
        text: "⚙️ Infraestrutura & CI/CD",
        collapsed: true,
        items: [
          { text: "Visão Geral CI/CD", link: "/infra/visao-geral" },
          { text: "deep-search.yml", link: "/infra/deep-search" },
          { text: "extract-questions.yml", link: "/infra/extract-questions" },
          { text: "hash-service.yml", link: "/infra/hash-service" },
          { text: "delete-artifact.yml", link: "/infra/delete-artifact" },
          { text: "manual-upload.yml", link: "/infra/manual-upload" },
          { text: "Scripts: extract_pipeline.py", link: "/infra/scripts-python" },
          { text: "Scripts: update_manifest.py", link: "/infra/scripts-manifest" },
          { text: "Configuração Vite", link: "/infra/vite-config" },
          { text: "TypeScript e Ambiente", link: "/infra/typescript-env" },
        ],
      },

      // SEÇÃO 2 — MAIA API WORKER
      {
        text: "☁️ API Worker (Cloudflare)",
        collapsed: true,
        items: [
          { text: "Arquitetura do Worker", link: "/api-worker/arquitetura" },
          { text: "Wrangler Config", link: "/api-worker/wrangler" },
          { text: "/generate (Gemini)", link: "/api-worker/generate" },
          { text: "/generate (Chat Mode)", link: "/api-worker/generate-chat" },
          { text: "/embed", link: "/api-worker/embed" },
          { text: "/search", link: "/api-worker/search" },
          { text: "/search-image", link: "/api-worker/search-image" },
          { text: "/upload-image", link: "/api-worker/upload-image" },
          { text: "/pinecone-upsert e /pinecone-query", link: "/api-worker/pinecone" },
          { text: "/trigger-deep-search", link: "/api-worker/deep-search" },
          { text: "/compute-hash", link: "/api-worker/compute-hash" },
          { text: "/proxy-pdf", link: "/api-worker/proxy-pdf" },
          { text: "/trigger-extraction e /extract-and-save", link: "/api-worker/extraction" },
          { text: "/manual-upload e /delete-artifact", link: "/api-worker/crud" },
          { text: "/canonical-slug", link: "/api-worker/canonical-slug" },
        ],
      },

      // SEÇÃO 3 — MOTOR DE IA E CHAT
      {
        text: "🧠 Motor de IA & Chat",
        collapsed: true,
        items: [
          { text: "Visão Geral do Chat", link: "/chat/visao-geral" },
          { text: "Chat Config", link: "/chat/config" },
          { text: "Chat Index", link: "/chat/index" },
          { text: "Router — Classificação", link: "/chat/router" },
          { text: "Router Prompt", link: "/chat/router-prompt" },
          { text: "Pipelines — Visão Geral", link: "/chat/pipelines-overview" },
          { text: "Pipeline Rápido", link: "/chat/pipeline-rapido" },
          { text: "Pipeline Raciocínio", link: "/chat/pipeline-raciocinio" },
          { text: "Pipeline Scaffolding", link: "/chat/pipeline-scaffolding" },
          { text: "System Prompts", link: "/chat/system-prompts" },
          { text: "Memory Prompts", link: "/chat/memory-prompts" },
          { text: "Schema — Layouts", link: "/chat/schemas-layouts" },
          { text: "Schema — Block Types", link: "/chat/schemas-blocks" },
          { text: "Scaffolding Service", link: "/chat/scaffolding-service" },
          { text: "Gap Detector", link: "/chat/gap-detector" },
          { text: "Metodologias Pedagógicas", link: "/chat/metodologias" },
          { text: "Chat Render (TSX/JS)", link: "/chat/render" },
          { text: "Hydration e Pós-processamento", link: "/chat/hydration" },
        ],
      },

      // SEÇÃO 4 — MEMÓRIA E COGNIÇÃO
      {
        text: "💾 Memória & Cognição",
        collapsed: true,
        items: [
          { text: "Visão Geral", link: "/memoria/visao-geral" },
          { text: "EntityDB — Local", link: "/memoria/entitydb" },
          { text: "Pinecone Cloud Sync", link: "/memoria/pinecone-sync" },
          { text: "Extração de Narrativa", link: "/memoria/extracao" },
          { text: "Sintetizador de Contexto", link: "/memoria/sintetizador" },
          { text: "Query Híbrida", link: "/memoria/query" },
          { text: "Cleanup e Expiração", link: "/memoria/cleanup" },
          { text: "Chat Storage", link: "/memoria/chat-storage" },
        ],
      },

      // SEÇÃO 5 — EMBEDDINGS
      {
        text: "🔢 Vetorização & Embeddings",
        collapsed: true,
        items: [
          { text: "Pipeline de Embedding", link: "/embeddings/pipeline" },
          { text: "Integração Pinecone", link: "/embeddings/pinecone" },
          { text: "Construção Semântica", link: "/embeddings/envio-textos" },
          { text: "Payload de Imagens", link: "/embeddings/payload-imagens" },
          { text: "Configuração de IA", link: "/embeddings/config-ia" },
          { text: "Transformers.js Config", link: "/embeddings/transformers" },
        ],
      },

      // SEÇÃO 6 — PDF VIEWER
      {
        text: "📄 Visualizador de PDF",
        collapsed: true,
        items: [
          { text: "Renderização Core", link: "/pdf/core" },
          { text: "Sistema de Eventos", link: "/pdf/eventos" },
          { text: "Zoom e Escala", link: "/pdf/zoom" },
          { text: "Contexto do Viewer", link: "/pdf/contexto" },
          { text: "Sidebar Desktop", link: "/pdf/sidebar-desktop" },
          { text: "Sidebar Cropper", link: "/pdf/sidebar-cropper" },
          { text: "Sidebar Mobile", link: "/pdf/sidebar-mobile" },
          { text: "Viewer Preview", link: "/pdf/preview" },
          { text: "Viewer Template", link: "/pdf/template" },
        ],
      },

      // SEÇÃO 7 — CROPPER
      {
        text: "✂️ Sistema de Cropping",
        collapsed: true,
        items: [
          { text: "Visão Geral", link: "/cropper/visao-geral" },
          { text: "Cropper Core", link: "/cropper/core" },
          { text: "Cropper State", link: "/cropper/state" },
          { text: "Máquina de Estados", link: "/cropper/mode" },
          { text: "Selection Overlay", link: "/cropper/overlay" },
          { text: "Slot Mode", link: "/cropper/slot-mode" },
          { text: "Gallery e JSON Loader", link: "/cropper/gallery-loader" },
          { text: "Save Handlers", link: "/cropper/save" },
        ],
      },

      // SEÇÃO 8 — NORMALIZAÇÃO
      {
        text: "🧹 Normalização de Dados",
        collapsed: true,
        items: [
          { text: "Primitives e Utilitários", link: "/normalizacao/primitives" },
          { text: "Payload Principal", link: "/normalizacao/payload" },
          { text: "Alternativas", link: "/normalizacao/alternativas" },
          { text: "Explicação e Passos", link: "/normalizacao/explicacao" },
          { text: "Créditos e Origens", link: "/normalizacao/creditos" },
          { text: "Data Normalizer", link: "/normalizacao/data-normalizer" },
        ],
      },

      // SEÇÃO 9 — UPLOAD E BATCH
      {
        text: "📤 Upload, Batch & Terminal",
        collapsed: true,
        items: [
          { text: "Batch — Arquitetura", link: "/upload/batch-arquitetura" },
          { text: "Batch — Image Slots", link: "/upload/batch-imagens" },
          { text: "Form Logic", link: "/upload/form-logic" },
          { text: "Drag and Drop", link: "/upload/drag-drop" },
          { text: "Terminal UI — Arquitetura", link: "/upload/terminal-ui" },
          { text: "Terminal UI — Chain of Thought", link: "/upload/terminal-chain" },
          { text: "Log Translator", link: "/upload/log-translator" },
          { text: "Upload Log Translator", link: "/upload/upload-log-translator" },
          { text: "Search Logic", link: "/upload/search-logic" },
        ],
      },

      // SEÇÃO 10 — OCR
      {
        text: "👁️ OCR & Visão Computacional",
        collapsed: true,
        items: [
          { text: "AI Scanner — Pipeline", link: "/ocr/scanner-pipeline" },
          { text: "AI Scanner — Prompts", link: "/ocr/scanner-prompts" },
          { text: "AI Image Extractor", link: "/ocr/image-extractor" },
          { text: "OCR Queue (Tesseract)", link: "/ocr/queue-service" },
          { text: "Métricas de Imagens", link: "/ocr/metricas-imagens" },
        ],
      },

      // SEÇÃO 11 — COMPONENTES DE RENDERIZAÇÃO
      {
        text: "🎨 Renderização",
        collapsed: true,
        items: [
          { text: "RenderComponents.tsx", link: "/render/render-components" },
          { text: "Controller de Questão", link: "/render/controller" },
          { text: "AlternativasRender", link: "/render/alternativas" },
          { text: "ComplexityCard", link: "/render/complexidade" },
          { text: "GabaritoCard", link: "/render/gabarito" },
          { text: "ImageSlotCard", link: "/render/image-slot" },
          { text: "QuestaoTabs", link: "/render/questao-tabs" },
          { text: "StructureRender", link: "/render/structure" },
          { text: "JsonReviewModal", link: "/render/json-modal" },
          { text: "OriginaisModal", link: "/render/originais-modal" },
          { text: "Hydration (hydration.js)", link: "/render/hydration" },
          { text: "MobileLayout e Review", link: "/render/mobile-review" },
        ],
      },

      // SEÇÃO 12 — BANCO DE QUESTÕES
      {
        text: "📚 Banco de Questões",
        collapsed: true,
        items: [
          { text: "Visão Geral", link: "/banco/visao-geral" },
          { text: "Bank Hydration", link: "/banco/hydration" },
          { text: "Card Template", link: "/banco/card-template" },
          { text: "Card Partes", link: "/banco/card-partes" },
          { text: "Filtros Dinâmicos", link: "/banco/filtros-dinamicos" },
          { text: "Filtros UI", link: "/banco/filtros-ui" },
          { text: "Interações", link: "/banco/interacoes" },
          { text: "Paginação", link: "/banco/paginacao" },
        ],
      },

      // SEÇÃO 13 — UI
      {
        text: "🖥️ Componentes de UI",
        collapsed: true,
        items: [
          { text: "Scanner UI", link: "/ui/scanner-ui" },
          { text: "Sidebar Tabs", link: "/ui/sidebar-tabs" },
          { text: "Sidebar Page Manager", link: "/ui/sidebar-pages" },
          { text: "Dynamic Suggestions", link: "/ui/sugestoes" },
          { text: "Suggestion Generator", link: "/ui/suggestion-generator" },
          { text: "ApiKeyModal", link: "/ui/api-key-modal" },
          { text: "Login Modal", link: "/ui/login-modal" },
          { text: "Scroll Sync", link: "/ui/scroll-sync" },
          { text: "PDF Renderers", link: "/ui/pdf-renderers" },
          { text: "Modais e Alertas", link: "/ui/modais" },
        ],
      },

      // SEÇÃO 14 — FIREBASE
      {
        text: "🔥 Firebase & Persistência",
        collapsed: true,
        items: [
          { text: "Inicialização (init.js)", link: "/firebase/init" },
          { text: "Transações (envio.js)", link: "/firebase/envio" },
          { text: "Estrutura RTDB", link: "/firebase/estrutura-rtdb" },
          { text: "Answer Checker", link: "/firebase/answer-checker" },
          { text: "Question Service", link: "/firebase/question-service" },
        ],
      },

      // SEÇÃO 15 — UTILITÁRIOS
      {
        text: "🔧 Utilitários & Workers",
        collapsed: true,
        items: [
          { text: "Worker Client (worker.js)", link: "/utils/worker-client" },
          { text: "Gabarito com Pesquisa", link: "/utils/gabarito-pesquisa" },
          { text: "JSON Stream Parser", link: "/utils/json-parser" },
          { text: "PDF Hashing", link: "/utils/pdf-hash" },
          { text: "Queue Utility", link: "/utils/queue" },
          { text: "File Utils e Pick", link: "/utils/file-utils" },
          { text: "Complexity Data", link: "/utils/complexity-data" },
        ],
      },

      // SEÇÃO 16 — CSS
      {
        text: "🎭 Arquitetura CSS",
        collapsed: true,
        items: [
          { text: "Design Tokens", link: "/css/design-tokens" },
          { text: "Primitives e Tipografia", link: "/css/primitives" },
          { text: "Animações", link: "/css/animacoes" },
          { text: "Componentes — Chat", link: "/css/comp-chat" },
          { text: "Componentes — Terminal", link: "/css/comp-terminal" },
          { text: "Componentes — Sidebar/Cropper", link: "/css/comp-sidebar" },
          { text: "Componentes — Modais", link: "/css/comp-modais" },
          { text: "PDF Viewer Styles", link: "/css/pdf-viewer" },
          { text: "Responsividade e Mobile", link: "/css/responsividade" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/maia-edu/maia.api" },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message:
        "🤖 Documentação gerada por IA — Reporte erros via GitHub Issues",
      copyright: "© 2024-2026 maia.edu — Todos os direitos reservados",
    },

    editLink: {
      pattern:
        "https://github.com/maia-edu/maia.api/edit/main/docs/:path",
      text: "Editar esta página no GitHub",
    },
  },

  // Mermaid configuration
  mermaid: {
    theme: 'dark',
    themeVariables: {
      primaryColor: '#7c3aed',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#8b5cf6',
      lineColor: '#8b5cf6',
      secondaryColor: '#1e1b4b',
      tertiaryColor: '#312e81',
    },
  },
  mermaidPlugin: {
    class: 'mermaid',
  },
}));
