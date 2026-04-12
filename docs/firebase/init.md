# Inicializador Firebase (Auth & Core) — Singleton de Conexão Nuvem/Edge

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Firebase Init](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+firebase-init&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `init.js` (`js/firebase/init.js`) atua como a ignição primordial ("Big Bang") do back-end "Serverless Client-Side" da Maia EDU. Na arquitetura legada (V1), a aplicação inicializava o SDK do Firebase espalhando as tags no HTML e invocando APIs de Autenticação sem nenhum Single Source of Truth (SSOT). Isso causava vazamentos de memória de *listeners* do `onAuthStateChanged` sendo acoplados multiplamente nos componentes do React. 

Na arquitetura atual (V2), o módulo encapsula de ponta a ponta as suítes de Realtime Database, Firestore e Authentication (GCP/Google Cloud Platform). Devido ao paradigma "Edgeless" do projeto (onde o Worker age sem DB de usuário), o cliente mantém seu próprio link direto com o banco via SDK modular da versão 12.6.0. Além de injetar dependências ambientais de segurança (`import.meta.env`), esse arquivo executa um fallback passivo para garantir que a aplicação nunca pare de funcionar se o estudante deslogar, adotando o conceito arquitetural conhecido como **"Silent Anonymous Session"**.

---

## 2. Arquitetura de Variáveis e Módulos Exportados (State Management)

Diferente de componentes mutáveis, The Initialization Object carrega **Ponteiros de Memória** rígidos criados no momento do Bootstrap.

| Referência Exportada | Instância GCP Equivalente | Tempo de Vida (Lifecycle) | Função Crítica na Plataforma |
|----------------------|---------------------------|---------------------------|------------------------------|
| `app` | `FirebaseAppImpl` | Vida Útil da PAB | Contém o registro de Project ID, Analytics Metrics e Chaves Secretas puxadas do `.Vite Env`. |
| `db` | `Database` (RTDB) | Singleton Persistente | Gerencia o Socket WebSockets `wss://` para o Realtime Database, primariamente usado para ler a Árvore de Questões (Questionários Gigantes). |
| `firestore` | `Firestore` | Singleton Persistente | SDK ativado para manuseio pesado de documentos hierárquicos e Coleções futuras (ex: Métricas de Alunos / Analytics Pedagógico Documental). |
| `auth` | `Auth` | Singleton Observador | Gerencia os Cookies de Sessão Seguros. Mantém a Identidade JWT do token para os Fetchs Cloudflare e Vertex APIs. |
| `firebaseConfig` | Objeto Literal | Estático (Build Time) | Esconde os Segredos e injeta na Cloud no cold-start da página. |

---

## 3. Diagrama: Fluxo de Autenticação Edge / Anonymous Fallback

Nenhum usuário bate na plataforma como "Desconhecido" completo para as Regras do Firebase.

```mermaid
flowchart TD
    Build[Vite Bundle Loading] --> Start[Browser acessa app.maia.edu]
    Start --> LoadSDK[Call: initializeApp(Env)]
    
    LoadSDK --> EngineAuth[Call: getAuth(app)]
    LoadSDK --> EngineDB[Call: getDatabase(app)]
    
    EngineAuth --> PersistenceSet[Call: setPersistence(browserLocalPersistence)]
    
    PersistenceSet --> Observer[Acopla onAuthStateChanged Listener O(1)]
    
    Observer --> VerificaTGC{FireBase JWT Local Token Existe?}
    
    VerificaTGC -->|Yes| RestauraSessao[Retorna Sessão: User UID (Logado ou Anon Antigo)]
    VerificaTGC -->|No Logged Token| FallbackCriacao[Call: signInAnonymously()]
    
    FallbackCriacao --> CriaAnonimo[Cria Cadastro Temporário Shadow Profile]
    CriaAnonimo --> BackendRule[Garante que o DB não dê Permission Denied Error 403]
    
    RestauraSessao --> DetachListener[Kill AuthListener Unmound()]
    BackendRule --> DetachListener
    
    DetachListener --> ApplicationRuns[React Front-End Hydration inician... Chat Liberado.]
    
    UserClicaLogoff([Usuário clica em 'Sair']) --> CallLogoff[Call: logoutUser()]
    CallLogoff --> FireBaseSignOut[SDK: signOut(auth)]
    FireBaseSignOut --> LoopInfinito[Volta pro Call: signInAnonymously() forçando navegação limpa]
```

O "Loop Infinito" salvaguarda que o Front-End da Maia *nunca* opere em estado Null (Usuário ausente). Isso é crucial para as Service Workers confiarem num GUID sempre presente, mesmo descartável.

---

## 4. Snippets de Código "Deep Dive" (Integração e Silent Sessions)

A infraestrutura é moldada com `onAuthStateChanged` operando como Promise Resolvers não-convencionais.

### Restauração Anônima de Início

O Firebase SDK V9+ é agressivamente assíncrono. Na primeira vez que a página inicia, o Cookie Local demora X ms para decriptar. A interceptação a seguir impede vazamento.

```javascript
/* Trechos do Init.js */

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Escuta o estado inicial APÓS a tentativa de restore silencioso do Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Sucesso de Identidade. Pode ser o Aluno "João" via Google, ou um Anônimo das trevas #4930.
        console.log("Sessão restaurada para:", user.uid);
      } else {
        // NUNCA DEIXE NULO.
        console.log("Nenhum usuário detectado. Iniciando sessão anônima...");
        signInAnonymously(auth).catch((error) =>
          console.error("Erro na autenticação anônima:", error),
        );
      }
      
      // O PULO DO GATO ARQUITETURAL: 
      // Matamos a espiã aqui. Se deixassemos solto, qualquer LogOut/LogIn dispararia
      // esse micro-fluxo e bugaria o App causando Re-renders Infinitos na UI Root.
      unsubscribe();
    });
  })
```

### O Desacoplador de Logouts `logoutUser()`

Em Plataformas de EdTech como a Maia, botões de Sair costumam levar a um "Redirect para /login". Mas The Maia EDU é um SPA Offline-First Tool! Portanto:

```javascript
export async function logoutUser() {
  try {
    // Elimina o Perfil de Estudante Pagante Oficial (Google Provider)
    await signOut(auth);
    console.log("User logged out");
    
    // NO VOID ALLOWED: O App reencarna o usuário num Shadow Ghost account
    // Permitindo que as abas de Chat não crashem com `auth/permission-denied` Security Rules RTDB
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
}
```

---

## 5. Integração Ambiental Segura (`import.meta.env`)

A Maia.edu adota o Bundler Vite. Os Segredos contidos na `firebaseConfig` jamais são HardCoded. Porém, como o Firebase Firebase-Init roda no Client-Side (Navegador do Aluno), essas Keys *SÃO PÚBLICAS POR NATUREZA* da API Rest Google Identity.

```javascript
export const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,  // Padrão Público Firebase V1
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  // ...
};
```
> ⚠️ **Security Warning**: O Firebase API KEY que vaza na Rede do Browser não gerencia autorizações severas de Bando de Dados; para proteger o DB a The Maia implementa Regras Server-Side (`.rules`) de Validação RAG. O SDK acima apenas valida a rota do SDK Google.

---

## 6. Manejo de Falhas (Edge Cases) e Desconexão O(n)

Se o Singleton Core do Serviço falhar, todo o Sistema Entra Em Shock.

| Anomalia ou Ponto de Falha | Escudo Sistêmico no Firebase Init | Consequência |
|----------------------------|-----------------------------------|--------------|
| **Bloqueador de Cookies / Brave Browser Shield (Strict Mode)** | Falha massiva no Evento `setPersistence(..., browserLocalPersistence)` do Init JS. | A Promessa atira O Rejeito pro `Catch`. O Singleton do DB inita como Em-Memória-Somente; o aluno conseguirá usar a Maia mas num F5 o Shadow Profile é destruído e o Histórico de Chat evapore (Offline local data loss). |
| **Bandeira Vermelha do Cloud "API Key Invalid" / Token Revogado** | `initializeApp()` estoura um Runtime Error antes mesmo da Renderização de UI (Pre-mounting). | O Sistema paralisa na Tela Branca. Evitamos try/catch na Config Pai pois o Frontend não possui fallback "Sem Cloud". O crash early (Early Rejection) protege o App de gerar chamadas de Chat Fantasmas inuteis pro Backend/Vertex. |
| Usuário clica em LogOut mas perde 4G instantâneamente 1ms depois. | O `.catch` na promisse localiza a String de `NETWORK_ERROR`. O SDK do Cache guarda o pedido Offline (Mutation pending) e desconecta ao retomar Wi-Fi. | Segurança máxima de Redireção Desatada. A Sessão "vira fantasma". |

---

## 7. Referências Cruzadas Completas

Para entender a teia massiva que inicia neste ínfimo inicializador de SDK e devora milhões de interações por dia da Plataforma Maia:

- [Login Modal UI (Componente Front-End) — A Tela que provém o Botão Colorido que ativa o `loginWithGoogle()` deste arquivo.](/ui/login-modal)
- [Estrutura Realtime Database (`estrutura-rtdb.md`) — O Design do Banco de Dados consumido Ocultamente pelo Objeto Constante `db` exportado.](/firebase/estrutura-rtdb)
- [Proxy Services (Worker) — O Cloudflare não usa isso! Lá há um Firebase-Admin API (ServerSide) via Chave de Serviço Oculta, contornando a Public Key.](/api-worker/proxy-services)
- [Form Upload App — Dispara Writes brutos pelo import explícito do `db` nas requisições Write Base Data.](/upload/form-logic)
