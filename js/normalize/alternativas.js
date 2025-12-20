import { pick } from '../utils/pick.js';

/**
 * Função Principal: Normaliza Alternativas Analisadas
 * Atua apenas como um "porteiro" (Dispatcher), decidindo qual lógica usar.
 */
export const normalizeAlternativasAnalisadas = (v, respostaLetra) => {
  if (v == null) return [];

  // Caso 1: Array (seja de strings ou objetos)
  if (Array.isArray(v)) {
    return _normListaAlternativas(v);
  }

  // Caso 2: Objeto Mapa {A: "...", B: "..."}
  if (typeof v === 'object') {
    return _normMapaAlternativas(v, respostaLetra);
  }

  // Caso 3: Fallback (String/Número solto)
  return [
    {
      letra: '?',
      correta: false,
      motivo: String(v ?? ''),
    },
  ];
};

/**
 * Auxiliar: Processa quando vem como Objeto Mapa
 * Ex: { "A": "Porque sim", "B": "Porque não" }
 */
export const _normMapaAlternativas = (obj, respostaLetra) => {
  return Object.entries(obj).map(([letra, motivo]) => {
    const letraStr = String(letra);
    const isCorreta = respostaLetra
      ? letraStr.toUpperCase() === String(respostaLetra).toUpperCase()
      : false;

    return {
      letra: letraStr,
      correta: isCorreta,
      motivo: String(motivo ?? ''),
    };
  });
};

/**
 * Auxiliar: Processa quando vem como Array
 * Ex: [{letra: "A", motivo: "..."}, {...}] OU ["Motivo 1", "Motivo 2"]
 */
export const _normListaAlternativas = (arr) => {
  // Sub-caso: Array de Strings simples
  if (arr.length > 0 && typeof arr[0] === 'string') {
    return arr.map((motivo) => ({
      letra: '?',
      correta: false,
      motivo: String(motivo ?? ''),
    }));
  }

  // Sub-caso: Array de Objetos (formato padrão completo)
  return arr.map((a) => {
    // Usa o 'pick' global que definimos antes
    const letra = pick(a?.letra, a?.option, a?.alternativa, a?.key, '?');
    const correta = !!pick(a?.correta, a?.isCorrect, a?.certa, false);
    const motivo = pick(
      a?.motivo,
      a?.explain,
      a?.explicacao,
      a?.justificativa,
      a?.reason,
      ''
    );

    return {
      letra: String(letra ?? '?'),
      correta,
      motivo: String(motivo ?? ''),
    };
  });
};