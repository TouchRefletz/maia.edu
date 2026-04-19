import { pipeline } from "@xenova/transformers";
import { gerarEmbedding, queryPineconeWorker } from "../../api/worker.js";

// Configurações de Threshold
const PINECONE_MIN_SCORE = 0.20; // Abaixo disso é lixo sem discussão
const PINECONE_TRUST_SCORE = 0.85; // Acima disso é estudo sem discussão

// Singleton para o modelo local (Lazy Loading)
let classifierInstance = null;
let chromeAISession = null;

/**
 * Inicializa a sessão do Gemini Nano (Chrome Built-in AI)
 */
async function getChromeAISession() {
  if (chromeAISession) return chromeAISession;

  try {
    if (window.ai && window.ai.languageModel) {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available !== "no") {
        chromeAISession = await window.ai.languageModel.create({
          systemPrompt:
            "Você é um classificador de intenção rigoroso para um aplicativo de estudos. Sua única função é dizer se uma mensagem do usuário é sobre estudos/acadêmico ou não.",
        });
        return chromeAISession;
      }
    }
  } catch (e) {
    console.warn("[Guardrail] Chrome AI não disponível:", e.message);
  }
  return null;
}

/**
 * Inicializa o classificador do Transformers.js
 */
async function getTransformersClassifier() {
  if (classifierInstance) return classifierInstance;

  console.log("[Guardrail] Carregando modelo local Transformers.js...");
  try {
    // Usamos um modelo minúsculo de NLI/Classification
    classifierInstance = await pipeline(
      "zero-shot-classification",
      "Xenova/mobilebert-uncased-mnli"
    );
    return classifierInstance;
  } catch (e) {
    console.error("[Guardrail] Erro ao carregar Transformers.js:", e);
    return null;
  }
}

/**
 * Juiz 1: Gemini Nano (Local Browser AI)
 */
async function judgeWithChromeAI(message) {
  const session = await getChromeAISession();
  if (!session) return null;

  try {
    const prompt = `Analise se a mensagem do usuário tem intenção educacional, acadêmica ou de aprendizado.
Resposta 'S' se: dúvidas sobre matérias (Matemática, História, Literatura, etc), pedidos de explicação, perguntas sobre livros, vestibulares, ou curiosidades científicas.
Resposta 'N' se: conversa fiada, games, apostas, ofensas, assuntos sem relação com estudo.

Mensagem: "${message}"

Resposta (Apenas S ou N):`;
    const response = await session.prompt(prompt);
    const result = response.trim().toUpperCase();

    console.log(`[Guardrail] Chrome AI Judge: ${result}`);
    return result.includes("S");
  } catch (e) {
    console.warn("[Guardrail] Erro no Chrome AI Judge:", e);
    return null;
  }
}

/**
 * Juiz 2: Transformers.js (Fallback local WebGPU/CPU)
 */
async function judgeWithTransformers(message) {
  const classifier = await getTransformersClassifier();
  if (!classifier) return true; // Se tudo falhar, deixamos passar (fail-open)

  try {
    const labels = ["acadêmico e estudos", "literatura e artes", "conversa casual", "lixo, games e apostas"];
    const result = await classifier(message, labels);

    const bestLabel = result.labels[0];
    const score = result.scores[0];

    console.log(
      `[Guardrail] Transformers Judge: ${bestLabel} (Confiança: ${score.toFixed(
        2
      )})`
    );

    const validLabels = ["acadêmico e estudos", "literatura e artes"];
    return validLabels.includes(bestLabel) && score > 0.35;
  } catch (e) {
    console.error("[Guardrail] Erro no Transformers Judge:", e);
    return true;
  }
}

/**
 * Validador principal (Híbrido)
 */
export async function validateStudyContext(message) {
  if (!message || message.trim().length === 0) return { isValid: true };

  // 1. Check básico de saudações e comandos
  const cleanMsg = message.trim().toLowerCase();
  
  if (
    message.trim().split(/\s+/).length <= 2 &&
    /^(oi|ola|olá|tudo bem\??|bom dia|boa tarde|boa noite|ajuda|clear|limpar)$/i.test(
      message.trim()
    )
  ) {
    return { isValid: true };
  }

  // 1.1 Heurística de palavras acadêmicas (Whitelist rápida)
  const academicKeywords = [
    "enem", "fuvest", "unicamp", "vestibular", "vunesp", "materia", "matéria",
    "explic", "entendi", "como funciona", "quem foi", "o que é", "porque",
    "biologia", "quimica", "física", "história", "geografia", "literatura",
    "sociologia", "filosofia", "gramatica", "redação", "livro", "obra", "autor", 
    "resumo", "analise", "análise", "exercicio", "questão", "gabarito"
  ];
  
  if (academicKeywords.some(key => cleanMsg.includes(key))) {
    console.log("[Guardrail] Whitelist acadêmica detectada.");
    return { isValid: true, reason: "keyword_whitelist" };
  }

  try {
    // 2. Camada de Vetores (Pinecone)
    const vetor = await gerarEmbedding(message);
    if (!vetor) return { isValid: true };

    const resultados = await queryPineconeWorker(vetor, 1, {}, "default");
    let pineconeScore = 0;

    if (resultados?.matches?.length > 0) {
      pineconeScore = resultados.matches[0].score;
      console.log(`[Guardrail] Pinecone Score: ${pineconeScore.toFixed(4)}`);

      if (pineconeScore < PINECONE_MIN_SCORE) {
        return { isValid: false, score: pineconeScore, reason: "low_vector_score" };
      }

      if (pineconeScore > PINECONE_TRUST_SCORE) {
        return { isValid: true, reason: "high_vector_score" };
      }
    }

    // 3. Camada de Juiz Local (Zona Cinzenta)
    console.log("[Guardrail] ⚖️ Entrando em zona cinzenta. Acionando Juiz Local...");

    // Tenta Chrome AI primeiro
    const chromeResult = await judgeWithChromeAI(message);
    if (chromeResult !== null) {
      return {
        isValid: chromeResult,
        score: pineconeScore,
        reason: chromeResult ? "chrome_ai_passed" : "chrome_ai_rejected",
      };
    }

    // Fallback para Transformers.js
    const transResult = await judgeWithTransformers(message);
    return {
      isValid: transResult,
      score: pineconeScore,
      reason: transResult ? "transformers_passed" : "transformers_rejected",
    };
  } catch (e) {
    console.error("[Guardrail] Erro no pipeline de validação:", e);
    return { isValid: true, reason: "error_bypass" };
  }
}
