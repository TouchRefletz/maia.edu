# Pipeline Raciocínio (Deep Thinking e Cognição)

## Visão Geral e Necessidade Pedagógica

A **Pipeline Raciocínio** do ecosistema `maia.edu` (citada muitas vezes nos códigos como modo "Deep Thinking") foi forjada visando o extremo oposto do que busca a [Pipeline Rápida](/chat/pipeline-rapido). Operando invariavelmente mediante modelos de altíssima escala de parâmetros (como *Gemini 1.5 Pro* ou ramificações customizadas orientadas a matemática exata pesada), esta engrenagem é desenhada para estrangular a ansiedade sintática e se concentrar exclusivamente na excelência irrestrita de predição cognitiva.

Estudantes rotineiramente solicitam resoluções para dores analíticas densas — por exemplo: submeter o escopo inteiro de um TCC (Trabalho de Conclusão de Curso) complexo, inserir fotos de lousas da faculdade inteiramente distorcidas e cheias de equações obscuras de limite e derivadas, ou exigir explicações passo-a-passo sobre por que um artigo acadêmico desbanca o outro na interpretação de textos. O sacrifício de latência (TTFT mais elevado, chegando a vários segundos antes do byte textual aparecer em tela) é aceito voluntariamente para maximizar a assertividade, baseando-se agressivamente na técnica metodológica de *Chain-of-Thought (CoT)* aberta.

## Mecânica Traseira e a Flag de Arquitetura

O classificador (Router Mestre) é doutrinado de maneira inescrupulosa: se qualquer imagem fotográfica vier preenchida na Payload original, ou se detecção de predição der a classificação "ALTA", a rota para a Pipeline Lógica de Retenção é engatada forçosamente. 

O script inicializador encontra-se em `js/chat/pipelines.js`:

```javascript
// O Invasor Secundário para acionamento direto via UI ("Brain Status")
export async function runRaciocinioPipeline(message, attachments, context) {
  return runChatPipeline("raciocinio", message, attachments, context);
}
```

A grande revolução arquitetural é a modificação pesada na engine de **Streaming NDJSON Transversal**. Enquanto modeelos ingênuos pensariam por 15 segundos numa parede preta para vomitar o resultado mágico no final, nossa pipeline Raciocínio divide o fôlego computacional captando *meta-estados processuais* (`type:"thought"`) em real-time a cada passo calculado pela IA antes da finalização.

```mermaid
graph TD
    User((Usuário))
    Msg[Envia Questão do ITA 'Dinâmica Termomolecular']
    Router{Router: Complexidade?}
    Deep[Rota: Deep Thinking]
    Model[(Gemini PRO Engine)]
    ThoughtBox>UI: Renderiza Pensamentos Visíveis]
    FinalOut([UI: Renderiza JSON Estrutural Final Completo])
    
    User --> Msg --> Router
    Router -- ALTA --> Deep
    Deep --> Model
    
    subgraph Processamento Reflexivo Externo
        Model -- Stream: Emit "thought" --> ThoughtBox
        ThoughtBox -. Continua Pensando... .- ThoughtBox
        Model -- Stream: Emit "answer" --> FinalOut
    end
    
    FinalOut --> User
```

## A Invasão do Gap Detector

O modo Deep Thinking traz consigo a pesada subrotina atrelada aos serviços do Banco Mestre (Vetorial). É um padrão empírico irrefutável que quanto mais complexa uma dúvida formulada, maior o decréscimo de probabilidade do modelo alucinar e não portar nativamente em pesos (Weights) as memórias detalhadas necessárias. Para dirimir respostas falsas, esse pipeline age sinergicamente com a busca local de repositório Pinecone de forma ativa — e se nada for retornado satisfatoriamente, uma avaliação paralela invocará o mecanismo impuro de predição externa via Crawler ("Gap Detection").

```javascript
// A busca exata e não alucinatória é requerida
const questionData = await findBestQuestion({
  query: routerResult.busca_questao.conteudo,
  ...routerResult.busca_questao.props,
});

if (questionData) {
  // Mesmo em modo profundo, INJETA o documento literal no prompt base
  additionalContextMessage += `\n\n[SISTEMA - DADOS INJETADOS]: O usuário solicitou uma questão restrita. Use os dados abaixo para gerar o bloco 'questao' na resposta. Não invente ou alucine fatos! Base:\n${JSON.stringify(questionData.fullData)}`;
  
  // A execução de Background do Analisador RAG
  checkQuestionRelevance(query, questionData, apiKey, signal).then(...);
}
```

Deste modo, bloqueia-se com punhos pesados a tendência fatalista em *LLMs Deep* de "criar histórias fantásticas ou aproximações inventadas" quando instigadas sobre fatos fechados.

## System Prompt Racional (A Engenharia por Trás)

Diga como você quer e terá exatamente aquilo. A instrução do Raciocínio Profundo (`getSystemPromptRaciocinio()`) usa um construto semântico estendido. Diferente das lógicas enxugadas do modo rápido, nesta fase exigimos as ordens absolutas:
- **Divague Profusamente:** O modelo é encarecidamente instruído a pensar "Alto" (descrevendo a operação) antes de emitir respostas. Se é uma questão de matemática, tem de esboçar equações elementares no buffer `thought` provando por (A + B) os sinais lógicos antes de preencher a string "resposta final" baseada num `block` LaTeX oficial.
- **Auto-Correção Intrinseca:** O Prompt ordena que a IA se autoavaliem duramente quando encontrarem hipóteses concorrentes — e é expressamente encorajada a descartar trilhas de CoT defeituosas explicitamente no texto ("*Ah, aguarde, essa regra não se aplica sob condições isobáricas. Retomando via...*").

## UX/UI Pela Transparência

Quando um processo vai demorar 10 a 20 segundos em uma plataforma conectada moderna, o silêncio é a falha máxima de experiência interacional. O pipeline resolve este fato ao expor um *balão estético expansível na UI do chat*.

Isso provém de uma manobra contínua em `pipelines.js`:
```javascript
  let accumulatedThoughts = []; // Memória retentora dos buffers

  const fullResponse = await generateChatStreamed({
      //... config longa e densa ...
      onThought: (thought) => {
        accumulatedThoughts.push(thought);
        // O Hook notifica silenciosamente o frontend para animar o DOM
        if (context.onThought) context.onThought(thought);
      }
  });

  // Salva no servidor! Auditabilidade garantida.
  if (accumulatedThoughts.length > 0) {
    finalContent._thoughts = accumulatedThoughts;
  }
```

Na UI frontal, uma área cinza opaca escrita "Processamento Analítico em Andamento" rola para baixo preenchida por essas sublinhas de texto pensante até piscar o veredito final e transfigurar de forma cristalina os grids. A cereja do bolo repousa no fim: esses pensamentos são adicionados permanentemente ao histórico serializável da mensagem no storage. 

Isso engatilha um componente utilíssimo educacional: se o professor/tutor abrir o histórico dessa conversa daqui a 3 meses, poderá literalmente apertar um botão de Debug e ler não apenas a resposta da IA como **exatamente como a mente probabilística dela agiu por baixo dos panos na ocasião**, traçando auditorias de falhas e compreensões da "maquinação" geradora. O *"Por que me mandou usar esta fórmula?"* é integralmente passível de explicação no nível atômico.

## Referências Arquiteturais Acopladas
- [Roteamento Primário do Classificador Automático](/chat/router-prompt)
- [Auditor de Lacunas Embutido - Gap Detector](/chat/gap-detector)
- [Memórias Sistêmicas](/memoria/visao-geral)
