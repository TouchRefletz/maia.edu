import { _createStep } from '../editor/passos.js';

/**
 * 1. FUNÇÃO PRINCIPAL
 * Apenas direciona para a função correta baseada no tipo da entrada.
 */
export const normalizeExplicacao = (v) => {
  if (v == null) return [];

  if (typeof v === 'string') {
    return _normExplString(v);
  }

  if (Array.isArray(v)) {
    return _normExplArray(v);
  }

  return [];
};

/**
 * 3. HELPER: TRATAMENTO DE STRING
 * Caso v seja string, quebra em linhas.
 */
export const _normExplString = (v) => {
  const linhas = v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return linhas.map((linha) =>
    _createStep([{ tipo: 'texto', conteudo: linha }])
  );
};

/**
 * 4. HELPER: TRATAMENTO DE ARRAY
 * Mantém a lógica original de checar v[0] para decidir o fluxo.
 */
export const _normExplArray = (v) => {
  if (v.length === 0) return [];

  // LÓGICA ORIGINAL: Se o primeiro for string, trata TUDO como string
  if (typeof v[0] === 'string') {
    return v.map((s) =>
      _createStep([{ tipo: 'texto', conteudo: String(s).trim() }])
    );
  }

  // Caso contrário, trata como array de objetos
  return v
    .map((p) => {
      // SE JÁ TEM ESTRUTURA (Novo formato da IA)
      if (Array.isArray(p.estrutura)) {
        return _createStep(p.estrutura, p);
      }

      // SE TEM PASSO (Formato antigo ou misto)
      if (p.passo) {
        return _createStep([{ tipo: 'texto', conteudo: String(p.passo) }], p);
      }

      return null;
    })
    .filter(Boolean);
};