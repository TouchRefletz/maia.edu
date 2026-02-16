import { exibirModalOriginais } from "../render/final/OriginaisModal.tsx";

export function toggleGabarito(cardId) {
  const el = document.getElementById(cardId + "_res");
  if (!el) return;

  // Alterna entre mostrar e esconder
  if (el.style.display === "none") {
    el.style.display = "block";
    // Opcional: faz scroll suave até a resolução
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    el.style.display = "none";
  }
}

export function verificarRespostaBanco(
  btn,
  cardId,
  letraEscolhida,
  letraCorreta,
) {
  const container = document.getElementById(cardId + "_opts");
  const resolution = document.getElementById(cardId + "_res");

  if (container.classList.contains("answered")) return;
  container.classList.add("answered");

  const todosBotoes = container.querySelectorAll(".q-opt-btn");
  letraCorreta = letraCorreta.trim().toUpperCase();
  letraEscolhida = letraEscolhida.trim().toUpperCase();

  todosBotoes.forEach((b) => {
    const letra = b
      .querySelector(".q-opt-letter")
      .innerText.replace(")", "")
      .trim();

    if (letra === letraCorreta) {
      b.classList.add("correct");
    }
    if (letra === letraEscolhida && letra !== letraCorreta) {
      b.classList.add("wrong");
    }
    b.style.cursor = "default";

    // Exibe justificativa individual (motivo) se existir
    const motivo = b.dataset.motivo;
    if (motivo) {
      const motivoEl = b.querySelector(".q-opt-motivo");
      if (motivoEl) {
        motivoEl.textContent = motivo;
        motivoEl.style.display = "block";
      }
    }
  });

  // Delay e Revelação
  setTimeout(() => {
    resolution.style.display = "block";
    resolution.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 800);
}

// Abrir Scan Original
// Abrir Scan Original (Refatorado para usar o novo Modal React com suporte a PDF Embed)
export function abrirScanOriginal(btn) {
  const jsonImgs = btn.dataset.imgs;
  if (!jsonImgs) return;

  try {
    const imgs = JSON.parse(jsonImgs);
    console.log("[Interacoes] Abrindo modal de originais com dados:", imgs);

    // Usa a mesma função do botão "Ver Original" da extração,
    // mas passando os dados deste botão especificamente
    exibirModalOriginais(imgs);
  } catch (e) {
    console.error("Erro ao abrir imagens originais", e);
  }
}
