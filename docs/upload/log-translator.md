# Log Translator — Tradução Humanizada do OpenHands e GitHub Actions
> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+log-translator&labels=docs)
## Visão Geral
O arquivo `log-translator.js` (`js/upload/log-translator.js`) é a camada hermenêutica que traduz logs excessivamente técnicos, áridos e verbosos emitidos pelo backend (Google Cloud, OpenHands, GitHub Actions Runner) para uma linguagem compreensível, narrativa e amigável aos usuários (professores). 
Com quase 300 linhas de parsing condicional, ele funciona como um Dicionário de Expressões Regulares de Alta Performance, alimentando diretamente os visuais do `terminal-ui.js`.
## Padrão Estrutural: Parsing O(n)
Para não travar o Main Thread durante uma enxurrada de 2.000 logs em 3 segundos provindos de um WebSocket (Pusher), o compilador foge do uso abusivo de Regex pesadas, preferindo avaliações diretas `String.includes()`, muito mais eficientes no V8 Engine.
O array lógico está agrupado em 5 estágios narrativos:
1. **SETUP & INFRA** ("Runner Image Provisioner", "Pulling fs layer")
2. **AGENT** ("Adding search engine to MCP")
3. **EXECUTION FLOW** ("AgentState.RUNNING")
4. **DATA SAVING** ("Copying artifacts")
5. **SEARCH & SETUP** ("Verificando banco")
## Tradução Léxica por Estágios
Cada intercepção retorna um objeto rígido `{ text: "Mensagem Trocada", type: "system|info|success|warning|in_progress" }`. O Type vai injetar o pingo de cor correta lá no Terminal (Laranja, Verde, Azul).
```javascript
// O Agente Python cospe um erro de sistema complexo:
if (t.includes("Runner Image Provisioner"))
   return { text: "Provisionando infraestrutura isolada...", type: "system" };
// O Agente encontra um PDF gigantesco e baixa via Docker
if (t.includes("Pulling fs layer"))
   return { text: "Baixando camadas da imagem Docker...", type: "loading" };
```
### O Milagre da "Falsa" Simplificação
Apesar de parecer "Mentir" para o usuário, ao trocar `AgentController created new state` por `Sessão do agente criada. Pronto para iniciar.`, isto reduz a ansiedade de quem espera a Extração da sua prova. 
Caso um log seja ilegível ou desnecessário ("USER_ACTION", ou tags "OBSERVATION"), o Translator cospe `return null`, e a interface imediatamente "Pula" aquele frame da tela, purificando totalmente o ruído e exibindo apenas a "Cadeia de Pensamento" (Chain of Thought).
## Extrações Recursivas
O único bloco com Regex pura é aquele dedicado a capturar as variáveis intrínsecas de ações brutas do kernel:
```javascript
if (t.includes("CmdRunAction")) {
  const cmdMatch = t.match(/command="([^"]*)"/);
  // Captura magicamente o ls -la do comando original
  return { text: `Executando comando: ${cmdMatch[1]}`, type: "system" };
}
```
## Referências Cruzadas
- [Terminal UI — Onde a cor mapeada (type: "system") toma forma](/upload/terminal-ui)
- [Upload Log Translator — O irmão menor deste módulo focado em porcentagens fixas de Hash](/upload/upload-log-translator)
- [Terminal Chain — O ecossistema de encadeamentos por trás das visualizações](/upload/terminal-chain)
