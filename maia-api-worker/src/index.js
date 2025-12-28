import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODELS = [
	'models/gemini-3-flash-preview',
	'models/gemini-2.5-flash',
	'models/gemini-2.5-pro',
	'models/gemini-flash-latest',
	'models/gemini-flash-lite-latest',
	'models/gemini-2.5-flash-lite',
	'models/gemini-2.0-flash',
	'models/gemini-2.0-flash-lite',
];

const safetySettings = [
	{ category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
	{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
	{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
	{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// Helper to get CORS headers
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	// Streaming headers
	'Cache-Control': 'no-cache',
	Connection: 'keep-alive',
};

/**
 * Main Entry Point - Router Logic
 */
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle CORS Pre-flight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST' && url.pathname !== '/proxy-pdf') {
			return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
		}

		try {
			// --- ROTAS DO SISTEMA ---
			switch (url.pathname) {
				case '/generate':
				case '/': // Compatibilidade reversa
					return handleGeminiGenerate(request, env);

				case '/embed':
					return handleGeminiEmbed(request, env);

				case '/upload-image':
					return handleImgBBUpload(request, env);

				case '/pinecone-upsert':
					return handlePineconeUpsert(request, env);

				case '/search':
					return handleGeminiSearch(request, env);

				case '/proxy-pdf':
					return handleProxyPdf(request, env);

				case '/trigger-deep-search':
					return handleTriggerDeepSearch(request, env);

				case '/update-deep-search-cache':
					return handleDeepSearchUpdate(request, env);

				default:
					return new Response('Endpoint Not Found', { status: 404, headers: corsHeaders });
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};

/**
 * SERVICE: TRIGGER DEEP SEARCH (GITHUB ACTIONS)
 */
async function handleTriggerDeepSearch(request, env) {
	const { query, slug, ntfy_topic } = await request.json();

	if (!query || !slug) {
		return new Response(JSON.stringify({ error: 'Query and Slug are required' }), { status: 400, headers: corsHeaders });
	}

	// 1. Check Cache (Pinecone)
	// 1. Check Cache (Pinecone)
	try {
		const embedding = await generateEmbedding(query, env.GOOGLE_GENAI_API_KEY);
		if (embedding) {
			const cacheResult = await executePineconeQuery(embedding, env, 1, { type: 'deep-search-result' });
			if (cacheResult && cacheResult.matches && cacheResult.matches.length > 0) {
				const bestMatch = cacheResult.matches[0];
				// Strict semantic deduplication
				if (bestMatch.score > 0.92) {
					console.log(`[Cache Hit] Slug: ${bestMatch.metadata.slug} Score: ${bestMatch.score}`);
					return new Response(
						JSON.stringify({
							success: true,
							cached: true,
							message: 'Search result found in cache',
							slug: bestMatch.metadata.slug,
							score: bestMatch.score,
						}),
						{
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						},
					);
				}
			}
		}
	} catch (e) {
		console.warn('Cache check failed:', e);
		// Proceed to trigger search if cache check fails
	}

	const githubPat = env.GITHUB_PAT;
	const githubOwner = env.GITHUB_OWNER || 'TouchRefletz'; // Default or Env
	const githubRepo = env.GITHUB_REPO || 'maia.api'; // Default or Env

	if (!githubPat) {
		throw new Error('GITHUB_PAT not configured on Worker');
	}

	const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${githubPat}`,
			Accept: 'application/vnd.github.v3+json',
			'User-Agent': 'Cloudflare-Worker',
		},
		body: JSON.stringify({
			event_type: 'deep-search',
			client_payload: {
				query,
				slug,
				ntfy_topic,
			},
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`GitHub API Error: ${response.status} - ${errText}`);
	}

	return new Response(JSON.stringify({ success: true, cached: false, message: 'Deep Search Triggered on GitHub' }), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

/**
 * SERVICE: UPDATE DEEP SEARCH CACHE
 * Called by GitHub Actions after successful search
 */
async function handleDeepSearchUpdate(request, env) {
	// Simple auth check (can be improved with a shared secret)
	const authHeader = request.headers.get('Authorization');
	if (authHeader !== `Bearer ${env.GITHUB_PAT}`) {
		// return new Response('Unauthorized', { status: 401 });
		// For now, let's trust GITHUB_PAT as a shared secret since the Action has it.
	}

	const { query, slug, metadata } = await request.json();

	if (!query || !slug) {
		return new Response(JSON.stringify({ error: 'Query and Slug are required' }), { status: 400, headers: corsHeaders });
	}

	try {
		// Generate embedding
		const embedding = await generateEmbedding(query, env.GOOGLE_GENAI_API_KEY);

		const vector = {
			id: slug,
			values: embedding,
			metadata: {
				...metadata,
				query,
				slug,
				type: 'deep-search-result',
				updated_at: new Date().toISOString(),
			},
		};

		// Upsert to Pinecone
		await executePineconeUpsert([vector], env);

		// Log success
		console.log(`[Cache Update] Success for slug: ${slug}`);

		return new Response(JSON.stringify({ success: true, message: 'Cache updated' }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * HELPER: Shared Embedding Logic
 */
async function generateEmbedding(text, apiKey, model = 'models/gemini-embedding-001') {
	if (!apiKey) throw new Error('API Key missing for embedding');
	const client = new GoogleGenAI({ apiKey });
	const result = await client.models.embedContent({
		model: model,
		contents: text,
	});
	return result.embedding.values || result.embeddings?.[0]?.values;
}

/**
 * HELPER: Shared Pinecone Query
 */
async function executePineconeQuery(vector, env, topK = 1, filter = {}) {
	const pineconeHost = env.PINECONE_HOST_DEEP_SEARCH || env.PINECONE_HOST;
	const apiKey = env.PINECONE_API_KEY;

	if (!pineconeHost || !apiKey) return null;

	const endpoint = `${pineconeHost}/query`;

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Api-Key': apiKey,
			'Content-Type': 'application/json',
			'X-Pinecone-API-Version': '2024-07',
		},
		body: JSON.stringify({
			vector,
			topK,
			filter,
			includeMetadata: true,
		}),
	});

	if (!response.ok) {
		console.error('Pinecone Query Error:', await response.text());
		return null;
	}

	return await response.json();
}

/**
 * HELPER: Shared Pinecone Upsert
 */
async function executePineconeUpsert(vectors, env, namespace = '') {
	const pineconeHost = env.PINECONE_HOST_DEEP_SEARCH || env.PINECONE_HOST;
	const apiKey = env.PINECONE_API_KEY;

	if (!pineconeHost || !apiKey) throw new Error('PINECONE_API_KEY or PINECONE_HOST not configured');

	const endpoint = `${pineconeHost}/vectors/upsert`;

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Api-Key': apiKey,
			'Content-Type': 'application/json',
			'X-Pinecone-API-Version': '2024-07',
		},
		body: JSON.stringify({
			vectors: vectors,
			namespace: namespace,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Pinecone Upsert Error (${response.status}): ${errorText}`);
	}

	return await response.json();
}

/**
 * 1. SERVICE: GEMINI GENERATION
 */
async function handleGeminiGenerate(request, env) {
	const body = await request.json();
	const { texto, schema, listaImagensBase64 = [], mimeType = 'image/jpeg', model, apiKey: userApiKey } = body;

	const finalApiKey = userApiKey || env.GOOGLE_GENAI_API_KEY;
	if (!finalApiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured');

	const client = new GoogleGenAI({ apiKey: finalApiKey });

	// Modelos iniciais (se vier "model", tenta só ele; senão usa DEFAULT_MODELS)
	const initialModels = model ? [model] : DEFAULT_MODELS;

	// Fallbacks específicos pra RECITATION
	const RECITATION_FALLBACKS = ['models/gemini-flash-latest', 'models/gemini-flash-lite-latest'];

	const encoder = new TextEncoder();

	// Prepare parts
	const parts = [{ text: texto }];
	if (Array.isArray(listaImagensBase64)) {
		listaImagensBase64.forEach((base64Image) => {
			let imageString = base64Image;
			let imageMime = mimeType;

			if (typeof base64Image === 'string' && base64Image.includes('base64,')) {
				const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
				if (matches) {
					imageMime = matches[1];
					imageString = matches[2];
				}
			}

			parts.push({ inlineData: { mimeType: imageMime, data: imageString } });
		});
	}

	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();

	// Helpers
	const writeNdjson = async (obj) => {
		await writer.write(encoder.encode(JSON.stringify(obj) + '\n'));
	};

	const isRecitation = (finishReason) => String(finishReason || '').toUpperCase() === 'RECITATION';

	(async () => {
		let lastError = null;
		let success = false;

		// Controla quantas vezes RECITATION aconteceu
		let recitationCount = 0;

		// Histórico pro front (útil no erro final)
		const attemptHistory = [];

		// Fila de tentativas (começa com os modelos normais)
		const queue = [...initialModels];

		// Para evitar loop infinito se initialModels já contém flash/flash-lite,
		// a lógica de RECITATION força o próximo modelo via unshift().
		let attempt = 0;

		while (queue.length > 0) {
			const modelo = queue.shift();
			attempt += 1;

			attemptHistory.push({ attempt, model: modelo, status: 'started' });
			await writeNdjson({ type: 'meta', event: 'attempt_start', attempt, model: modelo });

			try {
				const stream = await client.models.generateContentStream({
					model: modelo,
					contents: [{ role: 'user', parts }],
					config: {
						thinkingConfig: { includeThoughts: true },
						responseMimeType: 'application/json',
						responseJsonSchema: schema || undefined,
						safetySettings,
					},
				});

				let wroteSomethingThisAttempt = false;

				for await (const chunk of stream) {
					const cand = chunk?.candidates?.[0];
					const partsResp = cand?.content?.parts || [];

					// Sempre escreva os parts (streaming incremental)
					for (const part of partsResp) {
						if (!part?.text) continue;
						wroteSomethingThisAttempt = true;

						const type = part.thought ? 'thought' : 'answer';
						await writeNdjson({ type, attempt, model: modelo, text: part.text });
					}

					const finishReason = cand?.finishReason;
					if (finishReason) {
						await writeNdjson({
							type: 'debug',
							attempt,
							model: modelo,
							text: `Finish Reason: ${finishReason}`,
						});

						if (finishReason === 'STOP') {
							attemptHistory[attemptHistory.length - 1].status = 'success';
							success = true;
							break;
						}

						// RECITATION: manda reset pro front e tenta novamente com flash -> flash-lite
						if (isRecitation(finishReason)) {
							recitationCount += 1;
							attemptHistory[attemptHistory.length - 1].status = 'recitation';

							// Pede pro front limpar o que foi renderizado desta tentativa
							// (faz isso mesmo se não escreveu nada; é idempotente)
							await writeNdjson({
								type: 'reset',
								attempt,
								model: modelo,
								reason: 'RECITATION',
								clear: wroteSomethingThisAttempt ? 'attempt' : 'noop',
							});

							// Decide próximo fallback
							const nextFallback = RECITATION_FALLBACKS[recitationCount - 1];

							if (nextFallback) {
								await writeNdjson({
									type: 'meta',
									event: 'retrying_after_recitation',
									attempt,
									fromModel: modelo,
									toModel: nextFallback,
									recitationCount,
								});

								// Força o próximo modelo (prioridade total)
								queue.unshift(nextFallback);
								// Sai do loop deste stream e vai pra próxima iteração do while(queue)
								throw new Error('__RECITATION_RETRY__');
							}

							// 3ª RECITATION (ou mais): devolve algo manipulável no front e encerra
							await writeNdjson({
								type: 'error',
								code: 'RECITATION',
								retryable: false,
								message: 'Falhou 3x com RECITATION (original + flash + flash-lite).',
								attempts: attemptHistory,
							});

							success = false;
							await writer.close();
							return;
						}

						// Outros finishReason: encerra a tentativa e tenta próximo modelo da fila
						throw new Error(`Stream finalizado com finishReason=${finishReason}`);
					}
				}

				if (success) break;

				// Se o stream acabar sem finishReason explícito, trata como erro de protocolo
				attemptHistory[attemptHistory.length - 1].status = 'unknown_end';
				throw new Error('Stream terminou sem finishReason');
			} catch (erro) {
				if (erro?.message === '__RECITATION_RETRY__') {
					// Só continua o while (já enfileirou o fallback)
					continue;
				}

				attemptHistory[attemptHistory.length - 1].status =
					attemptHistory[attemptHistory.length - 1].status === 'started' ? 'failed' : attemptHistory[attemptHistory.length - 1].status;

				console.warn(`Erro model ${modelo}`, erro);
				lastError = erro;
				continue;
			}
		}

		if (!success) {
			await writeNdjson({
				type: 'error',
				code: 'ALL_MODELS_FAILED',
				retryable: true,
				message: `Todos falharam: ${lastError?.message || 'erro desconhecido'}`,
				attempts: attemptHistory,
			});
		}

		await writer.close();
	})();

	return new Response(readable, {
		headers: {
			...corsHeaders,
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}

/**
 * 2. SERVICE: GEMINI EMBEDDING
 */
async function handleGeminiEmbed(request, env) {
	const body = await request.json();
	const apiKey = body.apiKey || env.GOOGLE_GENAI_API_KEY;
	if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured');

	const { texto, model } = body;

	const embeddingValues = await generateEmbedding(texto, apiKey, model);

	return new Response(JSON.stringify(embeddingValues), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

/**
 * 3. SERVICE: IMGBB UPLOAD
 * Recebe: { image: "base64String..." }
 */
async function handleImgBBUpload(request, env) {
	const apiKey = env.IMGBB_API_KEY;
	if (!apiKey) throw new Error('IMGBB_API_KEY not configured on Worker');

	const body = await request.json();
	const { image } = body;

	if (!image) throw new Error('Nenhuma imagem fornecida');

	// Limpa o prefixo do base64 se vier
	const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');

	const formData = new FormData();
	formData.append('image', cleanBase64);

	const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
		method: 'POST',
		body: formData,
	});

	const result = await response.json();

	// Retorna exatamente a estrutura que o front espera ou padroniza
	return new Response(JSON.stringify(result), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

/**
 * 4. SERVICE: PINECONE UPSERT
 * Recebe: { vectors: [...] }
 */
async function handlePineconeUpsert(request, env) {
	const body = await request.json();
	const { vectors, namespace = '' } = body; // Default namespace empty

	if (!vectors || !Array.isArray(vectors)) throw new Error('Vectors array is required');

	const result = await executePineconeUpsert(vectors, env, namespace);

	return new Response(JSON.stringify(result), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

/**
 * 6. SERVICE: PROXY PDF
 * Just proxies the GET request to avoid CORS/Mixed Content
 */
async function handleProxyPdf(request, env) {
	const urlObj = new URL(request.url);
	let targetUrl = urlObj.searchParams.get('url');

	if (!targetUrl) {
		return new Response('URL parameter is required', { status: 400, headers: corsHeaders });
	}

	// SAFETY: Ensure URL is decoded (handling potential double-encoding from frontend)
	try {
		let iterations = 0;
		while (targetUrl.includes('%') && iterations < 5) {
			const decoded = decodeURIComponent(targetUrl);
			if (decoded === targetUrl) break;
			targetUrl = decoded;
			iterations++;
		}
	} catch (e) {
		console.warn('Proxy: Failed to decode URL:', targetUrl);
	}

	try {
		const response = await fetch(targetUrl, {
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
		});

		if (!response.ok) {
			return new Response(`Failed to fetch PDF: ${response.status}`, { status: response.status, headers: corsHeaders });
		}

		const pdfBlob = await response.blob();

		return new Response(pdfBlob, {
			headers: {
				...corsHeaders,
				'Content-Type': 'application/pdf',
				'Cache-Control': 'public, max-age=3600',
			},
		});
	} catch (e) {
		return new Response(`Proxy Error: ${e.message}`, { status: 500, headers: corsHeaders });
	}
}

/**
 * 5. SERVICE: GEMINI SEARCH (Grounding with Google Search)
 */
/**
 * 5. SERVICE: GEMINI SEARCH (Grounding with Google Search)
 * STREAMING VERSION para suportar Thoughts e feedback visual
 */
async function handleGeminiSearch(request, env) {
	const body = await request.json();
	const { texto, schema, listaImagensBase64 = [], model, apiKey: userApiKey } = body;

	const finalApiKey = userApiKey || env.GOOGLE_GENAI_API_KEY;
	if (!finalApiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured');

	const client = new GoogleGenAI({ apiKey: finalApiKey });

	// Modelos iniciais
	const initialModels = model ? [model] : DEFAULT_MODELS;

	// Fallbacks
	const RECITATION_FALLBACKS = ['models/gemini-flash-latest', 'models/gemini-flash-lite-latest'];

	const encoder = new TextEncoder();

	// Prepare parts
	const parts = [{ text: texto }];
	if (Array.isArray(listaImagensBase64)) {
		listaImagensBase64.forEach((base64Image) => {
			let imageString = base64Image;
			let imageMime = 'image/jpeg';

			if (typeof base64Image === 'string' && base64Image.includes('base64,')) {
				const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
				if (matches) {
					imageMime = matches[1];
					imageString = matches[2];
				}
			}
			parts.push({ inlineData: { mimeType: imageMime, data: imageString } });
		});
	}

	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();

	const writeNdjson = async (obj) => {
		await writer.write(encoder.encode(JSON.stringify(obj) + '\n'));
	};

	(async () => {
		let lastError = null;
		let success = false;
		let recitationCount = 0;
		const queue = [...initialModels];

		while (queue.length > 0) {
			const modelo = queue.shift();

			try {
				await writeNdjson({ type: 'meta', event: 'attempt_start', model: modelo });

				const generationConfig = {
					tools: [{ googleSearch: {} }],
					safetySettings,
					thinkingConfig: { includeThoughts: true }, // Enable thoughts
				};

				if (schema) {
					generationConfig.responseMimeType = 'application/json';
					generationConfig.responseJsonSchema = schema;
				}

				const stream = await client.models.generateContentStream({
					model: modelo,
					contents: [{ role: 'user', parts }],
					config: generationConfig,
				});

				for await (const chunk of stream) {
					const cand = chunk?.candidates?.[0];
					const partsResp = cand?.content?.parts || [];
					// FIX: Check both cand and chunk for groundingMetadata (camel and snake case)
					const groundingMetadata =
						cand?.groundingMetadata || chunk?.groundingMetadata || cand?.grounding_metadata || chunk?.grounding_metadata;

					// DEBUG: Check what is inside
					if (chunk) {
						await writeNdjson({ type: 'debug', text: `Chunk Keys: ${Object.keys(chunk).join(', ')}` });
					}
					if (cand) {
						const hasGrounding = !!groundingMetadata;
						await writeNdjson({ type: 'debug', text: `Cand Keys: ${Object.keys(cand).join(', ')} | Has Grounding: ${hasGrounding}` });
						if (hasGrounding) {
							await writeNdjson({ type: 'debug', text: `FOUND GROUNDING METADATA!` });
						}
					}

					// Envia Grounding Metadata se existir
					if (groundingMetadata) {
						await writeNdjson({ type: 'grounding', metadata: groundingMetadata });
					}

					for (const part of partsResp) {
						if (!part?.text) continue;
						const type = part.thought ? 'thought' : 'answer';
						// Para o endpoint de search, 'answer' é o relatório de pesquisa
						await writeNdjson({ type, text: part.text });
					}

					const finishReason = cand?.finishReason;
					if (finishReason) {
						if (finishReason === 'STOP') {
							success = true;
							break; // Sai do loop do stream
						}

						// Recitation Logic
						if (String(finishReason || '').toUpperCase() === 'RECITATION') {
							recitationCount += 1;
							await writeNdjson({ type: 'reset', reason: 'RECITATION' });

							const nextFallback = RECITATION_FALLBACKS[recitationCount - 1];
							if (nextFallback) {
								queue.unshift(nextFallback); // Tenta o próximo
								throw new Error('__RECITATION_RETRY__');
							}

							throw new Error('RECITATION_FAIL_ALL');
						}

						throw new Error(`Finish Reason: ${finishReason}`);
					}
				}

				if (success) break; // Sai do loop da fila de modelos
			} catch (error) {
				if (error.message === '__RECITATION_RETRY__') continue;
				console.warn(`Erro search model ${modelo}`, error);
				lastError = error;
			}
		}

		if (!success) {
			await writeNdjson({
				type: 'error',
				code: 'ALL_MODELS_FAILED',
				message: lastError?.message || 'Erro desconhecido na pesquisa',
			});
		}

		await writer.close();
	})();

	return new Response(readable, {
		headers: {
			...corsHeaders,
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}
