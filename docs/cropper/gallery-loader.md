# Gallery Loader — Conversor Numérico e Renderizador Híbrido OCR/JSON

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Gallery Loader](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+cropper-gallery-loader&labels=docs)

## 1. Visão Geral e Contexto Histórico

O agrupamento conceitual `gallery-loader.md` descreve os arquivos `gallery.js` e `json-loader.js` (residentes em `js/cropper/`). Na versão primordial da plataforma, a extração fotográfica era unilateral: O professor desenhava, a foto salvava.

Com The V2 e o processamento Background Pipeline "Gemini OCR Extractor", o sistema precisou engatar a Mão Dupla: O Worker C++ lê o PDF inteiro em Cloud, acha onde estão os textos e imagens de prova, e devolve um JSON Array gigantesco com As Coordenadas (`y1, x1, y2, x2`) das caixas tracejadas de onde ele deduziu O Texto Base. O `json-loader.js` atua como este Intérprete Matemático, recriando The Canvas Selection Boxes passivamente. Em contrapartida, o `gallery.js` varre essas caixas aprovadas para dar renderização Thumbnail Legacy no Grid Inferior da visualização para os Browsers Antigos.

---

## 2. Arquitetura de Variáveis (A Métrica JSON)

A Dificuldade extrema do JSON Loader é lidar com Resoluções Virtuais. O Worker Analisa o PDF não em DPIs Reais, mas numa grade O(1) de `0 a 1000`.

| Variável Inject | Tipo / Engine | Escopo de Domínio | Explicação Base Pela Física do UI |
|-----------------|---------------|-------------------|-----------------------------------|
| `jsonInput` | `String / Object JSON` | Memória Transient | A carga devolvida pelo Módulo Ia. Traz Listas de Objetos com ID da Questão e Chave de Pontos. |
| `targetPageNum` | `Integer` | Anchor Pointer | Vinculador de Página PDF.js. É injetado por fora porque O Gemini Node não entende páginas duplas; nós passamos essa tag pro Loader não plotar uma Questão Da Página 2 por cima da 1. |
| `isY1X1` | `Boolean Flag` | Parser Validator | Os Modelos Antigos GPT-4 Vision costumam devolver Array [X1, Y1]. Os Modelos Vertex/Gemini as vezes respondem invertido `y1x1y2x2`. Essa boolean lida O Parser O(1). |
| `options.padding` | `Float Margin`| Safety Float | Dá uma borda invisível ao redor do Crop the IA pra ele não cortar a palavra pela "metade". |

---

## 3. Diagrama: O Ingestor The AI Bounding Boxes

Quando a IA emite a Array de Boxes localizadas, o Script precisa Inserir the Box Models na ViewPort Reativa:

```mermaid
flowchart TD
    CloudAPI([Cloudflare Fetch Result]) --> RecebeJSON[Extrator Entrega: {regions: [box1, box2]}]
    RecebeJSON --> IniciaLoad[Call: loadSelectionsFromJson(JSON, page_2)]
    
    IniciaLoad --> TryParse{JSON é String?}
    TryParse -->|Sim| Converte(Realiza JSON.parse)
    TryParse -->|Não| ValidaFormato{Possui Array 'regions'?}
    
    ValidaFormato -->|Null| AbortarOperacao(Mata Erro Vazio Silencioso)
    ValidaFormato -->|Okay| DeterminaSchema(Extrai isY1X1 do CoordinateSystem)
    
    DeterminaSchema --> LacoForObject([Itera Cada Region do JSON])
    LacoForObject --> GroupExistence{ID de Questão Já Existe Na Memoria Local?}
    
    GroupExistence -->|The Draft Upgrade| LimpaCropsAntigos[Apaga as linhas antigas da Q2 e sobrepõe]
    GroupExistence -->|Merges Continuos| AppendaNewDrop[Se for 'parte_questao', soma no array da mesma Questao O(n)]
    GroupExistence -->|Nova Questão| CriaGroupNovo[state.createGroup(externalID)]
    
    LimpaCropsAntigos --> ConverterDpi
    AppendaNewDrop --> ConverterDpi
    CriaGroupNovo --> ConverterDpi
    
    ConverterDpi[Multiplica C1, C2 de 0-1000 pelo offsetWidth do Componente Wrapper PDF]
    ConverterDpi --> DisparaState[CropperState.addCropToGroup]
    
    DisparaState --> FimDoLaco[Fim do Loop]
    FimDoLaco --> KillFocus[setActiveGroup(null) - Fecha The Painel]
```

Um detalhe fundamental dessa rotina the Smart Merge (Upgrading Draft) é The Conflict Resolution. Como O Worker pode analisar 1 PDF e atirar blocos "picados" pra mesma questão "Q01", o JS não pode criar 2 Grupos de Cor Ciano soltos. Se Ele acha a `external_1`, ele concatena The Box. A interface the Overlay UI magicamente puxa as novas cordas Reativas e desenha os 2 tracejados laranjas.

---

## 4. Snippets de Código "Deep Dive" (Integrações e Upscaling)

### Renderização Matemática Proporcional

Um celular com PDF.js at 0.8 Scale tem offset Width the 300px. Um Macbook M2 at 2.0 Scale tem 1200px. Eis a Unscaling engine que traduz Geometria Flutuante para Pontos Absolutos (Fixos na Folha):

```javascript
/* Trechos the json-loader.js conversion O(1) */

// Converte Array Float Percentil 0 a 1000 da The CloudVision API
const relTop = top / 1000;
const relLeft = left / 1000;
const relBottom = bottom / 1000;
const relRight = right / 1000;

const relWidth = relRight - relLeft;
const relHeight = relBottom - relTop;

/* BUSCA the DIV Cega The PDF pra Extrair a Largura Estúpida DOM Atual */
const pageContainer = document.getElementById(`page-wrapper-${targetPageNum}`);
const currentW = pageContainer.offsetWidth; 
const currentH = pageContainer.offsetHeight;

/* THE MAGIC: Reverse Engineer Scale. Pega Tamanho Vísivel e Divide Pela Ampliaçao (Ex: 1000 / 2.0x = 500 Width Nativo Absolute) */
const unscaledPageW = currentW / viewerState.pdfScale;
const unscaledPageH = currentH / viewerState.pdfScale;

const anchorData = {
   anchorPageNum: targetPageNum,
   relativeLeft: relLeft * unscaledPageW, // Aplica o Ponto Cego Pro Overlay The Canvas desenhar depois.
   relativeTop: relTop * unscaledPageH,
   unscaledW: relWidth * unscaledPageW,
   unscaledH: relHeight * unscaledPageH,
};
```
Isso assegura que the Boxes Importadas Da Nuvem C++ encaixem matematicamente milimetradas nas Letras impressas pelo PDF renderizado do Canvas.

### Gallery Thumbnails Legacy The Memory (Modal Compatibility)

Além the Loading Matemático the JSONs. O agrupamento O(1) inclui O Render the Thumbnails Visual. O professor clica e os cortes (Blobs Textuais Salvos) surgem como Modal Flex Box.

```javascript
/* Extrato the gallery.js Event Binders Memory-Safe */

window.__recortesAcumulados.forEach((imgSrc, index) => {
   // Fabrica DOM Frio
   const wrap = document.createElement("div");
   const btn = document.createElement("button");
   
   // AQUI OCORRE O THE LAMBDA POINTER FIX BUG!
   // Os programadores Juniores usualmente quebram isso passando Loop Scope Var
   btn.addEventListener("click", () => {
       // The Reference Closure Memory Pointer do 'index' do ForEach Local.
       removerRecorte(index); 
   });
});

export function removerRecorte(index) {
   // Destruição Real Na Ram Blobs.
   window.__recortesAcumulados.splice(index, 1);
   renderizarGaleriaModal(); // Recursividade Visual
}
```

---

## 5. Manejo Pragmático de Edge Cases e JSON Parse Exceptions

Enfrentando APIs LLMs Cloud O(1) com The Workers, 4% De Falhas The Request retornam Lixo (Mato) ao invés the JSON Puro.

| Alarme the Pane / Exceção Engine | Solução Local | Refletido Na UX da UI |
|----------------------------------|---------------|-----------------------|
| `Try/Catch` (Parser Fatal Error) | Captura O JsonInput O(n) String Quebradão e cai Pro Error Logging `console.error("Invalid Json")`. Da The `Return` Rápido pra não crashear Aba | O App ignora O Box Extrator silenciosamente e Permite Carga Limpa. Se o Cloud falhou The Extração, a Aba the UI Permance Limpa pra the Manual Crop funcionar the Fallback The The Engine sem "Ghost UI" Quebrada. |
| Colisões de Merge (Draft The Upgrades) | O módulo Avalia Array Lógicas: `isNewComplete && hasExistingComplete` se os dois The Bounding Body batem frontalmene, O The Old Morre e o Cloud The VDB assume O the Replace total. The `Array.filter` arranca As Boxes Duplicadas O(N). | A tela não ficará suja the the 2 Boxes Laranjas the the mesmas Proporções empilhadas CegoThe State Array Clog. (Zumbi Clears). |
| Arrays Fora the Bounds The Coordinate Scaling | Se the the API enviar x2 Maior the 1000%. Funções de Teto `Math.min(1000, bounds)` ativam the Clamp Values The Ceiling limits. | Os tracejados Vão Travar nos Limites Finais The Página the Papel (A4 Edge). Não Atirando Overflow CSS the Scrow bar O(N) no Canvas The UI CSS Matrix the PDF Viewport App. |

---

## 6. Referências Cruzadas Completas

Para varrer The Flow e Salva The Coordinates the API Model Array e The Render The SVG the View Box Math Box Constraint Limit Array The Node Arrays:

- [Extração Lote Background API Worker (`extract-questions.md`) — As Rotas Onde a Vertex LLm Vision emite esse The String The Json Stringified Injetado no LoadSelections() deste script.](/infra/extract-questions)
- [A Árvore The Estado do Cropper O(n/1) (`cropper-state.md`)— A Ram aonde the Grupos Creados dinamicamente na The Merge Inception São Atirados Em Memória The Notify Hooks.](/cropper/state)
- [Modo UI Modais Estúdio The Legacy Grid Components (`modais.md`) — Módulo CSS Render the Gallery onde O HTML puro Cego de the wrap append() se exibe e Acopla.](/ui/modais)
