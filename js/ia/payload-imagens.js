import { uploadImagemWorker } from '../api/worker.js';
import { uploadState } from '../main.js';
import { urlToBase64 } from '../services/image-utils.js';

export const uploadToImgBB = async (base64String) => {
  return await uploadImagemWorker(base64String);
};

export const processarObjetoRecursivo = async (obj, btnEnviar) => {
  if (!obj || typeof obj !== 'object') return;
  // (Mesma lógica de antes para arrays e objetos...)
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('blob:'))) {
        if (btnEnviar)
          btnEnviar.innerText = `⏳ Subindo img ${++uploadState.imagensConvertidas}...`;

        let finalBase64 = val;
        // Se for Blob URL, converte para Base64 sob demanda
        if (val.startsWith('blob:')) {
          try {
            finalBase64 = await urlToBase64(val);
          } catch (err) {
            console.error("Erro ao converter blob para base64:", err);
            continue; // Pula se falhar
          }
        }

        const url = await uploadToImgBB(finalBase64);
        if (url) obj[i] = url;
      } else if (typeof val === 'object') {
        await processarObjetoRecursivo(val, btnEnviar);
      }
    }
    return;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('blob:'))) {
        if (btnEnviar)
          btnEnviar.innerText = `⏳ Subindo img ${++uploadState.imagensConvertidas}...`;

        let finalBase64 = val;
        if (val.startsWith('blob:')) {
          try {
            finalBase64 = await urlToBase64(val);
          } catch (err) {
            console.error("Erro ao converter blob para base64:", err);
            continue;
          }
        }

        const url = await uploadToImgBB(finalBase64);
        if (url) obj[key] = url;
      } else if (typeof val === 'object') {
        await processarObjetoRecursivo(val, btnEnviar);
      }
    }
  }
};

export async function prepararPayloadComImagens(
  btnEnviar,
  questaoFinal,
  gabaritoLimpo
) {
  // 0. Reset do contador
  uploadState.imagensConvertidas = 0;

  // 1. Feedback Visual
  if (btnEnviar) btnEnviar.innerText = '⏳ Analisando imagens...';

  // 2. Monta a estrutura final
  const payloadParaSalvar = {
    meta: { timestamp: new Date().toISOString() },
    dados_questao: questaoFinal,
    dados_gabarito: gabaritoLimpo,
  };

  // 3. Processamento Assíncrono (Upload Recursivo)
  // O objeto payloadParaSalvar é modificado por referência dentro dessa função
  await processarObjetoRecursivo(payloadParaSalvar, btnEnviar);

  return payloadParaSalvar;
}