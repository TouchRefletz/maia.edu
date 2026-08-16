import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// Configuração do Firebase
export const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  databaseURL: import.meta.env.FIREBASE_DATABASE_URL,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
  measurementId: import.meta.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Inicializa o Realtime Database
export const db = getDatabase(app);

// Inicializa Autenticação
export const auth = getAuth(app);

// Inicializa Firestore
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
export const firestore = getFirestore(app);

// Inicializa App Check (com ReCaptcha v3 e suporte a Debug Token)
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-check.js';
if (typeof window !== 'undefined') {
  const initAppCheck = () => {
    try {
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        // Permite validar seu ambiente local no Firebase Console
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Ler_YgtAAAAAK0nkuiEdqFaIj4zP0qEg7gzg_We'),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn('[AppCheck] Inicialização tolerada:', err.message);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppCheck);
  } else {
    setTimeout(initAppCheck, 100);
  }
}

// Configuração de Persistência
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Escuta o estado inicial APÓS a tentativa de restore do Firebase
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('Sessão restaurada para:', user.uid);
        try {
          const { get, ref } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
          const adminSnap = await get(ref(db, `admins/${user.uid}`));
          const isAdmin = adminSnap.exists() && adminSnap.val() === true;
          const { setAdminStatus } = await import('../utils/security-guard.js');
          setAdminStatus(isAdmin);
        } catch (_) {}
      } else {
        console.log('Nenhum usuário detectado. Iniciando sessão anônima...');
        signInAnonymously(auth).catch((error) =>
          console.error('Erro na autenticação anônima:', error),
        );
      }
      // Remove este listener específico de inicialização
      unsubscribe();
    });
  })
  .catch((error) => {
    console.error('Erro ao definir persistência da sessão:', error);
  });

export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('User logged out');
    // Re-authenticate anonymously to keep app working for non-logged in features
    await signInAnonymously(auth);
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// Re-export Auth functions for use in other modules
export {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
};
