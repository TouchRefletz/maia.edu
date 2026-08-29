/**
 * Chat Attachment Service — Gerenciamento de Anexos via Nuvem Pessoal Puter.js (BYOS)
 *
 * Responsável por:
 * 1. Upload de arquivos para a pasta pessoal do usuário (maia/chats/{chatId}/)
 * 2. Obtenção de URLs permanentes e metadados serializáveis
 * 3. Leitura e download seguro de anexos
 * 4. Cálculo de uso de armazenamento (quota e estatísticas)
 * 5. Exclusão automática de arquivos ao deletar conversas
 */

/**
 * Garante que a SDK do Puter.js esteja carregada e pronta
 * @returns {Promise<any>}
 */
export async function ensurePuterLoaded() {
  if (typeof window !== 'undefined' && window.puter) return window.puter;
  if (typeof window !== 'undefined' && window.__loadingPuter) return window.__loadingPuter;

  if (typeof window !== 'undefined') {
    window.__loadingPuter = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.onload = () => resolve(window.puter);
      script.onerror = (e) => {
        window.__loadingPuter = null;
        reject(new Error(`Falha ao carregar puter.js: ${e}`));
      };
      document.head.appendChild(script);
    });
    return window.__loadingPuter;
  }
  throw new Error('Puter só pode ser executado no navegador.');
}

/**
 * Sanitiza o nome do arquivo para evitar caracteres inválidos no filesystem
 * @param {string} fileName
 * @returns {string}
 */
function sanitizeFileName(fileName) {
  return (fileName || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // substitui caracteres especiais
}
/**
 * Converte bytes para formato legível (KB, MB, GB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes = 0) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Mapeia extensão ou tipo do arquivo para um MIME Type visualizável no navegador
 * @param {string} fileName
 * @param {string} fallbackType
 * @returns {string}
 */
export function getMimeType(fileName = '', fallbackType = '') {
  if (fallbackType && fallbackType !== 'application/octet-stream' && fallbackType.includes('/')) {
    return fallbackType;
  }
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    json: 'application/json',
    js: 'text/javascript; charset=utf-8',
    ts: 'text/plain; charset=utf-8',
    py: 'text/plain; charset=utf-8',
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return map[ext] || fallbackType || 'application/octet-stream';
}

/**
 * Garante que a árvore de diretórios exista no Puter Cloud
 * @param {any} puter
 * @param {string} dirPath
 */
async function ensureDir(puter, dirPath) {
  if (!puter?.fs?.mkdir) return;
  const parts = dirPath.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    try {
      await puter.fs.mkdir(current);
    } catch (_) {
      // Ignora se o diretório já existir
    }
  }
}

export const ChatAttachmentService = {
  /**
   * Processa e faz upload do array de arquivos para o Puter Cloud
   * @param {string} chatId - ID da conversa
   * @param {Array<File|Object>} files - Array de arquivos do input
   * @returns {Promise<Array<Object>>} Array de metadados de arquivos prontos para persistência
   */
  async uploadChatAttachments(chatId, files = []) {
    if (!files || files.length === 0) return [];

    let puter = null;
    let isSignedIn = false;

    try {
      puter = await ensurePuterLoaded();
      isSignedIn = puter?.auth?.isSignedIn?.() || false;
    } catch (e) {
      console.warn('[ChatAttachmentService] Puter SDK não pôde ser inicializada:', e);
    }

    const processedAttachments = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Se já for um anexo previamente salvo/serializado
      if (
        file &&
        typeof file === 'object' &&
        !(file instanceof File) &&
        (file.url || file.puterPath)
      ) {
        processedAttachments.push(file);
        continue;
      }

      const fileName = file.name || `arquivo_${i + 1}`;
      const safeName = sanitizeFileName(fileName);
      const fileSize = file.size || 0;
      const fileType = file.type || 'application/octet-stream';

      if (isSignedIn && puter?.fs) {
        try {
          const targetDir = `maia/chats/${chatId}`;
          await ensureDir(puter, targetDir);

          const targetPath = `${targetDir}/${Date.now()}_${safeName}`;

          // Grava o arquivo no Puter Cloud
          const fsItem = await puter.fs.write(targetPath, file);
          let readUrl = '';
          try {
            readUrl = (await puter.fs.getReadURL(targetPath)) || fsItem?.read_url || '';
          } catch (_) {
            readUrl = fsItem?.read_url || '';
          }

          processedAttachments.push({
            name: fileName,
            size: fileSize,
            type: fileType,
            url: readUrl,
            puterPath: fsItem?.path || targetPath,
            storageType: 'puter',
            uploadedAt: Date.now(),
          });
          continue;
        } catch (uploadErr) {
          console.error(
            `[ChatAttachmentService] Falha ao fazer upload de ${fileName} para Puter:`,
            uploadErr,
          );
        }
      }

      // Fallback gracioso para visitante não logado no Puter ou falha temporária
      processedAttachments.push({
        name: fileName,
        size: fileSize,
        type: fileType,
        url: '',
        puterPath: '',
        storageType: 'local_fallback',
        uploadedAt: Date.now(),
      });
    }

    return processedAttachments;
  },

  /**
   * Abre ou faz download de um anexo salvo via Puter Cloud
   * @param {Object} attachment
   */
  async openAttachment(attachment) {
    if (!attachment) return;

    // Se tiver puterPath, busca o Blob de forma 100% autenticada via puter.fs.read
    if (attachment.puterPath) {
      try {
        const puter = await ensurePuterLoaded();
        const rawBlob = await puter.fs.read(attachment.puterPath);
        if (rawBlob) {
          const mimeType = getMimeType(attachment.name, attachment.type);
          const typedBlob = new Blob([rawBlob], { type: mimeType });
          const blobUrl = URL.createObjectURL(typedBlob);

          const isVisualizable =
            mimeType.startsWith('image/') ||
            mimeType === 'application/pdf' ||
            mimeType.startsWith('text/') ||
            mimeType === 'application/json';

          if (isVisualizable) {
            window.open(blobUrl, '_blank');
          } else {
            const tempLink = document.createElement('a');
            tempLink.href = blobUrl;
            tempLink.download = attachment.name || 'anexo';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
          }
          setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
          return;
        }
      } catch (err) {
        console.error('[ChatAttachmentService] Erro ao ler arquivo do Puter:', err);
      }
    }

    // Se tiver URL pública válida (e não for a rota interna do driver)
    if (attachment.url && attachment.url !== '#' && !attachment.url.includes('/drivers/fs/read')) {
      window.open(attachment.url, '_blank');
      return;
    }

    // Mensagem de fallback amigável
    const { customAlert } = await import('../ui/GlobalAlertsLogic.tsx').catch(() => ({
      customAlert: alert,
    }));
    customAlert(
      `Visualização não disponível para ${attachment.name || 'este arquivo'}. O arquivo pode ter sido enviado em modo offline ou sua conta Puter não está conectada.`,
    );
  },

  /**
   * Hidrata previews visuais de imagens nos cartões de anexo
   * @param {HTMLElement} container
   */
  async hydrateAttachmentPreviews(container = document) {
    const previewImgs = container.querySelectorAll('img[data-puter-path]:not([data-hydrated])');
    if (previewImgs.length === 0) return;

    try {
      const puter = await ensurePuterLoaded();
      if (puter?.auth?.isSignedIn?.() && puter?.fs) {
        for (const img of previewImgs) {
          const path = img.getAttribute('data-puter-path');
          if (!path) continue;
          img.setAttribute('data-hydrated', 'true');
          try {
            const rawBlob = await puter.fs.read(path);
            if (rawBlob) {
              const mimeType = getMimeType(path, 'image/png');
              const typedBlob = new Blob([rawBlob], { type: mimeType });
              img.src = URL.createObjectURL(typedBlob);
            }
          } catch (_imgErr) {
            // Silencioso se thumbnail não carregar
          }
        }
      }
    } catch (_e) {}
  },

  /**
   * Remove todos os anexos de uma conversa no Puter Cloud
   * @param {string} chatId
   */
  async deleteChatAttachments(chatId) {
    if (!chatId) return;

    try {
      const puter = await ensurePuterLoaded();
      if (puter?.auth?.isSignedIn?.() && puter?.fs) {
        const targetDir = `maia/chats/${chatId}`;
        await puter.fs.delete(targetDir).catch(() => {
          // Ignora se o diretório não existir
        });
        console.log(`[ChatAttachmentService] Anexos do chat ${chatId} removidos do Puter.`);
      }
    } catch (e) {
      console.warn(`[ChatAttachmentService] Erro ao deletar anexos do chat ${chatId}:`, e);
    }
  },

  /**
   * Obtém estatísticas de uso de armazenamento do usuário na pasta maia/chats
   * @returns {Promise<{ totalBytes: number, totalFiles: number, formattedSize: string, quotaBytes: number, pctUsed: number, files: Array }>}
   */
  async getStorageUsage() {
    const defaultQuota = 500 * 1024 * 1024; // 500 MB base do Puter Free Tier
    let totalBytes = 0;
    let totalFiles = 0;
    const fileList = [];

    try {
      const puter = await ensurePuterLoaded();
      if (puter?.auth?.isSignedIn?.() && puter?.fs) {
        try {
          await ensureDir(puter, 'maia/chats');
          const items = await puter.fs.readdir('maia/chats', { recursive: true });
          if (Array.isArray(items)) {
            items.forEach((item) => {
              if (!item.is_dir) {
                totalFiles++;
                totalBytes += item.size || 0;
                fileList.push(item);
              }
            });
          }
        } catch (_dirErr) {
          // Pasta maia/chats pode não existir ainda se nenhum anexo foi enviado
        }
      }
    } catch (e) {
      console.warn('[ChatAttachmentService] Erro ao consultar uso de disco do Puter:', e);
    }

    const pctUsed = Math.min(100, Math.round((totalBytes / defaultQuota) * 100));

    return {
      totalBytes,
      totalFiles,
      formattedSize: formatBytes(totalBytes),
      quotaBytes: defaultQuota,
      formattedQuota: formatBytes(defaultQuota),
      pctUsed,
      files: fileList,
    };
  },
};
