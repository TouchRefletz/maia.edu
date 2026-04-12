# Visão Geral do Cropper

## Arquivo-Fonte

| Arquivo | Linhas | Tamanho | Propósito |
|---------|--------|---------|----------|
| [`cropper-core.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/cropper-core.js) | ~150 | 4.1 KB | Init, destroy, API pública |
| [`cropper-state.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/cropper-state.js) | ~400 | 11.8 KB | Store reativo, undo/redo |
| [`mode.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/mode.js) | ~700 | 22.9 KB | Máquina de estados completa |
| [`selection-overlay.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/selection-overlay.js) | ~1500 | 44.6 KB | SVG overlay, pointer events |
| [`gallery.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/gallery.js) | ~50 | 1.3 KB | Galeria de crops |
| [`json-loader.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/json-loader.js) | ~250 | 7 KB | Import/export JSON |
| [`save-handlers.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/cropper/save-handlers.js) | ~400 | 12.8 KB | Extração de crops em alta resolução |
| **Total** | **~3450** | **~104 KB** | |

---

## Propósito

O sistema de cropping é a ferramenta que permite ao usuário **selecionar regiões de interesse** em páginas de PDF. Essas regiões (crops) representam questões de prova que serão:

1. **Recortadas** em alta resolução (300 DPI)
2. **Enviadas ao Gemini** para extração de texto e alternativas
3. **Catalogadas** no banco de questões (Firebase + Pinecone)

---

## Organização Conceitual

### Hierarquia de Dados

```mermaid
graph TB
    AllGroups["CropperState<br/>Map de Grupos"]
    
    AllGroups --> G1["Grupo 1<br/>(Questão 1)"]
    AllGroups --> G2["Grupo 2<br/>(Questão 2)"]
    AllGroups --> G3["Grupo 3<br/>(Questão 3)"]
    
    G1 --> S1A["Seleção 1A<br/>(Enunciado)"]
    G1 --> S1B["Seleção 1B<br/>(Imagem slot)"]
    
    G2 --> S2A["Seleção 2A<br/>(Enunciado completo)"]
    
    G3 --> S3A["Seleção 3A<br/>(Enunciado)"]
    G3 --> S3B["Seleção 3B<br/>(Imagem slot 1)"]
    G3 --> S3C["Seleção 3C<br/>(Imagem slot 2)"]
```

- **Grupo**: Representa uma questão. Contém uma ou mais seleções.
- **Seleção Principal**: O crop do enunciado completo (texto + alternativas).
- **Seleções de Slot**: Crops de imagens dentro da questão (opcionais).

### Coordenadas

Todas as seleções armazenam coordenadas **normalizadas** (independentes de zoom):

```javascript
const selection = {
  id: 'sel_abc123',
  groupId: 'grp_001',
  pageNum: 3,
  // Coordenadas proporcionais (0-1) em relação à página
  relativeLeft: 0.05,    // 5% da esquerda
  relativeTop: 0.10,     // 10% do topo
  relativeWidth: 0.90,   // 90% da largura
  relativeHeight: 0.25,  // 25% da altura
  // Metadados
  status: 'verified',    // draft | verified | extracted
  isSlot: false,         // true para slots de imagem
  parentId: null,        // ID da seleção pai (para slots)
};
```

---

## Máquina de Estados

O cropper opera como uma **máquina de estados finita (FSM)**:

```mermaid
stateDiagram-v2
    [*] --> IDLE: Inicialização

    IDLE --> VIEWING: Viewer carregado
    
    VIEWING --> EDITING: setActiveGroup(groupId)
    EDITING --> VIEWING: clearActiveGroup()
    
    state EDITING {
        [*] --> NORMAL_MODE
        
        NORMAL_MODE --> CREATING: pointerdown (área vazia)
        NORMAL_MODE --> MOVING: pointerdown (sobre caixa existente)
        NORMAL_MODE --> RESIZING: pointerdown (sobre handle de resize)
        NORMAL_MODE --> SLOT_MODE: enterSlotMode(parentSelectionId)
        
        CREATING --> NORMAL_MODE: pointerup → salvar nova seleção
        MOVING --> NORMAL_MODE: pointerup → salvar nova posição
        RESIZING --> NORMAL_MODE: pointerup → salvar novo tamanho
        
        SLOT_MODE --> CREATING_SLOT: pointerdown (dentro do crop pai)
        CREATING_SLOT --> SLOT_MODE: pointerup → salvar slot
        SLOT_MODE --> NORMAL_MODE: exitSlotMode()
    }
    
    state "Constraints" as Constraints {
        NORMAL_MODE: Constraint = Página inteira
        SLOT_MODE: Constraint = Área do crop pai
    }
```

### Estados

| Estado | Descrição | Constraints |
|--------|-----------|------------|
| `IDLE` | Cropper não inicializado | — |
| `VIEWING` | Visualizando, sem interação | — |
| `NORMAL_MODE` | Editando grupo, pode criar/mover/redimensionar | Limites da página |
| `CREATING` | Arrastando para criar novo crop | Limites da página |
| `MOVING` | Arrastando crop existente | Limites da página |
| `RESIZING` | Arrastando handle de resize | Limites da página, tamanho mínimo |
| `SLOT_MODE` | Modo de seleção de imagem | Limites do crop pai |
| `CREATING_SLOT` | Criando slot dentro do crop pai | Limites do crop pai |

### Transições

```mermaid
graph LR
    subgraph "User Actions"
        Click["🖱️ Click em grupo na sidebar"]
        ClickEmpty["🖱️ Pointerdown área vazia"]
        ClickBox["🖱️ Pointerdown sobre crop"]
        ClickHandle["🖱️ Pointerdown sobre handle"]
        Release["🖱️ Pointerup"]
        ClickSlot["🖱️ Botão 'Adicionar Imagem'"]
        ClickExit["🖱️ Botão 'Sair'"]
    end

    Click -->|"setActiveGroup()"| EDITING
    ClickEmpty -->|"startCreating()"| CREATING
    ClickBox -->|"startMoving()"| MOVING
    ClickHandle -->|"startResizing()"| RESIZING
    Release -->|"endInteraction()"| EDITING
    ClickSlot -->|"enterSlotMode()"| SLOT_MODE
    ClickExit -->|"clearActiveGroup()"| VIEWING
```

---

## Selection Overlay — Diagrama de Renderização

O overlay é um **SVG** posicionado absolutamente sobre cada página do PDF:

```mermaid
graph TB
    subgraph "Layers (z-index crescente)"
        PDF["📄 Canvas PDF (z: 1)"]
        Dimming["⬛ SVG Dimming Mask (z: 100)<br/>Preto semi-transparente com buracos"]
        Boxes["📦 Selection Boxes (z: 200)<br/>Bordas coloridas + handles"]
        HitArea["👆 Hit Detection Layer (z: 300)<br/>Transparente, captura eventos"]
    end
```

### Dimming Mask

A dimming mask escurece toda a página, exceto as regiões dos crops:

```svg
<svg>
  <path 
    d="M 0 0 H {pageWidth} V {pageHeight} H 0 Z 
       M {crop1.x} {crop1.y} h {crop1.w} v {crop1.h} h {-crop1.w} Z
       M {crop2.x} {crop2.y} h {crop2.w} v {crop2.h} h {-crop2.w} Z"
    fill="rgba(0, 0, 0, 0.5)"
    fill-rule="evenodd"
  />
</svg>
```

O `fill-rule: evenodd` cria os "buracos" — áreas onde os subpaths internos (crops) cancelam o preenchimento do path externo (retângulo da página inteira).

### Status Visual dos Crops

| Status | Cor da Borda | Significado |
|--------|-------------|-------------|
| `draft` | 🔵 Azul `#3b82f6` | Detectado pelo AI Scanner, não verificado |
| `verified` | 🟢 Verde `#22c55e` | Verificado e aprovado |
| `extracted` | 🟣 Roxo `#8b5cf6` | Dados já extraídos |
| `error` | 🔴 Vermelho `#ef4444` | Erro na extração |
| `slot` | 🟡 Amarelo `#eab308` | Slot de imagem (dentro de questão) |

---

## Fluxo: Scanner → Cropper → Batch

```mermaid
sequenceDiagram
    participant Scanner as 👁️ AI Scanner
    participant State as 📊 CropperState
    participant Overlay as 🖼️ Selection Overlay
    participant User as 👤 Usuário
    participant Batch as ⚙️ Batch Processor

    Scanner->>State: addGroup({ pageNum, selections })
    Note over State: Cria grupo com status 'draft'
    State->>Overlay: notify() → re-render
    Overlay->>Overlay: Renderizar crops azuis (draft)

    Scanner->>State: updateGroupStatus('verified')
    State->>Overlay: notify() → re-render
    Overlay->>Overlay: Crops ficam verdes

    User->>User: Pode ajustar manualmente
    User->>State: moveSelection() / resizeSelection()
    State->>Overlay: notify() → re-render

    User->>Batch: Iniciar Processamento
    Batch->>State: getGroup(groupId)
    State-->>Batch: { selections: [...] }
    Batch->>Batch: Para cada grupo: extrair, normalizar, salvar
```

---

## CropperState — Store Reativo

O `CropperState` implementa um pattern de store reativo com subscriptions:

```javascript
class CropperState {
  // Dados
  static #groups = new Map();     // Map<groupId, Group>
  static #activeGroupId = null;   // Grupo atualmente em edição
  static #undoStack = [];         // Stack de undo
  static #redoStack = [];         // Stack de redo
  
  // Subscriptions
  static #listeners = [];
  
  // CRUD
  static addGroup(group) { ... this.#notify(); }
  static removeGroup(groupId) { ... this.#notify(); }
  static updateSelection(selId, updates) { ... this.#notify(); }
  
  // Undo/Redo
  static undo() { ... }
  static redo() { ... }
  
  // Observer
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

### API Pública

| Método | Parâmetros | Retorno | Descrição |
|--------|-----------|---------|-----------|
| `addGroup(group)` | `{ id, pageNum, selections }` | void | Adiciona um grupo |
| `removeGroup(groupId)` | `string` | void | Remove um grupo |
| `getGroup(groupId)` | `string` | `Group \| null` | Retorna grupo |
| `getAllGroups()` | — | `Map<string, Group>` | Todos os grupos |
| `setActiveGroup(groupId)` | `string` | void | Ativa edição |
| `clearActiveGroup()` | — | void | Desativa edição |
| `updateSelection(selId, updates)` | `string, object` | void | Atualiza seleção |
| `subscribe(callback)` | `Function` | `Function` (unsubscribe) | Observer |
| `undo()` | — | void | Desfazer última ação |
| `redo()` | — | void | Refazer última ação desfeita |

---

## Save Handlers — Extração High-Res

Quando o usuário confirma os crops, o `save-handlers.js` extrai cada seleção em alta resolução:

```mermaid
flowchart LR
    Sel["Seleção<br/>(coords normalizadas)"] --> Page["Renderizar página<br/>300 DPI (scale 4.17)"]
    Page --> Clip["Recortar região<br/>canvas.drawImage(clip)"]
    Clip --> Blob["canvas.toBlob()<br/>JPEG 85%"]
    Blob --> Upload["POST /upload-image<br/>→ ImgBB"]
    Upload --> URL["URL permanente<br/>i.ibb.co/..."]
```

---

## Referências Cruzadas

| Tópico | Link |
|--------|------|
| Cropper Core | [Cropper Core (cropper-core.js)](/cropper/core) |
| Máquina de Estados detalhada | [Mode (mode.js)](/cropper/mode) |
| Selection Overlay completo | [Selection Overlay](/cropper/overlay) |
| Slot Mode | [Slot Mode](/cropper/slot-mode) |
| Save Handlers | [Save Handlers](/cropper/save) |
| AI Scanner (gera crops) | [AI Scanner Pipeline](/ocr/scanner-pipeline) |
| Batch Processor (consome crops) | [Batch Processor](/upload/batch-arquitetura) |
