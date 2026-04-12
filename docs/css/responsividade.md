# CSS Responsividade — Breakpoints, Contêineres Fluidos e Adaptações de Layout OS-Native

> 🤖 **Disclaimer**: Documentação técnica expandida, gerada por IA e auditada. Desenvolvida para cobrir detalhes arquiteturais sobre Grid, Flexbox e limites impostos pela GPU e viewports em dispositivos móveis. [📋 Reportar erro no Módulo CSS Responsividade](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+css-responsividade&labels=docs)

## 1. Visão Geral e Contexto Histórico da Engenharia Responsiva

A arquitetura de responsividade da plataforma Maia (*maia.edu*) é fundamentada na premissa "Mobile-First" e no uso estrito de media queries combinadas com variáveis de design baseadas em `rem`, `vw` (viewport width) e `vh/dvh` (viewport height / dynamic viewport height). 

Ao lidar com aplicações web complexas como a Maia (que contam com chat iterativo em tempo real, manipulação de PDFs em canvas e renderização de dezenas de painéis laterais), a performance de "reflow" do CSS torna-se o principal gargalo em aparelhos de baixo processamento.

A abordagem adotada resolve três vertentes fundamentais:
O sistema gerencia a adaptação de layouts desde telas ultra-wide de monitores de grande porte, descendo graciosamente para telas de tablets (Modo paisagem e retrato), até culminar no design ultracompacto para dispositivos móveis de tela pequena (como o iPhone SE, possuindo laguras de apenas `320px`).

Os arquivos de núcleo, notadamente:
1. `responsividade/mobile.css` - Responsável pelas abstrações e quedas estruturais primárias do shell (menu, rodapé, body).
2. `responsividade/mobile-chat-redesign.css` - Responsável pelas margens internas, paddings, e bolhas de conversa do Chat AI.
3. `responsividade/mobile-review.css` - Arquivo vital para tratar como as views de revisão e banco de questões "quebram" nas bordas evitando overflows no eixo horizontal (`overflow-x`).

Estes arquivos trabalham em uníssono e em forma de sobreescrita de cascata em cima dos tokens globais, modificando lógicas pesadas de "Desktop" para implementações de single-column ou Flexbox em Mobile, garantindo a exibição limpa sem congestionar a _renderization tree_ da GPU em celulares.

---

## 2. Abordagem de Tokens: Estipulação Formal de Breakpoints

Em vez de poluir o código com _Magic Numbers_ arbitrários (e.g. `@media (max-width: 631px)`), a plataforma estabilizou as medidas numa estrutura matriz. 

### Breakpoints Definition (Native Limits Matrix)

O conceito gira ao redor do comportamento de viewports de Hardware, e não apenas regras empíricas:

```css
:root {
  /* Design Tokens - Breakpoints Oficiais */
  
  /* Celulares pequenos (ex: iPhone SE, Galaxy Fold Fechado) */
  --bp-mobile-sm: 320px;
  
  /* Celulares Médios a Grandes (ex: iPhone Pro Max, Androids convencionais) */
  --bp-mobile: 480px;
  
  /* Tablets em Orientação Retrato / Foldables em Orientação Total */
  --bp-tablet: 768px;
  
  /* Notebooks menores / Tablets em Orientação Paisagem (e.g., iPad Pro Horizontal) */
  --bp-laptop: 1024px;
  
  /* Monitores Desktop Convencionais / Padrão de Projeto Full */
  --bp-desktop: 1200px;
  
  /* Ultra-Wides / Monitores de Alta Densidade (4K Scaling) */
  --bp-ultra: 1600px;
}

/* Fallbacks principais via Media Queries aplicadas globalmente */
@media screen and (max-width: 768px) {
    /* Elementos puramente decorativos em desktop são obliterados aqui 
       para liberar DOM Tree processing. */
    .hide-on-mobile {
        display: none !important;
    }
}
```

O limite crucial (The Tipping Point) encontra-se aos `768px`. Acima deste valor, o motor de UI considera seguro renderizar Múltiplas Colunas (The Grid Method). Abaixo disto, a plataforma muda de modo e força The Stack Method (Empilhamento flex vertical).

### Tabela de Mutações de Layout (Grid para Flexbox)

Nesta seção as lógicas cruciais de tradução visual do CSS Grid são detalhadas:

| Classe CSS Alvo / Elemento | Regra Central CSS Injetada no Breakpoint | Mutação de Renderização e Impacto de UX |
|-----------------------------------------------|---------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `.layout-shell-container` | `@media (max-width: 1024px) { grid-template-columns: 2fr 1fr; }` | Remove gradualmente colunas laterais extras de perfis, mantendo 2 colunas: O conteúdo principal com maior ratio e a coluna de chat lateral. |
| `.grid-container.responsive` | `@media (max-width: 768px) { grid-template-columns: 1fr; width: 100%;}` | Colapsa as grades complexas que dividiam a página do "Banco de Questões" ao meio. A matriz passa a ser `1fr`, empilhando cada item de linha verticalmente para scroll no mobile.|
| `.flex-row.responsive` | `@media (max-width: 480px) { flex-direction: column; align-items: stretch; gap: var(--spacing-sm); }` | Força a mudança do eixo principal do Flexbox (de `row` para `column`). Em botões lado-a-lado, cada botão passará a possuir 100% de largura (`stretch`), adaptado à biometria do dedo. |
| `.sidebar-panel-left` | `position: fixed; z-index: 1000; transform: translateX(-100%); transition: transform 0.3s ease;` | O SideBar que ficava escorado do lado esquerdo desliza para fora do DOM Viewer nativo (-100% no eixo X). Ele invocará `hardware acceleration` ao voltar via `translate3d(0)`. |
| `.mobile-bottom-nav` | `display: flex; position: fixed; bottom: 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.1);` | Modifica a barra de guias superior escondendo-a completamente e transformando em uma Bottom App Bar típica de Super-Apps adaptado aos polegares em gestos basais de PWA. |

---

## 3. Diagrama Esquemático: Device Resize Waterfall & Component Fallbacks

A mutação não é instantânea, mas segue uma lógica condicional impulsionada pelo resize do browser. Em termos técnicos, a árvore de CSSOM passa pelos breakpoints na ordem cascata.

```mermaid
flowchart TD
    DeviceWidth([Evento `Resize` Visual / Carregamento Inicial do Dispositivo]) --> Cascading[CSSOM Cascade Override Engine]
    Cascading --> Evaluator[Navegador Avalia Breakpoints e Limites the Width]
    
    Evaluator --> UltraWide{Largura >= 1600px?}
    UltraWide -->|Sim| MaxWidthRestriction(Aplica `max-width: 1440px` no container central para preservar densidade e não 'esticar' o texto e os PDF views)
    
    Evaluator --> DesktopMid{Largura >= 1024px?}
    DesktopMid -->|Sim| ApplyGrid(Libera O Display:Grid. Ativa as Sidebars Esquerda e Direita simultaneamente)
    
    Evaluator --> TabletMode{Largura >= 768px?}
    TabletMode -->|Sim| ApplyTabletFlex(Redução de Margens (Remoção da Margem Esquerda de Respiro). Sidebars convertidas p/ Overlay-Drawers ativados por Menus Handlers)
    
    Evaluator --> MobilePure{Largura < 768px?}
    MobilePure -->|Sim| ApplyStack([O Grande Colapso: Força `flex-direction: column` em Cards. Fontes do Chat são reduzidas para 14px em vez the 16px. Todos elementos pegam 100% Width])
    
    MobilePure --> SafeArea[Injetar Compensações Ambientais via CSS `env()` variables nativas de System PWA APIs para proteger áreas the Notch e Bottom Nav Bar Virtual]
```

Um dos grandes destaques dessa adaptação fluida é a integração total com as **Áreas Seguras**, vitais para evitar desastres em UI UX, resultando em botões in-clicáveis e textos cortados.

---

## 4. O Sistema de SafeArea (Growing Engine e Compensação de OS Constraints)

Dispositivos modernos destruíram a precisão das bordas de tela. Entre entalhes de câmeras ("Notch" nas linhas iPhones, Dynamic Islands) e barras virtuais de navegação horizontais ("Home Indicators"), utilizar limites com valor "0" absoluto corrompe a UI.

Para resolver este erro arquitetural nativo, a Maia API implementou injetores dinâmicos de `padding` via variáveis ambientais do WebKit (`env()`), aplicados especificamente aos invólucros que atingem o final do Viewport:

### Código Core de Tratamento SafeArea (Zonas de Perigo)

```css
/*
  O Wrapper Base PWA — Envolve Toda a Aplicação
  A sua função não é dar padding padrão, mas garantir que NENHUM conteúdo
  ultrapasse as zonas designadas como "Hardware Obstacles" através dos Safe-Areas.
*/
.app-wrapper {
   /* Padding flutuante gerado em tempo de render com insets de segurança locais fornecidos pelo SO. Caso não haja obstáculo, a raiz (0px) atua como fallback seguro. */
   padding-top: env(safe-area-inset-top, 0px);
   padding-bottom: env(safe-area-inset-bottom, 0px);
   padding-left: env(safe-area-inset-left, 0px);
   padding-right: env(safe-area-inset-right, 0px);
}

/*
  O Problema da Barra de Mensagem do Chat Inferior.
  O rodapé de digitar que deve flutuar grudado logo acima do teclado.
*/
.mobile-chat-input-bar {
   position: fixed;
   left: 0;
   bottom: 0;
   width: 100%;
   /* O Cálculo Avançado Híbrido: A soma exata entre a densidade física que queremos para a UI do Input (60px) + qualquer altura de barra de restrição do Home Indicator (SafeAreaBottom). Evitando colisão the inputs */
   padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
}
```

Essa lógica do `env(safe-area-inset-bottom)` é imprescindível para garantir que, caso o utilizador de Mobile vá "bater" para enviar uma mensagem no input final, o clique não seja engolido pela ação de voltar ao ecrã inicial do OS Android/IOS.

---

## 5. Exceções Analisadas (Fallbacks Clínicos e Limitações Estritamente Mobile)

Não obstante aos ajustes padronizados de flexbox e safe-area, certos comportamentos e motores de layout do WebKit (Safari no iOS) e do Blink (Chrome Mobile) impõem anomalias conhecidas como UX killers, e requereram cirurgias CSS na base:

### A) The Dvh Dilema (O Problema do Mobile Safari 100vh)

| Cenário de Bug | Comportamento Destrutivo | Mitigação Local CSS Aplicada | Resultado Visual |
|----------------|--------------------------|------------------------------|------------------|
| O Viewport e o Scrollbar Flutuante | O Chrome/Safari dão Hide/Show em suas barras the navegação superiores e inferiores perante o arrastar de scroll. Ao declarar barras como `height: 100vh;`, elas escorrem 15% para BAIXO do Viewport verdadeiro cortando informações, pois o `100vh` não considera a Address Bar retraível. | `@supports (height: 100dvh) { .container { height: 100dvh; } }` e para os que não suportam, Fallbacks baseados na subtração de `calc(100vh - 60px)`. | Resolve a aberração the layout onde gavetas, popups e Sidebars laterais vazassem ou escondessem ações primárias de seus usuários devido ao limite incorreto do Browser. |

### B) The Hover-Lock e as Pseudo-Classes Presas ("Hoverless Context")

Em telas Multi-Touch, o mouse desaparece o conceito the *Hover*. Clicar para ativar o evento dispara a pseudo-classe `:hover`, porém a placa de vídeo recusa a revogar o evento ao remover o dedo. Resultando num botão ou elemento paralisado numa transição permanente (CSS "flickering" em celulares).

```css
/*
   Utilizando a consulta the Media Level 4 Interaction (Pointer & Hover Analysis).
   Garante que o Desktop exiba Efeitos de Hover, enquanto o Celular ignora de forma assíncrona todas as decorações problemáticas de toque, aliviando FPS e UX.
*/
@media (hover: hover) and (pointer: fine) {
    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(var(--color-primary-rgb), 0.3);
    }
    .question-card:hover {
        border-color: var(--color-primary-light);
    }
}
```

### C) iOS Forçando Zoom Ilegalmente em Inputs e Textareas

Quando um Input field com menos de `16px` de `font-size` em seu interior é pressionado num Safari the iPhone, o iOS considera inaceitável à visão e assume controle brutal de "Macro Zoom In". O Viewport se rompe, aumentando 120% para a tela forçada distorcendo modais complexos e forçando o utilizador a realizar "Pinch Zoom-Out" frustrantemente para conseguir ver o botão the Enviar ao lado do input.  

A cura para isso foi o Enforcement Radical em todos os nós tipográficos the `input`, `textarea` e `select` em queries de breakpoint < 768px:

```css
@media (max-width: 768px) {
    input[type="text"],
    input[type="number"],
    textarea,
    select {
       /* Limite de Escopo: A regra The Ouro da Apple impetrada ao WebKit engine. Nunca haverá distorção se a fonte não for ilegível de início.*/
       font-size: 16px !important;
    }
}
```

---

## 6. Lógica de Transições GPU-Accelerated em Mobile

Para garantir 60 quadros por segundo em Androids antigos quando transicionando menus e sidebars em telas the mobile, optamos pela transição no eixo matemático Matrix de transformação tridimensional que manipula os vértices do elemento utilizando o Compositor do Navegador (a sua Placa The Vídeo ou GPU the Cell SoC local):

```css
.sidebar-panel.mobile-view {
    /* Não usar left ou marign-left! Isso dispara the CSSOM Reflow Cycle a cada micro-segundo. */
    left: 0;
    transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
    /* Forçar promoção para compositing layer (GPU Acceleration) The Layer creation boundary */
    will-change: transform;
    transform: translate3d(-100%, 0, 0); 
}

.sidebar-panel.mobile-view.is-open {
    /* Rápido, leve, fluido The Rasterization */
    transform: translate3d(0, 0, 0); 
}
```
A propriedade secreta de alocamento à VRAM é o uso irrestrito the `translate3d`, em vez de `translateX` padrão ou, pior ainda, modificadores do box-model (`width`, `gap`, `margin-left`). 

---

## 7. Referências Cruzadas Completas da Documentação e Módulos CSS

Dado que a arquitetura the folhas is fragmentada (BEM Methodology Adaptado para Module Separation Pattern):

- [Arquitetura de Variáveis Base CSS (`variables.css`) — Contém toda a The Especificação estrita baseada nas designations the tamanho global e constraints limits the espaçamentos globais e paleta the cores.](/css/variables)
- [SideBar Animations Core CSS Layout (`comp-sidebar.css`) — Refina e restringe as margens do drawer de navegação e the histórico de questões na versão minimizada The Mobile Form Faction. Especificação de transições the Hardware Acceleration em GPU.](/css/comp-sidebar)
- [Componentização de Interface do Chat AI (`comp-chat.css`) — Exibe e trata the complexidade flex layouts de caixas message text box (Message Bubbles) do Chat. Reduzir e encurtar espaçadores para caber as palavras The AI Prompting Output limit.](/css/comp-chat)
- [Pdf Embed Canvas Viewport Constraints — Lógica para garantir O(1) de Scroll X Oculto em modais Overlay de The Pdfs the 8Mb.](/components/pdf-viewer)
