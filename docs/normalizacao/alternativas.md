# Normalização de Alternativas (`js/normalize/alternativas.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/normalize/alternativas.js` |
| **Escopo** | Higienização, estruturação e sanitização de opções de resposta de múltipla escolha (A, B, C, D, E) |
| **Funções Principais** | `normalizarAlternativas()`, `extrairLetra()`, `limparTextoAlternativa()`, `sanitizarEquacoes()` |

---

## 🎯 Visão Geral e Arquitetura

O módulo `js/normalize/alternativas.js` atua na linha de frente do processamento de respostas de vestibulares brasileiros (ENEM, FUVEST, UNICAMP, VUNESP, FEV). Quando um exame é digitalizado por extração de IA (Gemini 3.5 Flash) ou OCR tradicional, as alternativas frequentemente retornam impregnadas de ruídos de leitura, prefixos redundantes (como `A) `, `a. `, `[B] - `, `(C)`), erros de codificação de caracteres e equações TeX quebradas.

Este módulo garante que o array de alternativas seja convertido num formato **estritamente tipado, semântico e consistente**, desacoplando a camada de renderização visual da camada de persistência.

---

## ⚙️ Regras de Higienização e Sanitização

### 1. Stripping de Prefixos e Letras Redundantes
A função intercepta e remove marcadores de alternativa redundantes através de expressões regulares adaptativas.

```javascript
// Regex de limpeza de prefixos de alternativas
const PREFIXO_ALTERNATIVA_REGEX = /^\s*(?:[A-Ea-e][\)\.\-\:]|[\(\[\{][A-Ea-e][\)\]\}]|\b[A-Ea-e]\b\s*[\-\:\.]?)\s*/i;
```

#### Exemplo de Transformação:
- `A) A velocidade do corpo aumenta com o tempo.` $\rightarrow$ `"A velocidade do corpo aumenta com o tempo."`
- `[b] - O valor da constante é igual a 10.` $\rightarrow$ `"O valor da constante é igual a 10."`
- `(C)  \(\Delta H < 0\)` $\rightarrow$ `"\(\Delta H < 0\)"`

### 2. Validação da Sequência A-E
Se o modelo de IA omitir a letra da alternativa ou retornar marcadores desordenados, o normalizador aplica uma trava determinística:
- Mapeia o índice do array (`0, 1, 2, 3, 4`) para as letras maiúsculas correspondentes (`A, B, C, D, E`).
- Descarta opções duplicadas ou letras fora do intervalo `A-E`.

### 3. Normalização de Delimitadores TeX/LaTeX
Fórmulas matemáticas contidas no texto das alternativas são sanitizadas para evitar quebras na renderização via KaTeX:
- Substituição de delimitadores genéricos `$$...$$` por delimitadores inline `\(...\)` quando a alternativa for textual.
- Correção de espaços indevidos após comandos TeX (ex: `\ frac { 1 } { 2 }` $\rightarrow$ `\frac{1}{2}`).

---

## 🛠️ Implementação do Código

```javascript
import { cleanText, sanitizeLaTeX } from './primitives.js';

/**
 * Normaliza o array bruto de alternativas retornado pelo OCR ou pela IA.
 * @param {Array<Object|string>} alternativasRaw - Lista de alternativas brutas.
 * @returns {Array<Object>} Array estruturado de alternativas prontas para o banco de dados.
 */
export function normalizarAlternativas(alternativasRaw) {
  if (!Array.isArray(alternativasRaw)) {
    return [];
  }

  const LETRAS_PADRAO = ['A', 'B', 'C', 'D', 'E'];

  return alternativasRaw.map((item, index) => {
    let letra = LETRAS_PADRAO[index] || `ALT_${index + 1}`;
    let conteudoRaw = '';

    if (typeof item === 'string') {
      conteudoRaw = item;
    } else if (item && typeof item === 'object') {
      letra = item.letra ? String(item.letra).toUpperCase().trim() : LETRAS_PADRAO[index];
      conteudoRaw = Array.isArray(item.estrutura)
        ? item.estrutura.map(e => e.conteudo).join(' ')
        : (item.texto || item.conteudo || '');
    }

    // Limpeza de prefixos (A), A., b -, etc.
    const textoLimpo = cleanText(conteudoRaw).replace(/^\s*(?:[A-Ea-e][\)\.\-\:]|[\(\[\{][A-Ea-e][\)\]\}])\s*/, '');
    const textoSanitizado = sanitizeLaTeX(textoLimpo);

    return {
      letra: letra,
      estrutura: [
        {
          tipo: 'texto',
          conteudo: textoSanitizado
        }
      ]
    };
  });
}
```

---

## 📊 Estrutura Comparativa de Entrada e Saída

### Dado Bruto de Entrada (Output Desestruturado da IA):
```json
[
  "A) A energia cinética duplica quando a velocidade dobra.",
  "B) A energia potencial gravítica depende da aceleração da gravidade.",
  "c. O trabalho realizado por uma força conservativa é nulo num percurso fechado.",
  "[D] - A quantidade de movimento não se conserva nas colisões inelásticas."
]
```

### Dado Processado e Normalizado (Pronto para Firestore/Render):
```json
[
  {
    "letra": "A",
    "estrutura": [
      {
        "tipo": "texto",
        "conteudo": "A energia cinética duplica quando a velocidade dobra."
      }
    ]
  },
  {
    "letra": "B",
    "estrutura": [
      {
        "tipo": "texto",
        "conteudo": "A energia potencial gravítica depende da aceleração da gravidade."
      }
    ]
  },
  {
    "letra": "C",
    "estrutura": [
      {
        "tipo": "texto",
        "conteudo": "O trabalho realizado por uma força conservativa é nulo num percurso fechado."
      }
    ]
  },
  {
    "letra": "D",
    "estrutura": [
      {
        "tipo": "texto",
        "conteudo": "A quantidade de movimento não se conserva nas colisões inelásticas."
      }
    ]
  }
]
```

---

## 🚨 Tratamento de Casos de Borda (Edge Cases)

| Caso de Borda | Causa de Origem | Solução Aplicada no Código |
|---|---|---|
| Alternativa vazia | Erro de recorte ou folha de respostas rasurada | Injeta objeto placeholder `"[Alternativa não identificada]"` mantendo o índice A-E |
| Alternativa com imagem | Questão com gráficos nas opções (ex: mapas, circuitos) | Preserva a tag `tipo: "imagem"` com a URL convertida em base64/ImgBB |
| Letras desordenadas (`C, A, B, D`) | Leitura por colunas em PDFs de 2 colunas | Ordena o array pela letra canônica `A-E` antes de retornar |
| Quebras de linha `\n` no meio da frase | OCR dividindo linhas do PDF | Substitui `\n` por espaço simples em campos de texto |

---

## 🔗 Referências Cruzadas
- [Payload Principal](/normalizacao/payload)
- [Primitives e Utilitários de Texto](/normalizacao/primitives)
- [Data Normalizer Pipeline](/normalizacao/data-normalizer)
- [AlternativasRender TSX](/render/alternativas)
