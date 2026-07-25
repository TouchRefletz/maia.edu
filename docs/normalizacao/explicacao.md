# Normalização de Explicação e Passos (`js/normalize/explicacao.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/normalize/explicacao.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/normalize/explicacao.js) |
| **Escopo** | Estruturação e sanitização da resolução comentada e etapas pedagógicas |
| **Funções Principais** | `normalizarExplicacao()`, `normalizarAnaliseAlternativas()`, `validarCoerenciaGabarito()` |

---

## 🎯 Visão Geral e Arquitetura

O módulo `js/normalize/explicacao.js` converte justificativas pedagógicas brutas em sequências estruturadas de passos iterativos. O objetivo é permitir que o frontend exiba a resolução comentada de forma gradual (passo-a-passo), alimentando os componentes de renderização rica (como o `RenderComponents.tsx` e o `ScaffoldUI`).

---

## ⚙️ Estrutura de Passos Pedagógicos

Cada item da resolução é decomposto num objeto de passo que contém:
- **`estrutura`**: Array de blocos de conteúdo (`titulo`, `texto`, `equacao`, `dica`).
- **`evidencia`**: Trecho do enunciado ou do texto-base que fundamenta o passo.
- **`origem`**: Fonte da resolução (`"extraido_do_material"` ou `"gerado_pela_ia"`).

---

## 🛠️ Implementação do Código

```javascript
import { cleanText, sanitizeLaTeX } from './primitives.js';

/**
 * Normaliza a explicação e passos de resolução do gabarito.
 * @param {Array<Object>|string} explicacaoRaw - Dados brutos da explicação.
 * @returns {Array<Object>} Lista de passos normalizados.
 */
export function normalizarExplicacao(explicacaoRaw) {
  if (typeof explicacaoRaw === 'string') {
    return [
      {
        estrutura: [
          { tipo: 'titulo', conteudo: 'Resolução Comentada' },
          { tipo: 'texto', conteudo: sanitizeLaTeX(cleanText(explicacaoRaw)) }
        ],
        evidencia: '',
        origem: 'gerado_pela_ia'
      }
    ];
  }

  if (!Array.isArray(explicacaoRaw)) {
    return [];
  }

  return explicacaoRaw.map((passo, idx) => {
    const estrutura = Array.isArray(passo.estrutura)
      ? passo.estrutura.map(bloco => ({
          tipo: ['titulo', 'texto', 'equacao', 'dica'].includes(bloco.tipo) ? bloco.tipo : 'texto',
          conteudo: sanitizeLaTeX(cleanText(bloco.conteudo || ''))
        }))
      : [
          { tipo: 'titulo', conteudo: `Passo ${idx + 1}` },
          { tipo: 'texto', conteudo: sanitizeLaTeX(cleanText(passo.texto || passo.conteudo || '')) }
        ];

    return {
      estrutura: estrutura,
      evidencia: cleanText(passo.evidencia || ''),
      fontematerial: cleanText(passo.fontematerial || ''),
      origem: passo.origem === 'extraido_do_material' ? 'extraido_do_material' : 'gerado_pela_ia'
    };
  });
}

/**
 * Normaliza a análise individual de cada alternativa (distratores).
 * @param {Array<Object>} analiseRaw - Lista bruta de análises das alternativas.
 * @returns {Array<Object>} Lista normalizada de distratores.
 */
export function normalizarAnaliseAlternativas(analiseRaw) {
  if (!Array.isArray(analiseRaw)) return [];

  return analiseRaw.map(item => ({
    letra: String(item.letra || '').toUpperCase().trim(),
    correta: Boolean(item.correta),
    motivo: sanitizeLaTeX(cleanText(item.motivo || item.explicacao || ''))
  }));
}
```

---

## 📊 Estrutura do Gabarito Normalizado (JSON Output)

```json
{
  "dados_gabarito": {
    "alternativa_correta": "B",
    "alternativas_analisadas": [
      {
        "letra": "A",
        "correta": false,
        "motivo": "Incorreta. A velocidade angular varia durante o movimento acelerado."
      },
      {
        "letra": "B",
        "correta": true,
        "motivo": "Correta. Aplicando o teorema da energia cinética: \\(W = \\Delta K\\)."
      }
    ],
    "explicacao": [
      {
        "estrutura": [
          { "tipo": "titulo", "conteudo": "1. Identificação dos Dados" },
          { "tipo": "texto", "conteudo": "Massa \\(m = 2\\text{ kg}\\) e aceleração \\(a = 3\\text{ m/s}^2\\)." }
        ],
        "evidencia": "Considere o bloco partindo do repouso.",
        "origem": "gerado_pela_ia"
      }
    ]
  }
}
```

---

## 🔗 Referências Cruzadas
- [Data Normalizer Pipeline](/normalizacao/data-normalizer)
- [Payload Principal](/normalizacao/payload)
- [Controller de Renderização de Gabarito](/render/gabarito)
