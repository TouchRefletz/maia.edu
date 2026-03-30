import {
  gerarConteudoEmJSONComImagemStream,
  gerarGabaritoComPesquisa,
} from "../api/worker.js";
import { obterConfiguracaoIA } from "../ia/config.js";
import { DataNormalizer } from "../normalizer/data-normalizer.js";
import { renderizarQuestaoFinal } from "../render/final/render-questao.js";
import {
  prepararAreaDeResposta,
  pushThought,
} from "../sidebar/thoughts-scroll.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import {
  coletarESalvarImagensParaEnvio,
  prepararImagensParaEnvio,
} from "./imagens.js";

export function iniciarEstadoProcessamento() {
  // 1. Verificação de Segurança
  if (window.__isProcessing) return null; // Retorna null para sinalizar ABORTO

  // 2. Injeção de CSS (REMOVIDO: O scroll agora é gerenciado pelo container de abas)
  /*
  var styleviewerSidebar = document.createElement('style');
  styleviewerSidebar.innerHTML = `
    #viewerSidebar {
        overflow-y: scroll;
    }
    `;
  document.body.appendChild(styleviewerSidebar);
  */

  // 3. Definição de Estado
  window.__isProcessing = true;
  window.__userInterruptedScroll = false; // Reset smart scroll flag

  // Retorna objeto compatível com a API anterior (que esperava um elemento style)
  return { remove: () => {} };
}

export function setarEstadoLoadingModal() {
  const btnProcessar = document.querySelector(
    "#cropConfirmModal .btn--primary",
  );
  const btnVoltar = document.querySelector("#cropConfirmModal .btn--secondary");

  // Segurança: se não achar o botão principal, nem segue.
  if (!btnProcessar) return null;

  const originalText = btnProcessar.innerText;

  // Aplica as mudanças visuais
  btnProcessar.innerText = "Iniciando...";
  btnProcessar.disabled = true;
  if (btnVoltar) btnVoltar.disabled = true;

  // Retorna um "pacote" com tudo que precisamos para restaurar depois
  return {
    btnProcessar,
    btnVoltar,
    originalText,
  };
}

export async function inicializarEnvioCompleto() {
  // 1. Inicia CSS e Flags de Processamento
  const styleviewerSidebar = iniciarEstadoProcessamento();
  if (!styleviewerSidebar) return null; // Já estava processando

  // 2. Coleta as imagens cruas e salva backups
  const { imagensAtuais, imagensSuporteQuestao } =
    coletarESalvarImagensParaEnvio();

  // 3. Processa/Carimba as imagens (pode demorar um pouco)
  const listaImagens = await prepararImagensParaEnvio(
    imagensAtuais,
    imagensSuporteQuestao,
  );

  // Se falhar no processamento, limpamos o passo 1
  if (!listaImagens) {
    window.__isProcessing = false;
    styleviewerSidebar.remove();
    return null;
  }

  // 4. Trava a UI (Botões do Modal)
  const uiState = setarEstadoLoadingModal();

  // Se falhar na UI, limpamos passo 1
  if (!uiState) {
    window.__isProcessing = false;
    styleviewerSidebar.remove();
    return null;
  }

  // Retorna o pacote completo para a função principal trabalhar
  return {
    styleviewerSidebar,
    listaImagens,
    uiState,
  };
}

export function finalizarProcessamentoVisual() {
  // Desliga flags de processamento
  window.__isProcessing = false;

  // Remove efeitos visuais (se houver)
  const reopenBtn = document.getElementById("reopenSidebarBtn");
  if (reopenBtn) reopenBtn.remove();
}

export function addGlowEffect(targetEl) {
  if (!targetEl) return;

  targetEl.classList.add("glow-on-change");

  const removeGlow = () => {
    targetEl.classList.remove("glow-on-change");
  };

  // Remove após 4s de timeout OU se o usuário interagir
  setTimeout(removeGlow, 4000);
  if (typeof targetEl.addEventListener === "function") {
    targetEl.addEventListener("click", removeGlow, { once: true });
  }
}

export function finalizarInterfacePosSucesso(styleviewerSidebar, uiState) {
  // 1. Limpeza Visual
  if (styleviewerSidebar) styleviewerSidebar.remove();
  const btnResume = document.getElementById("resumeScrollBtn");
  if (btnResume) btnResume.remove();

  // 2. Feedback ao Usuário
  customAlert("✅ Questão e gabarito processados com sucesso!", 3000);

  restaurarEstadoBotoes(uiState);
}

export function restaurarEstadoBotoes(uiState) {
  if (!uiState) return;

  const { btnProcessar, btnVoltar, originalText } = uiState;

  if (btnProcessar) {
    btnProcessar.innerText = originalText;
    btnProcessar.disabled = false;
  }

  if (btnVoltar) {
    btnVoltar.disabled = false;
  }
}

export function tratarErroEnvio(error, uiState, refsLoader, tabId = null) {
  let userMessage = "❌ Erro ao processar. Tente novamente.";

  if (error.message === "EMPTY_RESPONSE_ERROR") {
    console.warn("Aviso: A IA retornou vazio (provável sobrecarga).");
    userMessage =
      "⚠️ A IA não respondeu (possível sobrecarga). Por favor, tente novamente.";
  } else {
    // Só loga erro real se não for o caso do vazio
    console.error("Erro no processamento:", error);
  }

  // 1. Reset Global
  window.__isProcessing = false;

  // 2. Remove o Loader (se ele existir - legado)
  if (refsLoader && refsLoader.loadingContainer) {
    refsLoader.loadingContainer.remove();
  }

  // 3. Feedback Visual
  customAlert(userMessage, 4000);

  // 4. Tratamento de Aba vs Legado
  if (tabId) {
    import("../ui/sidebar-tabs.js").then(({ updateTabStatus, addLogToQuestionTab }) => {
      updateTabStatus(tabId, { status: "error" }, { suppressRender: true });
      addLogToQuestionTab(tabId, `❌ **ERRO**: ${userMessage}`);
      
      // Remove o spinner visual da aba atual
      const thoughtListEl = document.getElementById(`maiaThoughts-${tabId}`);
      if (thoughtListEl) {
        const skeletons = thoughtListEl.querySelectorAll(".maia-thought-card--skeleton");
        skeletons.forEach(sk => sk.remove());
      }
      
      // Também avisa ao BatchProcessor que esta aba liberou espaço (se aplicável), senão pode travar a fila
      window.dispatchEvent(
        new CustomEvent("question-processing-error", {
          detail: { tabId, error: error.message }
        })
      );
    });
  } else {
    // Se NÃO estiver em modo Tab (Aba), reabre o modal legado
    const modal = document.getElementById("cropConfirmModal");
    if (modal) modal.classList.add("visible");
  }

  // 5. Restaura os botões (Reutilizando a lógica)
  restaurarEstadoBotoes(uiState);
}

/**
 * Fluxo Unificado: Extrai questão E busca gabarito automaticamente
 */
export async function confirmarEnvioIA(tabId = null) {
  // --- PASSO 1: PREPARAÇÃO DE DADOS E ESTADO ---
  const dadosIniciais = await inicializarEnvioCompleto();
  if (!dadosIniciais) return;
  const { styleviewerSidebar, listaImagens, uiState } = dadosIniciais;

  // --- PASSO 1.5: CRIAR ABORT CONTROLLER PARA CANCELAMENTO ---
  let abortController = null;
  if (tabId) {
    abortController = new AbortController();
    // Registra o controller para que possa ser cancelado ao fechar a aba
    const { registerAbortController } = await import("../ui/sidebar-tabs.js");
    registerAbortController(tabId, abortController);
  }

  // --- PASSO 2: PREPARAÇÃO VISUAL (SIDEBAR E LOADER) ---
  let setStatus;
  let refsLoader = null;

  if (tabId) {
    const { addLogToQuestionTab } = await import("../ui/sidebar-tabs.js");
    setStatus = (s) => {
      if (s) addLogToQuestionTab(tabId, `[STATUS] ${s}`);
    };
  } else {
    const uiTools = prepararAreaDeResposta();
    if (!uiTools) return;
    setStatus = uiTools.setStatus;
    refsLoader = uiTools.refsLoader;
  }

  try {
    // ============================================================
    // FASE 1: EXTRAÇÃO DA QUESTÃO
    // ============================================================
    setStatus("📝 [QUESTÃO] Enviando imagens para IA...");

    const { promptDaIA: promptQuestao, JSONEsperado: JSONQuestao } =
      obterConfiguracaoIA("prova");

    setStatus(`📝 [QUESTÃO] Analisando ${listaImagens.length} imagem(ns)...`);

    const respostaQuestao = await gerarConteudoEmJSONComImagemStream(
      promptQuestao,
      JSONQuestao,
      listaImagens,
      "image/jpeg",
      {
        onStatus: (s) => setStatus(`📝 [QUESTÃO] ${s}`),
        onThought: (t) => pushThought(`📝 ${t}`, tabId),
        onAnswerDelta: () => setStatus("📝 [QUESTÃO] Gerando JSON..."),
        signal: abortController?.signal, // Passa o signal para cancelamento
      },
    );

    console.log("Resposta QUESTÃO recebida:", respostaQuestao);

    // Anexa imagens locais à questão
    enriquecerRespostaComImagensLocais(respostaQuestao);

    // Prova -> Apenas bufferizar (não alterar valor)
    // Assumindo que 'nome_prova' ou similar venha no objeto, ou que identificacao seja a inst.
    // Se não tiver campo explícito de prova aqui, deixamos pro envio final lidar ou ignoramos.

    // Salva questão no global (mas não renderiza ainda!)
    window.__ultimaQuestaoExtraida = respostaQuestao;
    window.questaoAtual = respostaQuestao;

    // ============================================================
    // FASE 2: BUSCA DO GABARITO VIA PESQUISA
    // ============================================================
    setStatus("🔍 [GABARITO] Iniciando pesquisa de resposta...");

    const { promptDaIA: promptGabarito, JSONEsperado: JSONGabarito } =
      obterConfiguracaoIA("gabarito");

    // Prepara texto da questão para ajudar na pesquisa
    const textoQuestao = JSON.stringify(respostaQuestao);

    const respostaGabarito = await gerarGabaritoComPesquisa(
      promptGabarito,
      JSONGabarito,
      listaImagens,
      "image/jpeg",
      {
        onStatus: (s) => setStatus(`🔍 [GABARITO] ${s}`),
        onThought: (t) => pushThought(`🔍 ${t}`, tabId),
        onAnswerDelta: () => setStatus("🔍 [GABARITO] Gerando JSON..."),
        signal: abortController?.signal, // Passa o signal para cancelamento
      },
      listaImagens, // Usa as mesmas imagens para pesquisa
      textoQuestao, // Passa o texto da questão para ajudar na busca
    );

    console.log("Resposta GABARITO recebida:", respostaGabarito);

    // Salva gabarito no global
    window.__ultimoGabaritoExtraido = respostaGabarito;

    // ============================================================
    // FASE 3: FINALIZAÇÃO E RENDERIZAÇÃO
    // ============================================================

    // [MODIFICAÇÃO IMPORTANTE] Captura os pensamentos (HTML) antes de limpar a tela!
    // O usuário quer ver o "raciocínio" na tela final.
    // [FIX] Sanitização: Remove o skeleton (loading) que fica no final da lista
    const captureAndSanitizeThoughts = (elementId) => {
      const el = document.getElementById(elementId);
      if (!el) return null;

      // Clona para não afetar o visual atual antes da hora (opcional, mas seguro)
      const clone = el.cloneNode(true);

      // Remove elementos esqueletos
      const skeletons = clone.querySelectorAll(".maia-thought-card--skeleton");
      skeletons.forEach((sk) => sk.remove());

      return clone.innerHTML;
    };

    const thoughtsElId = tabId ? `maiaThoughts-${tabId}` : "maiaThoughts";
    const aiThoughtsHtml = captureAndSanitizeThoughts(thoughtsElId);

    finalizarProcessamentoVisual();

    // Limpa recortes temporários
    window.__recortesAcumulados = [];

    // ============================================================
    // NORMALIZAÇÃO FINAL (Instituição, Keywords e Prova)
    // ============================================================
    setStatus("🧠 [NORMALIZAÇÃO] Padronizando metadados...");

    // 1. Tenta obter a Instituição do GABARITO (Créditos) ou Título do Material
    const creditosGabarito = window.__ultimoGabaritoExtraido?.creditos;
    const tituloMaterial = document.getElementById("tituloMaterial")?.innerText;

    // Prioridade 1: 'autorouinstituicao' do Gabarito (ex: "INEP", "FUVEST")
    let candidatoInstituicao =
      creditosGabarito?.autorouinstituicao ||
      creditosGabarito?.autor_ou_instituicao;

    // Prioridade 2: Título do Material (se não tiver no gabarito)
    if (!candidatoInstituicao && tituloMaterial) {
      try {
        const parts = tituloMaterial.split(" ");
        candidatoInstituicao = parts[0];
      } catch (e) {}
    }

    if (candidatoInstituicao) {
      const instituicaoNormalizada = await DataNormalizer.normalize(
        candidatoInstituicao,
        "institution",
      );
      console.log(
        `[Normalizer] Instituição: '${candidatoInstituicao}' -> '${instituicaoNormalizada}'`,
      );

      // Salva na questão para persistência
      respostaQuestao.instituicao = instituicaoNormalizada;
    }

    // 2. Bufferiza Prova (Exam)
    const candidatoProva =
      creditosGabarito?.material || creditosGabarito?.ano || tituloMaterial;
    if (candidatoProva) {
      // Se vier do material (ex: "ENEM 2025"), usa ele.
      DataNormalizer.bufferTerm(candidatoProva, "exam");
    }

    // 3. Normaliza Keywords
    if (
      respostaQuestao.palavras_chave &&
      Array.isArray(respostaQuestao.palavras_chave)
    ) {
      respostaQuestao.palavras_chave = await Promise.all(
        respostaQuestao.palavras_chave.map((k) =>
          DataNormalizer.normalize(k, "keyword"),
        ),
      );
    }

    // Atualiza global
    window.__ultimaQuestaoExtraida = respostaQuestao;
    window.questaoAtual = respostaQuestao;

    // Renderiza o resultado FINAL (questão + gabarito)
    if (tabId) {
      import("../ui/sidebar-tabs.js").then(({ updateTabStatus }) => {
        updateTabStatus(tabId, {
          status: "complete",
          response: respostaQuestao, // Passa a questão, o render vai pegar o gabarito do global
          gabaritoResponse: respostaGabarito, // [BATCH FIX] Também armazena gabarito por aba
          aiThoughtsHtml: aiThoughtsHtml, // [NOVO] Passa o HTML limpo
        });

        // [BATCH] Notifica BatchProcessor que a questão foi processada
        // Verificar se há blocos de imagem que precisam de seleção manual
        setTimeout(() => {
          // Detectar blocos 'tipo: imagem' SEM dados de PDF anexados
          // (significa que a imagem precisa ser selecionada manualmente)
          const checkForEmptyImageBlocks = (estrutura) => {
            if (!Array.isArray(estrutura)) return [];
            const emptySlots = [];
            let imgIdx = 0; // FIX: Conta apenas blocos de imagem
            estrutura.forEach((bloco) => {
              const tipo = (bloco?.tipo || "imagem").toLowerCase();
              if (tipo === "imagem") {
                // Se não tem pdf_page E não tem url, é um slot vazio
                const hasPdfData =
                  bloco.pdf_page || bloco.pdfjs_x !== undefined;
                const hasUrl = bloco.url;
                if (!hasPdfData && !hasUrl) {
                  emptySlots.push(`questao_img_${imgIdx}`);
                }
                imgIdx++; // Incrementa contador de imagens
              }
            });
            return emptySlots;
          };

          // Checa na questão
          const questaoSlots = checkForEmptyImageBlocks(
            respostaQuestao?.estrutura || [],
          );

          // Checa no gabarito
          const gabaritoData = window.__ultimoGabaritoExtraido;
          let gabaritoSlots = [];
          if (gabaritoData?.passos) {
            gabaritoData.passos.forEach((passo, passoIdx) => {
              (passo.estrutura || []).forEach((bloco, blocoIdx) => {
                const tipo = (bloco?.tipo || "imagem").toLowerCase();
                if (tipo === "imagem") {
                  const hasPdfData =
                    bloco.pdf_page || bloco.pdfjs_x !== undefined;
                  const hasUrl = bloco.url;
                  if (!hasPdfData && !hasUrl) {
                    gabaritoSlots.push(
                      `gabarito_passo${passoIdx}_img_${blocoIdx}`,
                    );
                  }
                }
              });
            });
          }

          const allSlots = [...questaoSlots, ...gabaritoSlots];
          console.log(
            `[BatchProcessor] Slots vazios detectados: ${allSlots.length}`,
            allSlots,
          );

          window.dispatchEvent(
            new CustomEvent("question-processing-complete", {
              detail: {
                tabId,
                hasImageSlots: allSlots.length > 0,
                slotIds: allSlots,
              },
            }),
          );
        }, 500);
      });
    } else {
      // Passamos o HTML dos pensamentos como 3º argumento (extraOptions ou direto)
      // A assinatura do renderizarQuestaoFinal é (dados, alvo, thoughtsHtml)
      renderizarQuestaoFinal(respostaQuestao, null, aiThoughtsHtml);
    }

    // Limpa a bagunça e avisa o usuário
    finalizarInterfacePosSucesso(styleviewerSidebar, uiState);
  } catch (error) {
    // Verifica se foi cancelado pelo usuário (fechou a aba)
    if (error.name === "AbortError" || abortController?.signal?.aborted) {
      console.log("[IA] Processamento cancelado pelo usuário");
      window.__isProcessing = false;
      if (styleviewerSidebar) styleviewerSidebar.remove();
      restaurarEstadoBotoes(uiState);
      return; // Sai silenciosamente, sem mostrar erro
    }

    if (error.message === "RECITATION_ERROR") {
      handleRecitationError(
        uiState,
        refsLoader,
        dadosIniciais.styleviewerSidebar,
      );
    } else {
      tratarErroEnvio(error, uiState, refsLoader, tabId);
    }
  }
}

export function enriquecerRespostaComImagensLocais(resposta) {
  const imagens = window.__imagensLimpas || {};

  // Attach fotos_originais metadata if available (from batch save)
  if (window.__tempFotosOriginais) {
    resposta.fotos_originais = window.__tempFotosOriginais;
    // Clear it to avoid contamination
    window.__tempFotosOriginais = null;
  }

  // Modo Questão: Anexa suporte e scan original
  resposta.imagens_suporte = imagens.questao_suporte || [];

  // Salva o scan original (a imagem grandona)
  if (imagens.questao_original && imagens.questao_original.length > 0) {
    resposta.scan_original = imagens.questao_original[0];

    // [FIX] Garante que a lista fotos_originais seja preenchida a partir dos dados limpos
    // Isso é crucial porque imagens.questao_original será limpo logo abaixo.
    // Se já veio via __tempFotosOriginais, mantemos. Se não, usamos o array atual (flow SingleShot ou SlotMode).
    if (!resposta.fotos_originais) {
      resposta.fotos_originais = [...imagens.questao_original];
    }
  }

  // Importante: Limpa a lista de originais para os próximos slots nascerem vazios
  imagens.questao_original = [];

  return resposta;
}

export function salvarResultadoNoGlobal(resposta) {
  window.__ultimaQuestaoExtraida = resposta;
  window.questaoAtual = resposta;

  // Limpa a lista de recortes temporários
  window.__recortesAcumulados = [];
}

export function handleRecitationError(uiState, refsLoader, styleviewerSidebar) {
  // 1. Limpa Estado de Processamento
  window.__isProcessing = false;
  if (refsLoader && refsLoader.loadingContainer) {
    refsLoader.loadingContainer.remove();
  }
  if (styleviewerSidebar) styleviewerSidebar.remove();

  // 2. Feedback
  customAlert(
    "⚠️ Conteúdo identificado, mas não estruturado (RECITAÇÃO). Por favor, edite manualmente.",
    5000,
  );

  // 3. Cria Skeleton
  const recitationSkeleton = {
    identificacao: "⚠️ Questão não extraída",
    conteudo: "", // Deixa vazio para não aparecer texto feio no card
    estrutura: [
      {
        tipo: "texto",
        conteudo:
          '⚠️ HOUVE UM ERRO DE RECITAÇÃO. Clique em "Editar Conteúdo" para transcrever a questão manualmente.',
      },
    ],
    alternativas: [],
    materias_possiveis: [],
    palavras_chave: [],
    isRecitation: true,
  };

  // 4. Salva e Renderiza (como se fosse sucesso)
  enriquecerRespostaComImagensLocais(recitationSkeleton);
  salvarResultadoNoGlobal(recitationSkeleton);
  renderizarQuestaoFinal(recitationSkeleton);

  // 5. Finalização Visual
  finalizarProcessamentoVisual();
  restaurarEstadoBotoes(uiState);

  // Fecha o modal de crop se estiver aberto (já que fomos para a tela de edição)
  const modal = document.getElementById("cropConfirmModal");
  if (modal) modal.classList.remove("visible");
}
