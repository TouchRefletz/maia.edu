# Memory Prompts (O Córtex Sintetizador)

## Visão Geral e a Falácia do Histórico Infinito

Na modelagem padrão de chatbots, as aplicações costumam guardar todo o contexto da conversa em um array GIGANTESCO que é reenviado por completo na requisição ao LLM, consumindo dezenas de milhares de *tokens* sob o argumento de manter a "memória". O resultado disso a longo prazo é a diluição da atenção do modelo ("Lost in the Middle") e uma lentidão exorbitante de predição.

O maia.edu adota uma topologia neurobiológica. Descartamos o histórico cru antigo, e operamos através de **Extração Atômica Baseada em RAG (EntityDB)**. Em suma, criamos Modelos Fiscais Autônomos que funcionam no background espiando a conversa e salvando em bancos de dados relacionais "Conceitos Abstratos" ou "Regras Sociais" sobre o aluno.

Este motor que lê as entrelinhas e consolida o perfil estático do usuário encontra suas fundações nos prompts de `js/chat/prompts/memory-prompts.js`.

## 1. O Agente Narrador: Extrator de Fatos Atômicos (`PROMPT_NARRADOR_MEMORIA`)

Esta é a identidade do robô espião que observa o chat depois da conversa acabar ("Post-Execution Memory Extraction Lifecycle"). 
Ele nunca fala com o estudante; sua única missão é fofocar ao banco de dados o que ele identificou de peculiar na última frase falada na rodada.

### A Estrutura de Extração Restritiva

O Narrador possui uma arquitetura de extração via Enumerações Restritas e Confidence Score contidos em sua taxonomia mental:

1. **PERFIL:** Dados rígidos (Ex: "O Estudante está se preparando para o ENEM 2026").
2. **HABILIDADE:** Capacidade dura (Ex: "Usuário demonstrou proficiência resolvendo Equações de 2º Grau por soma e produto de forma ágil").
3. **LACUNA:** A galinha dos ovos de ouro. O Narrador expõe deficiências (Ex: "Usuário constantemente erra a conversão de Celsius para Kelvin e tenta multiplicar por dois").
4. **PREFERENCIA:** Como o sistema deve agir psicologicamente (Estilo visual de Tabela frente a longos textos).
5. **ESTADO_COGNITIVO:** Se o scanner identificar sinais de agressividade, fúria ("Isso tá muito difícil!") ou cansaço ("Vou dormir").
6. **EVENTO:** Feitos históricos lineares da rodada de uso.

O Narrador é severamente instruído a jamais fundir "Deduções" com o fato nu. A saída obriga o envio do trecho factual (`"evidencia"`) de forma isolada do parecer sintético (`"fatos_atomicos"`), garantindo blindagem contra "Opinião Alucinada da IA".

```json
{
  "fatos": [{
    "fatos_atomicos": "Possui extrema dificuldade em química orgânica",
    "categoria": "LACUNA",
    "confianca": 0.8,
    "evidencia": "Mensagem literal do User: 'Odeio quando coloca carbono SP3 na cadeia, não sei oq é isso'",
    "validade": "PERMANENTE"
  }]
}
```

Essa injeção permite que o banco vetorial possua `embeddings` exatos em torno do sub-módulo "Química Orgânica". Se a palavra Carbono brotar na tela na semana seguinte, a Lacuna salta na topologia K-NN do Pinecone e grita ao assistente primário que auxilie o estudante de maneira extra complacente em Carbonos SP3.

## 2. O Sintetizador de Contexto Pragmático (`PROMPT_SINTETIZADOR_CONTEXTO`)

Extrair verdades pontuais não é o mesmo que instruir ação de melhor intersecção. O banco pode deter 30 fatos desconexos sobre o "Estudante A" na manga, mas jogar todos em meio a uma instrução pra resolução de uma única questão estragaria do mesmo jeito a concentração lógica da IA executante (`maia`). 

A função de afunilamento de contexto (Pre-Execution Memory Merge) é rodada instantes antes da execução final do ChatBot via `MemoryService.synthesizeContext()`, que invoca o `PROMPT_SINTETIZADOR_CONTEXTO`.

Sua única vocação é mastigar um array com *N* Fatos Recuperados brutos e transformá-los em ordens injuntivas irrefutáveis, batendo de frente com paradoxos temporais. As ordens internas deste prompt garantem um bloqueio fenomenal de Overfitting Cognitivo:

- **Regra de Caducidade Cognitiva:** "Se encontrou o fato 'Falhava em Báskara em março' mas há o fato 'Gabareitou Bháskara em maio', a regra prescreve que o Sintetizador instrua a ChatBot: *Aja como se o usuário fosse avançado nesse tema, aplique desafios severos*".
- **Regra de Miopia Contextual (Filtro de Escopo):** Se o usuário faz cursinho integral e quer agora falar da Guerra dos Canudos (História), o Sintetizador censura o envio do fato de "Defasagem em matrizes" do banco para a IA. Contudo, mantém os fatos comportamentais vivos ("Possui Déficit de Atenção, evite parágrafos longos"), visto que isso perpassa transversalmente as disciplinas.

### A Ordem Injetada

O resultado da síntese é um bloco invisível que "contamina a System Prompt do momento" agindo como a VOZ do subconsciente do assistente Maia. Em tela isso transparece em uma barra translúcida:
*"Memórias Recuperadas! Ajustando respostas confome seu perfil..."* 

Sendo o repasse sintático interno:

```text
DIRETIVAS DE MEMÓRIA:
- O usuário encontra-se irritado hoje com Biologia Celular; utilize empatia reforçada e pule divagações complexas indo direto na definição do Lisossomo.
``` 

Com essa simples re-configuração pragmática antes de começar a ditar conhecimento a seco, a *Maia.edu* avança o salto gigantesco de não ser mais uma IA morta operando sessões sem rosto, para ser a primeira camada sólida da **Estagnação Anti-Amnistia** aplicada diretamente ao aprendizado humanizado do estudante.

## Referências Direcionais
- [A Árvore de Memória Geral e Indexação Vectorial](/memoria/visao-geral)
- [Router Prompt Classificatório e Suas Prevenções](/chat/router-prompt)
- [Chat UI - Interação Gráfica com Bolhas de Contexto](/chat/hydration)
