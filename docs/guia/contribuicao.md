# Guia de Contribuição

## Princípios Fundamentais

O maia.edu é um projeto educacional com uma base de código híbrida (Vanilla JS + TSX). Este guia estabelece as convenções e padrões para garantir consistência e qualidade.

---

## Estrutura de Diretórios

Ao adicionar novos arquivos, respeite a organização existente:

```
js/
├── api/        → Clientes de API (Worker calls)
├── banco/      → Banco de questões (UI + lógica)
├── chat/       → Sistema de chat (router, pipelines, prompts)
├── cropper/    → Sistema de recorte de PDF
├── firebase/   → Integração com Firebase
├── ia/         → Embeddings e vetorização
├── normalize/  → Normalização de dados
├── normalizer/ → Data normalizer (IA-powered)
├── render/     → Componentes de renderização
│   └── final/  → Renderizadores de questão/gabarito
├── services/   → Serviços core (Scanner, Batch, Memory, OCR)
├── ui/         → Componentes genéricos de interface
├── upload/     → Upload, batch, terminal
├── utils/      → Utilitários puros
└── viewer/     → PDF viewer
```

---

## Convenções de Código

### Nomenclatura

| Contexto | Padrão | Exemplo |
|----------|--------|---------|
| Arquivos JS | `kebab-case.js` | `batch-processor.js` |
| Arquivos TSX | `PascalCase.tsx` | `RenderComponents.tsx` |
| Arquivos CSS | `kebab-case.css` | `chat-render.css` |
| Funções | `camelCase` | `normalizePayload()` |
| Classes | `PascalCase` | `BatchProcessor` |
| Constantes | `UPPER_SNAKE_CASE` | `CHAT_CONFIG` |
| Variáveis globais | `__prefixo` | `window.__ultimaQuestaoExtraida` |
| Custom Events | `maia:event-name` | `maia:pagechanged` |
| IDs de DOM | `camelCase` | `canvasContainer` |

### Idioma do Código

O projeto usa uma mistura de **português** e **inglês**:
- **Português**: Variáveis de negócio, nomes de campos, comentários principais
- **Inglês**: Conceitos técnicos, nomes de design patterns, APIs

```javascript
// ✅ Correto
export function processarQuestao(dados) {
  const alternativas = dados.alternativas || [];
  // Use best-effort parsing for streaming
  return parse(alternativas);
}

// ❌ Evitar mistura inconsistente
export function processQuestion(dados) {
  const alternatives = dados.alternativas; // Inconsistente
}
```

### Imports

Organize imports nesta ordem:
1. Dependências externas
2. Módulos internos (caminho relativo)
3. Tipos (se TypeScript)

```javascript
// 1. Externas
import { parse } from 'best-effort-json-parser';

// 2. Internas
import { viewerState } from '../main.js';
import { CropperState } from '../cropper/cropper-state.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
```

---

## Padrões de Projeto Utilizados

### 1. Módulos ES com Export Nomeado

```javascript
// ✅ Preferido
export function normalizePayload(dados) { ... }
export const CONFIG = { ... };

// ⚠️ Apenas para classes singleton
export default class BatchProcessor { ... }
```

### 2. Observer Pattern (CropperState)

```javascript
// Exemplo de uso
const unsubscribe = CropperState.subscribe(() => {
  refreshOverlayPosition();
});

// Limpar ao destruir componente
unsubscribe();
```

### 3. Pipeline Pattern (Chat)

Novas pipelines devem seguir a assinatura:

```javascript
export async function executePipeline(mode, message, context) {
  // 1. Build prompt
  // 2. Call Worker (streaming)
  // 3. Process response
  // 4. Return normalized result
}
```

### 4. Custom Events

```javascript
// Emitir
document.dispatchEvent(
  new CustomEvent('maia:pagechanged', {
    detail: { pageNum: 3 }
  })
);

// Consumir
document.addEventListener('maia:pagechanged', (e) => {
  console.log('Página:', e.detail.pageNum);
});
```

---

## CSS Architecture

### Design Tokens

Sempre use variáveis CSS do `variables.css`:

```css
/* ✅ Correto */
.my-component {
  color: var(--color-text);
  padding: var(--space-16);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
}

/* ❌ Evitar valores hardcoded */
.my-component {
  color: #333;
  padding: 16px;
  border-radius: 8px;
}
```

### Z-Index

Use as camadas definidas:

```css
/* ✅ Contextual, dentro da camada correta */
.selection-overlay { z-index: 999; }    /* Overlays layer */
.modal-backdrop { z-index: 99990; }     /* Modais layer */

/* ❌ Valores arbitrários */
.my-popup { z-index: 9999999; }
```

### Responsividade

Breakpoints padrão:
- `900px` — Mobile/Desktop split principal
- `768px` — Tablet adjustments
- `480px` — Small phone adjustments

---

## Adicionando Novas Funcionalidades

### Novo Endpoint no Worker

1. Adicionar handler em `maia-api-worker/src/index.js`
2. Adicionar rota no switch de pathname
3. Adicionar função wrapper em `js/api/worker.js`
4. Documentar na seção [API Worker](/api-worker/arquitetura)

### Novo Componente de Render

1. Criar em `js/render/` (TSX para componentes complexos)
2. Seguir o padrão de `StructureRender.tsx`
3. Registrar no `RenderComponents.tsx`
4. Adicionar estilos em `css/result/` ou `css/components/`

### Nova Metodologia Pedagógica

1. Adicionar no enum de `chat-system-prompt.js`
2. Criar o prompt correspondente
3. Registrar no seletor de metodologias (`pipelines.js`)
4. Adicionar badge visual

---

## Testes

Atualmente o projeto não possui uma suite de testes automatizados. Testamos manualmente:

1. **Chat**: Testar todos os modos (rápido, raciocínio, scaffolding)
2. **Scanner**: Testar com PDFs de diferentes formatações
3. **Banco**: Verificar filtros, paginação, cards
4. **Mobile**: Testar bottom sheet, viewport, scroll

---

## Documentação Gerada por IA

Toda a documentação neste site foi **gerada por IA** com base no código-fonte. Se encontrar erros:

1. **Clique em "📋 Reportar Erro"** no topo de qualquer página
2. Ou abra uma issue manualmente em `https://github.com/maia-edu/maia.api/issues`
3. Use a label `documentation` + `ai-generated`

### Revisão de Documentação

Ao revisar docs geradas por IA, foque em:
- Precisão dos diagramas de fluxo
- Correção dos nomes de funções/variáveis
- Completude dos parâmetros de API
- Consistência entre docs e código atual
