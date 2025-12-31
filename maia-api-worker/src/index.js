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

				case '/cancel-deep-search':
					return handleCancelDeepSearch(request, env);

				case '/delete-pinecone-record':
					return handlePineconeDelete(request, env);

				case '/manual-upload':
					return handleManualUpload(request, env);

				case '/delete-artifact':
					return handleDeleteArtifact(request, env);

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
/**
 * SERVICE: TRIGGER DEEP SEARCH (GITHUB ACTIONS)
 */
async function handleTriggerDeepSearch(request, env) {
	const body = await request.json();
	const { query, ntfy_topic, force, cleanup, confirm, mode } = body; // confirm & mode added

	// 1. Validate Input
	if (!query) {
		return new Response(JSON.stringify({ error: 'Query is required' }), { status: 400, headers: corsHeaders });
	}

	// 2. Canonical Slug Generation (Pre-flight Phase)
	let canonicalSlug = body.slug; // Helper or frontend provided fallback
	let reasoning = 'Manual override';

	// If no forced slug provided, generate one via Gemini
	if (!canonicalSlug) {
		try {
			const currentDate = new Date().toISOString();
			const prompt = `You are a precise naming authority for exam repositories. Your goal is to convert user queries into a standard 'canonical' kebab-case slug.

Rules:
1. Format: \`exam-name-year\` (e.g., \`enem-2024\`, \`ita-2025\`).
2. Year Inference: If the user DOES NOT specify a year, you MUST infer the most recent *occurred* or *upcoming* edition based on the current date provided.
    - Current Date: ${currentDate}
    - Logic: If today is Dec 2025, 'Enem' implies 'enem-2025'. If user asks for 'Enem' in Jan 2025, it implies 'enem-2024' (last one) or 'enem-2025' (next one) based on typical exam schedule. Default to the *latest edition that likely has files available*.

Query: "${query}"

Output JSON ONLY.`;

			const schema = {
				type: 'OBJECT',
				properties: {
					slug: { type: 'STRING', description: 'The canonical kebab-case slug' },
					reasoning: { type: 'STRING', description: 'Explanation of year inference' },
				},
				required: ['slug'],
			};

			// Internal Request to reuse handleGeminiGenerate
			const internalReq = new Request('http://internal/generate', {
				method: 'POST',
				body: JSON.stringify({
					texto: prompt,
					model: 'models/gemini-3-flash-preview', // User requested model
					schema: schema,
				}),
			});

			// Capture the Response Stream
			const genResponse = await handleGeminiGenerate(internalReq, env);

			if (!genResponse.ok) {
				console.warn('[Pre-flight] Gemini generation failed, falling back to simple slug.');
				canonicalSlug = query
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '');
			} else {
				// Parse NDJSON Stream to get final 'answer' or assembled text
				const reader = genResponse.body.getReader();
				let fullText = '';
				const decoder = new TextDecoder();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const chunk = decoder.decode(value, { stream: true });
					const lines = chunk.split('\n');
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const json = JSON.parse(line);
							if (json.type === 'answer' && json.text) {
								fullText += json.text;
							}
						} catch (e) {}
					}
				}

				try {
					const parsed = JSON.parse(fullText);
					canonicalSlug = parsed.slug;
					reasoning = parsed.reasoning;
					console.log(`[Pre-flight] Canonical Slug Generated: ${canonicalSlug} (${reasoning})`);
				} catch (e) {
					console.warn('[Pre-flight] Failed to parse Gemini JSON, fallback.', e);
					canonicalSlug = query
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/^-+|-+$/g, '');
				}
			}
		} catch (e) {
			console.error('[Pre-flight] Error in slug generation:', e);
			canonicalSlug = query
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
		}
	}

	// 3. Check Pinecone for Duplicates
	let exactMatch = null;
	let similarCandidates = [];

	if (!force) {
		try {
			// A. Exact Match Check & Similar Candidates
			// Modified: Use the CANONICAL SLUG for the embedding, effectively "searching by translation"
			// This ensures "exame nacional 2019" -> "enem-2019" -> embedding("enem 2019")
			const searchParam = canonicalSlug.replace(/-/g, ' ');

			console.log(`[Pre-flight] Searching cache using translated term: "${searchParam}" (from "${query}")`);

			// We need an embedding for the query anyway for similarity check
			const embedding = await generateEmbedding(searchParam, env.GOOGLE_GENAI_API_KEY);

			if (embedding) {
				const cacheResult = await executePineconeQuery(embedding, env, 10, { type: 'deep-search-result' }); // Get top 10

				if (cacheResult && cacheResult.matches) {
					// 1. Exact Match Check
					exactMatch = cacheResult.matches.find((m) => m.metadata && m.metadata.slug === canonicalSlug);

					// 2. Similar Candidates (high score but different slug)
					similarCandidates = cacheResult.matches
						.filter((m) => m.metadata && m.metadata.slug !== canonicalSlug && m.score > 0.75) // High threshold
						.map((m) => ({
							slug: m.metadata.slug,
							score: m.score,
							query: m.metadata.query,
							institution: m.metadata.institution,
							year: m.metadata.year,
							file_count: m.metadata.file_count,
							timestamp: m.metadata.updated_at,
						}));
				}
			}
		} catch (e) {
			console.warn('[Pre-flight] Cache check error:', e);
		}
	}

	// 4. PRE-FLIGHT RETURN (If not confirmed)
	// If we found duplicates OR just to show the user what will happen
	// The plan implies we ALWAYS return pre-flight info first unless 'confirm' is true.
	if (!confirm) {
		console.log(`[Pre-flight] Returning findings for: ${canonicalSlug}`);
		return new Response(
			JSON.stringify({
				success: true,
				preflight: true,
				canonical_slug: canonicalSlug,
				slug_reasoning: reasoning,
				exact_match: exactMatch
					? {
							slug: exactMatch.metadata.slug,
							file_count: exactMatch.metadata.file_count,
							updated_at: exactMatch.metadata.updated_at,
						}
					: null,
				similar_candidates: similarCandidates,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}

	// 5. PROCEED TO GITHUB ACTION (Confirmed)
	const finalSlug = canonicalSlug; // Use the one we generated/confirmed

	const githubPat = env.GITHUB_PAT;
	const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
	const githubRepo = env.GITHUB_REPO || 'maia.api';

	if (!githubPat) throw new Error('GITHUB_PAT not configured');

	const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${githubPat}`,
			Accept: 'application/vnd.github.v3+json',
			'User-Agent': 'Cloudflare-Worker',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			event_type: 'deep-search',
			client_payload: {
				query,
				slug: finalSlug, // normalized
				ntfy_topic,
				cleanup: cleanup || false,
				mode: mode || 'overwrite', // 'overwrite' or 'update'
			},
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`GitHub API Error: ${response.status} - ${errText}`);
	}

	return new Response(
		JSON.stringify({
			success: true,
			cached: false,
			message: 'Deep Search Triggered on GitHub',
			final_slug: finalSlug,
			mode: mode || 'overwrite',
		}),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		},
	);
}

/**
 * SERVICE: CANCEL DEEP SEARCH
 * Cancels a running GitHub Actions workflow
 */
async function handleCancelDeepSearch(request, env) {
	const body = await request.json();
	const { runId } = body;

	if (!runId) {
		return new Response(JSON.stringify({ error: 'Run ID is required' }), { status: 400, headers: corsHeaders });
	}

	const githubPat = env.GITHUB_PAT;
	const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
	const githubRepo = env.GITHUB_REPO || 'maia.api';

	if (!githubPat) {
		throw new Error('GITHUB_PAT not configured on Worker');
	}

	const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/runs/${runId}/cancel`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${githubPat}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Cloudflare-Worker',
			},
		});

		if (!response.ok) {
			// 409 Conflict often means "Workflow is not running" or "Already finished", which we can treat as a success or soft-error.
			// But strictly speaking, it failed to cancel.
			const errText = await response.text();
			return new Response(JSON.stringify({ success: false, error: `GitHub API Error: ${response.status} - ${errText}` }), {
				status: response.status,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ success: true, message: 'Cancellation requested successfully' }), {
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
 * SERVICE: DELETE ARTIFACT (Trigger Cleanup Workflow)
 */
async function handleDeleteArtifact(request, env) {
	const body = await request.json();
	const { slug, filename } = body;

	if (!slug) {
		return new Response(JSON.stringify({ error: 'Slug is required' }), { status: 400, headers: corsHeaders });
	}

	const githubPat = env.GITHUB_PAT;
	const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
	const githubRepo = env.GITHUB_REPO || 'maia.api';

	if (!githubPat) {
		throw new Error('GITHUB_PAT not configured on Worker');
	}

	const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${githubPat}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Cloudflare-Worker',
			},
			body: JSON.stringify({
				event_type: 'delete-artifact',
				client_payload: {
					slug,
					filename, // Optional, but used if provided for specific file deletion
				},
			}),
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`GitHub API Error: ${response.status} - ${errText}`);
		}

		return new Response(JSON.stringify({ success: true, message: 'Deletion workflow triggered' }), {
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
		// Modified: Use the CANONICAL SLUG for the stored embedding too.
		// This ensures the vector represents the exam itself (e.g. "enem 2019")
		// rather than the specific query used to find it ("provas do enem").
		const embedding = await generateEmbedding(slug.replace(/-/g, ' '), env.GOOGLE_GENAI_API_KEY);

		const vector = {
			id: slug,
			values: embedding,
			metadata: {
				...metadata,
				query, // We still keep the original query in metadata for reference
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
 * SERVICE: DELETE PINECONE RECORD
 * Called by GitHub Actions during cleanup phase
 */
async function handlePineconeDelete(request, env) {
	// Simple auth check similar to update-deep-search-cache
	const authHeader = request.headers.get('Authorization');
	// if (authHeader !== `Bearer ${env.GITHUB_PAT}`) {
	// 	return new Response('Unauthorized', { status: 401, headers: corsHeaders });
	// }

	const body = await request.json();
	const { slug } = body;

	if (!slug) {
		return new Response(JSON.stringify({ error: 'Slug is required' }), { status: 400, headers: corsHeaders });
	}

	try {
		await executePineconeDelete(slug, env);
		return new Response(JSON.stringify({ success: true, message: `Deleted ${slug} from Pinecone` }), {
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

	const values = result.embedding?.values || result.embeddings?.[0]?.values;

	if (!values) {
		console.error('[Embedding Error] Invalid response from Gemini:', JSON.stringify(result, null, 2));
		throw new Error('Failed to generate embedding: Invalid response structure');
	}

	return values;
}

/**
 * HELPER: Shared Pinecone Query
 */
async function executePineconeQuery(vector, env, topK = 1, filter = {}) {
	// Strict check for Deep Search Host to avoid polluting the main index
	// If the user intends to use the main index, they must explicitly set PINECONE_HOST_DEEP_SEARCH to the same value.
	const pineconeHost = env.PINECONE_HOST_DEEP_SEARCH;
	const apiKey = env.PINECONE_API_KEY;

	if (filter.type === 'deep-search-result' && !pineconeHost) {
		console.error('[Pinecone Query] PINECONE_HOST_DEEP_SEARCH is required for deep-search queries but not set.');
		return null; // Or throw, but for query we can just return null/empty
	}

	// Fallback only if NOT deep search (though this helper is shared, so be careful)
	const effectiveHost = pineconeHost || env.PINECONE_HOST;

	if (!effectiveHost || !apiKey) return null;

	const endpoint = `${effectiveHost}/query`;

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
	// Checks if any vector is a deep search result
	const isDeepSearch = vectors.some((v) => v.metadata && v.metadata.type === 'deep-search-result');

	let pineconeHost = env.PINECONE_HOST;

	if (isDeepSearch) {
		if (!env.PINECONE_HOST_DEEP_SEARCH) {
			throw new Error('PINECONE_HOST_DEEP_SEARCH is not configured! Cannot save deep search results to default index.');
		}
		pineconeHost = env.PINECONE_HOST_DEEP_SEARCH;
		console.log(`[Pinecone Upsert] Using DEEP_SEARCH host: ${pineconeHost}`);
	} else {
		// Optional: Warn if main host is used?
		pineconeHost = env.PINECONE_HOST || env.PINECONE_HOST_DEEP_SEARCH;
	}

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

	// Helper to process files/images
	const processAttachments = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;

				// Handle object structure { mimeType, data }
				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
				}
				// Handle base64 string with prefix
				else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}

				parts.push({ inlineData: { mimeType, data } });
			});
		}
	};

	processAttachments(listaImagensBase64, mimeType);
	// Handle generic files (PDFs, etc) passed in body.files
	if (body.files) {
		processAttachments(body.files, 'application/pdf');
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
		let currentUrl = targetUrl;
		let response = null;
		let headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
		};
		if (env.HF_TOKEN) headers['Authorization'] = `Bearer ${env.HF_TOKEN}`;

		// Manually follow Redirects (limit 5)
		for (let i = 0; i < 5; i++) {
			console.log(`[Proxy] Fetching: ${currentUrl}`);
			response = await fetch(currentUrl, {
				method: 'GET',
				headers: headers,
				redirect: 'manual', // We handle redirects to strip Auth
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('Location');
				if (!location) break;

				// If redirecting to a new host (likely storage), DROP AUTH
				// Signed URLs (like Xet/S3) will fail if we send Bearer Token
				currentUrl = location;
				headers = {
					'User-Agent': headers['User-Agent'],
				};
				continue;
			}
			break;
		}

		if (!response) {
			return new Response('Proxy Error: No response', { status: 500, headers: corsHeaders });
		}

		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('text/html')) {
			return new Response(`Error: Upstream returned HTML (Status ${response.status}). Check HF_TOKEN or URL validity.`, {
				status: 401,
				headers: corsHeaders,
			});
		}

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

	// Helper to process files/images (Shared logic, copied for independence)
	const processAttachments = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;

				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}
				parts.push({ inlineData: { mimeType, data } });
			});
		}
	};

	processAttachments(listaImagensBase64, 'image/jpeg');
	if (body.files) {
		processAttachments(body.files, 'application/pdf');
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

/**
 * HELPER: Shared Pinecone Delete
 */
async function executePineconeDelete(slug, env) {
	const pineconeHost = env.PINECONE_HOST_DEEP_SEARCH;
	const apiKey = env.PINECONE_API_KEY;

	if (!pineconeHost || !apiKey) {
		console.warn('PINECONE_HOST_DEEP_SEARCH or PINECONE_API_KEY missing, skipping delete.');
		return;
	}

	const endpoint = `${pineconeHost}/vectors/delete`;

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Api-Key': apiKey,
			'Content-Type': 'application/json',
			'X-Pinecone-API-Version': '2024-07',
		},
		body: JSON.stringify({
			ids: [slug],
			// namespace: '', // Default namespace
		}),
	});

	if (!response.ok) {
		const txt = await response.text();
		throw new Error(`Pinecone Delete Error: ${txt}`);
	}

	return await response.json();
}
/**
 * SERVICE: MANUAL UPLOAD (Sync to HF) with AI Research
 * 1. Uploads file to tmpfiles.org
 * 2. Uses Gemini (Search) to research exam details
 * 3. Uses Gemini (Generate) to extract metadata
 * 4. Triggers GitHub Action manual-upload
 */
async function handleManualUpload(request, env) {
	if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

	try {
		const formData = await request.formData();
		const title = formData.get('title');
		const sourceUrlProva = formData.get('source_url_prova');
		const sourceUrlGabarito = formData.get('source_url_gabarito');

		const fileProva = formData.get('fileProva');
		const fileGabarito = formData.get('fileGabarito');

		const confirmOverride = formData.get('confirm_override') === 'true';

		if ((!fileProva && !confirmOverride) || !title) {
			return new Response(JSON.stringify({ error: 'Prova and Title are required' }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		console.log(`[Manual Upload] Starting AI Research & Upload for: ${title}`);

		// 1. UPLOAD FILES FIRST (Parallel)
		const uploadToTmp = async (file) => {
			if (!file) return null;
			const fd = new FormData();
			fd.append('file', file);
			try {
				const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd });
				const json = await res.json();
				if (json && json.status === 'success') {
					return json.data.url.replace('/file/', '/dl/');
				}
				return null;
			} catch (e) {
				console.error('Tmpfiles upload error:', e);
				return null;
			}
		};

		const uploadPromises = [uploadToTmp(fileProva)];
		if (fileGabarito) uploadPromises.push(uploadToTmp(fileGabarito));

		// We wait for uploads while we could potentially start AI, but let's keep it simple.
		// Actually, let's run upload and AI in parallel if possible?
		// But AI depends on nothing but title. Let's run AI and Upload in parallel.

		// A. AI RESEARCH TASK
		const aiTask = async () => {
			try {
				// Convert files to Base64 efficiently
				const fileToBase64 = async (file) => {
					if (!file) return null;
					const arrayBuffer = await file.arrayBuffer();
					const uint8Array = new Uint8Array(arrayBuffer);

					// Use chunks to avoid stack overflow with String.fromCharCode.apply AND avoid string accel overhead
					let binary = '';
					const chunkSize = 8192; // 8KB chunks
					for (let i = 0; i < uint8Array.length; i += chunkSize) {
						const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
						binary += String.fromCharCode.apply(null, chunk);
					}
					return btoa(binary);
				};

				const pdfBase64 = await fileToBase64(fileProva);
				// Optional: Also send gabarito if needed, but usually Prova is enough for ID.

				const aiFiles = [];
				if (pdfBase64) {
					aiFiles.push({ mimeType: 'application/pdf', data: pdfBase64 });
				}

				// Step 1: SEARCH (Research Report) with FILE CONTEXT
				const searchPrompt = `Analise o(s) arquivo(s) PDF anexo(s) para identificar a prova com precisão. O título fornecido pelo usuário foi '${title}'. Se o arquivo contradizer o título, confie no arquivo. Faça um relatório extenso e detalhado sobre a prova real identificada. Inclua instituição, ano, fase, características da prova, e datas se encontrar. Pesquise profundamente na web.`;

				// Internal call to /search
				// We MUST construct a full URL for internal fetch in Workers if not using direct function call.
				// However, since we are in the same module, we can just call handleGeminiSearch?
				// handleGeminiSearch expects a Request object. Let's mock it.

				const searchReqBody = {
					texto: searchPrompt,
					model: 'models/gemini-3-flash-preview',
					apiKey: env.GOOGLE_GENAI_API_KEY,
					files: aiFiles, // Pass the PDF
				};
				const searchReq = new Request('http://internal/search', { method: 'POST', body: JSON.stringify(searchReqBody) });
				const searchRes = await handleGeminiSearch(searchReq, env);

				if (!searchRes.ok) throw new Error('AI Search failed');

				// Read stream and accumulate text
				const searchReader = searchRes.body.getReader();
				const decoder = new TextDecoder();
				let fullReport = '';
				while (true) {
					const { done, value } = await searchReader.read();
					if (done) break;
					const chunk = decoder.decode(value, { stream: true });
					const lines = chunk.split('\n');
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const json = JSON.parse(line);
							// /search endpoint returns { type: 'answer', text: ... } for content
							if (json.type === 'answer' && json.text) fullReport += json.text;
						} catch (e) {}
					}
				}

				console.log('[Manual Upload] AI Report generated.');

				// Step 2: EXTRACTION (Schema) with FILE CONTEXT + REPORT
				const extractionPrompt = `Com base no relatório abaixo e nos arquivos originais, extraia os metadados exatos no formato JSON.\n\nRELATÓRIO:\n${fullReport}`;
				const extractionSchema = {
					type: 'OBJECT',
					properties: {
						institution: { type: 'STRING' },
						year: { type: 'STRING' },
						phase: { type: 'STRING' },
						summary: { type: 'STRING' },
					},
					required: ['institution', 'year', 'phase'],
				};

				const genReqBody = {
					texto: extractionPrompt,
					schema: extractionSchema,
					model: 'models/gemini-3-flash-preview',
					apiKey: env.GOOGLE_GENAI_API_KEY,
					files: aiFiles, // Pass the PDF again for context
				};
				const genReq = new Request('http://internal/generate', { method: 'POST', body: JSON.stringify(genReqBody) });
				const genRes = await handleGeminiGenerate(genReq, env);

				if (!genRes.ok) throw new Error('AI Extraction failed');

				// Read stream
				const genReader = genRes.body.getReader();
				let fullJsonText = '';
				while (true) {
					const { done, value } = await genReader.read();
					if (done) break;
					const chunk = decoder.decode(value, { stream: true });
					const lines = chunk.split('\n');
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const json = JSON.parse(line);
							if (json.type === 'answer' && json.text) fullJsonText += json.text;
						} catch (e) {}
					}
				}

				return JSON.parse(fullJsonText);
			} catch (e) {
				console.error('AI Processing Error:', e);
				// Fallback with user provided title if AI completely dies
				return {
					institution: 'Desconhecida',
					year: new Date().getFullYear().toString(),
					phase: 'Única',
					summary: 'AI extraction failed.',
				};
			}
		};

		// EXECUTE PARALLEL
		const [uploadResults, aiData] = await Promise.all([Promise.all(uploadPromises), aiTask()]);

		const pdfUrl = uploadResults[0];
		const gabUrl = fileGabarito ? uploadResults[1] : null;

		if (!pdfUrl && !confirmOverride) {
			return new Response(JSON.stringify({ error: 'Failed to upload PDF to temporary storage' }), {
				status: 500,
				headers: corsHeaders,
			});
		}

		console.log('[Manual Upload] AI Data:', aiData);

		// 2. Generate/Validate Slug
		// AI now provides the slug, but we fallback if needed
		let slug = aiData.slug;
		if (!slug) {
			slug = title
				.toLowerCase()
				.trim()
				.replace(/[\s_]+/g, '-')
				.replace(/[^a-z0-9-]/g, '');
		}

		// 3. DUPLICATE CHECK (Unless Override)
		// 3. DUPLICATE CHECK (Unless Override)

		if (!confirmOverride) {
			try {
				const hfManifestUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/manifest.json`;
				const hfCheck = await fetch(hfManifestUrl, { method: 'HEAD' }); // HEAD is faster

				if (hfCheck.status === 200) {
					// Conflict found! Fetch the full manifest to show the user
					const fullManifestRes = await fetch(hfManifestUrl);
					const remoteManifest = await fullManifestRes.json();

					return new Response(
						JSON.stringify({
							success: false,
							status: 'conflict',
							slug,
							message: 'Prova encontrada no banco de dados.',
							remote_manifest: remoteManifest,
							ai_data: aiData,
							// Pass back valid upload URLs so we don't need to re-upload if they override
							temp_pdf_url: pdfUrl,
							temp_gabarito_url: gabUrl,
						}),
						{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
					);
				}
			} catch (e) {
				console.warn('HF Check failed, assuming new.', e);
			}
		}

		// 4. Dispatch GitHub Action
		const githubPat = env.GITHUB_PAT;
		const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
		const githubRepo = env.GITHUB_REPO || 'maia.api';

		const ghRes = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${githubPat}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Cloudflare-Worker',
			},
			body: JSON.stringify({
				event_type: 'manual-upload',
				client_payload: {
					slug,
					title,
					pdf_url: formData.get('pdf_url_override') || pdfUrl,
					gabarito_url: formData.get('gabarito_url_override') || gabUrl,
					mode: formData.get('mode') || 'overwrite',
					// Consolidate metadata to avoid 10 property limit (GitHub 422)
					metadata: {
						institution: aiData.institution,
						year: aiData.year,
						phase: aiData.phase,
						summary: aiData.summary,
						source_url_prova: sourceUrlProva,
						source_url_gabarito: sourceUrlGabarito,
					},
				},
			}),
		});

		if (!ghRes.ok) {
			const txt = await ghRes.text();
			console.error(`GitHub Dispatch Failed: ${ghRes.status} - ${txt}`);
			return new Response(JSON.stringify({ error: `GitHub Dispatch Failed: ${txt}` }), {
				status: 500, // or 503
				headers: corsHeaders,
			});
		}

		return new Response(
			JSON.stringify({
				success: true,
				slug,
				message: 'Upload started. AI Researching & Syncing...',
				ai_data: aiData,
				hf_url_preview: `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/prova.pdf`,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (e) {
		console.error('[Manual Upload Critical Error]', e);
		return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}
