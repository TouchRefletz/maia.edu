import fs from "fs";
import path from "path";
import readline from "readline";
import { getJudgeSystemPrompt, getJudgeResponseSchema, buildJudgePrompt, JUDGE_RESPONSE_SCHEMA, processarAvaliacaoJuiz } from "../js/chat/prompts/judge-prompt.js";

// Helper para ler entrada do console se a chave API não estiver no env
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

// Normaliza strings para agrupamento
function normalizePrompt(prompt) {
  if (!prompt) return "";
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 100);
}

// Conversor de esquema OpenAPI/Gemini para JSON Schema padrão (usado no OpenAI/o1)
function convertToStandardJsonSchema(schema) {
  const mapType = (t) => {
    if (t === "INTEGER") return "integer";
    if (t === "STRING") return "string";
    if (t === "OBJECT") return "object";
    return t.toLowerCase();
  };

  const convert = (node) => {
    const res = { type: mapType(node.type) };
    if (node.properties) {
      res.properties = {};
      for (const k of Object.keys(node.properties)) {
        res.properties[k] = convert(node.properties[k]);
      }
    }
    if (node.required) {
      res.required = node.required;
    }
    res.additionalProperties = false;
    return res;
  };

  return convert(schema);
}

async function run() {
  const args = process.argv.slice(2);
  let modelArg = "all"; // padrão avalia em todos os três juízes sequentially (avaliação cruzada)
  let targetDir = "./experiments";

  args.forEach(arg => {
    if (arg.startsWith("--model=")) {
      modelArg = arg.split("=")[1].toLowerCase();
    } else if (arg.startsWith("-m=")) {
      modelArg = arg.split("=")[1].toLowerCase();
    } else if (!arg.startsWith("-")) {
      targetDir = arg;
    }
  });

  if (!fs.existsSync(targetDir)) {
    console.error(`Erro: O diretório '${targetDir}' não existe.`);
    process.exit(1);
  }

  // Identifica quais juízes rodar
  const activeJudges = modelArg === "all" ? ["gemini", "gemma", "o1"] : [modelArg];

  // Configurações de chaves e variáveis de API
  const apiKeys = {
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
    gemma: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
    o1: process.env.OPENAI_API_KEY || process.env.GITHUB_PAT_KEY
  };

  // Solicita credenciais faltantes caso os juízes ativos necessitem delas
  for (const judge of activeJudges) {
    if (!apiKeys[judge]) {
      console.log(`Chave API necessária para o juiz [${judge}] não detectada no ambiente.`);
      const keyInput = await askQuestion(`Digite a chave de API para [${judge}]: `);
      if (keyInput.trim()) {
        apiKeys[judge] = keyInput.trim();
      } else {
        console.error(`Erro: A chave API para [${judge}] é obrigatória. Pulando este juiz.`);
        activeJudges.splice(activeJudges.indexOf(judge), 1);
      }
    }
  }

  if (activeJudges.length === 0) {
    console.error("Nenhum juiz ativo configurado com chaves válidas. Encerrando.");
    process.exit(1);
  }

  console.log(`\n🔍 Lendo arquivos de debug em: ${targetDir}`);
  const files = fs.readdirSync(targetDir).filter(f => f.endsWith(".json"));
  
  if (files.length === 0) {
    console.log("Nenhum arquivo JSON de debug encontrado.");
    process.exit(0);
  }

  const logs = [];
  for (const file of files) {
    const filePath = path.join(targetDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      logs.push({ file, filePath, data });
    } catch (e) {
      console.warn(`⚠️ Falha ao ler ${file}:`, e.message);
    }
  }

  console.log("📦 Agrupando e pareando execuções por enunciado...");
  const groups = {};
  for (const log of logs) {
    const key = normalizePrompt(log.data.prompt_original);
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  }

  console.log(`Encontradas ${Object.keys(groups).length} questões únicas para avaliação.`);
  let evaluatedCount = 0;

  for (const key of Object.keys(groups)) {
    const logGroup = groups[key];
    
    let gabarito = null;
    let enunciado = null;
    let isFuvest = false;

    const withRag = logGroup.find(l => l.data.rag_details && l.data.rag_details.fullData);
    if (withRag) {
      const fd = withRag.data.rag_details.fullData;
      enunciado = fd.texto || withRag.data.prompt_original;
      gabarito = fd.resolucao || fd.resposta || "";
      if (fd.alternativa_correta) {
        gabarito = `Alternativa Correta: ${fd.alternativa_correta}\n\nResolução detalhada:\n${gabarito}`;
      }
      isFuvest = String(fd.vestibular || "").toUpperCase().includes("FUVEST");
    } else {
      enunciado = logGroup[0].data.prompt_original;
      gabarito = "Gabarito de referência indisponível. Avalie com base no rigor científico e corretude intrínseca.";
      isFuvest = enunciado.toUpperCase().includes("FUVEST");
    }

    console.log(`\nQuestão: "${enunciado.slice(0, 60).replace(/\n/g, " ")}..."`);

    for (const log of logGroup) {
      // Inicializa estrutura de juízes se não existir
      if (!log.data.avaliacao_juiz || typeof log.data.avaliacao_juiz !== "object" || log.data.avaliacao_juiz.criterios) {
        log.data.avaliacao_juiz = {};
      }

      let respostaIA = "";
      if (log.data.response_text) {
        const resp = log.data.response_text;
        if (resp.conteudo && Array.isArray(resp.conteudo)) {
          respostaIA = resp.conteudo.map(c => c.conteudo || "").join("\n\n");
        } else if (typeof resp === "string") {
          respostaIA = resp;
        } else {
          respostaIA = JSON.stringify(resp);
        }
      }

      const promptJuiz = buildJudgePrompt(enunciado, gabarito, respostaIA, isFuvest);

      // Identifica o modelo que gerou a resposta para evitar auto-avaliação
      const generatorModel = String(log.data.model || "").toLowerCase();
      let generatorKey = "";
      if (generatorModel.includes("gemini")) {
        generatorKey = "gemini";
      } else if (generatorModel.includes("gemma")) {
        generatorKey = "gemma";
      } else if (generatorModel.includes("o1")) {
        generatorKey = "o1";
      }

      for (const judge of activeJudges) {
        const modelKey = judge === "gemini" ? "gemini_3_5_flash" : (judge === "gemma" ? "gemma_4_31b_it" : "o1");
        
        if (generatorKey === judge) {
          console.log(`  -> Juiz [${modelKey}] foi o modelo gerador da resposta (${log.data.model}). Evitando auto-avaliação.`);
          continue;
        }

        if (log.data.avaliacao_juiz[modelKey]) {
          console.log(`  -> Juiz [${modelKey}] já avaliou o arquivo ${log.file}. Pulando.`);
          continue;
        }

        console.log(`  -> Executando avaliação com o juiz: [${modelKey}] para o arquivo ${log.file}...`);

        try {
          let responseText = "";
          const systemInstruction = getJudgeSystemPrompt(isFuvest);
          const responseSchema = getJudgeResponseSchema(isFuvest);
          if (judge === "gemini") {
            responseText = await callGeminiAPI(apiKeys.gemini, "gemini-3.5-flash", systemInstruction, promptJuiz, true, responseSchema);
          } else if (judge === "gemma") {
            responseText = await callGeminiAPI(apiKeys.gemma, "gemma-4-31b-it", systemInstruction, promptJuiz, false);
          } else if (judge === "o1") {
            responseText = await callOpenAIAPI(apiKeys.o1, systemInstruction, promptJuiz, responseSchema);
          }

          let avaliacao = null;
          try {
            const jsonText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            avaliacao = JSON.parse(jsonText);
            avaliacao = processarAvaliacaoJuiz(avaliacao, isFuvest);
          } catch (pe) {
            console.warn(`  ⚠️ Falha ao converter resposta do juiz [${modelKey}] em JSON. Salvando texto bruto.`, pe.message);
            avaliacao = { raw_response: responseText, error: "Falha de parser JSON" };
          }

          log.data.avaliacao_juiz[modelKey] = avaliacao;
          fs.writeFileSync(log.filePath, JSON.stringify(log.data, null, 2), "utf-8");
          console.log(`  ✅ Avaliação do juiz [${modelKey}] salva com sucesso.`);
          evaluatedCount++;

        } catch (err) {
          console.error(`  ❌ Erro no juiz [${modelKey}] para o arquivo ${log.file}:`, err.message);
        }
      }
    }
  }

  console.log(`\n🎉 Concluído! ${evaluatedCount} novas avaliações salvas.`);
}

async function callGeminiAPI(apiKey, model, systemInstruction, prompt, forceSchema = true, responseSchema = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1
    }
  };

  if (forceSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = responseSchema || JUDGE_RESPONSE_SCHEMA;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const result = await response.json();
  if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts[0]) {
    return result.candidates[0].content.parts[0].text;
  }
  throw new Error("Resposta vazia da API do Google.");
}

async function callOpenAIAPI(apiKey, systemInstruction, prompt, responseSchema = null) {
  const isGithubKey = apiKey.startsWith("github_") || apiKey.length > 35; // Diferencia chave da API Github Models do OpenAI
  const url = isGithubKey
    ? "https://models.inference.ai.azure.com/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  const body = {
    model: isGithubKey ? "o1" : "o1",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ]
  };

  // Se for API oficial do OpenAI, força o JSON estruturado nativo via response_format
  if (!isGithubKey) {
    const targetSchema = responseSchema || JUDGE_RESPONSE_SCHEMA;
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "avaliacao_apendice_a",
        strict: true,
        schema: convertToStandardJsonSchema(targetSchema)
      }
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const result = await response.json();
  if (result.choices && result.choices[0] && result.choices[0].message) {
    return result.choices[0].message.content;
  }
  throw new Error("Resposta vazia da API do OpenAI.");
}

run();
