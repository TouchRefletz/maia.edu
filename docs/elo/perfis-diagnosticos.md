---
title: Perfis Diagnósticos e Arquétipos
description: Catálogo dos 15 Perfis de Item de Feedback Instantâneo e 40 Arquétipos Globais de Estudante no maia.edu.
---

# 🧩 Perfis Diagnósticos & Arquétipos

O sistema de ELO do **maia.edu** realiza diagnósticos pedagógicos em duas escalas complementares:
1. **Feedback Instantâneo por Item (15 Perfis)**: Analisa o padrão de marcação e convicção imediatamente após a resolução de cada questão.
2. **Matriz Global do Estudante (40 Arquétipos)**: Mapeia o perfil cognitivo longitudinal do aluno em 7 eixos distintos.

---

## ⚡ 1. Catálogo dos 15 Perfis de Feedback Instantâneo

Quando o estudante submete uma questão, a função `diagnosticarPerfilMetacognitivo()` combina o resultado da resposta com os índices Brier, Ilusão de Conhecimento, Entropia e Eliminação, classificando o resultado em um dos 15 perfis:

### 🟢 Perfis de Acerto (1 a 5)

| ID | Nome do Perfil | Condições Matemáticas de Ativação | Diagnóstico Pedagógico |
| :---: | :--- | :--- | :--- |
| **1** | **🎯 Domínio Teórico Pleno** | `acertou = true`, `sSel >= 80%`, `eRate >= 0.75` | Rigor analítico perfeito. Identificou o gabarito e desarmou todos os distratores. |
| **2** | **🧠 Acerto por Eliminação** | `acertou = true`, `sSel < 50%`, `eRate >= 0.75` | Chegou à resposta eliminando as incorretas com segurança, embora mantivesse prudência. |
| **3** | **⚖️ Acerto sob Dúvida Fina (50/50)** | `acertou = true`, `opcoesPlausiveis = 2` | Isolou as duas alternativas mais fortes e optou pelo gabarito. Há uma pequena nuance a ajustar. |
| **4** | **🎲 Acerto por Incerteza (Chute)** | `acertou = true`, `hNorm >= 0.8` | Distribuição de confiança muito dispersa (alta entropia). O acerto deve ser revisado como se fosse erro. |
| **5** | **🔍 Acerto com Atração de Distrator** | `acertou = true`, distrator secundário com peso $\ge 0.25$ | Acertou, mas um distrator atraente (com premissa verdadeira em tese, mas fora do comando) gerou hesitação. |

### 🔴 Perfis de Erro (6 a 15)

| ID | Nome do Perfil | Condições Matemáticas de Ativação | Diagnóstico Pedagógico |
| :---: | :--- | :--- | :--- |
| **6** | **🔴 Ponto Cego Absoluto** | `acertou = false`, `sSel >= 75%` ou `iIlusao >= 0.5` | **Erro Crítico**: Alta convicção em uma alternativa errada. Revela um viés conceitual profundo que precisa ser desfeito. |
| **7** | **💔 Descarte Inadvertido do Gabarito** | `acertou = false`, `sGabDescarte >= 90%` | Descartou erroneamente a alternativa correta no início da leitura por estranhar a redação. |
| **8** | **🔄 Dúvida Fina Invertida (50/50)** | `acertou = false`, `opcoesPlausiveis = 2` | Isolou as duas melhores opções, mas escolheu o distrator sutil. O raciocínio estava na direção certa. |
| **9** | **🧩 Eliminação Incompleta** | `acertou = false`, `0.25 <= eRate <= 0.5` | Eliminou 1 ou 2 opções absurdas, mas não tinha critério para desempatar entre as restantes. |
| **10** | **🧠 Honestidade Metacognitiva** | `acertou = false`, `hNorm >= 0.8`, `iIlusao = 0` | Reconheceu com transparência que não dominava o assunto, marcando alta incerteza sem criar falsas ilusões. |
| **11** | **⚠️ Ancoragem por Interpretação** | `acertou = false`, viés de leitura do enunciado | Erro causado por leitura desatenta do comando do enunciado (ancorou na premissa errada). |
| **15** | **📉 Lacuna Teórica Extrema** | `acertou = false`, `pSel < 0.2`, `eRate = 0` | Ausência completa de repertório sobre o tema exigido. Requer estudo teórico guiado inicial. |

---

## 🏛️ 2. Matriz dos 40 Arquétipos Globais do Estudante (7 Eixos)

A função `calcularPerfisEstudante()` analisa todo o histórico de resoluções acumuladas e avalia a matriz de 40 arquétipos divididos em 7 eixos cognitivos:

```mermaid
mindmap
  root((40 Arquétipos do Aluno))
    Eixo 1: Metacognição & Calibração
      M01 Estrategista Autoconsciente
      M02 Convicto Iludido
      M03 Cético Hesitante
      M04 Racional Coerente
      M05 Intuitivo Caótico
    Eixo 2: Nível de ELO & Maestria
      E01 Grão-Mestre Absoluto
      E02 Mestre dos Fundamentos
      E03 Especialista em Escala
      E04 Competente em Ascensão
      E05 Aprendiz Dedicado
      E06 Explorador da Base
    Eixo 3: Tática de Descarte & Resolução
      T01 Aniquilador de Distratores
      T02 Mestre do Descarte Seletivo
      T03 Decisor de 50/50
      T04 Arriscador Imprudente
    Eixo 4: Polarização & Domínio Temático
      P01 Polímata Generalista
      P02 Especialista Hiper-Focado
      P03 Guardião de Humanas & Direito
      P04 Mestre das Exatas & Lógica
      P05 Analista Biomédico
    Eixo 5: Resiliência & Curva de Evolução
      R01 Fênix Resiliente
      R02 Inabalável em Sequência
      R03 Sensível a Saltos de Complexidade
      R04 Escalador em Tendência Alta
      R05 Maratonista Consistente
    Eixo 6: Preferência Estrutural de Item
      S01 Decifrador de Textos Densos
      S02 Leitor Visual & Gráfico
      S03 Mestre da Nuance & Julgamento
      S04 Pragmático Pronto
    Eixo 7: Perfil de Estilo de Prova
      B01 Especialista em Alta Densidade
      B02 Mestre de Proposições & Armadilhas
      B03 Focado em Conceitual Direto
      B04 Camaleão de Provas
      B05 Caçador de Armadilhas Semânticas
      B06 Dominador de Teoria Pura
```

### Detalhes dos Eixos:
1. **Metacognição & Calibração**: Mede o alinhamento entre o conhecimento real e a percepção de risco.
2. **Nível de ELO & Maestria**: Faixa absoluta de habilidade global acumulada.
3. **Tática de Descarte & Resolução**: Eficiência técnica no descarte sistemático de opções falsas.
4. **Polarização & Domínio Temático**: Homogeneidade ou especialização por matérias (Humanas, Exatas, Biológicas).
5. **Resiliência & Curva de Evolução**: Capacidade de recuperação pós-erro e manutenção de sequências (*streaks*).
6. **Preferência Estrutural de Item**: Adaptação a textos longos, gráficos, equações ou enunciados diretos.
7. **Perfil de Estilo de Prova**: Afinidade com diferentes estilos de banca e formatos de exigência.
