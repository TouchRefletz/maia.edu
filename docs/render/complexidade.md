# ComplexityCard — Análise Visual de Dificuldade

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+complexidade&labels=docs)

## Visão Geral

O `ComplexityCard.tsx` (`js/render/ComplexityCard.tsx`) é um componente React TypeScript que renderiza a **análise de complexidade** de uma questão de vestibular. Ele recebe os 14 fatores booleanos extraídos pela IA (via [Config IA](/embeddings/config-ia)), calcula um score ponderado de dificuldade, e apresenta visualmente o resultado como um card compacto com barra de progresso, tags de fatores ativos, justificativa, e detalhamento por categoria.

É o único componente que combina **lógica de negócio exportável** (`_calcularComplexidade`) com **renderização visual** — permitindo que tanto o componente React quanto o código legado JS acessem o mesmo algoritmo de cálculo.

## Anatomia Visual do Card

```mermaid
graph TD
    CC[ComplexityCard] --> H[Header: "NÍVEL DE DIFICULDADE"]
    CC --> PB[Barra de Progresso Animada]
    CC --> Tags[Tags de Fatores Ativos]
    CC --> Just[Justificativa em Itálico]
    CC --> Det[Accordion: "VER ANÁLISE DETALHADA"]
    Det --> G1[Grupo: Leitura]
    Det --> G2[Grupo: Conhecimento]
    Det --> G3[Grupo: Raciocínio]
    Det --> G4[Grupo: Operacional]
```

## Algoritmo de Cálculo (`_calcularComplexidade`)

A função `_calcularComplexidade` é o coração do módulo. Ela transforma os 14 fatores booleanos em um score numérico e um nível semafórico:

```typescript
export const _calcularComplexidade = (complexidadeObj: any) => {
  if (!complexidadeObj || !complexidadeObj.fatores) return null;

  const f = complexidadeObj.fatores;
  let somaPesos = 0;

  FATORES_DEF.forEach((item) => {
    // Suporta snake_case E camelCase (interop com dados legacy)
    const camelKey = item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const val = !!pick(f[item.key], f[camelKey], false);
    if (val) somaPesos += item.peso;
  });

  const DENOMINADOR = 30;           // Soma máxima teórica dos pesos
  const score = Math.min(1, somaPesos / DENOMINADOR);
  const pct = Math.round(score * 100);

  let nivel = { texto: 'FÁCIL', cor: 'var(--color-success)' };
  if (score > 0.3) nivel = { texto: 'MÉDIA', cor: 'var(--color-warning)' };
  if (score > 0.6) nivel = { texto: 'DIFÍCIL', cor: 'var(--color-orange-500)' };
  if (score > 0.8) nivel = { texto: 'DESAFIO', cor: 'var(--color-error)' };

  return { score, pct, nivel, itensAtivos, grupos, CFG };
};
```

### Escala de Dificuldade

| Score | Nível | Cor | Significado |
|-------|-------|-----|-------------|
| 0 - 30% | FÁCIL | 🟢 Verde | Questão direta, poucos fatores complicadores |
| 31 - 60% | MÉDIA | 🟡 Amarelo | Requer atenção, 4-8 fatores ativos |
| 61 - 80% | DIFÍCIL | 🟠 Laranja | Múltiplos fatores simultâneos, exige sólida preparação |
| 81 - 100% | DESAFIO | 🔴 Vermelho | Questão de alta performance, 10+ fatores ativos |

### Os 14 Fatores Ponderados

Os fatores são definidos em `js/utils/complexity-data.js` e organizados em 4 categorias:

**📖 Leitura (Peso 1-2)**
| Fator | Peso | Descrição |
|-------|------|-----------|
| `texto_extenso` | 1 | Enunciado muito longo |
| `vocabulario_complexo` | 2 | Termos arcaicos ou técnicos densos |
| `multiplas_fontes_leitura` | 2 | Cruzar Texto 1 × Texto 2 |
| `interpretacao_visual` | 2 | Depende de gráfico/mapa/figura |

**🧠 Conhecimento (Peso 2-3)**
| Fator | Peso | Descrição |
|-------|------|-----------|
| `dependencia_conteudo_externo` | 3 | Resposta não está no enunciado |
| `interdisciplinaridade` | 2 | Cruza 2+ disciplinas |
| `contexto_abstrato` | 2 | Cenários hipotéticos |

**💡 Raciocínio (Peso 2-3)**
| Fator | Peso | Descrição |
|-------|------|-----------|
| `raciocinio_contra_intuitivo` | 3 | Desafia senso comum |
| `abstracao_teorica` | 2 | Conceitos sem representação física |
| `deducao_logica` | 2 | Silogismo ou eliminação |

**⚙️ Operacional (Peso 1-2)**
| Fator | Peso | Descrição |
|-------|------|-----------|
| `resolucao_multiplas_etapas` | 2 | Cadeia sequencial de passos |
| `transformacao_informacao` | 2 | Conversão de formatos/unidades |
| `distratores_semanticos` | 2 | Alternativas-armadilha |
| `analise_nuance_julgamento` | 2 | Escolher a "mais correta" |

O denominador 30 é a soma de todos os pesos, representando uma questão com TODOS os 14 fatores ativos simultaneamente (cenário teórico extremo — na prática, raramente mais de 8-10 são ativados).

## Sub-Componente `GrupoComplexidade`

Cada categoria é renderizada como um grid 2-colunas com indicadores visuais (bolinha colorida se ativo, cinza se inativo):

```tsx
const GrupoComplexidade = ({ catKey, grupos }) => {
  const itens = grupos[catKey];
  const cfg = CFG[catKey]; // { label: "Leitura", color: "#4fc3f7" }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 'bold', color: cfg.color }}>
        {cfg.label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {itens.map(i => (
          <div key={i.key} style={{ opacity: i.ativo ? 1 : 0.6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i.ativo ? cfg.color : '#ddd',
            }} />
            {i.label}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Interoperabilidade snake_case / camelCase

O sistema precisa funcionar com dados de duas origens:
- **API Gemini**: Retorna campos em `snake_case` (`texto_extenso`, `vocabulario_complexo`)
- **Firebase Firestore**: Pode ter sido normalizado para `camelCase` (`textoExtenso`)

O cálculo suporta ambos via regex de conversão:
```typescript
const camelKey = item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const val = !!pick(f[item.key], f[camelKey], false);
```

A função `pick(a, b, fallback)` de `js/utils/pick.js` retorna o primeiro valor truthy entre `a` e `b`, ou `fallback`.

## Onde o Card Aparece

1. **Banco de Questões**: Dentro da seção de resolução de cada card (via [Card Template](/banco/card-template))
2. **Editor de Upload**: Na preview da questão após extração pela IA
3. **Chat**: Quando uma questão é embarcada numa resposta da IA

## Referências Cruzadas

- [Config IA — Define os 14 fatores no schema de gabarito](/embeddings/config-ia)
- [Complexity Data — Definições de pesos e categorias](/utils/complexity-data)
- [Card Template — Renderiza o ComplexityCard no banco](/banco/card-template)
- [Card Partes — renderMatrizComplexidade usa o mesmo cálculo](/banco/card-partes)
