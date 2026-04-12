# UI Modais Core — Gerenciamento Imperativo de Promessas

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+modais&labels=docs)

## Visão Geral

O arquivo `modal-confirm.js` (`js/ui/modal-confirm.js`) serve como o esqueleto base de diálagos da SPA do Maia. Em vez de depender de pesadas bibliotecas de UI components (MUI, AntDesign) ou sujar o HTML do Index com modais ocultos `<div style="display:none">`, o sistema constrói modais **dinamicamente on-the-fly usando a DOM API pura** (`document.createElement`).

Através de \~550 linhas de abstração, esses modais retornam `Promises`, permitindo um fluxo JavaScript sincrônico limpo (via `await`) sem pirâmides infernais de callbacks.

## O Fluxo Padrão via Promises

O padrão arquitetural de todas as exportações do arquivo consiste em interromper o thread visual abstraindo as interações `Confirmar | Cancelar` em Resolvedores de Promessas:

```javascript
const confirmed = await showConfirmModal(
  "Parar Extração?",
  "Tem certeza que deseja cancelar as GPUs de OCR?",
  "Parar",    
  "Voltar",
  false       // isPositiveAction: false (Gera botões vermelhos Themed)
);

if (confirmed) {
   AiScanner.stop();
}
```

Isso garante que fluxos críticos (ex: excluir um card, trocar título da prova, fechar sem salvar) aguardem humanamente pelo desfecho sem sujar o scope do caller.

## Comportamento Dinâmico (Mount/Dismount)

Nenhum vestígio do modal fica no DOM. O ciclo de vida é:
1. `document.createElement('div')` para Overlay, Body, Footer.
2. Inserção final no `document.body` e `requestAnimationFrame` que arranca a classe `.hidden`, induzindo as transições CSS de Fade e Sliding up do `custom-confirm-overlay`.
3. Evento: Botão, Overlay Clicado Escuro, ou Teclas escape/enter.
4. Fade Out Programático `overlay.style.opacity = "0"`.
5. `setTimeout(300ms)` > `document.body.removeChild()`.
6. Enfim, `resolve(value)`. 

## Constelação de Modais Existentes

1. **`showConfirmModal`**: Clássico "Ok/Cancelar". O argumento mágico é `isPositiveAction`, que dita a coloração do CSS Variable: `var(--color-primary)` (azul/verde de confiança) ou `var(--color-error)` (vermelho destrutivo).
2. **`showConfirmModalWithCheckbox`**: Para responsabilidades legais ("Li e aceito os riscos da chave client-side"). O botão Submit começa travado e escurecido (disabled), com handler ouvindo as mutações do Checkox para ativar-se.
3. **`showTitleConfirmationModal`**: Acionado antes da prova ir pro pipeline OCR, pede verificação do nome. Possui binding com inputs que dão auto-select no texto `input.select()` para digitação instantânea, devolvendo uma `String `ou `null`.
4. **`showPdfUrlModal`**: UI complexa que permite alternar a string remota injetada no componente PdfEmbedRenderer. Inclui validação de Regex string (exigindo "http/https"), caixa com link atual, e opção de reset ("Remover Link"). Retorna um struct rico `{ action: 'set|remove|cancel', url: '...'}`.

## Acessibilidade e Hotkeys (A11y)

Nenhum modal esquece dos power-users. Através de event listeners aninhados na Promize:
- `Escape` (Esc) trigga o `btnCancel.click()`, cancelando e resolvendo falsamente de forma imediata.
- `Enter` aciona instintivamente o `btnConfirm.click()`, validando inputs com auto-focus.
- O Click-Fora (clicar no fundo desfocado) age perfeitamente via validação `e.target === overlay` protegendo child-clicks, fechando o modal pacificamente.

## Referências Cruzadas

- [Scanner UI — Chama extensivamente estes modais para prevenir travamento acidental](/ui/scanner-ui)
- [Pdf Renderers — Usa o showPdfUrlModal para alteração remota de fontes](/ui/pdf-renderers)
- [ComplexityCard / Hibrid React — Os componentes React chamam o modais legado transparentemente](/render/complexidade)
