# Scanner UI — Terminal Flutuante de Extração

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+scanner-ui&labels=docs)

## Visão Geral

O módulo `scanner-ui.js` (`js/ui/scanner-ui.js`) centraliza a interface visual de **controle global** da engine de OCR do Maia. Diferente do `SidebarPageManager`, que gerencia abas individuais de páginas, o `ScannerUI` é a "Bussola de Comando" do usuário, exibindo tempos, permitindo pausas/cancelamentos e injetando um visual arrojado (Floating Widgets e Glows). 

Com 483 linhas de código, este módulo integra o status da extração da Inteligência Artificial em dois domínios visuais: o Header Fixo no topo da Sidebar e um painel "Floating" inteligente que persegue a rolagem para nunca sumir da tela.

## Domínios de Renderização (Arquitetura Dual-Header)

A grande sacada de UX (User Experience) deste módulo é ter desenvolvido um observer para o escopo PDF. Durante a varredura do arquivo PDF, usuários tendem a scrolar furiosamente para baixo para ler as sub-questões e ver logs de output (`thoughts`). Isso ocultava os botões de cancelar a IA. O ScannerUI mitigou isso.

```mermaid
flowchart TD
    ScannerUI[ScannerUI Object] --> OBS[IntersectionObserver]
    
    OBS --> |Visível| FixHeader["ai-scanner-global-header (Topo da Sidebar)"]
    OBS --> |Invisível| FloatBox["ai-floating-controls (Painel Overlay)"]

    FixHeader --> CF[Controles Físicos]
    FloatBox --> CF
    CF --> BtnPause[⏸ Pausar]
    CF --> BtnResume[▶ Resumir]
    CF --> BtnStop[⏹ Parar]
    
    BtnStop --> ModConfirm[Confirm Modal]
    ModConfirm --> |Confirma| AIS[AiScanner.stop()]
```

### O Intersection Observer (`startUiObserver`)

O ouvinte monitora o encolhimento superior da Sidebar. Se o `<div id="ai-scanner-global-header">` sair da tela (`isIntersecting === false`), o sistema ativa uma classe CSS `.visible` que desliza brutalmente os controles flutuantes `ai-floating-controls`, travados por `position: sticky` ou `absolute` no footer visualizador.

```javascript
this._uiObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        floatingHeader.classList.remove("visible"); // Esconde flutuante
      } else {
        floatingHeader.classList.add("visible");    // Mostra flutuante
      }
    });
}, { root: sidebarContainer, threshold: 0 });
```

## A Dança dos Estados de Execução (Pending States)

Aplicações de OCR com LLMs de longa latência sofrem de cliques fantasma (Ghost Clicks) na interrupção — o usuário aperta Pausa, o request do Gemini não volta do Cloud, ele aperta de novo causando Crash ou Duplicação. 

Para refutar isso, `setPausePendingState` foi modelado:

```javascript
setPausePendingState() {
  const mainTitle = document.getElementById("ai-header-title");
  if (mainTitle) mainTitle.innerText = "Pausando...";

  // Desabilita TODOS os botões durante o pending (Evita multi-click)
  [btnPause, btnResume, btnCancel].forEach(btn => {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
    }
  });
}
```

Quando o Scanner de fato atinge um Node Assíncrono seguro (ex: entre chunks de imagens), ele avisa via `onScannerPaused(isPaused)` que a paralisação foi bem sucedida. Então, os botões tornam-se azuis/disponíveis novamente e o ícone alterna de Pause (`btnPause.style.display = "none"`) para Ceta de Resumir (`btnResume.style.display = "inline-flex"`).

## Glow Dinâmico de Extração

A função `toggleGlow(active)` pinta o background da tela com luzes radiais ou sombras dinâmicas de rastreamento (`ai-glow-overlay`). Isso aciona o modo foco, instigando visualmente o usuário de que computação onerosa está correndo nos bastidores, coibindo-o de trocar de aba acidentalmente ou forçar recarga da SPA. Quando `cancelled = true`, o Glow é desligado.

## Referências Cruzadas

- [Sidebar Pages Manager — A lista de páginas listada ABAIXO do ScannerUI](/ui/sidebar-pages)
- [AiScanner Module — Motor abstrato de backend ativado por estes botões](/services/ai-scanner)
- [Pdf Embed Renderer — Canvas onde o Scanner enxerga](/ui/pdf-renderers)
