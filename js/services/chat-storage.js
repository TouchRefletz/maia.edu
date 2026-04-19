import { customAlert } from "../ui/GlobalAlertsLogic";
import { auth, firestore } from "../firebase/init.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const DB_NAME = "MaiaChatsDB";
const DB_VERSION = 2; // Incrementado para suportar expiresAt
const STORE_NAME = "chats";

// 30 Minutos em ms
const LOCAL_EXPIRATION_TIME = 30 * 60 * 1000;

/**
 * Helper para abrir o banco de dados IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        // Novo index para expiração
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      } else {
        // Upgrade para V2 (se store ja existir)
        const store = event.target.transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains("expiresAt")) {
          store.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Wraps IDBRequest in a Promise
 */
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Serviço de Armazenamento Híbrido (IndexedDB + Firestore)
 * Regra: Tudo local expira em 30min. Logado recupera da nuvem.
 */
export const ChatStorageService = {
  /**
   * Recupera chat por ID.
   * Tenta local -> Verifica validade -> Se inválido/inexistente e logado, busca Nuvem.
   */
  async getChat(id) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const localChat = await requestToPromise(store.get(id));

      const now = Date.now();

      // Se existe localmente e não expirou
      if (localChat && localChat.expiresAt > now) {
        return localChat;
      }

      // Se expirou ou não existe, mas user tá logado, tenta Firestore
      const user = auth.currentUser;
      if (user) {
        console.log(`[ChatStorage] Buscando chat ${id} no Firestore...`);
        try {
          const docRef = doc(firestore, "users", user.uid, "chats", id);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const cloudChat = docSnap.data();
            // Re-hidrata localmente com nova validade
            await this.saveLocal(cloudChat);
            return cloudChat;
          }
        } catch (err) {
          console.warn("[ChatStorage] Erro ao buscar no Firestore:", err);
        }
      }

      // Se chegou aqui, ou não tá logado e expirou, ou não existe na nuvem.
      // Se expirou (localChat existe), devemos deletar?
      // Pela regra estrita, se expirou, não deve retornar.
      if (localChat && localChat.expiresAt <= now) {
        // Opcional: Trigger cleanup async
        this.deleteLocal(id).catch(() => {});
        return null; // Expirado = Perda
      }

      return null;
    } catch (e) {
      console.error("Erro ao buscar chat:", e);
      return null;
    }
  },

  /**
   * Recupera lista de chats.
   * Filtra expirados locais. Se logado, sync com nuvem (opcional ou lazy).
   * Para listagem rápida, vamos confiar no local e fazer sync em background ou apenas fetch.
   * Por simplicidade/performance:
   * - Retorna locais válidos.
   * - Se logado, faz fetch no Firestore para atualizar lista local (opcional, pode ser pesado).
   * Vamos fazer: Retorna locais válidos e dispara sync se logado apenas para headers.
   */
  async getChats() {
    try {
      // [FIX] Removido cleanupExpired aqui para evitar spam/loop.
      // A limpeza roda no boot e no intervalo.

      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("updatedAt");
      const allChats = await requestToPromise(index.getAll());

      // Ordenação
      let validChats = allChats.sort((a, b) => b.updatedAt - a.updatedAt);

      // [FIX] Removido syncFromCloud automático aqui para evitar Loop Infinito.
      // O sync é feito no Login (telas.js) e em ações específicas.

      return validChats;

      return validChats;
    } catch (e) {
      console.error("Erro ao ler chats:", e);
      return [];
    }
  },

  /**
   * Sincroniza chats da nuvem para local (One-way Cloud -> Local)
   */
  async syncFromCloud(uid) {
    console.log("[ChatStorage] Sincronizando lista do Firestore...");
    try {
      const querySnapshot = await getDocs(
        collection(firestore, "users", uid, "chats"),
      );
      const promises = [];
      querySnapshot.forEach((doc) => {
        const chatData = doc.data();
        // Salva local renovando validade
        promises.push(this.saveLocal(chatData));
      });
      await Promise.all(promises);
      window.dispatchEvent(new CustomEvent("chat-list-updated"));
    } catch (e) {
      console.warn("[ChatStorage] Falha ao baixar da nuvem:", e);
    }
  },

  /**
   * Sincroniza chats locais pendentes para a nuvem (Local -> Cloud)
   * Chama isso ao logar ou carregar página.
   */
  async syncPendingToCloud() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;

    try {
      console.log("[ChatStorage] Verificando chats locais para upload...");
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const allChats = await requestToPromise(store.getAll());

      // Itera todos os chats locais e garante que estejam no Firestore
      // (Poderíamos ter uma flag 'synced', mas por simplicidade e robustez,
      //  no caso de 'pendentes', vamos tentar salvar todos. O Firestore faz merge.)
      // Otimização: Só salva se não tiver sido atualizado recentemente na nuvem?
      // Por enquanto, "force update" garante integridade.
      const uploadPromises = allChats.map((chat) => {
        // Remove expiresAt antes de enviar
        const cloudPayload = { ...chat };
        delete cloudPayload.expiresAt;
        const cleanPayload = JSON.parse(JSON.stringify(cloudPayload));

        const docRef = doc(firestore, "users", user.uid, "chats", chat.id);
        // Usamos setDoc com merge para não sobrescrever dados se a nuvem tiver algo mais novo (teoricamente)
        // Mas aqui a fonte da verdade local está subindo.
        return setDoc(docRef, cleanPayload, { merge: true }).catch((e) =>
          console.warn(`Falha ao subir chat ${chat.id}:`, e),
        );
      });

      await Promise.all(uploadPromises);
      console.log(
        `[ChatStorage] Upload concluído! ${uploadPromises.length} chats processados.`,
      );
    } catch (e) {
      console.error("[ChatStorage] Erro no syncPendingToCloud:", e);
    }
  },

  /**
   * Salva chat. Local (30m) + Cloud (Se logado).
   */
  async saveChat(chat) {
    try {
      // 1. Salva Local (cria expiresAt se não tiver, ou renova)
      // A cada save, renovamos a sessão de 30min deste arquivo local
      await this.saveLocal(chat);

      // 2. Salva Firestore (Se logado e não anônimo)
      const user = auth.currentUser;
      if (user && !user.isAnonymous) {
        // Remove expiresAt antes de enviar pra nuvem (dado limpo)
        const cloudPayload = { ...chat };
        delete cloudPayload.expiresAt; // Nuvem é permanente

        // Firestore não curte arrays de undefined, limpa payload se precisar
        // Mas JSON stringify/parse limpa functions, etc.
        const cleanPayload = JSON.parse(JSON.stringify(cloudPayload));

        const docRef = doc(firestore, "users", user.uid, "chats", chat.id);
        setDoc(docRef, cleanPayload, { merge: true }).catch((err) =>
          console.error("[ChatStorage] Erro ao salvar no Firestore:", err),
        );
      }

      window.dispatchEvent(new CustomEvent("chat-list-updated"));
    } catch (e) {
      console.error("Erro ao salvar chat:", e);
      customAlert("Erro ao salvar chat.");
    }
  },

  /**
   * Salva apenas localmente com expiração.
   */
  async saveLocal(chat) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const chatWithExpiry = {
      ...chat,
      expiresAt: Date.now() + LOCAL_EXPIRATION_TIME,
    };

    await requestToPromise(store.put(chatWithExpiry));
  },

  /**
   * Deleta chat (Local e Nuvem se dono)
   */
  async deleteChat(chatId) {
    try {
      await this.deleteLocal(chatId);

      const user = auth.currentUser;
      if (user && !user.isAnonymous) {
        const docRef = doc(firestore, "users", user.uid, "chats", chatId);
        await deleteDoc(docRef);
      }

      window.dispatchEvent(new CustomEvent("chat-list-updated"));
    } catch (e) {
      console.error("Erro ao deletar chat:", e);
    }
  },

  async deleteLocal(chatId) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await requestToPromise(store.delete(chatId));
  },

  /**
   * Cria novo chat
   */
  async createNewChat(firstMessage, attachments = []) {
    const chat = {
      id: crypto.randomUUID(),
      title:
        firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : ""),
      messages: [
        {
          role: "user",
          content: firstMessage,
          attachments: attachments,
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveChat(chat);
    return chat;
  },

  async addMessage(chatId, role, content, attachments = []) {
    // Busca direto do getChat (que já resolve cloud/local/validade)
    const chat = await this.getChat(chatId);
    if (chat) {
      chat.messages.push({
        role,
        content,
        attachments,
        timestamp: Date.now(),
      });
      chat.updatedAt = Date.now();
      await this.saveChat(chat);
    } else {
      console.warn("Tentativa de adicionar msg a chat expirado ou inexistente");
    }
  },

  /**
   * Adiciona múltiplas mensagens de uma vez.
   * Útil para consolidar logs do pipeline.
   */
  async addMessages(chatId, messages) {
    if (!Array.isArray(messages) || messages.length === 0) return;

    const chat = await this.getChat(chatId);
    if (chat) {
      messages.forEach((msg) => {
        chat.messages.push({
          role: msg.role,
          content: msg.content,
          attachments: msg.attachments || [],
          timestamp: msg.timestamp || Date.now(),
        });
      });
      chat.updatedAt = Date.now();
      await this.saveChat(chat);
    } else {
      console.warn("Tentativa de adicionar msgs a chat expirado ou inexistente");
    }
  },


  async addScaffoldingStep(chatId, stepIndex, stepData) {
    const chat = await this.getChat(chatId);
    if (chat) {
      if (!chat.scaffoldingSteps) {
        chat.scaffoldingSteps = [];
      }
      chat.scaffoldingSteps[stepIndex] = {
        ...stepData,
        savedAt: Date.now(),
      };
      chat.updatedAt = Date.now();
      await this.saveChat(chat);
    }
  },

  async getScaffoldingSteps(chatId) {
    const chat = await this.getChat(chatId);
    return chat?.scaffoldingSteps || [];
  },

  async updateTitle(chatId, newTitle) {
    const chat = await this.getChat(chatId);
    if (chat) {
      chat.title = newTitle;
      await this.saveChat(chat);
    }
  },

  /**
   * Remove itens expirados do IDB
   */
  /**
   * Remove itens expirados do IDB com segurança (Sync -> Delete)
   */
  async cleanupExpired() {
    try {
      const db = await openDB();
      const user = auth.currentUser;
      const now = Date.now();

      console.log(
        "[ChatStorage] Iniciando limpeza de chats expirados (Cursor Scan)...",
      );

      // 1. Coleta itens expirados (Iteração via Cursor para pegar legado também)
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      const expiredChats = [];

      await new Promise((resolve) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const chat = cursor.value;
            let isExpired = false;

            // [FIX] Prioritize updatedAt logic as requested.
            // If chat hasn't been updated (user interaction) in 30 mins, it's considered "stale/expired" locally.
            // We ignore 'expiresAt' because it gets refreshed on sync/load, preventing cleanup.

            if (chat.updatedAt) {
              if (chat.updatedAt + LOCAL_EXPIRATION_TIME <= now)
                isExpired = true;
            } else if (chat.createdAt) {
              // Fallback if no update time
              if (chat.createdAt + LOCAL_EXPIRATION_TIME <= now)
                isExpired = true;
            } else if (chat.expiresAt) {
              // Last resort fallback
              if (chat.expiresAt <= now) isExpired = true;
            }

            if (isExpired) {
              expiredChats.push(chat);
            }

            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => resolve();
      });

      if (expiredChats.length === 0) {
        console.log("[ChatStorage] Nenhum chat expirado encontrado.");
        return;
      }

      console.log(
        `[ChatStorage] Encontrados ${expiredChats.length} chats expirados. Iniciando Safe Cleanup...`,
      );

      // 2. Sync to Firestore (if logged in and not anonymous)
      if (user && !user.isAnonymous) {
        try {
          console.log(
            "[ChatStorage] Sincronizando expirados com Firestore antes de deletar...",
          );
          const syncPromises = expiredChats.map((chat) => {
            const cloudPayload = { ...chat };
            delete cloudPayload.expiresAt;
            const cleanPayload = JSON.parse(JSON.stringify(cloudPayload));
            const docRef = doc(firestore, "users", user.uid, "chats", chat.id);
            return setDoc(docRef, cleanPayload, { merge: true });
          });

          await Promise.all(syncPromises);
          console.log("[ChatStorage] Backup concluído com sucesso.");
        } catch (e) {
          console.error("[ChatStorage] Falha no backup (cleanup abortado):", e);
          return; // Safety abort
        }
      }

      // 3. Delete Local
      // Nova transação write
      const txDelete = db.transaction(STORE_NAME, "readwrite");
      const storeDelete = txDelete.objectStore(STORE_NAME);
      let deletedCount = 0;

      const deletePromises = expiredChats.map((chat) => {
        return new Promise((resolve) => {
          const req = storeDelete.delete(chat.id);
          req.onsuccess = () => {
            deletedCount++;
            resolve();
          };
          req.onerror = () => resolve(); // Ignore individual errors to continue
        });
      });

      await Promise.all(deletePromises);
      console.log(`[ChatStorage] Removidos ${deletedCount} chats expirados.`);

      if (deletedCount > 0) {
        window.dispatchEvent(new CustomEvent("chat-list-updated"));
      }
    } catch (e) {
      console.warn("Erro no cleanup:", e);
    }
  },
};

// Auto-start cleanup periodically
setInterval(
  () => {
    ChatStorageService.cleanupExpired().catch((e) =>
      console.error("Auto-cleanup error", e),
    );
  },
  5 * 60 * 1000,
); // 5 mins
