# Form Logic — Orquestração de Upload Híbrido (Cloud-First)

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+form-logic&labels=docs)

## Visão Geral

O módulo `form-logic.js` (`js/upload/form-logic.js`, ~1.400 linhas) é o coração logístico da tela inicial de inserção de provas no sistema Maia.edu. Originalmente, o sistema processava arquivos pesados nativamente no browser do usuário, exigindo máquinas de altíssima performance. A nova arquitetura migrou para um modelo **Cloud First Híbrido**, em que este módulo atua como um maestro: ele captura arquivos via Dropzone, calcula Hashes parciais localmente usando WebWorkers, envia binários brutos para buffers temporários anônimos (`tmpfiles.org`), delega autorizações e metadados para instâncias Edge no Cloudflare Workers, e por fim assina canais WebSockets Realtime (`Pusher`) para observar a progressão assíncrona do Job pesado hospedado num servidor GPU da Digital Ocean.

Este documento destrincha o intrincado Flowchart de Controle da "Tela de Upload", cobrindo o Modal de Progresso Persistente, a Tabela-Verdade de Cache, estratégias de mitigação de Rate Limits e o robusto Fallback Local Opcional para garantir Resiliência Extrema (`Panic Button`).

## Arquitetura de Fases do Upload

O upload no Maia EDU não é uma requisição POST `multipart/form-data` convencional disparada contra um monolito PHP. Devido à natureza massiva dos documentos (PDFs educacionais chegando a 50MB e com alta densidade vetorial) e a etapa de processamento por Múltiplas IAs Open-Source (OpenHands, VLLMs, Tesseract OCR), a arquitetura é forçada a rodar em um Pipeline Estrito de 4 Fases:

### Fase 1: Recepção e Sanitização Local
O Form Logic intercepta o `submit` nativo do formulário HTML. 
Ele garante que a dupla Prova/Gabarito exista, que a instituição seja válida e que o tipo MIME seja exclusivamente `application/pdf`. Neste exato microssegundo, a UI esconde o formulário negro (fade-out CSS) e monta o Modal Flutuante de Progresso, que monopoliza a viewport, impedindo Double-Submits ou navegação acidental.

### Fase 2: Identity Hashing (Identidade Visual)
Para abater o custo absurdo de rodar IAs Generativas em GPUs A100 a cada PDF de teste enviado, o front-end engatilha a Biblioteca `pdf-hash`. A Maia.edu não faz checksum SHA256 do arquivo binário, mas sim renderiza internamente as páginas e tira um "Hash dos pixels", tornando o PDF a prova de edições de metadados invisíveis. O formulário lida com os retornos desse passo via Promise, travando em 25% na barra.

### Fase 3: Worker Preflight & Cache Demultiplexing
Com o Hash calculado (`0xAB42F...`), invocamos o Edge Worker da Cloudflare para a fase `preflight` a seco. É o "Bate-Pronto" da Arquitetura. O Edge acessa o repositório principal no Hugging Face (que funciona como Banco de Dados Coletivo Gratuito) e tenta esbarrar em um `manifest.json` que possua a mesma assinatura visual para a Prova enviada.

### Fase 4: Cloud Instantiation & Stream Tracking
Se não houver milagre (cache não encontrado), o Form Logic pega os binários dos arquivos e sobe eles para uma infraestrutura volátil de 60 minutos (`tmpfiles`). Devolvendo apenas URLs temporárias de download, a Cloudflare inicia a GitHub Action na Digital Ocean, que fará o `Wget` dessa mídia, cortando tráfego de subida do Servidor primário.
Nessa fase o `Pusher` assume e passamos a ouvir websockets por minutos.

---

## Diagrama da Tabela-Verdade (Cache Inteligente)

A lógica condicional principal para a economia de processamento em `form-logic.js` modela-se pelo diagrama abaixo.

```mermaid
flowchart TD
    Start([Início Upload]) --> Hash[Gerar Hash Visual Prova & Gabarito]
    Hash --> Preflight{Cloud Worker Preflight}
    
    Preflight -->|Match 100%| Skip(Cache Hit Total)
    Preflight -->|Match Só Prova| GabDiff(Cache Hit Parcial)
    Preflight -->|Miss| FullUpload(Pipeline Ingestão Remota)
    
    Skip -->|Resolve Imediato| End([Abre Visualizador de Prova])
    
    GabDiff --> UpGab[Faz Upload apenas do Gabarito]
    UpGab --> WorkerGabAction[Worker Clona Prova, Insere Gabarito e Salva Variante]
    WorkerGabAction --> StreamWait{Pusher Wait}
    StreamWait -->|Log: Complete| End
    
    FullUpload --> UploadTempFiles[Upload Prova + Gab -> tmpfiles.org]
    UploadTempFiles --> FireAction[Cloudflare Aciona GitHub Action (OpenHands)]
    FireAction --> StreamWait
```

Ao inspecionar o arquivo carregado contra o manifesto JSON da Hugging Face, essa Tabela-Demultiplexadora atua rigorosamente:
1. **Prova ENCONTRADA no Repo** -> Retorna `uploadProva = false`. Tempo Gasto: 200ms.
2. **Gabarito Diferente mas Prova Igual** -> Cria Versão Derivada.
3. **Nenhum match** -> Aciona Pipeline de ingestão remota na nuvem.

Isso desonera os custos e permite que provas clássicas da FUVEST 2024 retornem instantaneamente em milissegundos através do link originário extraído.

---

## Arquitetura de Comunicação: Pusher e UI Sync

Como mencionado, a Fase 4 dura quase 2 a 3 minutos dependo da Fila no Cluster. Se isso rodasse via `await fetch()`, o Chrome mataria a requisição HTTP por Timeout (Limitado a 60s/120s nativos e 30s nos Worker Clouds). O Design Pattern foi desmembrar a Invocação do Monitoramento.

O Cloudflare Worker responde "Http 200: Arquivo Recebido". A janela continua ativa. Para a ponte ao vivo ser restaurada, o elo Websocket `Pusher` atrelado no Form Logic age assim:

1. Injetamos preguiçosamente (Dynamic Import, para não poluir o Bundle nas páginas HTML estáticas) `import('pusher-js')`.
2. O Hash do Arquivo enviado se converte na Sala do Servidor de Brodcast: `slug = fisicate-ufrj-2022-2b3a9`.
3. A inscrição do formulário na sala inicia imediatamente: `channel = pusher.subscribe(slug)`.
4. Escutamos o gatilho `log` ou `hash_computed` na etapa remota local.

```javascript
// Exemplo Conceitual do Form-Logic Pusher Sync
const channel = pusher.subscribe(slug);

// Disparador Analítico de UI 
channel.bind("log", (data) => {
   // A string pura chega crua via Socket. 
   // Delegamos ao LogTranslator para humanizar as strings Dockerizadas vermelhas pesadas.
   const friendlyMsg = LogTranslator.translate(data.message);
   
   if (friendlyMsg) {
       progress.addLog(friendlyMsg.text, friendlyMsg.type); // type colore a bolinha
   }
   
   // Hook Categórico de Finalização do Pipeline
   if (data.message.includes("Cloud sync complete")) {
       channel.unbind();
       pusher.unsubscribe(slug);
       progress.simulateCompletionAndOpen(openViewer);
   }
});
```

A interface nativamente se auto-atualiza, com a Progress Bar (`div#upload-progress-bar`) escalonando assincronamente preenchendo os percentuais vindos das chaves calculadas pelos Workers ou deduzidas do LogTranslator Local.

---

## Tratamento de Falhas Obscuras da Nuvem

O Form Logic possui camadas paranoicas para lidar com a estabilidade duvidosa dos Sockets Web na LatAm, assim como indisponibilidades massivas pontuais de Hugging Face. 

### API Limit TmpFiles
Como o Node dependeu do TmpFiles gratuito no piloto V1, erros 429 de Rate Limiting por tráfego no DNS afundam a promise. Quando detectado que o Fetch Response bloqueou o ByteStream da Prova PDF, o Javascript não cospe "Erro de Conexão". Ele lê explicitamente o Code 429 e injeta no Warning Log: *"Servidores temporários sobrecarregados. Acionando Fallback."* e transita para o Escopo Local.

### Morte Súbita do Pusher (Zombie Job)
Se um Job da nuvem sofre PANIC no Kubernetes, o evento `Cloud sync complete` jamais chega ao websocket, largando o Professor numa tela de Progresso de 80% infinita.
Como mitigar? O Frontend define um Timer Heartbeat Local (`setTimeout`). Se em 4 minutos não receber logs consistentes ou uma EndFlag, ele força a exibição do botão vermelho de encerramento do processo manualmentte (Exposto normalmente no `Panic Button`).

---

## Botão do Pânico (O Retorno Triunfal da UI Local-First)

Este form é a implementação perfeita do manifesto **Local-First Software**. Se o Pusher cair misteriosamente, a Google Cloud engasgar, ou a rota de BGP do cabo de fibra submarina arrebentar para a Digital Ocean, o usuário não perde de jeito nenhum o trabalho ou a tela preta com os PDFs originais.

Um Listener engatilhada em paralelo (A Action Listener do Extrator) invoca um Evento global Customizado batizado de "Cancel Upload" quando clicado explicitamente num botão submerso.

O método interceptador lança a DOM Warning, aborta o Flight do Header Request pendente da Fetch HTTP original de upload (`abortController.abort()`), aniquila o Socket com `pusher.disconnect()` e aciona um **Hard Rescue**:

```javascript
/** 
 * Resgate Crítico do Form Logic 
 * Executa bypass absoluto da Nuvem usando o Hardware do Usuário
 */
function handleLocalEmergencyFallback(fileProva, fileGabarito) {
   // Exposição de Ponteiros Globais (Anti-padrão proposital mas salvífico)
   window.__pdfLocalFile = fileProva;
   
   if(fileGabarito) {
      window.__pdfGabaritoLocalFile = fileGabarito;
   }

   // Transição da Tela de Home (O Formulário) para O PDF Viewer Complexo
   document.getElementById('home-container').style.display = 'none';
   document.getElementById('pdf-viewer-container').style.display = 'block';

   // Dispara evento global pra ressuscitar componentes React e Vanilla 
   // desatrelados que leem essa variável mágica
   window.dispatchEvent(new CustomEvent("pdfLocalFileLoaded"));
   
   Toastify.show("Atenção: Estamos rodando no modo local nativo (Servidor Offline).", "warning");
}
```

Isso desvia todo milímetro quadrado do tráfego do PDF.js renderer para ler a source como um ArrayByte (`Unit8`) local pre-existente montado na memória da máquina do usuário. Dali em diante o Professor realiza a extração do Crop OCR puramente com instâncias Tesseracts ou Workers de Miniaturas da própria CPU e GPU integradas em WebAssembly local, tal qual a plataforma arquitetava solitariamente lá em sua gênese meados de 2023.

---

## Impacto Cognitivo do Log Translating e Cores de Status

A interface do upload não pode causar *Code Anxiety*. O Painel implementa o `terminal-ui.js` invocado intimamente pelo Formulário, que repassa cores de Background para denotar os pacotes do log:

- **Cinza/Azul**: Status rotineiro (`Aguardando Serverless...`)
- **Laranja**: Conflitos ou Sobrescritas Autorizadas (`Resolvendo Colisões no Dataset...`)
- **Vermelho (Throw)**: Fatal Error de Permissão ou Falha Hexadecimal do Tmp.
- **Verde Neon**: Hashes Encontrados, Matches em Cache e Completion `✓`.

Todas essas cores são providas centralizadamente por classes CSS (`.st-log-warning`, `.st-log-info`) engastadas por nós DOM manipulados aqui durante a recepção dos Sockets.

---

## Referências Cruzadas

O Form Logic não reina isolado, ele é um Maestro num oceano de utilitários:
- [Drag & Drop UI — Entidade orgânica que captura o Array File nativo e repassa o pointer para este módulo](/upload/drag-drop)
- [Search Logic — A pesquisa Profunda da Home, sendo frequentemente atrelada para resolver "Conflitos Semânticos" se o Cache do Server der Miss](/upload/search-logic)
- [Terminal UI — O Motor Gráfico (Terminalzinho Preto voador) para ondem os Pushers são alimentados](/upload/terminal-ui)
- [Log Translator — A Entidade O(n) Regex-Driven que mastiga o Payload Docker para Mensagens de Gente Normal](/upload/log-translator)
- [API Worker Proxying — Os Segredos do Importante `VITE_WORKER_URL` do Gateway Vertex do outro lado do mundo](/api-worker/proxy-services)
