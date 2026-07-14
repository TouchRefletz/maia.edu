import { GoogleGenAI as GoogleGenAIWeb } from '@google/genai';
import { GoogleGenAI as GoogleGenAINode } from '@google/genai/node';

const DEFAULT_MODELS = [
	'models/gemini-3.5-flash',
	'models/gemini-3-flash-preview',
	'models/gemini-3.1-flash-lite',
	'models/gemini-2.5-flash',
	'models/gemini-2.5-flash-lite',
	'models/gemma-4-31b-it',
	'models/gemma-4-26b-a4b-it',
];

const GITHUB_MODELS = [
	'github/gpt-5',
	'github/gpt-5-chat',
	'github/gpt-5-mini',
	'github/gpt-4.1',
	'github/gpt-4.1-mini',
	'github/gpt-4o',
	'github/gpt-4o-mini',
	'github/o1',
	'github/o3',
	'github/o3-mini',
	'github/o4-mini'
];

const GROQ_MODELS = [
	'groq/openai/gpt-oss-120b',
	'groq/gpt-oss-120b'
];

const VERTEX_MAAS_MODELS = [
	'vertex-maas/gpt-oss-120b'
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

		if (request.method !== 'POST' && url.pathname !== '/proxy-pdf' && url.pathname !== '/search-image' && url.pathname !== '/resolve-link') {
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

				case '/pinecone-query':
					return handlePineconeQuery(request, env);

				case '/search-image':
					return handleSearchImage(request, env);

				case '/search':
					return handleGeminiSearch(request, env);

				case '/proxy-pdf':
					return handleProxyPdf(request, env);

				case '/compute-hash':
					return handleComputeHash(request, env);

				case '/trigger-deep-search':
					return handleTriggerDeepSearch(request, env);

				case '/update-deep-search-cache':
					return handleDeepSearchUpdate(request, env);

				case '/cancel-deep-search':
					return handleCancelDeepSearch(request, env);

				case '/delete-pinecone-record':
					return handlePineconeDelete(request, env);

				case '/pinecone-clear-all':
					return handlePineconeClearAll(request, env);

				case '/manual-upload':
					return handleManualUpload(request, env);

				case '/delete-artifact':
					return handleDeleteArtifact(request, env);

				case '/canonical-slug':
					return handleCanonicalSlug(request, env);

				case '/resolve-link':
					return handleResolveLink(request, env);

				// --- EXTRACTION PIPELINE ---
				case '/trigger-extraction':
					return handleTriggerExtraction(request, env);

				case '/check-duplicate':
					return handleCheckDuplicate(request, env);

				case '/extract-and-save':
					return handleExtractAndSave(request, env);

				case '/check-question':
					return handleCheckQuestion(request, env);

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
 * SERVICE: SEARCH IMAGE API (Google Custom Search + Wikimedia Fallback)
 * Suporta parâmetro `exclude` (JSON array de URLs) para pular imagens que falharam no client (403, CORS, etc.)
 */
async function handleSearchImage(request, env) {
	const url = new URL(request.url);
	const query = url.searchParams.get('q');

	if (!query) {
		return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	// Parse URLs excluídas (imagens que deram erro no client)
	let excludedUrls = new Set();
	const excludeParam = url.searchParams.get('exclude');
	if (excludeParam) {
		try {
			const parsed = JSON.parse(excludeParam);
			if (Array.isArray(parsed)) {
				excludedUrls = new Set(parsed);
				console.log(`[Image Search] Excluindo ${excludedUrls.size} URL(s) que falharam no client`);
			}
		} catch (e) {
			console.warn('[Image Search] Falha ao parsear exclude param:', e.message);
		}
	}

	const googleApiKey = env.GOOGLE_SEARCH_API_KEY;
	const googleEngineId = env.GOOGLE_SEARCH_ENGINE_ID;

	// 1. Tenta Busca via Google Custom Search API (pede até 5 resultados para ter alternativas)
	if (googleApiKey && googleEngineId) {
		try {
			const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleEngineId}&q=${encodeURIComponent(query)}&searchType=image&num=5`;
			const googleResp = await fetch(googleUrl);

			if (googleResp.ok) {
				const data = await googleResp.json();
				if (data.items && data.items.length > 0) {
					// Filtra itens excluídos e retorna o primeiro válido
					const validItem = data.items.find((item) => item.link && !excludedUrls.has(item.link));
					if (validItem) {
						return new Response(JSON.stringify({ url: validItem.link, source: 'google' }), {
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}
					console.warn('[Image Search] Todos os resultados do Google estão na lista de excluídos');
				}
			} else {
				console.warn('[Image Search] Google API falhou, indo para o fallback:', await googleResp.text());
			}
		} catch (error) {
			console.error('[Image Search] Erro no Google API:', error.message);
		}
	}

	// 2. Fallback: Wikimedia Commons API (pede até 5 resultados)
	try {
		console.log(`[Image Search] Fallback: Buscando "${query}" na Wikimedia Commons...`);
		const wikiUrl = `https://pt.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=pageimages&pithumbsize=800&format=json&origin=*`;

		const wikiResp = await fetch(wikiUrl);
		if (wikiResp.ok) {
			const data = await wikiResp.json();
			const pages = data.query?.pages;

			if (pages) {
				// A API retorna um objeto cujas chaves são os page IDs
				// Itera todos os resultados e pega o primeiro com thumbnail que não está excluído
				const pageIds = Object.keys(pages);
				for (const pageId of pageIds) {
					const imageUrl = pages[pageId]?.thumbnail?.source;
					if (imageUrl && !excludedUrls.has(imageUrl)) {
						return new Response(JSON.stringify({ url: imageUrl, source: 'wikimedia' }), {
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}
				}
				console.warn('[Image Search] Todos os resultados do Wikimedia estão na lista de excluídos');
			}
		}
	} catch (error) {
		console.error('[Image Search] Erro no Wikimedia API Fallback:', error.message);
	}

	// 3. Nenhuma imagem encontrada
	return new Response(JSON.stringify({ error: 'Nenhuma imagem encontrada', source: 'none' }), {
		status: 404,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

/**
 * Helper to check if there is a year mismatch between the user's query and a Pinecone match.
 */
function hasYearMismatch(query, match) {
	const extractYears = (str) => {
		if (!str) return [];
		const normalized = str.replace(/[^0-9]/g, ' ');
		return normalized.match(/\b(19\d{2}|20\d{2})\b/g) || [];
	};

	const queryYears = extractYears(query);
	if (queryYears.length === 0) {
		return false; // No year specified in the user query, so no mismatch possible
	}

	const matchYears = new Set();
	if (match.metadata?.year) {
		const parsedYear = String(match.metadata.year).trim();
		const extracted = extractYears(parsedYear);
		for (const y of extracted) matchYears.add(y);
	}
	if (match.metadata?.slug) {
		const extracted = extractYears(match.metadata.slug);
		for (const y of extracted) matchYears.add(y);
	}
	if (match.metadata?.query) {
		const extracted = extractYears(match.metadata.query);
		for (const y of extracted) matchYears.add(y);
	}

	if (matchYears.size === 0) {
		return false; // Match has no year info, so no definitive mismatch
	}

	const hasIntersection = queryYears.some((y) => matchYears.has(y));
	return !hasIntersection;
}

/**
 * SERVICE: TRIGGER DEEP SEARCH (GITHUB ACTIONS)
 */
async function handleTriggerDeepSearch(request, env) {
	const body = await request.json();
	const { query, ntfy_topic, force, cleanup, confirm, mode, search_type, search_model, region_model, extract_model } = body;

	let finalSearchModel = search_model;
	if (!finalSearchModel && (region_model || extract_model)) {
		finalSearchModel = region_model || extract_model;
	}
	if (finalSearchModel) {
		if (finalSearchModel.startsWith('models/')) {
			finalSearchModel = 'gemini/' + finalSearchModel.slice(7);
		} else if (!finalSearchModel.includes('/')) {
			finalSearchModel = 'gemini/' + finalSearchModel;
		}
	}

	// 1. Validate Input
	if (!query) {
		return new Response(JSON.stringify({ error: 'Query is required' }), { status: 400, headers: corsHeaders });
	}

	let canonicalSlug = body.slug; // Manual override
	let reasoning = 'Manual override';
	let exactMatch = null;
	let similarCandidates = [];
	let searchMethod = 'manual';

	// ============================================
	// FASE 1: BUSCA DIRETA NO PINECONE (Query do usuário)
	// Tenta encontrar match sem usar IA
	// ============================================
	if (!canonicalSlug && !force) {
		try {
			console.log(`[Deep Search] Fase 1: Buscando query direta no Pinecone: "${query}"`);

			const directEmbedding = await generateEmbedding(query, env.GOOGLE_GENAI_API_KEY);

			if (directEmbedding) {
				const directResult = await executePineconeQuery(directEmbedding, env, 10, {
					type: { $in: ['deep-search-result', 'manual-upload-result'] },
				});

				if (directResult?.matches?.length > 0) {
					const bestMatch = directResult.matches.find(
						(m) => m.score > 0.75 && m.metadata?.slug && !hasYearMismatch(query, m)
					);

					if (bestMatch) {
						canonicalSlug = bestMatch.metadata.slug;
						reasoning = `Pinecone direct match (score: ${(bestMatch.score * 100).toFixed(1)}%)`;
						searchMethod = 'pinecone-direct';

						console.log(`[Deep Search] Match forte encontrado: ${canonicalSlug} (${bestMatch.score})`);

						// Já define o exactMatch
						exactMatch = bestMatch;

						// Pega candidatos similares
						similarCandidates = directResult.matches
							.filter((m) => m.metadata && m.score > 0.75 && m.metadata.slug !== canonicalSlug)
							.map((m) => ({
								slug: m.metadata.slug,
								score: m.score,
								query: m.metadata.query,
								institution: m.metadata.institution,
								year: m.metadata.year,
								file_count: m.metadata.file_count,
								timestamp: m.metadata.updated_at,
							}));
					} else {
						// Match fraco ou incompatível por ano - guarda como candidatos
						console.log(`[Deep Search] Nenhum match forte e compatível por ano. Continuando para IA...`);
						similarCandidates = directResult.matches
							.filter((m) => m.metadata && m.score > 0.6)
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
			}
		} catch (e) {
			console.warn('[Deep Search] Fase 1 (Pinecone direto) error:', e);
		}
	}

	// ============================================
	// FASE 2: GERAÇÃO DE SLUG VIA IA (Fallback)
	// Só executa se não encontrou match forte na Fase 1
	// ============================================
	if (!canonicalSlug) {
		try {
			console.log(`[Deep Search] Fase 2: Gerando slug via IA para: "${query}"`);

			const slugReq = new Request('http://internal/canonical-slug', {
				method: 'POST',
				body: JSON.stringify({ query, search_type }),
			});
			const slugRes = await handleCanonicalSlug(slugReq, env);

			if (slugRes.ok) {
				const slugData = await slugRes.json();
				canonicalSlug = slugData.slug;
				reasoning = slugData.reasoning;
				searchMethod = 'ai-generated';
				console.log(`[Deep Search] Slug gerado pela IA: ${canonicalSlug} (${reasoning})`);
			} else {
				console.warn('[Deep Search] IA falhou, usando sanitização simples.');
				canonicalSlug = query
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '');
				searchMethod = 'sanitized-fallback';
			}
		} catch (e) {
			console.error('[Deep Search] Fase 2 (IA) error:', e);
			canonicalSlug = query
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
			searchMethod = 'sanitized-fallback';
		}
	}

	// ============================================
	// FASE 3: BUSCA PINECONE COM SLUG DA IA
	// Verifica se o slug gerado pela IA já existe
	// ============================================
	if (searchMethod === 'ai-generated' && !force && !exactMatch) {
		try {
			console.log(`[Deep Search] Fase 3: Verificando slug da IA no Pinecone: "${canonicalSlug}"`);

			const slugSearchParam = canonicalSlug.replace(/-/g, ' ');
			const slugEmbedding = await generateEmbedding(slugSearchParam, env.GOOGLE_GENAI_API_KEY);

			if (slugEmbedding) {
				const slugResult = await executePineconeQuery(slugEmbedding, env, 10, {
					type: { $in: ['deep-search-result', 'manual-upload-result'] },
				});

				if (slugResult?.matches) {
					// Procura match exato com o slug
					exactMatch = slugResult.matches.find((m) => m.metadata?.slug === canonicalSlug);

					// Atualiza candidatos similares
					if (!exactMatch && slugResult.matches.length > 0) {
						const topMatch = slugResult.matches[0];
						if (topMatch.score > 0.85 && topMatch.metadata?.slug) {
							console.log(`[Deep Search] Pinecone sugeriu slug diferente: ${topMatch.metadata.slug}`);
							similarCandidates = [
								{
									slug: topMatch.metadata.slug,
									score: topMatch.score,
									query: topMatch.metadata.query,
									institution: topMatch.metadata.institution,
									year: topMatch.metadata.year,
									file_count: topMatch.metadata.file_count,
									timestamp: topMatch.metadata.updated_at,
								},
								...similarCandidates.filter((c) => c.slug !== topMatch.metadata.slug),
							];
						}
					}
				}
			}
		} catch (e) {
			console.warn('[Deep Search] Fase 3 (Verificação slug IA) error:', e);
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
				search_type: search_type || 'provas', // 'provas' ou 'questoes'
				search_model: finalSearchModel || '',
				region_model: region_model || '',
				extract_model: extract_model || '',
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
	const { slug, filename, filenames } = body;

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
					filename, // Legacy singular support
					filenames, // New batched support
					manifest_only: body.manifest_only || false,
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
 * SERVICE: COMPUTE HASH (Proxy to GitHub Actions)
 */
async function handleComputeHash(request, env) {
	// Wrap everything in try/catch to ensure errors are logged and returned as JSON 500
	try {
		const body = await request.json();
		const { url, slug } = body;

		if (!url || !slug) {
			return new Response(JSON.stringify({ error: 'URL and Slug are required' }), { status: 400, headers: corsHeaders });
		}

		const githubPat = env.GITHUB_PAT;
		const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
		const githubRepo = env.GITHUB_REPO || 'maia.api';

		if (!githubPat) {
			throw new Error('GITHUB_PAT not configured');
		}

		// Use the FILENAME endpoint for workflow_dispatch
		// This matches .github/workflows/hash-service.yml config
		const workflowDispatchUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/hash-service.yml/dispatches`;

		const dispatchResp = await fetch(workflowDispatchUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${githubPat}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Cloudflare-Worker',
			},
			body: JSON.stringify({
				ref: 'master',
				inputs: {
					file_url: url,
					slug: slug,
				},
			}),
		});

		if (!dispatchResp.ok) {
			const text = await dispatchResp.text();
			throw new Error(`GitHub Dispatch Error: ${dispatchResp.status} - ${text}`);
		}

		return new Response(JSON.stringify({ success: true, message: 'Hash Computation Triggered' }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('[Compute Hash Error]', error);
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
				type: metadata.type || 'deep-search-result', // Allow manual override (e.g. 'manual-upload-result')
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
 * SERVICE: CLEAR ALL PINECONE VECTORS
 * Clears all vectors in a namespace for the given target index
 */
async function handlePineconeClearAll(request, env) {
	try {
		const body = await request.json();
		const { target } = body || {};

		await executePineconeClearAll(target || 'default', env);

		return new Response(JSON.stringify({ success: true, message: `Cleared all vectors for target: ${target || 'default'}` }), {
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
async function generateEmbedding(text, authOptions, model = 'models/gemini-embedding-001') {
	let client;
	let finalModel = model;
	if (authOptions && typeof authOptions === 'object' && authOptions.vertexProjectId && authOptions.vertexCredentials) {
		client = new GoogleGenAINode({
			vertexai: true,
			project: authOptions.vertexProjectId,
			location: authOptions.vertexLocation || 'us-central1',
			googleAuthOptions: {
				credentials: typeof authOptions.vertexCredentials === 'string' ? JSON.parse(authOptions.vertexCredentials) : authOptions.vertexCredentials,
			},
		});
		finalModel = model.replace(/^models\//, '');
	} else {
		const apiKey = typeof authOptions === 'string' ? authOptions : (authOptions?.apiKey || authOptions?.GOOGLE_GENAI_API_KEY);
		if (!apiKey) throw new Error('API Key missing for embedding');
		client = new GoogleGenAIWeb({ apiKey });
	}
	const result = await client.models.embedContent({
		model: finalModel,
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
/**
 * HELPER: Shared Pinecone Query
 */
async function executePineconeQuery(vector, env, topK = 1, filter = {}, target = 'default', namespace = '') {
	// 1. Determine Host based on Target
	let pineconeHost = env.PINECONE_HOST;

	if (target === 'filter') {
		if (!env.PINECONE_HOST_FILTER) {
			console.error('[Pinecone Query] PINECONE_HOST_FILTER required for target=filter');
			return null;
		}
		pineconeHost = env.PINECONE_HOST_FILTER;
	} else if (target === 'deep-search') {
		// Strict check for Deep Search Host
		pineconeHost = env.PINECONE_HOST_DEEP_SEARCH;
	} else if (target === 'maia-memory') {
		pineconeHost = env.PINECONE_HOST_MEMORY;
	} else {
		// Default fallback logic (existing)
		const isDeepSearchQuery =
			filter.type === 'deep-search-result' || (filter.type && filter.type['$in'] && filter.type['$in'].includes('deep-search-result'));

		if (isDeepSearchQuery) {
			pineconeHost = env.PINECONE_HOST_DEEP_SEARCH;
		} else {
			pineconeHost = env.PINECONE_HOST || env.PINECONE_HOST_DEEP_SEARCH;
		}
	}

	const apiKey = env.PINECONE_API_KEY;

	if (!pineconeHost || !apiKey) {
		console.error('[Pinecone Query] Host or API Key missing', { pineconeHost });
		return null;
	}

	const endpoint = `${pineconeHost}/query`;

	const body = {
		vector,
		topK,
		filter,
		includeMetadata: true,
	};

	if (namespace) {
		body.namespace = namespace;
	}

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Api-Key': apiKey,
			'Content-Type': 'application/json',
			'X-Pinecone-API-Version': '2024-07',
		},
		body: JSON.stringify(body),
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
async function executePineconeUpsert(vectors, env, namespace = '', target = 'default') {
	let pineconeHost = env.PINECONE_HOST;

	// 1. Determine Host based on Target
	if (target === 'filter') {
		if (!env.PINECONE_HOST_FILTER) {
			throw new Error('PINECONE_HOST_FILTER is not configured! Cannot save to filter index.');
		}
		pineconeHost = env.PINECONE_HOST_FILTER;
		console.log(`[Pinecone Upsert] Using FILTER host: ${pineconeHost}`);
	} else if (target === 'maia-memory') {
		pineconeHost = env.PINECONE_HOST_MEMORY;
		console.log(`[Pinecone Upsert] Using MEMORY host: ${pineconeHost}`);
	} else {
		// Checks if any vector is a deep search or manual upload result
		const isDeepSearch = vectors.some(
			(v) => v.metadata && (v.metadata.type === 'deep-search-result' || v.metadata.type === 'manual-upload-result'),
		);

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
	const {
		texto,
		schema,
		listaImagensBase64 = [],
		mimeType = 'image/jpeg',
		model,
		vertexModelId,
		apiKey: userApiKey,
		githubApiKey: userGithubApiKey,
		vertexProjectId: bodyVertexProjectId,
		vertexLocation: bodyVertexLocation,
		vertexCredentials: bodyVertexCredentials,
		jsonMode = true,
		thinking = true,
		chatMode = false,
		history = [],
		systemInstruction,
		generationConfig,
	} = body;

	const vertexProjectId = bodyVertexProjectId || env.VERTEX_PROJECT_ID;
	const vertexLocation = bodyVertexLocation || env.VERTEX_LOCATION;
	const vertexCredentials = bodyVertexCredentials || env.VERTEX_CREDENTIALS;

	let finalHistory = history || [];
	if (finalHistory.length > 0 && ('content' in finalHistory[0] || finalHistory[0].role === 'assistant' || finalHistory[0].role === 'system')) {
		finalHistory = mapOpenAIHistoryToGemini(finalHistory);
	}

	const useVertex = model ? model.startsWith('vertex/') : !!(vertexProjectId && vertexCredentials);

	let clientAIStudio = null;
	let clientVertex = null;

	const getClient = (useVertexForAttempt) => {
		if (useVertexForAttempt) {
			if (!clientVertex) {
				if (!vertexProjectId || !vertexCredentials) {
					throw new Error('Vertex AI project ID and credentials must be configured to use Vertex AI.');
				}
				clientVertex = new GoogleGenAINode({
					vertexai: true,
					project: vertexProjectId,
					location: vertexLocation || 'us-central1',
					googleAuthOptions: {
						credentials: typeof vertexCredentials === 'string' ? JSON.parse(vertexCredentials) : vertexCredentials,
					},
					httpOptions: { timeout: 300000 },
				});
			}
			return clientVertex;
		} else {
			if (!clientAIStudio) {
				const finalApiKey = userApiKey || env.GOOGLE_GENAI_API_KEY;
				if (!finalApiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured');
				clientAIStudio = new GoogleGenAIWeb({
					apiKey: finalApiKey,
					httpOptions: { timeout: 300000 },
				});
			}
			return clientAIStudio;
		}
	};

	// Modelos iniciais: Se o usuário/cliente solicitou um modelo específico, respeita e tenta APENAS ele.
	let initialModels;
	if (model) {
		initialModels = [model];
	} else {
		initialModels = [...DEFAULT_MODELS, ...GITHUB_MODELS, ...GROQ_MODELS, ...VERTEX_MAAS_MODELS];
	}

	// Fallbacks específicos pra RECITATION
	const RECITATION_FALLBACKS = ['models/gemini-flash-latest', 'models/gemini-flash-lite-latest'];

	const encoder = new TextEncoder();

	let textWithFiles = texto || '';
	const nonTextParts = [];

	// Helper to process files/images
	const processAttachments = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;
				let name = 'arquivo';

				// Handle object structure { mimeType, data }
				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
					if (item.name) name = item.name;
				}
				// Handle base64 string with prefix
				else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}

				if (isTextMimeType(mimeType)) {
					const decodedText = decodeBase64ToUtf8(data);
					textWithFiles += `\n\n=== CONTEÚDO DO ARQUIVO ANEXADO [${name}] ===\n${decodedText}\n=============================================\n`;
				} else {
					nonTextParts.push({ inlineData: { mimeType, data } });
				}
			});
		}
	};

	processAttachments(listaImagensBase64, mimeType);
	// Handle generic files (PDFs, etc) passed in body.files
	if (body.files) {
		processAttachments(body.files, 'application/pdf');
	}

	// Prepare parts
	const parts = [];
	if (textWithFiles) {
		parts.push({ text: textWithFiles });
	}
	parts.push(...nonTextParts);

	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	// Envia imediatamente uma quebra de linha para abrir o stream e evitar erro 524 de proxy timeout do Cloudflare
	writer.write(encoder.encode('\n'));

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

			const useVertexForAttempt = modelo.startsWith('vertex/') || 
				(modelo.startsWith('models/') && !modelo.toLowerCase().includes('gemma') && useVertex);

			attemptHistory.push({ attempt, model: modelo, status: 'started' });
			await writeNdjson({ type: 'meta', event: 'attempt_start', attempt, model: modelo, vertex: useVertexForAttempt });

			let wroteSomethingThisAttempt = false;
			const wrappedWriteNdjson = async (obj) => {
				if (obj && (obj.type === 'answer' || obj.type === 'thought')) {
					wroteSomethingThisAttempt = true;
				}
				await writeNdjson(obj);
			};

			try {
				if (modelo.startsWith('github/') || GITHUB_MODELS.includes(modelo)) {
					await handleGithubGenerateStream(modelo, body, env, attempt, wrappedWriteNdjson);
					attemptHistory[attemptHistory.length - 1].status = 'success';
					success = true;
					break;
				}

				if (modelo.startsWith('groq/') || GROQ_MODELS.includes(modelo)) {
					await handleGroqGenerateStream(modelo, body, env, attempt, wrappedWriteNdjson);
					attemptHistory[attemptHistory.length - 1].status = 'success';
					success = true;
					break;
				}

				if (modelo.startsWith('vertex-maas/') || VERTEX_MAAS_MODELS.includes(modelo)) {
					await handleVertexMaaSGenerateStream(modelo, body, env, attempt, wrappedWriteNdjson);
					attemptHistory[attemptHistory.length - 1].status = 'success';
					success = true;
					break;
				}

				let stream;
				const config = {
					...((thinking && (modelo.includes('gemma-4') || modelo.includes('thinking'))) ? {
						thinkingConfig: {
							includeThoughts: true,
						}
					} : {}),
					responseMimeType: jsonMode ? 'application/json' : undefined,
					responseJsonSchema: jsonMode ? schema || undefined : undefined,
					safetySettings,
					maxOutputTokens: jsonMode ? 8192 : undefined,
					...generationConfig,
				};

				// O SDK @google/genai prefere responseJsonSchema se disponível para suportar $ref e definitions.
				// Se ambos estiverem presentes, o Vertex AI rejeita a chamada.
				if (config.responseJsonSchema) {
					delete config.responseSchema;
				}

				const modelToUse = useVertexForAttempt 
					? ((modelo === model && vertexModelId) ? vertexModelId : modelo.replace(/^vertex\//, '').replace(/^models\//, '')) 
					: modelo;

				const systemInstructionConfig = systemInstruction
					? (typeof systemInstruction === 'string'
						? { parts: [{ text: systemInstruction }] }
						: systemInstruction)
					: undefined;

				// LOGGING FOR DEBUGGING
				console.log("=================== WORKER INTERNAL EXECUTION ===================");
				console.log(`[Modelo]: ${modelo} | [ModelToUse]: ${modelToUse} | [UseVertexForAttempt]: ${useVertexForAttempt}`);
				console.log(`[SystemInstruction (Raw)]:`, systemInstruction);
				console.log(`[SystemInstruction (Config)]:`, JSON.stringify(systemInstructionConfig, null, 2));
				console.log(`[Config]:`, JSON.stringify(config, null, 2));
				console.log("=================================================================");

				await writeNdjson({
					type: 'debug',
					attempt,
					model: modelo,
					text: `[Worker Gen] SystemInstruction Configured: ${JSON.stringify(systemInstructionConfig)}`
				});

				const client = getClient(useVertexForAttempt);

				if (chatMode) {
					// NOTE: create() config usually takes systemInstruction, tools, etc.
					const chat = client.chats.create({
						model: modelToUse,
						history: finalHistory,
						config: {
							systemInstruction: systemInstructionConfig,
						},
					});
					stream = await chat.sendMessageStream({
						message: { role: 'user', parts },
						config,
					});
				} else {
					stream = await client.models.generateContentStream({
						model: modelToUse,
						contents: [{ role: 'user', parts }],
						config: {
							...config,
							systemInstruction: systemInstructionConfig,
						},
					});
				}

				for await (const chunk of stream) {
					const cand = chunk?.candidates?.[0];
					const partsResp = cand?.content?.parts || [];

					// Sempre escreva os parts (streaming incremental)
					for (const part of partsResp) {
						if (!part?.text) continue;

						if (part.thought) {
							// Se a API retornar um part = { text: "...", thought: true } ou algo similiar, manda pra thought
							await wrappedWriteNdjson({ type: 'thought', attempt, model: modelo, text: part.text });
						} else {
							await wrappedWriteNdjson({ type: 'answer', attempt, model: modelo, text: part.text });
						}
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

				// Se escreveu algo nesta tentativa, limpa no front para o próximo modelo começar limpo
				if (wroteSomethingThisAttempt) {
					await writeNdjson({
						type: 'reset',
						attempt,
						model: modelo,
						reason: 'FAIL_FALLBACK',
						clear: 'attempt',
					});
				}

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
	const {
		texto,
		model,
		apiKey,
		vertexProjectId: bodyVertexProjectId,
		vertexLocation: bodyVertexLocation,
		vertexCredentials: bodyVertexCredentials,
	} = body;

	const vertexProjectId = bodyVertexProjectId || env.VERTEX_PROJECT_ID;
	const vertexLocation = bodyVertexLocation || env.VERTEX_LOCATION;
	const vertexCredentials = bodyVertexCredentials || env.VERTEX_CREDENTIALS;

	let authOptions;
	if (vertexProjectId && vertexCredentials) {
		authOptions = {
			vertexProjectId,
			vertexLocation,
			vertexCredentials,
		};
	} else {
		const finalApiKey = apiKey || env.GOOGLE_GENAI_API_KEY;
		if (!finalApiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured');
		authOptions = finalApiKey;
	}

	const embeddingValues = await generateEmbedding(texto, authOptions, model);

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
	const { vectors, namespace = '', target = 'default' } = body; // Default namespace empty

	if (!vectors || !Array.isArray(vectors)) throw new Error('Vectors array is required');

	const result = await executePineconeUpsert(vectors, env, namespace, target);

	return new Response(JSON.stringify(result), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

/**
 * 4.1 SERVICE: PINECONE QUERY
 * Recebe: { vector: [], topK: 1, filter: {}, target: 'default'|'filter', namespace: '' }
 */
async function handlePineconeQuery(request, env) {
	const body = await request.json();
	const { vector, topK = 1, filter = {}, target = 'default', namespace = '' } = body;

	if (!vector || !Array.isArray(vector)) throw new Error('Vector array is required');

	const result = await executePineconeQuery(vector, env, topK, filter, target, namespace);

	return new Response(JSON.stringify(result || { matches: [] }), {
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

	// SAFETY/WORKAROUND: Cloudflare edge cannot negotiate SSL handshake (525) with download.inep.gov.br.
	// Since download.inep.gov.br supports CORS (Access-Control-Allow-Origin: *), redirect the browser to fetch it directly.
	if (targetUrl.includes('download.inep.gov.br')) {
		return new Response(null, {
			status: 302,
			headers: {
				...corsHeaders,
				'Location': targetUrl,
			},
		});
	}

	try {
		let currentUrl = targetUrl;
		let response = null;
		let headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
		};

		// Only add HF_TOKEN if targeting huggingface.co and NOT a redirected storage URL
		// This prevents leaking tokens to S3/CDN if we followed a redirect previously (though logic here is fresh per request)
		if (currentUrl.includes('huggingface.co') && env.HF_TOKEN) {
			headers['Authorization'] = `Bearer ${env.HF_TOKEN}`;
		}

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

		const contentType = response.headers.get('content-type') || '';

		// Check for obvious error types disguised as 200 OK or legitimate errors
		if (contentType.includes('text/html') || contentType.includes('application/xml') || contentType.includes('text/xml')) {
			// Read body to see error
			const textBody = await response.text();
			console.warn(`[Proxy] Upstream returned non-PDF (${contentType}):`, textBody.substring(0, 500));
			return new Response(`Error: Upstream returned ${contentType} (Status ${response.status}). Body: ${textBody.substring(0, 200)}`, {
				status: 502, // Bad Gateway equivalent
				headers: corsHeaders,
			});
		}

		if (!response.ok) {
			return new Response(`Failed to fetch PDF: ${response.status}`, { status: response.status, headers: corsHeaders });
		}

		// Stream the response body directly
		return new Response(response.body, {
			headers: {
				...corsHeaders,
				'Content-Type': 'application/pdf', // Force PDF if we are reasonably sure, or use response contentType
				'Cache-Control': 'public, max-age=3600',
				'Content-Disposition': response.headers.get('Content-Disposition') || 'inline; filename="document.pdf"',
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
	const {
		texto,
		schema,
		listaImagensBase64 = [],
		model,
		vertexModelId,
		apiKey: userApiKey,
		vertexProjectId: bodyVertexProjectId,
		vertexLocation: bodyVertexLocation,
		vertexCredentials: bodyVertexCredentials,
	} = body;

	const vertexProjectId = bodyVertexProjectId || env.VERTEX_PROJECT_ID;
	const vertexLocation = bodyVertexLocation || env.VERTEX_LOCATION;
	const vertexCredentials = bodyVertexCredentials || env.VERTEX_CREDENTIALS;

	const useVertex = model ? model.startsWith('vertex/') : !!(vertexProjectId && vertexCredentials);

	let clientAIStudio = null;
	let clientVertex = null;

	const getClient = (useVertexForAttempt) => {
		if (useVertexForAttempt) {
			if (!clientVertex) {
				if (!vertexProjectId || !vertexCredentials) {
					throw new Error('Vertex AI project ID and credentials must be configured to use Vertex AI.');
				}
				clientVertex = new GoogleGenAINode({
					vertexai: true,
					project: vertexProjectId,
					location: vertexLocation || 'us-central1',
					googleAuthOptions: {
						credentials: typeof vertexCredentials === 'string' ? JSON.parse(vertexCredentials) : vertexCredentials,
					},
					httpOptions: { timeout: 300000 },
				});
			}
			return clientVertex;
		} else {
			if (!clientAIStudio) {
				const finalApiKey = userApiKey || env.GOOGLE_GENAI_API_KEY;
				if (!finalApiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured');
				clientAIStudio = new GoogleGenAIWeb({
					apiKey: finalApiKey,
					httpOptions: { timeout: 300000 },
				});
			}
			return clientAIStudio;
		}
	};

	// Modelos iniciais
	const initialModels = model ? [model] : DEFAULT_MODELS;

	// Fallbacks
	const RECITATION_FALLBACKS = ['models/gemini-flash-latest', 'models/gemini-flash-lite-latest'];

	const encoder = new TextEncoder();

	let textWithFiles = texto || '';
	const nonTextParts = [];

	// Helper to process files/images (Shared logic, copied for independence)
	const processAttachments = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;
				let name = 'arquivo';

				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
					if (item.name) name = item.name;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}
				if (isTextMimeType(mimeType)) {
					const decodedText = decodeBase64ToUtf8(data);
					textWithFiles += `\n\n=== CONTEÚDO DO ARQUIVO ANEXADO [${name}] ===\n${decodedText}\n=============================================\n`;
				} else {
					nonTextParts.push({ inlineData: { mimeType, data } });
				}
			});
		}
	};

	processAttachments(listaImagensBase64, 'image/jpeg');
	if (body.files) {
		processAttachments(body.files, 'application/pdf');
	}

	// Prepare parts
	const parts = [];
	if (textWithFiles) {
		parts.push({ text: textWithFiles });
	}
	parts.push(...nonTextParts);

	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	// Envia imediatamente uma quebra de linha para abrir o stream e evitar erro 524 de proxy timeout do Cloudflare
	writer.write(encoder.encode('\n'));

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

			const useVertexForAttempt = modelo.startsWith('vertex/') || 
				(modelo.startsWith('models/') && !modelo.toLowerCase().includes('gemma') && useVertex);

			try {
				await writeNdjson({ type: 'meta', event: 'attempt_start', model: modelo, vertex: useVertexForAttempt });

				const generationConfig = {
					tools: [{ googleSearch: {} }],
					safetySettings,
					...((modelo.includes('gemma-4') || modelo.includes('thinking')) ? {
						thinkingConfig: {
							includeThoughts: true,
						}
					} : {}),
				};

				if (schema) {
					generationConfig.responseMimeType = 'application/json';
					generationConfig.responseJsonSchema = schema;
				}

				const modelToUse = useVertexForAttempt 
					? ((modelo === model && vertexModelId) ? vertexModelId : modelo.replace(/^vertex\//, '').replace(/^models\//, '')) 
					: modelo;
				
				// LOGGING FOR DEBUGGING
				console.log("=================== WORKER INTERNAL SEARCH ===================");
				console.log(`[Modelo]: ${modelo} | [ModelToUse]: ${modelToUse} | [UseVertexForAttempt]: ${useVertexForAttempt}`);
				console.log(`[GenerationConfig]:`, JSON.stringify(generationConfig, null, 2));
				console.log("==============================================================");

				const client = getClient(useVertexForAttempt);
				const stream = await client.models.generateContentStream({
					model: modelToUse,
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

						if (part.thought) {
							await writeNdjson({ type: 'thought', text: part.text });
						} else {
							await writeNdjson({ type: 'answer', text: part.text });
						}
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
 * HELPER: Delete vector by ID from the default Pinecone host
 */
async function executePineconeDeleteById(pineconeId, env) {
	const pineconeHost = env.PINECONE_HOST || env.PINECONE_HOST_DEEP_SEARCH;
	const apiKey = env.PINECONE_API_KEY;

	if (!pineconeHost || !apiKey) {
		console.warn('PINECONE_HOST or PINECONE_API_KEY missing, skipping delete.');
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
			ids: [pineconeId],
		}),
	});

	if (!response.ok) {
		const txt = await response.text();
		throw new Error(`Pinecone Delete ID Error: ${txt}`);
	}

	return await response.json();
}

/**
 * HELPER: Clear all vectors from Pinecone for a given target index
 */
async function executePineconeClearAll(target, env) {
	const hostsToClear = [];
	
	if (target === 'filter') {
		if (env.PINECONE_HOST_FILTER) {
			hostsToClear.push(env.PINECONE_HOST_FILTER);
		} else {
			throw new Error('PINECONE_HOST_FILTER is not configured! Cannot clear filter index.');
		}
	} else if (target === 'maia-memory') {
		if (env.PINECONE_HOST_MEMORY) {
			hostsToClear.push(env.PINECONE_HOST_MEMORY);
		} else {
			throw new Error('PINECONE_HOST_MEMORY is not configured! Cannot clear memory index.');
		}
	} else {
		// Clear both PINECONE_HOST and PINECONE_HOST_DEEP_SEARCH if defined
		if (env.PINECONE_HOST) {
			hostsToClear.push(env.PINECONE_HOST);
		}
		if (env.PINECONE_HOST_DEEP_SEARCH && !hostsToClear.includes(env.PINECONE_HOST_DEEP_SEARCH)) {
			hostsToClear.push(env.PINECONE_HOST_DEEP_SEARCH);
		}
		if (hostsToClear.length === 0) {
			throw new Error('No Pinecone hosts configured for target default.');
		}
	}

	const apiKey = env.PINECONE_API_KEY;
	if (!apiKey) {
		throw new Error('PINECONE_API_KEY is not configured.');
	}

	const errors = [];
	for (const host of hostsToClear) {
		try {
			const endpoint = `${host}/vectors/delete`;
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Api-Key': apiKey,
					'Content-Type': 'application/json',
					'X-Pinecone-API-Version': '2024-07',
				},
				body: JSON.stringify({
					deleteAll: true,
				}),
			});

			if (!response.ok) {
				const txt = await response.text();
				errors.push(`Host ${host} error: ${txt}`);
			}
		} catch (e) {
			errors.push(`Host ${host} failed: ${e.message}`);
		}
	}

	if (errors.length > 0) {
		throw new Error(`Failed to clear some Pinecone hosts: ${errors.join(' | ')}`);
	}

	return { success: true };
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

		const confirmOverride = formData.get('confirm_override') === 'true';
		const inputVisualHash = formData.get('visual_hash');
		const inputVisualHashGab = formData.get('visual_hash_gabarito');
		const slugCodinome = formData.get('slug_codinome');

		if ((!fileProva && !confirmOverride) || !title) {
			return new Response(JSON.stringify({ error: 'Prova and Title are required' }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		console.log(`[Manual Upload] Starting AI Research & Upload for: ${title}`);

		// 1. USE PROVIDED URLS (From Frontend TmpFiles)
		const pdfUrl = formData.get('pdf_url_override');
		const gabUrl = formData.get('gabarito_url_override');

		if (!pdfUrl && !sourceUrlProva && !confirmOverride) {
			return new Response(JSON.stringify({ error: 'PDF URL or Source Link is required' }), {
				status: 400,
				headers: corsHeaders,
			});
		}

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
				// We instruct the AI to generate standardized filenames for both files.
				const extractionPrompt = `Com base no relatório abaixo e nos arquivos originais, extraia os metadados exatos no formato JSON.
				TAMBÉM GERE OS NOMES DE ARQUIVO PADRONIZADOS.
				Padrão de nome: "{Instituição} {Ano} - {Fase/Etapa} - {Tipo/Versão da prova (se aplicável)}"
				Exemplo: "FUVEST 2024 - 1ª Fase - Prova V1", "UNICAMP 2023 - 2ª Fase - Gabarito", "ENEM 2022 - Dia 1 - Caderno 7 (Azul)"

				RELATÓRIO:
				${fullReport}`;
				const extractionSchema = {
					type: 'OBJECT',
					properties: {
						institution: { type: 'STRING' },
						year: { type: 'STRING' },
						phase: { type: 'STRING' },
						summary: { type: 'STRING' },
						formatted_title_prova: {
							type: 'STRING',
							description: 'Nome padronizado para o arquivo da prova (ex: FUVEST 2024 - 1ª Fase - Prova V1)',
						},
						formatted_title_gabarito: {
							type: 'STRING',
							description: 'Nome padronizado para o arquivo do gabarito (ex: FUVEST 2024 - 1ª Fase - Gabarito)',
						},
						formatted_title_general: {
							type: 'STRING',
							description: 'Nome geral para o conjunto prova+gabarito (ex: FUVEST 2024 - 1ª Fase)',
						},
					},
					required: ['institution', 'year', 'phase', 'formatted_title_prova', 'formatted_title_general'],
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
					formatted_title_general: title, // Fallback to user title
				};
			}
		};

		// 2. Determine/Generate Slug
		let slug = slugCodinome ? slugCodinome.trim() : '';
		if (slug === 'auto-detect') {
			slug = '';
		}

		let aiData = null;
		let foundProva = false;
		let foundGab = false;
		let remoteManifest = null;
		let manifestExists = false;

		// Proactively check if manifest already exists to reuse its metadata
		if (slug) {
			try {
				const hfManifestUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/manifest.json`;
				const hfCheck = await fetch(hfManifestUrl);
				if (hfCheck.status === 200) {
					remoteManifest = await hfCheck.json();
					manifestExists = true;
					console.log(`[Manual Upload] Existing manifest found for slug: ${slug}`);
				}
			} catch (e) {
				console.warn(`[Manual Upload] Failed to check/fetch manifest for slug ${slug}:`, e);
			}
		}

		// Retrieve metadata (aiData) from the manifest if it exists
		if (manifestExists && remoteManifest) {
			const items = Array.isArray(remoteManifest) ? remoteManifest : remoteManifest.results || remoteManifest.files || [];
			const firstItem = items[0];
			if (firstItem) {
				aiData = {
					institution: firstItem.instituicao || firstItem.institution || 'Desconhecida',
					year: (firstItem.ano || firstItem.year || new Date().getFullYear()).toString(),
					phase: firstItem.fase || firstItem.phase || 'Única',
					summary: firstItem.summary || 'Recuperado do manifesto existente.',
					formatted_title_general: firstItem.nome || firstItem.friendly_name || firstItem.name || slug,
					formatted_title_prova: firstItem.nome || firstItem.friendly_name || firstItem.name || slug,
				};
				console.log('[Manual Upload] Reused aiData from existing manifest:', aiData);
			}
		}

		// Run AI task to extract metadata if we don't have it yet
		if (!aiData) {
			if (fileProva) {
				aiData = await aiTask();
			} else {
				aiData = {
					institution: 'Desconhecida',
					year: new Date().getFullYear().toString(),
					phase: 'Única',
					summary: 'No file provided for AI analysis.',
					formatted_title_general: title && title !== 'Auto-Detect' ? title : (slug || 'Auto-Detect'),
				};
			}
			console.log('[Manual Upload] AI Data generated/fallback:', aiData);
		}

		// If slug was not provided/empty, generate it using the canonical slug service
		if (!slug) {
			const generalTitle = aiData.formatted_title_general || title;
			try {
				const slugReq = new Request('http://internal/canonical-slug', {
					method: 'POST',
					body: JSON.stringify({ query: generalTitle }),
				});
				const slugRes = await handleCanonicalSlug(slugReq, env);
				if (slugRes.ok) {
					const sData = await slugRes.json();
					slug = sData.slug;
					console.log(`[Manual Upload] Slug generated: ${slug}`);
				}
			} catch (e) {
				console.warn('[Manual Upload] Slug service failed:', e);
			}

			// Fallback if canonical service failed
			if (!slug) {
				slug = title
					.toLowerCase()
					.trim()
					.replace(/[\s_]+/g, '-')
					.replace(/[^a-z0-9-]/g, '');
			}
		}

		if (!slug || slug === 'auto-detect') {
			slug = 'temp-slug'; // Safe guard
		}

		// SANITIZE & FORCE
		const pdfCustomName = (formData.get('pdf_custom_name') || '').trim();
		const gabCustomName = (formData.get('gabarito_custom_name') || '').trim();

		// DEBUG LOGS (Force visible)
		console.log('[Worker] Keys:', [...formData.keys()]);
		console.log(`[Worker] CustomNames: PDF="${pdfCustomName}", GAB="${gabCustomName}"`);

		// 1. PHYSICAL FILENAME (Storage) - Priority: Custom > Original
		const sanitize = (n) => (n ? n.replace(/[^a-zA-Z0-9.-]/g, '_') : n);
		const pdfPhysicalName = sanitize(pdfCustomName || (fileProva && fileProva.name ? fileProva.name : 'FALLBACK_ERROR_PDF.pdf'));

		// 2. DISPLAY NAME (Presentation) - Priority: AI > Custom > Original
		const pdfDisplayName = aiData.formatted_title_prova || pdfPhysicalName.replace(/\.pdf$/i, '');

		// 3. DUPLICATE CHECK (Unless Override)
		let pdfUrlToDispatch = formData.get('pdf_url_override') || pdfUrl;

		// The "Final Name" for metadata starts as our physical target, but may be overwritten if dedup finds a hosted file.
		let pdfFinalPhysicalName = pdfPhysicalName;

		const fileGabarito = formData.get('fileGabarito');
		const gabPhysicalName = sanitize(gabCustomName || (fileGabarito && fileGabarito.name ? fileGabarito.name : ''));
		let gabFinalPhysicalName = gabPhysicalName;
		let gabDisplayName = aiData.formatted_title_gabarito || (gabPhysicalName ? gabPhysicalName.replace(/\.pdf$/i, '') : '');

		let gabUrlToDispatch = formData.get('gabarito_url_override') || gabUrl;

		// Determine if a gabarito is actually provided or referenced
		const hasGabarito = !!fileGabarito || !!inputVisualHashGab || !!gabUrlToDispatch;

		if (!confirmOverride && manifestExists && remoteManifest) {
			try {
				const items = Array.isArray(remoteManifest) ? remoteManifest : remoteManifest.results || remoteManifest.files || [];

				// --- CHECK PROVA ---
				if (inputVisualHash) {
					const match = items.find((item) => item.visual_hash === inputVisualHash);
					if (match) {
						console.log(`[Worker] Dedup: Prova found (${match.filename}). Skipping upload.`);
						foundProva = true;
						pdfUrlToDispatch = null;

						const fname = match.filename || match.path;
						if (fname) {
							pdfFinalPhysicalName = fname; // PRESERVE EXISTING PHYSICAL NAME
						}
					}
				}

				// --- CHECK GABARITO ---
				if (inputVisualHashGab && hasGabarito) {
					const matchGab = items.find((item) => item.visual_hash === inputVisualHashGab);
					if (matchGab) {
						console.log(`[Worker] Dedup: Gabarito found (${matchGab.filename}). Skipping upload.`);
						foundGab = true;
						gabUrlToDispatch = null;

						const fname = matchGab.filename || matchGab.path;
						if (fname) {
							gabFinalPhysicalName = fname; // PRESERVE EXISTING PHYSICAL NAME
						}
					}
				}

				// LOGIC: If all required files (Prova and/or Gabarito) are already found in the manifest,
				// we return success immediately.
				const provaSatisfied = !fileProva || foundProva;

				if (provaSatisfied) {
					return new Response(
						JSON.stringify({
							success: true,
							slug,
							message: 'Arquivo(s) já existente(s) encontrado(s) (Smart Deduplication).',
							ai_data: aiData,
							hf_url_preview: `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${pdfFinalPhysicalName}`,
							hf_url_gabarito: hasGabarito ? `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${gabFinalPhysicalName}` : null,
							is_deduplicated: true,
							dedup_status: {
								prova: foundProva ? 'hosted' : 'new',
								gabarito: hasGabarito ? (foundGab ? 'hosted' : 'new') : null,
							},
						}),
						{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
					);
				}

				// If partial, we proceed to dispatch. The found ones have URLs=null, new ones have tmpfiles URLs.
				const partialMsg = `[Worker] Partial deduplication: Prova=${foundProva ? 'Hosted' : 'New'}, Gab=${foundGab ? 'Hosted' : 'New'}. Dispatching hybrid request.`;
				console.log(partialMsg);
			} catch (e) {
				console.warn('HF Check failed, proceeding.', e);
			}
		}

		if (!manifestExists) {
			// 3b. NEW SLUG (Manual Upload Indexing)
			try {
				console.log(`[Worker] New slug detected: ${slug}. Indexing to Pinecone...`);

				// Generate Embedding for the SLUG (Canonical representation)
				const embeddingText = slug.replace(/-/g, ' ');
				const embedding = await generateEmbedding(embeddingText, env.GOOGLE_GENAI_API_KEY);

				const vector = {
					id: slug,
					values: embedding,
					metadata: {
						slug: slug,
						institution: aiData.institution,
						year: aiData.year ? parseInt(aiData.year) : new Date().getFullYear(),
						file_count: 2,
						type: 'manual-upload-result',
						source: 'manual-upload',
						query: slug.replace(/-/g, ' '),
						original_query: title,
						updated_at: new Date().toISOString(),
					},
				};

				await executePineconeUpsert([vector], env);
				console.log(`[Worker] Pinecone indexing successful for: ${slug}`);
			} catch (err) {
				console.warn('[Worker] Pinecone indexing failed (non-blocking):', err);
			}
		}

		// 4. Dispatch GitHub Action
		const githubPat = env.GITHUB_PAT;
		const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
		const githubRepo = env.GITHUB_REPO || 'maia.api';

		if (!githubPat) throw new Error('GITHUB_PAT not configured');

		const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`;

		console.log('[Worker] Dispatching to GitHub (Manifest Link Mode):', { slug });

		const ghRes = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${githubPat}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Cloudflare-Worker',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				event_type: 'manual-upload',
				client_payload: {
					slug,
					pdf_url: 'LEGACY_IGNORED',
					gabarito_url: 'LEGACY_IGNORED',

					title: aiData.formatted_title_general || title,

					source_url_prova: sourceUrlProva || '',
					source_url_gabarito: sourceUrlGabarito || '',
					visual_hash: inputVisualHash || '',
					visual_hash_gabarito: inputVisualHashGab || '',

					metadata: {
						year: aiData.year,
						institution: aiData.institution,
						phase: aiData.phase,
						summary: aiData.summary,

						source_url_prova: sourceUrlProva || '',
						source_url_gabarito: sourceUrlGabarito || '',

						pdf_filename: pdfFinalPhysicalName,
						gabarito_filename: hasGabarito ? gabFinalPhysicalName : '',
						pdf_display_name: pdfDisplayName,
						gabarito_display_name: hasGabarito ? gabDisplayName : '',
					},
				},
			}),
		});

		if (!ghRes.ok) {
			const txt = await ghRes.text();
			console.error(`GitHub Dispatch Failed: ${ghRes.status} - ${txt}`);
			return new Response(JSON.stringify({ error: `GitHub Dispatch Failed: ${txt}` }), {
				status: 500,
				headers: corsHeaders,
			});
		}

		// TELL FRONTEND TO MONITOR PUSHER
		return new Response(
			JSON.stringify({
				success: true,
				slug,
				message: 'Upload started. Monitoring progress...',
				ai_data: aiData,
				hf_url_preview: `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${pdfFinalPhysicalName}`,
				hf_url_gabarito: hasGabarito ? `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${gabFinalPhysicalName}` : null,
				should_monitor: true,
				dedup_status: {
					prova: foundProva ? 'hosted' : 'new',
					gabarito: hasGabarito ? (foundGab ? 'hosted' : 'new') : null,
				},
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

/**
 * 7. SERVICE: CANONICAL SLUG (Naming Authority)
 * Path: /internal/canonical-slug
 */
async function handleCanonicalSlug(request, env) {
	const body = await request.json();
	const { query, search_type = 'provas' } = body;

	if (!query) {
		return new Response(JSON.stringify({ error: 'Query is required' }), { status: 400, headers: corsHeaders });
	}

	let canonicalSlug = '';
	let reasoning = 'Manual override or fallback';

	try {
		const currentDate = new Date().toISOString();

		let prompt = '';
		if (search_type === 'questoes') {
			prompt = `You are a precise naming authority for document repositories. Your goal is to convert user queries for question sets into a standard 'canonical' kebab-case slug.

Rules:
1. Format: \`questoes-tema\` (e.g., \`questoes-geometria-analitica-ita\`, \`questoes-logaritmo\`).
2. Prefix MUST be 'questoes-'.
3. CRITICAL: You MUST STRIP all unnecessary words and keep only the core theme and institution (if any).
   
   Example: "questões enem 2025 de matematica" -> "questoes-matematica-enem-2025"
   Example: "lista de exercicios de logaritmo" -> "questoes-logaritmo"

Query: "${query}"

Output JSON ONLY.`;
		} else {
			prompt = `You are a precise naming authority for exam repositories. Your goal is to convert user queries into a standard 'canonical' kebab-case slug.

Rules:
1. Format: \`exam-name-year\` (e.g., \`enem-2024\`, \`ita-2025\`, \`fuvest-2024\`).
2. CRITICAL: You MUST STRIP all specific details such as:
   - Phase/Stage ("1ª Fase", "Segunda Etapa")
   - Day ("Dia 1", "Segundo Dia")
   - Booklet/Caderno ("Caderno 3", "Prova Azul", "Amarela")
   - Subject ("Matemática", "Humanas")
   
   Example: "ENEM 2025 Caderno 3 Dia 1" -> "enem-2025"
   Example: "Fuvest 2024 1ª Fase" -> "fuvest-2024"

3. Year Inference: If the user DOES NOT specify a year, you MUST infer the most recent *occurred* or *upcoming* edition based on the current date provided.
    - Current Date: ${currentDate}
    - Logic: If today is Dec 2025, 'Enem' implies 'enem-2025'. If user asks for 'Enem' in Jan 2025, it implies 'enem-2024' (last one) or 'enem-2025' (next one) based on typical exam schedule. Default to the *latest edition that likely has files available*.

Query: "${query}"

Output JSON ONLY.`;
		}

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
			console.warn('[Slug Service] Gemini generation failed, falling back to simple slug.');
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
				console.log(`[Slug Service] Canonical Slug Generated: ${canonicalSlug} (${reasoning})`);
			} catch (e) {
				console.warn('[Slug Service] Failed to parse Gemini JSON, fallback.', e);
				canonicalSlug = query
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '');
			}
		}
	} catch (e) {
		console.error('[Slug Service] Error in slug generation:', e);
		canonicalSlug = query
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	return new Response(JSON.stringify({ slug: canonicalSlug, reasoning }), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

// ============================================================
// EXTRACTION PIPELINE ENDPOINTS
// ============================================================

/**
 * SERVICE: TRIGGER EXTRACTION
 * Smart dispatch:
 * 1. Check if PDFs exist for the topic (Pinecone deep-search index)
 * 2. If PDFs exist → dispatch extract-questions.yml
 * 3. If no PDFs → dispatch deep-search.yml first (with search_type: questoes)
 * 4. If PDFs exist but needs_more → dispatch deep-search in update mode
 */
async function handleTriggerExtraction(request, env) {
	const body = await request.json();
	const { query, institution, subject, year, needs_more, region_model, extract_model, search_model, force } = body;

	let finalSearchModel = search_model;
	if (!finalSearchModel && (region_model || extract_model)) {
		finalSearchModel = region_model || extract_model;
	}
	if (finalSearchModel) {
		if (finalSearchModel.startsWith('models/')) {
			finalSearchModel = 'gemini/' + finalSearchModel.slice(7);
		} else if (!finalSearchModel.includes('/')) {
			finalSearchModel = 'gemini/' + finalSearchModel;
		}
	}

	if (!query) {
		return new Response(JSON.stringify({ error: 'Query is required' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	const githubPat = env.GITHUB_PAT;
	const githubOwner = env.GITHUB_OWNER || 'TouchRefletz';
	const githubRepo = env.GITHUB_REPO || 'maia.api';

	if (!githubPat) {
		return new Response(JSON.stringify({ error: 'GITHUB_PAT not configured' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	// Step 1: Check if we already have PDFs for this topic (unless forced)
	let existingSlug = null;
	let hasPdfs = false;

	if (!force) {
		try {
			const embedding = await generateEmbedding(query, env.GOOGLE_GENAI_API_KEY);
			if (embedding) {
				const result = await executePineconeQuery(embedding, env, 3, {
					type: { $in: ['deep-search-result', 'manual-upload-result'] },
				});

				if (result?.matches?.length > 0) {
					const best = result.matches.find(
						(m) => m.score > 0.75 && m.metadata?.slug && !hasYearMismatch(query, m)
					);
					if (best) {
						existingSlug = best.metadata.slug;
						hasPdfs = true;
						console.log(`[TriggerExtraction] Found existing PDFs: ${existingSlug} (score: ${best.score})`);
					}
				}
			}
		} catch (e) {
			console.warn('[TriggerExtraction] Pinecone check error:', e);
		}
	}

	// Step 2: Determine action
	const dispatchUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`;
	const githubHeaders = {
		Authorization: `Bearer ${githubPat}`,
		Accept: 'application/vnd.github.v3+json',
		'User-Agent': 'Cloudflare-Worker',
		'Content-Type': 'application/json',
	};

	let action;
	let dispatchPayload;

	if (hasPdfs && !needs_more) {
		// PDFs exist → extract directly
		action = 'extract-questions';
		dispatchPayload = {
			event_type: 'extract-questions',
			client_payload: {
				query,
				slug: existingSlug,
				institution: institution || '',
				subject: subject || '',
				year: year || '',
				region_model: region_model || '',
				extract_model: extract_model || '',
			},
		};
	} else if (hasPdfs && needs_more) {
		// PDFs exist but need more → deep-search in update mode, then extract
		action = 'deep-search-update';
		dispatchPayload = {
			event_type: 'deep-search',
			client_payload: {
				query,
				slug: existingSlug,
				mode: 'update',
				search_type: 'questoes',
				extract_after: true, // Signal to trigger extraction after
				search_model: finalSearchModel || '',
				region_model: region_model || '',
				extract_model: extract_model || '',
			},
		};
	} else {
		// No PDFs → deep-search first
		action = 'deep-search-new';

		// Generate a slug for the new search
		let slug = query
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

		dispatchPayload = {
			event_type: 'deep-search',
			client_payload: {
				query,
				slug,
				search_type: 'questoes',
				extract_after: true,
				search_model: finalSearchModel || '',
				region_model: region_model || '',
				extract_model: extract_model || '',
			},
		};
	}

	// Step 3: Dispatch to GitHub Actions
	const response = await fetch(dispatchUrl, {
		method: 'POST',
		headers: githubHeaders,
		body: JSON.stringify(dispatchPayload),
	});

	if (!response.ok) {
		const errText = await response.text();
		console.error('[TriggerExtraction] GitHub dispatch failed:', errText);
		return new Response(JSON.stringify({ error: `GitHub API Error: ${response.status}`, details: errText }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	return new Response(
		JSON.stringify({
			success: true,
			action,
			slug: existingSlug || dispatchPayload.client_payload.slug,
			message: action === 'extract-questions' ? 'Extraction triggered directly' : 'Deep search triggered (extraction will follow)',
		}),
		{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
	);
}

/**
 * SERVICE: CHECK DUPLICATE
 * Generates embedding from question text, queries Pinecone question index.
 * Score > 0.92 = confirmed duplicate.
 */
async function handleCheckDuplicate(request, env) {
	const body = await request.json();
	const { text } = body;

	if (!text) {
		return new Response(JSON.stringify({ error: 'text is required' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		// Generate embedding for the question text
		const embedding = await generateEmbedding(text, env.GOOGLE_GENAI_API_KEY);

		if (!embedding) {
			return new Response(JSON.stringify({ error: 'Failed to generate embedding' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Query the question index (default Pinecone host = question bank)
		const result = await executePineconeQuery(embedding, env, 3, {}, 'default', '');

		if (!result?.matches?.length) {
			return new Response(JSON.stringify({ exists: false, matches: [] }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const DEDUP_THRESHOLD = 0.92;
		const matches = result.matches
			.filter((m) => m.score > 0.7) // Only show somewhat relevant matches
			.map((m) => ({
				id: m.id,
				score: m.score,
				preview: m.metadata?.texto_preview || '',
				institution: m.metadata?.institution || '',
				year: m.metadata?.year || '',
			}));

		const exists = result.matches[0].score > DEDUP_THRESHOLD;

		return new Response(JSON.stringify({ exists, matches, threshold: DEDUP_THRESHOLD }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('[CheckDuplicate] Error:', error);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * SERVICE: EXTRACT AND SAVE
 * Full question persistence: generates embeddings, upserts to Pinecone,
 * saves to Firebase RTDB via REST API.
 *
 * Input: { questao, gabarito, source_slug, source_pdf, page_num }
 * - questao: full dados_questao object
 * - gabarito: full dados_gabarito object
 * - source_slug: origin slug for grouping
 * - source_pdf: PDF filename
 * - page_num: page number in PDF
 */
async function handleExtractAndSave(request, env) {
	const body = await request.json();
	const { questao, gabarito, source_slug, source_pdf, page_num } = body;

	if (!questao || !gabarito || !source_slug) {
		return new Response(JSON.stringify({ error: 'questao, gabarito, and source_slug are required' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		// 1. Build semantic text (replicating construirTextoSemantico logic)
		const textoQuestao = buildSemanticText(questao, gabarito);

		// 2. Generate embedding
		const embedding = await generateEmbedding(textoQuestao, env.GOOGLE_GENAI_API_KEY);

		if (!embedding) {
			throw new Error('Failed to generate embedding');
		}

		// 3. Build IDs
		const chaveProva = source_slug;
		const idQuestao = questao.identificacao || `Q${page_num || 0}_${Date.now().toString(36)}`;

		// Base64URL ID (matching existing format)
		const rawId = `${chaveProva} - ${idQuestao}`;
		// Use TextEncoder to safely handle Unicode (accented chars in idQuestao)
		const rawBytes = new TextEncoder().encode(rawId);
		const binString = Array.from(rawBytes, (byte) => String.fromCodePoint(byte)).join('');
		const pineconeId = btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

		// 4. Build full JSON for Pinecone metadata
		const fullJson = JSON.stringify({
			meta: {
				timestamp: new Date().toISOString(),
				source_slug,
				source_pdf: source_pdf || '',
			},
			dados_questao: questao,
			dados_gabarito: gabarito,
		});

		// 5. Build Pinecone metadata
		const metadata = {
			institution: questao.instituicao || gabarito?.creditos?.autor_ou_instituicao || '',
			prova: chaveProva,
			subject: (questao.materias_possiveis || []).slice(0, 3),
			year: questao.ano || gabarito?.creditos?.ano || '',
			texto_preview: textoQuestao.substring(0, 300),
			has_full_json: fullJson.length <= 40000, // Pinecone metadata limit ~40KB
		};

		// Only include full_json if under limit
		if (metadata.has_full_json) {
			metadata.full_json = fullJson;
		}

		// Auto-detect question type
		const tipoResposta = questao.alternativas && questao.alternativas.length > 0 ? 'objetiva' : 'dissertativa';
		metadata.tipo_resposta = tipoResposta;

		// 6. Upsert to Pinecone
		const vectors = [
			{
				id: pineconeId,
				values: embedding,
				metadata,
			},
		];

		await executePineconeUpsert(vectors, env, '', 'default');

		// 7. Save to Firebase RTDB via REST API
		let firebaseSaved = false;
		const firebaseUrl = env.FIREBASE_DATABASE_URL;

		if (firebaseUrl) {
			try {
				const firebasePath = `questoes/${chaveProva}/${idQuestao}.json`;
				const firebaseData = {
					dados_questao: {
						...questao,
						tipo_resposta: tipoResposta,
					},
					dados_gabarito: gabarito,
					meta: {
						pinecone_id: pineconeId,
						source_pdf: source_pdf || '',
						page_num: page_num || 0,
						created_at: new Date().toISOString(),
					},
				};

				const secret = env.FIREBASE_DATABASE_SECRET;
				const fbUrl = secret ? `${firebaseUrl}/${firebasePath}?auth=${secret}` : `${firebaseUrl}/${firebasePath}`;
				const fbResponse = await fetch(fbUrl, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(firebaseData),
				});

				firebaseSaved = fbResponse.ok;
				if (!firebaseSaved) {
					const errorText = await fbResponse.text();
					console.warn('[ExtractAndSave] Firebase save failed:', errorText);
					throw new Error(`Firebase save failed: ${errorText}`);
				}
			} catch (fbErr) {
				console.warn('[ExtractAndSave] Firebase error:', fbErr);
				throw fbErr;
			}
		} else {
			console.warn('[ExtractAndSave] FIREBASE_DATABASE_URL not configured, skipping Firebase save');
		}

		return new Response(
			JSON.stringify({
				saved: true,
				pinecone_id: pineconeId,
				firebase_path: `questoes/${chaveProva}/${idQuestao}`,
				firebase_saved: firebaseSaved,
				tipo_resposta: tipoResposta,
			}),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
		);
	} catch (error) {
		console.error('[ExtractAndSave] Error:', error);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Check if a question exists in Firebase RTDB.
 */
async function handleCheckQuestion(request, env) {
	try {
		const { path, pinecone_id, delete_if_missing } = await request.json();
		const firebaseUrl = env.FIREBASE_DATABASE_URL;
		if (!firebaseUrl) {
			return new Response(JSON.stringify({ exists: false, error: 'Firebase not configured' }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
		// path is like "questoes/OBMEP_2023_Nivel_3/Q1"
		const secret = env.FIREBASE_DATABASE_SECRET;
		const fbUrl = secret ? `${firebaseUrl}/${path}.json?auth=${secret}` : `${firebaseUrl}/${path}.json`;
		const fbResponse = await fetch(fbUrl);
		let exists = false;
		if (fbResponse.ok) {
			const data = await fbResponse.json();
			exists = data !== null;
		}

		if (exists) {
			return new Response(JSON.stringify({ exists: true, deleted_from_pinecone: false }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// If missing in Firebase, clean up Pinecone if requested
		let deletedFromPinecone = false;
		let targetPineconeId = null;

		if (delete_if_missing) {
			let pineconeId = pinecone_id;
			if (!pineconeId && path) {
				const parts = path.split('/');
				if (parts.length >= 3 && parts[0] === 'questoes') {
					const chaveProva = parts[1];
					const idQuestao = parts.slice(2).join('/');
					const rawId = `${chaveProva} - ${idQuestao}`;
					const rawBytes = new TextEncoder().encode(rawId);
					const binString = Array.from(rawBytes, (byte) => String.fromCodePoint(byte)).join('');
					pineconeId = btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
				}
			}

			if (pineconeId) {
				targetPineconeId = pineconeId;
				try {
					console.log(`[CheckQuestion] Question missing in Firebase. Cleaning up Pinecone vector: ${pineconeId}`);
					await executePineconeDeleteById(pineconeId, env);
					deletedFromPinecone = true;
				} catch (err) {
					console.error(`[CheckQuestion] Error deleting Pinecone vector ${pineconeId}:`, err);
				}
			}
		}

		return new Response(
			JSON.stringify({
				exists: false,
				deleted_from_pinecone: deletedFromPinecone,
				pinecone_id: targetPineconeId,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('[CheckQuestion] Error:', error);
		return new Response(JSON.stringify({ exists: false, error: error.message }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * HELPER: Build semantic text for embedding
 * Full port of construirTextoSemantico from js/ia/envio-textos.js
 * Combines: construirTextoQuestao + construirTextoSolucao + construirTextoComplexidade
 */
function buildSemanticText(questao, gabarito) {
	let txtQ = '';

	// Contexto (Matéria e Keywords)
	if (questao.materias_possiveis && Array.isArray(questao.materias_possiveis)) {
		txtQ += `MATÉRIA: ${questao.materias_possiveis.join(', ')}. `;
	}
	if (questao.palavras_chave && Array.isArray(questao.palavras_chave)) {
		txtQ += `PALAVRAS-CHAVE: ${questao.palavras_chave.join(', ')}. `;
	}

	// Enunciado (ALL content from estrutura, not just texto/fonte)
	let textoEnunciado = '';
	if (questao.estrutura && Array.isArray(questao.estrutura)) {
		textoEnunciado = questao.estrutura.map((item) => item.conteudo || '').join(' ');
	}
	txtQ += `ENUNCIADO: ${textoEnunciado} `;

	// Alternativas
	if (questao.alternativas && Array.isArray(questao.alternativas)) {
		const textoAlts = questao.alternativas
			.map((alt) => {
				let conteudoAlt = alt.texto || '';
				// Prioriza estrutura se existir
				if (alt.estrutura && Array.isArray(alt.estrutura)) {
					conteudoAlt = alt.estrutura.map((i) => i.conteudo).join(' ');
				}
				return `${alt.letra || '?'}: ${conteudoAlt}`;
			})
			.join(' | ');
		txtQ += `ALTERNATIVAS: ${textoAlts} `;
	}

	// === 2. construirTextoSolucao ===
	let txtS = '';
	if (gabarito) {
		// Letra Correta
		if (gabarito.dados_gabarito?.alternativa_correta) {
			txtS += `GABARITO: Alternativa ${gabarito.dados_gabarito.alternativa_correta}. `;
		} else if (gabarito.alternativa_correta) {
			txtS += `GABARITO: Alternativa ${gabarito.alternativa_correta}. `;
		}

		// Resposta modelo (dissertativas)
		if (gabarito.resposta_modelo) {
			txtS += `RESPOSTA MODELO: ${gabarito.resposta_modelo} `;
		} else if (gabarito.dados_gabarito?.resposta_modelo) {
			txtS += `RESPOSTA MODELO: ${gabarito.dados_gabarito.resposta_modelo} `;
		}

		// Explicação Detalhada (array of blocos with estrutura)
		const explicacao = gabarito.explicacao || gabarito.dados_gabarito?.explicacao;
		if (explicacao && Array.isArray(explicacao)) {
			const textoExpl = explicacao.flatMap((bloco) => (bloco.estrutura ? bloco.estrutura.map((i) => i.conteudo) : [])).join(' ');
			if (textoExpl) txtS += `EXPLICAÇÃO: ${textoExpl} `;
		}

		// Análise dos Distratores
		const analisadas = gabarito.dados_gabarito?.alternativas_analisadas || gabarito.alternativas_analisadas;
		if (analisadas && Array.isArray(analisadas)) {
			const textoMotivos = analisadas.map((analise) => `(${analise.letra}) ${analise.motivo || ''}`).join(' ');
			if (textoMotivos) txtS += `ANÁLISE DOS DISTRATORES: ${textoMotivos} `;
		}

		// Justificativa Curta
		const justificativa = gabarito.justificativa_curta || gabarito.dados_gabarito?.justificativa_curta;
		if (justificativa) {
			txtS += `RESUMO: ${justificativa} `;
		}
	}

	// === 3. construirTextoComplexidade ===
	let txtC = '';
	const complex = gabarito?.dados_gabarito?.analise_complexidade || gabarito?.analise_complexidade;
	if (complex) {
		// Justificativa da Dificuldade
		if (complex.justificativa_dificuldade) {
			txtC += `COMPLEXIDADE: ${complex.justificativa_dificuldade} `;
		}

		// Fatores Ativos
		if (complex.fatores) {
			const fatoresAtivos = Object.entries(complex.fatores)
				.filter(([, value]) => value === true)
				.map(([key]) => key)
				.join(', ');
			if (fatoresAtivos) {
				txtC += `Fatores: ${fatoresAtivos}.`;
			}
		}
	}

	return txtQ + txtS + txtC;
}
/**
 * SERVICE: RESOLVE LINK (Follow redirects and return final URL)
 */
async function handleResolveLink(request, env) {
	const urlObj = new URL(request.url);
	const targetUrl = urlObj.searchParams.get('url');

	if (!targetUrl) {
		return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		// vertexaisearch links often require following redirects to get to the destination
		const response = await fetch(targetUrl, {
			method: 'GET',
			redirect: 'follow',
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
		});

		const finalUrl = response.url;
		const finalHostname = new URL(finalUrl).hostname;

		// Metadata Extraction
		let title = '';
		let description = '';

		try {
			// Pegar apenas os primeiros 50KB para evitar estourar memória com páginas gigantes
			const reader = response.body.getReader();
			let { value, done } = await reader.read();
			let content = '';
			const decoder = new TextDecoder();
			
			// Lemos apenas o suficiente para pegar o <head>
			if (value) content = decoder.decode(value);
			reader.cancel(); // Para o download

			// Extração via Regex (Simples e Rápido)
			const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
			if (titleMatch) title = titleMatch[1].trim();

			const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i) ||
							 content.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i) ||
							 content.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i);
			
			if (descMatch) description = descMatch[1].trim();
		} catch (e) {
			console.warn('[Resolve Meta Error]', e.message);
		}

		return new Response(JSON.stringify({
			original: targetUrl,
			resolved: finalUrl,
			hostname: finalHostname,
			title: title || finalHostname,
			description: description || ''
		}), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('[Resolve Link Error]', error);
		return new Response(JSON.stringify({ error: error.message, original: targetUrl }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}


/**
 * Normalizes a schema object to standard JSON Schema (lowercase types)
 */
function normalizeSchemaToStandard(schema) {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	const clone = JSON.parse(JSON.stringify(schema));

	const convertNode = (node) => {
		if (!node || typeof node !== 'object') return;

		if (typeof node.type === 'string') {
			const t = node.type.toUpperCase();
			if (t === 'INTEGER') {
				node.type = 'integer';
			} else if (t === 'STRING') {
				node.type = 'string';
			} else if (t === 'OBJECT') {
				node.type = 'object';
			} else if (t === 'ARRAY') {
				node.type = 'array';
			} else if (t === 'BOOLEAN') {
				node.type = 'boolean';
			} else if (t === 'NUMBER') {
				node.type = 'number';
			} else if (t === 'NULL') {
				node.type = 'null';
			} else {
				node.type = node.type.toLowerCase();
			}
		}

		if (node.properties && typeof node.properties === 'object') {
			for (const key of Object.keys(node.properties)) {
				convertNode(node.properties[key]);
			}
		}

		if (node.items && typeof node.items === 'object') {
			convertNode(node.items);
		}
	};

	convertNode(clone);
	return clone;
}

/**
 * Helper to generate chat stream using GitHub Models (OpenAI compatible)
 */
async function handleGithubGenerateStream(modelo, body, env, attempt, writeNdjson) {
	const {
		texto,
		schema,
		listaImagensBase64 = [],
		mimeType = 'image/jpeg',
		apiKey: userApiKey,
		githubApiKey: userGithubApiKey,
		jsonMode = true,
		chatMode = false,
		history = [],
		systemInstruction,
	} = body;

	// Use user-provided GitHub API key, fallback to userApiKey, or fallback to env.GITHUB_PAT
	const finalApiKey = userGithubApiKey || userApiKey || env.GITHUB_PAT;
	if (!finalApiKey) {
		throw new Error('GITHUB_PAT not configured');
	}

	const githubModelId = modelo.replace('github/', '');

	let textWithFiles = texto || '';
	const nonTextParts = [];

	const processAttachmentsToParts = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;
				let name = 'arquivo';
				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
					if (item.name) name = item.name;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}
				if (isTextMimeType(mimeType)) {
					const decodedText = decodeBase64ToUtf8(data);
					textWithFiles += `\n\n=== CONTEÚDO DO ARQUIVO ANEXADO [${name}] ===\n${decodedText}\n=============================================\n`;
				} else {
					nonTextParts.push({ inlineData: { mimeType, data } });
				}
			});
		}
	};

	processAttachmentsToParts(listaImagensBase64, mimeType);
	if (body.files) {
		processAttachmentsToParts(body.files, 'application/pdf');
	}

	// Process attachments to parts
	const currentParts = [];
	if (textWithFiles) {
		currentParts.push({ text: textWithFiles });
	}
	currentParts.push(...nonTextParts);

	// Bidirectional mapping: Convert Gemini history to OpenAI format
	const openAIMessages = mapGeminiHistoryToOpenAI(history, currentParts, systemInstruction);

	const payload = {
		model: githubModelId,
		messages: openAIMessages,
		stream: true,
	};

	if (jsonMode && schema) {
		payload.response_format = {
			type: 'json_schema',
			json_schema: {
				name: 'response_schema',
				schema: normalizeSchemaToStandard(schema),
			},
		};
	}

	const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${finalApiKey}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`GitHub Models API Error: ${response.status} - ${errText}`);
	}

	if (!response.body) throw new Error('Response body is null (stream)');

	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const cleanLine = line.trim();
			if (!cleanLine) continue;
			if (cleanLine === 'data: [DONE]') continue;
			if (cleanLine.startsWith('data: ')) {
				try {
					const jsonStr = cleanLine.slice(6);
					const chunk = JSON.parse(jsonStr);
					const choice = chunk.choices?.[0];
					const delta = choice?.delta;

					// o1/o3-mini/deepseek reasoning thoughts parsing
					const thoughtText = delta?.reasoning_content || delta?.thinking || '';
					if (thoughtText) {
						await writeNdjson({ type: 'thought', attempt, model: modelo, text: thoughtText });
					}

					const answerText = delta?.content || '';
					if (answerText) {
						await writeNdjson({ type: 'answer', attempt, model: modelo, text: answerText });
					}
				} catch (err) {
					// Ignore parser errors for incomplete chunks
				}
			}
		}
	}
}

/**
 * Helper to describe an image using the selected image descriptor model.
 * Supports Google (AI Studio/Vertex) and GitHub (OpenAI compatible) Models.
 */
async function describeImageWithModel(img, promptDescrever, descriptorModel, body, env) {
	const {
		apiKey: userApiKey,
		githubApiKey: userGithubApiKey,
		vertexProjectId: bodyVertexProjectId,
		vertexLocation: bodyVertexLocation,
		vertexCredentials: bodyVertexCredentials,
	} = body;

	const vertexProjectId = bodyVertexProjectId || env.VERTEX_PROJECT_ID;
	const vertexLocation = bodyVertexLocation || env.VERTEX_LOCATION;
	const vertexCredentials = bodyVertexCredentials || env.VERTEX_CREDENTIALS;

	const isVertex = descriptorModel.startsWith('vertex/');
	const isGithub = descriptorModel.startsWith('github/');

	if (isGithub) {
		const finalApiKey = userGithubApiKey || userApiKey || env.GITHUB_PAT;
		if (!finalApiKey) throw new Error('GITHUB_PAT not configured for image description');
		const githubModelId = descriptorModel.replace('github/', '');
		
		const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${finalApiKey}`,
			},
			body: JSON.stringify({
				model: githubModelId,
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', text: promptDescrever },
							{ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } }
						]
					}
				],
				max_tokens: 1000
			})
		});
		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`GitHub Models API error: ${response.status} - ${errText}`);
		}
		const resData = await response.json();
		return resData.choices?.[0]?.message?.content || '';
	}

	// Default to Google Gemini (either Vertex or AI Studio)
	let client;
	if (isVertex) {
		if (!vertexProjectId || !vertexCredentials) {
			throw new Error('Vertex AI project ID and credentials must be configured to use Vertex models for description.');
		}
		client = new GoogleGenAINode({
			vertexai: true,
			project: vertexProjectId,
			location: vertexLocation || 'us-central1',
			googleAuthOptions: {
				credentials: typeof vertexCredentials === 'string' ? JSON.parse(vertexCredentials) : vertexCredentials,
			},
			httpOptions: { timeout: 300000 },
		});
	} else {
		const finalApiKey = userApiKey || env.GOOGLE_GENAI_API_KEY;
		if (!finalApiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured for image description');
		client = new GoogleGenAIWeb({
			apiKey: finalApiKey,
			httpOptions: { timeout: 300000 },
		});
	}

	let modelToUse = descriptorModel;
	if (isVertex) {
		if (descriptorModel === 'vertex/gemini-3.5-flash') {
			modelToUse = 'publishers/google/models/gemini-3.5-flash';
		} else if (descriptorModel === 'vertex/gemini-3-flash-preview') {
			modelToUse = 'publishers/google/models/gemini-3-flash-preview';
		} else if (descriptorModel === 'vertex/gemini-3.1-flash-lite') {
			modelToUse = 'publishers/google/models/gemini-3.1-flash-lite';
		} else if (descriptorModel === 'vertex/gemini-2.5-flash') {
			modelToUse = 'publishers/google/models/gemini-2.5-flash';
		} else if (descriptorModel === 'vertex/gemini-2.5-flash-lite') {
			modelToUse = 'publishers/google/models/gemini-2.5-flash-lite';
		} else {
			modelToUse = descriptorModel.replace(/^vertex\//, '');
		}
	} else {
		modelToUse = descriptorModel;
	}

	const response = await client.models.generateContent({
		model: modelToUse,
		contents: [
			{
				role: 'user',
				parts: [
					{ text: promptDescrever },
					{ inlineData: { mimeType: img.mimeType, data: img.data } }
				]
			}
		]
	});

	return response.text || '';
}

/**
 * Helper to generate chat stream using Groq Models (OpenAI compatible)
 */
async function handleGroqGenerateStream(modelo, body, env, attempt, writeNdjson) {
	const {
		schema,
		apiKey: userApiKey,
		groqApiKey: userGroqApiKey,
		vertexProjectId,
		vertexLocation,
		vertexCredentials,
		jsonMode = true,
		chatMode = false,
		history = [],
		systemInstruction,
		imageDescriptorModel,
	} = body;

	// Use user-provided Groq API key, fallback to env.GROQ_API_KEY
	const finalApiKey = userGroqApiKey || env.GROQ_API_KEY;
	if (!finalApiKey) {
		throw new Error('GROQ_API_KEY not configured');
	}

	const groqModelId = modelo === 'groq/gpt-oss-120b' ? 'openai/gpt-oss-120b' : modelo.replace('groq/', '');

	// Process image descriptions if needed
	let textWithDescriptions = body.texto || '';
	const images = [];

	const extractImages = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mime = defaultMime;

				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mime = item.mimeType;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mime = matches[1];
						data = matches[2];
					}
				}
				
				if (mime && mime.startsWith('image/')) {
					images.push({ mimeType: mime, data });
				}
			});
		}
	};

	extractImages(body.listaImagensBase64, body.mimeType || 'image/jpeg');
	if (body.files) {
		extractImages(body.files, 'application/pdf');
	}

	if (images.length > 0 && groqModelId.includes('gpt-oss-120b')) {
		const startGemmaTime = performance.now();
		const descriptions = [];
		const promptDescrever = `Você é um transcritor visual acadêmico especializado em provas de vestibulares brasileiros. Sua tarefa é descrever, com absurdamente alto detalhamento, TODOS os elementos visuais presentes na imagem anexa de uma questão de vestibular.
REGRAS:
Descreva CADA elemento visual separadamente
Para gráficos: descreva eixos (nome, unidade, escala), pontos plotados, tendências, interceptos
Para tabelas: transcreva TODOS os valores célula por célula
Para figuras geométricas: descreva formas, medidas, ângulos, relações espaciais
Para fórmulas/química: transcreva símbolos, subscritos, superescritos, setas
Para imagens fotografadas: descreva cenário, objetos, pessoas, contexto
NÃO interprete nem resolva a questão — apenas descreva o que vê
Use formato estruturado com tópicos
FORMATO DE SAÍDA:
[TIPO_DE_ELEMENTO]: descrição detalhada`;

		const descriptorModel = imageDescriptorModel || 'models/gemma-4-31b-it';

		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			let desc = '';
			
			if (i > 0) {
				// Pequeno delay para evitar rate limits/concorrência na chave gratuita do Gemini
				await new Promise((resolve) => setTimeout(resolve, 800));
			}

			let successImage = false;
			let lastDescError = null;

			for (let attemptNum = 1; attemptNum <= 3; attemptNum++) {
				if (attemptNum > 1) {
					await writeNdjson({ type: 'status', text: `Descritor falhou. Tentando novamente (${attemptNum}/3) para imagem ${i + 1}...` });
					await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[Descritor falhou. Tentando novamente (${attemptNum}/3) para imagem ${i + 1}...]\n` });
					await new Promise((resolve) => setTimeout(resolve, 1000));
				} else {
					await writeNdjson({ type: 'status', text: `Descrevendo imagem ${i + 1}/${images.length} com ${descriptorModel}...` });
					await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[Descrevendo imagem ${i + 1}/${images.length} com ${descriptorModel}...]\n` });
				}

				try {
					desc = await describeImageWithModel(img, promptDescrever, descriptorModel, body, env);
					successImage = true;
					break;
				} catch (descError) {
					console.warn(`[Image Description] Attempt ${attemptNum}/3 failed:`, descError);
					lastDescError = descError;
					desc = '';
				}
			}

			if (!successImage) {
				const errorMsg = `Falha ao descrever imagem ${i + 1} após 3 tentativas com ${descriptorModel}. Erro original: ${lastDescError?.message || 'Erro desconhecido'}`;
				await writeNdjson({ type: 'status', text: `Erro: Falha na descrição da imagem ${i + 1}.` });
				await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[${errorMsg}]\n` });
				throw new Error(errorMsg);
			}

			await writeNdjson({ type: 'thought', attempt, model: modelo, text: desc });
			await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[Fim da descrição da imagem ${i + 1}]\n` });
			descriptions.push(desc);
		}

		const gemmaLatencyMs = Math.round(performance.now() - startGemmaTime);
		await writeNdjson({ type: 'gemma_latency', latency_ms: gemmaLatencyMs });

		const formattedDescriptions = descriptions.map((desc, idx) => `[DESCRIÇÃO DA IMAGEM ${idx + 1}]:\n${desc}`).join('\n\n');
		textWithDescriptions = `${textWithDescriptions}\n\n=== DESCRIÇÃO VISUAL DAS IMAGENS DA QUESTÃO ===\n${formattedDescriptions}\n===============================================`;
	}

	let textWithFiles = textWithDescriptions || '';
	const nonTextParts = [];

	const processNonImageAttachmentsToParts = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;
				let name = 'arquivo';
				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
					if (item.name) name = item.name;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}
				if (mimeType && !mimeType.startsWith('image/')) {
					if (isTextMimeType(mimeType)) {
						const decodedText = decodeBase64ToUtf8(data);
						textWithFiles += `\n\n=== CONTEÚDO DO ARQUIVO ANEXADO [${name}] ===\n${decodedText}\n=============================================\n`;
					} else {
						nonTextParts.push({ inlineData: { mimeType, data } });
					}
				}
			});
		}
	};

	if (!groqModelId.includes('gpt-oss-120b')) {
		processNonImageAttachmentsToParts(body.listaImagensBase64, body.mimeType || 'image/jpeg');
		if (body.files) {
			processNonImageAttachmentsToParts(body.files, 'application/pdf');
		}
	}

	const currentParts = [];
	if (textWithFiles) {
		currentParts.push({ text: textWithFiles });
	}
	currentParts.push(...nonTextParts);

	// Bidirectional mapping: Convert Gemini history to OpenAI format
	let openAIMessages = mapGeminiHistoryToOpenAI(history, currentParts, systemInstruction);

	if (groqModelId.includes('gpt-oss-120b')) {
		openAIMessages = openAIMessages.map((msg) => {
			if (Array.isArray(msg.content)) {
				const textContent = msg.content
					.filter(part => part.type === 'text')
					.map(part => part.text)
					.join('\n');
				return { ...msg, content: textContent };
			}
			return msg;
		});
	}

	const payload = {
		model: groqModelId,
		messages: openAIMessages,
		stream: true,
	};

	if (jsonMode && schema) {
		payload.response_format = {
			type: 'json_schema',
			json_schema: {
				name: 'response_schema',
				schema: normalizeSchemaToStandard(schema),
			},
		};
	}

	const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${finalApiKey}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Groq API Error: ${response.status} - ${errText}`);
	}

	if (!response.body) throw new Error('Response body is null (stream)');

	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const cleanLine = line.trim();
			if (!cleanLine) continue;
			if (cleanLine === 'data: [DONE]') continue;
			if (cleanLine.startsWith('data: ')) {
				try {
					const jsonStr = cleanLine.slice(6);
					const chunk = JSON.parse(jsonStr);
					const choice = chunk.choices?.[0];
					const delta = choice?.delta;

					const thoughtText = delta?.reasoning_content || delta?.thinking || '';
					if (thoughtText) {
						await writeNdjson({ type: 'thought', attempt, model: modelo, text: thoughtText });
					}

					const answerText = delta?.content || '';
					if (answerText) {
						await writeNdjson({ type: 'answer', attempt, model: modelo, text: answerText });
					}
				} catch (err) {
					// Ignore parser errors for incomplete chunks
				}
			}
		}
	}
}

// --- Vertex AI MaaS access token cache ---
let _vertexTokenCache = { token: null, expiry: 0 };

/**
 * Gets an access token for Vertex AI using service account JWT + Web Crypto API.
 * Tokens are cached in-memory and reused until 5 minutes before expiry.
 */
async function getVertexAccessToken(credentialsJson) {
	const now = Math.floor(Date.now() / 1000);

	// Return cached token if still valid (with 5-min buffer)
	if (_vertexTokenCache.token && _vertexTokenCache.expiry > now + 300) {
		return _vertexTokenCache.token;
	}

	const sa = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;
	if (!sa.client_email || !sa.private_key) {
		throw new Error('Invalid Vertex credentials: missing client_email or private_key');
	}

	// --- Build JWT ---
	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = {
		iss: sa.client_email,
		scope: 'https://www.googleapis.com/auth/cloud-platform',
		aud: 'https://oauth2.googleapis.com/token',
		iat: now,
		exp: now + 3600,
	};

	const toBase64Url = (obj) => {
		const json = JSON.stringify(obj);
		const bytes = new TextEncoder().encode(json);
		let binary = '';
		for (const b of bytes) binary += String.fromCharCode(b);
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	};

	const headerB64 = toBase64Url(header);
	const payloadB64 = toBase64Url(payload);
	const unsignedToken = `${headerB64}.${payloadB64}`;

	// --- Import PEM private key via Web Crypto API ---
	const pemBody = sa.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		binaryDer.buffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	// --- Sign ---
	const signatureBuffer = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		cryptoKey,
		new TextEncoder().encode(unsignedToken)
	);
	const sigBytes = new Uint8Array(signatureBuffer);
	let sigBinary = '';
	for (const b of sigBytes) sigBinary += String.fromCharCode(b);
	const signatureB64 = btoa(sigBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

	const signedJwt = `${unsignedToken}.${signatureB64}`;

	// --- Exchange JWT for access token ---
	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(signedJwt)}`,
	});

	if (!tokenResponse.ok) {
		const errText = await tokenResponse.text();
		throw new Error(`Failed to get Vertex access token: ${tokenResponse.status} - ${errText}`);
	}

	const tokenData = await tokenResponse.json();

	// Cache the token
	_vertexTokenCache = {
		token: tokenData.access_token,
		expiry: now + (tokenData.expires_in || 3600),
	};

	return tokenData.access_token;
}

/**
 * Helper to generate chat stream using Vertex AI MaaS (OpenAI compatible)
 */
async function handleVertexMaaSGenerateStream(modelo, body, env, attempt, writeNdjson) {
	const {
		schema,
		apiKey: userApiKey,
		vertexProjectId: bodyVertexProjectId,
		vertexLocation: bodyVertexLocation,
		vertexCredentials: bodyVertexCredentials,
		jsonMode = true,
		chatMode = false,
		history = [],
		systemInstruction,
		imageDescriptorModel,
	} = body;

	// Resolve Vertex config from body or env
	const credentials = bodyVertexCredentials || env.VERTEX_CREDENTIALS;
	if (!credentials) {
		throw new Error('VERTEX_CREDENTIALS not configured for Vertex MaaS');
	}

	const projectId = bodyVertexProjectId || env.VERTEX_PROJECT_ID;
	if (!projectId) {
		throw new Error('VERTEX_PROJECT_ID not configured for Vertex MaaS');
	}

	const location = 'us-central1';

	// Get access token via JWT + Web Crypto
	const accessToken = await getVertexAccessToken(credentials);

	const vertexMaaSModelId = 'openai/gpt-oss-120b-maas';

	// Process image descriptions if needed
	let textWithDescriptions = body.texto || '';
	const images = [];

	const extractImages = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mime = defaultMime;

				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mime = item.mimeType;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mime = matches[1];
						data = matches[2];
					}
				}
				
				if (mime && mime.startsWith('image/')) {
					images.push({ mimeType: mime, data });
				}
			});
		}
	};

	extractImages(body.listaImagensBase64, body.mimeType || 'image/jpeg');
	if (body.files) {
		extractImages(body.files, 'application/pdf');
	}

	if (images.length > 0) {
		const startGemmaTime = performance.now();
		const descriptions = [];
		const promptDescrever = `Você é um transcritor visual acadêmico especializado em provas de vestibulares brasileiros. Sua tarefa é descrever, com absurdamente alto detalhamento, TODOS os elementos visuais presentes na imagem anexa de uma questão de vestibular.
REGRAS:
Descreva CADA elemento visual separadamente
Para gráficos: descreva eixos (nome, unidade, escala), pontos plotados, tendências, interceptos
Para tabelas: transcreva TODOS os valores célula por célula
Para figuras geométricas: descreva formas, medidas, ângulos, relações espaciais
Para fórmulas/química: transcreva símbolos, subscritos, superescritos, setas
Para imagens fotografadas: descreva cenário, objetos, pessoas, contexto
NÃO interprete nem resolva a questão — apenas descreva o que vê
Use formato estruturado com tópicos
FORMATO DE SAÍDA:
[TIPO_DE_ELEMENTO]: descrição detalhada`;

		const descriptorModel = imageDescriptorModel || 'models/gemma-4-31b-it';

		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			let desc = '';
			
			if (i > 0) {
				// Pequeno delay para evitar rate limits/concorrência na chave gratuita do Gemini
				await new Promise((resolve) => setTimeout(resolve, 800));
			}

			let successImage = false;
			let lastDescError = null;

			for (let attemptNum = 1; attemptNum <= 3; attemptNum++) {
				if (attemptNum > 1) {
					await writeNdjson({ type: 'status', text: `Descritor falhou. Tentando novamente (${attemptNum}/3) para imagem ${i + 1}...` });
					await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[Descritor falhou. Tentando novamente (${attemptNum}/3) para imagem ${i + 1}...]\n` });
					await new Promise((resolve) => setTimeout(resolve, 1000));
				} else {
					await writeNdjson({ type: 'status', text: `Descrevendo imagem ${i + 1}/${images.length} com ${descriptorModel}...` });
					await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[Descrevendo imagem ${i + 1}/${images.length} com ${descriptorModel}...]\n` });
				}

				try {
					desc = await describeImageWithModel(img, promptDescrever, descriptorModel, body, env);
					successImage = true;
					break;
				} catch (descError) {
					console.warn(`[Image Description] Attempt ${attemptNum}/3 failed:`, descError);
					lastDescError = descError;
					desc = '';
				}
			}

			if (!successImage) {
				const errorMsg = `Falha ao descrever imagem ${i + 1} após 3 tentativas com ${descriptorModel}. Erro original: ${lastDescError?.message || 'Erro desconhecido'}`;
				await writeNdjson({ type: 'status', text: `Erro: Falha na descrição da imagem ${i + 1}.` });
				await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[${errorMsg}]\n` });
				throw new Error(errorMsg);
			}

			await writeNdjson({ type: 'thought', attempt, model: modelo, text: desc });
			await writeNdjson({ type: 'thought', attempt, model: modelo, text: `\n[Fim da descrição da imagem ${i + 1}]\n` });
			descriptions.push(desc);
		}

		const gemmaLatencyMs = Math.round(performance.now() - startGemmaTime);
		await writeNdjson({ type: 'gemma_latency', latency_ms: gemmaLatencyMs });

		const formattedDescriptions = descriptions.map((desc, idx) => `[DESCRIÇÃO DA IMAGEM ${idx + 1}]:\n${desc}`).join('\n\n');
		textWithDescriptions = `${textWithDescriptions}\n\n=== DESCRIÇÃO VISUAL DAS IMAGENS DA QUESTÃO ===\n${formattedDescriptions}\n===============================================`;
	}

	let textWithFiles = textWithDescriptions || '';
	const nonTextParts = [];

	const processNonImageAttachmentsToParts = (items, defaultMime) => {
		if (Array.isArray(items)) {
			items.forEach((item) => {
				let data = item;
				let mimeType = defaultMime;
				let name = 'arquivo';
				if (typeof item === 'object' && item.data) {
					data = item.data;
					if (item.mimeType) mimeType = item.mimeType;
					if (item.name) name = item.name;
				} else if (typeof item === 'string' && item.includes('base64,')) {
					const matches = item.match(/^data:(.+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						data = matches[2];
					}
				}
				if (mimeType && !mimeType.startsWith('image/')) {
					if (isTextMimeType(mimeType)) {
						const decodedText = decodeBase64ToUtf8(data);
						textWithFiles += `\n\n=== CONTEÚDO DO ARQUIVO ANEXADO [${name}] ===\n${decodedText}\n=============================================\n`;
					} else {
						nonTextParts.push({ inlineData: { mimeType, data } });
					}
				}
			});
		}
	};

	processNonImageAttachmentsToParts(body.listaImagensBase64, body.mimeType || 'image/jpeg');
	if (body.files) {
		processNonImageAttachmentsToParts(body.files, 'application/pdf');
	}

	const currentParts = [];
	if (textWithFiles) {
		currentParts.push({ text: textWithFiles });
	}
	currentParts.push(...nonTextParts);

	// Bidirectional mapping: Convert Gemini history to OpenAI format
	let openAIMessages = mapGeminiHistoryToOpenAI(history, currentParts, systemInstruction);

	// Flatten array content to text-only for gpt-oss model
	openAIMessages = openAIMessages.map((msg) => {
		if (Array.isArray(msg.content)) {
			const textContent = msg.content
				.filter(part => part.type === 'text')
				.map(part => part.text)
				.join('\n');
			return { ...msg, content: textContent };
		}
		return msg;
	});

	const payload = {
		model: vertexMaaSModelId,
		messages: openAIMessages,
		stream: true,
	};

	if (jsonMode && schema) {
		payload.response_format = {
			type: 'json_schema',
			json_schema: {
				name: 'response_schema',
				schema: normalizeSchemaToStandard(schema),
			},
		};
	}

	const vertexEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`;
	console.log(`[Vertex MaaS] Endpoint: ${vertexEndpoint} | Model: ${vertexMaaSModelId}`);

	const response = await fetch(vertexEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Vertex MaaS API Error: ${response.status} - ${errText}`);
	}

	if (!response.body) throw new Error('Response body is null (stream)');

	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const cleanLine = line.trim();
			if (!cleanLine) continue;
			if (cleanLine === 'data: [DONE]') continue;
			if (cleanLine.startsWith('data: ')) {
				try {
					const jsonStr = cleanLine.slice(6);
					const chunk = JSON.parse(jsonStr);
					const choice = chunk.choices?.[0];
					const delta = choice?.delta;

					const thoughtText = delta?.reasoning_content || delta?.thinking || '';
					if (thoughtText) {
						await writeNdjson({ type: 'thought', attempt, model: modelo, text: thoughtText });
					}

					const answerText = delta?.content || '';
					if (answerText) {
						await writeNdjson({ type: 'answer', attempt, model: modelo, text: answerText });
					}
				} catch (err) {
					// Ignore parser errors for incomplete chunks
				}
			}
		}
	}
}

/**
 * Maps Gemini history structure to OpenAI messages
 */
function mapGeminiHistoryToOpenAI(history, currentParts, systemInstruction) {
	const messages = [];

	if (systemInstruction) {
		messages.push({
			role: 'system',
			content: typeof systemInstruction === 'string' ? systemInstruction : systemInstruction.text,
		});
	}

	if (Array.isArray(history)) {
		for (const msg of history) {
			messages.push({
				role: msg.role === 'model' ? 'assistant' : 'user',
				content: mapPartsToOpenAIContent(msg.parts),
			});
		}
	}

	messages.push({
		role: 'user',
		content: mapPartsToOpenAIContent(currentParts),
	});

	return messages;
}

/**
 * Maps Gemini parts array to OpenAI message content
 */
function mapPartsToOpenAIContent(parts) {
	if (typeof parts === 'string') {
		return parts;
	}
	if (!Array.isArray(parts)) {
		return '';
	}
	if (parts.length === 1 && parts[0].text) {
		return parts[0].text;
	}

	return parts
		.map((part) => {
			if (part.text) {
				return { type: 'text', text: part.text };
			}
			if (part.inlineData) {
				const { mimeType, data } = part.inlineData;
				return {
					type: 'image_url',
					image_url: {
						url: `data:${mimeType};base64,${data}`,
					},
				};
			}
			return null;
		})
		.filter(Boolean);
}

/**
 * Maps OpenAI history format to Gemini parts format (Bidirectional compat)
 */
function mapOpenAIHistoryToGemini(history) {
	if (!Array.isArray(history)) return [];
	return history.map((msg) => {
		let role = msg.role;
		if (role === 'assistant') role = 'model';
		if (role === 'system') role = 'user'; // Gemini chats create system instruction separately, so map system to user fallback if inside history

		let parts = [];
		if (typeof msg.content === 'string') {
			parts = [{ text: msg.content }];
		} else if (Array.isArray(msg.content)) {
			parts = msg.content
				.map((part) => {
					if (part.type === 'text') {
						return { text: part.text };
					}
					if (part.type === 'image_url') {
						const url = part.image_url?.url || '';
						if (url.startsWith('data:')) {
							const matches = url.match(/^data:(.+);base64,(.+)$/);
							if (matches) {
								return { inlineData: { mimeType: matches[1], data: matches[2] } };
							}
						}
					}
					return null;
				})
				.filter(Boolean);
		}
		return { role, parts };
	});
}

function isTextMimeType(mimeType) {
	if (!mimeType) return false;
	const m = mimeType.toLowerCase();
	return m.startsWith('text/') || 
		m.includes('json') || 
		m.includes('javascript') || 
		m.includes('typescript') ||
		m.includes('xml') ||
		m === 'application/x-python' ||
		m === 'text/x-python';
}

function decodeBase64ToUtf8(base64Data) {
	try {
		const binString = atob(base64Data);
		const len = binString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binString.charCodeAt(i);
		}
		const decodedText = new TextDecoder('utf-8').decode(bytes);

		// If it's a JSON file, parse and sanitize it to avoid injecting massive base64 images or binary blobs
		try {
			const parsed = JSON.parse(decodedText);
			const sanitized = sanitizeJsonForPrompt(parsed);
			return JSON.stringify(sanitized, null, 2);
		} catch (e) {
			// Not a JSON file, or invalid JSON, return raw text
			return decodedText;
		}
	} catch (e) {
		console.error('[decodeBase64ToUtf8 Error]', e);
		return '';
	}
}

function sanitizeJsonForPrompt(obj) {
	if (typeof obj === 'string') {
		// If it's a long string and looks like base64 or data URL, strip or truncate it
		if (obj.length > 200 && (obj.startsWith('data:') || !obj.includes(' ') || /^[A-Za-z0-9+/=]+$/.test(obj.substring(0, 100)))) {
			return `[BASE64/DATA_URL TRUNCATED: ${obj.length} chars]`;
		}
		// Truncate long text strings to save tokens
		if (obj.length > 1500) {
			return obj.substring(0, 1500) + `... [TRUNCATED: ${obj.length - 1500} chars]`;
		}
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(sanitizeJsonForPrompt);
	}
	if (typeof obj === 'object' && obj !== null) {
		const cleaned = {};
		const keysToStrip = [
			'fotos_originais',
			'fontes_externas',
			'pdfjs_crop_h',
			'pdfjs_crop_w',
			'pdfjs_source_h',
			'pdfjs_source_w',
			'pdfjs_x',
			'pdfjs_y',
			'pdf_height',
			'pdf_width',
			'pdf_zoom',
			'norm_h',
			'norm_w',
			'norm_x',
			'norm_y',
			'pdf_url',
			'previewurl'
		];
		for (const [key, val] of Object.entries(obj)) {
			const lowerKey = key.toLowerCase();
			if (keysToStrip.includes(lowerKey)) {
				continue; // Strip completely
			}
			// Skip or sanitize specific keys that are likely to contain large images or binary data
			if (['imagem', 'imagens', 'base64', 'data', 'file', 'content_base64', 'imagebase64', 'screenshot'].includes(lowerKey) && typeof val === 'string' && val.length > 100) {
				cleaned[key] = `[CONTENT TRUNCATED: ${val.length} chars]`;
			} else {
				cleaned[key] = sanitizeJsonForPrompt(val);
			}
		}
		return cleaned;
	}
	return obj;
}

export { hasYearMismatch };
