# Estilos do Visualizador de PDF (`css/pdf-viewer.md`)

O `css/pdf-viewer.css` estiliza a viewport de renderização das páginas PDF, camadas de texto selecionável e overlay de coordenadas do Cropper.

---

## 🎨 Camadas de Renderização (Layers)

1. **`canvas` (Bitmap Layer)**: Renderizado em resolução nítida com suporte a Hi-DPI.
2. **`.textLayer` (Text Selection Layer)**: Camada de texto transparente posicionada exatamente sobre o canvas para permitir seleção de texto e cópia nativa.
3. **`.cropOverlay`**: Camada interativa SVG/Canvas onde são desenhados os retângulos de corte com alças de redimensionamento nos vértices.

---

## 🔗 Referências Cruzadas
- [Core do PDF Viewer](/pdf/core)
- [Zoom e Escala](/pdf/zoom)
