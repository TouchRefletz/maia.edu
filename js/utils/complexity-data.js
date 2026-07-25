export const CFG = {
  leitura: { label: 'Suporte e Leitura', color: 'var(--color-info)' },
  conhecimento: { label: 'Conhecimento Prévio', color: 'var(--color-primary)' },
  raciocinio: { label: 'Raciocínio', color: '#9333ea' },
  operacional: { label: 'Operacional', color: 'var(--color-warning)' },
};

export const FATORES_DEF = [
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
