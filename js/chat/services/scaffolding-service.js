import { cleanQuestionDataForAI } from "../../utils/question-cleaner.js";



export const ScaffoldingService = {
  /**
   * Decide aleatoriamente se a próxima pergunta será Verdadeira ou Falsa.
   * @returns {boolean} true para Verdadeiro, false para Falso.
   */
  decidirProximoStatus: () => {
    return Math.random() < 0.5;
  },

  /**
   * Calcula a pontuação e estatísticas de um passo respondido pelo usuário.
   * Baseado na lógica original de avaliarPasso.js.
   *
   * @param {number} guess - O valor do chute do usuário (0-100).
   * @param {boolean} isVerdadeiro - Se a afirmação era verdadeira (true) ou falsa (false).
   * @param {number} tempoGasto - Tempo gasto em segundos.
   * @param {number} tempoIdeal - Tempo ideal estimado em segundos.
   */
  calcularPontuacao: (guess, isVerdadeiro, tempoGasto, tempoIdeal) => {
    // 1. Taxa de Certeza: O quão longe de 50 (dúvida) o usuário estava?
    // Ex: guess 100 -> certeza 1.0; guess 50 -> certeza 0.0
    // Caso especial: guess -1 significa "Não sei" -> certeza 0
    const taxaDeCerteza = guess === -1 ? 0 : Math.abs(50 - guess) / 50;

    // 2. Extremidade Correta: Qual era o alvo? (100 se V, 0 se F)
    const extremidadeCorreta = isVerdadeiro ? 100 : 0;

    // 3. Taxa de Acerto: O usuário chutou pro lado certo?
    // Se era Falso (0), guess < 50 é acerto.
    // Se era Verdadeiro (100), guess > 50 é acerto.
    // Nota: guess = 50 é considerado erro aqui (ou incerteza total)
    const taxaDeAcerto =
      extremidadeCorreta === 0 ? (guess < 50 ? 1 : 0) : guess > 50 ? 1 : 0;

    // 4. Peso do Tempo
    const diferenca = tempoGasto - tempoIdeal;
    // Penaliza se demorou muito mais que o ideal
    const pesoTempo = Math.exp(-0.05 * Math.sqrt(Math.abs(diferenca)));

    // 5. Resultado Final do Passo
    const resultadoPasso = taxaDeAcerto * pesoTempo * taxaDeCerteza;

    return {
      taxaDeCerteza, // 0 a 1
      extremidadeCorreta, // 0 ou 100
      taxaDeAcerto, // 0 ou 1
      pesoTempo, // ~0 a 1
      resultadoPasso, // 0 a 1 (Métrica composta)
      tempoGasto,
      tempoIdeal,
    };
  },

  /**
   * Calcula a média de proficiência baseada no histórico.
   * @param {Array} historicoResultados - Array de objetos resultadoPasso.
   * @returns {number} Média (0 a 1).
   */
  calcularProficienciaMedia: (historicoResultados) => {
    if (!historicoResultados || historicoResultados.length === 0) return 0;

    // Extrai apenas os valores de resultadoPasso
    const valores = historicoResultados.map((h) => h.resultadoPasso || 0);
    const soma = valores.reduce((a, b) => a + b, 0);
    return soma / valores.length;
  },

  /**
   * Gera o prompt completo para a próxima etapa do Scaffolding via Silent Generation.
   * PORTADO DE: só pro gemini ver/maia/passo.js (gerarPromptIA)
   *
   * @param {Object} questaoAlvo - Objeto da questão ({ questao, resposta_correta }).
   * @param {boolean} proximoStatus - True para gerar Verdadeiro, False para Falso.
   * @param {Array} historicoLinear - Array de passos anteriores (objetos com contexto, resultados, etc).
   */
  generateStepPrompt: (questaoAlvo, proximoStatus, historicoLinear = []) => {
    const temHistorico = historicoLinear.length > 0;
    const ultimoPasso = temHistorico
      ? historicoLinear[historicoLinear.length - 1]
      : null;

    // 1. FORMATAR HISTÓRICO
    let historicoFormatado = "";
    let listaEnunciadosAnteriores = [];

    if (temHistorico) {
      historicoFormatado =
        "\n\n**HISTÓRICO DE RASTREAMENTO (O que já foi perguntado e explicado):**\n";

      historicoLinear.forEach((passo, index) => {
        // Assume check de estrutura para evitar erros
        const contexto = passo.contexto || {};
        const stats = passo.stats || {};

        listaEnunciadosAnteriores.push(contexto.pergunta || "");

        historicoFormatado += `\nPasso ${index + 1}:`;
        historicoFormatado += `\n   - Pergunta Feita: "${contexto.pergunta || "N/A"}"`;
        historicoFormatado += `\n   - Explicação dada: "${contexto.explicacao || "N/A"}"`;
        historicoFormatado += `\n   - O usuário acertou? ${stats.acertou ? "SIM" : "NÃO"}`;
        historicoFormatado += `\n   - Confiança do usuário: ${(stats.taxaDeCerteza * 100).toFixed(1)}%`;
        historicoFormatado += `\n   - Proficiência atual: ${(stats.proficiencia * 100).toFixed(1)}%\n`;
      });
    }

    // 2. ENUNCIADOS PROIBIDOS
    let secaoEnunciadosProibidos = "";
    if (listaEnunciadosAnteriores.length > 0) {
      secaoEnunciadosProibidos = `\n\n**⚠️ ENUNCIADOS JÁ UTILIZADOS (PROIBIDO REPETIR):**\n`;
      listaEnunciadosAnteriores.forEach((enunciado, index) => {
        if (enunciado)
          secaoEnunciadosProibidos += `${index + 1}. "${enunciado}"\n`;
      });
      secaoEnunciadosProibidos += `\n🚫 Você DEVE fazer uma pergunta COMPLETAMENTE DIFERENTE.`;
    }

    // 3. CONSTRUÇÃO DO PROMPT
    const alvo = proximoStatus ? "VERDADEIRA" : "FALSA";
    // Formatação do Contexto Rico (Se disponível)
    let contextoRico = "";
    if (typeof questaoAlvo === "object") {
      contextoRico += `\n    === CONTEXTO COMPLETO DA QUESTÃO (METADADOS E GABARITO) ===\n`;
      // Tenta extrair partes comuns do JSON rico (ex: dados_questao, dados_gabarito)
      if (questaoAlvo.dados_questao || questaoAlvo.dados_gabarito) {
        const cleanedQuestao = cleanQuestionDataForAI(questaoAlvo);
        contextoRico += JSON.stringify(cleanedQuestao, null, 2);
      } else {
        // Fallback para objetos simples
        contextoRico += `    Questão: "${questaoAlvo.questao || questaoAlvo.enunciado || "N/A"}"\n`;
        contextoRico += `    Resposta Correta: "${questaoAlvo.resposta_correta || questaoAlvo.gabarito || "N/A"}"\n`;
        if (questaoAlvo.explicacao)
          contextoRico += `    Explicação Original: "${questaoAlvo.explicacao}"\n`;
      }
      contextoRico += `    ===========================================================\n`;
    } else {
      // Fallback string simples
      contextoRico += `    Questão Alvo: "${questaoAlvo}"\n`;
    }

    let prompt = `Você é um tutor inteligente focado em Scaffolding.

    ${contextoRico}

    SUA MISSÃO:
    Crie a PRÓXIMA PERGUNTA de Verdadeiro ou Falso.
    A resposta correta desta nova pergunta DEVE ser: **${alvo}**.

    ${secaoEnunciadosProibidos}

    REGRAS CRÍTICAS:
    1. **DIVERSIDADE**: Aborde um aspecto novo do problema (considere o contexto completo fornecido).
    2. **PROGRESSO**: Avance degrau por degrau em direção à compreensão total da Questão de Partida.
    3. **AUTONOMIA**: A pergunta deve ser autocontida e clara.
    4. **USO DO CONTEXTO**: Use o JSON fornecido (dados_questao, dados_gabarito) para criar passos que explorem as nuances, alternativas incorretas e conceitos teóricos da questão original.

    ${temHistorico ? historicoFormatado : "\n**HISTÓRICO:** Nenhum (Início do Scaffolding)."}
    `;

    // 4. ESTRATÉGIA ADAPTATIVA
    if (temHistorico && ultimoPasso) {
      const stats = ultimoPasso.stats || {};
      prompt += `\n\n**ANÁLISE ESTRATÉGICA DO ÚLTIMO PASSO:**
        - Resultado: ${stats.acertou ? "✓ Acertou" : "✗ Errou"}
        - Proficiência: ${(stats.proficiencia * 100).toFixed(1)}%

        --- REGRA DE ENCERRAMENTO POR "SPOILER" ---
        Analise a explicação dada no último passo.
        Se ela JÁ REVELOU a resposta da Questão Alvo ou explicou o conceito final de forma óbvia:
        1. NÃO gere nova pergunta.
        2. Retorne "status": "concluido".
        3. No campo "raciocinio_adaptativo", diga: "O conceito final já foi explicado."
        -------------------------------------------

        Se não houve spoiler:
        ${
          stats.proficiencia < 0.3
            ? "⚠️ O usuário está com dificuldades. Simplifique com um conceito mais básico, mas PERGUNTA INÉDITA."
            : stats.proficiencia > 0.8
              ? "🚀 High Performer. Vá para um conceito avançado ou finalize se já cobriu o necessário."
              : "Avance um passo lógico na complexidade."
        }
      `;
    }

    prompt += `\n\n**INSTRUÇÕES FINAIS:**
    Gere os campos necessários para o próximo passo (enunciado, feedbacks, etc).
    Não invente campos fora do padrão.
    Seja criativo e didático.
    `;

    return prompt;
  },
};
