# Arquitetura Geral do maia.edu

## Visão Macro

O maia.edu é uma plataforma de arquitetura distribuída que combina processamento no cliente (browser), computação no edge (Cloudflare Workers) e serviços de IA na nuvem (Google Gemini, Pinecone). Este documento detalha **cada camada, suas responsabilidades, e como os dados fluem entre elas**.

---

## Diagrama de Arquitetura Completa

```mermaid
graph TB
    subgraph "CAMADA 1: Cliente (Browser)"
        direction TB
        HTML["📄 index.html<br/>Entry Point"]
        Vite["⚡ Vite Dev Server<br/>HMR + Build"]
        
        subgraph "Módulos JS"
            direction LR
            Main["main.js<br/>Estado Global"]
            ChatMod["js/chat/<br/>Sistema de Chat"]
            ViewerMod["js/viewer/<br/>PDF Viewer"]
            CropperMod["js/cropper/<br/>Cropper"]
            BancoMod["js/banco/<br/>Banco de Questões"]
            RenderMod["js/render/<br/>Componentes"]
            UIMod["js/ui/<br/>UI Components"]
            ServicesMod["js/services/<br/>Serviços Core"]
            UploadMod["js/upload/<br/>Upload/Batch"]
            NormalizeMod["js/normalize/<br/>Normalização"]
        end

        subgraph "Persistência Local"
            IDB["💾 IndexedDB<br/>Conversas + Memória"]
            LS["📦 localStorage<br/>Banco de Questões"]
            SS["🔑 sessionStorage<br/>API Key"]
        end
    end

    subgraph "CAMADA 2: Edge (Cloudflare)"
        Worker["☁️ Maia API Worker<br/>maia-api-worker/src/index.js"]
        D1["📊 D1 Database<br/>(Reservado)"]
        R2["📁 R2 Storage<br/>(Reservado)"]
    end

    subgraph "CAMADA 3: IA & Serviços"
        Gemini["🤖 Google Gemini API<br/>gemini-3-flash-preview"]
        GSearch["🔍 Google Custom Search<br/>Imagens + Grounding"]
        Pinecone1["📊 Pinecone: Deep Search"]
        Pinecone2["📊 Pinecone: Filter"]
        Pinecone3["📊 Pinecone: Memory"]
        Pinecone4["📊 Pinecone: Default"]
    end

    subgraph "CAMADA 4: Persistência Cloud"
        RTDB["🔥 Firebase RTDB<br/>Questões + Gabaritos"]
        Auth["🔐 Firebase Auth<br/>Google Sign-In"]
        Firestore["📝 Firestore<br/>Conversas do Chat"]
        ImgBB["🖼️ ImgBB<br/>CDN de Imagens"]
    end

    subgraph "CAMADA 5: CI/CD"
        Actions["⚙️ GitHub Actions<br/>5 Workflows"]
        PyScripts["🐍 Python Scripts<br/>extract_pipeline.py"]
    end

    %% Conexões
    HTML --> Vite
    Vite --> Main
    Main --> ChatMod & ViewerMod & BancoMod

    ChatMod --> Worker
    ServicesMod --> Worker
    UploadMod --> Worker

    ChatMod --> IDB
    BancoMod --> LS
    ChatMod --> SS

    Worker --> Gemini
    Worker --> GSearch
    Worker --> Pinecone1 & Pinecone2 & Pinecone3 & Pinecone4
    Worker --> RTDB
    Worker --> ImgBB
    Worker --> Actions

    ChatMod --> Firestore
    ChatMod --> Auth

    Actions --> PyScripts
    PyScripts --> Pinecone1
    PyScripts --> RTDB

    ViewerMod --> CropperMod
    CropperMod --> ServicesMod
    ServicesMod --> RenderMod
    RenderMod --> NormalizeMod
```

---

## Camada 1: Cliente (Browser)

### Estado Global (`main.js`)

O ponto de entrada da aplicação é o `main.js`, que inicializa e exporta dois objetos de estado global:

```javascript
// Estado do Viewer
export const viewerState = {
  pdfDoc: null,       // Instância do pdfjs-dist
  pageNum: 1,         // Página atual
  pdfScale: 1.0,      // Zoom atual
};

// Estado do Banco de Questões
export const bancoState = {
  todasQuestoesCache: [], // Cache local de todas as questões
};
```

**Decisão de design:** O maia.edu usa estado global simples em vez de um state manager como Redux ou Zustand. Isso foi escolhido porque:
- A maioria dos módulos é Vanilla JS (não React)
- O estado é relativamente plano e previsível
- Os módulos comunicam-se via `CustomEvent` do DOM

### Estratégia de Módulos

O projeto usa uma estratégia **híbrida** de módulos:

| Padrão | Usado Em | Razão |
|--------|---------|-------|
| **ES Modules (import/export)** | Todos os módulos JS | Padrão moderno, tree-shaking |
| **TSX/React** | Componentes complexos de render | JSX para UI declarativa |
| **Vanilla JS + DOM** | UI simples, viewers, cropper | Performance, controle direto |
| **Classes ES6** | Serviços (TerminalUI, AiScanner, BatchProcessor) | Encapsulamento de estado |
| **Funções puras** | Normalização, utils | Testabilidade, composição |

### Comunicação Entre Módulos

Os módulos se comunicam por três mecanismos:

```mermaid
flowchart LR
    subgraph "1. Import Direto"
        A["Módulo A"] -->|import| B["Módulo B"]
    end

    subgraph "2. Custom Events"
        C["Módulo C"] -->|dispatchEvent| DOM["document"]
        DOM -->|addEventListener| D["Módulo D"]
    end

    subgraph "3. Estado Global"
        E["Módulo E"] -->|window.__var| F["Módulo F"]
    end
```

**Eventos customizados importantes:**

| Evento | Emissor | Consumidor | Dados |
|--------|---------|-----------|-------|
| `maia:pagechanged` | `pdf-core.js` | `sidebar-cropper.js` | `{ pageNum }` |
| `maia:cropstatechanged` | `cropper-state.js` | `selection-overlay.js` | — |
| `maia:questionextracted` | `batch-processor.js` | `render-components.js` | `{ dados }` |

### Persistência Local

```mermaid
flowchart TB
    subgraph "IndexedDB"
        ChatDB["maia-chat-storage<br/>Conversations"]
        MemDB["maia-memory-entities<br/>User Facts"]
    end

    subgraph "localStorage"
        BankLS["todasQuestoesCache<br/>Question Bank"]
        SettingsLS["user-preferences<br/>Settings"]
    end

    subgraph "sessionStorage"
        ApiKey["GOOGLE_GENAI_API_KEY<br/>Custom API Key"]
    end

    ChatDB -->|"TTL: 30min"| Firestore["☁️ Firestore"]
    MemDB -->|"TTL: 30min"| Pinecone["☁️ Pinecone Memory"]
    BankLS -->|"Manual sync"| Firebase["☁️ Firebase RTDB"]
```

**Política de expiração:**
- IndexedDB: dados expiram após **30 minutos** de inatividade
- Antes de expirar, dados são **sincronizados para a nuvem** (se usuário autenticado)
- localStorage: sem expiração automática (manual via UI)
- sessionStorage: limpo ao fechar a aba

---

## Camada 2: Edge Computing (Cloudflare Workers)

### Modelo de Execução

O Maia API Worker é um Cloudflare Worker que roda em **edge locations globais**. Cada request é processado na location mais próxima do usuário.

```mermaid
sequenceDiagram
    participant Browser
    participant Edge as Cloudflare Edge
    participant Gemini as Google Gemini
    participant Pine as Pinecone
    participant Fire as Firebase

    Browser->>Edge: POST /generate
    Note over Edge: CORS Headers Applied
    Note over Edge: API Key Resolution
    Edge->>Gemini: generateContentStream()
    loop Streaming
        Gemini-->>Edge: chunk (thought/answer)
        Edge-->>Browser: NDJSON line
    end
    
    Browser->>Edge: POST /pinecone-upsert
    Edge->>Pine: vectors/upsert
    Pine-->>Edge: { upsertedCount }
    Edge-->>Browser: success

    Browser->>Edge: POST /trigger-deep-search
    Note over Edge: Phase 1: Direct Query
    Edge->>Pine: vectors/query
    alt Resultados encontrados
        Edge-->>Browser: cached results
    else Sem resultados
        Note over Edge: Phase 2: GitHub Action
        Edge->>Fire: workflow_dispatch
        Edge-->>Browser: { jobUrl, runId }
    end
```

### Roteamento

O Worker usa um **roteamento manual** baseado em `URL.pathname`:

```javascript
// Simplificado do código real
const url = new URL(request.url);

switch (url.pathname) {
  case '/generate':     return handleGeminiGenerate(request, env);
  case '/embed':        return handleEmbed(request, env);
  case '/search':       return handleSearch(request, env);
  case '/search-image': return handleSearchImage(request, env);
  // ... 15+ endpoints
}
```

### CORS Strategy

O Worker implementa CORS permissivo para desenvolvimento:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

> ⚠️ **Nota de segurança:** Em produção, o `Allow-Origin` deveria ser restrito ao domínio do app.

### Safety Settings (Gemini)

Todos os requests ao Gemini usam safety settings **desabilitadas** para evitar bloqueios em conteúdo educacional:

```javascript
const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];
```

**Justificativa:** Conteúdo educacional (biologia, história, literatura) frequentemente aciona filtros de segurança indevidamente.

---

## Camada 3: IA & Serviços Externos

### Google Gemini — Modelo Principal

O maia.edu utiliza o modelo `gemini-3-flash-preview` como modelo principal, com fallbacks automáticos:

```mermaid
flowchart TD
    Request["📨 Request"]
    M1["gemini-3-flash-preview"]
    M2["gemini-flash-latest"]
    M3["gemini-flash-lite-latest"]
    Success["✅ Response"]
    Fail["❌ ALL_MODELS_FAILED"]

    Request --> M1
    M1 -->|Success| Success
    M1 -->|RECITATION/429/503| M2
    M2 -->|Success| Success
    M2 -->|RECITATION/429/503| M3
    M3 -->|Success| Success
    M3 -->|Fail| Fail
```

**Modos de uso do Gemini:**

| Modo | Parâmetros | Uso |
|------|-----------|-----|
| **JSON Generation** | `responseMimeType: 'application/json'`, `responseJsonSchema` | Extração de questões, classificação |
| **Streaming** | `generateContentStream()` | Chat, gabarito, pesquisa |
| **Chat Multi-Turn** | `client.chats.create()` + `sendMessageStream()` | Conversas do chat |
| **Thinking Mode** | `thinkingConfig: { includeThoughts: true }` | Raciocínio e scaffolding |
| **Vision** | `inlineData: { mimeType, data }` | Scanner, extração de imagens |
| **Search Grounding** | `googleSearch` tool | Pesquisa de resoluções |

### Pinecone — Arquitetura Multi-Index

```mermaid
graph LR
    subgraph "Indexes Pinecone"
        DS["🔍 Deep Search<br/>Questões pesquisadas"]
        FI["🏷️ Filter<br/>Normalização"]
        MEM["🧠 Memory<br/>Fatos do usuário"]
        DEF["📊 Default<br/>Fallback"]
    end

    subgraph "Fontes de Dados"
        Scanner["AI Scanner"] -->|upsert| DS
        ManualUpload["Manual Upload"] -->|upsert| DS
        GHActions["GitHub Actions"] -->|upsert| DS
        DataNorm["Data Normalizer"] -->|upsert| FI
        MemService["Memory Service"] -->|upsert| MEM
    end

    subgraph "Consumidores"
        DS --> DeepSearchQuery["Deep Search Query"]
        FI --> NormQuery["Term Expansion"]
        MEM --> MemQuery["User Context"]
        DEF --> FallbackQuery["Fallback Query"]
    end
```

---

## Camada 4: Persistência Cloud

### Firebase Realtime Database — Schema

```mermaid
graph TB
    Root["firebase-rtdb/"]
    Root --> Questoes["questoes/"]
    Root --> Gabaritos["gabaritos/"]
    Root --> Users["users/"]
    Root --> Metadata["metadata/"]

    Questoes --> Q1["<questao_id>/"]
    Q1 --> QDados["dados_questao: {...}"]
    Q1 --> QGab["dados_gabarito: {...}"]
    Q1 --> QImg["imagens: {...}"]
    Q1 --> QMeta["meta: {...}"]

    Users --> U1["<user_id>/"]
    U1 --> UPrefs["preferences: {...}"]
    U1 --> UHistory["history: [...]"]
```

### Firestore — Schema de Conversas

```
firestore/
├── users/
│   └── <userId>/
│       └── conversations/
│           └── <conversationId>/
│               ├── title: string
│               ├── createdAt: timestamp
│               ├── updatedAt: timestamp
│               └── messages/
│                   └── <messageId>/
│                       ├── role: 'user' | 'model'
│                       ├── content: string (JSON)
│                       ├── timestamp: timestamp
│                       └── metadata: { mode, methodology }
```

---

## Camada 5: CI/CD

### Pipeline de Workflows

```mermaid
flowchart TB
    subgraph "Triggers"
        Manual["🖱️ Manual (workflow_dispatch)"]
        API["☁️ API (repository_dispatch)"]
        Push["📤 Push to main"]
    end

    subgraph "Workflows"
        DS["deep-search.yml<br/>Pesquisa profunda"]
        EQ["extract-questions.yml<br/>Extração de questões"]
        HS["hash-service.yml<br/>Hash visual"]
        DA["delete-artifact.yml<br/>Deleção de artefatos"]
        MU["manual-upload.yml<br/>Upload manual"]
    end

    subgraph "Outputs"
        PineconeOut["📊 Pinecone Upsert"]
        FirebaseOut["🔥 Firebase Write"]
        ArtifactOut["📦 GitHub Artifacts"]
    end

    Manual --> DS & EQ & HS & DA & MU
    API --> DS & EQ
    
    DS --> PineconeOut & FirebaseOut
    EQ --> PineconeOut & FirebaseOut & ArtifactOut
    HS --> ArtifactOut
    DA --> PineconeOut & FirebaseOut
    MU --> PineconeOut & FirebaseOut
```

---

## Padrões Arquiteturais Recorrentes

### 1. NDJSON Streaming

Todas as comunicações de longa duração entre Worker e Browser usam **Newline-Delimited JSON** (NDJSON):

```
{"type":"status","text":"Conectando..."}
{"type":"thought","text":"Analisando a questão..."}
{"type":"answer","text":"A resposta é..."}
{"type":"answer","text":" letra B porque..."}
{"type":"grounding","metadata":{...}}
```

**Tipos de mensagem:**

| Tipo | Direção | Propósito |
|------|---------|----------|
| `status` | Worker → Browser | Atualização de progresso |
| `thought` | Worker → Browser | Pensamento do modelo (thinking mode) |
| `answer` | Worker → Browser | Delta de resposta (acumulativo) |
| `debug` | Worker → Browser | Log de debug |
| `error` | Worker → Browser | Erro com código |
| `reset` | Worker → Browser | Reset de buffer (recitation retry) |
| `grounding` | Worker → Browser | Metadados de pesquisa |
| `meta` | Worker → Browser | Informações sobre tentativa (model, attempt) |

### 2. Reactive State via Subscribe

O `CropperState` implementa um padrão observer simples:

```javascript
class CropperState {
  static #listeners = [];
  
  static subscribe(callback) {
    this.#listeners.push(callback);
    return () => {
      this.#listeners = this.#listeners.filter(l => l !== callback);
    };
  }
  
  static #notify() {
    this.#listeners.forEach(l => l());
  }
}
```

### 3. Best-Effort JSON Parsing

```javascript
import { parse } from 'best-effort-json-parser';

// Mesmo com JSON incompleto, retorna o máximo possível
const partial = parse('{"blocks":[{"type":"text","content":"Hello');
// → { blocks: [{ type: "text", content: "Hello" }] }
```

### 4. Double Buffering (PDF)

```mermaid
sequenceDiagram
    participant User as Usuário Vê
    participant Old as Canvas Antigo
    participant New as Canvas Novo (Memória)
    participant PDF as PDF.js

    Note over User,Old: Usuário vê canvas antigo (zoom anterior)
    PDF->>New: render() em memória
    Note over New: Renderização completa
    New->>Old: replaceChild() (swap atômico)
    Note over User: Transição instantânea, sem tela branca
```

### 5. Constraint-Based Editing (Cropper)

O sistema de cropping implementa **edição baseada em constraints**:

```mermaid
stateDiagram-v2
    [*] --> Viewing: Sem grupo ativo

    Viewing --> Editing: setActiveGroup()
    Editing --> Creating: pointerdown (empty area)
    Editing --> Moving: pointerdown (on box)
    Editing --> Resizing: pointerdown (on handle)
    Creating --> Editing: pointerup (save crop)
    Moving --> Editing: pointerup (save position)
    Resizing --> Editing: pointerup (save size)
    Editing --> Viewing: clearActiveGroup()

    state Editing {
        [*] --> PageConstrained
        PageConstrained --> ParentConstrained: slot-mode
        note right of ParentConstrained
            Em slot-mode, crops são
            limitados à área do crop pai
        end note
    }
```

---

## Fluxos de Dados Críticos

### Fluxo 1: Upload de PDF → Banco de Questões

```mermaid
sequenceDiagram
    actor User as Usuário
    participant V as PDF Viewer
    participant S as AI Scanner
    participant W as Worker
    participant G as Gemini
    participant B as Batch Processor
    participant N as Normalizer
    participant F as Firebase
    participant P as Pinecone

    User->>V: Upload PDF
    V->>V: carregarDocumentoPDF()
    V->>V: renderAllPages() + LazyLoad

    User->>S: Iniciar Scanner
    loop Para cada página
        S->>V: renderPageHighRes(pageNum)
        V-->>S: imageBase64 (300 DPI)
        S->>W: POST /generate (vision)
        W->>G: Detect questions (GREEDY BOX)
        G-->>W: { regions: [...] }
        W-->>S: Bounding boxes

        S->>S: Apply draft crops (gray)
        
        S->>W: POST /generate (review)
        W->>G: Audit bounding boxes
        G-->>W: { ok: true/false }
        
        alt Aprovado
            S->>S: Apply verified crops (green)
        else Reprovado
            S->>W: POST /generate (correction)
            W->>G: Fix bounding boxes
            G-->>W: Corrected regions
            S->>S: Apply corrected crops
        end
    end

    S->>B: BatchProcessor.start()
    loop Para cada questão
        B->>W: POST /generate (extract text)
        W->>G: Extract question data
        G-->>W: { estrutura, alternativas, ... }
        W-->>B: Question JSON
        
        B->>N: normalizePayload()
        N-->>B: Normalized question
        
        B->>W: POST /upload-image
        W->>ImgBB: Upload crop image
        ImgBB-->>W: image URL
        W-->>B: URL

        B->>F: firebase.set(questao)
        B->>P: pinecone.upsert(embedding)
    end
```

### Fluxo 2: Mensagem no Chat → Resposta Renderizada

```mermaid
sequenceDiagram
    actor User as Estudante
    participant UI as Chat UI
    participant R as Router
    participant P as Pipeline
    participant M as Memory Service
    participant W as Worker
    participant G as Gemini
    participant CR as Chat Render
    participant H as Hydration

    User->>UI: Envia mensagem
    UI->>M: getContext(userId)
    M->>M: Query IndexedDB (local)
    M->>M: Query Pinecone (cloud)
    M-->>UI: memoryContext

    UI->>R: routeMessage(msg, mode)
    
    alt mode === 'automatico'
        R->>W: POST /generate (router prompt)
        W->>G: Classify complexity
        G-->>W: { complexidade: 'ALTA' }
        W-->>R: mode = 'raciocinio'
    end

    R->>P: executePipeline(mode, msg, memory)
    P->>P: Build system prompt + memory injection
    P->>W: POST /generate (streaming, chatMode)
    
    loop Streaming
        W->>G: generateContentStream()
        G-->>W: thought chunk
        W-->>P: {"type":"thought","text":"..."}
        P-->>CR: onThought(text)
        CR->>CR: Render thought bubble

        G-->>W: answer chunk
        W-->>P: {"type":"answer","text":"..."}
        P-->>CR: onAnswerDelta(text)
        CR->>CR: Incremental JSON parse
        CR->>CR: Render blocks (text, code, etc.)
    end

    P-->>UI: Final JSON response
    UI->>CR: renderFinalResponse()
    CR->>H: hydrate()
    H->>H: MathJax.typeset()
    H->>H: mermaid.run()
    H->>H: hljs.highlightAll()

    UI->>M: extractFacts(response)
    M->>M: Store in IndexedDB
    M->>W: POST /pinecone-upsert (memory)
```

---

## Decisões Arquiteturais Notáveis

### Por que Cloudflare Workers em vez de um backend tradicional?

1. **Latência global**: Workers rodam em 300+ edge locations
2. **Custo**: Modelo pay-per-request (sem servidor idle)
3. **Simplicidade**: Um único arquivo JS para toda a API
4. **Segurança**: API keys ficam no edge, nunca no browser

### Por que não usar um framework frontend (Next.js, SvelteKit)?

1. **Progressividade**: O projeto cresceu organicamente de um protótipo HTML
2. **Performance**: Vanilla JS é mais rápido que frameworks para este caso de uso
3. **Controle**: Renderização de PDF e cropping exigem controle total do DOM
4. **Híbrido TSX**: Componentes complexos usam TSX/React onde faz sentido

### Por que 4 indexes Pinecone separados?

1. **Isolamento de dados**: Memória do usuário não se mistura com questões
2. **Escalabilidade**: Cada index pode crescer independentemente
3. **Custos**: Indexes menores são mais baratos de consultar
4. **Semântica**: Cada index tem metadata schemas diferentes

---

## Referências Cruzadas

| Para Saber Mais Sobre... | Veja... |
|--------------------------|---------|
| Endpoints da API | [API Worker: Arquitetura](/api-worker/arquitetura) |
| Sistema de Chat completo | [Motor de IA: Visão Geral](/chat/visao-geral) |
| Renderização de PDF | [PDF Viewer: Core](/pdf/core) |
| Sistema de Cropping | [Cropper: Visão Geral](/cropper/visao-geral) |
| Normalização de dados | [Normalização: Primitives](/normalizacao/primitives) |
| CI/CD completo | [Infraestrutura: Visão Geral](/infra/visao-geral) |
| Design System CSS | [CSS: Design Tokens](/css/design-tokens) |
