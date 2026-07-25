// --- START OF FILE pick.tsx ---

/**
 * pick: pega o primeiro valor realmente "útil" (não undefined/null/"")
 *
 * Utiliza Generics <T> para manter a tipagem do valor retornado.
 */
export const pick = <T,>(...values: (T | undefined | null)[]): T | undefined => {
  for (const v of values) {
    // Pula se for nulo ou undefined
    if (v === undefined || v === null) continue;

    // Pula se for string vazia (checa o tipo antes de usar .trim())
    if (typeof v === 'string' && v.trim() === '') continue;

    // Retorna o primeiro valor válido encontrado
    return v as T;
  }

  return undefined;
};
