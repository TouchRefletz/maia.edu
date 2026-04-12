# Image Slot — Gerenciamento de Slots de Imagem

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+image-slot&labels=docs)

## Visão Geral

O módulo **Image Slot** gerencia os "encaixes" (slots) de imagens dentro de blocos estruturados de questões. Quando o [scanner de OCR](/ocr/scanner-pipeline) detecta uma imagem no PDF, a IA gera um bloco `{ tipo: "imagem", conteudo: "descrição visual..." }`. O Image Slot é o sistema que:
1. Cria o placeholder visual no DOM para essa imagem
2. Gerencia o binding entre imagens externas (Firebase Storage URLs) e slots posicionais
3. Permite que administradores troquem/adicionem imagens via [Cropper](/cropper/visao-geral)

## Arquitetura de Slots

```mermaid
flowchart TD
    subgraph Questão com 3 imagens
        S1["Slot 0: Gráfico de Pressão"]
        S2["Slot 1: Tabela Visual"]
        S3["Slot 2: Diagrama de Circuito"]
    end

    subgraph imagensExternas array
        I0["URLs[0] = firebase.storage/img0.png"]
        I1["URLs[1] = firebase.storage/img1.png"]
        I2["URLs[2] = null"]
    end

    S1 --> I0
    S2 --> I1
    S3 --> I2

    I2 --> P["Placeholder: 📷 Adicionar Imagem"]
```

### Binding Posicional

O binding entre slots e URLs é **posicional**: o primeiro bloco `tipo: "imagem"` no array `estrutura` mapeia para `imagensExternas[0]`, o segundo para `imagensExternas[1]`, e assim por diante. Isso significa que a ordem dos blocos de imagem na estrutura é CRÍTICA — reordenar blocos pode desalinhar imagens.

## Estados de um Slot

| Estado | Visual | Interatividade |
|--------|--------|---------------|
| **Com URL + Readonly** | `<img>` com zoom (click) | Cursor zoom-in |
| **Com URL + Editável** | `<img>` + botão "🔄 Trocar" | Click no botão abre Cropper |
| **Sem URL + Editável** | Placeholder cinza "📷" | Click abre Cropper (captura nova) |
| **Sem URL + Readonly** | Texto "(Imagem não disponível)" | Nenhuma |

## Fluxo de Captura/Troca

Quando o admin clica em "🔄 Trocar Imagem" ou no placeholder:

```mermaid
sequenceDiagram
    participant Admin
    participant Slot as Image Slot
    participant Crop as Cropper Module
    participant PDF as PDF Renderer
    participant Storage as Firebase Storage

    Admin->>Slot: Click em "Trocar Imagem" (data-idx=2, data-ctx=questao)
    Slot->>Crop: iniciar_captura_para_slot(2, "questao")
    Crop->>PDF: Rolar até página atual do PDF
    PDF-->>Crop: Canvas do PDF renderizado

    Admin->>Crop: Desenha retângulo de seleção
    Crop-->>Crop: Recorta canvas na região selecionada
    Crop->>Storage: Upload do crop para Firebase Storage
    Storage-->>Crop: URL permanente da imagem

    Crop->>Slot: Atualiza imagensExternas[2] = nova URL
    Slot->>Slot: Re-renderiza com a imagem nova
```

## `data-idx` e `data-ctx`

Cada slot carrega dois data-attributes no botão de interação:
- `data-idx`: Índice posicional no array `imagensExternas` (0, 1, 2...)
- `data-ctx`: Contexto de renderização (`"questao"` para enunciado, nome da alternativa para alts)

O Cropper usa `data-ctx` para saber onde salvar a URL resultante:
- `data-ctx="questao"` → `imagensExternas[data-idx]`
- `data-ctx="A"` → `imagensAlternativaA[data-idx]`

## Alternativas com Imagens

Alternativas também podem conter slots de imagem. O binding funciona de forma análoga, mas com um array separado por letra:

```javascript
// Cada alternativa tem seu próprio array de imagens
window.iniciar_captura_para_slot_alternativa('C', 0);
// → Abre Cropper para slot 0 da alternativa C
```

## Captions (Legendas)

Se o bloco de imagem possui `conteudo` (descrição visual da IA), ele é renderizado como caption abaixo da imagem:

```html
<div class="structure-image-wrapper">
  <img src="url" class="structure-img" />
  <div class="structure-caption markdown-content" data-raw="Gráfico mostrando...">
    IA: Gráfico mostrando relação pressão x volume
  </div>
</div>
```

O prefixo "IA:" indica que a descrição foi gerada automaticamente.

## Referências Cruzadas

- [Structure Render — Renderiza slots como parte da estrutura](/render/structure)
- [Cropper — Ferramenta de recorte de imagem](/cropper/visao-geral)
- [Card Template — Exibe slots no modo readonly do Banco](/banco/card-template)
- [Config IA — Define blocos tipo "imagem" no schema](/embeddings/config-ia)
