import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { auth, firestore } from '../firebase/init.js';
import { customAlert } from '../ui/GlobalAlertsLogic';

const DB_NAME = 'MaiaChatsDB';
const DB_VERSION = 2; // Incrementado para suportar expiresAt
const STORE_NAME = 'chats';

// 30 Dias em ms (para evitar que chats sumam da barra lateral constantemente)
const LOCAL_EXPIRATION_TIME = 30 * 24 * 60 * 60 * 1000;

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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        // Novo index para expiração
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      } else {
        // Upgrade para V2 (se store ja existir)
        const store = event.target.transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains('expiresAt')) {
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
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
 * Helper para salvar chat no Firestore separando as mensagens em uma subcoleção.
 * Evita o limite de 1MB do documento principal do Firestore.
 */
async function saveChatToCloud(uid, chat) {
  const cloudPayload = { ...chat };
  delete cloudPayload.expiresAt;
  delete cloudPayload._debugLog;

  const messages = Array.isArray(cloudPayload.messages) ? cloudPayload.messages : [];
  delete cloudPayload.messages;

  let cleanMainPayload;
  try {
    cleanMainPayload = JSON.parse(JSON.stringify(cloudPayload));
  } catch (_circularErr) {
    const seen = new WeakSet();
    cleanMainPayload = JSON.parse(
      JSON.stringify(cloudPayload, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      }),
    );
  }

  // 1. Salva o documento principal do chat sem o array gigante de mensagens
  const chatDocRef = doc(firestore, 'users', uid, 'chats', chat.id);
  await setDoc(chatDocRef, cleanMainPayload, { merge: true });

  // 2. Salva cada mensagem na subcoleção users/{uid}/chats/{chat.id}/messages
  if (messages.length > 0) {
    const messagesCollRef = collection(firestore, 'users', uid, 'chats', chat.id, 'messages');
    const BATCH_SIZE = 400; // Limite do Firestore writeBatch é 500 operações
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = messages.slice(i, i + BATCH_SIZE);

      chunk.forEach((msg, indexInChunk) => {
        const globalIndex = i + indexInChunk;
        const msgId = msg.id || `msg_${globalIndex.toString().padStart(6, '0')}`;
        const msgDocRef = doc(messagesCollRef, msgId);

        let cleanMsg;
        try {
          cleanMsg = JSON.parse(JSON.stringify(msg));
        } catch (_) {
          cleanMsg = { ...msg };
        }

        cleanMsg.index = globalIndex;
        cleanMsg.timestamp = msg.timestamp || Date.now();

        batch.set(msgDocRef, cleanMsg, { merge: true });
      });

      await batch.commit();
    }
  }
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
      const tx = db.transaction(STORE_NAME, 'readonly');
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
          const docRef = doc(firestore, 'users', user.uid, 'chats', id);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const cloudChat = docSnap.data();

            // Se o chat já possui mensagens inline (legado), usa elas.
            // Caso contrário, busca as mensagens na subcoleção "messages".
            if (!Array.isArray(cloudChat.messages) || cloudChat.messages.length === 0) {
              const msgsCollRef = collection(firestore, 'users', user.uid, 'chats', id, 'messages');
              const msgsQuery = query(msgsCollRef, orderBy('index', 'asc'));
              const msgsSnap = await getDocs(msgsQuery);

              const fetchedMessages = [];
              msgsSnap.forEach((msgDoc) => {
                fetchedMessages.push(msgDoc.data());
              });

              if (fetchedMessages.length === 0 && !msgsSnap.empty) {
                msgsSnap.forEach((msgDoc) => {
                  fetchedMessages.push(msgDoc.data());
                });
              }

              cloudChat.messages = fetchedMessages;
            }

            // Re-hidrata localmente com nova validade
            await this.saveLocal(cloudChat);
            return cloudChat;
          }
        } catch (err) {
          console.warn('[ChatStorage] Erro ao buscar no Firestore:', err);
        }
      }

      // Se chegou aqui, ou não tá logado e expirou, ou não existe na nuvem.
      if (localChat && localChat.expiresAt <= now) {
        this.deleteLocal(id).catch(() => {});
        return null;
      }

      return null;
    } catch (e) {
      console.error('Erro ao buscar chat:', e);
      return null;
    }
  },

  /**
   * Recupera lista de chats.
   */
  async getChats() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('updatedAt');
      const allChats = await requestToPromise(index.getAll());

      // Ordenação
      const validChats = allChats.sort((a, b) => b.updatedAt - a.updatedAt);

      return validChats;
    } catch (e) {
      console.error('Erro ao ler chats:', e);
      return [];
    }
  },

  /**
   * Sincroniza chats da nuvem para local (One-way Cloud -> Local)
   */
  async syncFromCloud(uid) {
    console.log('[ChatStorage] Sincronizando lista do Firestore...');
    try {
      const querySnapshot = await getDocs(collection(firestore, 'users', uid, 'chats'));
      const promises = [];
      querySnapshot.forEach((docSnap) => {
        const chatData = docSnap.data();
        chatData.syncedAt = Date.now();

        if (Array.isArray(chatData.messages) && chatData.messages.length > 0) {
          promises.push(this.saveLocal(chatData));
        } else {
          promises.push(
            (async () => {
              try {
                const msgsCollRef = collection(firestore, 'users', uid, 'chats', docSnap.id, 'messages');
                const msgsQuery = query(msgsCollRef, orderBy('index', 'asc'));
                const msgsSnap = await getDocs(msgsQuery);
                const fetchedMessages = [];
                msgsSnap.forEach((mDoc) => {
                  fetchedMessages.push(mDoc.data());
                });
                chatData.messages = fetchedMessages;
              } catch (mErr) {
                console.warn(`[ChatStorage] Erro ao carregar mensagens para ${docSnap.id}:`, mErr);
                if (!chatData.messages) chatData.messages = [];
              }
              return this.saveLocal(chatData);
            })(),
          );
        }
      });
      await Promise.all(promises);
      window.dispatchEvent(new CustomEvent('chat-list-updated'));
    } catch (e) {
      console.warn('[ChatStorage] Falha ao baixar da nuvem:', e);
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
      console.log('[ChatStorage] Verificando chats locais pendentes para upload...');
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const allChats = await requestToPromise(store.getAll());

      const pendingChats = allChats.filter((chat) => {
        if (!chat.syncedAt) return true;
        return (chat.updatedAt || 0) > chat.syncedAt;
      });

      if (pendingChats.length === 0) {
        console.log('[ChatStorage] Nenhum chat pendente para upload.');
        return;
      }

      console.log(
        `[ChatStorage] Enviando ${pendingChats.length} chats pendentes para Firestore...`,
      );

      const uploadPromises = pendingChats.map(async (chat) => {
        await saveChatToCloud(user.uid, chat).catch((e) =>
          console.warn(`Falha ao subir chat ${chat.id}:`, e),
        );

        chat.syncedAt = Date.now();
        await this.saveLocal(chat);
      });

      await Promise.all(uploadPromises);
      console.log(`[ChatStorage] Upload concluído! ${pendingChats.length} chats sincronizados.`);
    } catch (e) {
      console.error('[ChatStorage] Erro no syncPendingToCloud:', e);
    }
  },

  /**
   * Salva chat. Local (30m) + Cloud (Se logado).
   */
  async saveChat(chat) {
    try {
      await this.saveLocal(chat);

      const user = auth.currentUser;
      if (user && !user.isAnonymous) {
        saveChatToCloud(user.uid, chat)
          .then(() => {
            chat.syncedAt = Date.now();
            this.saveLocal(chat).catch(() => {});
          })
          .catch((err) => console.error('[ChatStorage] Erro ao salvar no Firestore:', err));
      }

      window.dispatchEvent(new CustomEvent('chat-list-updated'));
    } catch (e) {
      console.error('Erro ao salvar chat:', e);
      customAlert('Erro ao salvar chat.');
    }
  },

  /**
   * Salva apenas localmente com expiração.
   */
  async saveLocal(chat) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
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
        try {
          const msgsCollRef = collection(firestore, 'users', user.uid, 'chats', chatId, 'messages');
          const msgsSnap = await getDocs(msgsCollRef);
          const deleteMsgsPromises = [];
          msgsSnap.forEach((msgDoc) => {
            deleteMsgsPromises.push(deleteDoc(msgDoc.ref));
          });
          await Promise.all(deleteMsgsPromises);
        } catch (subErr) {
          console.warn(`[ChatStorage] Erro ao deletar subcoleção do chat ${chatId}:`, subErr);
        }

        const docRef = doc(firestore, 'users', user.uid, 'chats', chatId);
        await deleteDoc(docRef);
      }

      window.dispatchEvent(new CustomEvent('chat-list-updated'));
    } catch (e) {
      console.error('Erro ao deletar chat:', e);
    }
  },

  async deleteLocal(chatId) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await requestToPromise(store.delete(chatId));
  },

  /**
   * Cria novo chat
   */
  async createNewChat(firstMessage, attachments = []) {
    const chat = {
      id: crypto.randomUUID(),
      title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : ''),
      messages: [
        {
          role: 'user',
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
      console.warn('Tentativa de adicionar msg a chat expirado ou inexistente');
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
      console.warn('Tentativa de adicionar msgs a chat expirado ou inexistente');
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
   * Remove itens expirados do IDB com segurança (Sync -> Delete)
   */
  async cleanupExpired() {
    try {
      const db = await openDB();
      const user = auth.currentUser;
      const now = Date.now();

      console.log('[ChatStorage] Iniciando limpeza de chats expirados (Cursor Scan)...');

      // 1. Coleta itens expirados
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const expiredChats = [];

      await new Promise((resolve) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const chat = cursor.value;
            let isExpired = false;

            if (chat.expiresAt) {
              if (chat.expiresAt <= now) isExpired = true;
            } else if (chat.updatedAt) {
              if (chat.updatedAt + LOCAL_EXPIRATION_TIME <= now) isExpired = true;
            } else if (chat.createdAt) {
              if (chat.createdAt + LOCAL_EXPIRATION_TIME <= now) isExpired = true;
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
        console.log('[ChatStorage] Nenhum chat expirado encontrado.');
        return;
      }

      console.log(
        `[ChatStorage] Encontrados ${expiredChats.length} chats expirados. Iniciando Safe Cleanup...`,
      );

      // 2. Sync to Firestore apenas para chats expirados com alterações pendentes
      if (user && !user.isAnonymous) {
        try {
          const unSyncedExpired = expiredChats.filter(
            (chat) => !chat.syncedAt || (chat.updatedAt || 0) > chat.syncedAt,
          );

          if (unSyncedExpired.length > 0) {
            console.log(
              `[ChatStorage] Sincronizando ${unSyncedExpired.length} expirados pendentes com Firestore antes de deletar...`,
            );
            const syncPromises = unSyncedExpired.map((chat) => {
              return saveChatToCloud(user.uid, chat);
            });

            await Promise.all(syncPromises);
            console.log('[ChatStorage] Backup de expirados concluído com sucesso.');
          }
        } catch (e) {
          console.error('[ChatStorage] Falha no backup (cleanup abortado):', e);
          return; // Safety abort
        }
      }

      // 3. Delete Local
      const txDelete = db.transaction(STORE_NAME, 'readwrite');
      const storeDelete = txDelete.objectStore(STORE_NAME);
      let deletedCount = 0;

      const deletePromises = expiredChats.map((chat) => {
        return new Promise((resolve) => {
          const req = storeDelete.delete(chat.id);
          req.onsuccess = () => {
            deletedCount++;
            resolve();
          };
          req.onerror = () => resolve();
        });
      });

      await Promise.all(deletePromises);
      console.log(`[ChatStorage] Removidos ${deletedCount} chats expirados.`);

      if (deletedCount > 0) {
        window.dispatchEvent(new CustomEvent('chat-list-updated'));
      }
    } catch (e) {
      console.warn('Erro no cleanup:', e);
    }
  },
};

// Auto-start cleanup periodically
setInterval(
  () => {
    ChatStorageService.cleanupExpired().catch((e) => console.error('Auto-cleanup error', e));
  },
  5 * 60 * 1000,
); // 5 mins
