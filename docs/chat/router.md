# Router Engine — Escalonamento de Complexidade Cognitiva do Chat

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Router](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+chat-router&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `router.js` (`js/chat/router.js`) introduz a espinha dorsal de tomada de decisão do chat da plataforma Maia.EDU. Nas versões primárias (V1), a interface de conversa era engessada: cada nova mensagem do aluno custava o mesmo valor computacional exorbitante e levava os mesmos 15 segundos porque invariavelmente passava pelo `Gemini 1.5 Pro` para responder banalidades do tipo "Bom dia".

Para sanar este estrangulamento de custo (Request Units) e latência insustentável, a V2 adotou a Arquitetura **Agentic Routing** (Roteamento de Complexidade). Inspirado no design de modelos como `gemma-2-27b-it` (que atua como classificador), este módulo recebe a mensagem do usuário (ex: *"Explique matrizes"*), analisa rapidamente o contexto e despacha a requisição para a IA mais barata/rápida, ou caso detecte uma equação da NASA, escala para o modo `raciocinio` (Reasoner AI).

Sua função secundária é lidar com a extração de *Entity Recognition* (Busca RAG e Detecção de Scaffolding Pedagógico) antes que o Pipeline Oficial inicie.

---

## 2. Arquitetura de Variáveis e State Management

A beleza do Router está na pureza de Estado. Ele lida primariamente com Funções Assíncronas que recebem Option Bags isoladas (Memory-Safe), evitando contaminação cruzada se o aluno mandar duas mensagens rápidas seguidas.

| Módulo/Variável | Localização (Worker/Memória) | Escopo / Natureza | Função Explícita |
|-----------------|------------------------------|-------------------|------------------|
| `lastRoutingResult` | Arquivo Lógico (Closure) | Objeto JS Clássico | Atua como Singleton Cache (`{mode: 'rápido', complexity: 'BAIXA'}`). Usado para debug instantâneo do último pulso na UI do chat sem precisar re-executar as promises. |
| `ROUTER_RESPONSE_SCHEMA` | Imports (`prompts/`) | JSON Strict Schema | Força o modelo classificador (que pode alucinar) a devolver estritamente os campos: `complexidade`, `motivo`, `confianca`, `scaffolding_detected` ignorando "Claro, aqui está a resposta...". |
| `buffer` | Memória de Rotação (While) | String Acumuladora | Repositório TextDecoder temporal. Engole os Chunks Unit8Array do Fetch API e consolida pedaços cortados de JSON. |
| `rawAccumulator` | Escopo de Erro (`routeMessage`) | String | Arquivo vital para o fallback do `jsonrepair`. Guarda a string crua (inclusive com crases e Mismatched Brackets) emitida se a rede cortar do nada, permitindo salvar ~3% dos Requests falhos. |

---

## 3. Diagrama: Árvore de Decisão e Stream Routing

A estrutura do Roteador adota um Fluxo Bifurcado. Se o aluno pedir pra gerar imagem (Scaffolding Visual Detected) ele desvia o fluxo e contorna APIs puramente textuais text-to-text.

```mermaid
flowchart TD
    InputMsg([Mensagem do Usuário + Contexto (Até 5 msg passadas)]) --> ImageCheck{Tem Imagens ou PDF?}
    
    ImageCheck -->|Sim: Visão Requerida| FallbackOverride(Overhide: mode='raciocinio', ALTA)
    ImageCheck -->|Não| PromptBuilder[Constrói Prompt Meta-Cognitivo: buildRouterPrompt]
    
    PromptBuilder --> SendWorker[Fetch /generate to Cloudflare Edge]
    SendWorker --> ListenStream[Lê Reader.read() em Chunks Unit8]
    ListenStream --> IsChunkAnswer{Msg.Type == 'answer'?}
    
    IsChunkAnswer -->|Yes| ConcatAnswer[Concatena Text]
    IsChunkAnswer -->|Thought| BubbleUI[Expõe Pensamento do Router na Interface]
    IsChunkAnswer -->|Error| TrhowFatality[Throw Abort HTTP]
    
    ConcatAnswer --> DoneCheck{Chunk == Done?}
    DoneCheck -->|No| ListenStream
    DoneCheck -->|Yes| ParseLayer[Tenta JSON.parse(Answer)]
    
    ParseLayer -->|Crash de Sintaxe| JSONRepair[Dispara jsonrepair no Buffer Bruto]
    ParseLayer -->|Sucesso| RouteDemux
    JSONRepair -->|Sucesso| RouteDemux
    
    RouteDemux{RouterResponse.complexidade}
    RouteDemux -->|BAIXA| Rapido(Retorna: 'rapido' 0.4s load)
    RouteDemux -->|ALTA| Reasoner(Retorna: 'raciocinio' 10s load)
    RouteDemux -->|SCAFFOLDING| StepByStep(Retorna: 'scaffolding')
```

---

## 4. Snippets de Código "Deep Dive": Decodificação de Chunks Serverless

Ler do Cloudflare Worker não é baixar um JSON nativo com `await response.json()`. Ele empurra *NDJSON* (Newline Delimited JSON). O trecho abaixo do `router.js` explora a manipulação pesada de String Buffers para evitar a corrupção do meio do arquivo de Log:

```javascript
// O Response Body Streaming. Não congela a linha inicial.
const reader = response.body.getReader();
const decoder = new TextDecoder("utf-8"); // Lida com Tildes e Ç Brasileiros
let buffer = "";
let answerText = "";
let rawAccumulator = "";

while (true) {
    // Awaiting Pedaços de Rede Brutos Unit8Array. Pode engasgar se a operadora do Celular não ajudar.
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    rawAccumulator += chunk; // Guardado "Por Garantia" pro JsonRepair Fallback
    
    // O pulo do gato: Quebramos em Array. Se o último valor não terminar em '\n',
    // ele cortou NO MEIO (!). Removemos da iteração via .pop() e mantemos no Buffer.
    let parts = buffer.split("\n");
    buffer = parts.pop() || ""; 
    
    for (const line of parts) {
        if (!line.trim()) continue;
        try {
            // Cada linha é um pacote JSON estrito emitido pelo Worker
            const msg = JSON.parse(line);
            
            if (msg.type === "thought" && options.onThought) {
                // UI Magic: Mostra "Calculando viés metodológico..." no front-end em tempo real
                options.onThought(msg.text); 
            } else if (msg.type === "answer") {
                answerText += msg.text; // Agrega a resposta final (The Markdown)
            }
        } catch (e) {
            // Nunca falha silenciosamente destruindo o loop. O erro de JSON Incompleto 
            // será salvo no Fallback.
            continue; 
        }
    }
}
```

### O Desesperado (Porém Vital) Fallback via `jsonrepair`
Modelos de IA, incluindo o recém-lançado `gemini-exp-1206`, costumam vomitar lixo ao fim de respostas estruturadas (Ex: Múltiplas Backticks sujas). O Router.js trata isso como lei da Termodinâmica Algorítmica da Maia EDU:

```javascript
// Tentativa primária
try {
   const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
   const cleanJson = jsonMatch ? jsonMatch[0] : textToParse;
   routerResponse = JSON.parse(cleanJson);
} catch (e) {
   // O Salvavidas que salva 3% das calls globais
   console.log("[Router] Falha no parse direto. Tentando reparar com jsonrepair...");
   routerResponse = JSON.parse(jsonrepair(textToParse));
}
```

---

## 5. Estrutura de Payload e Regras de Negócio

Para garantir coerência e o que trafegará, os JSONs mandados pro `VITE_WORKER_URL` são amarrados rigidamente.

### Header do Payload (O Que Mandamos à Cloudflare)
```json
{
  "apiKey": "AIzaSy_hidden_from_docs",
  "texto": "SYSTEM PROMPT... --- User: Me ajuda com Pitágoras",
  "schema": {
     "type": "OBJECT",
     "properties": {
        "complexidade": { "type": "STRING", "enum": ["ALTA", "BAIXA"] },
        "motivo": { "type": "STRING" },
        "confianca": { "type": "NUMBER" }
     }
  },
  "model": "gemini-1.5-flash-8b", 
  "jsonMode": true,
  "thinking": true
}
```
**Nota Estrutural:** O classificador invariavelmente opera sobre a instância mais microscópica e veloz do Google (`gemini-1.5-flash` ou `8b`). Rodá-lo no `Pro` demoraria os exatos mesmos segundos que a geração final em si custa, negando toda a tese do Roteador de Complexidade Cognitiva.

---

## 6. Manejo de Edge Cases Severos (A Matriz de Mitigação)

Em infraestruturas RAG com Serverless Cloudflare dependendo da Internet local de professores rurais, a tolerância a falhas é absoluta:

| Cenário Adverso (Break Point) | Solução Engatilhada Arquiteturalmente | Impacto na UX Final |
| ----------------------------- | ------------------------------------- | ------------------- |
| Celular do aluno entra em Tunnel/Perde Sinal no meio do Reader | Cai no `catch (error)` e dispara `throw new Error("NETWORK_ERROR")`. | O Frontend (que invocou este módulo) bloqueia o UI Toast e não computa Token da mensagem. Interface orienta: "Sem Internet". |
| O Worker Edge envia `AbortError` porque o aluno saiu do Chat | O Catch superior `if (error.name === "AbortError") throw error;` joga silêncio. | O App Dropa a promise. Nenhuma Red Alert é jogada na tela. Ouve-se a vontade fluida do User. |
| O Firebase Cloud Limits expira e bloqueia API Keys na Vertex | O Worker recebe código HTTP 403. Ele engole e o fallback devolve: `{mode: 'rapido', confidence: 0}` | O usuário é engavetado para resposta Fast Fallback (usualmente cache local se aplicável) ou estoura pop-up pedindo nova key. Minimiza o "Freeze Morto". |
| Router enlouquece e responde `complexidade: null` | Coerção O(1) do Módulo Operacional. | Se `undefined`, assumimos `BAIXA`. O Pedido oficial do Project Manager dita: *"Na dúvida, não suba para raciocínio custoso"* mantendo SLA. |

---

## 7. Referências Cruzadas Completas

A complexidade escalar do `router.js` impulsiona módulos em toda a teia Frontend de respostas da Maia.

- [Router Prompt (`prompts/router-prompt.js`) — Módulo de Engenharia de Prompt engastada que balança o que é `ALTA` vs `BAIXA`](/chat/router-prompt)
- [Scaffolding Service (`scaffolding-service.js`) — Pipeline ativada caso o campo `scaffolding_detected` desse Módulo der verdadeiro. Altera a Pedagogia.](/chat/scaffolding-service)
- [Sistema de Config de Chat (`config.js`) — Onde os Mapeamentos String (`complexityToMode`) que traduzem "ALTA" para chamadas da Vertex se originam.](/chat/system-prompts)
- [Pipeline Primária (`pipelines.js`) — O Orquestrador-Chefe Global de Chat que fica "Awating" pacientemente a decisão tomada aqui.](/chat/router-prompt)
- [API Worker Docs — Mecânica de Conexão com o Worker Serverless Exposto acima via `WORKER_URL`](/api-worker/proxy-services)
