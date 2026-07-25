import {
  increment,
  ref,
  serverTimestamp,
  update,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { db } from '../main.js';

/**
 * Incrementa o contador de aprovação ou rejeição para um campo
 * @param {string} questaoPath - Caminho da questão (ex: "PROVA_xyz/QUESTAO_123")
 * @param {string} fieldId - ID do campo sendo revisado
 * @param {'aprovar' | 'rejeitar'} tipo - Tipo de revisão
 */
export async function incrementarRevisao(questaoPath, fieldId, tipo) {
  // Normaliza o caminho base
  const baseRef = ref(db, `revisoes/${questaoPath}/${fieldId}`);
  const updates = {};

  if (tipo === 'aprovar') {
    updates[`aprovados`] = increment(1);
  } else {
    updates[`rejeitados`] = increment(1);
  }

  try {
    await update(baseRef, updates);

    // Atualiza timestamp global da questão "fire and forget"
    const questaoRef = ref(db, `revisoes/${questaoPath}`);
    update(questaoRef, { _ultima_revisao: serverTimestamp() }).catch(() => {});

    console.log(`[Revisão] ${tipo} em ${fieldId} salvo com sucesso.`);
    return true;
  } catch (error) {
    console.error(`[Revisão] Erro ao salvar ${tipo} em ${fieldId}:`, error);
    return false;
  }
}

/**
 * Envia todas as revisões de uma sessão de uma vez
 * @param {string} questaoPath - Caminho da questão
 * @param {Record<string, 'approved' | 'rejected'>} reviewState - Estado local das revisões
 */
/**
 * Envia todas as revisões de uma sessão de uma vez
 * @param {string} questaoPath - Caminho da questão
 * @param {Record<string, 'approved' | 'rejected'>} reviewState - Estado local das revisões
 */
export async function enviarTodasRevisoes(questaoPath, reviewState) {
  const { get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');

  const updates = {};
  const baseRef = ref(db, `revisoes/${questaoPath}`);

  // Monta objecto de updates para os campos individuais
  Object.entries(reviewState).forEach(([fieldId, state]) => {
    if (state === 'approved') {
      updates[`${fieldId}/aprovados`] = increment(1);
    } else if (state === 'rejected') {
      updates[`${fieldId}/rejeitados`] = increment(1);
    }
  });

  // Atualiza timestamp e contador de sessões
  updates[`_ultima_revisao`] = serverTimestamp();
  updates[`_total_sessoes`] = increment(1);

  // --- Contagem da SESSÃO ATUAL ---
  let sessionApproved = 0;
  let sessionRejected = 0;

  Object.values(reviewState).forEach((state) => {
    if (state === 'approved') sessionApproved++;
    if (state === 'rejected') sessionRejected++;
  });

  if (sessionApproved > 0) updates[`_stats_aprovados`] = increment(sessionApproved);
  if (sessionRejected > 0) updates[`_stats_rejeitados`] = increment(sessionRejected);

  // --- CÁLCULO DO STATUS (Lógica: read-modify-write para o status) ---
  try {
    // 1. Busca estatísticas atuais do banco para somar com a sessão
    // Nota: Em alta concorrência, stats podem variar, mas para status aproximado isso serve.
    // Idealmente seria uma Cloud Function, mas faremos client-side conforme arquitetura.
    const snapshot = await get(baseRef);
    const existingData = snapshot.val() || {};

    const currentApproved = (existingData._stats_aprovados || 0) + sessionApproved;
    const currentRejected = (existingData._stats_rejeitados || 0) + sessionRejected;
    const totalReviews = currentApproved + currentRejected;

    let newStatus = 'não revisada';

    if (totalReviews > 0) {
      const approvalRate = currentApproved / totalReviews;
      const isPositive = approvalRate >= 0.6;
      const isHighVolume = totalReviews >= 1000;

      if (isHighVolume) {
        newStatus = isPositive ? 'verificada' : 'invalidada';
      } else {
        newStatus = isPositive ? 'revisada' : 'sinalizada';
      }
    }

    // 2. Adiciona update e Stats apenas na tabela de REVISÕES
    // O usuário proibiu escrita em 'questoes/'

    updates[`status`] = newStatus;
    // Opcional: salvar stats para facilitar debug
    updates[`_stats_calc`] = {
      total: totalReviews,
      rate: currentApproved / (totalReviews || 1),
      status: newStatus,
    };

    console.log(`[Revisão] Payload com Status (${newStatus}):`, updates);

    // Atualiza RELATIVO ao caminho da questão na tabela revisões
    await update(baseRef, updates);
    console.log('[Revisão] Todas as revisões e status enviados com sucesso!');
    return true;
  } catch (error) {
    console.error('[Revisão] Erro ao enviar revisões:', error);
    if (error.code === 'PERMISSION_DENIED') {
      console.error('⛔ PERMISSÃO NEGADA PARA ESCREVA EM:', `revisoes/${questaoPath}`);
    }
    throw error;
  }
}

/**
 * Busca revisões existentes para uma questão
 * @param {string} questaoPath - Caminho da questão
 */
export async function buscarRevisoes(questaoPath) {
  const { get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');

  try {
    const snapshot = await get(ref(db, `revisoes/${questaoPath}`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error('[Revisão] Erro ao buscar:', error);
    return null;
  }
}

/**
 * Verifica se o usuário atual já revisou esta questão
 * @param {string} questaoPath - Caminho da questão
 * @returns {Promise<boolean>}
 */
export async function verificarJaRevisou(questaoPath) {
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
  const { get, ref } = await import(
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
  );
  const { app, db } = await import('../main.js');

  const auth = getAuth(app);
  const user = auth.currentUser;

  if (!user) {
    console.warn(
      '[Revisão] Usuário não autenticado. Assumindo que não revisou (ou bloqueando fluxo na UI).',
    );
    return false; // Ou true se quiser bloquear por segurança, mas UI deve tratar
  }

  const userRef = ref(db, `revisoes/${questaoPath}/_revisores/${user.uid}`);
  try {
    const snapshot = await get(userRef);
    return snapshot.exists();
  } catch (e) {
    console.error('[Revisão] Erro ao verificar histórico do usuário:', e);
    // Em caso de erro (ex: permission denied), retorna false pra não travar tudo,
    // ou true se formos super restritivos. Vamos retornar false e deixar enviar.
    return false;
  }
}

/**
 * Registra que o usuário revisou esta questão
 * @param {string} questaoPath
 */
export async function registrarRevisaoUsuario(questaoPath) {
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
  const { ref, set, serverTimestamp } = await import(
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'
  );
  const { app, db } = await import('../main.js');

  const auth = getAuth(app);
  const user = auth.currentUser;

  if (!user) return; // Não tem como salvar

  const userRef = ref(db, `revisoes/${questaoPath}/_revisores/${user.uid}`);
  try {
    await set(userRef, {
      timestamp: serverTimestamp(),
      uid: user.uid,
    });
    console.log('[Revisão] Usuário registrado com sucesso.');
  } catch (e) {
    console.error('[Revisão] Erro ao registrar usuário:', e);
  }
}
