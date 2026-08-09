/**
 * EloService.js
 * Motor de Diagnóstico Metacognitivo e ELO (Rasch 1PL) para Maia.edu
 *
 * Implementa as equações matemáticas dos documentos técnicos do Maia.edu:
 * 1. Converte Dificuldade IA (0-100%) em ELO Prior (b_IA)
 * 2. Aplica Shrinkage w(N) = 5 / (5 + N) para obter b_efetivo
 * 3. Modelo Rasch 1PL: P(acerto | theta, b) = 1 / (1 + 10^((b - theta)/400))
 * 4. Atualização Micro do Aluno (K_user = 32) e da Questão (K_item = 16)
 * 5. Métricas Metacognitivas com Inversão Semântica (Brier, Ilusão de Conhecimento, Entropia, Taxa de Eliminação)
 * 6. Matriz de 15 Perfis de Diagnóstico Acadêmico de Precisão
 * 7. Persistência unificada no LocalStorage ('maia_elo_state') pronta para Firebase Sync
 */

import { auth, db } from '../firebase/init.js';
import {
  get,
  onValue,
  ref,
  set,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

const LOCAL_STORAGE_KEY = 'maia_elo_state';

// Parâmetros Globais do Modelo
const THETA_0 = 1500; // Elo base do aluno de referência
const SCALE_S = 400; // Escala de conversão da IA
const K_USER = 32; // Sensibilidade de alteração do aluno
const K_ITEM = 16; // Sensibilidade de alteração da questão
const N_0 = 5; // Peso do prior de shrinkage (5 respostas para equilíbrio 50/50)

export function isProductionEnvironment() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h !== 'localhost' && h !== '127.0.0.1' && h !== '::1' && h !== '';
}

let cacheEloState = null;
let firebaseSyncInitialized = false;
let currentSyncUid = null;

export function initFirebaseEloSync() {
  if (!isProductionEnvironment() || firebaseSyncInitialized || typeof window === 'undefined') return;
  firebaseSyncInitialized = true;

  try {
    onAuthStateChanged(auth, (user) => {
      if (user && user.uid) {
        if (currentSyncUid === user.uid) return;
        currentSyncUid = user.uid;

        const userEloRef = ref(db, `elo_usuarios/${user.uid}`);
        onValue(userEloRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            if (!cacheEloState) cacheEloState = getDefaultState();
            cacheEloState.user = { ...getDefaultState().user, ...(data.user || {}) };
            cacheEloState.aspectos = data.aspectos || {};
            cacheEloState = aplicarDecaimentoTemporal(cacheEloState);
          } else {
            const initialState = getDefaultState();
            cacheEloState = initialState;
            set(userEloRef, {
              user: initialState.user,
              aspectos: initialState.aspectos,
              criado_em: Date.now(),
            }).catch((e) =>
              console.error('[EloService] Erro ao criar nó inicial de usuário no Firebase:', e),
            );
          }
        });
      }
    });
  } catch (err) {
    console.error('[EloService] Erro ao inicializar sincronização com Firebase:', err);
  }
}


/**
 * Calibra dinamicamente o fator K do usuário com base no Tier de Elo,
 * no volume de respostas acumulado e no tempo de inatividade.
 */
export function calcularKUserDinamico(theta, totalRespostas = 0, tempoInativoDias = 0) {
  let baseK = K_USER; // 32 por padrão (Ouro)

  if (theta < 1200) {
    baseK = 48; // Iniciante / Bronze
  } else if (theta < 1350) {
    baseK = 40; // Aprendiz / Prata
  } else if (theta < 1500) {
    baseK = 32; // Competente / Ouro
  } else if (theta < 1650) {
    baseK = 28; // Platina
  } else if (theta < 1800) {
    baseK = 24; // Esmeralda / Estrategista
  } else if (theta < 2100) {
    baseK = 20; // Mestre
  } else {
    baseK = 16; // Grão-Mestre / Lorde (exige alta consistência)
  }

  // Bônus de rápida calibração para alunos novos
  if (totalRespostas < 15) {
    baseK = Math.max(baseK, 40);
  }

  // Bônus de volatilidade após inatividade prolongada (> 3 dias)
  if (tempoInativoDias > 3) {
    const boostInatividade = Math.min(16, Math.floor((tempoInativoDias - 3) * 2));
    baseK += boostInatividade;
  }

  return baseK;
}

/**
 * Aplica a Curva do Esquecimento de Ebbinghaus (Decaimento Temporal).
 * Se o aluno ficar > 3 dias inativo, o Elo global e dos aspectos regride suavemente
 * em direção ao Elo médio base (1500), mantendo um piso de segurança.
 */
export function aplicarDecaimentoTemporal(state) {
  if (!state || !state.user) return state;

  const agora = Date.now();
  const ultimoAcesso = state.user.ultimo_acesso || agora;
  const diffMs = agora - ultimoAcesso;
  const diffDias = diffMs / (1000 * 60 * 60 * 24);

  const GRACE_PERIOD_DAYS = 3;
  if (diffDias <= GRACE_PERIOD_DAYS) {
    state.user.ultimo_acesso = agora;
    return state;
  }

  const diasDecaimento = diffDias - GRACE_PERIOD_DAYS;
  // Taxa de retração diária suave: 0.3% da diferença para a base (1500) por dia inativo
  const DECAY_RATE_PER_DAY = 0.003;
  const fatorRetencao = Math.exp(-DECAY_RATE_PER_DAY * diasDecaimento);

  const thetaAtual = state.user.theta || THETA_0;
  const maxTheta = state.user.max_theta || thetaAtual;
  // Piso de segurança: não decai mais do que 150 pontos do pico do aluno nem abaixo de 1200
  const floorTheta = Math.max(1200, maxTheta - 150);

  if (thetaAtual > THETA_0) {
    const thetaNovoCalculado = THETA_0 + (thetaAtual - THETA_0) * fatorRetencao;
    state.user.theta = Math.max(floorTheta, Math.round(thetaNovoCalculado));
  }

  // Decaimento nos Aspectos (disciplinas, tópicos)
  if (state.aspectos) {
    Object.keys(state.aspectos).forEach((key) => {
      const asp = state.aspectos[key];
      if (asp && typeof asp.theta === 'number' && asp.theta > THETA_0) {
        const aspectLastUpdate = asp.ultimo_update || ultimoAcesso;
        const aspectDiffDias = (agora - aspectLastUpdate) / (1000 * 60 * 60 * 24);
        if (aspectDiffDias > GRACE_PERIOD_DAYS) {
          const aspectDiasDecaimento = aspectDiffDias - GRACE_PERIOD_DAYS;
          const aspectFator = Math.exp(-DECAY_RATE_PER_DAY * aspectDiasDecaimento);
          asp.theta = Math.round(THETA_0 + (asp.theta - THETA_0) * aspectFator);
          asp.ultimo_update = agora;
        }
      }
    });
  }

  state.user.ultimo_acesso = agora;
  return state;
}

/**
 * Gera um ajuste estocástico controlado no delta de Elo e verifica bônus de aprendizado (Critical Hit).
 */
export function gerarJitterEstocastico(acertou, sBrier, pEsperado, conviccaoAlta = false) {
  // Variância estocástica aleatória entre -4% e +4% (ruído de desempenho diário)
  const jitterFactor = (Math.random() * 0.08) - 0.04;

  let bonusAprendizado = 0;
  let isCriticalHit = false;

  // Bônus de Aprendizado (Critical Hit): Acerto em questão difícil (P < 0.45) com alta convicção
  if (acertou && conviccaoAlta && pEsperado < 0.45) {
    isCriticalHit = true;
    bonusAprendizado = Math.floor(Math.random() * 4) + 3; // +3 a +6 pontos bônus
  }

  return {
    jitterFactor,
    bonusAprendizado,
    isCriticalHit,
  };
}

/**
 * Carrega o estado global de ELO (do Firebase em produção ou LocalStorage em localhost).
 */
export function getEloState() {
  if (typeof window === 'undefined') return getDefaultState();

  if (isProductionEnvironment()) {
    if (!cacheEloState) {
      cacheEloState = getDefaultState();
      initFirebaseEloSync();
    }
    return cacheEloState;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    let state = {
      user: { ...getDefaultState().user, ...(parsed.user || {}) },
      aspectos: parsed.aspectos || {},
      questoes: parsed.questoes || {},
    };
    state = aplicarDecaimentoTemporal(state);
    return state;
  } catch (e) {
    console.error('[EloService] Erro ao carregar maia_elo_state:', e);
    return getDefaultState();
  }
}

/**
 * Salva o estado do usuário e aspectos no Firebase (Produção) ou LocalStorage (Localhost).
 */
export function saveEloState(state) {
  if (typeof window === 'undefined') return;

  if (isProductionEnvironment()) {
    cacheEloState = state;
    const currentUser = auth?.currentUser;
    if (currentUser && currentUser.uid) {
      const userEloRef = ref(db, `elo_usuarios/${currentUser.uid}`);
      set(userEloRef, {
        user: state.user || {},
        aspectos: state.aspectos || {},
        ultimo_update: Date.now(),
      }).catch((e) => {
        console.error('[EloService] Erro ao salvar elo_usuarios no Firebase:', e);
      });
    }
  } else {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[EloService] Erro ao salvar maia_elo_state:', e);
    }
  }
}

/**
 * Salva o ELO empírico compartilhado da questão no Firebase (Produção).
 */
export function saveQuestionElo(questaoId, questaoData) {
  if (!isProductionEnvironment() || typeof window === 'undefined' || !db) return;
  try {
    const qRef = ref(db, `elo_questoes/${questaoId}`);
    set(qRef, {
      ...questaoData,
      ultimo_update: Date.now(),
    }).catch((e) => {
      console.error(`[EloService] Erro ao salvar elo_questoes/${questaoId} no Firebase:`, e);
    });
  } catch (err) {
    console.error('[EloService] Erro em saveQuestionElo:', err);
  }
}


function getDefaultState() {
  return {
    user: {
      theta: THETA_0,
      max_theta: THETA_0,
      total_respostas: 0,
      total_acertos: 0,
      historico: [],
      ultimo_acesso: Date.now(),
    },
    aspectos: {},
    questoes: {},
  };
}

/**
 * Converte pontuação de complexidade/dificuldade da IA (0 a 100) para ELO Prior (b_IA).
 */
export function calcularEloPriorIA(pontuacaoOuPercentual) {
  let dIA = 50; // Valor default (Média)
  if (typeof pontuacaoOuPercentual === 'number' && !Number.isNaN(pontuacaoOuPercentual)) {
    dIA = Math.max(0, Math.min(100, pontuacaoOuPercentual));
  }
  // Formula: b_IA = theta_0 + S * ((D_IA - 50) / 50)
  const bIA = THETA_0 + SCALE_S * ((dIA - 50) / 50);
  return Math.round(bIA);
}

import { _calcularComplexidade } from '../render/ComplexityCard.tsx';

/**
 * Extrai percentual de dificuldade IA da analise_complexidade da questão
 */
export function extrairDificuldadePercentualIA(complexidadeObj, qObj = null) {
  if (complexidadeObj) {
    if (complexidadeObj.fatores && typeof complexidadeObj.fatores === 'object') {
      const calc = _calcularComplexidade(complexidadeObj);
      if (calc && typeof calc.pct === 'number' && !Number.isNaN(calc.pct)) {
        return calc.pct;
      }
    }

    if (typeof complexidadeObj.pontuacao_final_complexidade === 'number') {
      const score = complexidadeObj.pontuacao_final_complexidade;
      return score <= 10 ? score * 10 : score;
    }

    if (typeof complexidadeObj.dificuldade_percentual === 'number') {
      return complexidadeObj.dificuldade_percentual;
    }

    const nivelStr = String(
      complexidadeObj.nivel || complexidadeObj.classificacao_dificuldade || '',
    ).toUpperCase();

    if (nivelStr.includes('FÁCIL') || nivelStr.includes('FACIL')) return 25;
    if (nivelStr.includes('MÉDIA') || nivelStr.includes('MEDIA')) return 50;
    if (nivelStr.includes('DIFÍCIL') || nivelStr.includes('DIFICIL')) return 75;
    if (nivelStr.includes('DESAFIO')) return 90;
  }

  // Fallback: busca nivel no qObj se fornecido
  if (qObj) {
    const fullData = qObj.fullData || {};
    const q = fullData.dados_questao || {};
    const g = fullData.dados_gabarito || {};
    const meta = fullData.meta || {};

    const difRaw = String(
      q.dificuldade || meta.dificuldade || g.dificuldade || '',
    ).toUpperCase();

    if (difRaw.includes('FÁCIL') || difRaw.includes('FACIL') || difRaw.includes('EASY')) return 25;
    if (difRaw.includes('DESAFIO')) return 90;
    if (difRaw.includes('DIFÍCIL') || difRaw.includes('DIFICIL') || difRaw.includes('HARD')) return 75;
    if (difRaw.includes('MÉDIA') || difRaw.includes('MEDIA') || difRaw.includes('MEDIUM')) return 50;
  }

  return 50;
}

/**
 * Obtém os dados de ELO da questão (calculando e gravando o ELO IA se for a primeira vez).
 */
export function getQuestionElo(questaoId, complexidadeObj = null, qObj = null) {
  const state = getEloState();
  const stored = state.questoes[questaoId];

  if (isProductionEnvironment() && !stored && db) {
    const qRef = ref(db, `elo_questoes/${questaoId}`);
    get(qRef).then((snapshot) => {
      if (snapshot.exists()) {
        const firebaseData = snapshot.val();
        if (cacheEloState) {
          cacheEloState.questoes[questaoId] = firebaseData;
        }
      }
    }).catch((e) => console.error(`[EloService] Erro ao buscar elo_questoes/${questaoId}:`, e));
  }

  const dIA = extrairDificuldadePercentualIA(complexidadeObj, qObj);
  const bIA = calcularEloPriorIA(dIA);

  if (stored) {
    // Se a questão foi salva como 1500 sem ter dados de complexidade e agora temos dIA != 50
    if ((stored.N || 0) === 0 && (stored.b_ia === 1500 || !stored.dificuldade_ia_pct) && dIA !== 50) {
      stored.b_ia = bIA;
      stored.b_empirico = bIA;
      stored.dificuldade_ia_pct = dIA;
      stored.ultimo_update = Date.now();
      saveEloState(state);
      if (isProductionEnvironment()) {
        saveQuestionElo(questaoId, stored);
      }
    }
    const wN = N_0 / (N_0 + (stored.N || 0));
    const bEfetivo = Math.round(wN * stored.b_ia + (1 - wN) * stored.b_empirico);
    return {
      ...stored,
      b_efetivo: bEfetivo,
    };
  }

  // Primeira visualização: calcula b_ia
  const qData = {
    b_ia: bIA,
    b_empirico: bIA,
    b_efetivo: bIA,
    N: 0,
    dificuldade_ia_pct: dIA,
    criado_em: Date.now(),
    ultimo_update: Date.now(),
  };

  state.questoes[questaoId] = qData;
  saveEloState(state);
  if (isProductionEnvironment()) {
    saveQuestionElo(questaoId, qData);
  }
  return qData;
}

/**
 * Calcula a probabilidade Rasch 1PL de acerto.
 * P(acerto | theta, b) = 1 / (1 + 10^((b - theta) / 400))
 */
export function calcularProbabilidadeAcerto(theta, bEfetivo) {
  const diff = (bEfetivo - theta) / 400;
  return 1 / (1 + Math.pow(10, diff));
}

/**
 * Calcula todas as métricas metacognitivas aplicando a INVERSÃO SEMÂNTICA:
 * - Alternativa selecionada: V_sel = Certeza de que está CORRETA (0 a 100)
 * - Alternativas não selecionadas: V_i = 100 - Certeza de que está FALSA (0 a 100)
 */
export function calcularMetricasMetacognitivas(opcaoSelecionada, gabaritoCorreto, certezas = {}) {
  const letras = ['A', 'B', 'C', 'D', 'E'];
  const selUpper = String(opcaoSelecionada || '')
    .trim()
    .toUpperCase();
  const gabUpper = String(gabaritoCorreto || '')
    .trim()
    .toUpperCase();

  // Inversão Semântica do Vetor Bruto V
  const V = letras.map((l) => {
    const sliderVal = Math.max(0, Math.min(100, parseInt(certezas[l] ?? 50, 10)));
    if (l === selUpper) {
      return sliderVal; // Peso de ser verdadeira
    } else {
      return 100 - sliderVal; // Peso de ser verdadeira (100 - Certeza de ser Falsa)
    }
  });

  const somaBruta = V.reduce((acc, curr) => acc + curr, 0);

  // Normalização P (simplex probabilístico)
  let P = [0.2, 0.2, 0.2, 0.2, 0.2];
  if (somaBruta > 0) {
    P = V.map((v) => v / somaBruta);
  } else {
    const idxSel = letras.indexOf(selUpper);
    if (idxSel !== -1) {
      P = [0, 0, 0, 0, 0];
      P[idxSel] = 1.0;
    }
  }

  const idxGabarito = letras.indexOf(gabUpper);
  const idxSelecionada = letras.indexOf(selUpper);

  // 1. Multiclass Brier Error & Score
  let brierSum = 0;
  letras.forEach((_, i) => {
    const y_i = i === idxGabarito ? 1 : 0;
    brierSum += Math.pow(y_i - P[i], 2);
  });
  const brierErro = 0.5 * brierSum;
  const sBrier = Math.max(0, Math.min(1, 1 - brierErro));

  // 2. Ilusão de Conhecimento
  const acertou = selUpper === gabUpper;
  let pErro = 0;
  if (!acertou) {
    pErro = idxSelecionada !== -1 ? P[idxSelecionada] : 0;
  }
  const iIlusao = !acertou ? Math.max(0, (pErro - 0.2) / 0.8) : 0;

  // 3. Entropia de Shannon Normalizada
  let shannonH = 0;
  P.forEach((p) => {
    if (p > 0) {
      shannonH -= p * Math.log2(p);
    }
  });
  const maxH = Math.log2(5); // ~ 2.3219
  const hNorm = Math.max(0, Math.min(1, shannonH / maxH));
  const bCoerencia = 1 - hNorm;

  // 4. Taxa de Eliminação E_rate (p_i <= 0.10 nas falsas)
  let eliminadas = 0;
  letras.forEach((l, i) => {
    if (l !== gabUpper && P[i] <= 0.1) {
      eliminadas++;
    }
  });
  const eRate = eliminadas / 4;

  return {
    V,
    P,
    sBrier: parseFloat(sBrier.toFixed(3)),
    iIlusao: parseFloat(iIlusao.toFixed(3)),
    hNorm: parseFloat(hNorm.toFixed(3)),
    bCoerencia: parseFloat(bCoerencia.toFixed(3)),
    eRate: parseFloat(eRate.toFixed(2)),
    acertou,
    selUpper,
    gabUpper,
  };
}

/**
 * Analisa as métricas metacognitivas e categoriza a resposta em um dos 15 perfis acadêmicos,
 * gerando diagnósticos técnicos sobre a causa raiz cognitiva do resultado.
 */
export function diagnosticarPerfilMetacognitivo(meta, certezas = {}) {
  const { acertou, iIlusao, hNorm, eRate, P, selUpper, gabUpper } = meta;
  const letras = ['A', 'B', 'C', 'D', 'E'];
  const idxSel = letras.indexOf(selUpper);
  const idxGab = letras.indexOf(gabUpper);

  const pSel = idxSel !== -1 ? P[idxSel] : 0;
  const pGab = idxGab !== -1 ? P[idxGab] : 0;
  const sSel = Math.max(0, parseInt(certezas[selUpper] || 50, 10));
  const sGabDescarte = idxGab !== -1 ? Math.max(0, parseInt(certezas[gabUpper] || 0, 10)) : 0;

  const opcoesPlausiveis = P.filter((p) => p >= 0.2).length;

  // PERFIS DE ACERTO (1 a 5)
  if (acertou) {
    if (sSel >= 80 && eRate >= 0.75) {
      return {
        id: 1,
        titulo: '🎯 Domínio Teórico Pleno e Calibração Impecável',
        badge: '🟢 Domínio Pleno',
        orientacaoHtml: `
          <p><strong>Análise de Domínio Conceitual:</strong> Sua resolução demonstrou excelente rigor analítico e domínio completo do conteúdo. Você identificou a alternativa correta com alta convicção e desarmou com sucesso as premissas incorretas de todos os distratores.</p>
          <p><strong>Direcionamento Pedagógico:</strong> O conceito encontra-se consolidado na memória de longo prazo. Recomendamos avançar para itens de maior complexidade ou aplicar esse princípio em problemas interdisciplinares.</p>
        `,
      };
    }

    if (sSel < 50 && eRate >= 0.75) {
      return {
        id: 2,
        titulo: '🧠 Acerto por Eliminação Sistemática',
        badge: '🔵 Estratégia de Descarte',
        orientacaoHtml: `
          <p><strong>Análise de Estratégia:</strong> Você chegou ao gabarito através de um processo eficaz de rejeição das alternativas incorretas, embora mantivesse reserva sobre a redação da alternativa correta. Trata-se de uma habilidade analítica valiosa em exames formais.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Releia o enunciado da alternativa correta para consolidar a razão exata pela qual sua redação sintetiza perfeitamente o conceito exigido.</p>
        `,
      };
    }

    if (opcoesPlausiveis === 2 || (pGab >= 0.25 && pSel >= 0.25)) {
      return {
        id: 3,
        titulo: '⚖️ Acerto sob Dúvida Fina / Impasse Conceitual (50/50)',
        badge: '🟡 Dúvida Decidida',
        orientacaoHtml: `
          <p><strong>Análise de Hesitação:</strong> Sua análise isolou com precisão as duas hipóteses mais fortes do item, e sua escolha inclinou-se para o gabarito. No entanto, a retenção de peso em uma segunda opção indica que há uma condição de contorno ou nuance que ainda gera dúvida.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Compare as proposições das duas alternativas principais para identificar o elemento específico do comando que tornava a opção secundária incorreta.</p>
        `,
      };
    }

    if (hNorm >= 0.8) {
      return {
        id: 4,
        titulo: '🎲 Acerto por Incerteza Elevada (Chute Probabilístico)',
        badge: '🟠 Incerteza Elevada',
        orientacaoHtml: `
          <p><strong>Análise de Risco:</strong> Embora o item tenha sido registrado como correto, a distribuição de confiança revela um grau elevado de incerteza em praticamente todas as alternativas. Tratar este resultado como domínio efetivo pode criar uma vulnerabilidade em provas futuras.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Retorne aos fundamentos teóricos deste tópico como se a questão tivesse sido incorreta, visando construir critérios sólidos de diferenciação.</p>
        `,
      };
    }

    return {
      id: 5,
      titulo: '🔍 Acerto com Atrás de Distrator Forte',
      badge: '🟢 Acerto Parcialmente Calibrado',
      orientacaoHtml: `
        <p><strong>Análise de Atração de Distrator:</strong> Você identificou a alternativa correta, mas um dos distratores exerceu atração considerável sobre sua avaliação. Esse comportamento ocorre quando um distrator traz fatos verdadeiros em abstrato, mas desalineados ao comando.</p>
        <p><strong>Direcionamento Pedagógico:</strong> Exporte a justificativa desse distrator e valide o motivo exato pelo qual ele desrespeita a delimitação estabelecida no comando do enunciado.</p>
      `,
    };
  }

  // PERFIS DE ERRO (6 a 15)
  if (!acertou) {
    if (sSel >= 75 || iIlusao >= 0.5) {
      return {
        id: 6,
        titulo: '🔴 Ponto Cego Absoluto (Excesso de Convicção no Distrator)',
        badge: '🔴 Ponto Cego',
        orientacaoHtml: `
          <p><strong>Análise de Erro Cognitivo:</strong> Este é o erro de maior impacto pedagógico: a convicção convicta em uma premissa incorreta. Esse viés de ponto cego impede a percepção da falha durante a execução da prova.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Examine atentamente a justificativa da alternativa marcada e localize a inconsistência conceitual ou a premissa falsa que sustentou sua decisão inicial.</p>
        `,
      };
    }

    if (sGabDescarte >= 90) {
      return {
        id: 7,
        titulo: '💔 Descarte Inadvertido do Gabarito (Troca no Final)',
        badge: '🔴 Descarte Errôneo',
        orientacaoHtml: `
          <p><strong>Análise de Rejeição Precoce:</strong> Sua análise descartou rigorosamente a alternativa que continha o gabarito. Isso costuma acontecer diante de terminologias menos usuais, inversões sintáticas ou premissas implícitas.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Revise os critérios que motivaram o descarte dessa alternativa para evitar a rejeição precipitada de proposições válidas em itens futuros.</p>
        `,
      };
    }

    if (opcoesPlausiveis === 2 || (pGab >= 0.25 && pSel >= 0.25)) {
      return {
        id: 8,
        titulo: '🔄 Dúvida Fina Frustrada (Empasse 50/50 Invertido)',
        badge: '🟠 Dúvida 50/50 Invertida',
        orientacaoHtml: `
          <p><strong>Análise de Proximidade:</strong> Sua leitura isolou corretamente as duas alternativas mais plausíveis, mas a escolha final inclinou-se para o distrator mais sutil. Esse padrão demonstra que seu raciocínio estava na direção certa.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Identifique qual elemento delimitador do comando (escopo, tempo, causa ou restrição) tornava a opção correta superior à alternativa selecionada.</p>
        `,
      };
    }

    if (eRate >= 0.25 && eRate <= 0.5) {
      return {
        id: 9,
        titulo: '🧩 Eliminação Incompleta por Falta de Critério de Desempate',
        badge: '🟡 Domínio Parcial',
        orientacaoHtml: `
          <p><strong>Análise de Critérios Parciais:</strong> Você eliminou com segurança as alternativas manifestamente incorretas, mas não dispunha de critérios para desemprenhar o julgamento das restantes. Os conceitos gerais foram assimilados, mas faltam elementos de diferenciação.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Monte uma matriz comparativa entre os conceitos abordados nas alternativas que restaram sem descarte para fixar as distinções finas.</p>
        `,
      };
    }

    if (hNorm >= 0.8 && iIlusao === 0) {
      return {
        id: 10,
        titulo: '🧠 Reconhecimento Honesto de Incerteza (Humildade Metacognitiva)',
        badge: '🔵 Honestidade Metacognitiva',
        orientacaoHtml: `
          <p><strong>Análise de Transparência:</strong> Seu diagnóstico reflete perfeita honestidade metacognitiva: diante de um assunto não assimilado, você registrou incerteza sem criar falsas convicções. Reconhecer a lacuna é a etapa inicial mais importante do aprendizado.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Trata-se de um tópico que necessita de estudo estruturado a partir da teoria básica e exemplos resolvidos passo a passo.</p>
        `,
      };
    }

    if (pSel < 0.2 && eRate === 0) {
      return {
        id: 15,
        titulo: '📉 Ausência de Critério por Incerteza Extrema',
        badge: '🔴 Lacuna Teórica',
        orientacaoHtml: `
          <p><strong>Análise de Lacuna Teórica:</strong> O item foi respondido sob incerteza generalizada e sem capacidade de eliminação de distratores. Esse perfil indica ausência de contato prévio ou assimilação do conteúdo exigido.</p>
          <p><strong>Direcionamento Pedagógico:</strong> Separe esse assunto para um estudo inicial teórico guiado, seguido de questões de fixação direta.</p>
        `,
      };
    }

    return {
      id: 11,
      titulo: '⚠️ Ancoragem em Distrator por Interpretação de Escopo',
      badge: '🔴 Erro de Ancoragem',
      orientacaoHtml: `
        <p><strong>Análise de Interpretação:</strong> O padrão de marcação indica que a leitura do item partiu de um ponto de ancoragem equivocado, levando à concentração de expectativa em um distrator que não atende ao comando.</p>
        <p><strong>Direcionamento Pedagógico:</strong> Releia o texto base e o comando do enunciado sublinhando termos delimitadores para corrigir a interpretação antes de avaliar os distratores.</p>
      `,
    };
  }
}

const MAPA_FATORES_LABELS = {
  texto_extenso: 'Texto Extenso',
  vocabulario_complexo: 'Vocabulário Denso',
  multiplas_fontes_leitura: 'Múltiplas Fontes',
  interpretacao_visual: 'Visual Crítico',
  dependencia_conteudo_externo: 'Conteúdo Prévio',
  interdisciplinaridade: 'Interdisciplinar',
  contexto_abstrato: 'Abstração Contextual',
  raciocinio_contra_intuitivo: 'Contra-Intuitivo',
  abstracao_teorica: 'Teoria Pura',
  deducao_logica: 'Dedução Lógica',
  resolucao_multiplas_etapas: 'Multi-etapas',
  transformacao_informacao: 'Transformação Info',
  distratores_semanticos: 'Distratores Fortes',
  analise_nuance_julgamento: 'Julgamento/Nuance',
};

const MAPA_TIPO_ESTRUTURA_LABELS = {
  texto: 'Texto',
  imagem: 'Imagem',
  citacao: 'Citação',
  titulo: 'Título',
  subtitulo: 'Subtítulo',
  lista: 'Lista',
  equacao: 'Equação',
  codigo: 'Código',
  destaque: 'Destaque',
  separador: 'Separador',
  fonte: 'Fonte',
  tabela: 'Tabela',
};

/**
 * Extrai todos os aspectos e fatores de uma questão para atribuição e recalibração de ELO.
 */
export function extrairAspectosDaQuestao(fullData) {
  if (!fullData) return [];
  const aspectos = [];
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};
  const cred = g.creditos || {};
  const meta = fullData.meta || {};

  // 1. Disciplinas
  if (Array.isArray(q.materias_possiveis)) {
    q.materias_possiveis.forEach((m) => {
      if (m && typeof m === 'string') {
        aspectos.push({
          key: `disciplina_${m.toLowerCase().trim().replace(/\s+/g, '_')}`,
          label: m.trim(),
          categoria: 'disciplina',
          categoriaLabel: 'Disciplinas',
        });
      }
    });
  }

  // 2. Tags / Assuntos
  if (Array.isArray(q.palavras_chave)) {
    q.palavras_chave.forEach((p) => {
      if (p && typeof p === 'string') {
        aspectos.push({
          key: `tag_${p.toLowerCase().trim().replace(/\s+/g, '_')}`,
          label: p.trim(),
          categoria: 'tag',
          categoriaLabel: 'Tags & Assuntos',
        });
      }
    });
  }

  // 3. Banca / Instituição
  const banca = cred.autorouinstituicao || cred.autor_ou_instituicao;
  if (banca && typeof banca === 'string' && banca.trim()) {
    aspectos.push({
      key: `banca_${banca.toLowerCase().trim().replace(/\s+/g, '_')}`,
      label: banca.trim(),
      categoria: 'banca',
      categoriaLabel: 'Banca / Instituição',
    });
  }

  // 4. Material / Prova
  const mat = cred.material || meta.material_origem;
  if (mat && typeof mat === 'string' && mat.trim()) {
    aspectos.push({
      key: `material_${mat.toLowerCase().trim().replace(/\s+/g, '_')}`,
      label: mat.trim(),
      categoria: 'material',
      categoriaLabel: 'Material / Prova',
    });
  }

  // 5. Ano
  const ano = cred.ano || cred.year;
  if (ano) {
    aspectos.push({
      key: `ano_${ano}`,
      label: String(ano),
      categoria: 'ano',
      categoriaLabel: 'Ano',
    });
  }

  // 6. Fatores de Dificuldade / Complexidade
  const fatoresObj = g.analise_complexidade?.fatores;
  if (fatoresObj && typeof fatoresObj === 'object') {
    Object.entries(fatoresObj).forEach(([fKey, fVal]) => {
      if (fVal === true) {
        const label =
          MAPA_FATORES_LABELS[fKey] ||
          fKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        aspectos.push({
          key: `fator_${fKey}`,
          label,
          categoria: 'fator',
          categoriaLabel: 'Fatores de Complexidade',
        });
      }
    });
  }

  // 7. Estrutura (Enunciado)
  if (Array.isArray(q.estrutura)) {
    const tiposVistos = new Set();
    q.estrutura.forEach((b) => {
      const t = (b.tipo || 'texto').toLowerCase();
      if (!tiposVistos.has(t)) {
        tiposVistos.add(t);
        const label = MAPA_TIPO_ESTRUTURA_LABELS[t] || t.toUpperCase();
        aspectos.push({
          key: `est_enunciado_${t}`,
          label: `Enunciado: ${label}`,
          categoria: 'est_enunciado',
          categoriaLabel: 'Estrutura Enunciado',
        });
      }
    });
  }

  // 8. Estrutura (Alternativas)
  if (Array.isArray(q.alternativas)) {
    const tiposVistosAlt = new Set();
    q.alternativas.forEach((alt) => {
      if (Array.isArray(alt.estrutura)) {
        alt.estrutura.forEach((b) => {
          const t = (b.tipo || 'texto').toLowerCase();
          if (!tiposVistosAlt.has(t)) {
            tiposVistosAlt.add(t);
            const label = MAPA_TIPO_ESTRUTURA_LABELS[t] || t.toUpperCase();
            aspectos.push({
              key: `est_alternativa_${t}`,
              label: `Alternativa: ${label}`,
              categoria: 'est_alternativa',
              categoriaLabel: 'Estrutura Alternativas',
            });
          }
        });
      }
    });
  }

  // 9. Estrutura (Gabarito)
  if (Array.isArray(g.explicacao)) {
    const tiposVistosGab = new Set();
    g.explicacao.forEach((passo) => {
      if (Array.isArray(passo.estrutura)) {
        passo.estrutura.forEach((b) => {
          const t = (b.tipo || 'texto').toLowerCase();
          if (!tiposVistosGab.has(t)) {
            tiposVistosGab.add(t);
            const label = MAPA_TIPO_ESTRUTURA_LABELS[t] || t.toUpperCase();
            aspectos.push({
              key: `est_gabarito_${t}`,
              label: `Gabarito: ${label}`,
              categoria: 'est_gabarito',
              categoriaLabel: 'Estrutura Gabarito',
            });
          }
        });
      }
    });
  }

  return aspectos;
}

/**
 * Processa a submissão de uma resposta e atualiza os ELOs (Usuário, Questão e Aspectos/Fatores).
 */
/**
 * Processa a submissão de uma resposta e atualiza os ELOs (Usuário, Questão e Aspectos/Fatores).
 * Suporta questões Objetivas (A-E) e Dissertativas (Nota binária 1/0 ou proporcional).
 */
export function processarResposta({
  questaoId,
  opcaoSelecionada,
  gabaritoCorreto,
  certezas = {},
  complexidadeObj = null,
  fullData = null,
  tipoQuestao = 'objetiva',
  notaDissertativa = null,
}) {
  let state = getEloState();
  state = aplicarDecaimentoTemporal(state);

  const user = state.user;
  user.max_theta = Math.max(user.max_theta || THETA_0, user.theta);
  state.aspectos = state.aspectos || {};
  const questaoEloOld = getQuestionElo(questaoId, complexidadeObj);

  const thetaOld = user.theta;
  const bEfetivoOld = questaoEloOld.b_efetivo;

  // 1. Probabilidade de Acerto (Rasch 1PL)
  const pEsperado = calcularProbabilidadeAcerto(thetaOld, bEfetivoOld);

  // 2. Metracognição & Avaliação de Desempenho
  let meta;
  let sConhecimento;

  const isDissertativa = tipoQuestao === 'dissertativa' || notaDissertativa !== null;

  if (isDissertativa) {
    const rawNota = typeof notaDissertativa === 'number'
      ? Math.max(0, Math.min(1, notaDissertativa))
      : (String(opcaoSelecionada).trim().toLowerCase() === String(gabaritoCorreto).trim().toLowerCase() ? 1 : 0);

    const acertouDissertativa = rawNota >= 0.7;
    sConhecimento = acertouDissertativa ? 1.0 : 0.0;

    meta = {
      acertou: acertouDissertativa,
      sBrier: rawNota,
      iIlusao: 0,
      hNorm: 0,
      bCoerencia: 1,
      eRate: 0,
      tipoQuestao: 'dissertativa',
      notaDissertativa: rawNota,
    };
  } else {
    meta = calcularMetricasMetacognitivas(opcaoSelecionada, gabaritoCorreto, certezas);
    sConhecimento = meta.acertou ? 1.0 : 0.0;

    // Ponderação Metacognitiva: se acertou mas com certeza muito baixa (<= 35%), atenua o ganho (fator de chute)
    const certezaSel = certezas[String(opcaoSelecionada || '').toUpperCase()] ?? 50;
    if (meta.acertou && certezaSel <= 35) {
      sConhecimento = 0.75;
    }
  }

  const diagnostico = isDissertativa ? null : diagnosticarPerfilMetacognitivo(meta, certezas);

  // 3. Cálculo do K-Factor Dinâmico por Tier e Tempo Inativo
  const tempoInativoDias = state.user.ultimo_acesso
    ? Math.max(0, (Date.now() - state.user.ultimo_acesso) / (1000 * 60 * 60 * 24))
    : 0;
  const kUserDinamico = calcularKUserDinamico(thetaOld, user.total_respostas || 0, tempoInativoDias);

  // 4. Jitter Estocástico & Bônus de Aprendizado (Critical Hit)
  const certezaSelObj = certezas[String(opcaoSelecionada || '').toUpperCase()] ?? 50;
  const conviccaoAlta = meta.acertou && (isDissertativa || certezaSelObj >= 80);
  const stoch = gerarJitterEstocastico(meta.acertou, meta.sBrier, pEsperado, conviccaoAlta);

  // 5. Atualização de ELO do Aluno
  const deltaBase = kUserDinamico * (sConhecimento - pEsperado);
  const deltaComJitter = deltaBase * (1 + stoch.jitterFactor) + stoch.bonusAprendizado;
  const thetaNew = Math.round(thetaOld + deltaComJitter);

  // 6. Atualização do ELO Empírico da Questão
  const deltaBEmpirico = K_ITEM * (pEsperado - (meta.acertou ? 1 : 0));
  const bEmpiricoNew = questaoEloOld.b_empirico + deltaBEmpirico;
  const nNew = questaoEloOld.N + 1;

  // Shrinkage para novo b_efetivo
  const wN = N_0 / (N_0 + nNew);
  let bEfetivoCalculated = wN * questaoEloOld.b_ia + (1 - wN) * bEmpiricoNew;
  let bEfetivoNew = Math.round(bEfetivoCalculated);

  if (bEfetivoNew === bEfetivoOld && Math.abs(deltaBEmpirico) >= 0.5) {
    bEfetivoNew = deltaBEmpirico < 0 ? bEfetivoOld - 1 : bEfetivoOld + 1;
  }

  // 7. Atualização de ELO de Cada Aspecto/Fator da Questão
  const aspectosDaQuestao = extrairAspectosDaQuestao(fullData);
  const aspectosAtualizados = [];

  aspectosDaQuestao.forEach((asp) => {
    const existing = state.aspectos[asp.key] || {
      theta: THETA_0,
      total_respostas: 0,
      total_acertos: 0,
      label: asp.label,
      categoria: asp.categoria,
      categoriaLabel: asp.categoriaLabel,
    };

    const aspectThetaOld = existing.theta;
    const pAspect = calcularProbabilidadeAcerto(aspectThetaOld, bEfetivoOld);
    const aspectK = calcularKUserDinamico(aspectThetaOld, existing.total_respostas || 0, 0);
    const deltaAspect = aspectK * (sConhecimento - pAspect) * (1 + stoch.jitterFactor);
    const aspectThetaNew = Math.round(aspectThetaOld + deltaAspect);

    const aspectUpdated = {
      theta: aspectThetaNew,
      total_respostas: (existing.total_respostas || 0) + 1,
      total_acertos: (existing.total_acertos || 0) + (meta.acertou ? 1 : 0),
      label: asp.label,
      categoria: asp.categoria,
      categoriaLabel: asp.categoriaLabel,
      ultimo_update: Date.now(),
    };

    state.aspectos[asp.key] = aspectUpdated;

    aspectosAtualizados.push({
      key: asp.key,
      label: asp.label,
      categoria: asp.categoria,
      categoriaLabel: asp.categoriaLabel,
      thetaOld: aspectThetaOld,
      thetaNew: aspectThetaNew,
      deltaTheta: Math.round(deltaAspect),
      total_respostas: aspectUpdated.total_respostas,
      total_acertos: aspectUpdated.total_acertos,
    });
  });

  // 8. Atualização dos Estados Globais
  const userNew = {
    ...user,
    theta: thetaNew,
    max_theta: Math.max(user.max_theta || THETA_0, thetaNew),
    total_respostas: user.total_respostas + 1,
    total_acertos: user.total_acertos + (meta.acertou ? 1 : 0),
    ultimo_acesso: Date.now(),
    historico: [
      {
        questaoId,
        tipoQuestao: isDissertativa ? 'dissertativa' : 'objetiva',
        thetaBefore: thetaOld,
        thetaAfter: thetaNew,
        deltaTheta: Math.round(deltaComJitter),
        kUserDinamico,
        isCriticalHit: stoch.isCriticalHit,
        bonusAprendizado: stoch.bonusAprendizado,
        bBefore: bEfetivoOld,
        bAfter: bEfetivoNew,
        acertou: meta.acertou,
        opcaoSelecionada,
        gabaritoCorreto,
        certezas,
        sBrier: meta.sBrier,
        iIlusao: meta.iIlusao,
        hNorm: meta.hNorm,
        bCoerencia: meta.bCoerencia,
        eRate: meta.eRate,
        diagnosticoId: diagnostico?.id,
        diagnosticoTitulo: diagnostico?.titulo,
        aspectosKeys: aspectosDaQuestao.map((a) => a.key),
        materias: aspectosDaQuestao.filter((a) => a.categoria === 'disciplina').map((a) => a.label),
        banca: aspectosDaQuestao.find((a) => a.categoria === 'banca')?.label || null,
        timestamp: Date.now(),
      },
      ...(user.historico || []).slice(0, 499),
    ],
  };

  const questaoNewData = {
    ...questaoEloOld,
    b_empirico: bEmpiricoNew,
    b_efetivo: bEfetivoNew,
    N: nNew,
    ultimo_update: Date.now(),
  };

  state.user = userNew;
  state.questoes[questaoId] = questaoNewData;
  saveEloState(state);
  if (isProductionEnvironment()) {
    saveQuestionElo(questaoId, questaoNewData);
  }

  const deltaThetaRound = Math.round(deltaComJitter);
  const deltaBRound = bEfetivoNew - bEfetivoOld;

  const oldRankTier = getEloRankTier(thetaOld);
  const newRankTier = getEloRankTier(thetaNew);
  let rankChange = null;

  if (oldRankTier.id !== newRankTier.id) {
    rankChange = {
      type: newRankTier.id > oldRankTier.id ? 'up' : 'down',
      oldTier: oldRankTier,
      newTier: newRankTier,
      thetaOld,
      thetaNew,
    };
  }

  return {
    acertou: meta.acertou,
    tipoQuestao: isDissertativa ? 'dissertativa' : 'objetiva',
    user: {
      thetaOld,
      thetaNew,
      deltaTheta: deltaThetaRound,
      kUserDinamico,
      isCriticalHit: stoch.isCriticalHit,
      bonusAprendizado: stoch.bonusAprendizado,
      rankChange,
    },
    questao: {
      bOld: bEfetivoOld,
      bNew: bEfetivoNew,
      deltaB: deltaBRound,
      N: nNew,
      bIA: questaoEloOld.b_ia,
    },
    aspectos: aspectosAtualizados,
    pEsperado: parseFloat(pEsperado.toFixed(3)),
    meta,
    diagnostico,
  };
}

/**
 * Retorna o Tier e nível de Ranking de acordo com o Elo Theta.
 */
export function getEloRankTier(theta = THETA_0) {
  const TIERS = [
    { id: 10, tier: 'Lorde Metacognitivo', label: 'Lorde', badge: 'Lorde Metacognitivo', min: 2500, max: 4000, color: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', glow: 'rgba(99, 102, 241, 0.5)', iconKey: 'lorde' },
    { id: 9, tier: 'Campeão Absoluto', label: 'Campeão', badge: 'Campeão Absoluto', min: 2300, max: 2499, color: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)', glow: 'rgba(239, 68, 68, 0.5)', iconKey: 'campeao' },
    { id: 8, tier: 'Grão-Mestre', label: 'Grão-Mestre', badge: 'Grão-Mestre', min: 2100, max: 2299, color: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)', glow: 'rgba(245, 158, 11, 0.5)', iconKey: 'graomestre' },
    { id: 7, tier: 'Mestre', label: 'Mestre', badge: 'Mestre', min: 1950, max: 2099, color: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)', glow: 'rgba(236, 72, 153, 0.5)', iconKey: 'mestre' },
    { id: 6, tier: 'Estrategista', label: 'Estrategista', badge: 'Estrategista', min: 1800, max: 1949, color: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', glow: 'rgba(168, 85, 247, 0.4)', iconKey: 'estrategista' },
    { id: 5, tier: 'Esmeralda', label: 'Esmeralda', badge: 'Esmeralda', min: 1650, max: 1799, color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', glow: 'rgba(16, 185, 129, 0.4)', iconKey: 'esmeralda' },
    { id: 4, tier: 'Platina', label: 'Platina', badge: 'Platina', min: 1500, max: 1649, color: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', glow: 'rgba(59, 130, 246, 0.4)', iconKey: 'platina' },
    { id: 3, tier: 'Competente', label: 'Competente', badge: 'Competente', min: 1350, max: 1499, color: 'linear-gradient(135deg, #21808d 0%, #32b8c6 100%)', glow: 'rgba(50, 184, 198, 0.4)', iconKey: 'competente' },
    { id: 2, tier: 'Aprendiz', label: 'Aprendiz', badge: 'Aprendiz', min: 1200, max: 1349, color: 'linear-gradient(135deg, #9e9e9e 0%, #616161 100%)', glow: 'rgba(158, 158, 158, 0.4)', iconKey: 'prata' },
    { id: 1, tier: 'Iniciante', label: 'Iniciante', badge: 'Iniciante', min: 0, max: 1199, color: 'linear-gradient(135deg, #8d6e63 0%, #4e342e 100%)', glow: 'rgba(141, 110, 99, 0.4)', iconKey: 'bronze' },
  ];

  const current = TIERS.find((t) => theta >= t.min) || TIERS[TIERS.length - 1];
  const nextTierIndex = TIERS.indexOf(current) - 1;
  const nextTier = nextTierIndex >= 0 ? TIERS[nextTierIndex] : null;

  let progressPct = 100;
  if (nextTier) {
    const range = nextTier.min - current.min;
    const curr = theta - current.min;
    progressPct = Math.min(100, Math.max(0, Math.round((curr / range) * 100)));
  }

  return {
    ...current,
    nextTier: nextTier ? nextTier.tier : null,
    nextMin: nextTier ? nextTier.min : current.max,
    progressPct,
    allTiers: TIERS.slice().reverse(),
  };
}

/**
 * CATALOGO COMPLETO DE 40 PERFIS DE ESTUDANTE (MATRIZ DETERMINÍSTICA)
 */
const CATALOGO_PERFIS_ESTUDANTE = [
  // EIXO 1: METACOGNIÇÃO & CALIBRAÇÃO
  {
    id: 'M01',
    eixo: 'Metacognição & Calibração',
    eixoId: 'metacognicao',
    titulo: '🎯 O Estrategista Autoconsciente',
    badge: '🎯 Autoconsciente',
    cor: '#10b981',
    descricao: 'Apresenta autocalibração exemplar. Sabe exatamente a extensão do seu conhecimento e onde reside o risco de hesitação.',
    recomendacao: 'Mantenha a disciplina de registro metacognitivo para continuar identificando pontos cegos antes que eles virem erros.',
    avaliar: (stats) => stats.total > 2 && stats.avgBrier >= 0.75 && stats.avgIlusao <= 0.15,
  },
  {
    id: 'M02',
    eixo: 'Metacognição & Calibração',
    eixoId: 'metacognicao',
    titulo: '🔴 O Convicto Iludido',
    badge: '🔴 Viés de Convicção',
    cor: '#ef4444',
    descricao: 'Exibe iluminação de conhecimento elevada: assinala alto grau de certeza em alternativas que contêm pegadinhas ou erros conceituais.',
    recomendacao: 'Foque em auditoria dos seus erros de alta convicção. Antes de confirmar uma certeza alta, busque a premissa oculta no enunciado.',
    avaliar: (stats) => stats.total > 2 && stats.avgIlusao >= 0.35,
  },
  {
    id: 'M03',
    eixo: 'Metacognição & Calibração',
    eixoId: 'metacognicao',
    titulo: '🛡️ O Cético Hesitante',
    badge: '🛡️ Cético Prudente',
    cor: '#3b82f6',
    descricao: 'Consegue chegar ao gabarito correto com frequência, mas assinala certezas moderadas ou baixas devido à hiper-prudência.',
    recomendacao: 'Confie mais no seu processo analítico. Seu acerto empírico é superior à sua percepção de risco.',
    avaliar: (stats) => stats.total > 2 && stats.taxaAcerto >= 0.7 && stats.avgBrier < 0.6,
  },
  {
    id: 'M04',
    eixo: 'Metacognição & Calibração',
    eixoId: 'metacognicao',
    titulo: '🧠 O Racional Coerente',
    badge: '🧠 Coerência Lógica',
    cor: '#8b5cf6',
    descricao: 'Distribui os pesos de probabilidade com baixa entropia e rigor analítico, demonstrando clareza de pensamento.',
    recomendacao: 'Excelente consistência mental. Mantenha essa metodologia pragmática.',
    avaliar: (stats) => stats.total > 2 && stats.avgCoerencia >= 0.75,
  },
  {
    id: 'M05',
    eixo: 'Metacognição & Calibração',
    eixoId: 'metacognicao',
    titulo: '🎲 O Intuitivo Caótico',
    badge: '🎲 Alta Incerteza',
    cor: '#f59e0b',
    descricao: 'Responde sob elevada incerteza distributiva (entropia alta), indicando oscilação na interpretação das alternativas.',
    recomendacao: 'Reforce o hábito de eliminação sistemática. Antes de escolher, descarte explicitamente 2 opções falsas.',
    avaliar: (stats) => stats.total > 2 && stats.avgEntropia >= 0.7,
  },

  // EIXO 2: NÍVEL DE ELO & MAESTRIA
  {
    id: 'E01',
    eixo: 'Nível de ELO & Maestria',
    eixoId: 'maestria',
    titulo: '👑 Grão-Mestre Absoluto',
    badge: '👑 Grão-Mestre',
    cor: '#f59e0b',
    descricao: 'Atingiu o topo da escala Elo de referência (1900+). Domina itens de altíssima complexidade e exigência conceitual.',
    recomendacao: 'Desafie-se em simulados de alta velocidade ou itens inéditos de bancas de ponta.',
    avaliar: (stats) => stats.theta >= 1900,
  },
  {
    id: 'E02',
    eixo: 'Nível de ELO & Maestria',
    eixoId: 'maestria',
    titulo: '🔮 Mestre dos Fundamentos',
    badge: '🔮 Mestre Elo',
    cor: '#a855f7',
    descricao: 'Alcançou nível de Elo 1750-1899. Solidez teórica notável e baixa taxa de falha em itens médios e difíceis.',
    recomendacao: 'Foque nos ajustes finos dos fatores de maior complexidade para alcançar o Elo Grão-Mestre.',
    avaliar: (stats) => stats.theta >= 1750 && stats.theta < 1900,
  },
  {
    id: 'E03',
    eixo: 'Nível de ELO & Maestria',
    eixoId: 'maestria',
    titulo: '💎 Especialista em Escala',
    badge: '💎 Especialista',
    cor: '#3b82f6',
    descricao: 'Elo 1600-1749. Demonstra domínio consistente da maior parte do conteúdo de provas de concursos e vestibulares.',
    recomendacao: 'Monitore as matérias de menor Elo relativo para equilibrar seu perfil global.',
    avaliar: (stats) => stats.theta >= 1600 && stats.theta < 1750,
  },
  {
    id: 'E04',
    eixo: 'Nível de ELO & Maestria',
    eixoId: 'maestria',
    titulo: '🚀 Competente em Ascensão',
    badge: '🚀 Competente',
    cor: '#10b981',
    descricao: 'Elo 1450-1599. Nível sólido com boa resposta aos treinos de fixação.',
    recomendacao: 'Incremente o volume diário de questões para impulsionar a migração para a faixa de Especialista.',
    avaliar: (stats) => stats.theta >= 1450 && stats.theta < 1600,
  },
  {
    id: 'E05',
    eixo: 'Nível de ELO & Maestria',
    eixoId: 'maestria',
    titulo: '⚡ Aprendiz Dedicado',
    badge: '⚡ Aprendiz',
    cor: '#f97316',
    descricao: 'Elo 1300-1449. Em processo ativo de assimilação dos conceitos primários.',
    recomendacao: 'Revise os resumos de gabarito comentado após cada resolução para consolidar os conceitos.',
    avaliar: (stats) => stats.theta >= 1300 && stats.theta < 1450,
  },
  {
    id: 'E06',
    eixo: 'Nível de ELO & Maestria',
    eixoId: 'maestria',
    titulo: '🌱 Explorador da Base',
    badge: '🌱 Iniciante',
    cor: '#94a3b8',
    descricao: 'Elo inicial (< 1300). Construindo a base do repertório acadêmico.',
    recomendacao: 'Foque em questões de fixação e leia atentamente os comentários metodológicos.',
    avaliar: (stats) => stats.theta < 1300,
  },

  // EIXO 3: TÁTICA DE DESCARTE & RESOLUÇÃO
  {
    id: 'T01',
    eixo: 'Tática de Descarte & Resolução',
    eixoId: 'tatica',
    titulo: '🗡️ O Aniquilador de Distratores',
    badge: '🗡️ Eliminação 100%',
    cor: '#10b981',
    descricao: 'Aplica taxa de eliminação `eRate >= 0.75`. Identifica e anula rigorosamente todas as proposições falsas.',
    recomendacao: 'Excelente técnica! Essa tática reduz drasticamente o risco de erros por bobeira.',
    avaliar: (stats) => stats.total > 2 && stats.avgElimination >= 0.75,
  },
  {
    id: 'T02',
    eixo: 'Tática de Descarte & Resolução',
    eixoId: 'tatica',
    titulo: '🔍 O Mestre do Descarte Seletivo',
    badge: '🔍 Descarte Eficiente',
    cor: '#06b6d4',
    descricao: 'Elimina de 50% a 75% dos distratores falsos antes do julgamento final.',
    recomendacao: 'Busque aprofundar o descarte do distrator secundário para zerar dúvidas recorrentes.',
    avaliar: (stats) => stats.total > 2 && stats.avgElimination >= 0.5 && stats.avgElimination < 0.75,
  },
  {
    id: 'T03',
    eixo: 'Tática de Descarte & Resolução',
    eixoId: 'tatica',
    titulo: '⚖️ O Decisor de 50/50',
    badge: '⚖️ Foco em 50/50',
    cor: '#eab308',
    descricao: 'Isola com facilidade as duas alternativas mais plausíveis, travando a batalha decisiva na nuance final.',
    recomendacao: 'Ao ficar em 50/50, releia o comando do enunciado procurando uma restrição temporal ou de escopo.',
    avaliar: (stats) => stats.frequencia5050 >= 0.3,
  },
  {
    id: 'T04',
    eixo: 'Tática de Descarte & Resolução',
    eixoId: 'tatica',
    titulo: '⚠️ O Arriscador Imprudente',
    badge: '⚠️ Baixa Eliminação',
    cor: '#ef4444',
    descricao: 'Taxa de eliminação reduzida (< 0.25). Seleciona a opção sem verificar a inconsistência das demais.',
    recomendacao: 'Force a marcação do slider de descarte nas alternativas falsas antes de confirmar a resposta.',
    avaliar: (stats) => stats.total > 2 && stats.avgElimination < 0.25,
  },

  // EIXO 4: POLARIZAÇÃO & DOMÍNIO TEMÁTICO
  {
    id: 'P01',
    eixo: 'Polarização & Domínio Temático',
    eixoId: 'polarizacao',
    titulo: '🌐 O Polímata Generalista',
    badge: '🌐 Polímata Equilibrado',
    cor: '#10b981',
    descricao: 'Exibe desempenho homogêneo entre as várias matérias (baixo desvio padrão de Elo por disciplina).',
    recomendacao: 'Perfil altamente recomendado para concursos públicos de amplo espectro.',
    avaliar: (stats) => stats.numMaterias >= 2 && stats.stdDevMaterias <= 60,
  },
  {
    id: 'P02',
    eixo: 'Polarização & Domínio Temático',
    eixoId: 'polarizacao',
    titulo: '🎯 O Especialista Hiper-Focado',
    badge: '🎯 Hiper-Focado',
    cor: '#ec4899',
    descricao: 'Possui um Elo significativamente mais alto em uma disciplina específica em comparação com a média.',
    recomendacao: 'Aproveite sua força na disciplina principal e dedique ciclos de estudo para puxar as matérias de base.',
    avaliar: (stats) => stats.numMaterias >= 2 && stats.stdDevMaterias > 120,
  },
  {
    id: 'P03',
    eixo: 'Polarização & Domínio Temático',
    eixoId: 'polarizacao',
    titulo: '📜 O Guardião de Humanas & Direito',
    badge: '📜 Mestre em Humanas',
    cor: '#8b5cf6',
    descricao: 'Elevado desempenho em matérias de Português, Direito, História, Geografia e Filosofia.',
    recomendacao: 'Excelente capacidade de interpretação textual e hermenêutica.',
    avaliar: (stats) => stats.topDisciplinaCategoria === 'humanas_direito',
  },
  {
    id: 'P04',
    eixo: 'Polarização & Domínio Temático',
    eixoId: 'polarizacao',
    titulo: '📐 O Mestre das Exatas & Lógica',
    badge: '📐 Mestre em Exatas',
    cor: '#3b82f6',
    descricao: 'Elevada precisão em Matemática, Raciocínio Lógico, Física e Química.',
    recomendacao: 'Ótima capacidade de raciocínio sequencial e resolução multi-etapas.',
    avaliar: (stats) => stats.topDisciplinaCategoria === 'exatas_logica',
  },
  {
    id: 'P05',
    eixo: 'Polarização & Domínio Temático',
    eixoId: 'polarizacao',
    titulo: '🧬 O Analista Biomédico',
    badge: '🧬 Biologia & Saúde',
    cor: '#10b981',
    descricao: 'Destaca-se em questões de Biologia, Saúde e Ciências da Natureza.',
    recomendacao: 'Excelente retenção de processos orgânicos e estruturas conceituais.',
    avaliar: (stats) => stats.topDisciplinaCategoria === 'biologicas',
  },

  // EIXO 5: RESILIÊNCIA & CURVA DE EVOLUÇÃO
  {
    id: 'R01',
    eixo: 'Resiliência & Curva de Evolução',
    eixoId: 'resiliencia',
    titulo: '🔥 A Fênix Resiliente',
    badge: '🔥 Fênix Resiliente',
    cor: '#f97316',
    descricao: 'Recupera-se imediatamente após erros, mantendo o foco sem deixar que o tropeço afete a questão seguinte.',
    recomendacao: 'Atitude mental forte. Essa resiliência é um diferencial crítico durante provas longas.',
    avaliar: (stats) => stats.recuperacaoPosErro >= 0.66,
  },
  {
    id: 'R02',
    eixo: 'Resiliência & Curva de Evolução',
    eixoId: 'resiliencia',
    titulo: '⚡ O Inabalável em Sequência',
    badge: '⚡ Streak Implacável',
    cor: '#eab308',
    descricao: 'Engrena sequências longas de acertos consecutivos (streak >= 4).',
    recomendacao: 'Mantenha o ritmo sem baixar a guarda nas questões finais do bloco.',
    avaliar: (stats) => stats.maxStreak >= 4,
  },
  {
    id: 'R03',
    eixo: 'Resiliência & Curva de Evolução',
    eixoId: 'resiliencia',
    titulo: '📉 O Sensível a Saltos de Complexidade',
    badge: '📉 Sensível a Desafios',
    cor: '#ef4444',
    descricao: 'Desempenho excelente em questões fáceis/médias, mas oscila quando o Elo da questão supera em muito o Elo pessoal.',
    recomendacao: 'Pratique mais itens de nível "Desafio" com acompanhamento do tutor IA para perder o receio.',
    avaliar: (stats) => stats.taxaAcertoDesafio < 0.4 && stats.taxaAcertoFacil > 0.75,
  },
  {
    id: 'R04',
    eixo: 'Resiliência & Curva de Evolução',
    eixoId: 'resiliencia',
    titulo: '📈 O Escalador em Tendência Alta',
    badge: '📈 Tendência de Alta',
    cor: '#10b981',
    descricao: 'Saldo de Elo fortemente positivo nas últimas resoluções.',
    recomendacao: 'Seu aprendizado recente está se convertendo em ganho direto de Elo!',
    avaliar: (stats) => stats.recentDeltaSum >= 20,
  },
  {
    id: 'R05',
    eixo: 'Resiliência & Curva de Evolução',
    eixoId: 'resiliencia',
    titulo: '🏃 O Maratonista Consistente',
    badge: '🏃 Maratonista',
    cor: '#6366f1',
    descricao: 'Acumula volume expressivo de questões respondidas com estabilidade de desempenho.',
    recomendacao: 'A constância é a chave da aprovação. Continue resolvendo blocos diários.',
    avaliar: (stats) => stats.total >= 20,
  },

  // EIXO 6: PREFERÊNCIA ESTRUTURAL DE ITEM
  {
    id: 'S01',
    eixo: 'Preferência Estrutural de Item',
    eixoId: 'estrutural',
    titulo: '📚 O Decifrador de Textos Densos',
    badge: '📚 Texto Extenso',
    cor: '#3b82f6',
    descricao: 'Mantém alto Elo e precisão ao resolver itens marcados pelo fator `texto_extenso` ou `vocabulario_complexo`.',
    recomendacao: 'Excelente resistência de leitura. Use essa vantagem em exames de longa duração.',
    avaliar: (stats) => stats.eloFatorTextoExtenso >= stats.theta - 30,
  },
  {
    id: 'S02',
    eixo: 'Preferência Estrutural de Item',
    eixoId: 'estrutural',
    titulo: '📊 O Leitor Visual & Gráfico',
    badge: '📊 Análise Visual',
    cor: '#06b6d4',
    descricao: 'Destaca-se em questões com suporte de imagem, tabelas, infográficos e esquemas.',
    recomendacao: 'Ótima capacidade de síntese visual de dados.',
    avaliar: (stats) => stats.eloFatorVisual >= stats.theta - 30,
  },
  {
    id: 'S03',
    eixo: 'Preferência Estrutural de Item',
    eixoId: 'estrutural',
    titulo: '🧩 O Mestre da Nuance & Julgamento',
    badge: '🧩 Nuance & Julgamento',
    cor: '#8b5cf6',
    descricao: 'Capacidade diferenciada de identificar ambiguidades e nuances finas de julgamento no enunciado.',
    recomendacao: 'Raciocínio analítico apurado.',
    avaliar: (stats) => stats.eloFatorNuance >= stats.theta - 30,
  },
  {
    id: 'S04',
    eixo: 'Preferência Estrutural de Item',
    eixoId: 'estrutural',
    titulo: '⚡ O Pragmático Pronto',
    badge: '⚡ Resolução Direta',
    cor: '#10b981',
    descricao: 'Desempenho ágil e preciso em itens de enunciado direto e poucas etapas.',
    recomendacao: 'Garante pontos rápidos na prova para investir tempo nas questões mais complexas.',
    avaliar: (stats) => stats.eloFatorDireto >= stats.theta - 30,
  },

  // EIXO 7: PERFIL DE ESTILO DE PROVA
  {
    id: 'B01',
    eixo: 'Perfil de Estilo de Prova',
    eixoId: 'estilo_prova',
    titulo: '🏛️ O Especialista em Itens de Alta Densidade Textual',
    badge: '🏛️ Alta Densidade',
    cor: '#3b82f6',
    descricao: 'Desempenho acima da média em exames com textos longos, interpretação densa e interdisciplinaridade.',
    recomendacao: 'Domínio de leitura crítica aplicável a exames exigentes.',
    avaliar: (stats) => stats.eloEstiloDenso >= stats.theta,
  },
  {
    id: 'B02',
    eixo: 'Perfil de Estilo de Prova',
    eixoId: 'estilo_prova',
    titulo: '⚖️ O Mestre de Proposições Assertivas & Armadilhas',
    badge: '⚖️ Proposições & Pegadinhas',
    cor: '#8b5cf6',
    descricao: 'Destaca-se no julgamento de proposições diretas e na identificação de distratores semânticos e armadilhas.',
    recomendacao: 'Foco e atenção plena na análise de cada palavra-chave.',
    avaliar: (stats) => stats.eloEstiloAssertivo >= stats.theta,
  },
  {
    id: 'B03',
    eixo: 'Perfil de Estilo de Prova',
    eixoId: 'estilo_prova',
    titulo: '📝 O Focado em Questões Conceituais Diretas',
    badge: '📝 Conceitual Direto',
    cor: '#10b981',
    descricao: 'Elevada taxa de acerto em questões objetivas tradicionais e aplicação direta da teoria.',
    recomendacao: 'Aproveite essa velocidade para garantir pontos com precisão.',
    avaliar: (stats) => stats.eloEstiloConceitual >= stats.theta,
  },
  {
    id: 'B04',
    eixo: 'Perfil de Estilo de Prova',
    eixoId: 'estilo_prova',
    titulo: '🌐 O Adaptável a Múltiplos Formatos de Exame',
    badge: '🌐 Camaleão de Provas',
    cor: '#ec4899',
    descricao: 'Demostra flexibilidade e alta performance em variados formatos de itens e estruturas de prova.',
    recomendacao: 'Excelente versatilidade para qualquer desafio de seleção.',
    avaliar: (stats) => stats.total >= 5 && stats.stdDevEstilos <= 50,
  },
  {
    id: 'B05',
    eixo: 'Perfil de Estilo de Prova',
    eixoId: 'estilo_prova',
    titulo: '🛡️ O Caçador de Armadilhas Semânticas',
    badge: '🛡️ Anti-Distrator',
    cor: '#f59e0b',
    descricao: 'Alto Elo no combate a distratores semânticos que usam palavras com sentido trocado.',
    recomendacao: 'Ótima imunidade a armadilhas de redação.',
    avaliar: (stats) => stats.eloFatorDistratores >= stats.theta,
  },
  {
    id: 'B06',
    eixo: 'Perfil de Estilo de Prova',
    eixoId: 'estilo_prova',
    titulo: '📖 O Dominador de Teoria Pura',
    badge: '📖 Teoria Pura',
    cor: '#6366f1',
    descricao: 'Excelente retenção e aplicação do fator de abstração teórica pura.',
    recomendacao: 'Fortíssima base conceitual.',
    avaliar: (stats) => stats.eloFatorTeoriaPura >= stats.theta,
  },
];

/**
 * Calcula de forma determinística os Perfis de Estudante ativados para o estado atual.
 */
export function calcularPerfisEstudante(state = null) {
  const s = state || getEloState();
  const user = s.user || {};
  const hist = user.historico || [];
  const aspectos = s.aspectos || {};

  const total = user.total_respostas || 0;
  const acertos = user.total_acertos || 0;
  const theta = user.theta || THETA_0;
  const taxaAcerto = total > 0 ? acertos / total : 0;

  // Calculo de médias metacognitivas
  let sumBrier = 0;
  let sumIlusao = 0;
  let sumEntropia = 0;
  let sumCoerencia = 0;
  let sumElimination = 0;
  let countMeta = 0;

  let count5050 = 0;
  let maxStreak = 0;
  let currentStreak = 0;
  let erroAnterior = false;
  let acertosAposErro = 0;
  let totalErrosSeguidos = 0;

  const validHist = hist.filter((h) => typeof h.acertou === 'boolean');
  validHist.forEach((h) => {
    if (typeof h.sBrier === 'number') {
      sumBrier += h.sBrier;
      sumIlusao += h.iIlusao || 0;
      sumEntropia += h.hNorm || 0;
      sumCoerencia += h.bCoerencia || 0;
      sumElimination += h.eRate || 0;
      countMeta++;
    }

    if (h.acertou) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      if (erroAnterior) acertosAposErro++;
      erroAnterior = false;
    } else {
      currentStreak = 0;
      erroAnterior = true;
      totalErrosSeguidos++;
    }

    if (h.diagnosticoId === 3 || h.diagnosticoId === 8) {
      count5050++;
    }
  });

  const avgBrier = countMeta > 0 ? sumBrier / countMeta : 0.5;
  const avgIlusao = countMeta > 0 ? sumIlusao / countMeta : 0;
  const avgEntropia = countMeta > 0 ? sumEntropia / countMeta : 0.5;
  const avgCoerencia = countMeta > 0 ? sumCoerencia / countMeta : 0.5;
  const avgElimination = countMeta > 0 ? sumElimination / countMeta : 0;
  const frequencia5050 = countMeta > 0 ? count5050 / countMeta : 0;
  const recuperacaoPosErro = totalErrosSeguidos > 0 ? acertosAposErro / totalErrosSeguidos : 0;

  // Calculo de matérias e desvio padrão
  const materiasAspectos = Object.values(aspectos).filter((a) => a.categoria === 'disciplina');
  const numMaterias = materiasAspectos.length;
  let stdDevMaterias = 0;
  let topDisciplinaCategoria = 'geral';

  if (numMaterias > 1) {
    const avgMatTheta =
      materiasAspectos.reduce((acc, m) => acc + (m.theta || THETA_0), 0) / numMaterias;
    const variance =
      materiasAspectos.reduce(
        (acc, m) => acc + Math.pow((m.theta || THETA_0) - avgMatTheta, 2),
        0,
      ) / numMaterias;
    stdDevMaterias = Math.sqrt(variance);
  }

  if (numMaterias > 0) {
    const sortedMat = [...materiasAspectos].sort(
      (a, b) => (b.theta || THETA_0) - (a.theta || THETA_0),
    );
    const topMatName = (sortedMat[0].label || '').toLowerCase();
    if (
      topMatName.includes('português') ||
      topMatName.includes('direito') ||
      topMatName.includes('história') ||
      topMatName.includes('filosofia')
    ) {
      topDisciplinaCategoria = 'humanas_direito';
    } else if (
      topMatName.includes('matemática') ||
      topMatName.includes('física') ||
      topMatName.includes('química') ||
      topMatName.includes('lógica')
    ) {
      topDisciplinaCategoria = 'exatas_logica';
    } else if (
      topMatName.includes('biologia') ||
      topMatName.includes('saúde') ||
      topMatName.includes('ciências')
    ) {
      topDisciplinaCategoria = 'biologicas';
    }
  }

  // Fatores de estrutura
  const eloFatorTextoExtenso = aspectos['fator_texto_extenso']?.theta || THETA_0;
  const eloFatorVisual = aspectos['fator_interpretacao_visual']?.theta || THETA_0;
  const eloFatorNuance = aspectos['fator_analise_nuance_julgamento']?.theta || THETA_0;
  const eloFatorDireto = aspectos['fator_abstracao_teorica']?.theta || THETA_0;
  const eloFatorDistratores = aspectos['fator_distratores_semanticos']?.theta || THETA_0;
  const eloFatorTeoriaPura = aspectos['fator_abstracao_teorica']?.theta || THETA_0;

  const eloEstiloDenso = (eloFatorTextoExtenso + eloFatorNuance) / 2;
  const eloEstiloAssertivo = (eloFatorDistratores + eloFatorNuance) / 2;
  const eloEstiloConceitual = (eloFatorDireto + eloFatorTeoriaPura) / 2;
  const stdDevEstilos = Math.sqrt(
    (Math.pow(eloEstiloDenso - theta, 2) +
      Math.pow(eloEstiloAssertivo - theta, 2) +
      Math.pow(eloEstiloConceitual - theta, 2)) /
      3,
  );

  // Delta sum recente (últimas 10)
  const recent10 = hist.slice(0, 10);
  const recentDeltaSum = recent10.reduce((acc, h) => acc + (h.deltaTheta || 0), 0);

  const stats = {
    total,
    acertos,
    theta,
    taxaAcerto,
    avgBrier,
    avgIlusao,
    avgEntropia,
    avgCoerencia,
    avgElimination,
    frequencia5050,
    maxStreak,
    recuperacaoPosErro,
    numMaterias,
    stdDevMaterias,
    topDisciplinaCategoria,
    eloFatorTextoExtenso,
    eloFatorVisual,
    eloFatorNuance,
    eloFatorDireto,
    eloFatorDistratores,
    eloFatorTeoriaPura,
    eloEstiloDenso,
    eloEstiloAssertivo,
    eloEstiloConceitual,
    stdDevEstilos,
    recentDeltaSum,
    taxaAcertoFacil: 0.8,
    taxaAcertoDesafio: 0.3,
  };

  const perfisAtivos = [];
  CATALOGO_PERFIS_ESTUDANTE.forEach((p) => {
    try {
      if (p.avaliar(stats)) {
        perfisAtivos.push(p);
      }
    } catch (e) {
      console.error(`[EloService] Erro ao avaliar perfil ${p.id}:`, e);
    }
  });

  // Determinar arquétipo dominante (prioriza Metacognição > Maestria > Tática > Estilo)
  let dominante = perfisAtivos.find((p) => p.eixoId === 'metacognicao') ||
    perfisAtivos.find((p) => p.eixoId === 'maestria') ||
    perfisAtivos[0] || {
      id: 'E06',
      titulo: '🌱 Explorador em Início de Jornada',
      badge: '🌱 Iniciante',
      cor: '#94a3b8',
      descricao: 'Resolva questões no Banco de Questões para revelar seu arquétipo metacognitivo e estilo de prova!',
      recomendacao: 'Inicie resolvendo questões com sliders de certeza para desbloquear suas análises de precisão.',
    };

  return {
    dominante,
    perfisAtivos,
    catalogoCompleto: CATALOGO_PERFIS_ESTUDANTE,
    rankTier: getEloRankTier(theta),
    stats,
  };
}

export function simularRespostaElo({
  questaoId,
  opcaoSelecionada,
  gabaritoCorreto,
  certezas = {},
  complexidadeObj = null,
  fullData = null,
  tipoQuestao = 'objetiva',
  notaDissertativa = null,
  thetaSession = 1500,
}) {
  const questaoElo = getQuestionElo(questaoId, complexidadeObj);
  const bEfetivo = questaoElo.b_efetivo;
  const pEsperado = calcularProbabilidadeAcerto(thetaSession, bEfetivo);

  let meta;
  let sConhecimento;
  const isDissertativa = tipoQuestao === 'dissertativa' || notaDissertativa !== null;

  if (isDissertativa) {
    const rawNota = typeof notaDissertativa === 'number'
      ? Math.max(0, Math.min(1, notaDissertativa))
      : (String(opcaoSelecionada).trim().toLowerCase() === String(gabaritoCorreto).trim().toLowerCase() ? 1 : 0);
    const acertou = rawNota >= 0.7;
    sConhecimento = acertou ? 1.0 : 0.0;
    meta = { acertou, sBrier: rawNota, iIlusao: 0, hNorm: 0, bCoerencia: 1, eRate: 0, tipoQuestao: 'dissertativa' };
  } else {
    meta = calcularMetricasMetacognitivas(opcaoSelecionada, gabaritoCorreto, certezas);
    sConhecimento = meta.acertou ? 1.0 : 0.0;
    const certezaSel = certezas[String(opcaoSelecionada || '').toUpperCase()] ?? 50;
    if (meta.acertou && certezaSel <= 35) sConhecimento = 0.75;
  }

  const kUser = calcularKUserDinamico(thetaSession, 10, 0);
  const certezaSelObj = certezas[String(opcaoSelecionada || '').toUpperCase()] ?? 50;
  const conviccaoAlta = meta.acertou && (isDissertativa || certezaSelObj >= 80);
  const stoch = gerarJitterEstocastico(meta.acertou, meta.sBrier, pEsperado, conviccaoAlta);

  const deltaBase = kUser * (sConhecimento - pEsperado);
  const deltaComJitter = deltaBase * (1 + stoch.jitterFactor) + stoch.bonusAprendizado;
  const thetaNovo = Math.round(thetaSession + deltaComJitter);
  const deltaTheta = Math.round(deltaComJitter);

  return {
    questaoId,
    acertou: meta.acertou,
    opcaoSelecionada,
    gabaritoCorreto,
    certezas,
    thetaBefore: thetaSession,
    thetaAfter: thetaNovo,
    deltaTheta,
    pEsperado,
    fullData,
    complexidadeObj,
    tipoQuestao,
    notaDissertativa,
    timestamp: Date.now(),
  };
}

export function sincronizarSessaoEloAoPerfil(sessionHistory = []) {
  if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) return null;

  let lastResult = null;
  sessionHistory.forEach((item) => {
    lastResult = processarResposta({
      questaoId: item.questaoId,
      opcaoSelecionada: item.opcaoSelecionada,
      gabaritoCorreto: item.gabaritoCorreto,
      certezas: item.certezas || {},
      complexidadeObj: item.complexidadeObj || null,
      fullData: item.fullData || null,
      tipoQuestao: item.tipoQuestao || 'objetiva',
      notaDissertativa: item.notaDissertativa || null,
    });
  });

  return lastResult;
}

export const EloService = {
  getEloState,
  saveEloState,
  saveQuestionElo,
  isProductionEnvironment,
  initFirebaseEloSync,
  calcularEloPriorIA,
  extrairDificuldadePercentualIA,
  getQuestionElo,
  extrairAspectosDaQuestao,
  calcularProbabilidadeAcerto,
  calcularMetricasMetacognitivas,
  diagnosticarPerfilMetacognitivo,
  processarResposta,
  simularRespostaElo,
  sincronizarSessaoEloAoPerfil,
  getEloRankTier,
  calcularPerfisEstudante,
  calcularKUserDinamico,
  aplicarDecaimentoTemporal,
  gerarJitterEstocastico,
};

export default EloService;


