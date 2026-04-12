# Sidebar Pages Manager — Gestor de Hubs de Auditoria de Páginas

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+sidebar-pages&labels=docs)

## Visão Geral

O módulo `sidebar-page-manager.js` (`js/ui/sidebar-page-manager.js`) é responsável pela montagem dinâmica e do controle de estados da barra lateral esquerda da aplicação durante fluxos de visualização de conteúdo (Upload/Scanner). Comandando >500 linhas de código do lado do DOM, ele permite que a `viewerSidebar` atue como um Hub multifuncional com suporte a múltiplos "Details" (`<details>`) expansíveis que agrupam Cards de Pensamento (Agentes IA) ou Questões por Página de PDF digitalizada.

Este gerenciador substitui o modelo estático antigo que apenas injetava strings, introduzindo uma manipulação orientada-a-estados das abas e preservação histórica de Chain of Thought dos diferentes agentes (Análise, Auditor, Sistema).

## Arquitetura de Hub-Agnóstico

```mermaid
graph TD
    INIT[SidebarPageManager.init(totalPages)] --> Check[Verifica 'sidebar-tabs-header']
    
    Check -- Falso (É Scanner) --> NEW[Cria 'sidebar-pages-container']
    Check -- Verdadeiro (É Questão) --> SKIP[Ignora criação base / Preserva Hub]

    NEW --> GET[getPageElement(pageNum)]
    
    GET --> DET["<details id='page-details-X'>"]
    DET --> SUM[Summary + Botão Scan Mágico]
    DET --> AL["Agent Status Container (Log de IA)"]
    DET --> QC["Questions Container (Cards)"]
    
    AL --> TH[Cards do Chain of Thought da IA]
    QC --> QL[Botões de 'Adicionar Manual' ou Cards do Banco]
```

## A Lógica Dinâmica de Inserção de "Pensamentos" da IA (`updateAgentStatus`)

Conforme a [Cadeia Terminal de Upload](/upload/terminal-chain) dita ordens, a IA emite "Chain of Thoughts" brutos em formato de texto. O `updateAgentStatus(pageNum, agentType, text)` destrincha e enriquece este log.

### Extração Avançada via `splitThought`

A função consulta a base utilitária em `thoughts-base.js` para estraçalhar textos crus (ex: `"Analisando geometria..."`) em Títulos e Corpos:

```javascript
// 2. Extrair dados com splitThought
const thoughtData = splitThought(text);
```

### Inteligência de Display Visual

Se o Agente disparou uma das strings consideradas "Status Keywords", todo o componente reage visualmente sem requerer corpo detalhado. Exemplo: se vem `text.trim() === "Interrompido."`, a interface forja um Card especial vermelho. 

Se vem `"Nada a auditar."`, e a página não forçou OCR extra, ele emite o "Empty State":
```javascript
if (agentType === "auditor" && thoughtData.title === "Nada a auditar.") {
  customBody = "Nenhuma questão selecionada/encontrada para essa página.";
  this.updatePageFooter(pageNum); // Engaja o empty box
}
```

## A Engrenagem de "Empty Pages" x "Filled Pages"

Para uma UX menos frustrante, implementamos o conceito dual nas rodapés das abas (`updatePageFooter`):

| Condição | Comportamento Visívo | Gatilho JS |
| -------- | -------------------- | ---------- |
| Empty (0 Questões Reais Detectadas) | Mostra uma Box Inteira com linhas tracejadas grandes: *"Nenhuma questão encontrada..."* e bottonzão primário ➕ Adicionar Questão. | `.classList.contains("cropper-group-item") === false` |
| Filled (>0 Questões Detectadas) | Apaga as tracejadas grandes, e anexa um discretíssimo botão sem bordas *"➕ Adicionar Outra Questão"* embaixo dos list calls. | Detectou >0 Filhos Reais |

Esse sistema bloqueia a UI de poluir-se visualmente onde a página já foi densamente carregada com 10 questões, tornando o "caminho feliz" discreto para adendos e o "caminho infeliz" gigante e salvador para PDFs lidos em branco.

### Transição Mobile Seamless e Drag Binding

Curiosamente, o Manager foi desenhado para se entrelaçar aos handlers da UX Mobile moderna. Observamos isso nas rotinas de clique de Adicionar, que fecha automaticamente a Sidebar no Mobile:

```javascript
_handleAddClick(e, pageNum) {
  e.stopPropagation();

  // [FIX] Mobile: Fecha sidebar para user ver o PDF ao criar/editar
  if (window.innerWidth <= 900) {
    import("../viewer/sidebar.js").then(({ esconderPainel }) => esconderPainel());
  }

  // Encaminha engine de cropping para a pagina escolhida:
  import("../viewer/pdf-core.js").then(({ irParaPagina }) => {
    irParaPagina(pageNum);
    // ...
  });
}
```

Essa assincronicidade dinâmica de imports (`import(...)`) alivia o bloqueio da tag `<script>` no payload inicial do projeto, invocando o OCR pesadíssimo `.js` de arrasto estritamente quando ativado.

## Referências Cruzadas

- [Thoughts Base — Onde o parsing SplitThought vive](/sidebar/thoughts-base)
- [Scanner UI — Terminal superior orquestrando este manager globalmente](/ui/scanner-ui)
- [Mobile Review — Documentação do comportamento Mobile que fecha esta Sidebar](/render/mobile-review)
- [Terminal UI — Logica paralela na UI clássica de progressão](/upload/terminal-ui)
