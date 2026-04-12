# Modos Lógicos do Cropper — O Proxy Slot-Mode e Interação UI

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Cropper Modes](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+cropper-mode&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `mode.js` (`js/cropper/mode.js`) rege a Bipolaridade da Ferramenta de Seleção Fotográfica da Maia EDU. Nas primeiras versões, o professor só possuía um modo: "Recortar uma Questão e Salvar". Com o avanço para a V2 e o advento da Inteligência Artificial Detectora de Blocos (Pipeline Gemini), o sistema passou a precisar recortar sub-pedaços contextuais.

Se a IA transcrever a Questão e o professor perceber que faltou a "Alternativa C", ele não quer criar uma Nova Questão; ele deseja engatar o **Modo Slot**. O Slot Mode atua como um preenchedor local. Esse arquivo lida com as restrições brutais matemáticas de cálculo de pontos SVG em PDF. Ele calcula como O PDF Original e Dimensionado se relaciona com o tamanho Real para que Recortes feitos em Telas de Celular correspondam exatamente ao mesmo retângulo se abertos num Monitor 4k Ultra-wide.

---

## 2. Arquitetura de Variáveis e State Management Interno

O Módulo trafega de fora (Global) para o Core Lógico manipulando janelas temporárias. Essas variáveis ditam a direção que a Tabela de OCR receberá The Coordinates.

| Variável / Parâmetro | Tipo | Escopo e Persistência | Função Explícita Pelo Negócio |
|----------------------|------|-----------------------|-------------------------------|
| `__targetSlotIndex` | `Number` | Closure Interna + Global | O ID exato atrelado (Ex: 0, 1, 2) da alternativa correspondente do React Component (Slot). |
| `__editingGroupId` | `String (Hash)`| Closure Interna | Trava a criação O(1). Se for nulo no Cancelamento de modo, ele exclui o Slot fantasma criado. |
| `normalizedCrop` | `Object {x, y, w, h}` | Argument Passado | Matemática Pura (0-1000). A IA não conhece PIXELS devido a Variações Device-PixelRatio, ela devolve métricas em Float1000. |
| `outputZoom` | `Constant: 200` | Fixo Local | Um Hack Oculto. O PDF.js exibe nativamente a 1.0; Nós salvamos As Box Models 2x maiores (2.0) para que o zoom de Visualização não mostre serrilhados ao Estudante. |

---

## 3. Diagrama: Pipeline de Injeção Direta VDB (AI Slot Auto-Confirm)

Quando o Batch Pipeline do Gemini detecta "Achei uma figura nas coordenadas (200, 300)", ele NÃO CHRASH o overlay. Ele chama `confirmAISlotDirectly()` gerando The Instant Bind.

```mermaid
flowchart TD
    Worker([Gemini C++ Responde: Achei Imagem Slot C]) --> ModeFunc[Call: confirmAISlotDirectly(slotIdx, pgNum, normObj)]
    
    ModeFunc --> GetDimentions[Abre ViewPort Falsa PDF.js scale: 1.0]
    GetDimentions --> CalcPx[Math: Multiplica Float/1000 pela Base Width Real. Ex: PDF 595pt]
    
    CalcPx --> EmbedCalculate[Conversão DPI para CSS Embebbed Padded]
    Note right of EmbedCalculate: Soma +5 de Ajuste, Fatora 96/72 Dots, Soma 20Padding pra Fazer O Fright View View
    
    EmbedCalculate --> ConstructCropData(Cria o Objeto Estruturado CropData Final)
    
    ConstructCropData -.-> {norm_x, pdf_page, pdf_width_px, pdf_url}
    
    ConstructCropData --> EventDisp1[window.dispatchEvent('slot-update')]
    EventDisp1 --> ReactState[O Component ImageSlotCard preenche e fica Verde]
    
    ConstructCropData --> EventDisp2[window.dispatchEvent('batch-slot-filled')]
    EventDisp2 --> QueueWait[Avisa o Extrator Batch em Background que ele já pode Pular a Foto Sem Intervenção]
```

Se o professor estiver usando Adição Manual, ele chama `startImageSlotMode()` onde o passo `GetDimentions` só ocorre APÓS o Mouse-Up da Tela de Toque.

---

## 4. Snippets de Código "Deep Dive" (Matemática Absoluta The Point Conversion)

### O Algoritmo de Geometria Reversa (DPI e CSS Embedding)

Um dos maiores desafios O(1) de aplicações Web é sincronizar `Canvas Render` com o `DOM Real`. Esta função corrige a divergência de densidade de píxel (DPI - Dots Per Inch) entre Sistemas Apple Retina Display e Win32 Monitores comuns.

```javascript
/* Cálculo Crucial dentro de calculateCropContext() e confirmAISlotDirectly() */

// A Escala Mágica do IFrame Original PDFJs x CSS Grid System
const EMBED_SCALE_FACTOR = 96 / 72; // Desktop Nativo (96dpi) / Mac-PDF Point (72dpi)
const outputScale = 200 / 100; // Dobra O Tamanho Ocultamente

// Math.round Evita Rendering de Sub-pixel (.5px) que cria Lixo Visual (Bordas Embaçadas)
const finalContainerWidth =
  Math.round((pdfCropW - 5) * outputScale * EMBED_SCALE_FACTOR) +
  5 + Math.round(20 * 2 * outputScale);

// Canvas Extraído - The SVG Bounding Box
const canvasSourceW = Math.round(pdfWidthPt * (300 / 72)); // Upscaling brutal (300 DPI - Profissional)

// Proteção O(n) Math.Max | Math.Min
// Normalizes bounds against Screen Edge Clips
const padNormW = Math.min(1000 - padNormX, normalizedCrop.w + 2 * padding);
```
Sem isso, um crop feito num iPhone ficaria espremido e fora de proporção no PC do Aluno pagante.

### O Event Bus Assíncrono Desconectado de Vanilla pra React

O Cropper Modes vive longe da Árvore de Estado do WebPack do React (Sidebar UI). Como comunicamos a UI the Slots que The Magic Happened? (Evento Customizado Global):

```javascript
/* ConfirmSlotDirect - Intercomunicação Vanilla */
window.dispatchEvent(
  new CustomEvent("slot-update", {
     detail: {
        slotId: numericIndex,
        action: "filled", // Flag interpretada dentro de um useEffect() do Frontend
        cropData: cropData,
        timestamp: Date.now(),
     },
  })
);

// O BatchProcessor também precisa saber e corre cego no Background. Dual-Event Paradigm
window.dispatchEvent(
  new CustomEvent("batch-slot-filled", {
     detail: { slotId: numericIndex, cropData: cropData }
  })
);
```

### Fallback de Desistência: O Coletor de Lixo Zumbi (Cancel Mode)

Quando O Professor erra um Slot Mode e cancela, O Sistema apaga do Firebase, mas precisa manter se ele cancelou a Edição de uma foto Que JÁ Existia.

```javascript
export function cancelSlotMode() {
  if (CropperState.revert) CropperState.revert();

  // Zumbi Killer: the new creation was aborted and The ID Editing was NUll
  if (__editingGroupId === null) {
    const activeGroup = CropperState.getActiveGroup();
    if (activeGroup) CropperState.deleteGroup(activeGroup.id);
  }

  CropperState.setActiveGroup(null);
  refreshOverlayPosition();

  // Avisa a Sidebar UI Pra voltar pro modo Normal e esconder Botões 'Edit Mode'.
  window.dispatchEvent(new CustomEvent("image-slot-mode-change", { detail: { 
     slotId: __targetSlotIndex, 
     mode: "idle" 
  }}));
}
```

---

## 5. Exceções Analisadas (The Math Collision e Sync Drops)

A geometria do viewport PDF.JS não é amigável, o Módulo engole as seguintes falhas calado:

| Fonte O(1) do Excesso/Exceção | Mitigação Codificada Assíncrona | Reflexo Visivel para o Utilizador |
|-------------------------------|----------------------------------|-----------------------------------|
| Tentativa The ConfirmSlot Mode sem área recortada | O Array Mestre do Grupo O(1) bate `activeGroup.crops.length === 0`. | Negação limpa via Toast Alert ("Selecione uma área na Imagem!") impedindo Submits Vazios pro Cloud VDB. |
| The Match de Slot String X Numbers | Ex: React envia slotId=`"questao_img_1"` em vez do Index `1` esperado pela Engine. | `match = String(slotIndex).match(/(\d+)$/)`. Extrai The Pure Int pra não destruir Os JSON Maps. Não exibe erro, autocorrige invisivelmente. |
| O `PDFDocument` (WebGL) não carregou na DOM Global The PageNum solicitado pela IA Vertex | A `try { pdfDoc.getPage()}` no Viewport Scale cai p/ Exception. | Os números de `pdfWidthPt` caem pró Fallback Estático `595` / `842` (Padrao folha A4 Internacional) para a matematica não multiplicar por Null ou UNDEFINED causando Tela Branca. |

---

## 6. Referências Cruzadas Completas

A Geometria Aplicada deste Arquivo é a ponte entre IA the Rendering:

- [Overlay Core (`core.js` + `overlay.js`) — Módulo irmão que recebe As Coordenadas Matemáticas The Mouse pra validar no Pipeline do Módlo.](/cropper/core)
- [SideBar Component (Slots UI) — The React View onde O `CustomEvent("slot-update")` é escutado de forma Assíncrona no UseEffect Hook.](/ui/sidebar-tabs)
- [Estado Global Compartilhado (`state.js`) — Módulo Base aonde a API the Fallback Zumbi Delete atira Suas Lâminas the O(N).](/cropper/state)
- [Batch Processor — Ferramenta Invisível the O(1) que Mapeia O Segundo Dispath Event `batch-slot-filled` pra não parar sua Fila Background The Processamentos.](/upload/batch-imagens)
