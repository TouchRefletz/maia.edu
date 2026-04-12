# Scroll Sync — Acessibilidade de Barras Duplas (Top/Bottom)

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+scroll-sync&labels=docs)

## Visão Geral

O módulo `top-scroll-sync.js` (acompanhado por seu primo irmão `questions-top-scroll-sync.js`) resolve um paradigma complexo de User Experience (UX) focado na web. Áreas densas roláveis horizontalmente (como o Chat repleto de diagramas Mermaid largos, ou o Banco de Questões com 20 gabaritos abertos em linha) escondem a barra de rolagem (Scrollbar) se o usuário não rolou verticalmente até o fim do div. O usuário perde a noção de que os elementos vazam lateralmente.

A solução implantada nestes módulos — inspirada nos "Premium Scroll Indicators" —, injeta uma Mirror-Scrollbar (Trilha Espelho de Rolagem) forçada **Acima (Top)** das views sempre ancorada e responsiva. Com aprox 170 linhas de puro JS DOM, evita plugins pesados, operando nativamente calculando rácios matriciais do clientWidth.

## Arquitetura Matemática de Sincronismo

Não trata-se de um botão fantasma; é um thumb "draggable". Para que isso replique a barra nativa do sistema operacional (Windows/Mac) é usado cálculo progressivo:

```javascript
const scrollLeft = container.scrollLeft;
const maxScroll = container.scrollWidth - container.clientWidth;
const viewportRatio = container.clientWidth / container.scrollWidth;

// O tamanho matemático do thumb espelha o quanto estamos vendo em relação ao total
const trackWidth = track.clientWidth;
const thumbWidth = Math.max(60, trackWidth * viewportRatio); // Mínimo pra ser clicável

// Posição Exata do Thumb no Slider Virtual
const scrollRatio = maxScroll > 0 ? scrollLeft / maxScroll : 0;
const thumbLeft = scrollRatio * (trackWidth - thumbWidth);

thumb.style.width = `${thumbWidth}px`;
thumb.style.left = `${thumbLeft}px`;
```

Sempre que a caixa principal emiti `scroll` event, a barra superior sofre translação imediata na GPU.

## Binding Duplo (Drag & Click)

O UI Scroll reverte o caminho para atuar também como motor de controle, permitindo a barra real rolar a partir das touchs no Thumb criado:

1. **Draggability**:
   O `mousedown` ou `touchstart` agarram a delta-distância horizontal. Subtraímos essa variância e a devolvemos para `container.scrollLeft` empurrando o DOM cru.

2. **Track-Click-Jumping**:
   Se clicar na base fantasma lisa (`track`), ele projeta o alvo:
   ```javascript
   const ratio = clickX / track.clientWidth;
   const targetScroll = ratio * maxScroll;
   container.scrollTo({ left: targetScroll, behavior: "smooth" });
   ```

## Gestão de Resize e Mutações

O chat injeta bolhas que aumentam a div infinitamente (`subtree: true`). O Sync usa as APIs mais modernas da Browser Tooling para auto-correção:

```javascript
// Monitora redimensionamento de janela
if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(updateTopThumb);
    ro.observe(container);
}

// Monitora MUTAÇÃO (novas mensagens injetadas)
if (typeof MutationObserver !== "undefined") {
    syncMutationObserver = new MutationObserver(() => requestAnimationFrame(updateTopThumb));
    syncMutationObserver.observe(container, { childList: true, subtree: true, characterData: true });
}
```

Isso garante que em momento algum o Thumb de scrooll superior da IA perderá sinergia das fronteiras físicas virtuais criadas pelo overflow.

## Isolamento e Escalabilidade

Ao dividir as engines (`top-scroll-sync` focado estritamente na DOM constraint `.maia-ai-container` e `questions-top-scroll-sync` focando no hub `.questao-main-content`), a arquitetura isola os lixos da memória (`destroyTopScrollSync`) permitindo single-page-app routing não travar memory leaks.

## Referências Cruzadas

- [Chat UI — Layout com bolhas largas que exigem esta barra superior](/chat/chat-ui)
- [Questões Top Scroll Sync — Variância focada na listagem longa de cards](/render/questao-tabs)
- [Mobile Review — Lidando com rolagem táctil em baixo nível e UX mobile](/render/mobile-review)
