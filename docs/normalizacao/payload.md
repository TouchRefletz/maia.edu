# Payload Principal do Banco de Dados (`js/normalize/payload.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/normalize/payload.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/normalize/payload.js) |
| **Escopo** | Compilação e construção do esquema JSON canônico final gravado no Firebase Firestore |
| **Função Principal** | `montarPayloadFinal()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/normalize/payload.js` garante a construção do contrato de dados imutável consumido por todo o ecossistema (banco de questões, visualizador de PDF, chatbot pedagógico, exportador de simulados e indexador Pinecone).

Nenhum campo pode ser retornado como `undefined` ou possuir chave malformada. O gerador de payload sanitiza o objeto final garantindo compatibilidade com regras de segurança do Firebase e limites de serialização JSON.

---

## 🛠️ Implementação do Código

```javascript
/**
 * Constrói e sanitiza o objeto de payload final para a coleção `questoes`.
 * @param {Object} options - Parâmetros com componentes normalizados.
 * @returns {Object} Payload final canonizado.
 */
export function montarPayloadFinal({ rawData = {}, alternativas = [], creditos = {}, explicacao = [] }) {
  const q = rawData.dados_questao || {};
  const g = rawData.dados_gabarito || {};

  return {
    dados_questao: {
      estrutura: Array.isArray(q.estrutura) ? q.estrutura : [],
      alternativas: alternativas,
      fotos_originais: Array.isArray(q.fotos_originais) ? q.fotos_originais : [],
      materias_possiveis: Array.isArray(q.materias_possiveis) 
        ? q.materias_possiveis 
        : (q.materia ? [q.materia] : []),
      palavras_chave: Array.isArray(q.palavras_chave) ? q.palavras_chave : []
    },
    dados_gabarito: {
      alternativa_correta: String(g.alternativa_correta || '').toUpperCase().trim(),
      alternativas_analisadas: Array.isArray(g.alternativas_analisadas) ? g.alternativas_analisadas : [],
      analise_complexidade: {
        fatores: g.analise_complexidade?.fatores || {},
        justificativa_dificuldade: g.analise_complexidade?.justificativa_dificuldade || ''
      },
      coerencia: {
        alternativa_correta_existe: Boolean(g.coerencia?.alternativa_correta_existe ?? true),
        tem_analise_para_todas: Boolean(g.coerencia?.tem_analise_para_todas ?? true),
        observacoes: Array.isArray(g.coerencia?.observacoes) ? g.coerencia.observacoes : []
      },
      confianca: typeof g.confianca === 'number' ? g.confianca : 1,
      creditos: creditos,
      explicacao: explicacao,
      fontes_externas: Array.isArray(g.fontes_externas) ? g.fontes_externas : [],
      fotos_originais: Array.isArray(g.fotos_originais) ? g.fotos_originais : [],
      justificativa_curta: g.justificativa_curta || '',
      texto_referencia: g.texto_referencia || ''
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}
```

---

## 📊 Especificação Detalhada dos Campos

### 1. Objeto `dados_questao`
- **`estrutura`**: Array de objetos de blocos visuais (`{ tipo, conteudo }`).
- **`alternativas`**: Array de 5 objetos (`letra: "A".."E"`, `estrutura: [...]`).
- **`fotos_originais`**: Array de URLs HTTP/HTTPS apontando para as imagens fisicamente recortadas do caderno de provas original.
- **`materias_possiveis`**: Array de strings com tópicos disciplinares (ex: `["Física", "Termodinâmica"]`).
- **`palavras_chave`**: Tags conceituais para busca e agrupamento.

### 2. Objeto `dados_gabarito`
- **`alternativa_correta`**: String da letra correta (`"A"`, `"B"`, `"C"`, `"D"`, `"E"`, ou `""` se for dissertativa).
- **`analise_complexidade`**: Objeto com vetor de 14 fatores booleanos de dificuldade.
- **`creditos`**: Metadados de autor, instituição, ano e origem da resolução.
- **`explicacao`**: Passos pedagógicos sequenciais de resolução.

---

## 🔗 Referências Cruzadas
- [Data Normalizer Pipeline](/normalizacao/data-normalizer)
- [Estrutura do Banco de Dados RTDB/Firestore](/firebase/estrutura-rtdb)
- [Pinecone Embeddings Payload](/embeddings/pinecone)
