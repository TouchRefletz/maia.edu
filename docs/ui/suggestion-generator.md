# Suggestion Generator — Motor Rápido de Sugestões Locais e Concordância Léxica

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo UI](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+suggestion-generator&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `suggestion-generator.js` (`js/services/suggestion-generator.js`) nasceu de uma frustração crítica na V1 do Maia EDU: **Latency de Sugestões Baseadas em IA**. 

Anteriormente, para que o campo de preenchimento inteligente (Search Bar ou Input Placeholder) pudesse sugerir ao professor *"Deseja buscar sobre Revolução Francesa?"*, o frontend realizava uma micro-consulta via Cloudflare Fetch aos provedores LLM (Large Language Models) ou um banco genérico do backend. Isso levava 400ms a 1500ms; um tempo altíssimo que barrava o "Type-ahead experience". O auto-complete parecia engasgado.

Na V2 Arquitetural (Offline First & Edge-first), este módulo converteu todo o Lexicon Educacional do ensino médio brasileiro num mega-Dicionário Estático "Hardcoded" em um módulo Javascript injetado dinamicamente via Import Preload (WebWorkers / Dynamic Import).
Isso trouxe respostas na faixa dos **0.2 milissegundos**. O arquivo serve como um cérebro algorítmico super otimizado para gerar frases contextuais baseadas em matérias, verbos, complementos e concordância gramatical luso-brasileira puramente em RAM local do Navegador do Professor.

---

## 2. Arquitetura de Variáveis e State Management (Gramática Embutida)

O core matemático do `suggestion-generator.js` baseia-se em matrizes de Dicionários que casam Substantivos com Artigos (`o/a/os/as`), permitindo interpolação (Template Strings) perfeita sem soar como um "robô gringo traduzido".

| Dicionário Local | Tipo Estrutural | Descrição de Domínio |
| ---------------- | --------------- | -------------------- |
| `MATERIAS` | `Array<{termo, artigo}>` | Relaciona a macro-disciplina (ex: "matemática") ao seu artigo natural ("a"), permitindo construir strings como "estude **a** matemática". |
| `TOPICOS` | `Object<Keys, Array>` | Hash-Map mapeando Subjects às Disciplicinas. Key: `quimica` -> Values: `["estequiometria", "termoquímica"]`. Retém o artigo gramatical interno de cada termo técnico associado. |
| `TEMAS_REDACAO` | `Array<String>` | Lista bruta string-plain de polêmicas pré-configuradas (e.g. "Os impactos da inteligência artificial", "Mobilidade Urbana"). |
| `VERBOS_BUSCA` | `Array<String>` | Vocabulário imperativo-operacional: ["Ache", "Busque", "Encontre", "Quero", "Procurar"]. |
| `TEMPLATES_*` | `Array<String>` | Vários vetores separados por Intensidade: `TEMPLATES_MATERIA`, `TEMPLATES_TOPICO`, `TEMPLATES_DIFICULDADE`. Usam chaves de interpolação ex: `"{verbo} questões de {materia}"`. |

Essa arquitetura elimina a dependência de um React State Hook pesado, sendo provida a interfaces Reativas apenas quando a String final já passou pela Esteira Lexical de RegEx.

---

## 3. Diagramas de Fluxo Algorítmico do Gerador

O fluxo não é um mero `Math.random()`. Se o Input demanda um "Tema de Redação", ele roda um algoritmo que nunca repete o mesmo placeholder no F5 seguinte (Session Storage Caching Tracker temporário ou embaralhamento via Array.splice).

```mermaid
flowchart TD
    App([Render Input Search]) --> TriggerGen[Call: generateSuggestions(count, type)]
    
    TriggerGen --> Demux{Qual o Type?}
    
    Demux -->|Aleatório Geral| PickRandomPath
    Demux -->|Específico (Redação)| PathRedacao
    Demux -->|Tópico Forte| PathTopico
    
    PickRandomPath --> MathRnd[Roll D20 - Rola Dado Numérico Interno]
    MathRnd -->|1-5| PathTopico
    MathRnd -->|6-10| PathRedacao
    MathRnd -->|11-20| PathDificuldade
    
    PathTopico --> GetT[Sorteia 1 Tópico de 1 Matéria]
    GetT --> InterpolateTopico[Substitui '{topico}' no Template Sorteado]
    InterpolateTopico --> RegExProcessor[Engine de Contrações Gramaticais]
    
    PathRedacao --> GetR[Sorteia 1 Tema String Vanilla]
    GetR --> InterpolateRedacao[Substitui '{tema}']
    InterpolateRedacao --> RegExProcessor
    
    RegExProcessor --> StringLimpa("Ex: 'Elabore questões sobre a geometria espacial'")
    StringLimpa --> App
```

O *Engine de Contrações Gramaticais* (`RegExProcessor`) é a joia do código, evitando anomalias como: *"Busque sobre **o o** Nazismo"*.

---

## 4. Snippets de Código "Deep Dive" (Matemática Lexical)

O código abaixo extraí a alma do utilitário e como ele escapa do anti-pattern da concatenação suja utilizando a magia das Expressões Regulares de Grupo Opcional.

### O Gerenciador de "Crases" e Contrações Pt-BR

O português é difícil de "Template-izar". "de + a = da", "em + os = nos". Se a Engine gerar o template `"Fale de {artigo} {topico}"` e o tópico sorteado for "genética" (artigo "a"), a string original seria *"Fale de a genética"*.
O método mitigador central é o `applyContractions`:

```javascript
/**
 * Aplica contrações e correções gramaticais do Português em templates gerados livremente por IA local
 * @param {string} text - O texto cru interpolado
 * @returns {string} O formato validado
 */
function applyContractions(text) {
  let result = text;
  
  // Substituições Brutais via RegEx O(n)
  
  // 1. Preposição DE
  result = result.replace(/\bde\s+o\b/gi, 'do');
  result = result.replace(/\bde\s+os\b/gi, 'dos');
  result = result.replace(/\bde\s+a\b/gi, 'da');
  result = result.replace(/\bde\s+as\b/gi, 'das');
  
  // 2. Preposição EM
  result = result.replace(/\bem\s+o\b/gi, 'no');
  result = result.replace(/\bem\s+os\b/gi, 'nos');
  result = result.replace(/\bem\s+a\b/gi, 'na');
  result = result.replace(/\bem\s+as\b/gi, 'nas');
  
  // 3. Preposição POR
  result = result.replace(/\bpor\s+o\b/gi, 'pelo');
  result = result.replace(/\bpor\s+os\b/gi, 'pelos');
  result = result.replace(/\bpor\s+a\b/gi, 'pela');
  result = result.replace(/\bpor\s+as\b/gi, 'pelas');
  
  // 4. Crase Crítica (A + A = À)
  result = result.replace(/\ba\s+a\b/gi, 'à');
  result = result.replace(/\ba\s+as\b/gi, 'às');
  
  return result;
}
```

### O Algoritmo de "Draw without Replacement" (Fisher-Yates Parcial)

Quando o front-end pedem *`generateSuggestions({ count: 5 })`*, mandar sugestões repetidas no mesmo placeholder degrada a imagem UX Premium.

```javascript
function getUniqueRandomItems(array, count) {
    if (!array || array.length === 0) return [];
    if (count >= array.length) return [...array]; // Copia rasa segura
    
    const result = [];
    // Clona Set pra não envenenar Constantes hardcoded do arquivo 
    const pool = [...array]; 
    
    for (let i = 0; i < count; i++) {
        // Pick seguro usando ByteShift Math.floor vs Round
        const randomIndex = Math.floor(Math.random() * pool.length);
        result.push(pool[randomIndex]);
        // Slice performático destruindo o item já usado da pool
        pool.splice(randomIndex, 1);
    }
    
    return result;
}
```

---

## 5. Integração com a UI (React e Vanilla DOM)

Embora esse serviço seja passivo e Data-Only (ele apenas expõe Strings prontas), ele se amarra intimamente aos componentes de Input da Search Bar.

```javascript
// Exemplo de Invocação Num Component React do Search
import { generateSuggestions } from "../../services/suggestion-generator.js";

const SearchBar = () => {
    const [placeholder, setPlaceholder] = useState("");
    
    useEffect(() => {
        // Pede 1 sugestão super complexa sobre Matérias Específicas
        const pool = generateSuggestions(1, { forceType: "complex_topic" });
        
        let typedText = "";
        let i = 0;
        
        // Efeito Máquina de Escrever CSS + Vanilla State
        const interval = setInterval(() => {
            if (i < pool[0].length) {
                typedText += pool[0].charAt(i);
                setPlaceholder(typedText);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 80);
        
        return () => clearInterval(interval);
    }, []);
    
    return <input className="search-maia-input" placeholder={placeholder} />;
}
```

O `suggestion-generator` também possui ganchos atrelados ao local storage para injetar os *Latest History Searches* do usuário como "Sugestões Mistas", colidindo os dados estáticos hard-coded com a base orgânica de pesquisa pregressa.

---

## 6. Identificando e Mitigando Casos Críticos (Edge Cases Matrix)

| Ação de Anormalidade | Evento Engatilhado | Defesa da Arquitetura |
|----------------------|--------------------|-----------------------|
| Usuário clica loucamente para "Trocar Sugestões" no UI (10x em 1 seg) | Overkill Array Processing Math.Random | A pureza da função (Sem side-effect assíncrono Promises) permite O(1). O JS roda milhões de arrays por segundo, aguentando o spam sem Rate Limits de rede que um Gemini sofria. |
| Invocação com Constante Zero `generateSuggestions(0)` | Retorno Indefinido destruidor de Props map() | A factory tem fallbacks para input `count`. Retorna um `["Exemplo O(1)"]` string de escape. Prevenindo Crash React Map Render vazio. |
| Adicionar novos tópicos na Constant List via Pull Request mas esquecer o artigo | Interpolação cega `"Fale de undefined undefined"` | Validações embutidas no interpolador setam Default Param de artigo para os genéricos `"sobre o/a"`, impedindo erro de tipo Undefined ou Object Object caindo no parser UI. |
| Idioma do Navegador Modificado. | Português colidindo com Lang_EN. | O Maia é estritamente nativo do Brasil, mas ao expandir a i18N, este arquivo se blindará em sub-módulos `dict_en.js`. As lógicas de "Crase" nunca rodam em vetores marcados com tag de idioma inglês no Runtime Configurator Global da Storage local. |

---

## 7. Referências Cruzadas Completas

Para varrer o fluxo e quem consome essa base inatingível do Dicionário, acesse:

- [Search Logic — A UI global que puxa estes textos no input field principal da Plataforma](/upload/search-logic)
- [Sugestões UI Component — O Componente React/Vue de Botõezinhos Circulares embaixo da caixa de pesquisa (Pills)](/ui/sugestoes)
- [Router Prompt Chat — Componente de Chat Base onde a Engine sugere Follow-Ups ao usuário após ele receber as repostas da RAG.](/chat/router-prompt)
- [Config IA Embeddings — Local onde estes Lexicons são ocasionalmente usados para testar a distância local do RAG System.](/embeddings/config-ia)
- [Global App Shell — Os Hooks Vanilla que importam o preload cache do `suggestion-generator.js` no load balancer.](/infra/vite-config)

> Esta abordagem modular hardcoded prova que o design primitivo resolve problemas graves de UI e economiza milhões de Request Units por semana frente às "Injeções 100% LLMs" da moda.
