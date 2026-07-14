import fs from "fs";
import path from "path";
import { calcularWilcoxonPareado, calcularSpearman } from "../js/utils/statistics-helper.js";

const baseDir = "./experiments/apêndice a arrumado";
const apendiceBDirs = [
  "./experiments/apêndice b/linguagens",
  "./experiments/apêndice b/humanas"
];
const outputFile = "./experiments/stats_summary_apendice_a.json";

function getMean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getStdDev(arr, mean) {
  if (arr.length <= 1) return 0;
  const variance =
    arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function normalizeModel(modelStr) {
  if (!modelStr) return "";
  const s = modelStr.toLowerCase();
  if (s.includes("gemini")) return "gemini-3.5-flash";
  if (s.includes("gemma")) return "gemma-4-31b-it";
  if (s.includes("gpt-oss") || s.includes("gpt_oss") || s === "o1") return "gpt-oss-120b";
  return s;
}

// Helper to extract the actual data object from a JSON, supporting arrays
function extractDataObject(jsonData) {
  if (Array.isArray(jsonData)) {
    const withEval = jsonData.find(obj => obj && obj.avaliacao_juiz);
    if (withEval) return withEval;
    
    const withModel = jsonData.find(obj => obj && obj.model);
    if (withModel) return withModel;

    return jsonData[0] || {};
  }
  return jsonData;
}

// Recurse directories to find folders that contain question files
function findQuestionDirs(dir) {
  const list = fs.readdirSync(dir);
  let results = [];
  let hasJson = false;
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findQuestionDirs(filePath));
    } else if (file.endsWith(".json")) {
      hasJson = true;
    }
  }
  if (hasJson) {
    results.push(dir);
  }
  return results;
}

// Attempts to read the estimated complexity of the question from Appendix B triagem
function getEstimatedComplexity(parentDirName, folderName) {
  try {
    const normalizedFolderName = folderName.replace("questão", "Questão");
    const testNames = [
      `maia_debug_apendice_b_${normalizedFolderName}.json`,
      `maia_debug_apendice_b_${normalizedFolderName.toUpperCase()}.json`,
      `maia_debug_apendice_b_${normalizedFolderName.toLowerCase()}.json`
    ];
    for (const bDir of apendiceBDirs) {
      for (const fileName of testNames) {
        const filePath = path.join(bDir, parentDirName, fileName);
        if (fs.existsSync(filePath)) {
          const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          let responseText = fileData.response_text;
          if (typeof responseText === "string") {
            try {
              responseText = JSON.parse(responseText);
            } catch (err) {
              // fallback
            }
          }
          if (responseText && typeof responseText.pontuacao_final_complexidade === "number") {
            return responseText.pontuacao_final_complexidade;
          }
        }
      }
    }
  } catch (e) {
    // Ignore silent fallback
  }
  return null;
}

// Extrai texto legível de blocos de resposta Maia.edu
function getResponseTextString(responseObj) {
  if (!responseObj) return "";
  if (typeof responseObj === "string") return responseObj;
  if (responseObj.sections && Array.isArray(responseObj.sections)) {
    let textParts = [];
    for (const sec of responseObj.sections) {
      if (sec.conteudo) {
        if (Array.isArray(sec.conteudo)) {
          for (const b of sec.conteudo) {
            if (b.conteudo && typeof b.conteudo === "string") {
              textParts.push(b.conteudo);
            }
          }
        } else if (typeof sec.conteudo === "string") {
          textParts.push(sec.conteudo);
        }
      }
      if (sec.slots) {
        for (const slotKey of Object.keys(sec.slots)) {
          const slotBlocks = sec.slots[slotKey];
          if (Array.isArray(slotBlocks)) {
            for (const b of slotBlocks) {
              if (b.conteudo && typeof b.conteudo === "string") {
                textParts.push(b.conteudo);
              }
            }
          }
        }
      }
    }
    return textParts.join("\n");
  }
  return JSON.stringify(responseObj);
}

// Extrai todos os critérios de avaliações divididas em múltiplos pedaços
function extractAllCriterios(jsonData) {
  const criterios = {};
  if (Array.isArray(jsonData)) {
    for (const obj of jsonData) {
      if (obj && obj.response_text && obj.response_text.criterios) {
        Object.assign(criterios, obj.response_text.criterios);
      }
    }
  } else if (jsonData && jsonData.response_text && jsonData.response_text.criterios) {
    Object.assign(criterios, jsonData.response_text.criterios);
  }
  return criterios;
}

// Estatística de Kruskal-Wallis inline
function calcularKruskalWallis(groups) {
  let combined = [];
  groups.forEach((group, groupIdx) => {
    group.forEach(val => {
      combined.push({ val, groupIdx });
    });
  });

  combined.sort((a, b) => a.val - b.val);

  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].val === combined[i].val) {
      j++;
    }
    const rankMean = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      combined[k].rank = rankMean;
    }
    i = j;
  }

  const n = groups.map(g => g.length);
  const N = combined.length;
  const R = new Array(groups.length).fill(0);
  combined.forEach(item => {
    R[item.groupIdx] += item.rank;
  });

  let sumSqR = 0;
  for (let g = 0; g < groups.length; g++) {
    sumSqR += Math.pow(R[g], 2) / n[g];
  }

  const H = (12 / (N * (N + 1))) * sumSqR - 3 * (N + 1);
  const df = groups.length - 1;
  // Para gl=2, Qui-quadrado p-value = exp(-H/2)
  const pValue = Math.exp(-H / 2);

  return { statistic: H, df, pValue };
}

// Regressão Linear inline
function calcularRegressaoLinear(x, y) {
  const n = x.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predY = slope * x[i] + intercept;
    ssTot += Math.pow(y[i] - meanY, 2);
    ssRes += Math.pow(y[i] - predY, 2);
  }
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { slope, intercept, r2 };
}

// Algoritmo K-Means inline
function calcularKMeans(dataPoints, k = 3) {
  const xs = dataPoints.map(p => p.x);
  const ys = dataPoints.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const normPoints = dataPoints.map(p => ({
    x: maxX > minX ? (p.x - minX) / (maxX - minX) : 0,
    y: maxY > minY ? (p.y - minY) / (maxY - minY) : 0,
    orig: p
  }));

  let centroids = [];
  for (let i = 0; i < k; i++) {
    const index = Math.floor((i + 0.5) * normPoints.length / k) % normPoints.length;
    centroids.push({ x: normPoints[index].x, y: normPoints[index].y });
  }

  let assignments = new Array(normPoints.length).fill(-1);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 100) {
    changed = false;
    iterations++;

    for (let i = 0; i < normPoints.length; i++) {
      const p = normPoints[i];
      let minDist = Infinity;
      let closestCentroid = -1;

      for (let c = 0; c < k; c++) {
        const dist = Math.pow(p.x - centroids[c].x, 2) + Math.pow(p.y - centroids[c].y, 2);
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = c;
        }
      }

      if (assignments[i] !== closestCentroid) {
        assignments[i] = closestCentroid;
        changed = true;
      }
    }

    const sums = Array.from({ length: k }, () => ({ x: 0, y: 0, count: 0 }));
    for (let i = 0; i < normPoints.length; i++) {
      const c = assignments[i];
      sums[c].x += normPoints[i].x;
      sums[c].y += normPoints[i].y;
      sums[c].count++;
    }

    for (let c = 0; c < k; c++) {
      if (sums[c].count > 0) {
        centroids[c].x = sums[c].x / sums[c].count;
        centroids[c].y = sums[c].y / sums[c].count;
      }
    }
  }

  const clusters = Array.from({ length: k }, (_, idx) => {
    const cX = centroids[idx].x * (maxX - minX) + minX;
    const cY = centroids[idx].y * (maxY - minY) + minY;
    return { id: idx, centroid: { x: cX, y: cY }, points: [] };
  });

  for (let i = 0; i < normPoints.length; i++) {
    const c = assignments[i];
    clusters[c].points.push(normPoints[i].orig);
  }

  return clusters;
}

function run() {
  console.log(`=== Iniciando Processamento Unificado do Apêndice A ===`);
  console.log(`Diretório base: ${baseDir}`);

  if (!fs.existsSync(baseDir)) {
    console.error(`Erro: Diretório ${baseDir} não encontrado.`);
    process.exit(1);
  }

  const qDirs = findQuestionDirs(baseDir);
  console.log(`Encontradas ${qDirs.length} pastas de questões.`);

  const allQuestionsData = [];
  const errors = [];

  // Arrays globais para cálculo do Fleiss' Kappa
  let agreementRatings = [];

  for (const qDir of qDirs) {
    const folderName = path.basename(qDir);
    const parentName = path.basename(path.dirname(qDir));
    const questionId = `${parentName} - ${folderName}`;

    const files = fs.readdirSync(qDir).filter(f => f.endsWith(".json"));

    if (files.length !== 6) {
      errors.push(`[${questionId}] Incoerência: Esperava 6 arquivos, encontrou ${files.length}.`);
      continue;
    }

    // Matching de arquivos robusto ignorando timestamps
    const originalComArqFile = files.find(f => f.toLowerCase().includes("com_arq") && !f.toLowerCase().includes("quest"));
    const originalSemArqFile = files.find(f => f.toLowerCase().includes("sem_arq") && !f.toLowerCase().includes("quest"));
    const judgesComArqFiles = files.filter(f => f.toLowerCase().includes("com_arq") && f.toLowerCase().includes("quest"));
    const judgesSemArqFiles = files.filter(f => f.toLowerCase().includes("sem_arq") && f.toLowerCase().includes("quest"));

    if (!originalComArqFile || !originalSemArqFile || judgesComArqFiles.length !== 2 || judgesSemArqFiles.length !== 2) {
      errors.push(`[${questionId}] Incoerência: Estrutura de arquivos inválida.`);
      continue;
    }

    try {
      const origComRaw = JSON.parse(fs.readFileSync(path.join(qDir, originalComArqFile), "utf-8"));
      const origSemRaw = JSON.parse(fs.readFileSync(path.join(qDir, originalSemArqFile), "utf-8"));
      
      const origComData = extractDataObject(origComRaw);
      const origSemData = extractDataObject(origSemRaw);
      
      const judgesComData = judgesComArqFiles.map(f => ({
        filename: f,
        raw: JSON.parse(fs.readFileSync(path.join(qDir, f), "utf-8")),
        data: extractDataObject(JSON.parse(fs.readFileSync(path.join(qDir, f), "utf-8")))
      }));
      const judgesSemData = judgesSemArqFiles.map(f => ({
        filename: f,
        raw: JSON.parse(fs.readFileSync(path.join(qDir, f), "utf-8")),
        data: extractDataObject(JSON.parse(fs.readFileSync(path.join(qDir, f), "utf-8")))
      }));

      const genModelCom = normalizeModel(origComData.model);
      const genModelSem = normalizeModel(origSemData.model);

      if (genModelCom !== genModelSem) {
        errors.push(`[${questionId}] Incoerência: Modelo gerador diferente.`);
      }

      // Latências específicas
      const lCom = origComRaw.latencies || {};
      const latenciesCom = {
        total_ms: lCom.total_ms || origComRaw.latency_ms || 0,
        router_ms: lCom.router_ms || 0,
        memory_ms: lCom.memory_ms || 0,
        generation_ms: lCom.generation_ms || 0,
        rag_ms: lCom.rag_ms || 0,
        search_ms: lCom.search_ms || 0
      };

      const lSem = origSemRaw.latencies || {};
      const latenciesSem = {
        total_ms: lSem.total_ms || origSemRaw.latency_ms || 0,
        router_ms: 0,
        memory_ms: 0,
        generation_ms: lSem.generation_ms || origSemRaw.latency_ms || 0,
        rag_ms: 0,
        search_ms: 0
      };

      // Extração do tamanho do texto gerado
      const textCom = getResponseTextString(origComRaw.response_text || origComData.response_text);
      const textSem = getResponseTextString(origSemRaw.response_text || origSemData.response_text);
      const charsCom = textCom.length;
      const charsSem = textSem.length;

      // Crossover de juízes
      const getEvaluationScores = (judgesList) => {
        const scores = [];
        for (const j of judgesList) {
          const evalObj = j.data.avaliacao_juiz;
          if (!evalObj) continue;
          const modelKey = Object.keys(evalObj).find(k => k !== "error");
          if (!modelKey) continue;
          const judgeData = evalObj[modelKey];
          if (!judgeData || !judgeData.notas_grupo) continue;
          
          // Extrair critérios detalhados
          const criteriosChecked = extractAllCriterios(j.raw);

          scores.push({
            model: normalizeModel(modelKey),
            pontuacao_total: judgeData.pontuacao_total,
            notas_grupo: judgeData.notas_grupo,
            criterios: criteriosChecked
          });
        }
        return scores;
      };

      const comScores = getEvaluationScores(judgesComData);
      const semScores = getEvaluationScores(judgesSemData);

      if (comScores.length !== 2 || semScores.length !== 2) {
        errors.push(`[${questionId}] Falha ao extrair notas de avaliações.`);
        continue;
      }

      // Fusão dos critérios dos 2 juízes (presença média: 0, 0.5 ou 1.0)
      const mergeCriterios = (scoresList) => {
        const merged = {};
        const allKeys = new Set([
          ...Object.keys(scoresList[0].criterios),
          ...Object.keys(scoresList[1].criterios)
        ]);

        for (const key of allKeys) {
          const present1 = scoresList[0].criterios[key]?.presente ? 1 : 0;
          const present2 = scoresList[1].criterios[key]?.presente ? 1 : 0;
          const evidence1 = scoresList[0].criterios[key]?.evidencia || "";
          const evidence2 = scoresList[1].criterios[key]?.evidencia || "";

          merged[key] = {
            presence_rate: (present1 + present2) / 2,
            evidencia_length: (evidence1.length + evidence2.length) / 2
          };

          // Salvar para cálculo do Fleiss' Kappa
          agreementRatings.push({
            questionId,
            criterion: key,
            rater1: present1,
            rater2: present2
          });
        }
        return merged;
      };

      const criteriosComMerged = mergeCriterios(comScores);
      const criteriosSemMerged = mergeCriterios(semScores);

      const avgScore = (key) => (comScores[0].notas_grupo[key] + comScores[1].notas_grupo[key]) / 2;
      const avgScoreSem = (key) => (semScores[0].notas_grupo[key] + semScores[1].notas_grupo[key]) / 2;

      const comTotals = (comScores[0].pontuacao_total + comScores[1].pontuacao_total) / 2;
      const semTotals = (semScores[0].pontuacao_total + semScores[1].pontuacao_total) / 2;

      const complexityEst = getEstimatedComplexity(parentName, folderName) || 12.0;
      const isPostCutoff = parentName.includes("2025");

      // Timestamp hour
      let hourOfDay = 12;
      if (origComRaw.timestamp) {
        try {
          hourOfDay = new Date(origComRaw.timestamp).getHours();
        } catch(e) {}
      }

      allQuestionsData.push({
        id: questionId,
        year: parentName,
        isPostCutoff,
        complexity_estimated: complexityEst,
        area: origComData.area || "Linguagens",
        generatorModel: genModelCom,
        hourOfDay,
        latencies_control: latenciesSem,
        latencies_experimental: latenciesCom,
        char_count_control: charsSem,
        char_count_experimental: charsCom,
        scores_control: {
          grupo_a: avgScoreSem("grupo_a"),
          grupo_b: avgScoreSem("grupo_b"),
          grupo_c: avgScoreSem("grupo_c"),
          grupo_d: avgScoreSem("grupo_d"),
          grupo_e: avgScoreSem("grupo_e"),
          total: semTotals
        },
        scores_experimental: {
          grupo_a: avgScore("grupo_a"),
          grupo_b: avgScore("grupo_b"),
          grupo_c: avgScore("grupo_c"),
          grupo_d: avgScore("grupo_d"),
          grupo_e: avgScore("grupo_e"),
          total: comTotals
        },
        criterios_control: criteriosSemMerged,
        criterios_experimental: criteriosComMerged,
        raw_evaluations: {
          control: semScores.map(s => ({ judge: s.model, total: s.pontuacao_total })),
          experimental: comScores.map(s => ({ judge: s.model, total: s.pontuacao_total }))
        }
      });

    } catch (e) {
      errors.push(`[${questionId}] Falha ao processar arquivos JSON: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`\n⚠️ RELATÓRIO DE INCOERÊNCIAS E ERROS (${errors.length}):`);
    errors.forEach(err => console.warn(`- ${err}`));
  } else {
    console.log(`\n✅ Sucesso: Nenhuma incoerência nos arquivos do crossover!`);
  }

  if (allQuestionsData.length === 0) {
    console.error("Nenhum dado válido pôde ser extraído.");
    process.exit(1);
  }

  // 1. Estatísticas Gerais e Wilcoxon
  const statsSummary = {
    n_total: allQuestionsData.length,
    metrics: {}
  };

  const keys = ["grupo_a", "grupo_b", "grupo_c", "grupo_d", "grupo_e", "total", "latency"];
  const arrays = {};
  keys.forEach(k => {
    arrays[k] = { control: [], experimental: [] };
  });
  const iepArray = [];

  for (const q of allQuestionsData) {
    keys.forEach(k => {
      if (k === "latency") {
        arrays[k].control.push(q.latencies_control.total_ms / 1000);
        arrays[k].experimental.push(q.latencies_experimental.total_ms / 1000);
      } else {
        arrays[k].control.push(q.scores_control[k]);
        arrays[k].experimental.push(q.scores_experimental[k]);
      }
    });

    const deltaTotal = q.scores_experimental.total - q.scores_control.total;
    const iepValue = q.latencies_experimental.total_ms > 0 ? deltaTotal / (q.latencies_experimental.total_ms / 1000) : 0;
    iepArray.push(iepValue);
  }

  const metricMetadata = [
    { key: "latency", label: "Latência (s)", ctrlArr: arrays.latency.control, expArr: arrays.latency.experimental },
    { key: "grupo_a", label: "Grupo A - Estrutura e Estética Básica (Máx: 7)", ctrlArr: arrays.grupo_a.control, expArr: arrays.grupo_a.experimental },
    { key: "grupo_b", label: "Grupo B - Ancoragem Factual e Interpretação (Máx: 14)", ctrlArr: arrays.grupo_b.control, expArr: arrays.grupo_b.experimental },
    { key: "grupo_c", label: "Grupo C - Pedagogia e Transposição Cognitiva (Máx: 21)", ctrlArr: arrays.grupo_c.control, expArr: arrays.grupo_c.experimental },
    { key: "grupo_d", label: "Grupo D - Lógica Dedutiva e Eliminação (Máx: 28)", ctrlArr: arrays.grupo_d.control, expArr: arrays.grupo_d.experimental },
    { key: "grupo_e", label: "Grupo E - Engenharia da Resolução e Interfaces (Máx: 30)", ctrlArr: arrays.grupo_e.control, expArr: arrays.grupo_e.experimental },
    { key: "total", label: "Pontuação Total do Juiz (Máx: 100)", ctrlArr: arrays.total.control, expArr: arrays.total.experimental }
  ];

  for (const m of metricMetadata) {
    const meanCtrl = getMean(m.ctrlArr);
    const sdCtrl = getStdDev(m.ctrlArr, meanCtrl);
    const meanExp = getMean(m.expArr);
    const sdExp = getStdDev(m.expArr, meanExp);

    let wilcoxonRes = { pValue: null, statistic: null, rejected: false };
    try {
      wilcoxonRes = calcularWilcoxonPareado(m.ctrlArr, m.expArr);
    } catch (e) {
      console.error(`Erro Wilcoxon para ${m.label}:`, e.message);
    }

    statsSummary.metrics[m.key] = {
      label: m.label,
      control: { mean: meanCtrl, stdDev: sdCtrl },
      experimental: { mean: meanExp, stdDev: sdExp },
      wilcoxon: {
        pValue: wilcoxonRes.pValue,
        statistic: wilcoxonRes.statistic,
        significant: wilcoxonRes.pValue !== null && wilcoxonRes.pValue < 0.05
      }
    };
  }

  statsSummary.metrics["iep"] = {
    label: "Índice de Eficiência de Processamento (IEP)",
    experimental: { mean: getMean(iepArray), stdDev: getStdDev(iepArray, getMean(iepArray)) }
  };

  // 2. Análise Cutoff
  const preCutoffQuestions = allQuestionsData.filter(q => !q.isPostCutoff);
  const postCutoffQuestions = allQuestionsData.filter(q => q.isPostCutoff);

  const compileCutoffStats = (subQuestions) => {
    const ctrlScores = subQuestions.map(q => q.scores_control.total);
    const expScores = subQuestions.map(q => q.scores_experimental.total);
    const ctrlMean = getMean(ctrlScores);
    const expMean = getMean(expScores);
    let wilc = { pValue: null, statistic: null, significant: false };
    try {
      if (subQuestions.length >= 3) {
        const res = calcularWilcoxonPareado(ctrlScores, expScores);
        wilc = { pValue: res.pValue, statistic: res.statistic, significant: res.pValue < 0.05 };
      }
    } catch(e) {}
    
    return {
      n: subQuestions.length,
      control: { mean: ctrlMean, stdDev: getStdDev(ctrlScores, ctrlMean) },
      experimental: { mean: expMean, stdDev: getStdDev(expScores, expMean) },
      wilcoxon: wilc
    };
  };

  statsSummary.cutoff_analysis = {
    pre_cutoff: compileCutoffStats(preCutoffQuestions),
    post_cutoff: compileCutoffStats(postCutoffQuestions)
  };

  // 3. Análise por Modelo de IA (Confronto)
  const models = ["gemini-3.5-flash", "gemma-4-31b-it", "gpt-oss-120b"];
  statsSummary.model_confrontation = {};

  for (const model of models) {
    const modelQuestions = allQuestionsData.filter(q => q.generatorModel === model);
    const ctrlScores = modelQuestions.map(q => q.scores_control.total);
    const expScores = modelQuestions.map(q => q.scores_experimental.total);
    const ctrlLat = modelQuestions.map(q => q.latencies_control.total_ms / 1000);
    const expLat = modelQuestions.map(q => q.latencies_experimental.total_ms / 1000);

    const meanCtrl = getMean(ctrlScores);
    const meanExp = getMean(expScores);

    statsSummary.model_confrontation[model] = {
      n: modelQuestions.length,
      scores: {
        control: meanCtrl,
        experimental: meanExp,
        delta: meanExp - meanCtrl
      },
      latency: {
        control: getMean(ctrlLat),
        experimental: getMean(expLat)
      }
    };
  }

  // 4. Teste Kruskal-Wallis (Diferenças de notas entre os 3 modelos)
  const kwGroups = models.map(m => 
    allQuestionsData.filter(q => q.generatorModel === m).map(q => q.scores_experimental.total)
  );
  statsSummary.kruskal_wallis = calcularKruskalWallis(kwGroups);

  // 5. Fleiss' Kappa (Inter-rater reliability)
  let sumAgree = 0;
  agreementRatings.forEach(item => {
    if (item.rater1 === item.rater2) sumAgree++;
  });
  const pObserved = sumAgree / agreementRatings.length;
  const countTrue = agreementRatings.reduce((sum, item) => sum + item.rater1 + item.rater2, 0);
  const totalRatings = agreementRatings.length * 2;
  const p1 = countTrue / totalRatings;
  const p0 = 1 - p1;
  const pExpected = p1 * p1 + p0 * p0;
  const fleissKappaVal = (pObserved - pExpected) / (1 - pExpected);

  statsSummary.inter_rater_agreement = {
    percent_agreement: pObserved,
    expected_agreement: pExpected,
    fleiss_kappa: fleissKappaVal
  };

  // 6. Regressão Linear Simples (Tempo vs. Ganho)
  const regLatencies = allQuestionsData.map(q => q.latencies_experimental.total_ms / 1000);
  const regGains = allQuestionsData.map(q => q.scores_experimental.total - q.scores_control.total);
  statsSummary.linear_regression = calcularRegressaoLinear(regLatencies, regGains);

  // 7. Correlação de Spearman entre Grupos de Notas (Grupo A vs. Grupo C, etc.)
  const groupsList = ["grupo_a", "grupo_b", "grupo_c", "grupo_d", "grupo_e"];
  statsSummary.spearman_matrix = {};
  for (const g1 of groupsList) {
    statsSummary.spearman_matrix[g1] = {};
    for (const g2 of groupsList) {
      if (g1 === g2) {
        statsSummary.spearman_matrix[g1][g2] = 1.0;
      } else {
        const v1 = allQuestionsData.map(q => q.scores_experimental[g1]);
        const v2 = allQuestionsData.map(q => q.scores_experimental[g2]);
        statsSummary.spearman_matrix[g1][g2] = calcularSpearman(v1, v2) || 0;
      }
    }
  }

  // 8. K-Means Clustering (3 clusters de questões por Latência vs. Nota)
  const clusterPoints = allQuestionsData.map(q => ({
    x: q.latencies_experimental.total_ms / 1000,
    y: q.scores_experimental.total,
    id: q.id
  }));
  statsSummary.kmeans_clusters = calcularKMeans(clusterPoints, 3).map(c => ({
    id: c.id,
    centroid: c.centroid,
    points_count: c.points.length,
    points: c.points.map(p => p.id)
  }));

  // Spearman IEP vs. Complexidade
  const complexityList = allQuestionsData.map(q => q.complexity_estimated);
  statsSummary.iep_complexity_correlation = {
    spearman: calcularSpearman(iepArray, complexityList) || 0,
    description: "Correlação de Spearman entre o IEP (Pontos Ganhos/s) e a Complexidade Estimada da Questão (Appendix B)."
  };

  // Salvar detalhes individuais
  statsSummary.questions = allQuestionsData;
  statsSummary.errors = errors;

  fs.writeFileSync(outputFile, JSON.stringify(statsSummary, null, 2), "utf-8");
  console.log(`\n✅ Relatório estatístico avançado e unificado salvo em: ${outputFile}`);
}

run();
