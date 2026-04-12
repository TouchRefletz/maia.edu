# Estrutura do Realtime Database (RTDB Blueprint) — O Esqueleto de Conhecimento NoSQL

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Estrutura RTDB](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+firebase-estrutura-rtdb&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `estrutura-rtdb.md` (`docs/firebase/estrutura-rtdb.md`) não espelha um `.js` da aplicação; este manifesto documenta a **Topologia Estrutural Categórica** impetrada nativamente no Google Firebase Realtime Database. Na V1 do Maia EDU, o time testou aderir ao longo Cloud Firestore (Document Based Database). O Firestore, por custar 1 Dólar a cada N Leituras, esmagou a rentabilidade comercial do app ao permitir que alunos rodassem 20 mil consultas (Pagination Query) ao navegarem loucamente pelas abas de questões sem de fato resolverem nada.

Ao transitar para a Arquitetura RTDB (V2) e abandonar o Firestore, o modelo migrou para "Árvores de JSON Contíguas em Massa" (Realtime DB Node Maps). Aqui, a cobrança se dá apenas por Gigabytes de Downloaded Bandwidth trafegada. Isso requereu uma remodelação intensa para impedir Deep Nodes (Árvores Fatais que baixam megabytes por estarem no topo). Esta Doc rege como A API insere e recupera e impede Database Chokes na Nuvem.

---

## 2. Arquitetura The Node Tree (Modelo Mental Top-Down)

No RTDB Não existem Tabelas. Existe apenas um JSON Titânico (O God Object). A Maia adotou o sistema "Flattening" em profundidade N=3 máxima.

| Nó Raiz (Path String) | Estrutura Equivalente | Nível Lógico de Segurança | Função Explícita |
|-----------------------|-----------------------|---------------------------|------------------|
| `/questoes` | `Collection Map` | Leitura Cega Total / Gravação Trancada | A Árvore-Raíz Magna Onde Todas as provas do universo repousam. Se o Worker Frontend ler isso sem Restrição Limit (ex `LimitToFirst(3)`), o app trava e baixa 20MB ao invés de buscar a Prova Única. |
| `/questoes/{prova_id}` | `Row HashMap Parent` | Foreign Key Associativa | Exemplo: `/questoes/enem_2023`. Aglomera 90 nós filhos de questões puras. Essencial para varreduras Offline-First do Service Worker onde a aba inteira é carregada simultâneamente. |
| `/questoes/{prova_id}/{hash_id}`| `Row Atomic Target` | Primary Key Escrita/Lida Cripto | O endpoint cirurgico e ponta de folha de arquivo. Onde `envio-textos.js` bate usando O(1) read capability. |
| `/history` | `Collection Map` | User Isolated (Token Auth) | Estrutura segregada de metadados para salvar os Rumbles passados dos Alunos no Chat, isolada completamente do Global DB para evitar Data Leaks em massa. |

---

## 3. Diagrama: O Flattening do RTDB (Node Mapping Graph)

A representação NoSQL visual da estrutura exigida de todos os serviços que acatam o `set()` ou `update()`:

```mermaid
graph LR
    Root[/RTDB (JSON Root)/]

    Root --> QuestoesN[Node: /questoes]
    Root --> UsersN[Node: /users]
    Root --> AnalyticsN[Node: /analytics]

    QuestoesN --> ProvaUnicamp[Folder: /unicamp_24_fase1]
    QuestoesN --> ProvaEnem[Folder: /enem_24_caderno_azul]
    
    ProvaUnicamp --> QuestaoID1(<fa:fa-file-code> Node: LKOQwe9_2z)
    ProvaUnicamp --> QuestaoID2(<fa:fa-file-code> Node: MNzPxx0_9q)
    
    QuestaoID1 --> MetadatiObj{Objeto Final}
    
    MetadatiObj -.-> P_Questao[chave: questaoFinal (Raw Markdown Text)]
    MetadatiObj -.-> P_Gab[chave: gabaritoLimpo (Raw Markdown Text)]
    MetadatiObj -.-> P_Meta[chave: meta]
    MetadatiObj -.-> P_Imgs[chave: URLs CDN Imagens]
    
    P_Meta -.-> Source[source_url: 'google_pdf_link']
    P_Meta -.-> Time[Timestamp: 'Epoch MS']
    
    UsersN --> UIDNode[Node: {firebase.auth.uid}]
    UIDNode --> UHistory[Node: /chat_records]
```

### O Desastre Arquitetural da V1 Previsto e Evitado

Na V1, o objeto Imagem era inserido no próprio Firebase em String `Base64`. Com uma Imagem em HD Pesando 2MB, um Hit cego em `/questoes/enem_` pedia 90 folhas (90x2 = 180MB). O Navegador Crashava com RAM Exceedance na Aba. A V2 expurgou Bases64 do Cloud. Imagens são obrigatoriamente links da Vertex Web Storage (Cloudflare CDN) e ocupam menos de 20 bytes (The String).

---

## 4. Snippets de Código "Deep Dive" (Integrações Base)

Quando desenvolvedores tentarem acessar Os Nós de RDTB ou Escrever, usarão paths literais absolutos devido a falta de documentação do próprio SDK. Observe a liturgia rígida:

### Querying Profundo usando Paths de Referência O(1)
```javascript
// FORMA PERFEITA DA V2 O(1) de Latência Reduzida:
// O ID 'ID_ALFA' do Pinecone mapeou a Prova Fuvest_2022_Q45. Ele extrai perfeitamente o Node O(1)
const questaoEspecifica = ref(db, `questoes/Fuvest_2022/Q45_ALFA`);
const singleSnapshot = await get(questaoEspecifica); 

if (singleSnapshot.exists()) {
   // O Payload Carregado tem exatos ~0.5Kb de Tamanho, Response Time na casa de 80ms.
   var corpoDaQuestao = singleSnapshot.val().questaoFinal; 
}
```

### O Pattern O(n) Destruidor de Faturamento: (Evite Sempre!)
Um engenheiro júnior poderia tentar fazer Full-Text Searching via Frontend Fetch (Isso é uma atrocidade no NoSQL):

```javascript
/* ANTI-PATTERN MASSIVO! NÃO UTILIZAR NUMCA NA MAIA.EDU V2 */

// O Usuário baixa O NÓ RAIZ INTEIRO (Baixando milhares de Provas, MBs de lixo local)
const rootDeQuestoes = ref(db, `questoes`);
const fullDB = await get(rootDeQuestoes); 

// E Manda Filtrar no Browser Front-End! Congela a Aba do Chrome.
const acheMatematica = Object.values(fullDB.val()).filter(prova => prova.title === 'mat')
```

A estrutura JSON exige que o Motor Primordial para buscas não lide com Querying nativo. Use O Pinecone (Vector Embedding) para achar String Matches Textuais, e O UUID do Match para usar o Exemplo Básico Um.

---

## 5. Security Rules Constraint (Regras em Cloud Enforced)

No Painel Server-Side do Google Firebase Console. O arquivo `.rules` aplica a Constituição Lógica que protege os caminhos desta Doutrina Estrutural de Hackers usando POSTMAN para sujar a Base de Dados.

```json
/* O arquivo Database.rules.json Protegido por Firebase Admin */
{
  "rules": {
    "questoes": {
      // 1. Leitura Aberta (Read): Crianças logadas e Testadores Anônimos podem navegar nas VDB.
      ".read": "(auth != null) || (auth.token.firebase.sign_in_provider == 'anonymous')",
      
      // 2. Gravação Restrita e Validação de Esquema (Write Strict)
      // Só Adms sobem Provas pelo App "Upload Forms"
      ".write": "root.child('admins').child(auth.uid).exists()",
      
      "$prova_id": {
        "$questao_id": {
          // O Node "questaoFinal" deve ser SEMPRE do Tipo String. Nunca um Array JSON ou Null Subtree.
          ".validate": "newData.hasChildren(['questaoFinal', 'gabaritoLimpo']) && newData.child('questaoFinal').isString()"
        }
      }
    },
    // Usuários Jamais lêem os Histories de outros Usuários (Segregação AuthUID)
    "users": {
      "$uid": {
         ".read": "auth != null && auth.uid == $uid",
         ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```
A injeção dessas travas impede SQL Injections modernizados por Hackers que enviem sub-trees maliciosas com Deep Arrays e derrubem The Engine via Range Limitations. Sem o campo `.isString()` garantido no Payload, o App React explodiria Map errors.

---

## 6. Mapeamento Psicológico de Edge Cases Locais da Estrutura RTDB

O RTDB foi escolhido primariamente porque sua API fornece `Offline Caching` massivo. Mas, a Árvore JSON cria "Gargalos Zumbis":

| Anomalia | Gatilho | Tratativa Híbrida e Reação Frontend |
|----------|---------|--------------------------------------|
| Aba Excedendo Nivel Local (Memory Size Quota de Service Worker). | Disparar LimitToFirst sem especificar o Limit em Provas muito robustas (Enem 350 Questões) estocando LocalData pesados no cache Offline. | Usa-se `query(ref, limitToFirst(3))` para restringir Download Sizes, cortando Fallbacks de Caching gigantes da memória. Poupando o celular do estudante de sobreaquecer. |
| Carácteres Especiais (`/ \ $ . % `) enxertados num "nome de prova de origem" | A Firebase Firebase Engine lança Error Crítico. A URI de Path Structure Node Maps *Não Admite* Chars sensíveis. | A função `gerarIdentificadoresEnvio` no modulo `envio-textos` purga a Base64 ou URLify Sanitizers `replace(/[/.$[]#]/g, '_')` criando Paths Hígidas tipo `UNICAMP_SP_2022`. |
| Null Values vs Array. (As matrizes sumiram) | O RTDB do Firebase é famoso por detestar Arrays Numéricos. Se a Maia atirar `[null, "B", "C"]`, O db destrói o Array e cria um Hashmap `{"1": "B", "2": "C"}`. | Jamais utilize arrays simples para mapeamento de gabarito nas Ingestões. Sempre encapsule tudo em Strings literais (JSON Stringify), obrigando a RTDB a tratar o dado como um Bloco de Blop. |

---

## 7. Referências Cruzadas Completas

A Doutrina RTDB espalha seus tentáculos aos seguintes Arquivos do Source de forma massiva e acoplada:

- [Envio Node System (`envio.js`) — Módulo principal de Onde O JSON Root gordo das questões se materializa (Insert DB).](/firebase/envio)
- [Buscador Extrator de Path `questoes/` (`question-service.js`) — A Raiz que usa The Split Logic pra rastrear A Pasta da Prova e achar o UUID limpo da Query Semântica Pinecone.](/firebase/question-service)
- [Upload Logic Mappers (`form-logic.js`) — O Pipeline Web que lê O PDF Uploadado e acopla metadata pra injetá-la compatível ao Scheme validado aqui na Database de Regras.](/upload/form-logic)
- [DB Initialization SDK (`init.js` ) — Injetor primário Onde a referência Global O(1) do Mapeamento "db" Exporta seu Pointer PAB para todos os scripts consumirem essa estrutura.](/firebase/init)
