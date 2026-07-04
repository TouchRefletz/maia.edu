import { customAlert } from "../ui/GlobalAlertsLogic.tsx";

export async function carimbarBase64(base64, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;

      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Faixa no topo
      const h = Math.max(40, Math.round(c.height * 0.08));
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, c.width, h);

      // Texto
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(h * 0.45)}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(label, 12, Math.round(h / 2));

      resolve(c.toDataURL("image/png", 1.0));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

export function coletarESalvarImagensParaEnvio() {
  // 1. Tenta pegar do array global
  let recortesRef = [];
  if (Array.isArray(window.recortesAcumulados) && window.recortesAcumulados.length > 0) {
    recortesRef = window.recortesAcumulados;
  } else if (Array.isArray(window.__recortesAcumulados) && window.__recortesAcumulados.length > 0) {
    recortesRef = window.__recortesAcumulados;
  }

  let imagensAtuais = [...recortesRef];

  // 2. Fallback: Se vazio, tenta recuperar do DOM (HTML)
  if (imagensAtuais.length === 0) {
    const imgsNoModal = Array.from(
      document.querySelectorAll("#cropPreviewGallery img")
    )
      .map((img) => img?.src)
      .filter(
        (src) =>
          typeof src === "string" &&
          (src.startsWith("data:image") || src.startsWith("blob:"))
      );

    if (imgsNoModal.length > 0) {
      imagensAtuais = imgsNoModal;
      // Ressincroniza globais
      window.recortesAcumulados = [...imgsNoModal];
      window.__recortesAcumulados = [...imgsNoModal];
    }
  }

  // 2.1 Fallback (Crucial para Slot Mode/PDF Coordinates):
  // Se ainda estiver vazio, verifica se JÁ existem dados validados em __imagensLimpas
  // (Isso evita que o coletor limpe os dados de coordenadas PDF que não estão no DOM/recortesAcumulados)
  if (
    imagensAtuais.length === 0 &&
    window.__imagensLimpas?.questao_original?.length > 0
  ) {
    console.log(
      "[Coletor] Usando imagens já existentes em __imagensLimpas (SlotMode detected)"
    );
    imagensAtuais = [...window.__imagensLimpas.questao_original];
  }

  // 3. Pega imagens de suporte já existentes (se houver)
  const questaoRef =
    window.ultimaQuestaoExtraida ?? window.__ultimaQuestaoExtraida ?? null;
  const imagensSuporteQuestao = Array.isArray(questaoRef?.imagensextraidas)
    ? questaoRef.imagensextraidas
    : [];

  // 4. Salva no estado global (somente questão agora)
  // [FIX] Só sobrescreve se tivermos algo novo ou se a intenção for atualizar.
  // Se imagensAtuais veio do próprio __imagensLimpas, isso é redundante mas seguro.
  // Se veio vazio, mas __imagensLimpas tinha coisa, o passo 2.1 já recuperou.
  // Se ambos vazios, ok zerar.
  window.__imagensLimpas.questao_original = [...imagensAtuais];

  if (
    imagensAtuais.length > 0 &&
    (!window.__BACKUP_IMGS_Q || window.__BACKUP_IMGS_Q.length === 0)
  ) {
    window.__BACKUP_IMGS_Q = [...imagensAtuais];
  }

  if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};

  // RETORNA o que a função principal precisa para continuar
  return { imagensAtuais, imagensSuporteQuestao };
}

export async function prepararImagensParaEnvio(
  imagensAtuais,
  imagensSuporteQuestao
) {
  // --- MODO QUESTÃO ---

  // 1. Validação
  if (!imagensAtuais || imagensAtuais.length === 0) {
    customAlert("Nenhuma imagem selecionada!", 2000);
    return null;
  }

  // 2. Garante Conversão para Base64 (Gêmeos exige b64 real, não Blob URL)
  const imagensBase64 = await Promise.all(
    imagensAtuais.map(async (img) => {
      if (typeof img === "string" && img.startsWith("blob:")) {
        try {
          return await import("../services/image-utils.js").then((m) =>
            m.urlToBase64(img)
          );
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
