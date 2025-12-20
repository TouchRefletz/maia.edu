import { pick } from '../utils/pick.js';

/**
 * 1. FUNÇÃO PRINCIPAL
 * Compõe o objeto final unindo as partes normalizadas.
 */
export const normCreditos = (c) => {
  if (!c) return null;

  return {
    ..._normCreditosMeta(c),
    ..._normCreditosBibliografia(c),
    ..._normCreditosControle(c),
  };
};

/**
 * 2. HELPER: Metadados da Resolução
 * Trata origem, confiança e como foi identificado.
 */
export const _normCreditosMeta = (c) => {
  const origem = pick(
    c.origemresolucao,
    c.origem_resolucao,
    c.origemResolucao,
    ''
  );

  const confianca = pick(
    c.confiancaidentificacao,
    c.confianca_identificacao,
    c.confiancaIdentificacao,
    null
  );

  const como = pick(
    c.comoidentificou,
    c.como_identificou,
    c.comoIdentificou,
    ''
  );

  return {
    origemresolucao: String(origem ?? ''),
    confiancaidentificacao: confianca,
    comoidentificou: String(como ?? ''),
  };
};

/**
 * 3. HELPER: Dados Bibliográficos
 * Trata nome do material, autor e ano.
 */
export const _normCreditosBibliografia = (c) => {
  const material = pick(c.material, c.nomeMaterial, c.nome_material, '');

  const autor = pick(
    c.autorouinstituicao,
    c.autor_ou_instituicao,
    c.autorOuInstituicao,
    ''
  );

  const ano = pick(c.ano, c.year, '');

  return {
    material: String(material ?? ''),
    autorouinstituicao: String(autor ?? ''),
    ano: String(ano ?? ''),
  };
};

/**
 * 4. HELPER: Controle e Exibição
 * Trata as flags booleanas e textos de sugestão.
 */
export const _normCreditosControle = (c) => {
  const identificado = !!pick(
    c.materialidentificado,
    c.material_identificado,
    c.materialIdentificado,
    false
  );

  const precisaGenerico = !!pick(
    c.precisacreditogenerico,
    c.precisa_credito_generico,
    c.precisaCreditoGenerico,
    false
  );

  const textoSugerido = pick(
    c.textocreditosugerido,
    c.texto_credito_sugerido,
    c.textoCreditoSugerido,
    ''
  );

  return {
    materialidentificado: identificado,
    precisacreditogenerico: precisaGenerico,
    textocreditosugerido: String(textoSugerido ?? ''),
  };
};