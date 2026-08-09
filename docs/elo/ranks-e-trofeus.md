---
title: Tiers e Ranking de ELO
description: Tabela de níveis, gradientes visuais, faixas de pontos e sistema de ranking no maia.edu.
---

# 🏆 Tiers, Ranks & Tabela de Níveis

No **maia.edu**, o progresso do estudante é categorizado em **10 Tiers de Ranking**, inspirados no design competitivo moderno e alinhados com o grau de maestria cognitiva acumulado.

---

## 📊 Tabela Oficial de Tiers

| ID | Tier / Título | Faixa de ELO ($\theta$) | Fator $K_{user}$ | Cor / Gradiente Visual | Glow Visual (UI) |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **10** | **Lorde Metacognitivo** | $2500 - 4000$ | 16 | `linear-gradient(135deg, #6366f1, #a855f7)` | `rgba(99, 102, 241, 0.5)` |
| **9** | **Campeão Absoluto** | $2300 - 2499$ | 16 | `linear-gradient(135deg, #ef4444, #f59e0b)` | `rgba(239, 68, 68, 0.5)` |
| **8** | **Grão-Mestre** | $2100 - 2299$ | 16 | `linear-gradient(135deg, #f59e0b, #eab308)` | `rgba(245, 158, 11, 0.5)` |
| **7** | **Mestre** | $1950 - 2099$ | 20 | `linear-gradient(135deg, #ec4899, #a855f7)` | `rgba(236, 72, 153, 0.5)` |
| **6** | **Estrategista** | $1800 - 1949$ | 24 | `linear-gradient(135deg, #a855f7, #6366f1)` | `rgba(168, 85, 247, 0.4)` |
| **5** | **Esmeralda** | $1650 - 1799$ | 24 | `linear-gradient(135deg, #10b981, #059669)` | `rgba(16, 185, 129, 0.4)` |
| **4** | **Platina** | $1500 - 1649$ | 28 | `linear-gradient(135deg, #3b82f6, #06b6d4)` | `rgba(59, 130, 246, 0.4)` |
| **3** | **Competente** *(Base)* | $1350 - 1499$ | 32 | `linear-gradient(135deg, #21808d, #32b8c6)` | `rgba(50, 184, 198, 0.4)` |
| **2** | **Aprendiz** | $1200 - 1349$ | 40 | `linear-gradient(135deg, #9e9e9e, #616161)` | `rgba(158, 158, 158, 0.4)` |
| **1** | **Iniciante** | $0 - 1199$ | 48 | `linear-gradient(135deg, #8d6e63, #4e342e)` | `rgba(141, 110, 99, 0.4)` |

---

## 📈 Mecânica de Progressão e Barra de Experiência

A porcentagem de progresso para a próxima divisão (`progressPct`) é calculada dinamicamente por interpolação linear dentro da faixa do Tier atual:

$$\text{Progresso}(\%) = \min\left(100, \max\left(0, \frac{\theta - \text{Min}_{atual}}{\text{Min}_{proximo} - \text{Min}_{atual}} \cdot 100\right)\right)$$

*Exemplo:* Um aluno com ELO $\theta = 1575$ está no Tier **Platina** ($1500 - 1649$). O próximo Tier é **Esmeralda** ($1650$).
$$\text{Progresso} = \frac{1575 - 1500}{1650 - 1500} \cdot 100 = \frac{75}{150} \cdot 100 = 50\%$$

---

## 🔔 Eventos de Promoção e Rebaixamento (`rankChange`)

Sempre que a resposta a uma questão provoca uma transição de Tier, a função `processarResposta()` retorna o objeto `rankChange`:

```javascript
// Estrutura retornada em mudanças de Tier
rankChange = {
  type: 'up', // 'up' (promoção) ou 'down' (rebaixamento)
  oldTier: { id: 4, tier: 'Platina', ... },
  newTier: { id: 5, tier: 'Esmeralda', ... },
  thetaOld: 1642,
  thetaNew: 1656
}
```

A interface do maia.edu intercepta o `rankChange` para exibir modais comemorativos, animações de brilho no card de resposta e notificações sonoras/visuais no widget lateral.

---

## 🎨 Apresentação no Widget da Sidebar e Perfil

### Widget da Sidebar (`.nav-elo-widget`)
Localizado na barra de navegação principal, o widget exibe:
- Badge com a cor do gradiente do Tier atual.
- Valor numérico exato do ELO $\theta$.
- Barra de progresso animada com glow estilizado.

### Perfil do Usuário (`perfil-screen.js`)
No perfil completo, o estudante pode visualizar:
- **Estatuto de Maestria**: Posição relativa em comparação ao marco base de $1500$.
- **Pico Histórico ($\theta_{max}$)**: O maior valor de ELO atingido na carreira.
- **Histórico Recente**: Gráficos de oscilação das últimas resoluções.
