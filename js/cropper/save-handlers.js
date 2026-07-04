import { renderizarQuestaoFinal } from "../render/final/render-questao.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { updateTabStatus, addLogToQuestionTab } from "../ui/sidebar-tabs.js";
import { mostrarPainel } from "../viewer/sidebar.js";
import { restaurarVisualizacaoOriginal } from "./cropper-core.js";
import { CropperState } from "./cropper-state.js";
import { renderizarGaleriaModal } from "./gallery.js";
import { extractImageFromCropData } from "./selection-overlay.js";

// Imports para processamento de IA
import { confirmarEnvioIA } from "../envio/ui-estado.js";
import { calculateCropContext } from "./mode.js";

// --- BATCH SAVING (NOVO) ---

export async function salvarQuestaoEmLote(groupId, tabId = null) {
  const group = CropperState.groups.find((g) => g.id === groupId);
  if (!group || group.crops.length === 0) {
    customAlert("Nenhum recorte para enviar nesta questão!", 2000);
    return;
  }

  // Definir status inicial básico
  if (tabId) {
    updateTabStatus(tabId, { status: "processing", progress: 0 });
  }

  // Processar todas as imagens
  const images = [];
  const fotosOriginais = [];

  for (let i = 0; i < group.crops.length; i++) {
    const crop = group.crops[i];

    // 1. Extração da Imagem Visual (Blob) - Mantém todos para garantir compatibilidade
    const result = await extractImageFromCropData(crop.anchorData);
    if (result && result.blobUrl) images.push(result.blobUrl);

    // 2. Cálculo dos Metadados (fotos_originais)
    // FILTRAGEM: Ignorar crops que estão contidos em outros (ex: imagem dentro da questão)
    // fotos_originais deve ser apenas o CONTEXTO (Questão Inteira)
    let isContained = false;
    const a = crop.anchorData;

    // Convert relative coordinates to a stable comparison unit if needed,
    // but anchorData uses relativeTop/Left and unscaledW/H which are compatible for comparison on same page.
    // Tolerância para erros de ponto flutuante/precisão
    const TOLERANCE = 5;

    for (let j = 0; j < group.crops.length; j++) {
      if (i === j) continue;
      const parent = group.crops[j].anchorData;

      if (parent.anchorPageNum !== a.anchorPageNum) continue;

      // Check containment: Parent fully encloses 'a'
      const isInsideX =
        a.relativeLeft >= parent.relativeLeft - TOLERANCE &&
        a.relativeLeft + a.unscaledW <=
          parent.relativeLeft + parent.unscaledW + TOLERANCE;
      const isInsideY =
        a.relativeTop >= parent.relativeTop - TOLERANCE &&
        a.relativeTop + a.unscaledH <=
          parent.relativeTop + parent.unscaledH + TOLERANCE;

      // Also ensure parent is strictly larger to avoid banning duplicates/clones (though clones shouldn't be here)
      // Or simply logic: if A is inside B, A is child.
      if (isInsideX && isInsideY) {
        // Is parent actually bigger?
        if (parent.unscaledW * parent.unscaledH > a.unscaledW * a.unscaledH) {
          isContained = true;
          console.log(
            `[BatchSave] Ignorando crop filho (contido) em fotos_originais:`,
            i,
          );
          break;
        }
      }
    }

    if (!isContained) {
      const cropContext = await calculateCropContext(crop.anchorData);
      if (cropContext) {
        cropContext.id = i;
        fotosOriginais.push(cropContext);
      }
    }
  }

  if (images.length === 0) {
    console.warn("[BatchSave] Nenhuma imagem foi extraída dos recortes!");
    if (tabId) {
      updateTabStatus(tabId, { status: "error" });
      addLogToQuestionTab(tabId, "Erro: Nenhuma imagem pôde ser extraída do documento.");
    }
    return;
  }

  // Adiciona ao acumulado global (compatibilidade com modal antigo)
  window.__recortesAcumulados = images;

  // NOVO: Salva os metadados dos originais para serem anexados ao JSON final
  window.__tempFotosOriginais = fotosOriginais;

  if (tabId) {
    // Iniciar o processo de envio real (Usa a função oficial do sistema)
    confirmarEnvioIA(tabId);
  } else {
    // Modo antigo (sem abas): Atualiza modal e exibe
    renderizarGaleriaModal();
    document.getElementById("cropConfirmModal").classList.add("visible");
  }

  // Opcional: Marcar grupo como 'enviado' ou similar?
  // group.status = 'sent';
}

// --- LEGACY / SINGLE CROP HANDLERS (Mantidos para compatibilidade se necessário, mas o fluxo mudou) ---
// As funções abaixo (tratarSalvarAlternativa, etc) ainda são usadas se o usuário clicar em "Recortar" direto de um slot?
// O plano diz que "Adicionar nova questão" é o fluxo principal.
// Mas se o usuário clicar no botão de "Camera" da alternativa, ele entra no modo "ativarModoRecorte".
// Precisamos garantir que isso ainda funcione ou se adapte.
// O ideal é: Se entrou por slot específico, usa o fluxo antigo (single shot).
// Se entrou pelo botão geral, usa o fluxo novo (persistent group).

// PONTO DE ATENÇÃO: O `selection-overlay.js` novo exige um ActiveGroup para funcionar.
// Se eu entrar pelo modo "Slot", preciso criar um grupo temporário ou permitir "single shot"?
// Solução Rápida: Se `window.__targetSlotIndex` estiver setado, o `saveSelectionState` (agora `addCropToActiveGroup`)
// deveria identificar isso e disparar o save imediato.

// VOU REFATORAR `selection-overlay.js` handlePointerUp?
// Não, melhor fazer o `CropperState` perceber que é um modo especial?

// Vamos manter simples:
// Se o usuário clicar em slot, ele chama `iniciarCapturaParaSlot` em `mode.js`.
// `mode.js` deve setar um flag ou criar um "Grupo Temporário".
// Vamos editar `mode.js` a seguir para garantir isso.

export function tratarSalvarAlternativa(imgSrc) {
  // ... (mesmo código original)
  const letra = window.__target_alt_letra;
  const idx = window.__target_alt_index;
  if (!window.__imagensLimpas.alternativas) {
    window.__imagensLimpas.alternativas = { questao: {}, gabarito: {} };
  }
  if (!window.__imagensLimpas.alternativas.questao[letra]) {
    window.__imagensLimpas.alternativas.questao[letra] = [];
  }
  window.__imagensLimpas.alternativas.questao[letra][idx] = imgSrc;
  const questaoAtiva =
    window.__ultimaQuestaoExtraida || window.ultimaQuestaoExtraida;
  if (questaoAtiva) renderizarQuestaoFinal(questaoAtiva);
  customAlert("Imagem inserida na alternativa " + letra + "!", 2000);
  window.__target_alt_letra = null;
  window.__target_alt_index = null;

  // Como o fluxo é single shot, podemos limpar o estado ativo do cropper aqui
}

// (Copiar restante das funções helpers idênticas ao original para manter compatibilidade de imports)
// Vou apenas adicionar a exportação nova e manter as antigas, mas se eu sobrescrever o arquivo, perco elas.
// Vou reescrever o arquivo com o conteúdo antigo + a nova função salvarQuestaoEmLote.

// ... COPIANDO CONTEUDO ORIGINAL ABAIXO E ADICIONANDO SALVAR LOTE ...

// --- CENÁRIO: Gabarito Passos (Dinâmico) ---
export function tratarSalvarPassoGabarito(imgSrc) {
  const parts = window.__targetSlotContext.split("_");
  const passoIdx = parseInt(parts[2]);
  const imgIdx = window.__targetSlotIndex;

  if (!window.__imagensLimpas.gabarito_passos)
    window.__imagensLimpas.gabarito_passos = {};
  if (!window.__imagensLimpas.gabarito_passos[passoIdx])
    window.__imagensLimpas.gabarito_passos[passoIdx] = [];

  window.__imagensLimpas.gabarito_passos[passoIdx][imgIdx] = imgSrc;

  if (window.__ultimoGabaritoExtraido) {
    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
  }

  customAlert(`Imagem inserida no Passo ${passoIdx + 1}!`, 2000);

  // Limpa Flags
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
}

// --- CENÁRIO 1: Slots de Estrutura (Questão ou Gabarito) ---
export function tratarSalvarSlotEstrutura(imgSrc) {
  const ctx = window.__targetSlotContext;
  const idx = window.__targetSlotIndex;

  if (ctx === "gabarito") {
    window.__imagensLimpas.gabarito_original[idx] = imgSrc;
    if (window.__ultimoGabaritoExtraido) {
      renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
    }
  } else {
    window.__imagensLimpas.questao_original[idx] = imgSrc;
    if (window.__ultimaQuestaoExtraida) {
      renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
    }
  }

  customAlert("✅ Imagem inserida no espaço selecionado!", 2000);

  // Limpa Flags
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
}

// --- CENÁRIO 2: Imagem de Suporte (Manual) ---
export function tratarSalvarSuporte(imgSrc) {
  if (window.modo === "gabarito") {
    if (!window.__ultimoGabaritoExtraido) window.__ultimoGabaritoExtraido = {};
    if (!window.__ultimoGabaritoExtraido.imagens_suporte)
      window.__ultimoGabaritoExtraido.imagens_suporte = [];

    window.__ultimoGabaritoExtraido.imagens_suporte.push(imgSrc);
    window.__imagensLimpas.gabarito_suporte.push(imgSrc);

    customAlert("📸 Imagem de suporte adicionada ao GABARITO!", 2000);
    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
  } else {
    if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};
    if (!window.__ultimaQuestaoExtraida.imagens_suporte)
      window.__ultimaQuestaoExtraida.imagens_suporte = [];

    window.__ultimaQuestaoExtraida.imagens_suporte.push(imgSrc);
    window.__imagensLimpas.questao_suporte.push(imgSrc);

    customAlert("📸 Imagem de suporte adicionada à QUESTÃO!", 2000);
    renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
  }

  // Auto-reopening panel
  mostrarPainel();

  window.__capturandoImagemFinal = false;
}

export function salvarQuestao() {
  // MANEJO ESPECIAL: Adição Manual na Página
  if (window.__isManualPageAdd) {
    restaurarVisualizacaoOriginal();

    // Importante: Reseta botões (incluindo o Cut do header) que restaurarVisualizacaoOriginal não reseta sozinho
    import("./cropper-core.js").then((mod) => mod.resetarInterfaceBotoes());

    // Verifica se o grupo ficou vazio e avisa
    const active = CropperState.getActiveGroup();
    if (active && active.crops.length === 0) {
      customAlert("Questão criada (sem recortes).", 2000);
    } else {
      customAlert("Questão salva!", 2000);
    }
    return;
  }

  // MANEJO ESPECIAL: Slot Mode (React)
  if (window.__targetSlotContext === "image-slot") {
    // Carregamento dinâmico para evitar dependências circulares se necessário,
    // ou apenas garantir que chamamos a função correta.
    import("./mode.js").then((mod) => mod.confirmImageSlotMode());
    return;
  }

  // Essa função era chamada pelo botão "Confirmar recorte" flutuante.
  // Esse botão provavelmente nem deve existir mais no fluxo novo ou deve chamar 'salvarQuestaoEmLote' se for um grupo.
  // Mas para manter compatibilidade com Slots:

  // Se tiver dados de slot alvo, PROCESSA SINGLE SHOT.
  // Mas precisamos obter o imgSrc. Como? O overlay não tem mais "activeSelectionBox" publico fácil.
  // Precisamos pegar o ultimo crop do active group?

  // Se tiver dados de slot alvo, PROCESSA SINGLE SHOT.
  const activeGroup = CropperState.getActiveGroup();
  if (!activeGroup || activeGroup.crops.length === 0) return;

  const lastCrop = activeGroup.crops[activeGroup.crops.length - 1];

  // Caso especial: Capturando imagem final com Embed Support
  if (window.__capturandoImagemFinal === true) {
    // Tenta calcular o crop completo (async)
    calculateCropContext(lastCrop.anchorData).then((cropContext) => {
      // Se falhar o calculo (ex: pagina sumiu), fallback para blob via extractImage
      if (cropContext) {
        tratarSalvarSuporte(cropContext);
        CropperState.deleteGroup(activeGroup.id);
      } else {
        extractImageFromCropData(lastCrop.anchorData).then((result) => {
          if (result && result.blobUrl) {
            tratarSalvarSuporte(result.blobUrl);
          }
          CropperState.deleteGroup(activeGroup.id);
        });
      }
    });
    return;
  }

  // Fallback padrão para outros casos (imgSrc string)
  extractImageFromCropData(lastCrop.anchorData).then((result) => {
    if (!result || !result.blobUrl) return;
    const imgSrc = result.blobUrl;

    // --- ROTEAMENTO DOS CENÁRIOS ---
    if (
      window.__target_alt_letra !== null &&
      window.__target_alt_index !== null
    ) {
      tratarSalvarAlternativa(imgSrc);
      CropperState.deleteGroup(activeGroup.id); // Limpa o temp
      return;
    }

    if (
      window.__targetSlotIndex !== null &&
      window.__targetSlotContext !== null
    ) {
      tratarSalvarSlotEstrutura(imgSrc);
      CropperState.deleteGroup(activeGroup.id);
      return;
    }

    // Fallback para suporte se cair aqui por algum motivo
    if (window.__capturandoImagemFinal === true) {
      tratarSalvarSuporte(imgSrc);
      CropperState.deleteGroup(activeGroup.id);
      return;
    }
  });
}
