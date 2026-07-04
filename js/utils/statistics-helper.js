/**
 * Helper de Funções Estatísticas (Wilcoxon e Spearman)
 * Utiliza as bibliotecas validadas simple-statistics e @stdlib/stats-wilcoxon
 */

import wilcoxon from "@stdlib/stats-wilcoxon";
import { sampleRankCorrelation } from "simple-statistics";

/**
 * Executa o Teste de Wilcoxon pareado para duas amostras
 * @param {number[]} x - Vetor de resultados do Grupo I (Controle)
 * @param {number[]} y - Vetor de resultados do Grupo II (Experimental)
 * @returns {object} Resultado contendo p-value, estatística, se foi rejeitado e método
 */
export function calcularWilcoxonPareado(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
    throw new Error("As amostras x e y devem ser arrays de mesmo tamanho para teste pareado.");
  }
  
  // O teste wilcoxon do @stdlib calcula o teste pareado se passarmos x e y diretamente
  try {
    const res = wilcoxon(x, y);
    return {
      pValue: res.pValue,
      statistic: res.statistic,
      rejected: res.rejected,
      method: res.method,
      alpha: res.alpha
    };
  } catch (err) {
    console.error("Erro ao rodar Teste de Wilcoxon:", err);
    return {
      error: err.message,
      pValue: null,
      statistic: null
    };
  }
}

/**
 * Calcula o Coeficiente de Correlação de Postos de Spearman entre duas variáveis
 * @param {number[]} x - Primeira variável (ex: complexidade estimada)
 * @param {number[]} y - Segunda variável (ex: dificuldade real da banca)
 * @returns {number} Coeficiente de Spearman (rho) de -1.0 a 1.0
 */
export function calcularSpearman(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
    throw new Error("As amostras x e y devem ser arrays de mesmo tamanho para correlação.");
  }
  
  try {
    return sampleRankCorrelation(x, y);
  } catch (err) {
    console.error("Erro ao calcular Spearman:", err);
    return null;
  }
}

/**
 * Calcula o Índice de Eficiência de Processamento (IEP)
 * IEP = Delta Desempenho / Delta Latência
 * @param {number} deltaPerformance - Diferença de nota (Likert)
 * @param {number} deltaLatencyMs - Diferença de latência em milissegundos
 * @returns {number} IEP
 */
export function calcularIEP(deltaPerformance, deltaLatencyMs) {
  if (deltaLatencyMs === 0) return 0;
  return deltaPerformance / deltaLatencyMs;
}
