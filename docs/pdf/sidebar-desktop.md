# Sidebar Desktop do Viewer (`js/viewer/sidebar-desktop.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/viewer/sidebar-desktop.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/viewer/sidebar-desktop.js) |
| **Escopo** | Painel lateral de navegação por miniaturas, busca textual e índice de páginas para telas desktop |
| **Exports** | `initSidebarDesktop()`, `toggleDesktopSidebar()` |

---

## 🎯 Visão Geral e Arquitetura

O `sidebar-desktop.js` gerencia a barra lateral fixa em telas de alta resolução. Ele implementa um sistema de abas alternáveis (*Miniaturas*, *Sumário*, *Busca*) e escuta os eventos do `viewerEvents` para manter o destaque visual da página em leitura synchronizado.

---

## 🛠️ Implementação do Código

```javascript
import { viewerEvents } from './events.js';
import { PDFViewerContext } from './context.js';

export function initSidebarDesktop(sidebarEl) {
  const pageListEl = sidebarEl.querySelector('.sidebar-thumbnails-list');

  // Destacar miniatura da página ativa
  viewerEvents.on('pdf:pagechange', ({ page }) => {
    const prevActive = pageListEl.querySelector('.thumbnail-item.active');
    if (prevActive) prevActive.classList.remove('active');

    const newActive = pageListEl.querySelector(`[data-page-number="${page}"]`);
    if (newActive) {
      newActive.classList.add('active');
      newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}
```

---

## 🔗 Referências Cruzadas
- [Preview e Miniaturas](/pdf/preview)
- [Contexto do Viewer](/pdf/contexto)
