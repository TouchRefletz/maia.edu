import {
  gerarConteudoEmJSONComImagemStream,
  gerarEmbedding,
  queryPineconeWorker,
  upsertPineconeWorker,
} from "../api/worker.js";

const CONFIDENCE_THRESHOLD = 0.85;
const FILTER_INDEX_TARGET = "filter";

const NAMESPACE_MAP = {
  institution: "institutions",
  keyword: "keywords",
  // Exam is explicitly excluded from normalization, but we map it for saving/buffering purposes if needed.
  // However, per requirements, we do NOT normalize exams.
  exam: "exams",
};

// Schema for AI term expansion (structured output)
const TERM_EXPANSION_SCHEMA = {
  type: "object",
  properties: {
    canonical_name: {
      type: "string",
      description:
        "O nome canônico/oficial mais reconhecível para esta entidade (ex: 'INEP' ou 'ENEM')",
    },
    variations: {
      type: "array",
      items: { type: "string" },
      description:
        "Lista de variações, siglas, nomes completos, abreviações e termos relacionados que representam a MESMA entidade",
    },
  },
  required: ["canonical_name", "variations"],
};

/**
 * Expands a term using AI to generate variations for better semantic matching.
 * @param {string} term - The original term
 * @param {string} type - 'institution', 'keyword', or 'exam'
 * @returns {Promise<{canonical: string, expandedText: string}>}
 */
async function expandTermWithAI(term, type) {
  const typeDescriptions = {
    institution:
      "instituição, banca, escola, universidade ou órgão educacional brasileiro",
    keyword: "palavra-chave ou tema de questão educacional",
    exam: "prova, vestibular ou concurso brasileiro",
  };

  const prompt = `Você é um especialista em educação brasileira.

Dado o termo "${term}" que representa uma ${typeDescriptions[type] || "entidade educacional"}:

1. Identifique o nome canônico/oficial mais reconhecível
2. Liste TODAS as variações possíveis incluindo:
   - Siglas (ex: INEP, ENEM, USP)
   - Nomes completos (ex: Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira)
   - Nomes populares/informais (ex: "prova do ENEM")
   - Variações com/sem acentos
   - Provas/vestibulares associados (se for instituição)
   - Instituições associadas (se for prova)

Exemplo: Se o termo for "INEP", as variações devem incluir "ENEM", "Exame Nacional do Ensino Médio", "Instituto Nacional de Estudos e Pesquisas", etc.

Retorne APENAS o JSON estruturado.`;

  try {
    console.log(`[Normalizer] Expandindo termo via IA: "${term}"`);

    const result = await gerarConteudoEmJSONComImagemStream(
      prompt,
      TERM_EXPANSION_SCHEMA,
      [], // no images
      "image/jpeg",
      {}, // no handlers
      { model: "models/gemma-4-31b-it" } // use Gemma 4 31B IT
    );

    if (result && result.variations && Array.isArray(result.variations)) {
      // Combine canonical + all variations into one string for embedding
      const allTerms = [
        result.canonical_name || term,
        ...result.variations,
      ].filter(Boolean);

      const expandedText = allTerms.join(" | ");

      console.log(`[Normalizer] Expansão IA para "${term}":`, allTerms);

      return {
        canonical: result.canonical_name || term,
        expandedText,
        variations: result.variations,
      };
    }
  } catch (error) {
    console.error(`[Normalizer] Erro na expansão IA de "${term}":`, error);
  }

  // Fallback: return original term
  return {
    canonical: term,
    expandedText: term,
    variations: [],
  };
}

class DataNormalizerService {
  constructor() {
    this.pendingWrites = new Map(); // Map<namespace, Set<term>>
  }

  /**
   * Normalizes a term based on semantic similarity.
   * @param {string} term - The text to normalize (e.g. "Inst. Nac. de Est. e Pesq.")
   * @param {string} type - 'institution', 'keyword', or 'exam'
   * @returns {Promise<string>} - The canonical term found in DB or the original term.
   */
  async normalize(term, type) {
    if (!term || typeof term !== "string") return term;
    const cleanTerm = term.trim();
    if (!cleanTerm) return term;

    // RULE: Do NOT normalize exams. Just return original.
    // We might want to buffer it if we want to save new exams to the filter index for future reference?
    // The user said: "O nome da prova já vem normalizado... mantém o que tiver"
    // But "Apenas salva no Pinecone se for novo". So we should buffer it.
    if (type === "exam") {
      // Check if it exists? Or just always buffer to be safe?
      // Checking might be expensive. But if we don't check, we might duplicate?
      // Actually, upsert is idempotent. We can just buffer.
      // But wait, if we buffer every time, we re-embed every time.
      // Let's do a quick check only if we really want to avoid re-embedding known exams.
      // For now, let's assume valid exams come from DB sync. New ones come from user input.
      // We will buffer it to ensure it gets into the filter index.
      this.bufferTerm(cleanTerm, type);
      return cleanTerm;
    }

    const namespace = NAMESPACE_MAP[type];
    if (!namespace) return cleanTerm; // Unknown type, ignore

    try {
      // 1. Generate Embedding
      // Note: gerarEmbedding calls the worker /embed
      const embedding = await gerarEmbedding(cleanTerm);
      if (!embedding || !Array.isArray(embedding)) return cleanTerm;

      // 2. Query Pinecone
      const queryResult = await queryPineconeWorker(
        embedding,
        1,
        {}, // No specific metadata filter
        FILTER_INDEX_TARGET,
        namespace
      );

      // 3. Check Similarity
      if (
        queryResult &&
        queryResult.matches &&
        queryResult.matches.length > 0
      ) {
        const bestMatch = queryResult.matches[0];

        // --- DEBUG REQUESTADO PELO USUÁRIO ---
        console.log(`[Normalizer Debug] Termo: "${cleanTerm}"`);
        console.log(`[Normalizer Debug] Resultado Pinecone:`, queryResult);
        console.log(
          `[Normalizer Debug] Match +Próximo: "${bestMatch.metadata?.original_term || bestMatch.id}" (${(bestMatch.score * 100).toFixed(2)}%)`
        );
        // -------------------------------------
        if (bestMatch.score >= CONFIDENCE_THRESHOLD) {
          // Found a match! Return the canonical term.
          // We assume the metadata 'original_term' holds the display name.
          // Or we can use the ID if the ID is the display name (but IDs usually are slugs).
          // Let's use metadata.original_term if available, fallback to ID (refine ID?).
          const canonical = bestMatch.metadata?.original_term || bestMatch.id;
          console.log(
            `[Normalizer] '${cleanTerm}' -> '${canonical}' (${(bestMatch.score * 100).toFixed(1)}%)`
          );
          return canonical;
        }
      }

      // 4. No match found. Buffer for writing.
      console.log(`[Normalizer] New term detected: '${cleanTerm}'`);
      this.bufferTerm(cleanTerm, type);
      return cleanTerm;
    } catch (error) {
      console.error("[Normalizer] Error normalizing term:", error);
      return cleanTerm; // Fallback to original
    }
  }

  /**
   * Buffers a new term to be written to Pinecone later.
   * @param {string} term
   * @param {string} type
   */
  bufferTerm(term, type) {
    const namespace = NAMESPACE_MAP[type];
    if (!namespace) return;

    if (!this.pendingWrites.has(namespace)) {
      this.pendingWrites.set(namespace, new Set());
    }
    this.pendingWrites.get(namespace).add(term);
  }

  /**
   * Flushes pending terms to Pinecone.
   * Uses AI expansion to create richer embeddings for better semantic matching.
   * Should be called when saving the question.
   */
  async flush() {
    console.log("[Normalizer] Flushing pending terms...");
    const promises = [];

    for (const [namespace, terms] of this.pendingWrites.entries()) {
      if (terms.size === 0) continue;

      const termsArray = Array.from(terms);
      const type = Object.keys(NAMESPACE_MAP).find(
        (key) => NAMESPACE_MAP[key] === namespace
      );

      console.log(
        `[Normalizer] Processing ${termsArray.length} terms for namespace '${namespace}'`
      );

      const batchPromise = (async () => {
        const vectors = [];

        for (const term of termsArray) {
          try {
            // === AI EXPANSION ===
            // Expand the term to include variations before embedding
            const expansion = await expandTermWithAI(term, type);

            // Generate embedding from the EXPANDED text (includes all variations)
            const embedding = await gerarEmbedding(expansion.expandedText);

            if (embedding) {
              // Create ID: Simple slug from canonical name
              const id = (expansion.canonical || term)
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

              vectors.push({
                id: id || "unknown",
                values: embedding,
                metadata: {
                  original_term: expansion.canonical || term,
                  variations: expansion.variations || [],
                  expanded_text: expansion.expandedText,
                  type: type,
                  created_at: new Date().toISOString(),
                },
              });

              console.log(
                `[Normalizer] Prepared vector for "${term}" -> "${expansion.canonical}" with ${expansion.variations?.length || 0} variations`
              );
            }
          } catch (e) {
            console.error(`[Normalizer] Failed to process '${term}':`, e);
          }
        }

        if (vectors.length > 0) {
          await upsertPineconeWorker(vectors, namespace, FILTER_INDEX_TARGET);
          console.log(
            `[Normalizer] Saved ${vectors.length} expanded vectors to namespace '${namespace}'`
          );
        }
      })();

      promises.push(batchPromise);
    }

    await Promise.all(promises);
    this.pendingWrites.clear();
    console.log("[Normalizer] Flush complete.");
  }
}

export const DataNormalizer = new DataNormalizerService();

// Export for testing/debug
export { expandTermWithAI };
