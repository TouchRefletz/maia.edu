# Pipeline Rápido (Low Latency Stream)

## A Filosofia da Resposta Imediata

No panorama do processamento de linguagem natural focado no estudante (o *EdTech Core* da Maia), o atrito é o maior inimigo da retenção de concentração. Estudantes de ensino médio e vestibulandos operam em regimes de atenção limitados. Quando o usuário formula uma dúvida de natureza simples — por exemplo, "Qual foi o ano de início da Segunda Guerra?" ou "Pode traduzir esse parágrafo de inglês para mim?" —, acionar modelos analíticos densos que emulam cadeias de raciocínio lógico (CoT) com altos tempos de computação seria não apenas um desperdício de GPU (energia térmica em Data Centers), mas ativamente prejudicial à fluidez da conversação.

Para aplacar essa necessidade de performance pura e simples, desenvolveu-se a **Pipeline Rápida**. Ela constitui o fluxo base de menor atrito e maior agressividade no escoamento de tokens. A latência medível até o primeiro token (TTFT - *Time To First Token*) é a KPI absoluta que monitoramos e preservamos a todo custo. Sem as abstrações de simulação Socrática, a resposta é iniciada diretamente.

## Arquitetura e Decisão de Roteamento

A pipeline rápida não é o default cego; ela é um caminho decidível. O Roteador (`Router System`) envia a requisição para ela quando atestado que não há demanda analítica cruzada.

A função mestre exportada na API é a `runRapidoPipeline`, mas tecnicamente ela é apenas um envelope passador de state para a `runChatPipeline` injetando como modo de engate a string `"rapido"`.

```javascript
// Ponto de entrada canônico em js/chat/pipelines.js
export async function runRapidoPipeline(message, attachments, context) {
  return runChatPipeline("rapido", message, attachments, context);
}
```

O Router faz essa injeção quando:
1. O menu fixo no front-end foi acionado manualmente pelo usuário pelo seletor de raio ⚡ (Modo Rápido Forçado).
2. O Router AI Automático classificou `complexidade: "BAIXA"` (como documentado no Router Prompt interno).
3. Não há arquivos OCR densos (como PDF longos). Em anexos pesados, as regras do router geralmente desqualificam a via rápida para prevenir alucinações de visão computacional.

## Fluxo Lógico e Anatomia da Requisição

Diferente do Modo de Raciocínio, a pipeline rápida empacota as injeções contextuais de forma síncrona sem disparadores extra (embora mantenha o cruzamento de contexto do sistema de memória do `EntityDB`). 

Ao acionar a stream via o Cloudflare Worker, o processamento ocorre assim:

```mermaid
sequenceDiagram
    participant U as Estudante (App Frontend)
    participant Core as runChatPipeline()
    participant Memory as MemoryService
    participant LLM as Modelo Flash
    participant Hist as LocalDB (Histórico)
    participant Title as Gerador de Títulos Asíncrono

    U->>Core: Envia "O que é entropia?"
    
    activate Core
    Core->>Memory: Consumo Paralelo de Fatos Pessoais
    Memory-->>Core: Fatos = [] "O Estudante está no ensino médio"
    
    Core->>Core: Carrega getSystemPromptRapido()
    
    Core->>LLM: fetch(generateChatStreamed)
    
    activate LLM
    loop Low-Latency Stream Chunking
        LLM-->>U: Chunk 1 {layout...}
        LLM-->>U: Chunk 2 {conteudo: "Entropia é..."}
    end
    deactivate LLM
    
    par Finalization Tasks (Assíncronas)
        Core->>Hist: ChatStorageService.addMessage()
        Core->>Memory: ExtractAndSaveNarrative(Background)
        Core->>Title: gera titulo caso `isNewChat == true`
    end
    deactivate Core
```

### 1. Injeção Contextual via Memory Service

Até memsmo na pipeline rápida, a Maia nunca começa "em branco". O `MemoryService.queryContext(message)` roda na micro-fração inicial, assegurando que, se o estudante tinha falado ontem que estava fazendo biologia e hoje pediu para resumir um texto sobre células mortas, o modelo flash já saiba disso e não adentre contextos genéricos.

### 2. Delegação Exata de Modelo (O Arquivo de Configuration)

Para assegurar eficiência brutal, a pipeline se escora no módulo `getModeConfig("rapido")`, atrelando-se predominantemente ao `gemini-3-flash-preview` por sua excepcional arquitetura de aceleração inferencial de ponta a ponta. A temperatura para predição é reajustada para patamares medianos (`0.7`), uma vez que não desejamos extremismo criativo literário que cause devaneios fora de escopo.

```javascript
  const fullResponse = await generateChatStreamed({
      model: getModeConfig("rapido").model,
      generationConfig: getGenerationParams("rapido"),
      systemPrompt: getSystemPromptRapido(),
      userMessage: finalMessage,
      attachments,
      // ... callbacks
  });
```

### 3. A Tarefa de "Auto-Title" Desconectada

Sistemas estéticos necessitam nomear as abas de conversa ("Novo Chat") de forma inteligente sem requerer preenchimento manual do estudante. Porém, exigir isso do LLM principal durante a resolução atrasaria o fim prático. 

Portanto, o Pipeline Rápido instancia, ao fim do script, o `generateChatTitleData` usando de um modelo open-weights subsidiário (`Gemma-3-27b-it`) puramente assíncrono. O aluno sequer percebe; enquanto ele consome e lê o bloco recém gerado de biologia, o modelo acessório infere a label e atualiza o histórico em paralelo, repintando o texto do Menu Lateral magicamente com "Sumarização Biológica".

```javascript
/* Trecho da separação de carga no pipeline */
if (isNewChat) {
  generateChatTitleData(message, finalContent, context.apiKey)
    .then((title) => {
      if (title) {
        ChatStorageService.updateTitle(chatId, title);
        if (context.onTitleUpdated) context.onTitleUpdated(chatId, title);
      }
    }); // Nenhuma paralisação com "await" no core execution!
}
```

## Prompt de Sistema e o Limite Criativo

A `getSystemPromptRapido()` é enxuta e focada na instrução máxima de estruturação. Sua função técnica real é assegurar que o modelo não faça devaneios argumentativos. O prompt encoraja o modelo flash a ser direto com definições pragmáticas. Mais crucial ainda: instrui estritamente no processamento de esquemas JSON. Na ausência de longas premissas orientadoras do modo reflexivo, recai sobre a capacidade puramente analítica base do modelo preencher as regras do OpenAPI com a formatação matemática via engine KaTeX em `{"tipo": "equacao"}` ou markdown nativos limpos.

## Tratamento Anti-Crash (Resistência Ativa)

Durante o streaming, as interrupções voluntárias do usuário (quando clicam no botão cinza de "Parar de Gerar" porque a resposta de início já saciou a dúvida, poupando tokens valiosos), o pipeline captura o `context.signal?.aborted` por via do cancelamento unificado do AbortController do navegador, que cancela a conexão fetch subjacente à Cloudflare.

Ao apanhar `AbortError`, a engine engole e "finge costume". A pipeline não trata como falha desastrosa (o que forçaria modais de pânico na tela), apenas devolve graciosamente o que já possuía renderizado até o ponto de estouramento, atualiza a database local com os chunks truncados (afinal metade do conhecimento é melhor que nulidades) e libera o DOM de interação.

## Padrões de Falha Contornadas (Anti-Patterns Mitigados)
- **Bloqueio de Renderização Sequencial:** Os buffers internos repassam objetos processados fragmentos de JSON a cada 3ms para o React, sem aguardar formatação complexa se não essencial.
- **Falha em Tarefas Visuais:** Como é um Fallback veloz, os pesos cognitivos podem perder detalhes absurdos se forçando a processar imagens ultra-densas. Isso raramente acontece pois o Roteador redireciona anexos para o Modo Raciocínio (Deep Think).

## Conclusões Funcionais
No cômputo global do Maia.edu, estima-se que 65% a 75% da banda e número de sessões interativas com a plataforma escoem pela Pipeline Rápida. A estabilidade semântica do `generateChatStreamed` aqui pautada garante que o usuário médio seja atendido em altíssimo padrão sem os atritos operacionais indesejáveis.

## Referências Associadas
- [Roteamento Primário do Classificador Automático](/chat/router-prompt)
- [A Estruturação de Entidades e Histórico da Memória Estática](/memoria/visao-geral)
- [Os Construtos JSON de Front End (Schemas Internos)](/chat/schemas-blocks)
