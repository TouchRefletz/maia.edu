<table border="0">
  <tr>
    <td valign="middle">
      <img src="https://maia-api.vercel.app/logo.png" alt="Logo Maia" width="80">
    </td>
    <td valign="middle">
      <h1 style="margin: 0;">Maia<span style="color: #21808D">.edu</span></h1>
    </td>
  </tr>
</table>

<div>
  <img src="https://img.shields.io/badge/Google%20Gemini-3.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini 3.5 Flash">
  <img src="https://img.shields.io/badge/OpenAI%20Models-GPT--5%20%2F%20o3--mini-10A37F?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI Models">
  <img src="https://img.shields.io/badge/Groq-GPT--OSS%20120B-f97316?style=for-the-badge&logoColor=white" alt="Groq Models">
  <img src="https://img.shields.io/badge/System-Router%20Complexity%20Aware-21808D?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Router Complexity">
  <img src="https://img.shields.io/badge/Feature-Google%20Grounding%20(Search)-34A853?style=for-the-badge&logo=google&logoColor=white" alt="Google Grounding">
  <img src="https://img.shields.io/badge/Feature-Google%20Structured%20Output-34a0a8?style=for-the-badge&logo=google&logoColor=white" alt="Google Structured Output">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Pinecone-Vector_DB-000000?style=for-the-badge&logo=pinecone&logoColor=white" alt="Pinecone">
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20%2B%20React%2019-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Frontend Hybrid">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
</div>

<br />

**Ecossistema educacional inteligente para a democratização do ensino no Brasil.**

> [!NOTE]
> Este é um **projeto científico** que utiliza tecnologia de ponta para pesquisar e implementar novas formas de aprendizado adaptativo e acessibilidade digital.

O **Maia.edu** é uma plataforma _open-source_ de alto desempenho projetada para criar um ecossistema educacional funcional e autônomo. Mais do que apenas documentar dados, o projeto integra um **sistema automatizado de extração de questões**, um **chatbot pedagógico** avançado e um **banco de dados estruturado** de questões reais de vestibulares brasileiros.

Por meio de uma arquitetura _serverless_ distribuída e uma interface web de alto desempenho (SPA construída em Vanilla JS + TypeScript compilado via Vite, com componentes interativos específicos montados sob demanda utilizando React 19), a plataforma permite que estudantes treinem para exames e contribuam para o banco de dados em um ciclo colaborativo. O sistema de extração inteligente reduz o tempo de digitalização para menos de **5 minutos por questão**, garantindo que a informação educacional seja preservada, interoperável e acessível a todos.

## 🎯 Nossa Missão

O objetivo do Maia.edu é servir como infraestrutura crítica para a educação aberta brasileira. Buscamos fornecer o primeiro grande **banco de dados, alimentado por IA, público, estruturado e inteligente de questões** para uso pessoal e de pesquisa, curado pela comunidade, removendo barreiras econômicas e tecnológicas através de IA adaptativa.

## 🛠️ Como Funciona (Arquitetura e Processamento)

O projeto opera sobre uma arquitetura moderna e escalável, dividida em microsserviços na borda (_Edge Computing_), garantindo baixa latência e alta disponibilidade.

### 🧠 Pipeline de Inferência Híbrida

O coração do Maia.edu é um sistema roteável que entende a intenção do estudante para fornecer a resposta pedagógica ideal.

```mermaid
graph TD
    %% Estilo dos nós
    classDef user fill:#21808D,stroke:#fff,stroke-width:2px,color:#fff;
    classDef ai fill:#4285F4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef worker fill:#F38020,stroke:#fff,stroke-width:2px,color:#fff;
    classDef db fill:#000,stroke:#fff,stroke-width:2px,color:#fff;
    classDef front fill:#61DAFB,stroke:#333,stroke-width:2px,color:#000;

    UserInput([👤 Mensagem do Estudante]):::user --> Router{🧠 Router Inteligente<br>Gemma 4 31B IT}:::ai

    subgraph "Backend (Cloudflare Workers)"
        Router -- "Dúvida Rápida" --> ModeFast[⚡ Modo Rápido]:::ai
        Router -- "Conceito Complexo" --> ModeReasoning[🤔 Modo Raciocínio]:::ai
        Router -- "Passo-a-Passo" --> ModeScaffolding[🎓 Modo Scaffolding<br>Tutor Socrático]:::ai
        Router -- "Intenção de Busca" --> ModeSearch[🔎 Modo Busca<br>RAG / Grounding]:::ai

        ModeSearch --> Pinecone[(Pinecone Vector DB)]:::db
        Pinecone --> ContextInjection[💉 Injeção de Contexto]:::worker
        ContextInjection --> Generator[📝 Geração de Resposta<br>JSON Schema Strict]:::ai
        ModeFast & ModeReasoning & ModeScaffolding --> Generator
    end

    Generator -- "Stream de JSON Tipado" --> Frontend[💻 Frontend Híbrido<br>Processamento de Stream]:::front

    subgraph "Frontend (Client-Side Rendering)"
        Frontend --> Parser{⚙️ Parser de Blocos}:::front

        %% Generalização dos blocos de conteúdo visual
        Parser -- "Types: texto, imagem, codigo,<br>tabela, equacao, lista..." --> ComponentRich[📦 Renderizadores Visuais<br>Markdown, KaTeX]:::front

        %% Blocos de Lógica de Negócio (Complexos)
        Parser -- "type: 'questao'" --> ComponentQuestion[Hydrate: <QuestaoCard /><br>Fetch Dados do DB]:::front
        Parser -- "type: 'scaffolding'" --> ComponentScaffolding[Hydrate: <ScaffoldUI /><br>Interativo / State]:::front
    end

    ComponentRich & ComponentQuestion & ComponentScaffolding --> Output([✨ Interface Final]):::user
```

### 1. Núcleo de Processamento (API & IA)

O backend é sustentado por **Cloudflare Workers**, executando código diretamente na borda da rede. Quando uma questão é enviada:

- **Ingestão Multimodal:** O sistema recebe os dados brutos e utiliza a inteligência do **Gemini 3.5 Flash** (ou modelo configurável) para realizar a inferência semântica da prova.
- **Estruturação de Dados:** Diferente de OCRs tradicionais, nossa API força uma **saída estruturada em JSON**, categorizando rigorosamente:
  - Enunciados, alternativas e **suporte completo para questões dissertativas**;
  - Imagens, gráficos e legendas associadas;
  - Fontes, títulos e metadados contextuais;
  - Citações e trechos de código.

#### 🔎 Geração Aumentada por Pesquisa (SAG)

O extrator não apenas "lê" a imagem, mas atua como um agente pesquisador para garantir a precisão do gabarito.

```mermaid
graph TD
    subgraph Passo 1: Extração Visual
        Image[Crop da Questão] --> Extractor[Gemini 3.5 Flash<br>Visão Computacional]
        Extractor --> JSON_Q[JSON Preliminar]
    end

    subgraph Passo 2: Pesquisa Agêntica
        JSON_Q --> SearchAgent[Worker Search Agent]
        SearchAgent --> Google[Google Search Grounding]
        Google --> Report[Relatório de Pesquisa]
    end

    subgraph Passo 3: Geração Aumentada
        JSON_Q & Report --> Generator[Gemini 3.5 Flash<br>Gerador de Gabarito]
        Generator --> JSON_Full[JSON Completo + Fontes]
    end

    subgraph Passo 4: Normalização via Payload
        JSON_Full --> Payload[Processador Payload]
        Payload --> Normalizer[DataNormalizer<br>Padronização de Instituições]
        Normalizer --> FinalDB[(Banco de Dados)]
    end
```

### 2. Renderização de Alta Fidelidade

Para garantir que a experiência digital seja indistinguível da prova física:

- Utilizamos _parsers_ avançados para converter o conteúdo extraído em **Markdown** (para formatação rica) e **LaTeX** (para equações matemáticas complexas e fórmulas químicas).
- O frontend, otimizado via **Vite**, renderiza esses componentes instantaneamente, preservando a diagramação original.

### 3. Redundância e Confiabilidade

A plataforma implementa um sistema de **captura híbrida**:

- **Manual/Verificação:** As **fotos originais** (raw images) da questão e do gabarito são armazenadas permanentemente e vinculadas ao objeto JSON da questão. Isso cria uma camada de segurança ("fallback"), permitindo que o usuário consulte a fonte primária caso haja qualquer alucinação ou erro na extração automática da IA.

---

## 🤖 Maia.ai (Chatbot Educacional)

A Maia.ai é o assistente inteligente que consome o banco de dados para proporcionar uma experiência de aprendizado personalizada e interativa.

### 1. Orquestração de Conversa (Router)

- **Router de Complexidade:** Implementamos um roteador inteligente (baseado em **Gemma 4 31B IT** por padrão, ou outro modelo configurável) que analisa cada mensagem do usuário para decidir o melhor fluxo de execução: _Rápido_ (respostas diretas baseadas no Gemini 3.5 Flash), _Raciocínio_ (análise profunda via Flash/Thinking) ou _Scaffolding_ (estudo guiado/Tutor Socrático).
- **Títulos Dinâmicos:** Utilizamos o modelo **Gemma 4 31B IT** para gerar títulos curtos e precisos que resumem o contexto de cada conversa no histórico de chats.

### 2. Memória Contextual Híbrida

A Maia possui um sistema de memória de longo prazo que evolui conforme o estudante interage:

- **Extração de Fatos:** Fluxo assíncrono que extrai fatos sobre o perfil, conhecimento e preferências do usuário.
- **Busca Vetorial (RAG):** Recuperação semântica de memórias passadas para personalizar a resposta.
- **Storage Híbrido:** **EntityDB** (local via IndexedDB) para velocidade e **Pinecone** (nuvem) para persistência global de usuários logados.

### 3. Scaffolding (Aprendizado Adaptativo)

Em vez de apenas entregar a resposta, a plataforma pode ativar o modo de estudo assistido:

- **Decomposição Lógica:** A IA quebra a questão original em uma sequência de afirmações de **Verdadeiro ou Falso**.
- **Métricas de Proficiência:** O sistema avalia não apenas o acerto, mas a **certeza do usuário** (via slider de 0-100%) e o **tempo de resposta**, ajustando a dificuldade do próximo passo em tempo real.
- **Intervenção Didática:** O fluxo só avança ou termina quando o sistema valida que o usuário compreendeu o conceito fundamental por trás do problema.

### 4. Inteligência Ativa com Extração Sob Demanda

A inteligência da Maia.ai transcende a consulta passiva ao banco de dados:

- **Solicitação de Extração AI-Driven:** Caso a IA identifique a necessidade de mais material sobre um tema específico para auxiliar o aluno, ela pode atuar como um agente pesquisador autônomo. A IA pode **solicitar uma extração de questões**, desencadeando a pesquisa web de PDFs relacionados ao assunto e orquestrando a **extração via CLI**. Esse conteúdo é fatiado e injetado no sistema em tempo real, garantindo que o aprendizado nunca seja interrompido por falta de exercícios.

### 5. Configuração Multi-Modelos e Chaves Clientes (Client-Side)

Para garantir total flexibilidade nas requisições e contornar limites globais de cota, os usuários podem configurar suas próprias credenciais de API diretamente pela interface web (com persistência em `sessionStorage` local):
- **Google Gemini API Key**: Habilita o processamento local com os modelos nativos do ecossistema Google, incluindo `Gemini 3.5 Flash` (padrão do chat e correções), `Gemini 3.1 Flash Lite`, `Gemini 3 Flash (Preview)` e `Gemini 2.5 Flash`.
- **GitHub Personal Access Token (OpenAI)**: Permite executar modelos da OpenAI disponibilizados pela API de Modelos do GitHub, tais como `GPT-5`, `GPT-5-mini`, `GPT-4.1-mini`, `GPT-4o`, `o1` e `o3-mini`.
- **Groq API Key**: Ativa o suporte ao modelo Mixture of Experts de ultra-velocidade `GPT-OSS 120B`.

## 🔎 Busca e Extração Inteligente (Deep Search & Extraction)

Para escalar a captura de conteúdo educacional, o Maia.edu possui um sistema autônomo e multifacetado de busca e extração. O sistema opera em dois modos principais de pesquisa e suporta múltiplos métodos de geração do banco.

### Modos de Pesquisa

1.  **Busca por Provas:** O usuário insere uma query direta (ex: "ITA 2022") e o sistema vasculha a internet em busca de links oficiais do caderno de questões completo e seu respectivo gabarito.
2.  **Busca por Questões Temáticas (AI-Driven):** O usuário ou o agente escolhe um tópico específico de estudo (ex: "Eletromagnetismo avançado"). O sistema vasculha a web atrás de listas de exercícios ou materiais didáticos em PDF que tangenciam o tema, processando e fatiando o conhecimento encontrado.

### Métodos de Extração

Ambos os métodos compartilham o mesmo núcleo de validação: eles checam a integridade contínua do PDF (ignorando arquivos corrompidos ou constituídos inteiramente por imagens sem texto real) antes de processar o conteúdo.

- **Extração pelo Navegador:** Permite que qualquer usuário faça o upload de um PDF ou interaja com a interface web para processar páginas e extrair conhecimento em tempo real diretamente de seu browser.
- **Extração via CLI (Pipeline Local):** Um processo robusto em linha de comando orquestrado para processamento autônomo ou de grandes volumes. Ele controla o download em lote e a execução assíncrona, alimentando o banco de dados organicamente e de forma escalável.

#### 📷 Scanner Auditor (Greedy Box)

O sistema de digitalização possui um loop de "auditoria" para garantir cortes perfeitos.

```mermaid
graph TD
    Page[Página PDF Renderizada] --> GreedyBox[Greedy Box Detection<br>Gemini 3.5 Flash]
    GreedyBox --> Auditor{Agente Auditor}

    Auditor -- "Corte Inválido (Cortou Texto)" --> Correction[Self-Correction Loop<br>Ajuste de Coordenadas]
    Correction --> GreedyBox

    Auditor -- "Aprovado" --> Crop[Final Crop]
```

## 📝 Módulo de Simulados

Para complementar a preparação dos estudantes, a plataforma integra um sistema completo de simulados:
- **Criação Personalizada**: Geração de provas de múltipla escolha (objetivas) ou abertas (dissertativas) selecionando livremente itens do banco de dados curado.
- **Simulação Online**: Painel do estudante com cronômetro integrado, salvamento de respostas em tempo real e correção automatizada (com correção semântica via IA nas questões dissertativas).
- **Exportação para Estudo Offline**: Motor de exportação que gera cadernos de prova em formato PDF altamente customizados e diagramados para impressão ou resolução offline.

## 🧪 Apêndice B (Sistema de Experimento Científico)

Um painel dedicado à pesquisa acadêmica e validação científica da IA pedagógica:
- **Triagem de Complexidade**: Avaliação de enunciados, imagens e gabaritos sob uma ótica de 14 fatores heurísticos de dificuldade (como abstração teórica, necessidade de deduções lógicas ou distratores semânticos). O experimento utiliza o modelo **Gemma 4 31B IT** fixado para manter a consistência do estudo científico.
- **Simulador de Persona**: Permite orquestrar execuções onde o modelo Gemma 4 atua como um estudante com diferentes perfis para resolver a questão, gerando métricas preditivas de resposta, tempo de raciocínio e nível estimado de certeza (0-100%).

## 🛡️ Painel Administrativo

Módulo de governança do ecossistema educacional:
- **Moderação de Questões**: Painel para validação manual, ajuste de recortes, edição de metadados e aprovação formal de questões extraídas antes da persistência definitiva no banco público.
- **Métricas e Manutenção**: Ferramentas de auditoria de integridade do banco de dados Firebase, estatísticas globais e gerenciamento de perfis de moderadores.

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
              "conteudo": "Legenda (opcional)"
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

Nosso objetivo final é **promover a democratização do acesso à educação no país** através de uma **Inteligência Artificial Adaptativa** que entenda profundamente cada estudante.

A infraestrutura que construímos hoje (Banco de dados estruturado + Memória Híbrida + Scaffolding) é a fundação para:

1.  **Personalização Extrema**: Identificar lacunas de conhecimento milimétricas e sugerir trilhas de estudo personalizadas.
2.  **Educação em Larga Escala**: Permitir que milhões de estudantes tenham acesso a um tutor particular de alta qualidade através de dispositivos simples.
3.  **Preservação do Conhecimento**: Garantir que todo o acervo de vestibulares brasileiros esteja digitalizado, estruturado e acessível para as próximas gerações.

Estamos construindo o futuro onde o aprendizado não tem barreiras.

---

## 🛠️ Execução Local

O projeto é composto por duas partes principais: a interface web (frontend) e o servidor de inteligência (Cloudflare Worker).

### 1. Frontend (Interface Web)

Para rodar a interface web localmente em ambiente de desenvolvimento:
1.  **Instale as dependências:** `npm install` na raiz do projeto.
2.  **Configure as variáveis de ambiente:** Crie um arquivo `.env` baseado no `.env.example` (configurando chaves do Firebase, ImgBB, etc.). A variável `VITE_WORKER_URL` deve apontar para o Worker local: `http://localhost:8787` (ou a URL de produção do Cloudflare).
3.  **Inicie o servidor de desenvolvimento:** `npm run dev` (iniciará o Vite e a documentação do Vitepress de forma concorrente).

### 2. Backend (Cloudflare Worker)

Para rodar o Worker de inferência de inteligência localmente:
1.  **Navegue até a pasta do worker:** `cd maia-api-worker`
2.  **Instale as dependências:** `npm install`
3.  **Configure as credenciais locais:** Crie um arquivo `.dev.vars` na pasta `maia-api-worker` baseado no `.dev.vars.example` (configurando credenciais do Gemini, Pinecone e GitHub Models, caso queira utilizar como fallback de cota).
4.  **Inicie o worker:** `npm run dev` (iniciará o simulador local do Cloudflare Workers via Wrangler na porta `8787`).

---

## 🤝 Contribua com o Projeto!

Acreditamos que a educação deve ser construída por muitos. Se você é desenvolvedor, designer, educador ou entusiasta, sua ajuda é muito bem-vinda!

- **Pull Requests:** Encontrou um bug ou quer implementar uma nova feature? Sinta-se à vontade para abrir um PR.
- **Issues:** Sugestões de melhorias ou relatos de problemas nos ajudam a evoluir.
- **Ecossistema:** Ajude-nos a curar a banca de questões e a treinar a Maia para ser uma tutora ainda melhor.

Vamos juntos transformar a educação brasileira através do código! 🚀

---

## 📄 Licença

Este projeto é protegido pela licença **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Isso significa que você é livre para usar, estudar, copiar, modificar e distribuir este software, inclusive para fins comerciais, **desde que** qualquer redistribuição (do projeto original ou de versões modificadas) mantenha os avisos de direitos autorais e a própria licença, e que o código-fonte (ou um meio válido de obtê-lo) seja disponibilizado junto da distribuição.

Além disso, a **AGPL-3.0** também se aplica ao uso do software **via rede**: se você modificar este projeto e disponibilizar a versão modificada para outras pessoas usarem por meio de um serviço online (por exemplo, um site, API ou aplicação hospedada), você deve disponibilizar o **código-fonte correspondente** dessa versão aos usuários do serviço, sob a mesma licença.

Em outras palavras: se você publicar uma versão modificada, incorporar este projeto em um trabalho derivado e distribuí-lo — ou executá-lo para terceiros através da internet — você também deve licenciar esse trabalho sob a **AGPL-3.0**, garantindo as mesmas liberdades para as próximas pessoas. Acreditamos que o conhecimento cresce quando é compartilhado — e que essas liberdades devem permanecer protegidas para todos.

> _A educação não tem preço. Sua falta tem custo. - Antônio Gomes Lacerda_
