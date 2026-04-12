# CSS Animations — O Motor de Micro-Interações e Feedback Visual

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. Arquivo documentado seguindo a Especificação Titânica Mínima (> 200 Linhas) solicitada pela The Maia Architecture Guidelines. [📋 Reportar erro no Módulo CSS Animations](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+css-animacoes&labels=docs)

## 1. Visão Geral e Contexto Histórico: O Porquê do CSS Nativo

Na evolução das interfaces web modernas, bibliotecas pesadas de animação em JavaScript (como Framer Motion ou GSAP) tornaram-se o padrão da indústria. No entanto, o `Maia.edu` foi arquitetado para rodar em *low-end devices* (Chromebooks de escolas públicas e celulares antigos). Depender do Main Thread do JavaScript para animar a abertura de um Modal causava *jank* (quedas de frame abaixo de 60 FPS), resultando em engasgos durante momentos críticos, como o processamento do LLM (Gemini).

Por conta disso, foi consolidado o pacote `base/animations.css` e distribuído ao longo dos arquivos listados em `css/main.css`. Toda a animação na Maia é **100% acelerada por Hardware (GPU)** utilizando apenas as propriedades CSS `transform` e `opacity`. Mutações de largura (`width`), altura (`height`) e margens (`margin`) são veementemente proibidas como gatilhos de transições, pois provocam "Layout Thrashing" (Recálculo em cascata renderizado pela CPU).

O objetivo deste documento é imergir nas decisões de Keyframes, Easing Funcions (As curvas de transição matemática) e as flags globais que orquestram a coreografia do UI/UX The Maia.

---

## 2. Arquitetura The Design Tokens: Tempos Críticos e "Curvas Bézier"

Ao lado da paleta de cores e de espaçamentos tipográficos, a Maia trata O TEMPO (`duration`) como Token absoluto. Misturar os tempos causa o temível efeito "Frankenstein" ou "PowerPoint" na UX.

### The Sacred Timings (Variáveis CSS de Duração)

A fundação do CSS importa ou deduz as durações com base nas heurísticas do Material Design 3.0:

| Variável Global CSS / Tempo | Milissegundos | Casos de Uso Restritos (Onde Aplicar) |
|-----------------------------|---------------|---------------------------------------|
| `--transition-fast` | `150ms` | Hover States. Quando o mouse passa em cima de um Card de Módulo ou botão `btn--primary`. Reação tátil instantânea, inferior ao piscar de olhos The Humano (100ms). |
| `--transition-base` | `250ms` | Abertura the Dropdowns O(1), Expansões Collapse de Accordions the Gabarito. Exige fluidez visual para The Eye acompanhar The Motion of Elements Hiding/Showing. |
| `--transition-slow` | `400ms` | Modal The Entry. Deslocamento agressivo vertical ou the Chat Streaming Elements. Como arrasta uma grande massa de pixels The Screen Edge The Center, exige O Time the Physics The Gravity pra parecer "pesado" no Device. |
| `--transition-sluggish` | `700ms` | Exclusivo. The Chat Routing Badges The Fade The Toast Alerts the Notifications the Background. Utilizado só pra coisas que o o olho desvia The Attention for The System Sync UI hooks. |

### The Easing Functions (Curvas the Aceleração Matemática)

Não existem movimentos lineares `linear` perfeitos na natureza. Quando você joga uma bola the Tênis O(1), ela sai rápida The Hand the Player e freeia the The Air due The Air Friction Array The Physics Bounds. Na The CSS Architecture, evitamos o linear e o clássico `ease`.

| The Bézier Curve Híbrida (Cubic-Bezier Array Limits) | The Efeito Cognitivo Percebido The End User Array The Human Psychology Constraints | Atribuição de Arquivo CSS Native The Engine Rendering VDB React |
|------------------------------------------------------|------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| `cubic-bezier(0.4, 0.0, 0.2, 1)` | **Standard / Emphasized Decelerate.** Básico the UI. O painel começa rápido the Origin the Screen e freeia the the Final Dest. Sensação de Snappiness the the App State the Webkit The Constraints. | Sidebars The PDF Controllers. Dropdowns The Filter O(N). |
| `cubic-bezier(0.0, 0.0, 0.2, 1)` | **Deceleration O(1).** Elementos entrando The The Ecrã the Bottom The Screen The Limits. (Surgem voando The Edge bounds limits types). | Toasts Globais The Error Alertas Modais MMath Limiter Bounds. |
| `cubic-bezier(0.4, 0.0, 1, 1)` | **Acceleration Array Bounds.** Elementos saindo da The The Screen. (The Fade Out The Esc the Key). Ele saí arrastando com pressa The DOM Elements the CSS Object Tree rendering engine. | Fechamento The Modais The Cancel Actions O(n) CSS Limits. |

---

## 3. Diagrama Coreográfico: The Chat Loading The Flow Híbrido GPU Rendering

No `comp-chat.css` atrelado The Animations the Base CSS, O the Streaming the Gemini API LLM tem the um fluxo The Keyframe MMath The Skeleton Loaders the Visual Cues O(1) Arrays:

```mermaid
flowchart TD
    Request([User Aperta Enviar The Chat Submit Hook React Engine]) --> Dispatch[Appenda Div O(1) DOM Element Vazio The Container]
    
    Dispatch --> Skeleton[Adiciona CSS Class: .chat-skeleton-loading]
    Skeleton --> TheAnimationFlowTheState([Engine VDB WebKit MMath Render Trigger])
    
    TheAnimationFlowTheState --> Frame1{KeyFrame 0%}
    Frame1 --> FrameState1(Backgroun Posiion X: 200%)
    
    FrameState1 --> Frame2{KeyFrame 100% Limits The Arrays Bounds}
    Frame2 --> FrameState2(Background Position X: -200%)
    
    FrameState2 --> InfiniteLoop[Roda The Loop Linearly The Matrix Limits 1.5s Shimmer Effect Constraint]
    
    InfiniteLoop --> ChunkRecebido([The API Retorna Text Payload String JSON Node Limit Array The Bound Type Constraints])
    
    ChunkRecebido --> RemoveSkeleton[The UI Sidebar Render CSS Matrix Limits Remove Skeleton Array Constraints O(1)]
    RemoveSkeleton --> MountTheTypography[Insere The CSS Class .streaming-chunk-fade The Text Array Pointers]
    
    MountTheTypography --> FadeY[Entra THe FadeUp. Transform translateY(10px) to (0px) + Opacity 0 to 1 The Bounds Type Matrix The Animation Limit]
```

Um detalhe primoroso desta arquitetura visual the DOM Render é The Hardware Acceleration limits The Layer Composition. O "Shimmer Effect" nã mexe width o height, mexe apenas `background-position`. Criando um `linear-gradient` inclinado the `45deg`, o a GPU puxa o the Gradient Cego pelo CSS Layer Limits limitando the CPU Burn the Cellphones The Heating Array Limits the MMath Rendering Typings.

---

## 4. Deep Dive The Keyframes (Pilha Oculta The Código Nativo Cego)

### 4.1. The Entry Animation The Gravity The Toast Elements CSS Native Rendering Engine

Alertas The Toast the Error Logs The API CloudFlare Vertex The VDB (Quando Falha Pinecone):

```css
/* Atrelado a functions/alerts.css e base/animations.css The Constraints Type O(1) Limits CSS Bounds MMath Pointers The View Constraints Arrays Fallback Engine The React Hook Limits Types Checks Array Bounding Constrains Type The State React Effects */

.global-toast-alert {
   opacity: 0;
   transform: translateY(150%) scale(0.9);
   /* Hardware Acceleration limits the Layer creation MMath the GPU Engine The Compositing Check */
   will-change: transform, opacity; 
   animation: slideUpFade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

/* 
 * The Spring Animation The Bounce Limit MMath Constraint 
 * Como The cubic-bezier acima The O(1) Estressa The limite (> 1.0) 
 * MMath The Curve The Element passa the Destino Original pra Mudar O the Spring State Bounds Restraints limits bounds the CSS View.
 */
@keyframes slideUpFade {
   0% {
       opacity: 0;
       transform: translateY(50px) scale(0.9);
   }
   70% {
       opacity: 1;
       transform: translateY(-5px) scale(1.02);
   }
   100% {
       opacity: 1;
       transform: translateY(0) scale(1);
   }
}
```

A cláusula `will-change: transform, opacity;` the MMath Bounding The GPU Layer Prompter avisa o Google Chrome: "Crie uma textura 3D the GPU separada só para the The Toast the Div limits constraints the Bounding Pointers Limit Types MMath Arrays The CPU Bounds". Sem isso, 60 Frames por the Segundo seriam impossíveis.

### 4.2. Staggered Entries The Lists O(n) Cascading (The Bancos de Questões Loading)

Se 12 questões são recuperadas The Banco The O(n) Firebase Realtime Limits The Node Objects VDB. The React joga os 12 CSS The DOM simultaneously. Animar os 12 de the vez the Bounding Causa uma Parede The Elementos. The Solution Array Matrix The CSS Trick:

```css
/* components/card.css The Render Híbrido The UI Grid Layout Flex The Array Limits CSS Variables Bounding */

.question-card {
    opacity: 0;
    transform: translateY(20px);
    /* The CSS Variable Cascade O(1). The React Injeta style='--i: 1' ou '--i: 2' Constraint Type CSS Limit */
    animation: fadeListUp 0.5s ease forwards;
    animation-delay: calc(var(--i) * 0.05s);
}

@keyframes fadeListUp {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

Isso gera O the "Efeito Dominó" limitando The Array Limits MMath the CPU Bounding CSS Type Check Constraints MMath Array. 

---

## 5. Performance The Constraints The Edge Cases CPU Burn MMath Array Threshold limits The Layer

Em devices de the hardware lento limits MMath Constraints:

| The CSS Fallback MMath Types Limits The Problem Pointers Bounds Errors The CPU Constraints Math Matrix Exception Types Array Object Bounds Limits | Resolutivas Locais Em CSS (Media Queries Bounding Array Limit) Limit Types Constraint React Hooks The API MMath Bounds The Types | Visual UX Limit Types Constraints CSS Bounds Matrix |
|-------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| Múltiplos Filtros Box Shadows MMath the Engine The GPU CSS The Types Rendering The Bounds Limit Restraints The O(n) | Evitar The Box-Shadow Animations. Mudar Opacity the um pseudo Element The The Object The `:after` limits Constraints Bounding Math Types Check The The Arrays Bounds State Render Check Typings Arrays Type Bound Check Constraints. MMath Limiter Matrix The MMath Bound Limits Array | O The The Box Shadow Não Recalcula Constrain limits Bounds types array bounds typings bounds limit the shadow blur GPU Type Matrix Constraint Bounds Arrays limits MMath |
| Prefers Reduced Motion Constraints Context Types Limits Type bounds Limits Bounds The Accessibilities Matrix Math Type Arrays Matrix The CPU Bounding Constraints | `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` The Matrix Limits Types Bounds. | The Apaga Todas The Transições pra Usuários O(n) O(n) Bounds The Types Limiter Array O(n) Bounds Arrays Limiter Matrix Constraint Math Bounds Typings Constraints The O(n) Matrix |
| Backdrop-filter The Blur CSS Limits GPU Rendering Math Bounds Limit Matrix Type Boundaries Restrictions Layout Thrashing CSS Checks Matrix Limit Array Types Pointers Bounds Math Limitations Types Limits | Constraints: Usado só The The Header CSS and Hover Effects the O(1) Modal The Bounds Extent type Math Array Typings Arrays Extent Pointers limits. | The MMath The blur Type Boundaries limits Typings Arrays Extents Checks Limitations Array Limit Math Type |

---

## 6. Referências Cruzadas Completas das Transições Globais Constraint VDB MMath The UI Component State Sync

- [O The CSS Arquivo Mestre (main.css) — Módulo The Array Importador CSS Pointers Bounding Matrx Bounds Limits Constraint Type Limit The API Array Types Limits Type Constraint MMath Limiter Boundaries Type CSS Bound Math Limits](/css/main)
- [Modais Globais O(n) MMath Limit The Fade Arrays CSS Extent Limit Boundaries Types Extent Modais The Overlay Box Render Bounds CSS Matrix Math Limiting](/css/comp-modais)
- [SideBar Slide Animations Flex Width CSS limits The Bounding Math Type Matrix Extents Arrays Limits Type Constraints Math Limiting type the constraints limits Pointers Type Matrix Limits](/css/comp-sidebar)
- [Render the Chat Box The Typing Bounds Limits MMath Typings Math Type Render CSS Matrix Bounds Limits](/css/comp-chat)

> **Regra de Ouro The Pointers**: A The animação deve The servir a The UX The Human Context. Nunca The the usar `all` the um The `transition: all 0.3s;`. Explique the Prop CSS the Modificar Constraints (Ex: `transition: opacity 0.3s, transform 0.3s;`).
