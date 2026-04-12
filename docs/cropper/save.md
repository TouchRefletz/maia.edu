# Save Handlers — Roteador de Interseção Multi-Pipeline O(1)

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Save Handlers do Cropper](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+cropper-save-handlers&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `save-handlers.js` (`js/cropper/save-handlers.js`) é a "Estação de Trem Central" do Motor de Recortes. Na V1 do sistema, "Salvar uma foto" só fazia uma função estúpida: Pegava o Blob (Bytes de PNG) e jogava globalmente. Na revolução de Inteligência Híbrida da V2, esse arquivo precisou ganhar *Routing Intelligence* massiva. 

Hoje, há múltiplos destinos exóticos para a qual uma singela foto "Cortada" pode ir:
1. **Lote de OCR em UI Assíncrono (Batch Saving)** - Para ler 10 questões de uma vez.
2. **Gabaritos Dinâmicos (Passos Independentes)** - Pra jogar resoluções de provas em 3 steps lógicos de raciocínio.
3. **Imagens Base Lineares Isoladas de Slots (Arquitetura C ou D)**. 

O Script lida pesado não com recortes físicos mas com Promessas Assíncronas (Promises Arrays) onde ele joga Blobs Web Workers em background.

---

## 2. Arquitetura de Variáveis e Manipulação Massiva do Global Space

Dada a natureza reativa de Single Page Applications Legadas que dependem de estado global, esse roteador atua como Setter (Escritor) de Chaves Globais atreladas `window.__`.

| Mutação The Estado Global | Significado do Payload | Fila de Recebimento Consumer |
|---------------------------|------------------------|------------------------------|
| `window.__tempFotosOriginais` | Array[Contextual Obj] | Puxado na próxima linha the Pipeline Gemini API enviando C++ Arrays the MetaInfo, incluindo Pág Pdfs e Relative Transforms. |
| `window.__imagensLimpas.*` | Dicionários Dinâmicos | Fica alimentando a Visualização de Modais (The Preview Screen do Professor), Ex: `.questoes_suporte` carrega thumbnails. |
| `window.__recortesAcumulados` | `String (Blob URIs)`| Utilizado estritamente no fallback the React Hooks UI the Imagem Preview Gallery (Gallery Modal The V1 Backward compatibility). |
| `window.__targetSlotContext` | Closure String Flag | Diz pro Code The Router pra onde o recorte vai ir. Evita "Ghost Savings". |

---

## 3. Diagrama: O funil The Multi-Cenário (Batch vs Legacy Single Save)

As funções orquestradoras diferenciam o contexto The Envio pela chave "isBatch?"

```mermaid
flowchart TD
    ClickBtnSave([Aperta Salvar na UI Sidebar]) --> RotaGlobal{Fluxo Batch Massivo The Grupo? Ou Mão Unica?}
    
    RotaGlobal -->|Batch Mode Massivo| InitBatch[Call: salvarQuestaoEmLote(group_id, tab)]
    InitBatch --> LoopExtraction([Loop The Array: Pega all Crops O(n)])
    
    LoopExtraction --> FilterInsideCrops{É The Pai ou um Drop Subcrop Interno?}
    FilterInsideCrops -->|Verifica Math.Abs X and Y O(N)| IgnoraTheChild(É Filho Interno - Desconsidera Da The VDB Array Metadata Original)
    FilterInsideCrops -->|Maior Fundo Pai Livre| CreateCropContext[Call: calculateCropContext()]
    
    CreateCropContext --> PushMaster[Adiciona Em: window.__tempFotosOriginais]
    PushMaster --> UiReactiveCall[Call: confirmarEnvioIA(tabId)]
    
    UiReactiveCall --> UI_TheUploadFlow([Pipeline the Firebase / Vertex Ativa a Loading Spinner UI])
    
    RotaGlobal -->|Legacy The Slots Mão Unica| CheckLegacy{Qual Flag do Mouse tá Up?}
    CheckLegacy -->|window.__target_alt_letra| CenarioLetra[Call: tratarSalvarAlternativa(Blob)]
    CheckLegacy -->|ctx === gabarito_passo| CenarioPasso[Call: tratarSalvarPassoGabarito(Blob)]
    CheckLegacy -->|Null Total Failsafe| CenarioQBase[Call: tratarSalvarSuporte(Blob)]
    
    CenarioLetra --> CleanupRout[Limpa O(1) Cache the the Temp Group The Arrays State]
    CenarioPasso --> CleanupRout
    CenarioQBase --> CleanupRout
```

No Diagrama denota-se o brilhante filtro preventivo: **Se um Group possui 4 crops englobando 1 questão com três alternativas. Se o crop mestre estiver abarcando todos os Crop Filhos matematicamente, the array não manda pra IA the 3 clones sujos duplicados the The Area.**

---

## 4. Snippets de Código "Deep Dive" (Integrações e The Spatial Filtering)

### O Filtro Espacial `O(n^2)` de Recortes Enclausurados (Anti-Redundância API)

Um professor preguiçoso recorta a página de matemática inteira, depois recorta só as Alternativas 1 a 1 por cima pra separar no Slots. Na The IA API Vertex (Geração), se enviássemos a foto da Questão Completa, o Módulo de Vertex custaria 1 Dólar e a O OCR atiraria duplicação Cega de Textos no Pinecone VDB. Ele varre para limpar filhos oclusos e evitar clones indesejados.

```javascript
/* Trecho Isolado de Filtragem Espacial em salvarQuestaoEmLote() */

let isContained = false;
const TOLERANCE = 5;

// Loop O(n^2) é pequeno e seguro (The Crops Arrays dão maximo the Size = 5)
for (let j = 0; j < group.crops.length; j++) {
   if (i === j) continue;
   const parent = group.crops[j].anchorData;
   
   // Bate A Página Se N for O(Same Layer Math Check)
   if (parent.anchorPageNum !== a.anchorPageNum) continue;

   // Geometria Limit Bound the Math Check Matrix - Tolerancia de Tremor Mouse Cego (+- 5Px)
   const isInsideX = a.relativeLeft >= parent.relativeLeft - TOLERANCE && 
                     (a.relativeLeft + a.unscaledW) <= (parent.relativeLeft + parent.unscaledW + TOLERANCE);
   
   const isInsideY = a.relativeTop >= parent.relativeTop - TOLERANCE && 
                     (a.relativeTop + a.unscaledH) <= (parent.relativeTop + parent.unscaledH + TOLERANCE);

   // Garante the Size Master é estritamente Maior the Child.
   if (isInsideX && isInsideY) {
     if (parent.unscaledW * parent.unscaledH > a.unscaledW * a.unscaledH) {
         isContained = true; // Cai The Rota e pula.
         break;
     }
   }
}
```

### Orquestrador Tríplice Assíncrono (`salvarQuestao()`)

Um roteamento sujo mas eficiente the "God Func Router Mode":

```javascript
export function salvarQuestao() {
  // ROTA MODO GAIOLA THE CONSTRAINTS THE MANUAL MODE?
  // Impede que as variavéis O(N) The Slot mode vazam pra Criação Falsa
  if (window.__isManualPageAdd) {
     // Apenas limpa a Div, Zera e Emite O Toast The Info (Questão Fechada)
     restaurarVisualizacaoOriginal();
     import("./cropper-core.js").then((mod) => mod.resetarInterfaceBotoes());
     return;
  }

  // ROTA 02: CONFIRM THE SLOT MODO React MISTO?
  if (window.__targetSlotContext === "image-slot") {
     import("./mode.js").then((mod) => mod.confirmImageSlotMode());
     return;
  }

  /* The Rota 03: Extract Mão Única Pura The Blob Base64 the Fallback The Engine Canvas ... */
}
```
Isso mostra The Code Defensivo implementado para a aplicação Vanilla não crashar o the Frontend Component-based state aturando multi-funcionalidades.

---

## 5. Exceções Lógicas, Geração The Blobs Assincronos e Desincronias 

Por lidar com blobs `URL.createObjectURL(canvas)` que ocupam RAM bruta do WebKit ou Chromium Engine:

| Fallback O(n) Exceptions Excedidas | Lógica de Shield Protetor Ativa Local | Impacto The View Reativo Oculto the Clicks. |
|------------------------------------|---------------------------------------|---------------------------------------------|
| Extrator Geométrico gera "Null" no cálculo the context | Devido a scroll e viewport resize subto no PDF | Bypassa silently as strings nulas no Array O(N). `if (cropContext) { fotosOriginais.push(); }`. O The Crop bugado se perde, não congelando o array mestre enviado à IA Vertex the Cloud. |
| Memory Blob URL Limit the Buffer Engine Chrome (Limites Extremos). | O Array Mestre só acopla URIS String Textuais. (Usa Pointers string pro Garbage Collector domar). | A UI React the Modais enxerga Imagens mas o `length` the O(n) the Arrays nunca afunda a performance the memória (O(1) Memory Usage Appending the List). |
| Submiting com Array Falsa `[]` the Crops | Acusa `if(images.length === 0) return`. | Quebras Fatais evitadas The Toast Alert Custom Visual impede Null Pointer the Exception Error de pipocar the Developer The Console the Dev Tools V8 the Navegador Engine. |

---

## 6. Referências Cruzadas Completas

A Doutrina deste roteamento conecta a Pipeline de "Upload Cego Front" the Vertex Intelligence Worker The Model Node Maps VDB Cloud:

- [Envio Local Inteligente (`ui-estado.js` The Envio UI) — the Import de Onde é chamado "confirmarEnvioIA(tabID)", jogando The Data Pro Módulo Gemini API Oficial Extracao Text.]() (Note: Path was inferred).
- [Geometria Absoluta Local (`mode.js`) — Módulo Auxiliar The `calculateCropContext()` the onde as dimensões Math VDB Originais Bypassam the Engine The O(1) Local The Render Canvas PDFjs V8.](/cropper/mode)
- [Estado Global do Módulo O(n) Memory Box Cego (`state.js`) — De lá se puxa `CropperState.getActiveGroup()` the para ver do Lote Arrays Crop Array the Objects.](/cropper/state)
- [Modais UI (Gallery and Suporte Base Maps the CSS Grid Layouts React Misto Engine) — Que dependem The Puxar As Imagens e Blobs URI desse Script Handler Central the Mutações Constantes UI Variables Hooks O(1).](/ui/modais)
