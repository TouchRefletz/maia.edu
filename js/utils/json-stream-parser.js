import { parse } from 'best-effort-json-parser';

/**
 * Tenta parsear um buffer partial de JSON e extrair a estrutura completa.
 * Usa best-effort-json-parser para lidar com JSON incompleto.
 *
 * @param {string} buffer - O texto JSON (possivelmente incompleto)
 * @returns {object|null} - O objeto parcial ou completo, ou null se nada util for extraido.
 */
export function parseStreamedJSON(buffer) {
  try {
    const data = parse(buffer);
    // Retorna o dado completo para que o pipeline processe 'layout' e 'conteudo'
    return data;
  } catch (error) {
    // Em caso de erro muito grave que o best-effort não pegue
    return null;
  }
}
