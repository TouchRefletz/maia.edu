/**
 * Módulo de Gerador de Simulados por Inteligência Artificial
 * Maia.edu - Suporta Gemma 4 31B IT e outros modelos do sistema
 */

import { gerarConteudoEmJSONComImagemStream } from '../api/worker.js';

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
 * Monta um simulado com base num pedido em linguagem natural e na lista de questões do banco.
 *
 * @param {string} userPrompt - O pedido do usuário (ex: "um simulado de 10 questões sobre embriologia")
 * @param {Array} questionsPool - O pool de questões disponíveis no banco (carregado do Firebase)
 * @param {Object} options - Opções adicionais (ex: model, onStatus)
 * @returns {Promise<{ selectedQuestions: Array, title: string, metadata: Object }>}
 */
export async function gerarSimuladoComIA(userPrompt, questionsPool = [], options = {}) {
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    throw new Error('Por favor, informe o tema ou descrição do simulado desejado.');
  }

  if (!Array.isArray(questionsPool) || questionsPool.length === 0) {
    throw new Error('O banco de exercícios está vazio ou não foi carregado ainda.');
  }

  const modelToUse =
    options.model ||
    (typeof window !== 'undefined' ? window.selectedModelSimulado : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('selectedModelSimulado') : null) ||
    'models/gemma-4-31b-it';

  if (options.onStatus) {
    options.onStatus(
      `🤖 Analisando comando e planejando questões com ${modelToUse.replace('models/', '')}...`,
    );
  }

  // Schema para extração da lista de comandos de busca individuais (queries Pinecone) por questão
  const intentSchema = {
    type: 'OBJECT',
    properties: {
      titulo_simulado: {
        type: 'STRING',
        description:
          'Título curto e chamativo para o simulado em Português (ex: Simulado ENEM - Linguagens (10 Questões)).',
      },
      quantidade_total: {
        type: 'INTEGER',
        description:
          'Número total de questões solicitadas pelo usuário (mínimo 1, máximo 50). Se não informado, usar 10.',
      },
      prompts_questoes: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description:
          'Array contendo EXATAMENTE N frases/comandos de busca em linguagem natural (uma query por questão), otimizados para busca semântica em banco de vetores (Pinecone).',
      },
      questoes_especificacao: {
        type: 'ARRAY',
        description:
          'Lista contendo a especificação e o comando de busca individual para CADA UMA das questões do simulado (tamanho N = quantidade_total).',
        items: {
          type: 'OBJECT',
          properties: {
            prompt_busca: {
              type: 'STRING',
              description:
                'Frase/comando de busca semântica para esta questão otimizado para embedding/Pinecone (ex: "Questão fácil do ENEM de Português sobre funções da linguagem e objetividade").',
            },
            materia: {
              type: 'STRING',
              description:
                'Matéria principal da questão (ex: Português, Biologia, Matemática, História, Física).',
            },
            tema: {
              type: 'STRING',
              description:
                'Tópico ou conceito específico para esta questão (ex: Sintaxe, Embriologia, Geometria Plana).',
            },
            palavras_chave: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Palavras e termos técnicos para busca no enunciado desta questão.',
            },
            banca_ou_prova: {
              type: 'STRING',
              description:
                'Exame ou banca específica para esta questão (ex: ENEM, FUVEST, UNICAMP) ou "Qualquer".',
            },
            dificuldade: {
              type: 'STRING',
              description:
                'Nível de dificuldade para esta questão: "Facil", "Media", "Dificil" ou "Qualquer".',
            },
            tipo: {
              type: 'STRING',
              description:
                'Tipo da questão: "teste" (múltipla escolha), "dissertativa" ou "qualquer".',
            },
          },
          required: ['prompt_busca', 'materia', 'tema', 'palavras_chave', 'dificuldade'],
        },
      },
    },
    required: ['titulo_simulado', 'quantidade_total', 'prompts_questoes', 'questoes_especificacao'],
  };

  const systemInstruction = `Você é o Especialista Pedagógico e Arquiteto de Simulados da Maia.edu.
Sua missão é analisar o pedido de um estudante em linguagem natural e gerar um ARRAY DE COMANDOS DE BUSCA INDIVIDUAIS (um comando em linguagem natural por questão), otimizados para busca semântica e vetorial em bancos de dados como Pinecone.

Regras cruciais:
1. Extraia a quantidade total de questões (ex: 10 questões -> quantidade_total = 10). Se o usuário não mencionar quantidade, defina como 10.
2. Na propriedade "prompts_questoes", gere uma lista contendo exatamente N frases/comandos de busca em linguagem natural. Exemplo para 3 questões:
   [
     "Questão fácil do ENEM de Português sobre funções da linguagem e objetividade",
     "Questão média do ENEM de Português sobre interpretação de texto e subtexto",
     "Questão difícil do ENEM de Literatura sobre Modernismo e vanguardas"
   ]
3. Na propriedade "questoes_especificacao", gere a lista com N objetos com "prompt_busca" e os metadados de cada questão.
4. Se o pedido envolver variabilidade (ex: "algumas fáceis, outras médias e difíceis"), distribua os níveis de dificuldade e os tópicos em cada um dos N comandos do array.
5. Retorne EXCLUSIVAMENTE o JSON estruturado conforme o schema.`;

  const promptText = `Analise o seguinte pedido de simulado e gere o array de comandos de busca individuais para cada questão:
"${userPrompt.trim()}"`;

  let intent = null;
  try {
    intent = await gerarConteudoEmJSONComImagemStream(
      promptText,
      intentSchema,
      [],
      'image/jpeg',
      {
        onStatus: (msg) => {
          if (options.onStatus) options.onStatus(msg);
        },
      },
      {
        model: modelToUse,
        systemInstruction: systemInstruction,
      },
    );
  } catch (err) {
    console.warn(
      '[AI Simulado Generator] Erro na extração estruturada via LLM, aplicando fallback de especificações:',
      err,
    );
    // Fallback de especificações em caso de falha da IA
    const promptNorm = normalizeText(userPrompt);
    const qtdMatch = userPrompt.match(/(\d+)\s*(quest|exerc|item)/i);
    const count = qtdMatch ? Math.max(1, Math.min(50, parseInt(qtdMatch[1], 10))) : 10;
    const keywords = promptNorm
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !['um', 'uma', 'simulado', 'de', 'sobre', 'com', 'questoes', 'para'].includes(w),
      );

    const difficulties = ['Facil', 'Media', 'Dificil'];
    const fallbackPrompts = [];
    const fallbackSpecs = Array.from({ length: count }, (_, idx) => {
      const diff = difficulties[idx % difficulties.length];
      const topic = keywords[idx % keywords.length] || 'Geral';
      const promptQuery = `Questão de nível ${diff} sobre ${topic} (${userPrompt.trim().substring(0, 30)})`;
      fallbackPrompts.push(promptQuery);
      return {
        prompt_busca: promptQuery,
        materia: keywords[0] || 'Geral',
        tema: topic,
        palavras_chave: keywords,
        banca_ou_prova: promptNorm.includes('enem') ? 'ENEM' : 'Qualquer',
        dificuldade: diff,
        tipo: 'qualquer',
      };
    });

    intent = {
      titulo_simulado: `Simulado - ${userPrompt.trim().substring(0, 30)}`,
      quantidade_total: count,
      prompts_questoes: fallbackPrompts,
      questoes_especificacao: fallbackSpecs,
    };
  }

  const targetCount = Math.max(
    1,
    Math.min(
      50,
      intent.quantidade_total ||
        (intent.questoes_especificacao ? intent.questoes_especificacao.length : 10),
    ),
  );
  const specs = Array.isArray(intent.questoes_especificacao) ? intent.questoes_especificacao : [];

  if (options.onStatus) {
    options.onStatus({
      phase: 'planning',
      step: 0,
      totalSteps: specs.length,
      percent: 10,
      message: `🤖 Plano de ${specs.length} especificações elaborado: "${intent.titulo_simulado}"`,
      title: intent.titulo_simulado,
      specsCount: specs.length,
    });
  }

  const selectedQuestions = [];
  const usedQuestionIds = new Set();

  // Executa a busca individual slot a slot para cada especificação de questão
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const searchPromptQuery =
      spec.prompt_busca ||
      (Array.isArray(intent.prompts_questoes) ? intent.prompts_questoes[i] : '') ||
      '';
    const searchPromptTokens = normalizeText(searchPromptQuery)
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (options.onStatus) {
      const percent = Math.round(15 + ((i + 1) / specs.length) * 80);
      const diffTag =
        spec.dificuldade && spec.dificuldade !== 'Qualquer' ? ` (${spec.dificuldade})` : '';
      options.onStatus({
        phase: 'searching',
        step: i + 1,
        totalSteps: specs.length,
        percent: percent,
        message: `🔍 Buscando questão ${i + 1}/${specs.length}: "${searchPromptQuery || spec.materia || 'Geral'}"${diffTag}`,
        spec: spec,
        queryPrompt: searchPromptQuery,
      });
    }

    const materiaNorm = normalizeText(spec.materia || '');
    const temaNorm = normalizeText(spec.tema || '');
    const bancaNorm = normalizeText(spec.banca_ou_prova || '');
    const diffNorm = normalizeText(spec.dificuldade || '');
    const tipoNorm = normalizeText(spec.tipo || 'qualquer');

    const kwNormList = Array.from(
      new Set(
        [...(spec.palavras_chave || []), temaNorm, materiaNorm, ...searchPromptTokens]
          .map((k) => normalizeText(k))
          .filter((k) => k.length > 2),
      ),
    );

    let bestCandidate = null;
    let maxScore = -1;

    for (const item of questionsPool) {
      const qId = item.id || `${item.prova || 'prova'}_${item.index || Math.random()}`;
      if (usedQuestionIds.has(qId)) continue; // Não repete questões já escolhidas

      let score = 0;
      const fullData = item.fullData || {};
      const q = fullData.dados_questao || {};
      const g = fullData.dados_gabarito || {};

      const enunciadoNorm = normalizeText(q.enunciado || '');
      const textNorm = normalizeText(item.text || '');
      const materialNorm = normalizeText(fullData.meta?.material_origem || item.prova || '');
      const gabaritoNorm = normalizeText(g.gabarito_comentado || g.resolucao || '');
      const materiasQuestao = (q.materias_possiveis || item.subjects || []).map((m) =>
        normalizeText(m),
      );

      // 1. Match de Matéria (+50 pts)
      if (materiaNorm) {
        if (materiasQuestao.some((mq) => mq.includes(materiaNorm) || materiaNorm.includes(mq))) {
          score += 50;
        }
      }

      // 2. Match de Banca / Prova (+40 pts)
      if (bancaNorm && bancaNorm !== 'qualquer') {
        if (materialNorm.includes(bancaNorm)) {
          score += 40;
        }
      }

      // 3. Match de Palavras-Chave e Tema (+25 pts por palavra)
      kwNormList.forEach((kw) => {
        if (enunciadoNorm.includes(kw) || textNorm.includes(kw)) {
          score += 25;
        } else if (gabaritoNorm.includes(kw)) {
          score += 15;
        } else if (materiasQuestao.some((mq) => mq.includes(kw))) {
          score += 20;
        }
      });

      // 4. Match de Dificuldade (+20 pts)
      if (diffNorm && diffNorm !== 'qualquer') {
        const qDiff = normalizeText(q.dificuldade || item.dificuldade || '');
        if (qDiff && qDiff.includes(diffNorm)) {
          score += 20;
        }
      }

      // 5. Match de Tipo (+10 pts)
      if (
        tipoNorm === 'teste' &&
        (q.tipo === 'multipla_escolha' || item.tipo === 'multipla_escolha')
      )
        score += 10;
      if (
        tipoNorm === 'dissertativa' &&
        (q.tipo === 'dissertativa' || item.tipo === 'dissertativa')
      )
        score += 10;

      if (score > maxScore) {
        maxScore = score;
        bestCandidate = { item, qId, score };
      }
    }

    if (bestCandidate && bestCandidate.score >= 0) {
      usedQuestionIds.add(bestCandidate.qId);
      selectedQuestions.push(bestCandidate.item);
    }
  }

  // Preenchimento de segurança caso faltem questões não duplicadas
  if (selectedQuestions.length < targetCount) {
    const remaining = questionsPool.filter(
      (item) =>
        !usedQuestionIds.has(item.id || `${item.prova || 'prova'}_${item.index || Math.random()}`),
    );
    const needed = targetCount - selectedQuestions.length;
    for (let i = 0; i < Math.min(needed, remaining.length); i++) {
      selectedQuestions.push(remaining[i]);
    }
  }

  if (options.onStatus) {
    options.onStatus(
      `✅ Simulado montado com sucesso! (${selectedQuestions.length} questões selecionadas)`,
    );
  }

  return {
    selectedQuestions,
    title: intent.titulo_simulado || `Simulado - ${userPrompt.trim()}`,
    metadata: {
      requestedCount: targetCount,
      foundCount: selectedQuestions.length,
      modelUsed: modelToUse,
      intentExtracted: intent,
    },
  };
}
