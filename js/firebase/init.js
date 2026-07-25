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

// Configuração de Persistência
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Escuta o estado inicial APÓS a tentativa de restore do Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('Sessão restaurada para:', user.uid);
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
