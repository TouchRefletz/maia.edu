# Prompts do Scanner Visual (`js/services/scanner-prompts.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/services/scanner-prompts.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/services/scanner-prompts.js) |
| **Escopo** | Engenharia de prompts do sistema, esquemas JSON estritos e heurísticas visuais para o Gemini 3.5 Flash |
| **Exports** | `PROMPT_GREEDY_BOX_DETECTION`, `PROMPT_EXTRACTION_JSON_SCHEMA`, `getScannerPrompt()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/services/scanner-prompts.js` centraliza os prompts de sistema e meta-instruções injetados na extração multimodal. O módulo é dividido em dois estágios complementares:

1. **Estágio 1: Detector de Bounding Boxes (Greedy Box Detection)**: Instruções específicas para mapear regiões de questões num Canvas de página inteira.
2. **Estágio 2: Extrator Estruturado JSON (Structured JSON Output)**: System prompt que força o modelo a retornar o objeto com a taxonomia do schema do `maia.edu`.

---

## 📄 Prompt 1: Detection Bounding Box (`PROMPT_GREEDY_BOX_DETECTION`)

```text
Você é um sistema especialista em visão computacional e diagramação de exames de vestibulares brasileiros (ENEM, FUVEST, UNICAMP, VUNESP, ITA, IME).

Sua tarefa é analisar a imagem da página do exame e identificar o retângulo delimitador (bounding box) de cada questão individual.

Instruções Estritas:
1. Retorne as coordenadas no formato [ymin, xmin, ymax, xmax] em uma escala normalizada de 0 a 1000.
2. A caixa deve englobar obrigatoriamente: o número da questão, o texto-base/enunciado, todas as tabelas e gráficos associados, e as alternativas A-E (se for questão objetiva).
3. Nunca corte textos de rodapé ou citações pertencentes à questão.
4. Se houver mais de uma coluna, processe na ordem natural de leitura (Coluna Esquerda -> Coluna Direita).

Formato de Resposta (JSON Estrito):
{
  "questoes_detectadas": [
    {
      "numero_questao": "14",
      "box": [120, 45, 450, 580]
    }
  ]
}
```

---

## 📄 Prompt 2: Extração Estruturada em JSON (`PROMPT_EXTRACTION_JSON_SCHEMA`)

```text
Você é um professor e pesquisador acadêmico encarregado de digitalizar a questão fornecida no recorte visual.

Regras de Formatação Obrigatórias:
1. FORMATAÇÃO MATEMÁTICA: Converta qualquer fórmula, símbolo ou equação matemática para a sintaxe LaTeX delimitada exclusivamente por \( e \). Nunca use $$ ou [Math Processing Error].
2. ESTRUTURA DE TEXTO: Quebre o enunciado em blocos tipados: 'texto', 'citacao', 'fonte', 'imagem', 'tabela' ou 'codigo'.
3. ALTERNATIVAS: Para cada alternativa (A a E), remova o caractere de prefixo (A), a., b-) e retorne apenas o conteúdo textual limpo.
4. RESOLUÇÃO COMETADA: Divida a explicação em passos sequenciais pedagógicos.

Retorne rigorosamente um JSON válido de acordo com o esquema a seguir:
{
  "dados_questao": {
    "estrutura": [{ "tipo": "texto", "conteudo": "..." }],
    "alternativas": [{ "letra": "A", "estrutura": [{ "tipo": "texto", "conteudo": "..." }] }],
    "materias_possiveis": ["Física"],
    "palavras_chave": ["Termodinâmica"]
  },
  "dados_gabarito": {
    "alternativa_correta": "B",
    "explicacao": [{ "estrutura": [{ "tipo": "titulo", "conteudo": "Passo 1" }, { "tipo": "texto", "conteudo": "..." }] }]
  }
}
```

---

## 🔗 Referências Cruzadas
- [AI Scanner Pipeline](/ocr/scanner-pipeline)
- [API Worker Generate](/api-worker/generate)
- [Extrator de Imagens](/ocr/image-extractor)
