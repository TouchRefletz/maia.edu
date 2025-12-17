# Maia.api

**Tornando a educação mais acessível no Brasil.**

Essa ferramenta foi criada para documentar questões reais de vestibulares brasileiros, com o objetivo de tornar a educação mais acessível no país. Através do nosso site, qualquer estudante pode treinar para uma prova utilizando as questões coletadas ou contribuir coletando novas questões, tudo pelo celular e em cerca de, no máximo, **5 minutos**.

## 🎯 Nossa Missão

Essa ferramenta busca alimentar outros projetos como uma forma de **democratizar o acesso à educação no Brasil**, fornecendo o primeiro grande **banco de dados público de questões de vestibulares brasileiros** para uso pessoal e não comercial.

## 🛠️ Como Funciona

O projeto utiliza a inteligência do **Gemini** e uma saída estruturada em JSON para organizar todos os dados das questões e gabaritos, incluindo:
*   Imagens e Textos
*   Fontes e Títulos
*   Citações e Códigos

Além disso, utilizamos tecnologias de renderização em **Markdown** e **LaTeX** para garantir que a questão digital seja o mais fiel possível à prova original do vestibular.

A plataforma também oferece **captura manual de imagens** de forma prática e eficiente. E, para garantir a confiabilidade, caso ocorra algum erro na extração automática, as **fotos originais** (da questão e do gabarito) permanecem sempre disponíveis para o usuário consultar durante a resolução.

## 🧬 Estrutura do Banco de Dados

Nossos dados seguem uma estrutura JSON padronizada e rica em metadados:

```json
{
  "questoes": {
    "NOME_DO_EXAME_OU_BANCA": {
      "IDENTIFICADOR_UNICO_DA_QUESTAO": {
        "dados_gabarito": {
          "alternativa_correta": "LETRA_DA_ALTERNATIVA (EX: A)",
          "alternativas_analisadas": [
            {
              "correta": true,
              "letra": "A",
              "motivo": "Explicação detalhada do motivo desta ser a correta."
            },
            {
              "correta": false,
              "letra": "B",
              "motivo": "Explicação do erro (distrator)."
            },
            {
              "correta": false,
              "letra": "C",
              "motivo": "Explicação do erro."
            },
            {
              "correta": false,
              "letra": "D",
              "motivo": "Explicação do erro."
            },
            {
              "correta": false,
              "letra": "E",
              "motivo": "Explicação do erro."
            }
          ],
          "analise_complexidade": {
            "fatores": {
              "abstracao_teorica": false,
              "analise_nuance_julgamento": false,
              "contexto_abstrato": false,
              "deducao_logica": true,
              "dependencia_conteudo_externo": true
            },
            "justificativa_dificuldade": "Classificação pedagógica."
          },
          "coerencia": {
            "alternativa_correta_existe": true,
            "tem_analise_para_todas": true
          },
          "confianca": 1,
          "creditos": {
            "ano": "ANO_DA_PROVA",
            "autorouinstituicao": "NOME_DA_INSTITUICAO",
            "material": "NOME_DO_CADERNO_OU_PROVA",
            "origemresolucao": "gerado_pela_ia_ou_humano"
          },
          "explicacao": [
            {
              "estrutura": [
                { "conteudo": "Título do Passo", "tipo": "titulo" },
                { "conteudo": "Explicação detalhada...", "tipo": "texto" }
              ],
              "origem": "gerado_pela_ia"
            }
          ],
          "fotos_originais": [ "URL..." ],
          "justificativa_curta": "Resumo TL;DR."
        },
        "dados_questao": {
          "alternativas": [
            { "letra": "A", "estrutura": [{ "conteudo": "...", "tipo": "texto" }] }
          ],
          "estrutura": [
            { "conteudo": "Enunciado...", "tipo": "texto" },
            { "conteudo": "Legenda...", "imagem_base64": "URL...", "tipo": "imagem" }
          ],
          "fotos_originais": [ "URL..." ],
          "materias_possiveis": [ "Biologia" ],
          "palavras_chave": [ "Ecologia" ]
        },
        "meta": {
          "timestamp": "ISO_8601"
        }
      }
    }
  }
}
```

## 🚀 Visão de Futuro

Nosso objetivo final é **promover a democratização do acesso à educação no país**.

Acreditamos que a tecnologia deve quebrar barreiras, não criá-las. O banco de dados estruturado que construímos aqui é apenas o combustível para algo maior: um sistema de **Inteligência Artificial Adaptativa**.

Ao transformar provas estáticas em dados vivos, permitimos que a IA:
1.  **Ensine a pensar**: Decompondo questões complexas em passos menores (*scaffolding*) de verdadeiro ou falso, guiando o aluno pelo raciocínio lógico em vez de apenas dar a resposta.
2.  **Elimine barreiras físicas**: Possibilitando o estudo em **qualquer lugar**, apenas com um celular, sem a necessidade de cadernos, canetas ou livros didáticos caros.
3.  **Personalize o aprendizado**: Identificando lacunas de conhecimento em tempo real e sugerindo questões que desafiem o aluno na medida certa.

Estamos construindo a infraestrutura para que o futuro da educação seja livre, aberto e acessível a todos.

---

## 📄 Licença

Este projeto é protegido pela licença **MIT**.

Isso significa que você é livre para usar, copiar, modificar, mesclar, publicar, distribuir, sublicenciar e/ou vender cópias do software, desde que mantenha os créditos aos criadores originais. Acreditamos que o conhecimento cresce quando é compartilhado.

> *"A educação é a arma mais poderosa que você pode usar para mudar o mundo."*
