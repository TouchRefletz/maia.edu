# Endpoints CRUD e Gerenciamento do Pinecone (`docs/api-worker/pinecone-crud.md`)

Documentação dos endpoints `/delete-pinecone-record` e `/pinecone-clear-all`.

---

## 🛠️ Endpoints

### 1. `/delete-pinecone-record`
- **Método**: `POST` ou `DELETE`
- **Descrição**: Remove atomicamente um vetor do índice Pinecone através do identificador único (slug / question ID).
- **Payload**:
  ```json
  {
    "id": "FUVEST_2024_Q14",
    "namespace": "questoes"
  }
  ```

### 2. `/pinecone-clear-all`
- **Método**: `POST` (Requer autenticação admin)
- **Descrição**: Limpa completamente um namespace do Pinecone durante processos de re-indexação em lote do banco de dados.

---

## 🔗 Referências Cruzadas
- [Embeddings e Pinecone](/embeddings/pinecone)
- [Arquitetura da API Worker](/api-worker/arquitetura)
