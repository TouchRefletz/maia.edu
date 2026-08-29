# Extrator e Hospedador de Imagens AI (`js/services/ai-image-extractor.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/services/ai-image-extractor.js` |
| **Escopo** | Processamento visual client-side, recorte em Canvas HTML5, compressão e upload para ImgBB via Worker |
| **Exports** | `extractAndUploadCrop()`, `cropCanvasBoundingBox()`, `canvasToBase64()` |

---

## 🎯 Visão Geral e Arquitetura

O `ai-image-extractor.js` é o serviço responsável por capturar fragmentos de imagens (como figuras de apoio, gráficos, tabelas e esquemas) direto da página de um documento PDF ou fotografia tirada pelo estudante.

Quando a inteligência artificial (Gemini 3.5 Flash) identifica uma caixa delimitadora (*bounding box* `[ymin, xmin, ymax, xmax]`), este serviço realiza a extração do recorte no Canvas HTML5, redimensiona o buffer mantendo a qualidade de leitura, converte o resultado em Base64 e despacha o upload seguro para o serviço ImgBB por meio do endpoint `/upload-image` da Cloudflare Worker.

---

## 🔄 Fluxo de Processamento da Imagem

```mermaid
graph TD
    BBox[Bounding Box [ymin, xmin, ymax, xmax]] --> CanvasCrop[Recorte em Canvas HTML5]
    CanvasCrop --> Resizer[Resizing Proporcional Max 1200px]
    Resizer --> Base64Conv[Conversão em Base64 JPEG/PNG]
    Base64Conv --> WorkerUpload[POST /upload-image na Cloudflare Worker]
    WorkerUpload --> ImgBB[API Externa ImgBB]
    ImgBB -- "Retorna URL Permanente" --> PublicURL[https://i.ibb.co/...]
    PublicURL --> AttachPayload[Vínculo no JSON da Questão]
```

---

## 🛠️ Implementação do Código

```javascript
/**
 * Realiza o corte de uma região do canvas e faz o upload da imagem extraída.
 * @param {Object} params - Objeto de parâmetros.
 * @param {HTMLCanvasElement} params.canvas - Canvas contendo a página renderizada.
 * @param {Array<number>} params.boundingBox - Coordenadas [ymin, xmin, ymax, xmax] em escala 0-1000.
 * @param {string} params.imageName - Nome descritivo da imagem.
 * @param {string} params.workerUrl - URL base do Cloudflare Worker.
 * @returns {Promise<string>} URL pública permanente da imagem hospedada.
 */
export async function extractAndUploadCrop({ canvas, boundingBox, imageName, workerUrl }) {
  if (!canvas || !Array.isArray(boundingBox) || boundingBox.length !== 4) {
    throw new Error('extractAndUploadCrop: Parâmetros de canvas ou bounding box inválidos.');
  }

  // 1. Converter coordenadas normalizadas (0-1000) para pixels do canvas real
  const [ymin, xmin, ymax, xmax] = boundingBox;
  const width = canvas.width;
  const height = canvas.height;

  const cropX = Math.floor((xmin / 1000) * width);
  const cropY = Math.floor((ymin / 1000) * height);
  const cropW = Math.floor(((xmax - xmin) / 1000) * width);
  const cropH = Math.floor(((ymax - ymin) / 1000) * height);

  // 2. Criar canvas temporário para o recorte
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropW;
  tempCanvas.height = cropH;
  const ctx = tempCanvas.getContext('2d');

  ctx.drawImage(
    canvas,
    cropX, cropY, cropW, cropH,
    0, 0, cropW, cropH
  );

  // 3. Converter para Base64 JPEG de alta qualidade
  const base64Data = tempCanvas.toDataURL('image/jpeg', 0.85);

  // 4. Enviar para a Worker
  const response = await fetch(`${workerUrl}/upload-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Data.replace(/^data:image\/\w+;base64,/, ''),
      name: imageName || 'questao_crop'
    })
  });

  if (!response.ok) {
    throw new Error(`Falha no upload da imagem: HTTP status ${response.status}`);
  }

  const data = await response.json();
  return data.url; // URL ImgBB
}
```

---

## 🚨 Desempenho e Margem de Segurança

- **Resolução Máxima**: Imagens que excedem 1200px em qualquer dimensão são reduzidas proporcionalmente para evitar ultrapassar o limite de upload HTTP de 10 MB da Cloudflare Worker.
- **Compressão Adaptativa**: O serviço tenta primeiro salvar como JPEG com qualidade 85%. Se o tamanho for maior que 1 MB, reduz a qualidade para 70%.

---

## 🔗 Referências Cruzadas
- [AI Scanner Pipeline](/ocr/scanner-pipeline)
- [Endpoint Upload Image](/api-worker/upload-image)
- [Prompts do Scanner Visual](/ocr/scanner-prompts)
