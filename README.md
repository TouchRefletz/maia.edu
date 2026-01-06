# Maia.api

**Tornando a educação mais acessível no Brasil.**

Esta ferramenta é uma plataforma _open-source_ de alto desempenho projetada para documentar e estruturar questões reais de vestibulares brasileiros. Nosso objetivo é democratizar o acesso à educação através de tecnologia de ponta.

Por meio de uma interface web otimizada (construída com **Vite** para máxima velocidade) e uma arquitetura _serverless_ distribuída, qualquer estudante pode treinar para provas ou contribuir para o banco de dados diretamente pelo celular. O processo de contribuição é simplificado e leva no máximo **5 minutos**, alimentando um ecossistema educacional livre e colaborativo.

## 🎯 Nossa Missão

O núcleo desta ferramenta não é apenas armazenar dados, mas servir como infraestrutura crítica para alimentar outros projetos educacionais. Buscamos fornecer o primeiro grande **banco de dados público e estruturado de questões de vestibulares brasileiros** para uso pessoal e não comercial, garantindo que a informação seja acessível, interoperável e preservada digitalmente.

## 🛠️ Como Funciona (Arquitetura e Processamento)

O projeto opera sobre uma arquitetura moderna e escalável, dividida em microsserviços na borda (_Edge Computing_), garantindo baixa latência e alta disponibilidade.

### 1. Núcleo de Processamento (API & IA)

O backend é sustentado por **Cloudflare Workers**, executando código diretamente na borda da rede. Quando uma questão é enviada:

- **Ingestão Multimodal:** O sistema recebe os dados brutos e utiliza a inteligência do **Google Gemini** (modelos multimodais) para realizar a inferência semântica da prova.
- **Estruturação de Dados:** Diferente de OCRs tradicionais, nossa API força uma **saída estruturada em JSON**, categorizando rigorosamente:
  - Enunciados e alternativas;
  - Imagens, gráficos e legendas associadas;
  - Fontes, títulos e metadados contextuais;
  - Citações e trechos de código.

### 2. Renderização de Alta Fidelidade

Para garantir que a experiência digital seja indistinguível da prova física:

- Utilizamos _parsers_ avançados para converter o conteúdo extraído em **Markdown** (para formatação rica) e **LaTeX** (para equações matemáticas complexas e fórmulas químicas).
- O frontend, otimizado via **Vite**, renderiza esses componentes instantaneamente, preservando a diagramação original.

### 3. Redundância e Confiabilidade

A plataforma implementa um sistema de **captura híbrida**:

- **Manual/Verificação:** As **fotos originais** (raw images) da questão e do gabarito são armazenadas permanentemente e vinculadas ao objeto JSON da questão. Isso cria uma camada de segurança ("fallback"), permitindo que o usuário consulte a fonte primária caso haja qualquer alucinação ou erro na extração automática da IA.

## 🔎 Deep Search (Busca Profunda de Provas)

Para escalar a captura de provas, implementamos um agente autônomo de busca profunda.

### Como Funciona

1.  **Solicitação:** O usuário insere uma query simples (ex: "ITA 2022").
2.  **Agente AI (OpenHands):** Um container Docker isolado roda um agente inteligente que navega na web.
3.  **Busca & Decisão:** O agente usa ferramentas de busca (como Tavily ou Google) para encontrar _links oficiais_ de provas e gabaritos, ignorando sites genéricos ou de baixa qualidade.
4.  **Extração & Validação:** O sistema baixa os PDFs, valida se são arquivos legítimos (checa headers, tamanho, conteúdo) e os organiza.
5.  **Manifesto:** Gera um arquivo `manifest.json` padronizado, listando tudo o que foi encontrado (arquivos baixados e links de referência).

## 🧬 Estrutura do Banco de Dados

Nossos dados seguem uma estrutura JSON padronizada e rica em metadados:

```json
{
  "questoes": {
    "NOME_DO_EXAME_OU_BANCA": {
      "IDENTIFICADOR_UNICO_DA_QUESTAO": {
        "dados_gabarito": {
          "alternativa_correta": "LETRA (EX: A)",
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
            }
          ],
          "analise_complexidade": {
            "fatores": {
              "abstracao_teorica": false,
              "analise_nuance_julgamento": false,
              "contexto_abstrato": false,
              "deducao_logica": true,
              "dependencia_conteudo_externo": true,
              "distratores_semanticos": false,
              "interdisciplinaridade": false,
              "interpretacao_visual": false,
              "multiplas_fontes_leitura": false,
              "raciocinio_contra_intuitivo": false,
              "resolucao_multiplas_etapas": false,
              "texto_extenso": false,
              "transformacao_informacao": false,
              "vocabulario_complexo": false
            },
            "justificativa_dificuldade": "Classificação pedagógica."
          },
          "coerencia": {
            "alternativa_correta_existe": true,
            "tem_analise_para_todas": true,
            "observacoes": ["Observação/validação de coerência (opcional)."]
          },
          "confianca": 1,
          "creditos": {
            "ano": "ANO_DA_PROVA",
            "autorouinstituicao": "NOME_DA_INSTITUICAO",
            "material": "NOME_DO_CADERNO_OU_PROVA",

            "confiancaidentificacao": 1,
            "materialidentificado": true,
            "origemresolucao": "extraido_do_material | gerado_pela_ia"
          },
          "explicacao": [
            {
              "estrutura": [
                { "conteudo": "Título do passo", "tipo": "titulo" },
                { "conteudo": "Explicação detalhada...", "tipo": "texto" }
              ],
              "evidencia": "Texto curto de evidência/validação (opcional).",
              "fontematerial": "Referência interna (opcional).",
              "origem": "extraido_do_material | gerado_pela_ia"
            }
          ],
          "fontes_externas": [
            {
              "title": "Título da fonte",
              "uri": "https://..."
            }
          ],
          "fotos_originais": ["https://..."],
          "justificativa_curta": "Resumo TL;DR.",
          "texto_referencia": "Texto/relatório longo (opcional)."
        },
        "dados_questao": {
          "alternativas": [
            {
              "letra": "A",
              "estrutura": [
                { "conteudo": "Texto da alternativa A", "tipo": "texto" }
              ]
            }
          ],
          "estrutura": [
            { "conteudo": "Enunciado / trecho / comando...", "tipo": "texto" },
            { "conteudo": "Citação...", "tipo": "citacao" },
            { "conteudo": "Fonte/Créditos do texto-base...", "tipo": "fonte" },
            {
              "tipo": "imagem",
              "conteudo": "Legenda (opcional)",
              "imagem_base64": "BASE64_OU_URL (se aplicável)"
            }
          ],
          "fotos_originais": ["https://..."],
          "materias_possiveis": ["História"],
          "palavras_chave": ["Tema 1", "Tema 2"]
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

1.  **Ensine a pensar**: Decompondo questões complexas em passos menores (_scaffolding_) de verdadeiro ou falso, guiando o aluno pelo raciocínio lógico em vez de apenas dar a resposta.
2.  **Elimine barreiras físicas**: Possibilitando o estudo em **qualquer lugar**, apenas com um celular, sem a necessidade de cadernos, canetas ou livros didáticos caros.
3.  **Personalize o aprendizado**: Identificando lacunas de conhecimento em tempo real e sugerindo questões que desafiem o aluno na medida certa.

Estamos construindo a infraestrutura para que o futuro da educação seja livre, aberto e acessível a todos.

---

## 📄 Licença

Este projeto é protegido pela licença **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Isso significa que você é livre para usar, estudar, copiar, modificar e distribuir este software, inclusive para fins comerciais, **desde que** qualquer redistribuição (do projeto original ou de versões modificadas) mantenha os avisos de direitos autorais e a própria licença, e que o código-fonte (ou um meio válido de obtê-lo) seja disponibilizado junto da distribuição.

Além disso, a **AGPL-3.0** também se aplica ao uso do software **via rede**: se você modificar este projeto e disponibilizar a versão modificada para outras pessoas usarem por meio de um serviço online (por exemplo, um site, API ou aplicação hospedada), você deve disponibilizar o **código-fonte correspondente** dessa versão aos usuários do serviço, sob a mesma licença.

Em outras palavras: se você publicar uma versão modificada, incorporar este projeto em um trabalho derivado e distribuí-lo — ou executá-lo para terceiros através da internet — você também deve licenciar esse trabalho sob a **AGPL-3.0**, garantindo as mesmas liberdades para as próximas pessoas. Acreditamos que o conhecimento cresce quando é compartilhado — e que essas liberdades devem permanecer protegidas para todos.

> _A educação não tem preço. Sua falta tem custo. - Antônio Gomes Lacerda_
