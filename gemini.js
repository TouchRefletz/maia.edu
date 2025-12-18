import { GoogleGenAI } from "https://cdn.jsdelivr.net/npm/@google/genai/dist/web/index.mjs";

const models = [
  "models/gemini-2.5-pro",
  "models/gemini-flash-latest",
  "models/gemini-flash-lite-latest",
  "models/gemini-2.5-flash",
  "models/gemini-2.5-flash-lite",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-lite",
];


function getAIClient() {
  let apiKey = null;

  // 1. Tenta Variável de Ambiente (Vercel)
  try {
    if (import.meta.env && (import.meta.env.VITE_GOOGLE_GENAI_API_KEY || import.meta.env.GOOGLE_GENAI_API_KEY)) {
      apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY || import.meta.env.GOOGLE_GENAI_API_KEY;
    }
  } catch (e) { }

  // 2. Fallback para SessionStorage
  if (!apiKey) {
    apiKey = sessionStorage.getItem("GOOGLE_GENAI_API_KEY");
  }

  if (!apiKey) {
    throw new Error("API Key não encontrada. Por favor, insira sua chave e tente novamente.");
  }

  return new GoogleGenAI({ apiKey });
}


export async function gerarConteudo(texto) {
  let ultimoErro = null;

  const ai = getAIClient();

  // Itera sobre cada modelo da lista
  for (const modelo of models) {
    try {
      // Tenta gerar com o modelo atual
      const resultado = await ai.models.generateContent({
        model: modelo, // Usa o modelo da iteração atual
        contents: texto,
      });

      // Se chegou aqui, funcionou: retorna a resposta e encerra a função
      const resposta = await resultado.text;
      return resposta;

    } catch (erro) {
      // Se falhar, registra um aviso e o loop continua para o próximo
      console.warn(`Erro com o modelo ${modelo}. Tentando o próximo...`, erro.message);
      ultimoErro = erro;
    }
  }

  // Se o loop terminar sem retornar nada, significa que todos falharam
  throw new Error(`Todos os modelos falharam. Último erro: ${ultimoErro?.message}`);
}

export async function gerarConteudoEmJSON(texto, schema = null) {
  let ultimoErro = null;

  const ai = getAIClient();

  for (const modelo of models) {
    try {
      const resultado = await ai.models.generateContent({
        model: modelo,
        contents: texto,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });

      // Parseia e retorna se tiver sucesso
      let textoLimpo = resultado.text.replace(/```json|```/g, '').trim();
      const resposta = JSON.parse(textoLimpo);
      return resposta;

    } catch (erro) {
      console.warn(`Erro JSON com o modelo ${modelo}. Tentando o próximo...`, erro.message);
      ultimoErro = erro;
    }
  }

  throw new Error(`Todos os modelos falharam na geração de JSON. Último erro: ${ultimoErro?.message}`);
}

/**
 * Gera conteúdo em JSON usando texto e MULTIPLAS imagens.
 * @param {string} texto - O prompt de texto.
 * @param {object} schema - O esquema JSON desejado.
 * @param {Array<string>} listaImagensBase64 - Array de strings base64 (ex: ['data:image...', 'data:image...']).
 * @param {string} mimeType - Padrão 'image/jpeg'.
 */
export async function gerarConteudoEmJSONComImagem(texto, schema = null, listaImagensBase64 = [], mimeType = "image/jpeg") {
  let ultimoErro = null;
  const ai = getAIClient();

  // 1. Prepara a parte de TEXTO
  const parts = [{ text: texto }];

  // 2. Prepara as partes de IMAGEM (Itera sobre a lista)
  if (listaImagensBase64 && Array.isArray(listaImagensBase64)) {
    listaImagensBase64.forEach(base64Image => {
      let imageString = base64Image;
      let imageMime = mimeType;

      // Extrai cabeçalho se existir
      if (base64Image.includes("base64,")) {
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          imageMime = matches[1];
          imageString = matches[2];
        }
      }

      // Adiciona cada imagem como uma "part" separada
      parts.push({
        inlineData: {
          mimeType: imageMime,
          data: imageString
        }
      });
    });
  }

  // 3. Envia para o modelo
  for (const modelo of models) {
    try {
      const resultado = await ai.models.generateContent({
        model: modelo,
        contents: [{ role: "user", parts: parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });

      let textoLimpo = resultado.text.replace(/```json|```/g, '').trim();
      const resposta = JSON.parse(textoLimpo);
      return resposta;

    } catch (erro) {
      console.warn(`Erro JSON com o modelo ${modelo}. Tentando o próximo...`, erro.message);
      ultimoErro = erro;
    }
  }

  throw new Error(`Todos os modelos falharam. Último erro: ${ultimoErro?.message}`);
}

export async function gerarConteudoEmJSONComImagemStream(
  texto,
  schema = null,
  listaImagensBase64 = [],
  mimeType = "image/jpeg",
  handlers = {}
) {
  let ultimoErro = null;
  const ai = getAIClient();

  // Monta parts (texto + imagens)
  const parts = [{ text: texto }];
  if (listaImagensBase64 && Array.isArray(listaImagensBase64)) {
    listaImagensBase64.forEach((base64Image) => {
      let imageString = base64Image;
      let imageMime = mimeType;

      if (base64Image.includes("base64,")) {
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          imageMime = matches[1];
          imageString = matches[2];
        }
      }

      parts.push({
        inlineData: { mimeType: imageMime, data: imageString },
      });
    });
  }

  for (const modelo of models) {
    try {
      handlers?.onStatus?.(`Conectando: ${modelo}...`);

      const stream = await ai.models.generateContentStream({
        model: modelo,
        contents: [{ role: "user", parts }],
        config: {
          thinkingConfig: { includeThoughts: true },
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });

      let answerText = "";

      for await (const chunk of stream) {
        const partsResp = chunk?.candidates?.[0]?.content?.parts || [];
        for (const part of partsResp) {
          if (!part?.text) continue;

          if (part.thought) {
            handlers?.onThought?.(part.text);
          } else {
            handlers?.onAnswerDelta?.(part.text);
            answerText += part.text;
          }
        }
      }

      // Só aqui (depois do stream acabar)
      const textoLimpo = answerText.replace(/``````/g, "").trim();
      return JSON.parse(textoLimpo);
    } catch (erro) {
      console.warn(`Erro JSON(stream) com o modelo ${modelo}. Tentando o próximo...`, erro?.message);
      ultimoErro = erro;
      continue; // tenta o próximo modelo
    }
  }

  throw new Error(`Todos os modelos falharam no stream JSON. Último erro: ${ultimoErro?.message}`);
}
