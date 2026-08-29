# Fila de Processamento de OCR (`js/services/queue-service.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/services/queue-service.js` |
| **Escopo** | Gerenciamento de fila assíncrona, enfileiramento de tarefas pesadas, controle de concorrência e retries |
| **Exports** | `TaskQueue`, `createOCRQueue()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/services/queue-service.js` implementa um gerenciador de fila assíncrona com controle de vazão (throttling), concorrência máxima configurável e política de retries adaptativos com backoff exponencial.

Quando um usuário faz upload de um caderno de provas em PDF contendo 90 questões, o envio simultâneo de 90 chamadas à API Gemini 3.5 resultaria em bloqueios HTTP 429 (Rate Limit). O `TaskQueue` desacopla a recepção das tarefas da sua execução, garantindo consumo constante sem exceder os limites dos provedores.

---

## 🛠️ Implementação do Código

```javascript
export class TaskQueue {
  /**
   * Construtor da Fila de Tarefas Assíncronas.
   * @param {Object} options - Parâmetros de configuração.
   * @param {number} options.concurrency - Número máximo de tarefas executando simultaneamente.
   * @param {number} options.maxRetries - Quantidade máxima de tentativas em caso de erro.
   */
  constructor({ concurrency = 2, maxRetries = 3 } = {}) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.queue = [];
    this.running = 0;
    this.completed = 0;
    this.failed = 0;
    this.listeners = new Map();
  }

  /**
   * Adiciona uma tarefa assíncrona à fila.
   * @param {Function} taskFn - Função que retorna uma Promise.
   * @returns {Promise<any>} Promise resolvida quando a tarefa for concluída.
   */
  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        taskFn,
        resolve,
        reject,
        retries: 0
      });
      this.processNext();
    });
  }

  /**
   * Processa o próximo item da fila se houver slot de concorrência livre.
   */
  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const item = this.queue.shift();
    this.emit('start', { running: this.running, remaining: this.queue.length });

    try {
      const result = await item.taskFn();
      this.completed++;
      item.resolve(result);
      this.emit('progress', { completed: this.completed, failed: this.failed });
    } catch (err) {
      if (item.retries < this.maxRetries) {
        item.retries++;
        const backoffMs = Math.pow(2, item.retries) * 1000;
        console.warn(`[TaskQueue] Tentativa ${item.retries} falhou. Retentando em ${backoffMs}ms...`);
        
        await new Promise(res => setTimeout(res, backoffMs));
        this.queue.unshift(item); // Devolve ao topo da fila
      } else {
        this.failed++;
        item.reject(err);
        this.emit('error', { error: err });
      }
    } finally {
      this.running--;
      this.processNext();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(fn => fn(data));
  }
}
```

---

## 📊 Matriz de Eventos Emitidos

| Evento | Payload Retornado | Quando é Disparado |
|---|---|---|
| `start` | `{ running, remaining }` | No momento em que uma tarefa consome um slot livre |
| `progress` | `{ completed, failed }` | Após a conclusão com sucesso ou falha definitiva |
| `error` | `{ error }` | Quando todas as retentativas (maxRetries) foram esgotadas |

---

## 🔗 Referências Cruzadas
- [AI Scanner Pipeline](/ocr/scanner-pipeline)
- [Terminal UI Logs](/upload/terminal-ui)
