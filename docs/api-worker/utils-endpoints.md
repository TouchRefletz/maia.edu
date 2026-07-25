# Endpoints Utilitários da API Worker (`docs/api-worker/utils-endpoints.md`)

Documentação dos endpoints `/resolve-link`, `/check-duplicate` e `/check-question`.

---

## 🛠️ Endpoints

### 1. `/resolve-link`
- **Método**: `GET` / `POST`
- **Descrição**: Descurta e resolve redirecionamentos de URLs (como pesquisas do Vertex AI Search) para expor a URL de origem primária.

### 2. `/check-duplicate`
- **Método**: `POST`
- **Descrição**: Checa se uma prova ou questão já existe no Firebase Firestore antes de disparar a esteira pesada de OCR e vetorização.

### 3. `/check-question`
- **Método**: `POST`
- **Descrição**: Valida pontualmente a integridade dos campos JSON de uma questão.

---

## 🔗 Referências Cruzadas
- [Arquitetura da API Worker](/api-worker/arquitetura)
