# Login Modal — Sistema de Identidade e Autenticação

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+login-modal&labels=docs)

## Visão Geral

O módulo `login-modal.js` (`js/ui/login-modal.js`) centraliza toda a lógica client-side de autenticação com o Firebase Auth. Com 546 linhas, ele engloba a renderização condicional das Views (Login, Registro, Recuperação de Senha, Verificação de Email) dentro de um único modal na arquitetura Single Page Application (SPA), garantindo segurança total de sessão via Google e Email/Password.

## O Padrão "Imperative View Manager"

Como a base legada do Maia não usava rotas React para autenticação, o fluxo é gerido imperativamente através de templates literais injetados no lado direito do modal (`#loginModalRight`):

```javascript
// --- View Manager ---
function switchView(viewName, data = null) {
  rightPanel.style.opacity = "0"; // Trigger fade out
  setTimeout(() => {
    if (viewName === "LOGIN") {
      rightPanel.innerHTML = renderLoginView();
      attachLoginListeners();
    } else if (viewName === "REGISTER") {
      rightPanel.innerHTML = renderRegisterView();
      attachRegisterListeners();
    } else if (viewName === "FORGOT_PASSWORD") {
      rightPanel.innerHTML = renderForgotPasswordView();
      attachForgotListeners();
    } else if (viewName === "VERIFY_EMAIL") {
      rightPanel.innerHTML = renderVerificationView(data?.email);
      attachVerificationListeners();
    }
    rightPanel.style.opacity = "1"; // Trigger fade in
  }, 200);
}
```

O `setTimeout` com mutações de opacidade cria animações suaves durante transições de contexto (ex: ir de Login para Cadastre-se) sem nunca desmontar o modal inteiro (o lodo esquerdo com logo do Maia se mantém estático).

## Arquitetura de Integração com Firebase

```mermaid
flowchart TD
    UI[Login Form] --> |Submit| HND[Handlers]

    HND --> |signInWithEmailAndPassword| FBAuth[Firebase Authentication]
    HND --> |createUserWithEmailAndPassword| FBAuth
    HND --> |loginWithGoogle / linkWithPopup| FBAuth

    FBAuth --> |Validação| RES{Resultado?}
    
    RES -- Sucesso --> VEF{Email Verificado?}
    VEF -- Sim --> CLOSE[Fecha Modal, Entra na App]
    VEF -- Não --> SVW[switchView('VERIFY_EMAIL')]

    RES -- Erro --> ERR[Lança AuthError genérico ou específico]
    ERR --> CA[customAlert('Senha incorreta...')]
```

## Fluxos Mágicos (Edge Cases Críticos)

### 1. Prevenção de Contas Fantasmas (Email Verification Block)

Muitos sistemas permitem login imeditado. O Maia é estrito devido a segurança DB:

```javascript
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const user = userCredential.user;

if (!user.emailVerified) {
  switchView("VERIFY_EMAIL", { email: user.email });
} else {
  closeModal(); // Permite entrar
}
```

Isso garante que spam-accounts não congestionem o Firebase, pois não fechará o modal até que `user.emailVerified === true` atestado via recarregamento do token.

### 2. Conversão de "User Anônimo" para Conta Real (Progressive Profiling)

A inovação mais profunda deste arquivo é o `linkWithCredential`. No maia, você pode interagir com o site como anônimo temporário:

```javascript
const currentUser = auth.currentUser;
let user;

if (currentUser && currentUser.isAnonymous) {
  // Transforma conta anônima da sessão em conta OFICIAL 
  const credential = EmailAuthProvider.credential(email, password);
  const userCredential = await linkWithCredential(currentUser, credential);
  user = userCredential.user;
} else {
  // Criação padrão do zero
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
}
```

Caso o user tente associar o anônimo à uma Conta Google que já existe, cai em `auth/credential-already-in-use`, que o sistema captura e converte inteligentemente num [Login Tradicional](#) sem perda de dados locais.

## Tratamento Global de Erros de Auth

Em vez de "Uncaught Exceptions", há um parser humano legível:

```javascript
function handleAuthError(error) {
  let msg = "Ocorreu um erro. Tente novamente.";
  if (error.code === "auth/email-already-in-use") msg = "Este email já está cadastrado.";
  if (error.code === "auth/weak-password") msg = "A senha deve ter pelo menos 6 caracteres.";
  // ... etc
  customAlert(msg);
}
```

## Referências Cruzadas

- [Sidebar Tabs — Onde o Firebase atualiza a UI Pós-Login](/ui/sidebar-tabs)
- [Modais UI Base — Referência de comportamento e estilo de modais](/ui/modais)
- [API Key Modal — Outro sistema client-side de gestão de credenciais isolado](/ui/api-key-modal)
