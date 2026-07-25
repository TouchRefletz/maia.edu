import {
  auth,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  loginWithGoogle,
  logoutUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from '../firebase/init.js';
import { customAlert } from './GlobalAlertsLogic';

export function openLoginModal() {
  // Remove existing modal if any
  const existing = document.getElementById('loginModal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="loginModal" class="login-modal-overlay">
        <div class="login-modal-content">
            <button class="login-modal-close" id="closeLoginModal" title="Fechar">&times;</button>
            
            <div class="login-modal-left">
                <div class="login-logo-container">
                    <div class="login-logo-ring"></div>
                    <img src="logo.png" alt="Maia Logo" class="login-logo">
                </div>
            </div>

            <div class="login-modal-right" id="loginModalRight">
                <!-- Views will be injected here -->
            </div>
        </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById('loginModal');
  const closeBtn = document.getElementById('closeLoginModal');
  const content = overlay.querySelector('.login-modal-content');
  const rightPanel = document.getElementById('loginModalRight');

  // --- View Templates ---

  const renderLoginView = () => `
    <h2 class="login-title">Bem-vindo ao <span>Maia</span></h2>
    <p class="login-subtitle">Entre para continuar sua jornada.</p>

    <div class="login-actions">
        <!-- Google Login -->
        <button id="googleLoginBtn" class="login-btn google-btn">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span>Continuar com Google</span>
        </button>

        <div class="login-divider"><span>OU</span></div>

        <!-- Email/Password Form -->
        <form id="loginForm" class="login-form">
            <div class="input-group">
                <input type="email" id="loginEmail" class="login-input" placeholder=" " required autocomplete="username">
                <label for="loginEmail">Email</label>
            </div>
            <div class="input-group">
                <input type="password" id="loginPassword" class="login-input" placeholder=" " required autocomplete="current-password">
                <label for="loginPassword">Senha</label>
            </div>
            <div class="form-actions-row">
                <a href="#" id="forgotPasswordLink" class="link-sm">Esqueceu a senha?</a>
            </div>
            <button type="submit" class="login-btn primary-btn email-auth-btn">
                <span>Entrar</span>
            </button>
        </form>
    </div>
    
    <div class="login-footer">
        Não tem uma conta? <a href="#" id="goToRegister">Cadastre-se</a>
    </div>
  `;

  const renderRegisterView = () => `
    <h2 class="login-title">Criar <span>Conta</span></h2>
    <p class="login-subtitle">Junte-se a nós e comece a estudar.</p>

    <div class="login-actions">
        <!-- Google Login (Shortcut) -->
        <button id="googleRegisterBtn" class="login-btn google-btn">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span>Registrar com Google</span>
        </button>

        <div class="login-divider"><span>OU</span></div>

        <form id="registerForm" class="login-form">
            <div class="input-group">
                <input type="text" id="registerName" class="login-input" placeholder=" " required autocomplete="name">
                <label for="registerName">Nome Completo</label>
            </div>
            <div class="input-group">
                <input type="email" id="registerEmail" class="login-input" placeholder=" " required autocomplete="email">
                <label for="registerEmail">Email</label>
            </div>
            <div class="input-group">
                <input type="password" id="registerPassword" class="login-input" placeholder=" " required minlength="6" autocomplete="new-password">
                <label for="registerPassword">Senha</label>
            </div>
            <button type="submit" class="login-btn primary-btn email-auth-btn">
                <span>Criar Conta</span>
            </button>
        </form>
    </div>
    
    <div class="login-footer">
        Já tem conta? <a href="#" id="goToLogin">Faça Login</a>
    </div>
  `;

  const renderForgotPasswordView = () => `
    <h2 class="login-title">Recuperar <span>Senha</span></h2>
    <p class="login-subtitle">Enviaremos um link para o seu email.</p>

    <div class="login-actions">
        <form id="forgotPasswordForm" class="login-form">
            <div class="input-group">
                <input type="email" id="forgotEmail" class="login-input" placeholder=" " required autocomplete="email">
                <label for="forgotEmail">Seu Email</label>
            </div>
            <button type="submit" class="login-btn primary-btn email-auth-btn">
                <span>Enviar Link</span>
            </button>
        </form>
        <button id="backToLoginReset" class="btn-text" style="margin-top: 10px;">Voltar ao Login</button>
    </div>
  `;

  const renderVerificationView = (email) => `
    <h2 class="login-title">Verifique seu <span>Email</span></h2>
    <p class="login-subtitle">Enviamos um link de confirmação para <strong>${email}</strong>.<br>Por favor, confirme para acessar sua conta.</p>

    <div class="login-actions">
        <div class="verification-status-icon">
            ✉️
        </div>
        <button id="checkVerificationBtn" class="login-btn primary-btn">
            <span>Já verifiquei, entrar!</span>
        </button>
        <button id="resendVerificationBtn" class="login-btn outline-btn">
            <span>Reenviar Email</span>
        </button>
    </div>
    
    <div class="login-footer">
        <a href="#" id="backToLoginVerify">Voltar / Sair</a>
    </div>
  `;

  // --- View Manager ---

  function switchView(viewName, data = null) {
    rightPanel.style.opacity = '0';
    setTimeout(() => {
      if (viewName === 'LOGIN') {
        rightPanel.innerHTML = renderLoginView();
        attachLoginListeners();
      } else if (viewName === 'REGISTER') {
        rightPanel.innerHTML = renderRegisterView();
        attachRegisterListeners();
      } else if (viewName === 'FORGOT_PASSWORD') {
        rightPanel.innerHTML = renderForgotPasswordView();
        attachForgotListeners();
      } else if (viewName === 'VERIFY_EMAIL') {
        rightPanel.innerHTML = renderVerificationView(data?.email);
        attachVerificationListeners();
      }

      // Fade in
      rightPanel.style.opacity = '1';
    }, 200);
  }

  // --- Handlers & Listeners ---

  function closeModal() {
    overlay.classList.add('closing');
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
    }, 400);
  }

  // Common listeners (Close, etc)
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeModal();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };

  // --- Google Handlers ---

  async function handleGoogleSignIn() {
    const btn = document.getElementById('googleLoginBtn');
    const originalContent = btn ? btn.innerHTML : '';

    if (btn) {
      btn.innerHTML = "<span class='loader-spinner'></span>";
      btn.disabled = true;
    }

    const resetBtn = () => {
      if (btn) {
        btn.innerHTML = originalContent;
        btn.disabled = false;
      }
    };

    try {
      // Direct Sign In (No linking attempt)
      await loginWithGoogle();
      console.log('Login com Google bem sucedido!');
      closeModal();
    } catch (error) {
      console.error('Google Sign In Error:', error);
      if (error.code === 'auth/popup-blocked') {
        customAlert('O popup de login foi bloqueado. Por favor, permita popups para este site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('Popup fechado pelo usuário');
      } else {
        customAlert('Erro ao entrar com Google: ' + error.message);
      }
      resetBtn();
    }
  }

  async function handleGoogleLink() {
    const btn = document.getElementById('googleRegisterBtn');
    const originalContent = btn ? btn.innerHTML : '';

    if (btn) {
      btn.innerHTML = "<span class='loader-spinner'></span>";
      btn.disabled = true;
    }

    const resetBtn = () => {
      if (btn) {
        btn.innerHTML = originalContent;
        btn.disabled = false;
      }
    };

    const user = auth.currentUser;

    if (!user) {
      // Should catch this, but just in case
      handleGoogleSignIn();
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await linkWithPopup(user, provider);

      // Update profile with Google data
      const googleProfile = result.user.providerData.find((p) => p.providerId === 'google.com');
      if (googleProfile) {
        await updateProfile(result.user, {
          displayName: googleProfile.displayName,
          photoURL: googleProfile.photoURL,
        });
      }

      await user.reload();
      window.dispatchEvent(new Event('auth-changed'));

      console.log('Conta vinculada com Google com sucesso!');
      closeModal();
      customAlert('Conta criada e vinculada com Google com sucesso!');
    } catch (error) {
      console.error('Google Link Error:', error);

      if (error.code === 'auth/credential-already-in-use') {
        // Fallback: Account exists, so just sign in normally
        try {
          await loginWithGoogle();
          closeModal();
          // customAlert("Esta conta já existia. Você foi conectado a ela.");
        } catch (signInError) {
          console.error('Fallback Login Error:', signInError);
          customAlert('Erro ao entrar na conta existente: ' + signInError.message);
          resetBtn();
        }
      } else if (error.code === 'auth/popup-blocked') {
        customAlert('O popup foi bloqueado. Permita popups.');
        resetBtn();
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('Cancelado pelo usuário');
        resetBtn();
      } else {
        customAlert('Erro ao criar conta com Google: ' + error.message);
        resetBtn();
      }
    }
  }

  function attachLoginListeners() {
    document.getElementById('goToRegister').onclick = (e) => {
      e.preventDefault();
      switchView('REGISTER');
    };
    document.getElementById('forgotPasswordLink').onclick = (e) => {
      e.preventDefault();
      switchView('FORGOT_PASSWORD');
    };
    document.getElementById('googleLoginBtn').onclick = (e) => {
      e.preventDefault();
      handleGoogleSignIn();
    };

    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const btn = e.target.querySelector('button');

      setBtnLoading(btn, true);

      try {
        // Standard Sign In (Switching users or simple login)
        // We do NOT attempt to link anonymous users here anymore to prevent "Weak Password" errors
        // (which happen when mistakenly trying to link a new weak-password credential)
        // If the user wants to keep data, they should have used "Sign Up" or "Link Account" explicitly.
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
          switchView('VERIFY_EMAIL', { email: user.email });
        } else {
          closeModal();
        }
      } catch (error) {
        console.error('Login Error:', error);
        handleAuthError(error);
      } finally {
        setBtnLoading(btn, false);
      }
    };
  }

  function attachRegisterListeners() {
    document.getElementById('goToLogin').onclick = (e) => {
      e.preventDefault();
      switchView('LOGIN');
    };
    document.getElementById('googleRegisterBtn').onclick = (e) => {
      e.preventDefault();
      handleGoogleLink();
    };

    document.getElementById('registerForm').onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const btn = e.target.querySelector('button');

      setBtnLoading(btn, true);

      try {
        const currentUser = auth.currentUser;
        let user;

        if (currentUser && currentUser.isAnonymous) {
          // Link Anonymous to new Email Credential
          try {
            const credential = EmailAuthProvider.credential(email, password);
            const userCredential = await linkWithCredential(currentUser, credential);
            user = userCredential.user;
            console.log('Anonymous linked to new Email/Password!');
          } catch (linkError) {
            if (linkError.code === 'auth/email-already-in-use') {
              // Fallback: This email is taken. We cannot link. The user must sign in.
              throw linkError;
            }
            // If other error, re-throw
            throw linkError;
          }
        } else {
          // Standard Create
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          user = userCredential.user;
        }

        // 2. Update Name
        await updateProfile(user, { displayName: name });

        // 3. Send Verification
        await sendEmailVerification(user);

        // 4. Show Verification View
        switchView('VERIFY_EMAIL', { email: user.email });
      } catch (error) {
        console.error('Register Error:', error);
        handleAuthError(error);
      } finally {
        setBtnLoading(btn, false);
      }
    };
  }

  function attachForgotListeners() {
    document.getElementById('backToLoginReset').onclick = (e) => {
      e.preventDefault();
      switchView('LOGIN');
    };

    document.getElementById('forgotPasswordForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail').value;
      const btn = e.target.querySelector('button');

      setBtnLoading(btn, true);

      try {
        await sendPasswordResetEmail(auth, email);
        customAlert('Email de redefinição enviado! Verifique sua caixa de entrada.');
        switchView('LOGIN');
      } catch (error) {
        console.error('Reset Password Error:', error);
        handleAuthError(error);
      } finally {
        setBtnLoading(btn, false);
      }
    };
  }

  function attachVerificationListeners() {
    document.getElementById('backToLoginVerify').onclick = async (e) => {
      e.preventDefault();
      // Log out just in case
      await logoutUser();
      switchView('LOGIN');
    };

    document.getElementById('resendVerificationBtn').onclick = async (e) => {
      e.preventDefault();
      try {
        if (auth.currentUser) {
          await sendEmailVerification(auth.currentUser);
          customAlert('Email de verificação reenviado!');
        } else {
          customAlert('Sessão expirada. Faça login novamente.');
          switchView('LOGIN');
        }
      } catch (error) {
        handleAuthError(error);
      }
    };

    document.getElementById('checkVerificationBtn').onclick = async (e) => {
      e.preventDefault();
      const btn = e.target.closest('button'); // handle click on span
      setBtnLoading(btn, true);

      try {
        if (auth.currentUser) {
          await auth.currentUser.reload(); // IMPORTANT: Refresh state from server
          if (auth.currentUser.emailVerified) {
            closeModal();
            customAlert('Conta verificada com sucesso! Bem-vindo.');
          } else {
            customAlert('Ainda não verificado. Por favor, verifique seu email e tente novamente.');
          }
        } else {
          customAlert('Sessão expirada. Faça login novamente.');
          switchView('LOGIN');
        }
      } catch (error) {
        handleAuthError(error);
      } finally {
        setBtnLoading(btn, false);
      }
    };
  }

  // --- Helpers ---

  function setBtnLoading(btn, isLoading) {
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = "<span class='loader-spinner'></span>";
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || 'Enviar';
      btn.disabled = false;
    }
  }

  function handleAuthError(error) {
    // Improve error messages map
    let msg = 'Ocorreu um erro. Tente novamente.';
    if (error.code === 'auth/email-already-in-use') msg = 'Este email já está cadastrado.';
    if (error.code === 'auth/invalid-email') msg = 'Email inválido.';
    if (error.code === 'auth/weak-password') msg = 'A senha deve ter pelo menos 6 caracteres.';
    if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
    if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado.';
    if (error.code === 'auth/invalid-credential') msg = 'Senha incorreta!';

    customAlert(msg);
  }

  // Init
  rightPanel.innerHTML = renderLoginView();
  attachLoginListeners();
}
