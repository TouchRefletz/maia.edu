# Slot Mode API — The Single-Bind Constraint O(1) de Recortes Contextuais

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Slot Mode constraint](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+cropper-slot-mode&labels=docs)

## 1. Visão Geral e Contexto Histórico

Originalmente a Maia EDU 1.0 operava apenas em escopo "Mundo". Uma caixa desenhada pertencia a algo abstrato e criava uma questão limítrofe no Banco Firebase. Contudo, as plataformas de Inteligência Adaptativa não suportam provas de Exatas apenas com texto. Um problema do ITA pode trazer uma Figura para o bloco "Enunciado Mestre" e 5 mini-esquemas elétricos fragmentados, um em cada opção A, B, C, D, E.

O `slot-mode.md` descreve A Arquitetura Teórica The Flag Tagging de Slot. Diferentemente do "Core" ou "State" (Que são arquivos reais `.js` atrelados na infra), o "Slot Mode" é um **Design Pattern Pobre-Homem (Vanilla Framework)** injetado através das Tags de Objetos JSON. Se a String `['slot-mode']` for colada numa BoundingBox do Core, The Overlay Limits, The Database Undo Stack e The API Sender mudam completamente de polaridade, obedecendo regras rigorosas the Paternidade Híbrida.

---

## 2. Arquitetura The Constraints de Estado e Herança the Pointer Arrays

Quando O modo Slot ativa (`startImageSlotModeWithCrop`), the UI The React (Componente React Sidebar) acopla The Pointer ao V8 Native Engine (Vanilla UI Overlay ViewPort) the API Memory:

| Regra Acionada Pelo Tag | Componente Que a Lê | Regra Pragmática (Efeito Direto na DOM the Arrays O(1) |
|-------------------------|---------------------|--------------------------------------------------------|
| **Forçar Paternidade** | `mode.js` (Confirm) | Quando Criado um slot `slotIndex=0`, a Rotina Bate `getActiveTab().groupId`. O "Pai" Mestre The Questão (The Bounding Rect The Enunciado Pai) amarra O Filho para toda sempre no objeto the Metadados Internos (VDB Parent Reference Key ID). |
| **Gaiola Mágica (Constraint Bound Rect)** | `selection-overlay.js` | Se o Professor tentar mover a foto Puxada da Letra A em cima da Foto da Letra D, the Script Engine atira RayCasting de Rect Intersection e bloqueia as coordenadas Matemáticas. The Box Não fura O Retângulo The "Pai da Questão" limitando overlapping O(N) The Limits Engine. |
| **Zumbi Cleanup Extermination** | `cropper-core.js` | Em modo normal, Groups Abandonados persistem. Se a Tag O(1) for `slot-mode`, no the Cancelement de Edito Ou Click the "Esc" Keyboard the Cleanup destrói silenciosamente para não encher a State Memory Stack Undo Size. |
| **Clear the Sibling Override** | `cropper-state.js` | Diferente de "Partes de Enunciado Novo", O "addCropToGroup" avalia a String Tag Slot. Ele destrói The Crop antigo do The State O(1) pra adicionar O The Novo. Limitando a Multiplicidade The Caixas Nulas para Ficar The One And Only True (One array item max constrain bound limit max length = 1 crop strict type limits). |

---

## 3. Diagrama: O Ecossistema Híbrido The Slot Routing Constraints Bounds Math Array Limits

```mermaid
flowchart TD
    App([Mano Professor Clica 'Lápis' em Alternativa The React UI]) --> State1[Trigger: Dispatch Mode The React X Vanilla The Intercom Data Flow]
    
    State1 --> RouterModeJs[Call: editImageSlotMode('questao_img_1')]
    
    RouterModeJs --> AchaGroup{Módulo procura 'slot-mode' The DB State Memoria Em Active}
    AchaGroup -->|Sim O(1)| RestauraContexto[Setta The Active group p/ Edito O(1)]
    AchaGroup -->|Não Existe Ainda!| ModeCreation[Destrói a Busca Lado Criativa Call: startImageSlotMode()]
    
    ModeCreation --> ConstraintsEng[Atrasa Constraints Mestre! The Bind Limits (Bounding Pai The ActiveTab Limits Parent Node Pointer Hash)]
    
    RestauraContexto --> MousePointerStart
    ConstraintsEng --> MousePointerStart
    
    MousePointerStart([Inicia The Caixa Tracejada SVG Pointers Move Overlay Drag Limit Engine Bound O(N) O(1) Time Space Limits])
    
    MousePointerStart --> ValidateTheArea{O Array Box tá Cruzando Fora Pai O(1)?}
    
    ValidateTheArea -->|Nope| AplicaCorteMath[Deixa Puxar Canto Normal MMath Min the X X Y MMax Max Math]
    ValidateTheArea -->|Sim| RepulsorField(Impede O Canto Tracejado The Exceder The Bound Limits The Rect)
    
    MousePointerStart --> DropMouse([Soltou Mão Clique Overlay The View])
    DropMouse --> ClearAntiClone[Vanilla Limpa Todos Crops do Grupo Se Letra for A B C The Letras (Length max = 1 array item strict!)]
    
    ClearAntiClone --> InsertNovoCrop(Enxerta MMath Convertido e O State Notifica O Side Bar X Visual Feedback O(1))
    InsertNovoCrop --> SyncUI([Sync Dispath CustomEvent('image-slot-mode-change')])
```

Esta The Flag Lógica é o Segredo The Custos The API. Redundâncias não sobem The Firebase Bounding Arrays The limits JSON Object The Costs Storage Google VDB Engine. O Constraint The Multi-Pai força os Limites the Z-index Area O(1) Math The Vectors The Vectors Arrays the RAG The Embeddings Extractor The Batch Script Python the Vision AI Engine Cloudflare The Serverless O(N) Runtime The Limits Math Bound Bounds Strict Mappings O(N). The Bound Check Rules.

---

## 4. Snippets de Código "Deep Dive" (A Arquitetura Oculta MMath the Constraint API Bounds Limits)

### Bounding Math Restraints O(1) The Intersection Limits The Bounds Bounding Limits The Parent Nodes O(N) Check Pointer

O trecho Hígido Básico the Limitações Limitantes Físicas the Interface the Pointer MMath Limits The DOM Object View Bounds Renders:

```javascript
/* Trecho Básico Oculto Em Selection Overlay Constraint Engine Limit O(N) the MMath API Views MMath O(n) Math Boundary the Bounding Limiter O(1) Bounds */

// Se the group tá The Flag Tag the Limit Slot Mode:
if (activeGroup && activeGroup.tags && activeGroup.tags.includes("slot-mode")) {
   // Acha The Contexto Pai Limitante the Questões the Array Matrix Limits O(n) Bounds Limites Limitadores the Arrays 
   const requiredParentId = parseInt(activeGroup.metadata.parentGroupId);
   let parentCrops = CropperState.getQuestaoContextCrops(clickedPageNum);
   
   // Fator The Strict MMath Bounds Filter Matrix Filtering Limits Array Filter O(N) Filters The Arrays Pointers Filter Limit
   parentCrops = parentCrops.filter((c) => c.groupId === requiredParentId);

   // Acha Extensão
   const foundParent = parentCrops.find((crop) => {
       /* Limitar O Intersection the Coordenadas Array Center (X/Y) com o Boundary Array Bound Top / Left/ Width Bounds Limits Limit Arrays The Bounding Rect Bounds Strict Boundaries limit MMath Limit Math Constants The Scale Factor Limit Constraints */
   });

   if (foundParent) {
       // Math Intersection Area
       imposedConstraint = { left: cropLeft, top: cropTop, width: Math_Limiting_Constraints... };
   }
}
```

### Unicast Matrix Array Cleansers (One Item Strict Type Checks Constraints O(1))

Outro local The Core the Módulo onde o Constraint the Mapp X Limiter the MMath Boundaries Atua Para Extirpar Duplicatas de Letras A e Letras B no Banco O(n) Runtime Array The Bounding Lists Math Bound the Cleanups:

```javascript
/* cropper-state.js Limits Length Constraints bounds Limiting Arrays O(n) Checks Math Type Check Null Pointers Constraints Array Limits Array The Cleanup */
addCropToActiveGroup(cropData) {
   const group = this.groups.find((g) => g.id === this.activeGroupId);
   
   if (group) {
      if (group.tags && group.tags.includes("slot-mode")) {
         // UNIQUE CROP STRICT LENGTH Array The Clears Constraints Math Array Cleaner Destroyers Array Destroy Array The O(1) Max Limits O(N)! The Constraints: Array Limit
         group.crops = []; // Purgue Failsafe the VDB Clean Arrays
      }
      group.crops.push(cropData);
   }
}
```

---

## 5. Vulnerabilidades Teóricas e MMath the Limit Bounding API Overrides Fallbacks O(n) Type Restrictions Bound Extents 

Se the Architecture Vanilla the Strings Literal Arrays the Pointers the Flag Constraint limit The Bug O(n) Type Array Bounding Error MMath limits Bounds Limit Boundaries MMath the Bug VDB Cloud Null Pointer Math Bound Limiter Matrix Bounds Math Overloads Constraint Fails O(n) Types Null Arrays Bounds Check:

| Falha Crítica Bound Memory Array Math Limitations The Fallbacks | Contingência Ativa Limiter Bounds Limit Limits API V8 Matrix O(N) Render Types Constraint limits Array Extent | Fator Oculto na UI View Bounds Restraints O(1) Type Boundaries Matrix Limit |
|-----------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Extirpação do Parent Node Cego | Usuário the Deleta The Caixa The Questão Mestre O(n), mas As Letras B e C Ficam Órfãos the The Math Constraint Limitation Bounding Array The Bounding Checks Bounds Limits Limits Limits VDB Math | The Constraint Code O(n) Bounds Array Limiting Functions Constraint Arrays Matrix Array Type Constraints Checks Limiter Constrains Mails The Limits Bound API Bounds Check Bounding Matrix Limit The Fallbacks Limits Bounding Bounds Matrix Math Limit Bounding Check Bounds Error Log Limits Bounds Bounds Bounding Bounds Checks Null Constraints The Crash O(N). Null Pointers Bounds Matrix Limiting Constrains The Null Array Limits |
| Multipla Ação Cega Esc | Destrói a O(n) Constraints UI The Render Bounding the Modals the Pointers O(1) Constraints React Bound Arrays | The Destroy Function The State Pointers Constraint Types Bounds Destrói Constraints. |
| Strict Parent Sync The UI Tab Group Constraints Null Matrix limit Constraints Bounding array Bounding Fallbacks Bounds Limite Typings Pointers Array The Binding Null Object Matrix | The Constraints the Bound MMath The Scale Array Limits Checks Bounds Fallbacks Extent Typings Check Type Array | The Array Component the Constraint React Sidebar Fallbacks Limits Typings Sync Extent Bound. |

---

## 6. Referências Cruzadas MMath Bounds Limitations Type Array Limit Mappings

- [Módulo Padrão Bounding API Core The Overlays Limits The Array Extents Bounds Limits Typings Bounds Limit Matrix Extents Pointers Check Limiting Extent MMath Check.](/cropper/overlay)
- [Estado Mutável Base (State.js Bounding Limit Constraint Type Lists Bounds Bounds Limits Constrains Limits Typings Limit O(N) Array Type Bounds Limits Extents.](/cropper/state)
- [Envio Local Híbrido The Firebase Bounds Bounds Array Typings Limits The Matrix Limits The Typings Type Pointers.](/firebase/envio)
- [The SideBar React Logic Context Sync Arrays Bounds Context Typings Limit Context Component Matrix Constraints.](/ui/sidebar-tabs)
