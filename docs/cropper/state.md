# Cropper State Management — Memória de Seleção Fotográfica O(1)

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Cropper State](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+cropper-state&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `cropper-state.js` (`js/cropper/cropper-state.js`) soluciona o problema mais frustrante herdado das tecnologias legadas de Canvas (V1): A perda iminente do progresso. Quando o professor estava selecionando a Questão 35, e o mouse escorregava ou ele apertava "Esc" acidentalmente, toda a folha perdia o mapeamento, forçando a re-seleção exaustiva.

Neste upgrade (V2), o módulo não atua como componente, ele **É** um Banco de Dados na Memória (`In-Memory Vector DB`). Ele implementa puramente em Vanilla Javascript (Sem dependências de Redux ou Zustand) um robusto "Undo/Redo Stack" Limitado, além de gerenciar a Árvore de Recortes (Crops). Cada recorte não é mais uma imagem Base64 isolada; agora eles são Objetos Semânticos aninhados em "Grupos". Uma Questão Gigante com textos e 5 alternativas em páginas distintas são fundidos logicamente aqui, ganhando etiquetas de status, tags e uma paleta de cores consistente para a UI reagir instantaneamente.

---

## 2. Arquitetura de Variáveis e State Management (O Motor Redux Vanilla)

A essência da reatividade em Vue/React muitas vezes ignora The Raw Window object. A Maia o doma via Closures e Proxy Pattern leve.

| Categoria / Variável Pai | Atributo / Natureza | Função Explícita Pelo Negócio |
|--------------------------|---------------------|-------------------------------|
| `groups` | `Array<Group>` | A Tabela-Pai. Um Grupo representa "Uma Questão de Prova Inteira" contendo seu Label, seu ID (`externalId` match com IA) e a array dos filhos fotográficos (`crops = []`). |
| `activeGroupId` | `Integer Index Pointer` | Foco O(1). O The Hub e a Sidebar reagem se a aba ativa no momento bate com esse cara. Destravar isso destrava as telas. |
| `historyStack` | `Array<Snapshot>` | O Desfazedor. Salva cópias profundas cegas (`JSON.parse(Stringify)`) para permitir Control+Z do usuário. O `maxHistorySize: 50` protege a sanidade da RAM de explodir. |
| `colorPalette` | `Array[16] Hex Codes` | Material Design Engine. O Array confere que a Questão 1 será Ciano, enquanto a 13 será Laranja Forte, provendo ao usuário um Contraste Cognitivo brutal para diferenciar recortes colados. |

---

## 3. Diagrama: O Ciclo de Edição e Restauração Topológica

O fluxo lida fortemente com preempção: O que ocorre ANTES de um Crop ser inserido.

```mermaid
flowchart TD
    InitMode([Aperta Botão de Nova Questão]) --> StateCreate[Call: createGroup({tags: 'manual'})]
    
    StateCreate --> SetActive[setActiveGroup(id)]
    SetActive --> SalvaSnapshotInicial[Call: saveEditingSnapshot()]
    
    SalvaSnapshotInicial --> UserFezRecorte([Ferramenta Selecionou Área PDF])
    UserFezRecorte --> EnviaArray[Call: addCropToActiveGroup(CropData)]
    
    EnviaArray --> SaveHistory[Call: saveHistory() - Pilha Avança]
    SaveHistory --> SlotLogic{Slot-Mode O(1) Check?}
    
    SlotLogic -->|Yep! É um Recorte pra Letra B| UniCrop[Apaga o Crop passado e Bota o novo: Single Element Force]
    SlotLogic -->|Nope| Append[Push pro final do Array do Grupo. Group = 2 imagens]
    
    Append --> StateNotify((Dispara This.Notify Todos Observers))
    UniCrop --> StateNotify
    
    AcaoControlZ([Ação UNDO Pressionada]) --> PopHistory[Abre e Inverte Pilha]
    PopHistory --> RestauraMemoria[_restoreSnapshot]
    RestauraMemoria --> StateNotify
    
    AcaoEsc([Ação de CANCELAMENTO TOTAL]) --> RevertFull[Call: revert() ou destroy_Group(Id)]
```

Esse mapeamento do comportamento "Slot-Mode" expõe The Unique Constraint. Se o Professor está cortando apenas uma Alternativa única ("Letra A da Unicamp"), o Estado joga fora a foto antiga silenciosamente quando ele arrasta Caixa em outro lugar. Isso não enche o BD de sujeira invisível.

---

## 4. Snippets de Código "Deep Dive" (Reatividade Pura e Deep Cloning Engine)

### A Reatividade Pobre-Homem (Observer Pattern Desacoplado)

Como avisar o React ou o Sidebar Vanilla que um novo Retângulo Quadrado Laranja invadiu a Página 5 do Canvas sem atrelar a dependência?

```javascript
/* O Notificador emcropper-state.js */
export const CropperState = {
  listeners: [],
  
  // O React Component do Hub faz Subscribe no Mount
  subscribe(callback) {
    this.listeners.push(callback);
    // Retorna a função Lamba de Unmount CleanUp do Hook (The React Way)
    return () => (this.listeners = this.listeners.filter((cb) => cb !== callback));
  },

  // Sempre que houver uma mutação pesada (Push History, Save Group)
  notify() {
    this.listeners.forEach((cb) => cb(this));
  }
}
```

### O Desacoplador Visual de Cores (Fallback Estético)

Atribuir cores randômicas num Array gigante de recortes confunde os humanos. O HashMap abaixo cruza IDs de IA (`external_12`) com Posição Estrita.

```javascript
  getGroupColor(group) {
    if (!group) return "#00BCD4"; // Ciano Padrão Failsafe

    // The Slot Mode Highlight - Uma Sub-alternativa de Vestibular ganha The Pink Neon
    if (group.tags && group.tags.includes("slot-mode")) return "#ff00f2ff"; 

    // Alinhamento AI-External Matcher
    let index = 0;
    if (group.externalId && /^\d+$/.test(group.externalId)) {
       // A IA achou a questão "06". Fixamos nela pra não trocar cor entre Reloads
      index = parseInt(group.externalId, 10);
    } else {
       // Criado a mão crua, pega o The Incremental ID Nativo
      index = group.id;
    }

    if (index > 0) index = index - 1; // Array Index Fix
    return this.colorPalette[index % this.colorPalette.length];
  }
```

### O Engine de Cancelamento Rígido Undo (Deep Array Snapshots)

Tocar nos nós complexos gera *Reference By Pointer Bugs*. O JavaScript puro nos obriga a matar The Pointer Object Arrays usando Serialize.

```javascript
  saveHistory() {
    // 1. Snapshot cego que serializa the Objects
    const snapshot = {
      groups: JSON.parse(JSON.stringify(this.groups)), // O Motor Hard-Copy
      activeGroupId: this.activeGroupId,
      nextId: this.nextId,
    };
    
    // 2. Empurra pra Pilha
    this.historyStack.push(snapshot);

    // 3. Garante Que Não Tomamos Out-of-Memory JVM/V8 Engine Crash 
    // Com PDF Lodosos que exigem dezenas de recortes
    if (this.historyStack.length > this.maxHistorySize) {
      this.historyStack.shift(); 
    }

    // 4. Limpa O Redo porque nova branch cronológica foi criada
    this.redoStack = [];
  }
```

---

## 5. Integração Com O Ambiente Canvas (Constraints)

O módulo trava um sistema de restrição (`pageConstraint`).

Se um grupo de foto nasce atrelado à **PageNum 21**, the State Machine levanta a tag. O Selection Overlay não deixará que o Rectângulo seja forçosamente jogado na Página 22 pra prevenir corrupção lógica do Algorítmo OCR nativo que mapeia `PDF coordinates x/y`.

```javascript
/* Em state.js - the Restrictor Flag */
setPageConstraint(pageNum) {
  this.pageConstraint = pageNum ? { pageNum } : null;
}
```
O Engine PDF Lê essa chave passiva.

---

## 6. Mapeamento Psicológico de Edge Cases Locais da Estrutura

| Anomalia | Gatilho Frontal | Tratativa Híbrida em State |
|----------|-----------------|----------------------------|
| IDs Textuais no Módulo Extrator Externo (ex: `"05"`) | O Firebase ou VDB Pinecone podem mandar "05" como the External_Id em vez de The Int `5`. | A Helper Function dentro da State (`normalize`) roda expressão Regular `/^\d+$/` e obriga a conversão sem letargia. The Match Funciona, impedindo a sobreposição cega e bug das Cores. |
| Remoção de Grupo Baseado em Visão Zumbi | Professor quer limpar a tela 13 de todos os Crops rascunho. | A função Custom `removeGroupsByPageAndStatus(pageNum, status)` itera a Array the Crops[0] e identifica sua Anchoring Page, limpando sumariamente tudo duma vez O(n). Acopla no Lifecycle React UI Notifier. |
| Undoes Infinitos | Usuário põe um peso no Control Z. | O `this.historyStack.length === 0` e o `maxHistorySize = 50` engolem O comando silenciosamente, poupando CPU usage sem causar stack overflow exceptions no Console. |

---

## 7. Referências Cruzadas Completas

A Doutrina Global the Array Management do Cropper envia tentáculos nervosos para toda a UI the Image Generation:

- [Selection Overlay (Desenhista) — Braço Mecânico cego que atira os Hashs de Array e Coordenadas Rect dentro dos Loops Mapeados neste Module.](/cropper/overlay)
- [SideBar Viewer (Puxador) — React/Vue que puxa as Cores Mapeadas Pallete Hash deste the Objeto local para gerar a Barra lateral interativa "Questão Rosa / Verde".](/pdf/sidebar-desktop)
- [Cropper Core (Orquestrador) — Que Aciona the Delete Modes caso The Pipeline de Salvar cancele pela Metade.](/cropper/core)
- [Modo Slot Lógico (`mode.js`) — Modulo the Comportamentos The Constraints (Ex: Forçar Single Crop Arrays the Letras).](/cropper/mode)
