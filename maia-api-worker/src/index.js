
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODELS = [
	"models/gemini-2.5-pro",
	"models/gemini-flash-latest",
	"models/gemini-flash-lite-latest",
	"models/gemini-2.5-flash",
	"models/gemini-2.5-flash-lite",
	"models/gemini-2.0-flash",
	"models/gemini-2.0-flash-lite",
];

// Helper to get CORS headers
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	// Streaming headers
	"Cache-Control": "no-cache",
	"Connection": "keep-alive",
};

/**
 * Main Entry Point - Router Logic
 */
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle CORS Pre-flight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
		}

		try {
			// --- ROTAS DO SISTEMA ---
			switch (url.pathname) {
				case "/generate":
				case "/": // Compatibilidade reversa
					return handleGeminiGenerate(request, env);

				case "/embed":
					return handleGeminiEmbed(request, env);

				case "/upload-image":
					return handleImgBBUpload(request, env);

				case "/pinecone-upsert":
					return handlePineconeUpsert(request, env);

				default:
					return new Response("Endpoint Not Found", { status: 404, headers: corsHeaders });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}
	},
};

/**
 * 1. SERVICE: GEMINI GENERATION
 */
async function handleGeminiGenerate(request, env) {
	// START FIX
	const body = await request.json();
	const {
		texto,
		schema,
		listaImagensBase64 = [],
		mimeType = "image/jpeg",
		model,
		apiKey: userApiKey // Recebe do front
	} = body;
	// END FIX

	// Prioriza a chave do usuário se existir, senão usa a do ambiente
	const finalApiKey = userApiKey || env.GOOGLE_GENAI_API_KEY;
	if (!finalApiKey) throw new Error("GOOGLE_GENAI_API_KEY not configured");

	const client = new GoogleGenAI({ apiKey: finalApiKey });

	const modelsToTry = model ? [model] : DEFAULT_MODELS;
	const encoder = new TextEncoder();

	// Prepare parts
	const parts = [{ text: texto }];
	if (Array.isArray(listaImagensBase64)) {
		listaImagensBase64.forEach((base64Image) => {
			let imageString = base64Image;
			let imageMime = mimeType;
			if (typeof base64Image === 'string' && base64Image.includes("base64,")) {
				const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
				if (matches) { imageMime = matches[1]; imageString = matches[2]; }
			}
			parts.push({ inlineData: { mimeType: imageMime, data: imageString } });
		});
	}

	let { readable, writable } = new TransformStream();
	const writer = writable.getWriter();

	(async () => {
		let lastError = null;
		let success = false;

		for (const modelo of modelsToTry) {
			try {
				const stream = await client.models.generateContentStream({
					model: modelo,
					contents: [{ role: "user", parts }],
					config: {
						thinkingConfig: { includeThoughts: true },
						responseMimeType: "application/json",
						responseJsonSchema: schema || undefined,
					},
				});

				for await (const chunk of stream) {
					const partsResp = chunk?.candidates?.[0]?.content?.parts || [];
					for (const part of partsResp) {
						// await writer.write(encoder.encode(JSON.stringify({ type: 'debug', text: JSON.stringify(part) }) + "\n"));

						if (!part?.text) continue;

						if (part.thought) {
							const data = JSON.stringify({ type: 'thought', text: part.text });
							await writer.write(encoder.encode(data + "\n"));
						} else {
							const data = JSON.stringify({ type: 'answer', text: part.text });
							await writer.write(encoder.encode(data + "\n"));
						}
					}
				}
				success = true;
				break;
			} catch (erro) {
				console.warn(`Erro model ${modelo}`, erro);
				lastError = erro;
				continue;
			}
		}

		if (!success) {
			const errData = JSON.stringify({ type: 'error', text: `Todos falharam: ${lastError?.message}` });
			await writer.write(encoder.encode(errData + "\n"));
		}

		await writer.close();
	})();

	return new Response(readable, {
		headers: {
			...corsHeaders,
			"Content-Type": "application/x-ndjson; charset=utf-8",
			"X-Content-Type-Options": "nosniff"
		}
	});
}

/**
 * 2. SERVICE: GEMINI EMBEDDING
 */
async function handleGeminiEmbed(request, env) {
	const body = await request.json();
	const apiKey = body.apiKey || env.GOOGLE_GENAI_API_KEY;
	if (!apiKey) throw new Error("GOOGLE_GENAI_API_KEY not configured");

	const client = new GoogleGenAI({ apiKey });

	const { texto, model = "models/gemini-embedding-001" } = body;

	const result = await client.models.embedContent({
		model: model,
		contents: texto
	});

	if (result.embedding && result.embedding.values) {
		return new Response(JSON.stringify(result.embedding.values), {
			headers: { ...corsHeaders, "Content-Type": "application/json" }
		});
	} else if (result.embeddings && Array.isArray(result.embeddings)) {
		return new Response(JSON.stringify(result.embeddings[0].values), {
			headers: { ...corsHeaders, "Content-Type": "application/json" }
		});
	}

	throw new Error("Formato de resposta de embedding desconhecido.");
}

/**
 * 3. SERVICE: IMGBB UPLOAD
 * Recebe: { image: "base64String..." }
 */
async function handleImgBBUpload(request, env) {
	const apiKey = env.IMGBB_API_KEY;
	if (!apiKey) throw new Error("IMGBB_API_KEY not configured on Worker");

	const body = await request.json();
	const { image } = body;

	if (!image) throw new Error("Nenhuma imagem fornecida");

	// Limpa o prefixo do base64 se vier
	const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

	const formData = new FormData();
	formData.append("image", cleanBase64);

	const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
		method: "POST",
		body: formData
	});

	const result = await response.json();

	// Retorna exatamente a estrutura que o front espera ou padroniza
	return new Response(JSON.stringify(result), {
		headers: { ...corsHeaders, "Content-Type": "application/json" }
	});
}

/**
 * 4. SERVICE: PINECONE UPSERT
 * Recebe: { vectors: [...] }
 */
async function handlePineconeUpsert(request, env) {
	const apiKey = env.PINECONE_API_KEY;
	const pineconeHost = env.PINECONE_HOST; // ex: https://index-name-xyz.svc.aped-4627-b74a.pinecone.io

	if (!apiKey || !pineconeHost) throw new Error("PINECONE_API_KEY or PINECONE_HOST not configured");

	const body = await request.json();
	const { vectors, namespace = "" } = body; // Default namespace empty

	if (!vectors || !Array.isArray(vectors)) throw new Error("Vectors array is required");

	const endpoint = `${pineconeHost}/vectors/upsert`;

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Api-Key": apiKey,
			"Content-Type": "application/json",
			"X-Pinecone-API-Version": "2024-07"
		},
		body: JSON.stringify({
			vectors: vectors,
			namespace: namespace
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Pinecone Error (${response.status}): ${errorText}`);
	}

	const result = await response.json();
	return new Response(JSON.stringify(result), {
		headers: { ...corsHeaders, "Content-Type": "application/json" }
	});
}
