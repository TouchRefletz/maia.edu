import fs from "fs";
import path from "path";
import {
  calcularWilcoxonPareado,
  calcularIEP,
} from "../js/utils/statistics-helper.js";

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

function normalizePrompt(prompt) {
  if (!prompt) return "";
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 100);
}

function formatResult(val) {
  return typeof val === "number" ? val.toFixed(3) : "N/A";
}

function getEvaluationData(avaliacaoJuiz, modelSelector = "average") {
  if (
    !avaliacaoJuiz ||
    typeof avaliacaoJuiz !== "object" ||
    avaliacaoJuiz.error
  ) {
    return null;
  }

  // Se for o formato antigo (direto com critérios)
  if (avaliacaoJuiz.criterios) {
    // Normaliza notas_grupo se for legado
    if (!avaliacaoJuiz.notas_grupo) {
      avaliacaoJuiz.notas_grupo = {
        grupo_a: avaliacaoJuiz.criterios.grupo_a?.nota || avaliacaoJuiz.criterios.precisao?.nota || 0,
        grupo_b: avaliacaoJuiz.criterios.grupo_b?.nota || avaliacaoJuiz.criterios.rigor_teorico?.nota || 0,
        grupo_c: avaliacaoJuiz.criterios.grupo_c?.nota || avaliacaoJuiz.criterios.coesao_logica?.nota || 0,
        grupo_d: avaliacaoJuiz.criterios.grupo_d?.nota || avaliacaoJuiz.criterios.refutacao_distratores?.nota || 0,
        grupo_e: avaliacaoJuiz.criterios.grupo_e?.nota || avaliacaoJuiz.criterios.ancoragem_factual?.nota || 0,
        grupo_f: avaliacaoJuiz.criterios.grupo_f?.nota || avaliacaoJuiz.criterios.integracao_interdisciplinar?.nota || 0,
      };
    }
    return avaliacaoJuiz;
  }

  // Se for o formato novo (dicionário de modelos)
  const models = Object.keys(avaliacaoJuiz).filter(
    (k) => k !== "error" && typeof avaliacaoJuiz[k] === "object",
  );
  if (models.length === 0) return null;

  // Se o usuário especificou um modelo e ele está presente
  if (modelSelector !== "average" && avaliacaoJuiz[modelSelector]) {
    const data = avaliacaoJuiz[modelSelector];
    if (data && !data.notas_grupo && data.criterios) {
      data.notas_grupo = {
        grupo_a: data.criterios.grupo_a?.nota || data.criterios.precisao?.nota || 0,
        grupo_b: data.criterios.grupo_b?.nota || data.criterios.rigor_teorico?.nota || 0,
        grupo_c: data.criterios.grupo_c?.nota || data.criterios.coesao_logica?.nota || 0,
        grupo_d: data.criterios.grupo_d?.nota || data.criterios.refutacao_distratores?.nota || 0,
        grupo_e: data.criterios.grupo_e?.nota || data.criterios.ancoragem_factual?.nota || 0,
        grupo_f: data.criterios.grupo_f?.nota || data.criterios.integracao_interdisciplinar?.nota || 0,
      };
    }
    return data;
  }

  // Caso contrário, fazemos a média de todos os modelos avaliados para esta questão (Avaliação Cruzada!)
  const selectedModels = modelSelector === "average" ? models : [models[0]]; // fallback pro primeiro se o especificado não existir

  const merged = {
    criterios: {},
    pontuacao_total: 0,
    comentario_geral: `Média consolidada dos juízes: ${selectedModels.join(", ")}`,
  };

  const keys = [
    "grupo_a",
    "grupo_b",
    "grupo_c",
    "grupo_d",
    "grupo_e",
    "grupo_f",
  ];
  let validModelsCount = 0;

  for (const modelKey of selectedModels) {
    const evalData = avaliacaoJuiz[modelKey];
    if (!evalData) continue;
    
    // Se for legado, simula notas_grupo
    if (!evalData.notas_grupo && evalData.criterios) {
      evalData.notas_grupo = {
        grupo_a: evalData.criterios.grupo_a?.nota || evalData.criterios.precisao?.nota || 0,
        grupo_b: evalData.criterios.grupo_b?.nota || evalData.criterios.rigor_teorico?.nota || 0,
        grupo_c: evalData.criterios.grupo_c?.nota || evalData.criterios.coesao_logica?.nota || 0,
        grupo_d: evalData.criterios.grupo_d?.nota || evalData.criterios.refutacao_distratores?.nota || 0,
        grupo_e: evalData.criterios.grupo_e?.nota || evalData.criterios.ancoragem_factual?.nota || 0,
        grupo_f: evalData.criterios.grupo_f?.nota || evalData.criterios.integracao_interdisciplinar?.nota || 0,
      };
    }
    
    if (!evalData.notas_grupo) continue;
    validModelsCount++;

    for (const key of keys) {
      const val = evalData.notas_grupo[key];
      if (typeof val === "number") {
        if (!merged.criterios[key]) {
          merged.criterios[key] = { notaSum: 0, count: 0, justificativas: [] };
        }
        merged.criterios[key].notaSum += val;
        merged.criterios[key].count++;
      }
    }
    merged.pontuacao_total += evalData.pontuacao_total || 0;
  }

  if (validModelsCount === 0) return null;

  // Finaliza as médias
  for (const key of Object.keys(merged.criterios)) {
    const c = merged.criterios[key];
    merged.criterios[key] = {
      nota: c.notaSum / c.count,
      justificativa: "Média dos juízes",
    };
  }

  merged.pontuacao_total = merged.pontuacao_total / validModelsCount;
  return merged;
}

async function run() {
  const args = process.argv.slice(2);
  let modelArg = "average"; // padrão (avaliação cruzada consolidada)
  let targetDir = "./experiments";

  args.forEach((arg) => {
    if (arg.startsWith("--model=")) {
      modelArg = arg.split("=")[1].toLowerCase().replace(/-/g, "_");
    } else if (arg.startsWith("-m=")) {
      modelArg = arg.split("=")[1].toLowerCase().replace(/-/g, "_");
    } else if (!arg.startsWith("-")) {
      targetDir = arg;
    }
  });

  if (!fs.existsSync(targetDir)) {
    console.error(`Erro: O diretório '${targetDir}' não existe.`);
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("Nenhum arquivo JSON de debug encontrado.");
    process.exit(0);
  }

  const logs = [];
  const ungradeds = [];

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const evalData = getEvaluationData(data.avaliacao_juiz, modelArg);
      if (!evalData) {
        ungradeds.push(file);
      }
      logs.push({ file, data });
    } catch (e) {
      console.warn(`⚠️ Falha ao ler ${file}:`, e.message);
    }
  }

  if (ungradeds.length > 0) {
    console.warn(
      `⚠️ ATENÇÃO: Encontrados ${ungradeds.length} arquivos sem avaliação do juiz ativo (${modelArg}).`,
    );
    console.warn(
      "Recomendamos rodar o avaliador com a API correspondente antes.",
    );
    console.warn(
      "Os critérios Likert para estes arquivos serão desconsiderados.",
    );
  }

  // Agrupar logs por enunciado normalizado
  const groups = {};
  for (const log of logs) {
    const key = normalizePrompt(log.data.prompt_original);
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  }

  // Montar pares (Grupo I vs Grupo II)
  const pairs = [];
  let isolatedCount = 0;

  for (const key of Object.keys(groups)) {
    const logGroup = groups[key];
    const groupI = logGroup.find((l) => !l.data.use_maia_architecture);
    const groupII = logGroup.find((l) => l.data.use_maia_architecture);

    if (groupI && groupII) {
      pairs.push({
        prompt: groupI.data.prompt_original,
        control: groupI,
        experimental: groupII,
      });
    } else {
      isolatedCount += logGroup.length;
    }
  }

  console.log(`\n📊 Consolidando estatísticas com o juiz: ${modelArg}`);
  console.log(`- Total de arquivos: ${logs.length}`);
  console.log(`- Pares válidos (Controle vs Experimental): ${pairs.length}`);
  console.log(`- Arquivos isolados (não pareados): ${isolatedCount}`);

  if (pairs.length === 0) {
    console.error(
      "Erro: Nenhum par de execução correspondente (mesmo prompt, com e sem arquitetura) foi encontrado.",
    );
    process.exit(1);
  }

  // Inicializar metadados dos novos critérios por grupo
  const criteriaMetadata = [
    { key: "grupo_a", label: "Grupo A - Estrutura e Estética Básica (Máx: 7)", arrayControl: [], arrayExperimental: [] },
    { key: "grupo_b", label: "Grupo B - Ancoragem Factual e Interpretação (Máx: 14)", arrayControl: [], arrayExperimental: [] },
    { key: "grupo_c", label: "Grupo C - Pedagogia e Transposição Cognitiva (Máx: 21)", arrayControl: [], arrayExperimental: [] },
    { key: "grupo_d", label: "Grupo D - Lógica Dedutiva e Eliminação (Máx: 28)", arrayControl: [], arrayExperimental: [] },
    { key: "grupo_e", label: "Grupo E - Engenharia da Resolução e Interfaces (Máx: 30)", arrayControl: [], arrayExperimental: [] },
  ];

  // Outros vetores de suporte
  const latencyI = []; // controle
  const latencyII = []; // experimental
  const totalI = [];
  const totalII = [];
  const iepI = [];
  const iepII = [];
  const interdisciplinarI = [];
  const interdisciplinarII = [];

  // Preencher vetores
  for (const pair of pairs) {
    const ctrl = pair.control.data;
    const exp = pair.experimental.data;

    // Latência em segundos
    const latI = (ctrl.latency_ms || 0) / 1000;
    const latII = (exp.latency_ms || 0) / 1000;

    latencyI.push(latI);
    latencyII.push(latII);

    // Se tiver avaliação Likert
    const ctrlEval = getEvaluationData(ctrl.avaliacao_juiz, modelArg);
    const expEval = getEvaluationData(exp.avaliacao_juiz, modelArg);

    if (ctrlEval?.criterios && expEval?.criterios) {
      const cJuiz = ctrlEval.criterios;
      const eJuiz = expEval.criterios;

      // Popula dinamicamente os novos critérios
      for (const item of criteriaMetadata) {
        item.arrayControl.push(cJuiz[item.key]?.nota || 0);
        item.arrayExperimental.push(eJuiz[item.key]?.nota || 0);
      }

      const totI = ctrlEval.pontuacao_total || 0;
      const totII = expEval.pontuacao_total || 0;

      totalI.push(totI);
      totalII.push(totII);

      // IEP = Delta de desempenho / latência total do grupo experimental em segundos
      const deltaPontuacao = totII - totI;
      iepI.push(0); // O grupo de controle serve como linha de base (zero ganho por segundo)
      iepII.push(latII > 0 ? deltaPontuacao / latII : 0);

      // Critério Interdisciplinar
      if (
        cJuiz.grupo_f &&
        eJuiz.grupo_f
      ) {
        interdisciplinarI.push(cJuiz.grupo_f.nota);
        interdisciplinarII.push(eJuiz.grupo_f.nota);
      }
    }
  }

  // Função interna para testar e organizar a saída de cada métrica
  function testarMetrica(nome, arrI, arrII) {
    if (arrI.length === 0) return null;
    const meanI = getMean(arrI);
    const meanII = getMean(arrII);
    const sdI = getStdDev(arrI, meanI);
    const sdII = getStdDev(arrII, meanII);

    let testResult = { pValue: null, statistic: null, rejected: false };
    try {
      testResult = calcularWilcoxonPareado(arrI, arrII);
    } catch (e) {
      testResult = {
        error: e.message,
        pValue: null,
        statistic: null,
        rejected: false,
      };
    }

    return {
      nome,
      meanI,
      sdI,
      meanII,
      sdII,
      pValue: testResult.pValue,
      statistic: testResult.statistic,
      significant: testResult.pValue !== null && testResult.pValue < 0.05,
    };
  }

  const resultados = [
    testarMetrica("Latência (s)", latencyI, latencyII),
    ...criteriaMetadata.map(c => testarMetrica(c.label, c.arrayControl, c.arrayExperimental)),
    testarMetrica("Pontuação Total do Juiz", totalI, totalII),
    testarMetrica("Índice de Eficiência de Processamento (IEP)", iepI, iepII),
    testarMetrica(
      "Integração Interdisciplinar (FUVEST)",
      interdisciplinarI,
      interdisciplinarII,
    ),
  ].filter(Boolean);

  // Gerar o Relatório Final em Markdown
  let report = `# Relatório Estatístico Consolidado: Experimento Maia.edu\n\n`;
  report += `**Data da Análise:** ${new Date().toLocaleString("pt-BR")}\n`;
  report += `**Diretório de Origem:** \`${targetDir}\`\n`;
  report += `**Número de Pares Pareados (N):** ${pairs.length}\n\n`;

  report += `## Resumo das Métricas Comparativas\n\n`;
  report += `A tabela abaixo exibe a Média ($\\mu$) e Desvio Padrão ($\\sigma$) de cada grupo, junto com os resultados do **Teste de Postos Sinalizados de Wilcoxon** (teste pareado não-paramétrico).\n\n`;
  report += `| Métrica | Grupo I (Controle) | Grupo II (Experimental) | Estatística W | p-value | Significativo? ($\\alpha=5\\%$) |\n`;
  report += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const res of resultados) {
    const gI = `${res.meanI.toFixed(2)} ± ${res.sdI.toFixed(2)}`;
    const gII = `${res.meanII.toFixed(2)} ± ${res.sdII.toFixed(2)}`;
    const sig = res.significant ? "✅ Sim" : "❌ Não";
    report += `| **${res.nome}** | ${gI} | ${gII} | ${res.statistic ?? "N/A"} | ${formatResult(res.pValue)} | ${sig} |\n`;
  }

  report += `\n*Nota: Um p-value < 0.05 indica rejeição da hipótese nula ($H_0$), confirmando diferença estatisticamente significativa entre as abordagens.*\n\n`;

  report += `## Discussão dos Resultados Científicos\n\n`;

  // Análise automática simples baseada nos números obtidos
  const latRes = resultados.find((r) => r.nome === "Latência (s)");
  if (latRes) {
    if (latRes.meanII > latRes.meanI) {
      report += `- **Custo Temporal**: A Maia.edu (Grupo II) apresentou latência média superior (**${latRes.meanII.toFixed(1)}s**) em relação ao modelo puro (**${latRes.meanI.toFixed(1)}s**), o que é explicado pelas etapas adicionais de roteamento, consulta vetorial ao Pinecone, pesquisa na internet e injeção contextual. `;
      if (latRes.significant) {
        report += `Essa diferença é estatisticamente significativa ($p = ${formatResult(latRes.pValue)}$).\n`;
      } else {
        report += `No entanto, a diferença não é estatisticamente significativa neste tamanho amostral ($p = ${formatResult(latRes.pValue)}$).\n`;
      }
    } else {
      report += `- **Custo Temporal**: Curiosamente, a latência média da Maia.edu foi menor ou equivalente à do controle (${latRes.meanII.toFixed(1)}s vs ${latRes.meanI.toFixed(1)}s).\n`;
    }
  }

  const totRes = resultados.find((r) => r.nome === "Pontuação Total do Juiz");
  if (totRes) {
    if (totRes.meanII > totRes.meanI) {
      report += `- **Desempenho e Acurácia**: O Grupo II (com arquitetura) obteve nota média significativamente maior no juiz LLM (**${totRes.meanII.toFixed(1)}** contra **${totRes.meanI.toFixed(1)}** do controle). `;
      if (totRes.significant) {
        report += `O teste de Wilcoxon confirmou que a melhoria é estatisticamente representativa ($p = ${formatResult(totRes.pValue)}$).\n`;
      } else {
        report += `Esta melhoria indica tendência positiva, mas sem significância estatística absoluta ($p = ${formatResult(totRes.pValue)}$).\n`;
      }
    } else {
      report += `- **Desempenho e Acurácia**: Não houve aumento nas pontuações de acurácia média com a arquitetura ativa (${totRes.meanII.toFixed(1)} vs ${totRes.meanI.toFixed(1)}).\n`;
    }
  }

  const iepRes = resultados.find(
    (r) => r.nome === "Índice de Eficiência de Processamento (IEP)",
  );
  if (iepRes) {
    report += `- **Eficiência Geral (IEP)**: O IEP (desempenho pontuado por segundo de latência) ficou em **${iepRes.meanII.toFixed(2)} pts/s** para a Maia.edu e **${iepRes.meanI.toFixed(2)} pts/s** para o controle. `;
    if (iepRes.significant) {
      report += `Essa eficiência apresenta diferença estatisticamente significativa ($p = ${formatResult(iepRes.pValue)}$), refletindo o trade-off entre tempo de processamento e qualidade da resposta.\n`;
    } else {
      report += `Essa variação de eficiência não apresentou significância estatística conclusiva ($p = ${formatResult(iepRes.pValue)}$).\n`;
    }
  }

  const reportPath = path.join(targetDir, "relatorio_estatistico.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`\n✅ Relatório gerado com sucesso em: ${reportPath}`);
  console.log("\nVisualização do Relatório:\n");
  console.log(report);
}

run();
