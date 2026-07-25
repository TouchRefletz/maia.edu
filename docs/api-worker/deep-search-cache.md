# Endpoints de Cache e Cancelamento do Deep Search (`docs/api-worker/deep-search-cache.md`)

Documentação dos endpoints `/update-deep-search-cache` e `/cancel-deep-search` implementados no Cloudflare Worker.

---

## 🛠️ Endpoints

### 1. `/update-deep-search-cache`
- **Método**: `POST`
- **Descrição**: Atualiza o cache de resultados de pesquisas profundas (Deep Search) para evitar execuções redundantes de busca web e extração de PDFs.
- **Payload**:
  ```json
  {
    "query": "FUVEST 2024 Física",
    "results": [...],
    "ttl": 86400
  }
  ```

### 2. `/cancel-deep-search`
- **Método**: `POST`
- **Descrição**: Cancela imediatamente uma execução de pipeline em andamento via dispatch na API do GitHub Actions.
- **Payload**:
  ```json
  {
    "run_id": "123456789"
  }
  ```

---

## 🔗 Referências Cruzadas
- [Arquitetura da API Worker](/api-worker/arquitetura)
- [Deep Search Infra](/infra/deep-search)
