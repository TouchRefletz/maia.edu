# Motor de Envio Global (`envio.js`) — Orquestração de Persistência Cloud e VDB Search

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Envio RTDB/Vectorial](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+firebase-envio&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `envio.js` (`js/firebase/envio.js`) é o cérebro maestro responsável por finalizar as missões monumentais de Digitalização Fotográfica que ocorrem na Maia. Quando o professor terminou de recortar Provas, enquadrar opções ("A, B, C, D") e ajustar gabaritos, ele clica num grandioso botão de "Salvar".

Na arquitetura Monolítica obsoleta V1, "salvar" era apenas atirar um Upload pro Banco SQL ou NoSQL comum e encerrar. Na versão atual V2 ("Inteligência Distribuída"), este botão desperta The Cloud Pipeline: um formigueiro de serviços assíncronos onde a Imagem sobe para um Storage Vectorial (Pinecone RAG) como "Embbeding Semântico de Texto", as meta-informações fotográficas (`original_source_url`) e a Árvore JSON Estruturada são atiradas para o Google Firebase Realtime Database. Este arquivo coordena essa *Distributed Transaction* com manipulações agressivas de U.I. para evitar que o Aluno dê Multi-Clicks destruindo ou duplicando nós na nuvem.

---

## 2. Arquitetura de Variáveis e State Management

A "Transação de Envio" lida com Promises Encaminhadas. Se alguma etapa falhar, o Controller de Estado deve garantir que o botão des-carregue.

| Entidade / Constante Passada | Carga Origem | Função Mestra na Persistência |
|------------------------------|--------------|-------------------------------|
| `payloadParaSalvar` | `payload-imagens.js` | Dicionário Gordo (Fat Object). Contém Base64 Imagens (convertidos para URLs Firedrop), OCR Completo e chaves primárias. |
| `chaveProva` | Input de Normalização | Foreign Key. Agrupa dezenas de questões isoladas num único caldeirão de simulação ENEM (Ex: `prova-unicamp-2024`). |
| `idQuestaoUnico` | Timestamp / UUID | Primary Key Criptográfica. A folha RTDB `questoes/Prova_A/ID_123` em formato de folha canônica O(1) de Indexação. |
| `activeTab.groupId` | Local Storage State | Manipula a Máquina de Estado Fechando o Scanner Sidebar de modo passivo após detecção de sucesso. |
| `vetorEmbedding` | Worker API (Gemini Text-Embedding) | Pedaço array de Float32 Numbers usado para a IA Chat achar que Matemática envolve Cosseno sem o usuário digitar. |

---

## 3. Diagrama: Pipeline de Submissão Cloud-Híbrida Asincrona

O ato de salvar é frágil pela quantidade de nós Serveless envolvidos (Gemini, Worker Cloudflare, Pinecone VectorDB e RTDB Firebase). Se quebrar no meio, O catch absorve a falha pra salvar a experiência da aba:

```mermaid
flowchart TD
    Click([Usuário aperta em 'Salvar Envio no Banco']) --> Setup[Call: iniciarPreparacaoEnvio()]
    Setup --> CheckValid{Contexto Válido?}
    
    CheckValid -->|No| CancelarSilencioso(Destrava Botao - Quebra)
    CheckValid -->|Yes| BuildData[Call: construirDadosParaEnvio(Q, G)]
    
    BuildData --> GenerateIDs[Hash Maker: Gera ChaveProva, IdQuestao, PineconeId]

    GenerateIDs --> GetVetor[Wait: processarEmbeddingSemantico()]
    Note right of GetVetor: Converte o texto todo da questão matemática em 768 Arrays Floats (Semantic Vectorizing)
    
    GetVetor --> PrepPayload[Wait: prepararPayloadComImagens()]
    Note left of PrepPayload: Sobe blob images e pega CDN URL Links. (Mutação de Objeto Assincrona)
    
    PrepPayload --> VDBLink[Wait: indexarNoPinecone()]
    Note right of VDBLink: Atrela VectorFloat + TextPayload no Vector C+ Database.
    
    VDBLink --> FlushMem[Call: DataNormalizer.flush()]
    FlushMem --> SavingRTDB[Wait: finalizarEnvioFirebase()]
    
    SavingRTDB --> FirebaseGCP[(Google Firebase RTDB: 'questoes/{prova}/{id}')]
    
    FirebaseGCP --> UILogic[Modifica DOM para Success View]
    UILogic --> TabClose[Call: removeTab(activeTab)]
    
    Subgraph TratarErroEnvioFirebase
        CacthException(Falha de Rede ou Servless) --> CustomAlertModal
        CustomAlertModal --> ReactivateBtn(Reativa o Botão pra Nova Tentativa)
    End
```

Caso a Vectorização do Pinecone de erro, o Realtime Firebase é abordado num *Short-Circuit* Throw Error, impedindo que a base de dados SQL-Like tenha a questão vazando, enquanto The RAG Brain fica cego. O Sistema de Consistência é Total.

---

## 4. Snippets de Código "Deep Dive" (Integração Lógica)

### O Coração Assíncrono do Envio Principal (`enviarDadosParaFirebase`)

Na arquitetura de V1 a função atiraria callbacks do capeta (Callback Hell). No V2 esmagamos num túnel async `Await` extremamente verboso e protegido:

```javascript
/* Trecho Isolado de Async/Await Orchestration */

export async function enviarDadosParaFirebase() {
  // Pega Referências Nativas do HTML DOM antes da tela freezar (Evita Memory Leak)
  const contextoEnvio = iniciarPreparacaoEnvio();
  if (!contextoEnvio) return;
  const { btnEnviar, q, g } = contextoEnvio;

  try { // Bloco de The Shield - O menor erro cai pro Alert 

    // Fase 1: Lexical String Building
    // Correção Arquitetural: Construir dados ANTES de Gerar Hash evita IDs Sujos vazios.
    const { tituloMaterial, questaoFinal, gabaritoLimpo } = construirDadosParaEnvio(q, g);
    const { chaveProva, idQuestaoUnico, idPinecone } = gerarIdentificadoresEnvio(tituloMaterial, q);

    // Fase 2: O Cérebro Artificial (Demorado: Pode durar ~1000ms a 3000ms dependendo da Vertex Limit)
    const { vetorEmbedding, textoParaVetorizar } = await processarEmbeddingSemantico(
        btnEnviar, questaoFinal, gabaritoLimpo
    );

    // Fase 3: Mutação de Objetos para Arquivos CDN Bucket (Payload Builder) Demorado!
    const payloadParaSalvar = await prepararPayloadComImagens(btnEnviar, questaoFinal, gabaritoLimpo);

    // Patch Injeção Retroativa de PDFs Originais Tracker
    if (window.__pdfOriginalUrl) {
      payloadParaSalvar.meta = payloadParaSalvar.meta || {};
      payloadParaSalvar.meta.source_url = window.__pdfOriginalUrl; // Foreign Link Global Data Mapping
    }

    // Fase 4: Bater The DB (Final Database Hit Hit - Double Commit Paradigm)
    await indexarNoPinecone(btnEnviar, vetorEmbedding, idPinecone, chaveProva, textoParaVetorizar, payloadParaSalvar);
    
    // Atualiza o Autocomplete Lexico Do Search Da Tela do Usuário Local.
    await DataNormalizer.flush();

    // The True Last Saving (Hit 2) - Através do Google Firebase SDK
    await finalizarEnvioFirebase(btnEnviar, chaveProva, idQuestaoUnico, payloadParaSalvar);

  } catch (error) {
    // Escape Global Rescue 
    tratarErroEnvioFirebase(error, btnEnviar);
  }
}
```

### UX Manipulation and The UI Tearing (`finalizarEnvioFirebase`)

Na função final, não basta apenas gritar no console "Salvo com Sucesso". Precisamos forçar The Viewport do VUE/Vanilla Reactivity a reagir.

```javascript
export async function finalizarEnvioFirebase(btnEnviar, chaveProva, idQuestaoUnico, payloadParaSalvar) {
  // A ação assíncrona Firebase DB Write
  const novaQuestaoRef = ref(db, `questoes/${chaveProva}/${idQuestaoUnico}`);
  await set(novaQuestaoRef, payloadParaSalvar);

  // A Mágica de UI Lifecycle: Destruir Abas Offline (Tabs)
  const activeTab = getActiveTab();
  if (activeTab && activeTab.type === "question") {
    
    if (activeTab.groupId) { // Atualiza estado na Memória Proxy
      const group = CropperState.groups.find((g) => g.id === activeTab.groupId);
      if (group) group.status = "sent"; // O Card lá da Galeria trocará a cor de Vermelho pra Verde 'Salvo'
    }

    // TROCA FORÇADA DE ROTA VISUAL
    // Pula pro "Hub" de Gerenciamento da Prova pra ver ela brilhando na lista
    switchToHub(); 
    CropperState.notify(); // Re-Render Disparado!
    
    // Timeout Cirúrgico anti-Flickering
    setTimeout(() => { removeTab(activeTab.id); }, 100); 
  }
}
```
A troca do ActiveTab antecedendo a destruição dela previne a famigerada "Tela Branca" ou *Blinking Frame Collapse* que ocorre quando o elemento root domina a destruição de uma Aba Ativa antes da Renderização do Parent superior (O Sidebar).

---

## 5. Manejo Crítico (TratarErroEnvioFirebase) - A Defesa

Em ecossistemas Distributed como a Maia EDU, que lidam com Arquivos Gigantes e Embeddings (Arrays Pesados), falhas de rede acontecem aos milhares.

| Classificação do Erro (HTTP Panic) | Fallback / Rescue do `tratarErroEnvioFirebase` | Impacto de User Experience |
|------------------------------------|------------------------------------------------|----------------------------|
| **Vetor Gemini 500 Server Error** | A catch Block para a Execução em "VDBLink" e atira string "Falha na Criação Semântica". O SDK Firebase de Salvar Texto Clássico NUNCA É CHAMADO. | A prova não entra no Banco; o professor não perde tempo refazendo ela depois. Ele recebe Notificação de Timeout Red na Cara dele. O texto não se corrompeu. Botão fica azul pra Clicar "De novo". |
| **Timeout de Firebase Timeout Network (Offline Cellphone Mode)** | O JS lança o Erro no final, `await save() Firebase SDK`. O app entende que abortou, UI dá Crash de Toast "Falha de rede" | **Risco de Ghost Save:** Como Cloudflare Vertex e VDB rodaram rápido e O Firebase travou, a IA da Maia pode achar a questão (Pinecone) mas ela não existe pro Usuário ver. Mas Firebase SDKs reconectam nativamente (Offline Write Buffer). |
| **Pinecone Overload Limits (Billing Hit - Request Rate Limits)** | Exceção Pula para Fallback. A questão não Sobe nem pra Vector nem pra RDTB. Previne poluição corrompida C+. | Bloqueia a persistência local (o DOM Button reseta "Tentar Nov") Alert avisa: Limit Excedido. Acalma User para esperar The Cloud Resfriar. |

---

## 6. Referências Cruzadas Completas

Para vasculhar o Labirinto Cognitivo dessa Missão-Crítica (O coração vascular que alimenta The Source Of Truth):

- [Hash Building / Envios Texts (`envio-textos.js`) — Módulo Pai ativamente invocado aqui como construtor dos Hashes PK IDs Criptográficos Locais.](/memoria/extracao)
- [Vectorial Brain (`embedding-e-pinecone.js`) — Módulo filho onde a Await Paralela para O CloudWorker C++ gasta Tokens na API Oculta (Cloudflare edge).](/embeddings/pipeline)
- [Inicialização DB Pointer (`init.js` do Firebase) — O Pai Onde exportamos The `db` SDK Pointer consumido neste script no Header via RTDB Set Imports.](/firebase/init)
- [Reset Application Engine (`reset.js`) — O faxineiro que limpa os painéis de Inputs local do Browser no milisegundo seguinte ao Succesful Save desse script.](/upload/terminal-chain)
