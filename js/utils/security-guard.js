/**
 * security-guard.js — Proteção Ativa do Frontend (Maia.edu)
 * 
 * Funcionalidades:
 * 1. Handshake de Sessão Dinâmico com Cloudflare Worker (Web Crypto API)
 * 2. Gerador de Assinaturas HMAC Rotativas com Nonce e Timestamp (janela de 5s)
 * 3. Rate Limiter de Clipboard (permite cópia pontual para Google, bloqueia lote)
 * 4. MutationObserver de Integridade do DOM (detecta manipulação de cards)
 * 5. Armadilha Anti-Debugger ativada exclusivamente para não-administradores
 */

// ─── Estado Privado em Closure (Inacessível via Window) ────────────
let sessionSalt = null;
let sessionToken = null;
let sessionExpiresAt = 0;
let isAdminUser = false;

// Configuração do Worker
const WORKER_BASE_URL =
  import.meta.env.VITE_WORKER_URL ||
  'https://maia-api-worker.willian-campos-ismart.workers.dev';

// ─── 1. Handshake de Sessão Criptográfico ──────────────────────────
export async function ensureSessionHandshake() {
  const now = Date.now();
  if (sessionSalt && sessionToken && now < sessionExpiresAt - 60000) {
    return { sessionSalt, sessionToken };
  }

  try {
    const res = await fetch(`${WORKER_BASE_URL}/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientTimestamp: now }),
    });

    if (res.ok) {
      const data = await res.json();
      sessionSalt = data.salt;
      sessionToken = data.sessionToken;
      sessionExpiresAt = data.expiresAt || now + 3600000;
      return { sessionSalt, sessionToken };
    }
  } catch (err) {
    console.warn('[SecurityGuard] Handshake fallback ativo');
  }

  // Fallback efêmero local caso o worker esteja iniciando
  if (!sessionSalt) {
    sessionSalt = 'maia_seed_' + Math.random().toString(36).substring(2);
    sessionToken = 'fallback_' + now;
    sessionExpiresAt = now + 1800000;
  }
  return { sessionSalt, sessionToken };
}

// ─── 2. Gerador de Assinatura HMAC Rotativa (Web Crypto) ───────────
export async function generateSignedHeaders(pathname = '/questoes-paginadas') {
  await ensureSessionHandshake();

  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 10);
  const timeWindow = Math.floor(timestamp / 5000); // Muda a cada 5 segundos

  const message = `${pathname}|${timeWindow}|${nonce}|${sessionToken || ''}`;

  let signatureHex = '';
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(sessionSalt || 'maia_default_salt');
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    signatureHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback simples caso Web Crypto Subtle não esteja disponível
    signatureHex = btoa(message).substring(0, 32);
  }

  return {
    'X-Maia-Signature': signatureHex,
    'X-Maia-Timestamp': String(timestamp),
    'X-Maia-Nonce': nonce,
    'X-Maia-Session': sessionToken || '',
  };
}

// ─── 3. Rate Limiter de Clipboard (Tolerância Inteligente) ──────────
const copyHistory = [];
const MAX_COPIES_PER_WINDOW = 3; // Permite até 3 cópias por minuto
const WINDOW_DURATION_MS = 60000; // 1 minuto

export function initClipboardProtection() {
  document.addEventListener('copy', (e) => {
    const now = Date.now();
    // Limpar timestamps antigos
    while (copyHistory.length > 0 && now - copyHistory[0] > WINDOW_DURATION_MS) {
      copyHistory.shift();
    }

    copyHistory.push(now);

    if (copyHistory.length > MAX_COPIES_PER_WINDOW) {
      // Bloqueia cópia excessiva em lote
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
      }

      // Exibe alerta amigável
      import('../ui/GlobalAlertsLogic.tsx').then(({ customAlert }) => {
        customAlert(
          '⚠️ Cópia em lote detectada. Prossiga com seus estudos normalmente.',
          3000,
        );
      }).catch(() => {});
    }
  });
}

// ─── 4. MutationObserver de Integridade do DOM (Mutators) ──────────
const monitoredContainers = new WeakSet();

export function attachDOMIntegrityObserver(containerElement, onTamperCallback) {
  if (!containerElement || monitoredContainers.has(containerElement)) return;
  monitoredContainers.add(containerElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Detecta injeção de scripts não autorizados ou remoção forçada de atributos
      if (mutation.type === 'childList') {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.tagName === 'SCRIPT' || addedNode.tagName === 'IFRAME') {
            addedNode.remove();
            if (onTamperCallback) onTamperCallback('unauthorized_element_injection');
          }
        }
      }
    }
  });

  observer.observe(containerElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-id'],
  });

  return observer;
}

// ─── 5. Anti-Debugger Condicional (Ativo para Visitantes, Desativado para Admins) ───
let antiDebuggerInterval = null;

export function setAdminStatus(adminState) {
  isAdminUser = Boolean(adminState);
  if (typeof window !== 'undefined') {
    window.__MAIA_ADMIN__ = isAdminUser;
  }
  if (isAdminUser && antiDebuggerInterval) {
    clearInterval(antiDebuggerInterval);
    antiDebuggerInterval = null;
  }
}

export function initAntiDebugger() {
  // Se já foi identificado como admin, não ativa o debugger
  if (isAdminUser || (typeof window !== 'undefined' && window.isAdmin)) {
    return;
  }

  // Desativa métodos do console para evitar extração de dados
  const noop = () => {};
  ['table', 'dir'].forEach((m) => {
    try {
      if (window.console && window.console[m]) {
        window.console[m] = noop;
      }
    } catch (_) {}
  });

  // Armadilha de debugger com verificação contínua de status admin
  if (!antiDebuggerInterval) {
    antiDebuggerInterval = setInterval(() => {
      const isNowAdmin =
        isAdminUser ||
        (typeof window !== 'undefined' && (window.isAdmin || window.__MAIA_ADMIN__));
      if (!isNowAdmin) {
        (function () {
          return false;
        })['constructor']('debugger')();
      }
    }, 500);
  }
}
