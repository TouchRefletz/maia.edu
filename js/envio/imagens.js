import { customAlert } from '../ui/GlobalAlertsLogic.tsx';

export async function carimbarBase64(base64, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;

      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Faixa no topo
      const h = Math.max(40, Math.round(c.height * 0.08));
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, c.width, h);

      // Texto
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(h * 0.45)}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 12, Math.round(h / 2));

      resolve(c.toDataURL('image/png', 1.0));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

export function coletarESalvarImagensParaEnvio() {
  // 1. Tenta pegar do array global
  const recortesRef =
    (Array.isArray(window.recortesAcumulados) && window.recortesAcumulados) ||
    (Array.isArray(window.__recortesAcumulados) &&
      window.__recortesAcumulados) ||
    [];

  let imagensAtuais = [...recortesRef];

  // 2. Fallback: Se vazio, tenta recuperar do DOM (HTML)
  if (imagensAtuais.length === 0) {
    const imgsNoModal = Array.from(
      document.querySelectorAll('#cropPreviewGallery img')
    )
      .map((img) => img?.src)
      .filter((src) => typeof src === 'string' && (src.startsWith('data:image') || src.startsWith('blob:')));

    if (imgsNoModal.length > 0) {
      imagensAtuais = imgsNoModal;
      // Ressincroniza globais
      window.recortesAcumulados = [...imgsNoModal];
      window.__recortesAcumulados = [...imgsNoModal];
    }
  }

  // 3. Pega imagens de suporte já existentes (se houver)
  const questaoRef =
    window.ultimaQuestaoExtraida ?? window.__ultimaQuestaoExtraida ?? null;
  const imagensSuporteQuestao = Array.isArray(questaoRef?.imagensextraidas)
    ? questaoRef.imagensextraidas
    : [];

  // 4. Salva Backups e Estado Limpo Global
  if (window.modo === 'gabarito') {
    window.__imagensLimpas.gabarito_original = [...imagensAtuais];

    if (
      imagensAtuais.length > 0 &&
      (!window.__BACKUP_IMGS_G || window.__BACKUP_IMGS_G.length === 0)
    ) {
      window.__BACKUP_IMGS_G = [...imagensAtuais];
    }

    if (!window.__ultimoGabaritoExtraido) window.__ultimoGabaritoExtraido = {};
  } else {
    window.__imagensLimpas.questao_original = [...imagensAtuais];

    if (
      imagensAtuais.length > 0 &&
      (!window.__BACKUP_IMGS_Q || window.__BACKUP_IMGS_Q.length === 0)
    ) {
      window.__BACKUP_IMGS_Q = [...imagensAtuais];
    }

    if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};
  }

  // RETORNA o que a função principal precisa para continuar
  return { imagensAtuais, imagensSuporteQuestao };
}

export async function prepararImagensParaEnvio(imagensAtuais, imagensSuporteQuestao) {
  if (window.modo === 'gabarito') {
    // --- MODO GABARITO ---

    // 1. Validação
    if (imagensSuporteQuestao.length === 0 && imagensAtuais.length === 0) {
      customAlert('Nenhuma imagem selecionada!', 2000);
      return null;
    }

    // 2. Processamento Paralelo (Carimba tudo de uma vez)
    // Cria as promessas de carimbo
    const promessaSuporte = Promise.all(
      imagensSuporteQuestao.map((b64, i) =>
        carimbarBase64(b64, `SUPORTE ${i + 1}/${imagensSuporteQuestao.length}`)
      )
    );

    const promessaAtuais = Promise.all(
      imagensAtuais.map((b64, i) =>
        carimbarBase64(b64, `ATUAL ${i + 1}/${imagensAtuais.length}`)
      )
    );

    // Aguarda ambas terminarem
    const [suporteCarimbado, atuaisCarimbado] = await Promise.all([
      promessaSuporte,
      promessaAtuais,
    ]);

    // Retorna tudo junto
    return [...suporteCarimbado, ...atuaisCarimbado];
  } else {
    // --- MODO QUESTÃO ---

    // 1. Validação
    if (!imagensAtuais || imagensAtuais.length === 0) {
      customAlert('Nenhuma imagem selecionada!', 2000);
      return null;
    }

    // 2. Garante Conversão para Base64 (Gêmeos exige b64 real, não Blob URL)
    const imagensBase64 = await Promise.all(
      imagensAtuais.map(async (img) => {
        if (typeof img === 'string' && img.startsWith('blob:')) {
          try {
            return await import('../services/image-utils.js').then(m => m.urlToBase64(img));
          } catch (e) {
            console.error("Falha ao converter blob para envio:", e);
            return img;
          }
        }
        return img; // Já é base64
      })
    );

    // 3. Retorno Direto (Sem carimbo)
    return imagensBase64;
  }
}