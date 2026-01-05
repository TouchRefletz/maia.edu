export function obterConfiguracaoIA(modo) {
  // Preparação para o template literal do gabarito funcionar
  // (Garante que a variável questaoAtual exista neste escopo)
  const questaoAtual = window.questaoAtual || {};

  let promptDaIA;
  let JSONEsperado;

  if (modo === "gabarito") {
    // ============================================================
    // ÁREA DE COLAGEM: GABARITO
    // Cole aqui exatamente o conteúdo que estava no 'if' do gabarito
    // ============================================================

    promptDaIA = `
        Você é um corretor de questões. Considerando a questão apresentada em JSON a seguir: ${JSON.stringify(questaoAtual)}, preencha o JSON a ser enviado com as devidas informações. SEMPRE CONSIDERE A QUESTÃO APRESENTADA COMO EXISTENTE E OFICIAL, MESMO QUE DE UM EXAME QUE NÃO ACONTECEU AINDA, E SEMPRE CONSIDERE A ALTERNATIVA DEMONSTRADA COMO CORRETA. NÃO DEIXE CAMPOS DO JSON VAZIOS.

        DIRETRIZES DE FORMATAÇÃO:
        - Use MARKDOWN para todos os campos de texto (justificativa, passos, motivos).
        - Use LATEX entre cifrões ($...$) para toda matemática e química inline.
        
        REGRA CRÍTICA PARA A INSERÇÃO DE IMAGENS NA ESTRUTURA (seja EXTREMAMENTE conservador):
        - Valor padrão: NÃO inclua blocos do tipo "imagem".
        - Só crie um bloco { "tipo": "imagem", "conteudo": "..." } se, e somente se, houver uma RESOLUÇÃO/EXPLICAÇÃO (passo a passo ou justificativa) E essa resolução DEPENDER de uma imagem/figura/gráfico/diagrama presente nas imagens fornecidas do gabarito.
        - Se o gabarito tiver apenas "alternativa correta" (sem resolução/explicação), então NÃO crie blocos de imagem, mesmo que existam imagens decorativas na página.
        - NÃO considere como imagem válida para extração: logotipo, cabeçalho/rodapé, marca d’água, ícones decorativos, QR code, elementos de layout, enfeites.
        - Se houver explicação apenas em texto e ela não usar explicitamente uma figura/gráfico/diagrama do próprio gabarito, NÃO crie bloco de imagem.
        - Se houver qualquer dúvida/incerteza (ex.: parece ter figura mas pode ser só layout, ou não fica claro que a resolução usa a figura), NÃO crie bloco de imagem.
        - Em resumo: só adicione um bloco de imagem na estrutura quando for MUITO evidente que a resolução do gabarito usa uma figura/gráfico/diagrama que está realmente presente nas imagens enviadas.

        “Considere somente imagens com carimbo ATUAL como evidência principal para alternativa correta e resolução.”
        “Use SUPORTE apenas para contexto/consistência; nunca para decidir a letra correta se ATUAL já contém isso. NUNCA utilize imagens de SUPORTE para dizer que há imagens na resolução.”

        ESTRUTURAÇÃO DOS PASSOS ("explicacao"):
        - cada passo da resolução é composto por uma lista de blocos ("estrutura").
        - Se um passo envolve: "Texto explicando -> Equação -> Gráfico", crie 3 blocos dentro da estrutura desse passo.
        - NÃO use OCR em imagens. Se houver uma imagem na resolução, crie um bloco {tipo: "imagem", conteudo: "descrição visual..."}.
        - CREDITE CADA PASSO, dado como gerado por IA ou como do material scaneado.

        IMPORTANTE SOBRE ESTILO E ORDEM DOS PASSOS:
        1. NÃO NUMERE OS PASSOS NO CONTEÚDO: O sistema já exibe "Passo 1", "Passo 2" automaticamente.
        - ERRADO: {tipo: "texto", conteudo: "1. Primeiramente calculamos..."}
        - CERTO: {tipo: "texto", conteudo: "Primeiramente calculamos..."}
        2. TÍTULOS DOS PASSOS: Se o passo tiver um título lógico (ex: "Cálculo da Massa"), use um bloco do tipo "titulo" como o PRIMEIRO item da estrutura desse passo.
        - Exemplo: estrutura: [ {tipo: "titulo", conteudo: "Cálculo da Massa"}, {tipo: "texto", conteudo: "..."} ]
        3. SEM PREFIXOS REDUNDANTES: Não inicie o texto com "Resolução:", "Explicação:" ou "Passo:". Vá direto ao assunto.
        4. No primeiro passo, NÃO UTILIZE UM TÍTULO como "Resolução", "Explicação", ou parecidos, pois o sistema também já realiza essa estrutura.

        REGRA PARA "analise_complexidade":
        - Seja criterioso. Marque 'true' apenas se o fator for realmente determinante para a dificuldade.
        - Na justificativa, explique qual o maior gargalo para o aluno (ex: "A dificuldade vem da união de vocabulário arcaico com a necessidade de cálculo estequiométrico").
        `;

    JSONEsperado = {
      type: "object",
      properties: {
        alternativa_correta: {
          type: "string",
          description:
            "A alternativa correta, indicada no gabarito (ex.: 'A').",
        },

        justificativa_curta: {
          type: "string",
          description:
            "Resumo curto do porquê a alternativa correta está correta (1-2 frases).",
        },

        // --- NOVA SEÇÃO: MATRIZ DE COMPLEXIDADE ---
        analise_complexidade: {
          type: "object",
          description: "Análise técnica da dificuldade da questão.",
          additionalProperties: false,
          properties: {
            fatores: {
              type: "object",
              additionalProperties: false,
              properties: {
                // Suporte e Leitura
                texto_extenso: {
                  type: "boolean",
                  description: "Enunciado muito longo ou cansativo.",
                },
                vocabulario_complexo: {
                  type: "boolean",
                  description:
                    "Termos arcaicos, técnicos densos ou outra língua.",
                },
                multiplas_fontes_leitura: {
                  type: "boolean",
                  description:
                    "Exige cruzar dados de Texto 1 x Texto 2 ou Texto x Gráfico.",
                },
                interpretacao_visual: {
                  type: "boolean",
                  description:
                    "A resolução depende crucialmente de ler um gráfico, mapa ou figura.",
                },

                // Conhecimento Prévio
                dependencia_conteudo_externo: {
                  type: "boolean",
                  description:
                    "A resposta NÃO está no texto. Exige memória de fórmulas, datas ou regras.",
                },
                interdisciplinaridade: {
                  type: "boolean",
                  description:
                    "Envolve conceitos de duas disciplinas distintas.",
                },
                contexto_abstrato: {
                  type: "boolean",
                  description:
                    "Exige imaginar cenários hipotéticos ou contextos históricos não explicados.",
                },

                // Raciocínio
                raciocinio_contra_intuitivo: {
                  type: "boolean",
                  description:
                    "A resposta desafia o senso comum ou parece 'errada' à primeira vista.",
                },
                abstracao_teorica: {
                  type: "boolean",
                  description:
                    "Conceitos puramente teóricos sem representação física direta.",
                },
                deducao_logica: {
                  type: "boolean",
                  description:
                    "A resposta é construída por silogismo ou eliminação lógica complexa.",
                },

                // Operacional (Universal)
                resolucao_multiplas_etapas: {
                  type: "boolean",
                  description:
                    "Passo A leva a Passo B que leva a Passo C (cálculo ou lógica).",
                },
                transformacao_informacao: {
                  type: "boolean",
                  description:
                    "Converter unidades, traduzir metáforas ou passar de gráfico para função.",
                },
                distratores_semanticos: {
                  type: "boolean",
                  description:
                    "Alternativas erradas muito parecidas com a correta (pegadinhas).",
                },
                analise_nuance_julgamento: {
                  type: "boolean",
                  description:
                    "Exige escolher a 'mais correta' dentre opções plausíveis.",
                },
              },
              required: [
                "texto_extenso",
                "vocabulario_complexo",
                "multiplas_fontes_leitura",
                "interpretacao_visual",
                "dependencia_conteudo_externo",
                "interdisciplinaridade",
                "contexto_abstrato",
                "raciocinio_contra_intuitivo",
                "abstracao_teorica",
                "deducao_logica",
                "resolucao_multiplas_etapas",
                "transformacao_informacao",
                "distratores_semanticos",
                "analise_nuance_julgamento",
              ],
            },
            justificativa_dificuldade: {
              type: "string",
              description: "Explicação curta do nível de dificuldade.",
            },
          },
          required: ["fatores", "justificativa_dificuldade"],
        },
        // ------------------------------------------

        confianca: {
          type: "number",
          description: "Confiança do corretor na alternativa correta (0 a 1).",
          minimum: 0,
          maximum: 1,
        },

        creditos: {
          type: "object",
          description:
            "Tentativa de identificar o material/fonte do gabarito/resolução. Se não for possível, sinaliza necessidade de crédito genérico.",
          additionalProperties: false,
          properties: {
            origem_resolucao: {
              type: "string",
              description: "Origem geral da resolução apresentada.",
              enum: ["extraido_do_material", "gerado_pela_ia"],
            },
            material_identificado: {
              type: "boolean",
              description:
                "True se foi possível identificar algum material/fonte com confiança mínima; false caso contrário.",
            },
            confianca_identificacao: {
              type: "number",
              description:
                "Confiança na identificação do material/fonte (0 a 1).",
              minimum: 0,
              maximum: 1,
            },
            material: {
              type: "string",
              description:
                "Nome do material/fonte identificado (ex.: 'Apostila Anglo 2022', 'FUVEST 2023', 'Coleção X - Capítulo Y').",
            },
            autor_ou_instituicao: {
              type: "string",
              description: "Autor/instituição editora, se reconhecível.",
            },
            ano: {
              type: "string",
              description:
                "Ano associado ao material, se houver (string para aceitar '2023/2024', 's/d', etc.).",
            },
            como_identificou: {
              type: "string",
              description:
                "Breve justificativa de como o material foi identificado (ex.: cabeçalho, rodapé, padrão de diagramação, nome da banca).",
            },
            precisa_credito_generico: {
              type: "boolean",
              description:
                "True quando não há como identificar a fonte e deve-se exibir um alerta/pedido de crédito genérico.",
            },
            texto_credito_sugerido: {
              type: "string",
              description:
                "Texto curto sugerido para dar crédito quando a fonte não for identificável.",
            },
          },
          required: [
            "origem_resolucao",
            "material_identificado",
            "precisa_credito_generico",
          ],
        },

        alertas_credito: {
          type: "array",
          description:
            "Alertas de crédito/fonte quando o material não puder ser identificado com segurança.",
          items: { type: "string" },
        },

        explicacao: {
          type: "array",
          description:
            "Lista de passos da resolução. Se não houver resolução no conteúdo enviado, gere a sua própria e sinalize isso em cada passo.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              estrutura: {
                type: "array",
                description:
                  "Conteúdo rico deste passo (texto, equações, imagens).",
                items: { $ref: "#/$defs/blocoConteudo" },
              },
              origem: {
                type: "string",
                enum: ["extraido_do_material", "gerado_pela_ia"],
                description:
                  "Defina se, na maioria da estrutura, há conteúdos gerados com IA ou retirados e adaptados do material.",
              },
              fonte_material: {
                type: "string",
                description:
                  "Se reconhecível, identifica material/fonte relacionada a este passo (pode repetir o 'creditos.material'). Caso não reconhecível, diga que foi tua, e coloque sua identificação aqui.",
              },
              evidencia: {
                type: "string",
                description:
                  "Sinal curto do porquê a fonte foi atribuída (ex.: 'cabeçalho', 'padrão de numeração', 'nome da instituição'). Caso tenha sido gerado por inteligência artificial, coloque aqui que não há evidências.",
              },
            },
            required: ["estrutura", "origem", "fonte_material", "evidencia"],
          },
        },

        alternativas_analisadas: {
          type: "array",
          description:
            "Análise curta de cada alternativa (por que está correta/errada).",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              letra: { type: "string" },
              correta: { type: "boolean" },
              motivo: { type: "string" },
            },
            required: ["letra", "correta", "motivo"],
          },
        },

        coerencia: {
          type: "object",
          description:
            "Checagens internas de consistência baseadas na questão fornecida (ajuda a detectar mismatch de gabarito).",
          additionalProperties: false,
          properties: {
            alternativa_correta_existe: {
              type: "boolean",
              description:
                "True se a letra retornada existe nas alternativas da questão.",
            },
            tem_analise_para_todas: {
              type: "boolean",
              description:
                "True se alternativas_analisadas cobre todas as alternativas fornecidas na questão.",
            },
            observacoes: {
              type: "array",
              description:
                "Observações curtas de consistência (ex.: 'gabarito parece de outra questão').",
              items: { type: "string" },
            },
          },
          required: ["alternativa_correta_existe"],
        },
      },
      required: [
        "alternativa_correta",
        "analise_complexidade",
        "explicacao",
        "creditos",
        "coerencia",
        "alternativas_analisadas",
        "confianca",
        "justificativa_curta",
      ],
      additionalProperties: false,
      $defs: {
        blocoConteudo: {
          type: "object",
          additionalProperties: false,
          properties: {
            tipo: {
              type: "string",
              enum: [
                "texto",
                "imagem",
                "citacao",
                "lista",
                "equacao",
                "codigo",
                "destaque",
                "separador",
                "titulo",
                "subtitulo",
                "fonte",
                "tabela",
              ],
            },
            conteudo: {
              type: "string",
              description:
                "Conteúdo do bloco conforme o tipo: (texto/citacao/destaque) texto literal em parágrafos; (titulo/subtitulo) cabeçalho interno do conteúdo, nunca a identificação da questão; (lista) itens em linhas separadas; (equacao) somente expressão em LaTeX; (codigo) somente o código; (imagem) descrição visual curta (alt-text) sem OCR; (separador) pode ser vazio; (fonte) créditos/referência exibível (ex: 'Fonte: ...', 'Adaptado de ...', autor/obra/URL); (tabela) USE FORMATO MARKDOWN TABLE.",
            },
          },
          required: ["tipo", "conteudo"],
        },
      },
    };
  } else {
    // ============================================================
    // ÁREA DE COLAGEM: QUESTÃO (MODO NORMAL)
    // Cole aqui exatamente o conteúdo que estava no 'else'
    // ============================================================

    promptDaIA = `
        Você é um extrator de questões. Seu único objetivo é identificar e organizar os dados fielmente ao layout original no JSON. NÃO DEIXE CAMPOS DO JSON VAZIOS.

        REGRAS DE ESTRUTURAÇÃO ("estrutura"):
        1. NÃO jogue todo o texto em um único campo. Fatie o conteúdo em blocos sequenciais dentro do array "estrutura".
        2. Se a questão apresentar: Texto Introdutório -> Imagem -> Pergunta, seu array deve ter 3 itens: { texto }, { imagem }, { texto }.
        3. Para blocos do tipo "imagem": O campo "conteudo" deve ser uma breve descrição visual (Alt-Text) para acessibilidade. NÃO extraia o texto de dentro da imagem (OCR), apenas descreva o elemento visual.
        4. Para blocos do tipo "texto": Mantenha a formatação original tanto quanto possível.
        5. Se houver "Texto 1" e "Texto 2" separados, crie blocos de texto separados.

        Analise as imagens fornecidas (que compõem uma única questão) e gere o JSON. As imagens enviadas contém partes da mesma questão (enunciado, figuras, alternativas). Junte as informações de todas as imagens. NÃO DESCREVA O TEXTO CONTIDO EM IMAGENS (OCR). Se identificar algo que não se encaixa claramente em nenhum tipo das estruturas solicitadas, use imagem (com descrição visual curta; sem OCR).
        
        DIRETRIZES DE FORMATAÇÃO (RIGOROSAS):
        1. **MARKDOWN OBRIGATÓRIO:** Todo o conteúdo textual (exceto JSON chaves) deve ser formatado em Markdown. Use **negrito**, *itálico* onde aparecer no original.
        
        2. **MATEMÁTICA E QUÍMICA (LATEX):** - TODA fórmula matemática, símbolo, variável (como 'x', 'y') ou equação química DEVE ser escrita exclusivamente em LaTeX.
            - **INLINE (No meio do texto):** Se a fórmula faz parte da frase, use o bloco do tipo 'texto' e envolva o LaTeX entre cifrões unitários. Exemplo: "A massa de $H_2O$ é..." ou "Sendo $x = 2$, calcule...".
            - **DISPLAY (Isolada):** Se a fórmula aparece centralizada, sozinha em uma linha ou é muito complexa, use um bloco do tipo 'equacao' contendo APENAS o código LaTeX cru (sem cifrões).

        3. **ESTRUTURA:**
            - Se houver Texto -> Equação Isolada -> Texto, gere 3 blocos: {tipo: 'texto'}, {tipo: 'equacao'}, {tipo: 'texto'}.
            - Se houver Texto com equação pequena no meio, gere 1 bloco: {tipo: 'texto', conteudo: 'O valor de $x$ é...'}.
            - JAMAIS use ASCII para matemática (nada de x^2 ou H2O normal). Use $x^2$ e $H_2O$.
            - **TABELAS:** Se a questão contiver uma tabela de dados, use o tipo 'tabela' e formate o conteúdo EXCLUSIVAMENTE como uma tabela Markdown.

        Analise as imagens fornecidas. Junte as informações de todas as imagens.
        `;

    JSONEsperado = {
      type: "object",
      properties: {
        identificacao: {
          type: "string",
          description: "Identificação da questão (ex: 'ENEM 2023 - Q45').",
        },
        materias_possiveis: { type: "array", items: { type: "string" } },
        estrutura: {
          type: "array",
          description:
            "Lista ordenada que representa o fluxo visual da questão, mantendo a ordem exata de textos e imagens. IMPORTANTÍSSIMO: não inclua a identificação da questão (ex: 'Questão 12', 'ENEM 2023 - Q45', 'FUVEST 2022') em nenhum item desta lista; isso deve ficar exclusivamente no campo 'identificacao'. Use 'titulo' e 'subtitulo' apenas para cabeçalhos internos do conteúdo (ex: 'Texto I', 'Considere o gráfico', 'Fragmento', 'Leia o texto a seguir').",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              tipo: {
                type: "string",
                enum: [
                  "texto",
                  "imagem",
                  "citacao",
                  "titulo",
                  "subtitulo",
                  "lista",
                  "equacao",
                  "codigo",
                  "destaque",
                  "separador",
                  "fonte",
                  "tabela",
                ],
                description: "O tipo de conteúdo deste bloco.",
              },
              conteudo: {
                type: "string",
                description:
                  "Conteúdo do bloco conforme o tipo: (texto/citacao/destaque) texto literal em parágrafos; (titulo/subtitulo) cabeçalho interno do conteúdo, nunca a identificação da questão; (lista) itens em linhas separadas; (equacao) somente expressão em LaTeX; (codigo) somente o código; (imagem) descrição visual curta (alt-text) sem OCR; (separador) pode ser vazio; (fonte) créditos/referência exibível (ex: 'Fonte: ...', 'Adaptado de ...', autor/obra/URL); (tabela) USE FORMATO MARKDOWN TABLE.",
              },
            },
            required: ["tipo", "conteudo"],
          },
        },
        palavras_chave: {
          type: "array",
          description: "Principais termos chave.",
          items: { type: "string" },
        },
        alternativas: {
          type: "array",
          items: { $ref: "#/$defs/alternativa" },
        },
      },
      required: [
        "identificacao",
        "materias_possiveis",
        "palavras_chave",
        "alternativas",
        "estrutura",
      ],
      $defs: {
        alternativa: {
          type: "object",
          additionalProperties: false,
          properties: {
            letra: { type: "string" },
            estrutura: {
              type: "array",
              description:
                "Lista ordenada que representa o fluxo visual das alternativas, mantendo a ordem exata de textos e imagens.",
              items: { $ref: "#/$defs/blocoAlternativa" },
            },
          },
          required: ["letra", "estrutura"],
        },
        blocoAlternativa: {
          type: "object",
          additionalProperties: false,
          properties: {
            tipo: { type: "string", enum: ["texto", "equacao", "imagem"] },
            conteudo: {
              type: "string",
              description:
                "Conteúdo do bloco conforme o tipo: (texto) texto literal; (equacao) somente LaTeX; (imagem) alt-text curto sem OCR.",
            },
          },
          required: ["tipo", "conteudo"],
        },
        additionalProperties: false,
      },
    };
  }

  return { promptDaIA, JSONEsperado };
}
