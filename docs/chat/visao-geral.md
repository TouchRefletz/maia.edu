# Visão Geral do Chat

## Propósito

O sistema de chat do maia.edu é o módulo mais complexo da plataforma. Ele implementa um **tutor de IA personalizado** que combina:

- **Router inteligente** que classifica a complexidade de cada mensagem
- **3 pipelines de resposta** (rápido, raciocínio, scaffolding)
- **13 metodologias pedagógicas** selecionáveis
- **Sistema de memória** com extração de fatos atômicos
- **Rendering incremental** com suporte a LaTeX, Mermaid, código e imagens
- **Streaming em tempo real** via NDJSON

---

## Arquivos do Sistema de Chat

| Arquivo | Linhas | Propósito |
|---------|--------|----------|
| [`config.js`](/chat/config) | 112 | Configuração de modos, modelos, timeouts |
| [`index.js`](/chat/index) | ~500 | Ponto de entrada, inicialização, event listeners |
| [`router.js`](/chat/router) | ~300 | Classificação de complexidade |
| [`router-prompt.js`](/chat/router-prompt) | ~200 | Engenharia de prompt do router |
| [`pipelines.js`](/chat/pipelines-overview) | ~800 | Orquestração das 3 pipelines |
| [`chat-system-prompt.js`](/chat/system-prompts) | ~600 | System prompts por modo |
| [`memory-prompts.js`](/chat/memory-prompts) | ~200 | Prompts de extração de memória |
| [`schemas.js`](/chat/schemas-layouts) | ~400 | JSON schemas de resposta |
| [`ChatRender.tsx`](/chat/render) | ~900 | Renderização de blocos (TSX) |
| [`ChatRender.js`](/chat/render) | ~600 | Renderização de blocos (JS legacy) |
| `hydration.js` | ~680 | Pós-processamento (MathJax, Mermaid) |
| **Services:** | | |
| `scaffolding-service.js` | ~400 | Tutoria passo-a-passo |
| `gap-detector.js` | ~200 | Detecção de lacunas de conhecimento |
| `suggestion-generator.js` | ~300 | Geração de sugestões contextuais |

---

## Diagrama de Fluxo Completo

```mermaid
sequenceDiagram
    actor U as 👤 Estudante
    participant UI as 💬 Chat UI
    participant Cfg as ⚙️ Config
    participant R as 🔀 Router
    participant P as 📡 Pipeline
    participant Mem as 🧠 Memory
    participant W as ☁️ Worker
    participant G as 🤖 Gemini
    participant CR as 🎨 ChatRender
    participant H as 💧 Hydration

    Note over U,H: FASE 1: Preparação
    U->>UI: Envia mensagem
    UI->>Cfg: getModeConfig(currentMode)
    Cfg-->>UI: { model, usesRouter, ... }
    
    UI->>Mem: getContext(userId)
    Mem->>Mem: Query IndexedDB (local entities)
    Mem->>W: POST /pinecone-query (memory namespace)
    W-->>Mem: Cloud entities
    Mem-->>UI: Combined memory context string

    Note over U,H: FASE 2: Roteamento
    alt mode === 'automatico'
        UI->>R: routeMessage(userMessage)
        R->>R: buildRouterPrompt(message)
        R->>W: POST /generate (router, JSON mode)
        W->>G: classify complexity
        G-->>W: {"complexidade":"ALTA","justificativa":"..."}
        W-->>R: ALTA
        R->>Cfg: complexityToMode('ALTA')
        Cfg-->>R: 'raciocinio'
        R-->>UI: resolvedMode = 'raciocinio'
    else mode !== 'automatico'
        Note over UI: Use selected mode directly
    end

    Note over U,H: FASE 3: Geração Streaming
    UI->>P: executePipeline(resolvedMode, message, memory)
    P->>P: buildSystemPrompt(mode, methodology)
    P->>P: injectMemoryDirective(memory)
    P->>P: buildContents(history + message)
    
    P->>W: POST /generate (streaming, chatMode=true)
    W->>G: chats.create() + sendMessageStream()
    
    loop Streaming Chunks
        G-->>W: thought chunk
        W-->>P: {"type":"thought","text":"..."}
        P-->>CR: onThought(text)
        CR->>CR: Render thought bubble (expandable)

        G-->>W: answer chunk  
        W-->>P: {"type":"answer","text":"..."}
        P-->>P: accumulatedText += text
        P-->>P: parse(accumulatedText) → partial JSON
        P-->>CR: onAnswerDelta(partialJSON)
        CR->>CR: Incremental block rendering
    end

    Note over U,H: FASE 4: Pós-processamento
    P-->>UI: Final complete response  
    UI->>CR: renderFinalResponse(response)
    CR->>H: hydrate(container)
    H->>H: MathJax.typesetPromise()
    H->>H: mermaid.run({ nodes })
    H->>H: hljs.highlightAll()
    
    Note over U,H: FASE 5: Memória
    UI->>Mem: extractFacts(conversation)
    Mem->>W: POST /generate (extract atomic facts)
    W->>G: Extract facts from conversation
    G-->>W: ["O usuário tem dificuldade em...", ...]
    W-->>Mem: atomic facts
    Mem->>Mem: Store in IndexedDB
    Mem->>W: POST /pinecone-upsert (memory namespace)
```

---

## Modos de Operação

### Tabela de Modos

| Modo | ID | Label | Router | Modelo | Thinking | Temperatura |
|------|----|-------|--------|--------|----------|------------|
| 🤖 Automático | `automatico` | "Automático" | ✅ Sim | Depende do router | Depende | 1.0 |
| ⚡ Rápido | `rapido` | "Rápido" | ❌ Não | `gemini-3-flash-preview` | ❌ Não | 1.0 |
| 🧠 Raciocínio | `raciocinio` | "Raciocínio" | ❌ Não | `gemini-3-flash-preview` | ✅ Sim | 1.0 |
| 📐 Scaffolding | `scaffolding` | "Scaffolding (Beta)" | ❌ Não | `gemini-3-flash-preview` | ✅ Sim | 1.0 |

### Fluxo de Decisão do Modo Automático

```mermaid
flowchart TD
    Msg["💬 Mensagem do Usuário"]
    Router["🔀 Router<br/>Classifica complexidade"]
    
    Msg --> Router
    Router -->|"BAIXA<br/>(saudação, fácil, factual)"| Rapido["⚡ Pipeline Rápido<br/>Resposta ágil, sem thinking"]
    Router -->|"ALTA<br/>(cálculo, análise, conceitual)"| Raciocinio["🧠 Pipeline Raciocínio<br/>Thinking mode, resposta profunda"]
    Router -->|"SCAFFOLDING<br/>(pedido de tutoria, treino)"| Scaffolding["📐 Pipeline Scaffolding<br/>Verdadeiro/Falso passo-a-passo"]
```

---

## Sistema de Metodologias Pedagógicas

O chat suporta **13 metodologias pedagógicas** que alteram o system prompt:

| # | Metodologia | Descrição Resumida |
|---|-------------|-------------------|
| 1 | Aprendizagem Ativa | Provoca reflexão antes de dar respostas |
| 2 | Método Socrático | Responde com perguntas guiadoras |
| 3 | Ensino por Descoberta | Guia o estudante a descobrir por conta própria |
| 4 | Mapas Conceituais | Organiza conhecimento em redes de conceitos |
| 5 | Analogias e Metáforas | Explica usando comparações do cotidiano |
| 6 | Elaborative Interrogation | "Por quê?" profundo e iterativo |
| 7 | Dual Coding | Combina texto + diagramas visuais (Mermaid) |
| 8 | Interleaving | Alterna entre tópicos para fortalecer conexões |
| 9 | Retrieval Practice | Testa antes de ensinar |
| 10 | Spaced Repetition | Revisão espaçada |
| 11 | Feynman Technique | Explicar como se fosse para uma criança |
| 12 | PBL (Problem-Based Learning) | Aprender resolvendo problemas |
| 13 | Gamificação | Elementos de jogo no aprendizado |

### Seleção

- **Modo Automático**: O router analisa a mensagem e escolhe a metodologia mais adequada
- **Modo Manual**: O usuário seleciona via o menu "+" do chat input

### Badge Visual

Cada resposta exibe um badge com a metodologia utilizada:

```
[Badge: 🧠 Dual Coding] 
```

---

## Schema de Resposta JSON

Toda resposta do chat segue um JSON Schema rigoroso. O schema principal é:

```json
{
  "layout": "standard | question | scaffolding",
  "methodology": "dual_coding",
  "blocks": [
    { "type": "heading", "level": 2, "content": "..." },
    { "type": "text", "content": "..." },
    { "type": "equation", "content": "\\frac{-b \\pm ...}{2a}" },
    { "type": "code", "language": "python", "content": "..." },
    { "type": "mermaid", "content": "graph LR ..." },
    { "type": "list", "ordered": false, "items": ["..."] },
    { "type": "quote", "content": "..." },
    { "type": "image", "url": "...", "alt": "..." }
  ]
}
```

### Tipos de Bloco

```mermaid
graph LR
    subgraph "Blocos de Texto"
        T["text"] 
        H["heading<br/>level: 1-4"]
        Q["quote"]
    end

    subgraph "Blocos Estruturais"
        L["list<br/>ordered: bool"]
        TB["table<br/>headers + rows"]
    end

    subgraph "Blocos Visuais"
        C["code<br/>language: string"]
        E["equation<br/>LaTeX"]
        M["mermaid<br/>Diagrama"]
        I["image<br/>url + alt"]
    end
```

---

## Streaming e Rendering Incremental

O chat implementa **rendering incremental** — conforme os chunks de resposta chegam via NDJSON, o JSON parcial é parseado e os blocos são renderizados progressivamente:

```mermaid
sequenceDiagram
    participant Stream as NDJSON Stream
    participant Buffer as Accumulated Buffer
    participant Parser as best-effort-json-parser
    participant Render as ChatRender

    Stream->>Buffer: {"type":"answer","text":"{ \"lay"}
    Note over Buffer: buffer = "{ \"lay"
    Buffer->>Parser: parse("{ \"lay")
    Note over Parser: Too incomplete, skip

    Stream->>Buffer: {"type":"answer","text":"out\":\"standard\",\"blocks\":[{\"type\":\"text\""}
    Note over Buffer: buffer += ...
    Buffer->>Parser: parse(buffer)
    Parser-->>Render: { layout: "standard", blocks: [{ type: "text" }] }
    Render->>Render: Render 1 text block (empty)

    Stream->>Buffer: {"type":"answer","text":",\"content\":\"A resposta é..."}
    Buffer->>Parser: parse(buffer)
    Parser-->>Render: { blocks: [{ type: "text", content: "A resposta é..." }] }
    Render->>Render: Update text block content
```

**Decisão de design:** Usar `best-effort-json-parser` em vez de `JSON.parse` permite exibir conteúdo parcial mesmo quando o JSON está incompleto, minimizando o tempo percebido de espera pelo usuário.

---

## Integração com Memória

O chat integra-se com o [sistema de memória](/memoria/visao-geral) para personalização:

1. **Antes de cada mensagem**: O memory context é injetado no system prompt
2. **Após cada conversa**: Fatos atômicos são extraídos e armazenados
3. **Persistência dual**: IndexedDB (30min TTL) + Pinecone (permanente)

```javascript
// Exemplo de memory directive injetada no prompt
const memoryDirective = `
## Contexto do Estudante (Memória)
- O estudante está se preparando para o ENEM 2026
- Tem dificuldade com logaritmos e funções exponenciais
- Prefere explicações com exemplos numéricos
- Estudou recentemente cinemática (MRU e MRUV)
`;
```

---

## Referências Cruzadas

| Tópico | Página |
|--------|--------|
| Configuração detalhada | [Chat Config](/chat/config) |
| Classificação do Router | [Router](/chat/router) |
| Prompt do Router | [Router Prompt](/chat/router-prompt) |
| Pipelines de resposta | [Pipelines](/chat/pipelines-overview) |
| System Prompts | [System Prompts](/chat/system-prompts) |
| Schemas JSON | [Schemas — Layouts](/chat/schemas-layouts) |
| Renderização | [Chat Render](/chat/render) |
| Hydration | [Hydration](/chat/hydration) |
| Scaffolding | [Scaffolding Service](/chat/scaffolding-service) |
| Memória | [Visão Geral da Memória](/memoria/visao-geral) |
| Worker endpoint | [/generate (Chat Mode)](/api-worker/generate-chat) |
