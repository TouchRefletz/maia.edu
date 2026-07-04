import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js"; // USING STREAM
import { CropperState } from "../cropper/cropper-state.js";
import { loadSelectionsFromJson } from "../cropper/json-loader.js";
import { ScannerUI } from "../ui/scanner-ui.js";
import { renderPageHighRes } from "../viewer/pdf-core.js";

// --- PROMPTS TEMPLATES ---

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    coordinateSystem: {
      type: "string",
      enum: ["normalized_0_1000_y1x1y2x2"],
      description: "As coords são [y1,x1,y2,x2] em escala 0..1000.",
    },
    regions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          questionId: {
            type: "string",
            description:
              "Identificador da questão a que este bloco pertence (ex: '90', '91').",
          },
          tipo: {
            type: "string",
            enum: ["questao_completa", "parte_questao"],
            description: "Indica se é a questão inteira ou uma parte dela.",
          },
          kind: {
            type: "string",
            enum: ["QUESTION"],
          },
          box: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "integer", minimum: 0, maximum: 1000 },
            description:
              "Box GULOSO [y1, x1, y2, x2]. Deve incluir: enunciado, textos de apoio, IMAGENS, FONTES (rodapé) e alternativas até a última.",
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          note: { type: "string" },
        },
        required: ["id", "kind", "box", "confidence", "tipo"],
      },
    },
  },
  required: ["coordinateSystem", "regions"],
};

function buildPrompt() {
  return `
Você é um especialista em visão computacional e OCR de documentos educacionais (provas e listas de exercícios).

OBJETIVO:
Identificar as questões completas na imagem e retornar suas coordenadas (bounding boxes) com precisão absoluta.

PRINCÍPIO FUNDAMENTAL: "CAIXA GULOSA" (GREEDY BOX)
A caixa da questão deve englobar TUDO que pertence a ela. Se tiver dúvida se um texto faz parte ou não, INCLUA-O. É melhor pecar pelo excesso do que pelo corte.

O QUE COMPÕE UMA QUESTÃO (Deve estar DENTRO da caixa):
1. **Cabeçalho/Identificador**: O número da questão (ex: "QUESTÃO 03", "14", "Questão 1").
2. **Textos de Apoio / Enunciado**: TODO o texto introdutório, poemas, trechos de livros, notícias.
3. **Referências Bibliográficas / Fontes**: Linhas miúdas como "Disponível em...", "Acesso em...", "Autor X". ISSO É CRUCIAL e frequentemente esquecido. INCLUA AS FONTES.
4. **Imagens/Figuras/Gráficos**: Qualquer elemento visual associado.
5. **Alternativas**: Todas as opções de resposta (A, B, C, D, E). A caixa só termina DEPOIS da última alternativa.
6. **Material de Apoio (Texto/Imagem)**: Textos longos, poemas, tirinhas, mapas, figuras associadas.
   - **ATENÇÃO AO TEXTO COMPARTILHADO**: Se houver "Texto para as questões 10 e 11", VOCÊ DEVE CRIAR ENTRADAS SEPARADAS PARA CADA QUESTÃO.
   - Crie uma region para a Questão 10 contendo esse texto (tipo: "parte_questao").
   - Crie OUTRA region para a Questão 11 contendo O MESMO texto (tipo: "parte_questao").

REGRAS ESTRITAS DE TIPO ("tipo"):
- **"parte_questao"**: Use para textos de apoio, imagens, gráficos ou trechos que servem de base para a questão, mas não contêm as alternativas.
- **"questao_completa"**: Use para o bloco principal que contém o enunciado específico e as alternativas.

REGRAS ESTRITAS DE SEGMENTAÇÃO:
- **Limite Inferior**: A questão só acaba quando começa o cabeçalho da PRÓXIMA questão ou no fim da coluna/página.
- **Não Corte Alternativas**: Garanta que a alternativa (E) ou a última opção esteja totalmente dentro da caixa.
- **Não Corte Fontes**: Olhe abaixo das imagens e dos textos. Tem uma linha pequena citando a fonte? COLOQUE DENTRO DA CAIXA.
- **Questões em Colunas**: Se a prova é em duas colunas, respeite a coluna. Se a questão começa numa coluna e termina na outra, use 2 caixas (split) com o mesmo \`questionId\`.

REGRAS DO JSON:
- \`kind\`: Sempre "QUESTION".
- \`questionId\`: String com o número (ex: "45").
- \`tipo\`:
    - "questao_completa": Se a caixa contém a questão inteira.
    - "parte_questao": Se a questão foi dividida em múltiplas caixas (ex: quebra de coluna).
- \`box\`: [y1, x1, y2, x2] em escala 0..1000. O box deve ser JUSTO, mas ABRANGENTE. Sem margens brancas gigantes, mas sem cortar letras.

ANALISE A IMAGEM COM CUIDADO E GERE O JSON.
`.trim();
}

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok: {
      type: "boolean",
      description:
        "Retorne true SE E SOMENTE SE todas as 'regions' (caixas) seguem PERFEITAMENTE o princípio da CAIXA GULOSA (incluem TUDO: enunciado, imagens, fontes, TODAS as alternativas).",
    },
    feedback: {
      type: "string",
      description:
        "Se ok=false, descreva EXATAMENTE quais questões estão cortadas ou incompletas e O QUE falta nelas (ex: 'Questão 05 cortou a fonte no rodapé', 'Questão 03 faltou a alternativa E').",
    },
  },
  required: ["ok"],
};

function buildReviewPrompt(currentJson) {
  return `
VOCÊ É UM AUDITOR DE QUALIDADE RIGOROSO (REVIEWER).
SEU TRABALHO: Analisar se as caixas detectadas (bounding boxes) cobrem 100% do conteúdo de cada questão.

JSON ATUAL (Candidato):
${JSON.stringify(currentJson, null, 2)}

PRINCÍPIO RIGOROSO: "GREEDY BOX" (Caixa Gulosa)
- A caixa deve ir do topo do número da questão ATÉ O FIM ABSOLUTO dela.
- ISSO INCLUI:
  1. Texto de apoio / Enunciado COMPLETO.
  2. Imagens, tabelas, figuras.
  3. TODAS as alternativas (A, B, C, D, E).
  4. *** FONTES / REFERÊNCIAS BIBLIOGRÁFICAS *** (MUITO IMPORTANTE: Frequentemente estão em letras miúdas no rodapé da questão. DEVEM ESTAR DENTRO DA CAIXA).

TAREFA:
1. Olhe para a imagem original e para as coordenadas no JSON.
2. Verifique se ALGUMA coisa ficou de fora da caixa de cada questão.
3. Se estiver faltando UMA LINHA SEQUER (especialmente fontes ou última alternativa), reprove.

Se estiver tudo 100% perfeito, retorne { "ok": true }.
Se houver falhas, retorne { "ok": false, "feedback": "Explique o erro..." }.
`.trim();
}

function buildCorrectionPrompt(currentJson, feedback) {
  return `
ATENÇÃO: A GERAÇÃO ANTERIOR FOI REPROVADA PELO AUDITOR.
FEEDBACK DO AUDITOR: "${feedback}"

JSON ANTERIOR (Incompleto/Errado):
${JSON.stringify(currentJson, null, 2)}

SUA TAREFA:
Refazer as bounding boxes das questões mencionadas no feedback, garantindo que agora sigam o princípio GREEDY BOX (incluindo fontes, notas, todas as alternativas).
Mantenha as questões que já estavam certas (a menos que precisem de ajuste espacial por causa das outras).

GERE O JSON COMPLETO CORRIGIDO.
`.trim();
}

// --- CLASS IMPLEMENTATION ---

export class AiScanner {
  static isRunning = false;
  static isPaused = false;
  static shouldStop = false;
  static abortController = null;
  static lastProcessedPage = 0; // Para sistema de resumir

  // Estado intermediário da página para resumir de onde parou
  static pageState = {
    pageNum: 0,
    step: null, // 'extraction' | 'audit' | 'correction' | null
    extractedJson: null,
    imageBase64: null,
  };

  static scannedPages = new Set(); // Lista de páginas já concluídas nesta sessão

  static async start(pdfDoc, resume = false) {
    if (this.isRunning) return;
    this.lastPdfDoc = pdfDoc; // Store reference for restart

    // Se não for resumir, reseta o progresso
    if (!resume) {
      this.lastProcessedPage = 0;
      this.pageState = {
        pageNum: 0,
        step: null,
        imageBase64: null,
        extractedJson: null,
      };
    }

    // Inicializa UI básica (Pages manager)
    ScannerUI.init(pdfDoc.numPages);

    // Inicia Countdown de 5 segundos
    ScannerUI.startCountdown(
      5000,
      () => {
        // Cancelado
        console.log("Auto-start scanner cancelado pelo usuário.");
        ScannerUI.ensureGlobalHeader();
      },
      async () => {
        // Finalizado, inicia processo real
        await this.runScannerLoop(pdfDoc, resume);
      },
    );
  }

  // Processar apenas uma página específica
  static async processSinglePage(pdfDoc, pageNum) {
    if (this.isRunning) {
      customAlert(
        "Já existe uma análise em andamento. Aguarde ou cancele-a primeiro.",
        3000,
      );
      return;
    }

    this.lastPdfDoc = pdfDoc;
    this.isRunning = true;
    this.shouldStop = false;
    this.isPaused = false;
    this.isPausePending = false;
    this.abortController = new AbortController();

    ScannerUI.activePage = pageNum;
    ScannerUI.toggleGlow(true);
    document.body.classList.add("ai-scanning-active");

    try {
      if (this.scannedPages.has(pageNum)) {
        customAlert(`Página ${pageNum} já verificada.`, 3000);
        return;
      }

      await this.processPage(pageNum, false);
      this.scannedPages.add(pageNum); // Marca como visitada
      ScannerUI.updateAgentStatus(pageNum, "default", "Extração finalizada.");
    } catch (e) {
      if (e.name === "AbortError") {
        ScannerUI.updateAgentStatus(
          pageNum,
          "default",
          "Análise interrompida.",
        );
      } else {
        console.error("Erro ao processar página:", e);
        ScannerUI.updateAgentStatus(pageNum, "default", `Erro: ${e.message}`);
      }
    } finally {
      this.isRunning = false;
      this.isPaused = false;
      document.body.classList.remove("ai-scanning-active");
      ScannerUI.toggleGlow(false);
    }
  }

  static isPausePending = false;

  static togglePause() {
    if (this.isPaused) this.resume();
    else this.pause();
  }

  static pause() {
    if (!this.isRunning) return;
    // Don't pause immediately, set pending flag
    this.isPausePending = true;
    ScannerUI.setPausePendingState();
  }

  static resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.isPausePending = false;
    ScannerUI.onScannerPaused(false);
  }

  static async runScannerLoop(pdfDoc, resume = false) {
    this.isRunning = true;
    this.shouldStop = false;
    this.isPaused = false;
    this.isPausePending = false;
    this.abortController = new AbortController();

    // Determina página inicial
    // Se tem estado parcial de uma página, continuar dessa página
    // Senão, se resumindo, ir para a próxima após a última processada
    let startPage = 1;
    if (resume) {
      if (this.pageState.pageNum > 0 && this.pageState.step) {
        // Tem trabalho parcial nessa página
        startPage = this.pageState.pageNum;
      } else {
        // Continua da próxima página
        startPage = this.lastProcessedPage + 1;
      }
    }

    ScannerUI.activePage = startPage;
    ScannerUI.toggleGlow(true);

    // Adiciona classe global para travar header e navegação
    document.body.classList.add("ai-scanning-active");

    // Inicia observador de UI (float header etc)
    ScannerUI.startUiObserver();

    let completedSuccessfully = false;

    try {
      const numPages = pdfDoc.numPages;

      // Verificar se estamos resumindo de uma página parcialmente processada
      const hasPartialPageState =
        this.pageState.pageNum > 0 && this.pageState.step !== null;

      // Loop pelas páginas, começando da página correta
      for (let i = startPage; i <= numPages; i++) {
        // Skip pages already scanned
        if (this.scannedPages.has(i)) {
          ScannerUI.updateAgentStatus(
            i,
            "default",
            "Página já verificada. Pulando.",
          );
          continue;
        }

        // CHECK PENDING PAUSE BEFORE PROCESSING PAGE
        if (this.isPausePending) {
          this.isPaused = true;
          this.isPausePending = false;
          ScannerUI.onScannerPaused(true);
        }

        // VERIFICA PAUSA
        while (this.isPaused) {
          if (this.shouldStop) break;
          await new Promise((r) => setTimeout(r, 200));
        }

        if (this.shouldStop) {
          ScannerUI.updateAgentStatus(
            i,
            "default",
            "Análise interrompida pelo usuário.",
          );
          break;
        }

        // Se estamos resumindo e é a primeira página do loop, verificar estado parcial
        const shouldResumeFromState =
          resume &&
          i === startPage &&
          hasPartialPageState &&
          this.pageState.pageNum === i;

        await this.processPage(i, shouldResumeFromState);

        // Atualiza progresso após processar página
        this.lastProcessedPage = i;
        this.scannedPages.add(i); // Marks page as visited only after successful processing

        // CHECK PENDING PAUSE AFTER PROCESSING PAGE (for quicker response)
        if (this.isPausePending) {
          this.isPaused = true;
          this.isPausePending = false;
          ScannerUI.onScannerPaused(true);
        }
      }

      // Se chegou aqui sem break, completou todas as páginas com sucesso
      if (!this.shouldStop) {
        completedSuccessfully = true;
      }
    } catch (e) {
      if (e.name === "AbortError") {
        console.log("Scanner abortado.");
      } else {
        console.error("Erro no Scanner:", e);
        // Tenta logar na página atual se possível
        if (ScannerUI.activePage) {
          ScannerUI.updateAgentStatus(
            ScannerUI.activePage,
            "default",
            `Falha fatal: ${e.message}`,
          );
        }
      }
      // Em caso de erro/abort, finaliza aqui
      this.finish();
    }

    // Se completou com sucesso, inicia o batch processing (que chamará finish() quando terminar)
    if (completedSuccessfully) {
      import("./batch-processor.js")
        .then(({ BatchProcessor }) => {
          BatchProcessor.start();
        })
        .catch((err) => {
          console.error("[AiScanner] Erro ao iniciar BatchProcessor:", err);
          this.finish(); // Se batch falhar, finaliza aqui
        });
    } else if (!this.shouldStop) {
      // Não completou mas também não foi parado - algum edge case, finaliza
      this.finish();
    } else {
      // Foi parado pelo usuário
      this.finish();
    }
  }

  static stop() {
    this.shouldStop = true;
    this.isPaused = false; // Destrava se estiver pausado
    if (this.abortController) {
      this.abortController.abort();
    }

    // [BATCH SYNC] Também cancela o BatchProcessor se estiver rodando
    import("./batch-processor.js")
      .then(({ BatchProcessor }) => {
        BatchProcessor.cancel();
      })
      .catch(() => {}); // Ignora erro se módulo não carregar

    // NOTE: Não atualiza status aqui pois o loop já cuida disso quando detecta shouldStop
  }

  static finish() {
    this.isRunning = false;
    this.isPaused = false;
    // Desbloquear viewer via classe global
    document.body.classList.remove("ai-scanning-active");

    ScannerUI.toggleGlow(false);
    ScannerUI.stopUiObserver();

    // Reseta o header para mostrar Iniciar/Resumir
    ScannerUI.resetHeaderToStart();
  }

  static async processPage(pageNum, resumeFromState = false) {
    ScannerUI.setPageActive(pageNum);

    // Scrollar para a página
    const pageContainer = document.getElementById(`page-wrapper-${pageNum}`);
    if (pageContainer) {
      pageContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    try {
      let imageBase64;
      let currentJson;
      let startStep = "extraction";

      // Se estamos resumindo da mesma página, usar estado salvo
      if (
        resumeFromState &&
        this.pageState.pageNum === pageNum &&
        this.pageState.step
      ) {
        imageBase64 = this.pageState.imageBase64;
        currentJson = this.pageState.extractedJson;
        startStep = this.pageState.step;
        ScannerUI.updateAgentStatus(
          pageNum,
          "analysis",
          `Resumindo da etapa: ${startStep}`,
        );
      }

      // === STEP 1: EXTRACTION ===
      if (startStep === "extraction") {
        // 1. Captura Imagem (só se não tiver do estado)
        if (!imageBase64) {
          imageBase64 = await renderPageHighRes(pageNum);
          if (!imageBase64) throw new Error("Falha ao renderizar página");
        }

        // Salvar estado antes de começar extração
        this.pageState = {
          pageNum,
          step: "extraction",
          imageBase64,
          extractedJson: null,
        };

        ScannerUI.updateAgentStatus(pageNum, "analysis", "Gerando prompt...");

        currentJson = await gerarConteudoEmJSONComImagemStream(
          buildPrompt(),
          responseSchema,
          [imageBase64],
          "image/jpeg",
          {
            onThought: (text) =>
              ScannerUI.updateAgentStatus(
                pageNum,
                "analysis",
                `Pensando: ${text}`,
              ),
            onStatus: (text) =>
              ScannerUI.updateAgentStatus(pageNum, "analysis", text),
            signal: this.abortController.signal,
          },
          {
            model: window.selectedModelScannerDetect || "models/gemini-3.5-flash",
          }
        );

        if (!currentJson || !currentJson.regions) {
          ScannerUI.updateAgentStatus(
            pageNum,
            "analysis",
            "Falha na detecção. Pulando.",
          );
          this.pageState = {
            pageNum: 0,
            step: null,
            imageBase64: null,
            extractedJson: null,
          };
          return;
        }

        ScannerUI.updateAgentStatus(
          pageNum,
          "analysis",
          `Detectadas ${currentJson.regions.length} regiões.`,
        );

        if (currentJson.regions.length === 0) {
          ScannerUI.updateAgentStatus(pageNum, "auditor", "Nada a auditar.");
          this.applyResults(currentJson, pageNum, "verified");
          await this.waitAfterVerification(pageNum, 0); // No delay if empty? Or small delay?

          this.pageState = {
            pageNum: 0,
            step: null,
            imageBase64: null,
            extractedJson: null,
          };
          return;
        }

        // SHOW DRAFT (Gray) immediately
        this.applyResults(currentJson, pageNum, "draft");

        // Salvar estado após extração bem sucedida
        this.pageState = {
          pageNum,
          step: "audit",
          imageBase64,
          extractedJson: currentJson,
        };
        startStep = "audit";
      }

      // === PAUSE CHECK AFTER EXTRACTION ===
      if (this.isPausePending) {
        this.isPaused = true;
        this.isPausePending = false;
        ScannerUI.onScannerPaused(true);
      }
      while (this.isPaused) {
        if (this.shouldStop) return;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (this.shouldStop) return;

      // === STEP 2: AUDIT ===
      if (startStep === "audit") {
        ScannerUI.updateAgentStatus(
          pageNum,
          "auditor",
          "Iniciando auditoria...",
        );

        const reviewResult = await gerarConteudoEmJSONComImagemStream(
          buildReviewPrompt(currentJson),
          reviewSchema,
          [imageBase64],
          "image/jpeg",
          {
            onThought: (text) =>
              ScannerUI.updateAgentStatus(
                pageNum,
                "auditor",
                `Pensando: ${text}`,
              ),
            signal: this.abortController.signal,
          },
          {
            model: window.selectedModelScannerAudit || "models/gemini-3.5-flash",
          }
        );

        if (reviewResult.ok) {
          ScannerUI.updateAgentStatus(pageNum, "auditor", "Aprovado! ✅");

          // Clear drafts and apply Verified
          this.clearDrafts(pageNum);
          this.applyResults(currentJson, pageNum, "verified");

          // DELAY to show Verified state
          await this.waitAfterVerification(pageNum, currentJson.regions.length);

          this.pageState = {
            pageNum: 0,
            step: null,
            imageBase64: null,
            extractedJson: null,
          };
          return;
        }

        // Salvando estado antes da correção
        this.pageState = {
          pageNum,
          step: "correction",
          imageBase64,
          extractedJson: currentJson,
        };
        this.pageState.auditFeedback = reviewResult.feedback;
        startStep = "correction";

        ScannerUI.updateAgentStatus(
          pageNum,
          "auditor",
          `Reprovado: ${reviewResult.feedback.substring(0, 60)}...`,
        );
      }

      // === PAUSE CHECK AFTER AUDIT ===
      if (this.isPausePending) {
        this.isPaused = true;
        this.isPausePending = false;
        ScannerUI.onScannerPaused(true);
      }
      while (this.isPaused) {
        if (this.shouldStop) return;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (this.shouldStop) return;

      // === STEP 3: CORRECTION ===
      if (startStep === "correction") {
        const feedback = this.pageState.auditFeedback || "Correção necessária";

        ScannerUI.updateAgentStatus(
          pageNum,
          "correction",
          "Iniciando correções...",
        );

        const correctedJson = await gerarConteudoEmJSONComImagemStream(
          buildCorrectionPrompt(currentJson, feedback),
          responseSchema,
          [imageBase64],
          "image/jpeg",
          {
            onThought: (text) =>
              ScannerUI.updateAgentStatus(
                pageNum,
                "correction",
                `Pensando: ${text}`,
              ),
            signal: this.abortController.signal,
          },
          {
            model: window.selectedModelScannerCorrect || "models/gemini-3.5-flash",
          }
        );

        this.clearDrafts(pageNum); // Clear previous drafts

        if (correctedJson && correctedJson.regions) {
          ScannerUI.updateAgentStatus(
            pageNum,
            "correction",
            `Corrigido (${correctedJson.regions.length} regiões).`,
          );
          this.applyResults(correctedJson, pageNum, "verified");
          await this.waitAfterVerification(
            pageNum,
            correctedJson.regions.length,
          );
        } else {
          ScannerUI.updateAgentStatus(
            pageNum,
            "correction",
            "Falha na correção. Mantendo original.",
          );
          this.applyResults(currentJson, pageNum, "verified");
          await this.waitAfterVerification(pageNum, currentJson.regions.length);
        }
      }

      // Limpar estado após processamento completo
      this.pageState = {
        pageNum: 0,
        step: null,
        imageBase64: null,
        extractedJson: null,
      };
    } catch (e) {
      if (e.name === "AbortError") return;

      // [FIX] Handle EMPTY_RESPONSE_ERROR gracefully - skip page instead of crashing
      if (e.message === "EMPTY_RESPONSE_ERROR") {
        console.warn(
          `[AiScanner] Página ${pageNum}: IA retornou resposta vazia (possível sobrecarga). Pulando página.`,
        );
        ScannerUI.updateAgentStatus(
          pageNum,
          "default",
          "⚠️ Resposta vazia da IA. Página pulada.",
        );
        // Clear partial state and continue
        this.pageState = {
          pageNum: 0,
          step: null,
          imageBase64: null,
          extractedJson: null,
        };
        return; // Continue to next page instead of breaking
      }

      console.error(`Erro pg ${pageNum}:`, e);
      ScannerUI.updateAgentStatus(pageNum, "default", `Erro: ${e.message}`);
    }
  }

  static applyResults(json, pageNum, status = "sent") {
    try {
      // Import CropperState dynamic if needed or assume loaded
      // Padding 15 (aprox 1.5%) para dar "ar" na questão conforme pedido
      loadSelectionsFromJson(json, pageNum, {
        tags: ["ia"],
        status,
        padding: 15,
      });
    } catch (e) {
      console.error("Erro ao aplicar JSON", e);
    }
  }

  static clearDrafts(pageNum) {
    if (CropperState && CropperState.removeGroupsByPageAndStatus) {
      CropperState.removeGroupsByPageAndStatus(pageNum, "draft");
    }
  }

  static async waitAfterVerification(pageNum, count) {
    if (count > 0) {
      ScannerUI.updateAgentStatus(pageNum, "default", "Visualizando...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
