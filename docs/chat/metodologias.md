# Configurações de Metodologia (Frameworks Pedagógicos)

## Visão Filosófica da Aprendizagem Multimodal

Nos idos da primeira era da Inteligência Artificial Generativa (aproximadamente de 2022 a medos de 2024), a relação entre o Estudante e o Chatbot era de consumo raso: O estudante mandava uma string, a IA cuspia um sumário engessado e padrão. A taxonomia de aprendizagem, no entanto, abomina abordagens *one-size-fits-all* (cenário universal único). Uma mente estudando História do Brasil possui ramificações sinápticas totalmente diferentes do mesmo cérebro tentando absorver Geometria Quântica ou Sintaxe Python.

O maia.edu abstrai isso provendo um framework pedagógico embutido. Nós oferecemos **13 abordagens catalogadas na taxonomia Bloom e em métodos acadêmicos irrefutáveis**. Quando o usuário (ou a heurística de IA através de inferência RAG) seleciona uma metodologia, injeta-se uma pesada camada secundária de meta-prompts ao estilo de um "Filtro de Câmera". Tudo que a IA processará, deverá passar pela lente acadêmica imposta por aquela diretriz específica de Ensino-Aprendizagem.

## As 13 Vertentes do Catálogo Pedagógico

O mapeamento na base central de processamento obriga o preenchimento de variáveis específicas para reformatar os fluxos LLM no `Router Prompt`.

| Código de Sistema `id` | Método Aplicado | Descrição Cognitiva Atrelada | Gatilho Injetado no Contexto |
|---|-----|------|-----------|
| `socratico` | Maiêutica / Socrático | Destrói certezas absolutas do sujeito guiando até que ele monte os "Legos" do raciocínio solitariamente. | *"Nunca entregue gabaritos. Use charadas e perguntas reflexivas como 80% do preenchimento e 20% como dicas de amparo."* |
| `feynman` | Técnica de Richard Feynman | Descer a torre de marfim acadêmica. Exigir didatismo rasteiro, metáforas cotidianas simples (Ex: Tratar buracos negros como lençóis estendidos). | *"Reescreva os termos técnicos usando analogias para uma criança de 12 anos entender sem pestanejar."* |
| `dual-coding` | Dual Coding (Paivio, 1971) | Associa palavras com estímulos espaciais-visuais pesados para reter traços de memória na biologia. | *"Você DEVE injetar esquemas gráficos. Gere blocos Mermaids visuais para todas as interconexões teóricas."* |
| `elaboracao` | Elaboração Integrada | Não avança ao próximo step sem que o estudante ancore o conceito atual numa vivência passada que ele já possua. | *"Force uma amarração com a regra X anterior já ensinada."* |
| `pratica-distribuida` | Prática Espaçada (Ebbinghaus) | Embutido no modo de Scaffolding, faz retornar questões em gaps de tempo para furar a Curva do Esquecimento. | *"Traga novamente frações de conceitos de 3 mensagens atrás no meio desta nova bateria para teste surpresa."* |
| `intercalacao` | Método de Intercalação | Embaralha as lógicas para criar raciocínio heurístico puro. | *"Alterne exercícios de Física Atômica com Geometria pura na mesma folha-teste para forçar mudança de chave."* |
| `teste-memoria` | Active Recall (Teste de Retenção) | Obriga o aluno a cuspir informações que estudou via estímulo frontal brutal. | *"Esconda as nomenclaturas principais preenchendo as tags com "___", exigindo que o aluno memorize a regra e digite."* |
| `analogias` | Analogias Profundas Extensas | Parecido com Feynman, mas focado na equiparação de sistemas completos. | *"Deduza toda a política Econômica Europeia usando o ecossistema de sobrevivência de um Aquário de Peixes fechado."* |
| `metacognicao` | Consciência Metacognitiva | Transição de tutela. Ensinar a "Pensar sobre o Pensemento". | *"Na conclusão do chat, force a IA a perguntar: 'Qual parte desta explicação lhe trouxe um travamento cognitivo?'"* |
| `mapas-mentais` | Topologia Radial (Tony Buzan) | Redutor de longos blocos de parágrafos extensivos, pauta tudo na visualidade. | *"Obrigue um array estrito no Schema gerando ramificações de tópicos filhos, ignorando prosa longa."* |
| `gamificacao` | Engajamento Lúdico | Focado na retenção dopaminérgica do estudante cansado. | *"Distribua elogios apoteóticos a cada acerto ("Level UP!"), destrave jargões de RPG e narre a resolução como uma grande arena bossa."* |
| `pbl` | Aprendizagem via Problemas (PBL) | Resolução guiada por escopo Real-World. Abomina a teoria isolada. Ação em primeiro plano. | *"Traga um cenário corporativo no Brasil de hoje, ponha o aluno como diretor de uma empresa e o faça deduzir a regra contábil."* |
| `storytelling` | Trilha Narrativa (Joseph Campbell) | Construto poético-literário para matérias maçantes de cronologia de decoreba. | *"Narração em primeira pessoa. Você é um glóbulo vermelho percorrendo as artérias; vá descrevendo as moléculas que você cumprimenta."* |

## Invocação Modal Dinâmica (O Piloto Automático RAG)

Entendendo que um estudante médio de 16 anos **nunca** escolherá manualmente a tag `"intercalacao"` antes de pesquisar porque não domina a Base Nacional Curricular Comum, a engrenagem do maia.edu possui a diretriz zero (O Default): o modo **Automático**.

O processo RAG (Retrieval-Augmented Generation) não varre apenas os arquivos PDF à procura do gabarito das questões. O `Router Prompt` opera cruzando 3 metacampos:
- **Intenção Exata:** O moleque pediu "Me ensine"? Seleção Preditada -> Scaffold + Feynman.
- **Domínio Materico:** O conteúdo é Matemática Exata em Tópico Avançado (ex: Limites, Derivada)? O Algoritmo bloqueia Storytelling (pois criar jornadas do herói sobre equações atrapalha a objetividade) e crava -> Dual Coding / Intercalação.
- **Scanner Emocional do Histórico:** Se no banco do `EntityDB` [Agente Sintetizador](/chat/memory-prompts) notificar "Dificuldade constante detectada de interpretação", o roteador puxa -> Elaboração ou Metacognição.

## Paradigma do Dual Coding e Integração Técnica Visual

Desta lista colossal, cabe dar forte ênfase arquitetural ao item **3 (Dual Coding)**. 

Um desafio das bibliotecas nativas web é que ferramentas de Canvas Visuais exigiam processamento backend denso ou imagens Base-64 pesadíssimas rodando na API. Ao utilizar integração com o Módulo Mermaid e a engine KaTex no Frontend React (ver [Arquitetura de Renderização](/render/controller)), a Metodologia Dual enviará a instrução imperativa:
```text
Crie fluxogramas lógicos (graph TD) e preencha a propriedade {"tipo": "codigo"} anexando o raw text do "mermaid". O framework hidratador converterá passivamente em blocos SVG escaláveis.
```
Esse comando faz um processamento LLM que consome escassos ~80 tokens devolver uma interface web rica, interativa, com vetores escaláveis sem custo rotineiro de upload.

## Vínculos Internos Essenciais
- [System Prompts e a injeção do Meta-Subtexto](/chat/system-prompts)
- [A Classificação Heurística do Router Original](/chat/router-prompt)
- [O Sistema de Histórico Atômico (EntityDB)](/memoria/visao-geral)
