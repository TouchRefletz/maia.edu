import { escapeHTML } from '../normalize/primitives.js';
import { pick } from '../utils/pick.js';

/**
 * 1. CONFIGURAÇÕES E CONSTANTES
 * Centraliza as definições de categorias e fatores.
 */
export const _getComplexidadeConfig = () => {
  const CFG = {
    leitura: { label: 'Suporte e Leitura', color: 'var(--color-info)' },
    conhecimento: {
      label: 'Conhecimento Prévio',
      color: 'var(--color-primary)',
    },
    raciocinio: { label: 'Raciocínio', color: '#9333ea' },
    operacional: { label: 'Operacional', color: 'var(--color-warning)' },
  };

  const FATORES_DEF = [
    { key: 'texto_extenso', label: 'Texto Extenso', cat: 'leitura', peso: 1 },
    {
      key: 'vocabulario_complexo',
      label: 'Vocabulário Denso',
      cat: 'leitura',
      peso: 2,
    },
    {
      key: 'multiplas_fontes_leitura',
      label: 'Múltiplas Fontes',
      cat: 'leitura',
      peso: 2,
    },
    {
      key: 'interpretacao_visual',
      label: 'Visual Crítico',
      cat: 'leitura',
      peso: 2,
    },
    {
      key: 'dependencia_conteudo_externo',
      label: 'Conteúdo Prévio',
      cat: 'conhecimento',
      peso: 3,
    },
    {
      key: 'interdisciplinaridade',
      label: 'Interdisciplinar',
      cat: 'conhecimento',
      peso: 4,
    },
    {
      key: 'contexto_abstrato',
      label: 'Abstração Contextual',
      cat: 'conhecimento',
      peso: 3,
    },
    {
      key: 'raciocinio_contra_intuitivo',
      label: 'Contra-Intuitivo',
      cat: 'raciocinio',
      peso: 5,
    },
    {
      key: 'abstracao_teorica',
      label: 'Teoria Pura',
      cat: 'raciocinio',
      peso: 3,
    },
    {
      key: 'deducao_logica',
      label: 'Dedução Lógica',
      cat: 'raciocinio',
      peso: 3,
    },
    {
      key: 'resolucao_multiplas_etapas',
      label: 'Multi-etapas',
      cat: 'operacional',
      peso: 4,
    },
    {
      key: 'transformacao_informacao',
      label: 'Transformação Info',
      cat: 'operacional',
      peso: 3,
    },
    {
      key: 'distratores_semanticos',
      label: 'Distratores Fortes',
      cat: 'operacional',
      peso: 3,
    },
    {
      key: 'analise_nuance_julgamento',
      label: 'Julgamento/Nuance',
      cat: 'operacional',
      peso: 3,
    },
  ];

  return { CFG, FATORES_DEF };
};

/**
 * 2. PROCESSAMENTO DE DADOS
 * Calcula score, nível e agrupa itens ativos/inativos.
 */
export const _calcularComplexidade = (complexidadeObj) => {
  if (!complexidadeObj || !complexidadeObj.fatores) return null;

  const { CFG, FATORES_DEF } = _getComplexidadeConfig();
  const f = complexidadeObj.fatores;

  let somaPesos = 0;
  let itensAtivos = [];

  // Inicializa grupos
  const grupos = {
    leitura: [],
    conhecimento: [],
    raciocinio: [],
    operacional: [],
  };

  FATORES_DEF.forEach((item) => {
    // Tenta pegar o valor (suporta snake_case e camelCase)
    const val = !!pick(
      f[item.key],
      f[item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())],
      false
    );

    if (val) {
      somaPesos += item.peso;
      itensAtivos.push(item);
    }

    // Adiciona ao grupo para o detalhamento
    grupos[item.cat].push({ ...item, ativo: val });
  });

  // Normalização (Base 30 pontos)
  const DENOMINADOR = 30;
  const score = Math.min(1, somaPesos / DENOMINADOR);
  const pct = Math.round(score * 100);

  // Definição do Nível
  let nivel = { texto: 'FÁCIL', cor: 'var(--color-success)' };
  if (score > 0.3) nivel = { texto: 'MÉDIA', cor: 'var(--color-warning)' };
  if (score > 0.6) nivel = { texto: 'DIFÍCIL', cor: 'var(--color-orange-500)' };
  if (score > 0.8) nivel = { texto: 'DESAFIO', cor: 'var(--color-error)' };

  return { score, pct, nivel, itensAtivos, grupos, CFG };
};

/**
 * 3. HELPER DE RENDERIZAÇÃO (GRUPO)
 * Gera o HTML de um grupo específico (leitura, conhecimento, etc.)
 */
export const _renderGrupoComplexidade = (catKey, grupos, CFG) => {
  const itens = grupos[catKey];
  const cfg = CFG[catKey];

  return `
        <div style="margin-bottom:8px;">
            <div style="font-size:10px; font-weight:bold; color:${cfg.color}; text-transform:uppercase; margin-bottom:4px;">${cfg.label}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                ${itens
                  .map(
                    (i) => `
                    <div style="font-size:11px; color: ${i.ativo ? 'var(--color-text)' : 'var(--color-text-secondary)'}; opacity:${i.ativo ? 1 : 0.6}; display:flex; align-items:center; gap:5px;">
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${i.ativo ? cfg.color : '#ddd'};"></span>
                        ${i.label}
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>
    `;
};

/**
 * 4. FUNÇÃO PRINCIPAL (ORQUESTRADORA)
 * Gera o HTML final do card de complexidade.
 */
export const renderComplexidade = (complexidadeObj) => {
  const dados = _calcularComplexidade(complexidadeObj);
  if (!dados) return '';

  const { pct, nivel, itensAtivos, grupos, CFG } = dados;

  return `
    <div class="complexity-card" style="margin-top:15px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:15px; box-shadow:var(--shadow-sm);">
        
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
            <span class="field-label" style="font-size:11px; opacity:0.8;">NÍVEL DE DIFICULDADE</span>
            <span style="font-weight:900; font-size:14px; color:${nivel.cor};">${nivel.texto} (${pct}%)</span>
        </div>

        <div style="height:8px; width:100%; background:var(--color-background-progress-bar); border-radius:99px; overflow:hidden; margin-bottom:15px;">
            <div style="height:100%; width:${pct}%; background:${nivel.cor}; border-radius:99px; transition:width 1s ease;"></div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
            ${
              itensAtivos.length === 0
                ? '<span style="font-size:11px; color:gray;">—</span>'
                : itensAtivos
                    .map((item) => {
                      const c = CFG[item.cat].color;
                      return `<span style="font-size:10px; padding:3px 8px; border-radius:4px; font-weight:700; border:1px solid ${c}; color:${c}; background:var(--color-surface);">${item.label}</span>`;
                    })
                    .join('')
            }
        </div>

        ${
          complexidadeObj.justificativa_dificuldade
            ? `
            <div class="markdown-content" data-raw="${escapeHTML(complexidadeObj.justificativa_dificuldade)}" style="font-size:12px; color:var(--color-text-secondary); background:var(--color-bg-1); padding:10px; border-radius:var(--radius-base); font-style:italic; line-height:1.4; margin-bottom:10px;">
                ${escapeHTML(complexidadeObj.justificativa_dificuldade)}
            </div>
        `
            : ''
        }

        <details style="font-size:12px; border-top:1px solid var(--color-border); padding-top:8px;">
            <summary style="cursor:pointer; color:var(--color-primary); font-weight:600; font-size:11px; outline:none;">VER ANÁLISE DETALHADA</summary>
            <div style="margin-top:10px; padding-left:4px;">
                ${_renderGrupoComplexidade('leitura', grupos, CFG)}
                ${_renderGrupoComplexidade('conhecimento', grupos, CFG)}
                ${_renderGrupoComplexidade('raciocinio', grupos, CFG)}
                ${_renderGrupoComplexidade('operacional', grupos, CFG)}
            </div>
        </details>
    </div>
    `;
};