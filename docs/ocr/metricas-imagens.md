# Métricas de Qualidade Visual de Imagens (`js/services/metricas-imagens.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/services/metricas-imagens.js` |
| **Escopo** | Análise estática de imagens de exames, cálculo de desvio de contraste, nitidez (Laplaciano) e DPI |
| **Exports** | `avaliarQualidadeImagem()`, `calcularVarianciaLaplaciana()`, `estimarDPI()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/services/metricas-imagens.js` fornece um conjunto de algoritmos de inspeção de imagem que rolam diretamente no browser via Canvas2D Context.

Antes de enviar uma fotografia ou recorte para a extração do Gemini 3.5 Flash ou Tesseract, o sistema calcula métricas de **nitidez** (detecção de desfoque/blur) e **contraste** (detecção de iluminação deficiente). Se a imagem for considerada ilegível, o sistema alerta o usuário na UI para tirar uma foto melhor antes de gastar cotas da API.

---

## ⚙️ Métricas Calculadas

### 1. Variância do Laplaciano (Detecção de Desfoque / Blur)
Aplica um operador de convolução Laplaciano $3 \times 3$ sobre os pixels da imagem em escala de cinza. Imagens bem focadas possuem alta variância nas bordas, enquanto imagens desfocadas possuem variância próxima de zero.

$$L = \begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$

- **Score > 100**: Imagem com nitidez excelente.
- **50 < Score <= 100**: Nitidez aceitável.
- **Score < 50**: Imagem desfocada (alerta acionado).

### 2. Histograma de Luminância e Contraste
Calcula a média e o desvio padrão dos valores de brilho $[0 - 255]$:
- Se a média for $< 40$, a imagem está muito escura.
- Se o desvio padrão for $< 20$, a imagem possui baixo contraste (difícil de ler).

---

## 🛠️ Implementação do Código

```javascript
/**
 * Calcula a variância do operador Laplaciano para determinar a nitidez do Canvas.
 * @param {ImageData} imageData - Dados de pixels do canvas.
 * @returns {number} Score de variância (quanto maior, mais nítido).
 */
export function calcularVarianciaLaplaciana(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // 1. Converter para escala de cinza
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. Convolução Laplaciana 3x3
  const lap = new Float32Array(width * height);
  let sum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val =
        gray[idx - width] +
        gray[idx - 1] +
        -4 * gray[idx] +
        gray[idx + 1] +
        gray[idx + width];
      lap[idx] = val;
      sum += val;
      count++;
    }
  }

  const mean = sum / count;
  let variance = 0;
  for (let i = 0; i < lap.length; i++) {
    variance += (lap[i] - mean) ** 2;
  }

  return variance / count;
}

/**
 * Executa a avaliação completa da imagem no Canvas.
 * @param {HTMLCanvasElement} canvas - Elemento de canvas a ser analisado.
 * @returns {Object} Relatório detalhado de qualidade.
 */
export function avaliarQualidadeImagem(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const scoreNitidez = calcularVarianciaLaplaciana(imageData);

  return {
    nitidezScore: Math.round(scoreNitidez),
    aprovada: scoreNitidez >= 50,
    recomendacao: scoreNitidez < 50 ? 'A imagem parece desfocada. Tente aproximar a câmera ou aumentar a iluminação.' : 'Qualidade adequada para leitura por IA.'
  };
}
```

---

## 🔗 Referências Cruzadas
- [Extrator de Imagens](/ocr/image-extractor)
- [Scanner Pipeline](/ocr/scanner-pipeline)
