# Envio de Textos — Construção Semântica para Embedding

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+envio-textos&labels=docs)

## Visão Geral

O `envio-textos.js` (`js/ia/envio-textos.js`) é o módulo responsável por transformar dados brutos de questões de vestibular (JSON com estrutura, alternativas, gabarito) em uma **string textual otimizada para embedding**. É o "tradutor" entre o formato rico de dados do maia.edu e o formato flat de texto que modelos de embedding entendem.

## Motivação

Modelos de embedding (como o Gemini Embedding) recebem uma string de texto e retornam um vetor numérico. Se enviarmos o JSON bruto da questão:

```json
{"tipo": "texto", "conteudo": "A entropia..."}
```

O embedding capturaria ruído estrutural (`tipo`, `conteudo`, chaves, colchetes) que não tem valor semântico. O `construirTextoSemantico` extrai apenas o conteúdo meaningful, produzindo embeddings mais precisos.

## A Função `construirTextoSemantico`

```javascript
export function construirTextoSemantico(questao, gabarito) {
  const partes = [];

  // 1. Identificação (peso alto para busca por prova/questão)
  if (questao.identificacao) {
    partes.push(`Questão: ${questao.identificacao}`);
  }

  // 2. Matérias (contexto disciplinar)
  if (questao.materias_possiveis?.length) {
    partes.push(`Matérias: ${questao.materias_possiveis.join(", ")}`);
  }

  // 3. Enunciado (conteúdo principal)
  if (questao.estrutura) {
    questao.estrutura.forEach(bloco => {
      if (bloco.tipo === "texto" || bloco.tipo === "citacao" || bloco.tipo === "destaque") {
        partes.push(bloco.conteudo);
      } else if (bloco.tipo === "equacao") {
        partes.push(`Equação: ${bloco.conteudo}`);
      } else if (bloco.tipo === "tabela") {
        partes.push(`Tabela: ${bloco.conteudo}`);
      }
      // Imagens são ignoradas (alt-text não ajuda no embedding)
    });
  } else if (questao.enunciado) {
    partes.push(questao.enunciado); // Formato legado
  }

  // 4. Alternativas (conteúdo das opções A-E)
  if (questao.alternativas?.length) {
    questao.alternativas.forEach(alt => {
      if (alt.estrutura) {
        const textoAlt = alt.estrutura
          .filter(b => b.tipo === "texto" || b.tipo === "equacao")
          .map(b => b.conteudo)
          .join(" ");
        partes.push(`${alt.letra}) ${textoAlt}`);
      } else if (alt.texto) {
        partes.push(`${alt.letra}) ${alt.texto}`);
      }
    });
  }

  // 5. Palavras-chave (reforço semântico)
  if (questao.palavras_chave?.length) {
    partes.push(`Palavras-chave: ${questao.palavras_chave.join(", ")}`);
  }

  // 6. Gabarito (se disponível, adiciona contexto de resolução)
  if (gabarito) {
    if (gabarito.alternativa_correta) {
      partes.push(`Resposta correta: ${gabarito.alternativa_correta}`);
    }
    if (gabarito.justificativa_curta) {
      partes.push(`Justificativa: ${gabarito.justificativa_curta}`);
    }
  }

  return partes.join("\n\n");
}
```

## Estratégia de Priorização

A ordem das partes não é arbitrária. Modelos de embedding dão mais peso ao início do texto (bias posicional). Por isso:

1. **Identificação** vem primeiro — permite busca por "ENEM 2023 Q45"
2. **Matérias** em segundo — filtragem por disciplina
3. **Enunciado** é o corpo principal — conteúdo semântico real
4. **Alternativas** complementam — contêm termos relevantes
5. **Gabarito** por último — contexto adicional sem poluir

## Filtragem de Ruído

Blocos do tipo `imagem` são **ignorados**. O alt-text ("Gráfico mostrando relação entre pressão e volume") é genérico demais e poluiria o embedding com informação não discriminativa.

Blocos do tipo `separador` também são ignorados (vazio ou puramente visual).

## Truncagem

O texto final é truncado em 8.000 caracteres pela [Pipeline de Embedding](/embeddings/pipeline) antes de ser enviado ao modelo. Isso garante que:
- O embedding não exceda o limite de tokens do modelo (~2.000 tokens)
- Questões aberrantes com textos enormes não distorçam o vetor
- O custo por embedding permaneça previsível

## Normalização

O texto é normalizado removendo espaços múltiplos antes da truncagem:

```javascript
textoParaVetorizar = textoParaVetorizar
  .replace(/\s+/g, " ")
  .trim()
  .substring(0, 8000);
```

## Impacto na Qualidade da Busca

A qualidade do texto semântico impacta diretamente a precisão da busca vetorial:

| Abordagem | Precision@5 (estimado) | Problema |
|-----------|----------------------|----------|
| JSON bruto | ~40% | Ruído estrutural domina o embedding |
| Apenas enunciado | ~65% | Falta contexto de matéria e alternativas |
| Texto semântico completo | ~85% | Balanceado, contexto rico |

## Referências Cruzadas

- [Pipeline de Embedding — Consome o texto gerado](/embeddings/pipeline)
- [Config IA — Define a estrutura dos dados de questão](/embeddings/config-ia)
- [Gap Detector — Usa embeddings para busca de questões](/chat/gap-detector)
