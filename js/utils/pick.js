// pick: pega o primeiro valor realmente "útil" (não undefined/null/"")
export const pick = (...values) => {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return undefined;
};
