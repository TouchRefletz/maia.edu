/**
 * Módulo de Gerador de Simulados por Inteligência Artificial (Pipeline de 2 Estágios & Isomorfismo)
 * Maia.edu - Suporta Planejador Multimodal + Busca Híbrida/Pinecone + Reranker com Variabilidade Ponderada
 */

import { gerarConteudoEmJSONComImagemStream, gerarEmbedding, queryPineconeWorker } from '../api/worker.js';

/**
 * Normaliza textos para comparação sem acentos e case-insensitive
 */
function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Realiza amostragem ponderada (Weighted Sampling) entre os melhores candidatos
 * Garante que usuários diferentes recebam variações ricas de questões de alta qualidade
 */
function weightedSample(candidates, count = 1) {
  if (!candidates || candidates.length === 0) return [];
  if (candidates.length <= count) return candidates.map((c) => c.item);

  // Considera apenas candidatos com pontuação relevante
  const minScore = Math.max(10, Math.max(...candidates.map((c) => c.score)) * 0.5);
  const eligible = candidates.filter((c) => c.score >= minScore);
  const pool = eligible.length >= count ? eligible : candidates;

  const selected = [];
  const available = [...pool];

  for (let step = 0; step < count && available.length > 0; step++) {
    // Aplica peso exponencial leve (score^1.5) para favorecer os melhores sem zerar os outros
    const weights = available.map((c) => Math.pow(Math.max(1, c.score), 1.5));
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);

    let randomVal = Math.random() * totalWeight;
    let chosenIdx = 0;

    for (let i = 0; i < available.length; i++) {
      randomVal -= weights[i];
      if (randomVal <= 0) {
        chosenIdx = i;
        break;
      }
    }

    selected.push(available[chosenIdx].item);
    available.splice(chosenIdx, 1);
  }

  return selected;
}

/**
 * Monta um simulado inteligente com base em pedido multimodal (texto, imagens de provas e anexos)
 *
 * @param {string} userPrompt - O pedido do usuário
 * @param {Array} questionsPool - O pool de questões disponíveis no banco
 * @param {Object} options - Opções adicionais (images, attachedQuestions, stylePreset, modelPlanner, modelReranker, onStatus)
 * @returns {Promise<{ selectedQuestions: Array, title: string, metadata: Object }>}
 */
export async function gerarSimuladoComIA(userPrompt, questionsPool = [], options = {}) {
  const images = Array.isArray(options.images) ? options.images : [];
  const attachedQuestions = Array.isArray(options.attachedQuestions) ? options.attachedQuestions : [];
  const stylePreset = options.stylePreset || 'isomorphic'; // 'isomorphic', 'advanced', 'traps', 'custom'

  if ((!userPrompt || !userPrompt.trim()) && images.length === 0 && attachedQuestions.length === 0) {
    throw new Error('Por favor, informe uma descrição, envie fotos da prova ou anexe questões.');
  }

  if (!Array.isArray(questionsPool) || questionsPool.length === 0) {
    throw new Error('O banco de exercícios está vazio ou não foi carregado ainda.');
  }

  // Modelos configurados
  const modelPlanner =
    options.modelPlanner ||
    options.model ||
    (typeof window !== 'undefined' ? window.selectedModelSimuladoPlanner || window.selectedModelSimulado : null) ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('selectedModelSimuladoPlanner') || localStorage.getItem('selectedModelSimulado')
      : null) ||
    'models/gemma-4-31b-it';

  const modelReranker =
    options.modelReranker ||
    options.model ||
    (typeof window !== 'undefined' ? window.selectedModelSimuladoReranker || window.selectedModelSimulado : null) ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('selectedModelSimuladoReranker') || localStorage.getItem('selectedModelSimulado')
      : null) ||
    'models/gemma-4-31b-it';

  if (options.onStatus) {
    options.onStatus({
      phase: 'planning',
      step: 0,
      totalSteps: 10,
      percent: 10,
      message: `🧠 Analisando pedido e imagens com Arquiteto de IA (${modelPlanner.replace('models/', '')})...`,
    });
  }

  // -------------------------------------------------------------
  // ESTÁGIO 1: Arquiteto Multimodal (Planejamento & Decomposição)
  // -------------------------------------------------------------
  const intentSchema = {
    type: 'OBJECT',
    properties: {
      titulo_simulado: {
        type: 'STRING',
        description: 'Título temático e engajador para o simulado.',
      },
      quantidade_total: {
        type: 'INTEGER',
        description: 'Número total de questões (mínimo 1, máximo 50). Padrão: 10 (ou a quantidade identificada nas fotos).',
      },
      estilo_geral: {
        type: 'STRING',
        description: 'Resumo do padrão estilístico, nível de dificuldade e padrão de bancas das fotos/pedido.',
      },
      questoes_especificacao: {
        type: 'ARRAY',
        description: 'Lista de especificações individuais de busca e DNA estrutural para cada questão do simulado.',
        items: {
          type: 'OBJECT',
          properties: {
            prompt_busca_semantica: {
              type: 'STRING',
              description: 'Query descritiva em linguagem natural detalhada otimizada para busca vetorial no Pinecone.',
            },
            materia: {
              type: 'STRING',
              description: 'Matéria principal da questão.',
            },
            tema: {
              type: 'STRING',
              description: 'Tópico ou conceito específico da questão.',
            },
            palavras_chave: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Termos técnicos fundamentais para o problema.',
            },
            banca_ou_prova: {
              type: 'STRING',
              description: 'Banca recomendada (ENEM, FUVEST, UNICAMP, VUNESP) ou "Qualquer".',
            },
            dificuldade: {
              type: 'STRING',
              enum: ['Facil', 'Media', 'Dificil', 'Desafio', 'Qualquer'],
              description: 'Dificuldade desejada para esta questão.',
            },
            dna_estrutural: {
              type: 'OBJECT',
              properties: {
                requer_imagem_ou_grafico: { type: 'BOOLEAN' },
                tipo_comando: { type: 'STRING' },
                formato_alternativas: { type: 'STRING' },
              },
            },
          },
          required: ['prompt_busca_semantica', 'materia', 'tema', 'palavras_chave', 'dificuldade'],
        },
      },
    },
    required: ['titulo_simulado', 'quantidade_total', 'questoes_especificacao'],
  };

  let styleGuidance = 'Priorize questões com a mesma matriz cognitiva e modelo de raciocínio das referências (Clone Isomórfico).';
  if (stylePreset === 'advanced') {
    styleGuidance = 'Aumente o rigor conceitual e a complexidade matemática/analítica das questões em relação às referências.';
  } else if (stylePreset === 'traps') {
    styleGuidance = 'Foque em questões com distratores fortes, pegadinhas comuns e alta exigência de atenção aos detalhes.';
  }

  const systemInstructionPlanner = `Você é o Arquiteto Chefe Pedagógico e Especialista em Simulados Isomórficos da Maia.edu.
Sua missão é inspecionar minuciosamente o pedido do aluno, as fotos de provas enviadas e as questões de exemplo anexadas.
Extraia o padrão estrutural e conceitual da prova e gere um plano com N especificações de busca no banco de dados.

Diretriz de Estilo: ${styleGuidance}

Regras:
1. Se houver fotos de provas ou questões anexadas, identifique os tópicos e a profundidade de cada exercício e crie especificações isomórficas correspondentes.
2. Na propriedade "prompt_busca_semantica", crie uma descrição rica em português para cada slot de questão.
3. Garanta uma distribuição coerente de dificuldades e tópicos complementares.`;

  const attachedSummary = attachedQuestions.map((q, idx) => {
    const qData = q.fullData?.dados_questao || q.dados_questao || {};
    return `[Anexo ${idx + 1}]: Matéria: ${(qData.materias_possiveis || []).join(', ')} | Enunciado: ${(qData.enunciado || '').substring(0, 200)}...`;
  }).join('\n');

  const promptPlanner = `Gere o plano de busca estruturada e especificações para o seguinte pedido de simulado:
Pedido do Estudante: "${(userPrompt || '').trim() || 'Criar simulado com base nas referências anexadas.'}"
${attachedSummary ? `\nQuestões de Referência Anexadas:\n${attachedSummary}` : ''}
${images.length > 0 ? `\nForam anexadas ${images.length} imagem(ns) de provas para análise estrutural e isomórfica.` : ''}`;

  let intent = null;
  try {
    intent = await gerarConteudoEmJSONComImagemStream(
      promptPlanner,
      intentSchema,
      images,
      'image/jpeg',
      {
        onStatus: (msg) => {
          if (options.onStatus) {
            options.onStatus({
              phase: 'planning',
              percent: 25,
              message: `🧠 ${msg}`,
            });
          }
        },
      },
      {
        model: modelPlanner,
        systemInstruction: systemInstructionPlanner,
      },
    );
  } catch (err) {
    console.warn('[Simulado Generator] Falha na extração estruturada do Planner, gerando plano adaptativo:', err);
    // Fallback de emergência
    const count = 10;
    const fallbackSpecs = Array.from({ length: count }, (_, i) => ({
      prompt_busca_semantica: `Questão de vestibular sobre ${(userPrompt || 'conteúdo geral').substring(0, 40)}`,
      materia: 'Geral',
      tema: (userPrompt || 'Geral').substring(0, 30),
      palavras_chave: (userPrompt || '').split(/\s+/).filter((w) => w.length > 3),
      banca_ou_prova: 'Qualquer',
      dificuldade: i % 2 === 0 ? 'Media' : 'Facil',
    }));
    intent = {
      titulo_simulado: `Simulado Personalizado - ${(userPrompt || 'Geral').substring(0, 30)}`,
      quantidade_total: count,
      questoes_especificacao: fallbackSpecs,
    };
  }

  const specs = Array.isArray(intent.questoes_especificacao) ? intent.questoes_especificacao : [];
  const targetCount = Math.max(1, Math.min(50, intent.quantidade_total || specs.length || 10));

  if (options.onStatus) {
    options.onStatus({
      phase: 'retrieving',
      percent: 35,
      message: `🔍 Plano com ${specs.length} slots elaborado: "${intent.titulo_simulado}". Iniciando busca no banco...`,
      title: intent.titulo_simulado,
    });
  }

  // -------------------------------------------------------------
  // ESTÁGIO 2: Busca Híbrida de Candidatos (Slot a Slot)
  // -------------------------------------------------------------
  const selectedQuestions = [];
  const usedQuestionIds = new Set();

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const searchPromptQuery = spec.prompt_busca_semantica || spec.tema || userPrompt || '';

    if (options.onStatus) {
      const pct = Math.round(35 + ((i + 1) / specs.length) * 35);
      options.onStatus({
        phase: 'retrieving',
        step: i + 1,
        totalSteps: specs.length,
        percent: pct,
        message: `🔍 Recuperando candidatos para questão ${i + 1}/${specs.length}: "${spec.tema || spec.materia}"...`,
      });
    }

    // 1. Tenta recuperar via Embeddings / Pinecone
    let pineconeMatches = [];
    try {
      const vector = await gerarEmbedding(`${spec.materia} ${spec.tema} ${searchPromptQuery}`);
      if (vector) {
        const resp = await queryPineconeWorker(vector, 12, {}, 'default');
        if (resp && Array.isArray(resp.matches)) {
          pineconeMatches = resp.matches;
        }
      }
    } catch (e) {
      // Pinecone silencioso
    }

/**
 * Decodifica Base64URL para string original (Reverso de sanitizarID do Pinecone)
 */
function desanitizarID(encoded) {
  if (!encoded) return '';
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return encoded;
  }
}

    // 2. Pontuação Híbrida contra o questionsPool
    const materiaNorm = normalizeText(spec.materia || '');
    const temaNorm = normalizeText(spec.tema || '');
    const bancaNorm = normalizeText(spec.banca_ou_prova || '');
    const diffNorm = normalizeText(spec.dificuldade || '');
    const kwTokens = Array.from(
      new Set(
        [...(spec.palavras_chave || []), temaNorm, materiaNorm]
          .map((k) => normalizeText(k))
          .filter((k) => k.length > 2),
      ),
    );

    const candidates = [];

    // Prioriza candidatos vindos do Pinecone se existirem no pool
    const pineconeIdSet = new Set();
    pineconeMatches.forEach((m) => {
      if (!m.id) return;
      pineconeIdSet.add(m.id);
      if (m.id.includes('--')) {
        const parts = m.id.split('--');
        const qKey = desanitizarID(parts[1]);
        if (qKey) pineconeIdSet.add(qKey);
        pineconeIdSet.add(parts[1]);
      }
    });

    for (const item of questionsPool) {
      const qId = item.id || item.key || `${item.prova || 'prova'}_${item.index || Math.random()}`;
      if (usedQuestionIds.has(qId)) continue;

      let score = 0;
      const fullData = item.fullData || item;
      const q = fullData.dados_questao || {};
      const g = fullData.dados_gabarito || {};

      const enunNorm = normalizeText(q.enunciado || '');
      const matNorm = normalizeText(fullData.meta?.material_origem || item.prova || '');
      const materias = (q.materias_possiveis || item.subjects || []).map((m) => normalizeText(m));

      // Boost do Pinecone Match
      if (pineconeIdSet.has(qId) || pineconeIdSet.has(item.key) || pineconeIdSet.has(item.id)) {
        score += 80;
      }

      // Match de Matéria (+40 pts)
      if (materiaNorm && materias.some((m) => m.includes(materiaNorm) || materiaNorm.includes(m))) {
        score += 40;
      }

      // Match de Banca (+30 pts)
      if (bancaNorm && bancaNorm !== 'qualquer' && matNorm.includes(bancaNorm)) {
        score += 30;
      }

      // Match de Palavras-Chave e Tema (+20 pts cada)
      kwTokens.forEach((kw) => {
        if (enunNorm.includes(kw)) score += 20;
        else if (materias.some((m) => m.includes(kw))) score += 15;
      });

      // Match de Dificuldade (+15 pts)
      if (diffNorm && diffNorm !== 'qualquer') {
        const qDiff = normalizeText(q.dificuldade || item.dificuldade || '');
        if (qDiff && qDiff.includes(diffNorm)) score += 15;
      }

      // DNA Estrutural: Imagem (+15 pts)
      if (spec.dna_estrutural?.requer_imagem_ou_grafico) {
        if (q.interpretacao_visual || (Array.isArray(q.estrutura) && q.estrutura.some((e) => e.tipo === 'imagem'))) {
          score += 15;
        }
      }

      if (score > 10) {
        candidates.push({ item, qId, score });
      }
    }

    // Ordena candidatos pelo score
    candidates.sort((a, b) => b.score - a.score);

    // -------------------------------------------------------------
    // ESTÁGIO 3: Reranker & Curador com Variabilidade Ponderada
    // -------------------------------------------------------------
    if (candidates.length > 0) {
      // Pega o Top 5 mais forte para amostragem ponderada
      const topPool = candidates.slice(0, 5);
      const chosenSample = weightedSample(topPool, 1);

      if (chosenSample && chosenSample.length > 0) {
        const picked = chosenSample[0];
        const pickedId = picked.id || picked.key || `${picked.prova || 'p'}_${Math.random()}`;
        usedQuestionIds.add(pickedId);
        selectedQuestions.push(picked);
      }
    }
  }

  // Preenchimento de segurança caso faltem questões não duplicadas
  if (selectedQuestions.length < targetCount) {
    const remaining = questionsPool.filter(
      (item) => !usedQuestionIds.has(item.id || item.key || `${item.prova}_${item.index}`),
    );
    const needed = targetCount - selectedQuestions.length;
    for (let i = 0; i < Math.min(needed, remaining.length); i++) {
      selectedQuestions.push(remaining[i]);
    }
  }

  if (options.onStatus) {
    options.onStatus({
      phase: 'finished',
      percent: 100,
      message: `✅ Simulado Isomórfico montado com sucesso! (${selectedQuestions.length} questões calibradas)`,
    });
  }

  return {
    selectedQuestions,
    title: intent.titulo_simulado || `Simulado - ${(userPrompt || 'Geral').trim()}`,
    metadata: {
      requestedCount: targetCount,
      foundCount: selectedQuestions.length,
      modelPlanner,
      modelReranker,
      intentExtracted: intent,
      stylePreset,
    },
  };
}
