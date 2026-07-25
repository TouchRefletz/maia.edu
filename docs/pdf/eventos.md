# Sistema de Eventos do PDF Viewer (`js/viewer/events.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/viewer/events.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/viewer/events.js) |
| **Escopo** | Barramento de eventos assíncrono pub/sub do visualizador de PDF |
| **Exports** | `viewerEvents`, `EventEmitter` |

---

## 🎯 Visão Geral e Arquitetura

O `js/viewer/events.js` implementa a infraestrutura de comunicação baseada em eventos (Pub/Sub) para desatar o acoplamento direto entre os componentes visuais do PDF Viewer.

Quando o usuário clica num botão da toolbar para mudar de página ou fazer zoom, o evento é emitido no barramento `viewerEvents`. A viewport principal, a miniatura da sidebar e os overlays de seleção escutam esse evento e atualizam suas respectivas camadas DOM em paralelo.

---

## 🛠️ Implementação do Código

```javascript
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Inscreve uma função ouvinte em um evento.
   * @param {string} event - Nome do evento.
   * @param {Function} listener - Callback de execução.
   * @returns {Function} Função de cancelamento da inscrição (unsubscribe).
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(listener);

    return () => this.off(event, listener);
  }

  /**
   * Remove uma inscrição de evento.
   */
  off(event, listenerToRemove) {
    if (!this.events.has(event)) return;
    const filtered = this.events.get(event).filter(listener => listener !== listenerToRemove);
    this.events.set(event, filtered);
  }

  /**
   * Dispara um evento transmitindo os dados fornecidos aos ouvintes.
   * @param {string} event - Nome do evento.
   * @param {Object} data - Payload do evento.
   */
  emit(event, data) {
    if (!this.events.has(event)) return;
    this.events.get(event).forEach(listener => {
      try {
        listener(data);
      } catch (err) {
        console.error(`[ViewerEvents] Erro ao disparar ouvinte para '${event}':`, err);
      }
    });
  }
}

export const viewerEvents = new EventEmitter();
```

---

## 📢 Catálogo de Eventos Mapeados

| Nome do Evento | Payload Retornado | Descrição |
|---|---|---|
| `pdf:loaded` | `{ totalPages }` | Emitido quando o arquivo PDF é totalmente carregado pelo PDF.js |
| `pdf:pagechange` | `{ page, total }` | Emitido quando a página visível no viewport é alterada |
| `pdf:zoomchange` | `{ scale }` | Emitido ao modificar a escala de zoom da viewport |
| `pdf:modechange` | `{ mode }` | Emitido ao alternar entre os modos `'view'` e `'crop'` |
| `pdf:cropcreated` | `{ id, box }` | Emitido quando um novo retângulo de corte é desenhado no Cropper |
| `pdf:cropremoved` | `{ id }` | Emitido ao deletar um recorte ativo da página |

---

## 🔗 Referências Cruzadas
- [Contexto do Viewer](/pdf/contexto)
- [Core do PDF Viewer](/pdf/core)
