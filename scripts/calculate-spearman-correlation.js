import fs from "fs";
import path from "path";
import { calcularSpearman } from "../js/utils/statistics-helper.js";

// Lógica de cálculo de complexidade copiada de ComplexityCard.tsx para independência de execução
const FATORES_DEF = [
  // Suporte e Leitura
  { key: "texto_extenso", peso: 2, cat: "leitura" },
  { key: "vocabulario_complexo", peso: 2, cat: "leitura" },
  { key: "multiplas_fontes_leitura", peso: 3, cat: "leitura" },
  { key: "interpretacao_visual", peso: 3, cat: "leitura" },
  // Conhecimento Prévio
  { key: "dependencia_conteudo_externo", peso: 3, cat: "conhecimento" },
  { key: "conteudo_nicho", peso: 4, cat: "conhecimento" },
  { key: "transicao_linguagem", peso: 2, cat: "conhecimento" },
  // Raciocínio
  { key: "abstracao_conceitual", peso: 3, cat: "raciocinio" },
  { key: "etapas_resolucao", peso: 4, cat: "raciocinio" },
  { key: "distratores_fortes", peso: 2, cat: "raciocinio" },
  // Operacional
  { key: "algebra_intensa", peso: 2, cat: "operacional" },
  { key: "tabelamento_dados", peso: 2, cat: "operacional" },
];

function calcularComplexidadePct(analise) {
  if (!analise || !analise.fatores) return 0;
  const f = analise.fatores;
  let somaPesos = 0;
  
  FATORES_DEF.forEach((item) => {
    const camelKey = item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const val = !!(f[item.key] || f[camelKey]);
    if (val) {
      somaPesos += item.peso;
    }
  });

  const DENOMINADOR = 30;
  const score = Math.min(1, somaPesos / DENOMINADOR);
  return Math.round(score * 100);
}

// Carregar variáveis do .env manualmente
function loadEnv() {
  const envPath = ".env";
  if (!fs.existsSync(envPath)) {
    throw new Error("Arquivo .env não encontrado no diretório raiz.");
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  content.split("\n").forEach(line => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      env[key] = val;
    }
  });
  return env;
}

async function run() {
  const outputDir = "./experiments";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const difficultiesPath = path.join(outputDir, "real_difficulties.json");

  let env;
  try {
    env = loadEnv();
  } catch (e) {
    console.error("❌ Falha ao carregar credenciais do .env:", e.message);
    process.exit(1);
  }

  const apiKey = env.FIREBASE_API_KEY;
  const projectId = env.FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.error("❌ Erro: FIREBASE_API_KEY ou FIREBASE_PROJECT_ID não definidos no .env.");
    process.exit(1);
  }

  console.log("🔑 Autenticando anonimamente no Firebase Auth...");
  let idToken = null;
  try {
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    const authRes = await fetch(authUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Referer": "https://projeto-cientifico-47301.firebaseapp.com/"
      },
      body: JSON.stringify({ returnSecureToken: true })
    });
    
    if (!authRes.ok) {
      throw new Error(`HTTP ${authRes.status}`);
    }
    const authData = await authRes.json();
    idToken = authData.idToken;
    console.log("✅ Autenticado com sucesso!");
  } catch (err) {
    console.error("❌ Erro na autenticação anônima:", err.message);
    process.exit(1);
  }

  console.log("🌐 Buscando questões do banco de dados Firebase Realtime...");
  let questoesDb = null;
  try {
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/questoes.json?auth=${idToken}`;
    const response = await fetch(databaseURL, {
      headers: {
        "Referer": "https://projeto-cientifico-47301.firebaseapp.com/"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    questoesDb = await response.json();
  } catch (err) {
    console.error("❌ Falha ao buscar banco de dados:", err.message);
    process.exit(1);
  }

  if (!questoesDb) {
    console.log("Banco de dados vazio ou nenhuma questão encontrada.");
    process.exit(0);
  }

  // Aplanar a árvore de questões: questoes -> PROVA_X -> Q1, Q2...
  const totalQuestoes = [];
  Object.entries(questoesDb).forEach(([provaKey, mapQuestoes]) => {
    if (mapQuestoes && typeof mapQuestoes === "object") {
      Object.entries(mapQuestoes).forEach(([questaoKey, fullData]) => {
        const aiComplexity = calcularComplexidadePct(fullData.analise_complexidade || fullData.gabarito?.analise_complexidade);
        
        totalQuestoes.push({
          id: `${provaKey}_${questaoKey}`,
          vestibular: fullData.vestibular || provaKey,
          ano: fullData.ano || "N/A",
          enunciado_preview: (fullData.texto || "").slice(0, 80).replace(/\n/g, " ") + "...",
          ai_complexity_pct: aiComplexity,
        });
      });
    }
  });

  console.log(`✅ Sucesso! Encontradas ${totalQuestoes.length} questões no banco.`);

  // Caso 1: Arquivo de dificuldades reais não existe. Vamos criá-lo como template.
  if (!fs.existsSync(difficultiesPath)) {
    const template = {};
    totalQuestoes.forEach((q) => {
      template[q.id] = {
        vestibular: q.vestibular,
        ano: q.ano,
        enunciado_preview: q.enunciado_preview,
        ai_complexity_pct: q.ai_complexity_pct,
        real_difficulty_pct_or_score: 0.0, // Preenchido pelo usuário
        observacoes: "Adicione a taxa real de acerto (ex: 0.45 para 45%) ou parâmetro de dificuldade da TRI da banca."
      };
    });

    fs.writeFileSync(difficultiesPath, JSON.stringify(template, null, 2), "utf-8");
    console.log(`\n✨ Criado template de dificuldades reais em: ${difficultiesPath}`);
    console.log("👉 Por favor, abra esse arquivo JSON e insira os dados de dificuldade real da banca para cada questão.");
    console.log("Depois que preencher, execute este script novamente para rodar o cálculo de correlação de Spearman.");
    process.exit(0);
  }

  // Caso 2: Arquivo já existe. Vamos cruzar dados e calcular a Correlação de Spearman.
  console.log(`\n📖 Lendo dados de dificuldade real em: ${difficultiesPath}`);
  let realData = {};
  try {
    realData = JSON.parse(fs.readFileSync(difficultiesPath, "utf-8"));
  } catch (e) {
    console.error("❌ Falha ao ler real_difficulties.json:", e.message);
    process.exit(1);
  }

  const aiScores = [];
  const realScores = [];
  const matchedList = [];

  totalQuestoes.forEach((q) => {
    const realEntry = realData[q.id];
    if (realEntry && realEntry.real_difficulty_pct_or_score !== 0.0) {
      aiScores.push(q.ai_complexity_pct);
      realScores.push(realEntry.real_difficulty_pct_or_score);
      matchedList.push({
        id: q.id,
        ai: q.ai_complexity_pct,
        real: realEntry.real_difficulty_pct_or_score
      });
    }
  });

  console.log(`- Questões cruzadas com dados reais válidos: ${matchedList.length}`);

  if (matchedList.length < 3) {
    console.warn("⚠️ Quantidade insuficiente de dados reais preenchidos (mínimo 3).");
    console.warn("Certifique-se de alterar 'real_difficulty_pct_or_score' para valores diferentes de 0.0 no JSON.");
    process.exit(0);
  }

  // Rodar Spearman
  const rho = calcularSpearman(aiScores, realScores);
  
  // Interpretação
  let interpretacao = "";
  const absRho = Math.abs(rho);
  if (absRho < 0.2) interpretacao = "Correlação muito fraca ou inexistente";
  else if (absRho < 0.4) interpretacao = "Correlação fraca";
  else if (absRho < 0.6) interpretacao = "Correlação moderada";
  else if (absRho < 0.8) interpretacao = "Correlação forte";
  else interpretacao = "Correlação muito forte / excelente";

  const sentido = rho < 0 
    ? "Inversa (esperada caso a métrica real seja Taxa de Acerto/Facilidade: maior complexidade da IA correlaciona com menos acertos humanos)"
    : "Direta (esperada caso a métrica real seja Dificuldade/Parâmetro da TRI: maior complexidade da IA correlaciona com maior dificuldade real)";

  let report = `# Relatório de Validação de Complexidade (Spearman)\n\n`;
  report += `**Data da Análise:** ${new Date().toLocaleString("pt-BR")}\n`;
  report += `**Amostra Cruzada (N):** ${matchedList.length} questões\n\n`;
  
  report += `## Coeficiente de Spearman\n\n`;
  report += `O Coeficiente de Correlação de Postos de Spearman ($\\rho$) mede a relação monotônica entre a complexidade calculada heuristicamente pela IA (0 a 100%) e os dados reais de acerto/dificuldade reportados pelas bancas:\n\n`;
  report += `$$\\rho = ${rho.toFixed(4)}$$\n\n`;
  report += `- **Grau de Associação:** **${interpretacao}**\n`;
  report += `- **Direção:** ${sentido}\n\n`;

  report += `## Tabela de Dados Cruzados\n\n`;
  report += `| ID da Questão | Complexidade IA (%) | Dificuldade Real (Banca) |\n`;
  report += `| :--- | :---: | :---: |\n`;
  for (const item of matchedList) {
    report += `| \`${item.id}\` | ${item.ai}% | ${item.real} |\n`;
  }

  const reportPath = path.join(outputDir, "relatorio_spearman.md");
  fs.writeFileSync(reportPath, report, "utf-8");

  console.log(`\n✅ Relatório Spearman gerado com sucesso em: ${reportPath}`);
  console.log("\nVisualização do Relatório:\n");
  console.log(report);
}

run();
