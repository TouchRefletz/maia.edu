# Sidebar do Modo Cropper (`js/viewer/sidebar-cropper.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/viewer/sidebar-cropper.js` |
| **Escopo** | Gerenciamento da lista de recortes efetuados na página atual e envio em lote para extração por IA |
| **Exports** | `SidebarCropperManager`, `initSidebarCropper()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/viewer/sidebar-cropper.js` comanda a interface lateral acionada quando o leitor entra no modo de corte de exames. Ele atua como uma estante temporária onde o moderador ou estudante acumula os cultivos da página (enunciados, imagens de apoio, alternativas) antes de disparar o processamento da esteira de IA.

---

## 🛠️ Implementação do Código

```javascript
import { viewerEvents } from './events.js';

export class SidebarCropperManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.cropsList = [];
    this.initListeners();
  }

  initListeners() {
    viewerEvents.on('pdf:cropcreated', cropData => this.addCropCard(cropData));
    viewerEvents.on('pdf:cropremoved', ({ id }) => this.removeCropCard(id));
  }

  addCropCard(cropData) {
    this.cropsList.push(cropData);

    const card = document.createElement('div');
    card.className = 'crop-sidebar-card';
    card.dataset.cropId = cropData.id;

    card.innerHTML = `
      <div class="crop-card-header">
        <span class="crop-card-title">Recorte #${this.cropsList.length}</span>
        <button class="btn-remove-crop" data-id="${cropData.id}">✕</button>
      </div>
      <div class="crop-card-preview">
        <img src="${cropData.previewUrl}" alt="Preview do Recorte" />
      </div>
      <div class="crop-card-type">
        <label>Tipo de Recorte:</label>
        <select class="select-crop-type">
          <option value="questao_objetiva">Questão Objetiva</option>
          <option value="questao_dissertativa">Questão Dissertativa</option>
          <option value="imagem_suporte">Imagem / Gráfico de Apoio</option>
        </select>
      </div>
    `;

    card.querySelector('.btn-remove-crop').addEventListener('click', () => {
      viewerEvents.emit('pdf:cropremoved', { id: cropData.id });
    });

    this.container.appendChild(card);
  }

  removeCropCard(id) {
    this.cropsList = this.cropsList.filter(c => c.id !== id);
    const cardEl = this.container.querySelector(`[data-crop-id="${id}"]`);
    if (cardEl) cardEl.remove();
  }
}
```

---

## 🔗 Referências Cruzadas
- [Cropper Core](/cropper/core)
- [Sistema de Recorte de Imagem](/ocr/image-extractor)
