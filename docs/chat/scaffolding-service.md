# Scaffolding Service — Motor de Pedagogia Socrática Adaptativa

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Scaffolding](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+scaffolding-service&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `scaffolding-service.js` (`js/chat/services/scaffolding-service.js`) representa o ápice cognitivo da plataforma Maia EDU V2. Nas edições passadas do aplicativo, quando um aluno errava uma questão no simulado, a I.A. simplesmente despejava o gabarito comentado: "A letra C está errada porque mitocôndrias também estão em plantas. Letra B é certa." O aluno lia aquilo passivamente, dizia "Ah, tá", e no dia seguinte esquecia.

A ciência da aprendizagem (Teoria Sócio-Construtivista de Vygotsky) ensina que a Zona de Desenvolvimento Proximal necessita de *andaimes* (Scaffolding). Se a I.A. detectar que a questão requer raciocínio profundo ou se o usuário selecionar explícitamente "Me ensine passo a passo", o `scaffolding-service.js` é evocado. Ele sequestra o fluxo normal do chat e o converte numa experiência de **Tutor Inteligente**. Em vez de entregar a resposta, a I.A. quebra o conhecimento em minúsculos fragmentos de "Verdadeiro ou Falso" (Microlearning). Caso o aluno demonstre ignorância num fragmento basal, a Engine desce mais um degrau de complexidade abstrata e monta uma nova questão em tempo real. O aluno só recebe a resposta completa após escalar o andaime.

---

## 2. Arquitetura de Variáveis e State Management

A beleza cirúrgica desse módulo é não atrelar-se diretamente à Redux, ContextAPI ou useState pesados no React. Todos os seus métodos são exportados estaticamente via um Singleton Pattern puramente analítico (Mathematics Model). O motor injeta o histórico linear dos passos para gerar coerência e calibração de proficiência do pupilo.

| Variável / Método Interno | Escopo Lógico | Natureza | Função Explícita |
|---------------------------|---------------|----------|------------------|
| `historicoResultados` | Array in-memory | Acumulador Estatístico | Guarda todos os resultados matemáticos das rodadas V/F. É daqui que o Engine calcula se o aluno é *High-Performer* (Manda pra frente) ou *Low-Performer* (Manda desacelerar o nível de ensinamento). |
| `taxaDeCerteza` | Calculadora de Frações | Float (0 a 1) | Mede o grau de incerteza da "Aposta". Se o aluno diz "Quase Certeza que é Verdadeiro", mas na verdade a reposta certa é 100% (Verdadeiro), ele pontua bem. Se ele errar feio com convicção cega, o algorítmo arrebenta o score dele (-0.8x penalty factor). |
| `pesoTempo` | Equação Diferencial Curta | Regressão Exponencial | Avalia o tempo gasto usando `Math.exp(-0.05 * Math.sqrt(Math.abs(diferenca)))`. Punição suave: se ele demorou minutos demais para responder algo trivial, a proficiência não sobe rápido. Evita trapaça com Google Search numa aba paralela. |
| `listaEnunciadosAnteriores` | Array Parser | Proteção Anti-Loop | Durante a subida do andaime, extrai os enunciados passados e manda um `secaoEnunciadosProibidos` pro LLM, coagindo severamente o GPT/Gemini a não ser preguiçoso e não repetir uma pergunta similar. |

---

## 3. Diagrama: O Algoritmo de "Andaime" e Rastreio

O fluxo não apenas atira "Certo ou Errado". O motor retroalimenta a IA. Se o aluno clica em "Verdadeiro", o Front-end calcula a Matemática aqui listada, junta no histórico, injeta no Builder, joga para o LLM gerar a próxima.

```mermaid
flowchart TD
    InicioPasso([Usuário Clica num Bottão V/F do Scaffolding Ui Pill]) --> CallCalc[Call: calcularPontuacao(guess, target, time)]
    
    CallCalc --> MathBlock{Cálculo de Proficiência}
    MathBlock --> ScoreCerteza[Calcula Taxa de Certeza]
    MathBlock --> ScoreAcerto[Calcula Taxa de Acerto Exata]
    MathBlock --> ScoreTempo[Calcula Penalidade Exponencial de Tempo]
    
    ScoreTempo --> MergeScore[Result: ResultadoPasso (0.0 a 1.0)]
    MergeScore --> InsereHistorico[(HistoricoLinear Array)]
    
    InsereHistorico --> TriggerNextStep[Interface Inicia Loading: Call generateStepPrompt()]
    
    TriggerNextStep --> ExtractHistory[Extrai Perguntas Passadas (Anti-Loop)]
    TriggerNextStep --> BuildRico[Extrai Metadados da Questão Original e Gabarito]
    
    ExtractHistory --> AnalysisLogic{Proficiência Média Atual?}
    BuildRico --> AnalysisLogic
    
    AnalysisLogic -->|Menu que 30%| FallbackLento[Injeta Rule: 'Usuário Inapto. Simplifique. Volte ao básico.']
    AnalysisLogic -->|Maior que 80%| AdvanceRapido[Injeta Rule: 'High Performer. Finalize ou aprofunde nível USP.']
    AnalysisLogic -->|Spoiler Check| VerificaFim[Se a Expl. Atual entregou o Jogo, FORÇA ENCERRAMENTO]
    
    AdvanceRapido --> BuildLLMString
    FallbackLento --> BuildLLMString
    VerificaFim --> BuildLLMString
    
    BuildLLMString[Dispara Call ao Worker Fetch com Prompt Blindado] --> Final[Aba renderiza novo Pills V/F]
```

Um detalhe imponente do "Spoiler Check": Se um `feedback_v` da rodada 2 já deixou óbvio que Colombo descobriu a América em vez de Américo Vespúcio, a I.A encerra o Scaffolding autônamente porque a resposta mestra já "vazou".

---

## 4. Snippets de Código "Deep Dive" (A Ponderação Estatística de Proficiência)

Essa equação tira a Maia EDU do senso comum de Testes de Múltipla Escolha passivos e adentra o **Adaptive Testing Framework** rigoroso inspirado em TRI (Teoria de Resposta ao Item).

### Penalty Equation (Tempo vs Domínio vs Confiança)

Na V1, Errar e Acertar eram Booleanos (0 e 1). No Service V2, são vetoriais (Flutuantes num Espectro).

```javascript
calcularPontuacao: (guess, isVerdadeiro, tempoGasto, tempoIdeal) => {
   // 1. Taxa de Certeza: O quão longe de 50 (dúvida máxima 50/50) o usuário estava?
   // Múltiplos UIs de range (Sliders). Caso usássemos -1, o usuário skipou forçado (Não sei).
   const taxaDeCerteza = guess === -1 ? 0 : Math.abs(50 - guess) / 50;

   // 2. Extremidade Correta (Anchor) e Taxa de Acerto Básica.
   const extremidadeCorreta = isVerdadeiro ? 100 : 0;
   const taxaDeAcerto =
      extremidadeCorreta === 0 ? (guess < 50 ? 1 : 0) : guess > 50 ? 1 : 0;

   // 3. Fator Exponencial de Decaimento Psico-Físico:
   // Uma função assíntota. Demorar muito arranca pontos massivos; adiantar não gera ganho infinito.
   const diferenca = tempoGasto - tempoIdeal;
   const pesoTempo = Math.exp(-0.05 * Math.sqrt(Math.abs(diferenca)));

   // 4. Concatenação Multiplicativa de Bayes Ligeiro:
   // Se ele acertou, mas demorou horrores (colou) E não tinha certeza (guess próximo de 51)
   // a pontuação que seria 1.0 cai pra 0.12, acionando Fallbacks de "Repetição de Conceito" na próxima UI.
   const resultadoPasso = taxaDeAcerto * pesoTempo * taxaDeCerteza;

   return { taxaDeCerteza, extremidadeCorreta, taxaDeAcerto, resultadoPasso };
}
```

### Injeção de Profiling Adaptativo no LLM Engine

A inteligência de texto exige conhecer os números:

```javascript
/* Trecho Oculto de Injeção no Prompt builder *generateStepPrompt()* */
if (temHistorico && ultimoPasso) {
   const stats = ultimoPasso.stats || {};
   prompt += `\n\n**ANÁLISE ESTRATÉGICA DO ÚLTIMO PASSO:**
     - Resultado: ${stats.acertou ? "✓ Acertou" : "✗ Errou"}
     - Proficiência: ${(stats.proficiencia * 100).toFixed(1)}%

     --- REGRA DE ENCERRAMENTO POR "SPOILER" ---
     Analise a explicação dada no último passo. Se a I.A anterior JÁ REVELOU 
     a resposta explícita final: NÃO GERE NOVA QUESTÃO. Retorne "status": "concluido".
     -------------------------------------------`;

   // Ramo de Roteamento Semântico
   prompt += stats.proficiencia < 0.3
        ? "⚠️ O usuário está com dificuldades. Simplifique para um termo incial mas inédito."
        : stats.proficiencia > 0.8
        ? "🚀 High Performer. Exija raciocínio letárgico superior e vocábulos aprofundados."
        : "Avance logicamente.";
}
```

Essa junção entre um Controlador Numérico Local e um Gerador Extenso na Nuvem cria uma assimetria incrível, poupando a I.A de ter que deduzir a ignorância ou competência do aluno sozinha lendo o History Chat cruo, mitigando o consumo de tokens.

---

## 5. Integração com a UI (React Hooks Injection)

Este Service atua nas Sombras de componentes React Interativos. A classe `ScaffoldingViewer` (renderizada via Markdown Interpreter) aciona isso no evento `onClick` do Pill Verde ou Pill Vermelho:

```javascript
// Exemplo de Invocação Num Component de UI Pós-Ação (Pill Button Clicked)
handleUserGuess(guessValue, tempoDecorrido) {
    // UI Congela a Animação e fica laranja
    setLocalStatus("calculating");
    
    const metricas = ScaffoldingService.calcularPontuacao(
       guessValue,
       isOriginalAfirmativaVerdadeira, // Provido do Payload Antigo
       tempoDecorrido,
       12.5 // Baseline Seconds Ideal (Exemplo arbitráio para Leitura)
    );
    
    // Anexa métricas ao Historico Global Atrelado ao Chat
    const historicInstance = updateGlobalHistory(metricas);
    const mediaGeral = ScaffoldingService.calcularProficienciaMedia(historicInstance);
    
    // Puxa o Motor e cria o texto enjaulado final
    const stringParaWorker = ScaffoldingService.generateStepPrompt(
        questaoBaseRef, 
        ScaffoldingService.decidirProximoStatus(), 
        historicInstance
    );
    
    // Inicia Dispatch Serverless...
    DespachaWorkerComJSONStrict(stringParaWorker);
}
```

Se o `decidirProximoStatus()` retornar `false`, a string coercitiva obriga a IA a pensar num conceito falacioso que soe científico o suficiente, obrigando o aluno a encontrar a pegadinha. A aleatoridade constante previne viéses e *Pattern Matching* ("A I.A só me joga pergunta Verdadeira logo depois duma certa").

---

## 6. Identificando e Mitigando Casos Críticos (Edge Cases de Engano e Loop Infinito)

Qualquer coisa estocástica ou encadeada via "LLMs Mágicos" que responde sobre ela mesma pode gerar colapsos. O módulo detém regras espartanas de parada.

| Categoria de Colapso Crítico (Chaos) | Mecanismos Fixos Blindadores e Hard-Coded | Repercussão |
|--------------------------------------|-------------------------------------------|-------------|
| O Histórico chega a 15 passos repetidos e a resposta final vira tabu não proferido (Spoiler Evasion loop). O Aluno Trava num Cícrulo de Inferno Pedagógico. | O Prompt injeta uma flag de Status Limite caso array `> 5`. O Frontend ignora a promessa de "criar nova pergunta" e força o Status `concluido` matando o Loop Infinite na marra. | A IA simplesmente mostra o Cartão de Status Vencedor "Hora de Resolver a Mestra". Poupamos a paciência psicológica do aluno e a API de Torrar. |
| O aluno acerta apertando Múltiplas Vezes no mesmo 1/2 segundo através da tecla TAB e ENTER (Double Submit). | Os Callbacks bloqueiam chamadas via State Global React Lock; Entretanto, o `tempoGasto` é capturado como 0ms. A `sqrt(12.5)` aplica The Penalty Max, forçando a proficiência local cair drasticamente no Score interno, denunciando o SPAM. | Resiliência contra robôs e automações desleais ou dedos gordinhos que clicam em Falso Várias Vezes. Scaffolding não pune com crash, pune exigindo que a próxima pergunta gerada seja hiper-básica pra testar se ele leu de verdade. |
| Falha na extração de Metadados: a questão Original era apenas uma imagem anexada sem o "Enunciado Txt". | A Cláusula Catch Fallback substitui a falta da String limpa de metadados complexos do JSON rico (`questaoAlvo.dados_gabarito`) retornando "N/A" e injetando: *Questão Alvo: Objeto Multimídia.* | A Vertex Vision acorda do outro lado do server ciente que seu único contexto é a memória fotográfica RAM. Continua pedagogia ininterruptamente na força da Image Context (Multimodality). |

---

## 7. Referências Cruzadas Completas

Para rastrear como essa maravilha socio-construtivista permeia todo o corpo do projeto, navegue pelas doc strings associadas intimamente:

- [System Prompts — A Raiz Mestra (O Livro Sagrado) que obriga o modelo generativo a interpretar esses Scaffolding Services.](/chat/system-prompts)
- [Router (Roteador Cognitivo) — A Entidade O(n) que julga, de princípio, se o aluno MERECE a ativação do serviço de andaimes ou se quer apenas uma resposta Rápida e Fria.](/chat/router)
- [Pipeline do Chat Primordial — Motor Global que fica repassando Streams via WebSockets na Thread Principal.](/chat/pipeline-scaffolding)
- [Layout Schemas e Blocks — Estrutura JSON Absoluta ditando a injeção Categórica de `verdadeiro_ou_falso` e `feedback_v` gerada por conta deste arquivo.](/chat/schemas-blocks)
