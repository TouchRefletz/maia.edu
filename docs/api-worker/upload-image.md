# /upload-image — Upload para ImgBB

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+upload-image&labels=docs)

## Visão Geral

O endpoint `/upload-image` faz proxy de uploads de imagens base64 para o serviço **ImgBB**, retornando a URL pública da imagem hospedada.

## Rota

| Método | Caminho |
|--------|---------|
| POST | `/upload-image` |

## Request

```json
{ "image": "data:image/png;base64,iVBORw0KGgo..." }
```

O prefixo `data:image/xxx;base64,` é automaticamente removido.

## Response

Retorna a resposta completa da API ImgBB:

```json
{
  "data": {
    "id": "abc123",
    "url": "https://i.ibb.co/xxx/image.png",
    "display_url": "https://i.ibb.co/xxx/image.png",
    "width": 800,
    "height": 600
  },
  "success": true
}
```

## Detalhamento Técnico

```javascript
const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
const formData = new FormData();
formData.append('image', cleanBase64);
const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
  method: 'POST',
  body: formData,
});
```

### Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `IMGBB_API_KEY` | Chave da API ImgBB (secret do Worker) |

## Uso

Usado para hospedar imagens de questões extraídas, permitindo que sejam referenciadas por URL em vez de base64 inline.

## Referências Cruzadas

- [Arquitetura do Worker](/api-worker/arquitetura) — Visão geral dos endpoints
- [Image Slot](/render/image-slot) — UI que usa as imagens uploadadas
