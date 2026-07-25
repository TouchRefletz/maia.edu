# Sidebar e Drawer Mobile (`js/viewer/sidebar-mobile.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/viewer/sidebar-mobile.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/viewer/sidebar-mobile.js) |
| **Escopo** | Interface responsiva mobile, gaveta deslizante (Bottom Sheet) e suporte a gestos touch |
| **Exports** | `initSidebarMobile()`, `openMobileDrawer()`, `closeMobileDrawer()` |

---

## 🎯 Visão Geral e Arquitetura

O `sidebar-mobile.js` transforma a barra lateral num painel estilo **Bottom Sheet** retrátil quando o dispositivo opera em telas menores que `768px`. Ele implementa ouvintes de evento `touchstart`, `touchmove` e `touchend` para permitir arrastar a gaveta para baixo para fechar.

---

## 🛠️ Implementação do Código

```javascript
export function initSidebarMobile(drawerEl) {
  let startY = 0;
  let currentY = 0;

  drawerEl.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  drawerEl.addEventListener('touchmove', e => {
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) {
      drawerEl.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  drawerEl.addEventListener('touchend', () => {
    const deltaY = currentY - startY;
    if (deltaY > 120) {
      closeMobileDrawer(drawerEl);
    } else {
      drawerEl.style.transform = 'translateY(0)';
    }
  });
}

export function closeMobileDrawer(drawerEl) {
  drawerEl.style.transform = 'translateY(100%)';
  drawerEl.classList.remove('is-open');
}
```

---

## 🔗 Referências Cruzadas
- [Responsividade e Mobile CSS](/css/responsividade)
- [Sidebar Desktop](/pdf/sidebar-desktop)
