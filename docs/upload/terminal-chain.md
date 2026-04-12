# Terminal Chain — Representação da Cadeia de Pensamento Lógico (CoT)

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+terminal-chain&labels=docs)

## Visão Geral

O arquivo de abstração (embutido lógicamente na rotina de UI e parsing) encarregado da `Terminal Chain` mapeia como os Logs convertidos do Cloud Engine tornam-se Cards visuais auto-destrutivos ou persistentes dentro do Modal de Upload (`TerminalUI`). A técnica Chain of Thought (CoT - Cadeia de Pensamentos) consiste em printar na tela não o resultado isolado, mas o trilho de raciocínio lógico pelo qual a "Inteligência Artificial" cruzou para chegar a uma veredito.

Ancorado em cerca de 400 linhas de estilos CSS (`.term-chain-stream`, `.term-thought-card`) e nós condicionalizados de DOM API, ele materializa o "Ghost Process" (Processo Fantasma) para o professor, reduzindo drásticamente a ansiedade gerada durante as extrações.

## Arquitetura de Rendição (AppendChainThought)

Como o Terminal antigo imprimia apenas strings chapadas no terminal estilo Matrix, a experiência de leitura parecia indecifrável para não-programadores. O novo framework abandonou `.innerText = text` para utilizar Nodes Card estruturados.

Quando o sistema de Upload invoca internamente `terminalInstance.appendChainThought(texto, type)`, o renderizador toma ação:

1. **Destruição do Stub Ocioso**:
   A mensagem fantasma inicial `"As tarefas do agente aparecerão aqui..."` incrusturada no topo da DIV sofre `remove()` ou injeta opacidade zero para sumir permanentemente na primeira injeção ativa.

2. **Criação Flex**:
   Ele constrói um DOM Node `<div class="term-thought-card">` forjado não só para o texto cru, mas com `border-left` dinâmico atrelado ao `Type` recebido do `LogTranslator` (Azul Sistêmico, Laranja Warn, Verde Success).

3. **Injeção de Prefixos Visuais (Icons)**:
   Baseado numa mini-tabela de verificação léxica embutida:
   - Se o tipo é `in_progress`, recebe um spinner CSS puro `<div class="term-spinner"></div>`.
   - Se o tipo for persistente (sucesso final de bloco), injeta um ícone esolidificado (ex: `📦`).

## Mecanismo de Prevenção de Transbordo (Overflow Lock)

A Inteligência Artificial do Google/OpenHands pensa incansavelmente no Terminal, emitindo algo próximo de 5 "Thoughts" (pensamentos/observações) por segundo quando o Container Docker dispara comandos internos. O Container do Cloud Worker não restringe loggings. Se pintássemos isso cegamente no HTML, o DOM estouraria por Memory Leak em menos de uma tela.

### O Auto-Trash Garbage Collector

A Chain Stream limita estritamente os frames visuais renderizados na coluna por vez:
```javascript
const maxCards = 5; // Apenas 5 blocos simultâneos existem graficamente
const currentCards = this.el.chainStream.querySelectorAll(".term-thought-card");

if (currentCards.length >= maxCards) {
   currentCards[0].remove(); // Destrói o primeiro da pilha (O mais antigo) e tira da RAM
}
```

Essa destruição orgânica com limitações severas (`maxCards = 5`) produz aquele efeito estético de "Waterfall" acelerada que flutua o Painel do Terminal. Como as bolhinhas aparecem e removem o topo automaticamente, a sensação de velocidade da IA aparenta ser altíssima, mascarando gargalos reais de Rede na Nuvem.

## Referências Cruzadas

- [Log Translator — Alimentador base das strings mastigadas deste módulo](/upload/log-translator)
- [Terminal UI — Contêiner global que inicializa todo o ecossistema gráfico](/upload/terminal-ui)
- [Pesquisa Lógica (Deep Search) — Rota impulsionadora dos fluxos persistentes exibidos na tela](/upload/search-logic)
