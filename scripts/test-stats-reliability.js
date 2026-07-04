import wilcoxon from "@stdlib/stats-wilcoxon";
import { sampleRankCorrelation } from "simple-statistics";

console.log("Verificando simple-statistics...");
const x_corr = [1, 2, 3, 4, 5];
const y_corr = [1.1, 1.9, 3.2, 3.8, 5.1];
const rho = sampleRankCorrelation(x_corr, y_corr);
console.log(`Spearman rho: ${rho} (esperado próximo de 1.0)`);

console.log("Verificando @stdlib/stats-wilcoxon...");
const before = [10, 15, 12, 18, 14, 22, 19];
const after = [12, 17, 11, 20, 15, 25, 18];
const res = wilcoxon(before, after);
console.log("Resultado do teste Wilcoxon:", res);
console.log(`Estatística: ${res.statistic}`);
console.log(`P-Value: ${res.pValue}`);
console.log("Sucesso!");
