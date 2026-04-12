# Question Service — Motor Híbrido de Busca RAG Extrativa

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Question Service](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+question-service&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `question-service.js` (`js/services/question-service.js`) é o cão farejador da plataforma Maia EDU. Nas iterações antigas, se o aluno pedisse uma Questão de Matemática, o sistema rodaria um query lento no Firebase Cloud Firestore `where("subject", "==", "Matemática")`, retornando a mesma primeira questão todas as vezes, frustrando o educando. 

Pior ainda: se o usuário pedisse: "Me dá uma questão de polias envolvendo atrito", o Firestore (sendo NoSQL puro) fracassaria pois não entende contexto. Na arquitetura revolucionária V2 Híbrida, este arquivo adota a **Recuperação de Geração Aumentada (RAG)**. Ele pega a frase inteira do aluno, transforma em um "Vector de Embeddings" C++, varre um Banco Vetorial terceirizado (Pinecone) e acha a correspondência mais próxima (Similarity Search). Uma vez que pega o ID desse vetor, ele retorna pro Google Firebase Realtime Database para puxar a "Carcaça Gorda" do JSON da Questão (Metadados como Imagens e Dicas) para jogar na tela do aluno.

É a união entre Músculo (Firebase SQL) e Cérebro (Pinecone Vetorial).

---

## 2. Arquitetura de Variáveis e State Management

A beleza cirúrgica desse módulo é que as variáveis operam como uma "Cachoeira de Fallback" (Waterfall Search Protocol). A busca vai caindo até achar algo.

| Variável / Parâmetro | Objeto de Origem | Estrutura de Domínio | Função Explícita |
|----------------------|------------------|----------------------|------------------|
| `filtros` | `Router JSON Schema` | ConfigMap `{query, institution}` | Representa a vontade Categórica e Semântica do Aluno. Se a IA detetou "Quero Fuvest", isso vem preenchido aqui. |
| `textoBase` | Fallback String | NLP Text | Concatena a dor do aluno para Vetorizar. `"Matemática Fuvest 2021"` se nenhum query textual for achado, impedindo a injeção Vetorial Nula de quebrar. |
| `vetor` | API Serverless Gemini| `Float32Array[768]` | O "Cheiro" da Questão. Criado no Worker a partir do `textoBase`. |
| `parts / bestMatch` | DB Pinecone | `String[]` Split | O Segredo do Custo-Zero. O Pinecone retorna um Master ID do tipo `UNESP14--824B`. Esse Array dá O Mapa do Tesouro pro Firebase (`Prova` e `Questao ID`). |

---

## 3. Diagrama: O Algoritmo de Fallback Escalonado VDB+RTDB

A grande dor do Serverless é que se o Filtro for esnobe ("Quero Questão de Geometria do ITA Ceará"), e a escola não cadastrou, o sistema trava. O Algoritmo deste arquivo se degrada (Skipping Conditions) para manter o aluno estudando a qualquer custo.

```mermaid
flowchart TD
    InicioReq([Aluno pede Pergunta Cabeluda]) --> RouterBuild[Router envia {filtros}]
    RouterBuild --> BuildVector[Call: gerarEmbedding(textoBase)]
    
    BuildVector --> SearchT1{Tenta Pinecone C/ Tudo}
    SearchT1 -->|Com Filter: Inst + Ano + Subj| T1_Ok
    
    SearchT1 -->|Vazio 0 Match| Degrad1[Tenta só Instituicao + Materia]
    SearchT1 -->|Vazio 0 Match| Degrad2[Tenta sô Instituicao]
    SearchT1 -->|Vazio 0 Match| Degrad3[Desiste dos Filtros, busca Full Semântico Cego]
    
    T1_Ok --> ParseIdPinecone[Encontrou! Ex: FUVEST--Q19. Processa o ID]
    Degrad1 --> ParseIdPinecone
    Degrad2 --> ParseIdPinecone
    Degrad3 --> ParseIdPinecone
    
    ParseIdPinecone -->|ID é Base64 Seguro?| Desanitizer[Call: desanitizarID(Parts)]
    Desanitizer --> BateNoFirebase[Firebase Firebase get(`questoes/prova/id`)]
    
    BateNoFirebase -->|Achou Corpo do PDF?| SucessoPinecone[(Match Total e Lindo)]
    
    BateNoFirebase -->|Erro 404 Local Data Desync| SearchT2
    Degrad3 -->|Pinecone Fora do Ar ou Vazio| SearchT2
    
    SearchT2{Fallback O(n) Cego}
    SearchT2 --> BateAleatorioFirebase[Firestore Pega 3 Primeiras Provas]
    BateAleatorioFirebase --> SorteioLocal[Sorteia via Math.Random nas Keys O(n)]
    
    SorteioLocal --> Fim[(Exibe no Chat e Pede Desculpas pela falta do Filtro)]
    SucessoPinecone --> Fim
```

Essa Resiliência Tripla é o que permite a Maia continuar funcionando do lado do educando mesmo quando Arquivos JSON do Banco Vectorial Cloudflare são limpos por acidente, pois o RDTB age de Backup Cego.

---

## 4. Snippets de Código "Deep Dive" (A Engenharia Híbrida)

O módulo usa técnicas avançadas de Criptografia Base64 URL-Safe para conectar dois Bancos de Dados completamente Alheios. 

### A Desanitização da Chave Híbrida

O Pinecone (Banco Vetorial) proibe barras transversais (`/`) ou aspas em seus IDs. O Firebase Exige essas barras para criar sub-árvores lógicas (`questoes/ENEM/Q01`). A função reverte os carateres ilegais.

```javascript
/* Reversão Base64 URL-Safe do Pinecone Hit para a RTDB File Tree System */
function desanitizarID(encoded) {
  if (!encoded) return "";
  try {
    // 1. Substitui os traços salvos lá atras na Pipeline de Envio 
    // por "+" legais no Base64. Underscores voltam pra '/'.
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    
    // 2. Padding Injection. Base64 sem '=' no fim fica corrompido em alguns decoders V8 NodeJS
    while (base64.length % 4) {
      base64 += "=";
    }
    
    // 3. Decodificador Nativo
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    // Escape Global Rescue 
    return encoded;
  }
}
```

### O Desvio Gradual (Fallback Semântico do RAG)

Qualquer VectorDB se calará se você colocar metadata parameters incorretos. A função `trySearch` encapsula o Cloudflare Worker de Query e é chamada sequencialmente afrouxando o torniquete:

```javascript
/* Trecho Isolado de Degradação Assíncrona no findBestQuestion() */

let bestMatch = await trySearch(vetor, { institution, year, subject });

// Falhamos em achar Fuvest 2024 Fisica? Arranca o Ano. Vamos por Fuvest Física qualquer data.
if (!bestMatch && year)
  bestMatch = await trySearch(vetor, { institution, subject });

// Falhamos de novo? Arranca a matéria. Qualquer coisa da Fuvest ligada a esse Vetor serve.
if (!bestMatch && institution)
  bestMatch = await trySearch(vetor, { subject });

// Acabou a palhaçada. Pega qualquer teste do Brasil que bata sematicamente (Cosseno Simillarity) com {textoBase}
if (!bestMatch) 
  bestMatch = await trySearch(vetor, {});
```

### O Fallback Derradeiro (Random RTDB Catcher)

Se até mesmo o Pinecone estiver Off-line. Evitamos jogar Red Error pro Firebase. Usamos um Shuffle Cego.

```javascript
// Estrutura: questoes -> { "PROVA_X": { "Q1": {}, "Q2": {} } }
// Puxando 'limitToFirst(3)' garantimos não explodir o pacote do Firebase Network Data Load limit.
const provasQuery = query(ref(db, "questoes"), limitToFirst(3));
const provasSnap = await get(provasQuery);

if (provasSnap.exists()) {
   // Transforma O Objeto de Árvores {key: {key: value}} em Lista Numerica Indexável
   const provas = provasSnap.val();
   const keysProvas = Object.keys(provas);
   
   // Roleta Russa de Provas
   const provaKey = keysProvas[Math.floor(Math.random() * keysProvas.length)];
   const questoesDaProva = provas[provaKey];
   
   /* ... Tira Dentre a Prova um Key Randômico ... */
   
   result = { id: questaoKey, fullData: data, score: 0 };
}
```
Detalhe letal: `score: 0`. O Chat saberá de antemão que essa Resposta O(1) de Backup foi forçada pela contingência. O Front-end pode omitir o Score "100% Match" que usualmente mostra em verde para não mentir para o usuário.

---

## 5. Exceções e Conflitos Físicos (Cloud Desync)

O Maior risco na arquitetura Híbrida RAG + NoSQL é quando os dados em nuvem divergem:

| Alarme Crítico de Desincronia | Solução Embutida | Desfecho na Tenda Front End |
|-------------------------------|------------------|-----------------------------|
| "Achei no Pinecone, mas o DB diz 404" | A condição `if (snapshot.exists())` age de Guard. Ele Loga um "Warning Questão Não Encontrada". | O Sistema entende The Hit como falso e atira o Aluno para o Fallback Genérico do Math.Random. Permite que o Engenheiro de Dados limpe o banco Vetorial via DashBoard. |
| Pinecone retorna Array Match com Múltiplas "---" no Split. (Sanitizer Quebrado) | O código cobra `if (parts.length === 2)`. O desrespeito a Tupla `{Prova}--{Questão}` ignora o ID sujo. | Impede injeções de Null Reference de varrerem the Backend Endpoint do RealTime. |
| O Firebase RTDB sofre Zero Registros Totais (Plataforma Nova) | Toda a Promise reverte pela lei do Throw Nativo e desaba (`throw new Error("Banco Vazio")`). | O Catch envia o erro terminal e a Pipeline Generativa recusa responder no Chat com uma modal pedindo pra adicionar Docs no "Upload UI". |

---

## 6. Referências Cruzadas Completas

A complexidade e ramificação que regem este módulo "cão farejador" transborda para toda a IA:

- [Router System Prompts — De onde originam-se as ordens expressas de `Instituiton`, `School` e `Year` usadas de parâmetro nesse Script RAG de Filtro Opcional.](/chat/router-prompt)
- [Estrutura Realtime Database (`estrutura-rtdb.md`) — The Blueprint Book. Ensina como O Firebase entende as Tuplas aninhadas "Prova -> Key" referenciadas arduamente aqui.](/firebase/estrutura-rtdb)
- [Serverless Cloudflare Worker (`proxy-services.md`) — Encapsulado aqui pelo `queryPineconeWorker()`, executa Os Embeddings de Semantica (Float Math32) para O Cosine Engine ler fora do Client-side.](/api-worker/proxy-services)
- [Firebase Envio (`envio.js`) — Módulo Pai ativamente invocado pelo Professor de quem é derivado toda A Base Pinecone que estamos usando The Read Query Now!](/firebase/envio)
