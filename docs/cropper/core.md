# Cropper Core — Orquestrador do Ciclo de Recorte Fotográfico

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Cropper](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+cropper-core&labels=docs)

## 1. Visão Geral e Contexto Histórico

O arquivo `cropper-core.js` (`js/cropper/cropper-core.js`) representa uma das maiores revoluções arquiteturais de refatoração na Maia EDU (a transição da V1 para a V2). Na V1, quando o professor queria digitalizar uma questão de Matemática, ele usava a biblioteca externa nativa em JS puro (Cropper.js), que exigia renderizar uma imagem `<img/>` única e bloquear qualquer outra rolagem de página, forçando os usuários a tirarem 15 Printscreens caso a questão passasse de uma página para outra do PDF. 

Na revolução "Cross-Page Selection" (V2), o `cropper-core` atuou como o matador da dependência engessada. Ele **depreciou** (Deprecated) todos os métodos de instanciamento singular (`instanciarCropper()`) e os substituiu por ponteiros de Overlay flutuante (`initSelectionOverlay`). Assim, o usuário pode começar a desenhar a caixa de seleção na Página 39, segurar o mouse e rolar o scroll infinitamente até a página 40, extraindo as imagens perfeitamente. O arquivo Core é o Cérebro Delegativo: ele não desenha a caixa de seleção CSS (quem faz isso é o Selection Overlay), mas ele diz quando iniciar, quando cancelar, e principalmente: limpa o lixo deixado para trás se o aluno desistir.

---

## 2. Arquitetura de Variáveis e Transições de Máquina de Estado

O arquivo não detém muitas constantes de valor (Strings soltas); ele opera no controle do Global Window State (Contexto Fantasma), que engata e desengata variáveis globais para as outras classes não baterem cabeças.

| Estado/Variável Mutável | Âmbito de Efeito | Natureza Arquitetural | Função Explícita |
|-------------------------|------------------|-----------------------|------------------|
| `window.__isManualPageAdd` | Mutável DOM Global | Flag Boolean | Diz para o resto da renderização pesada em WebGL/Canvas do PDF.js: "Pare de brincar de Zoom, o usuário está cortando agora!". |
| `window.__capturandoImagemFinal` | State Lock O(1) | Flag Boolean | Red-Light. Impede que o botão duplo de disparo seja floodado disparando 50 Fetchs assíncronos ao backend se o usuário tiver "Dedo nervoso" clicando Salvar 5x. |
| `window.__targetSlotIndex` | Delegation Logic | Inteiro (Nullable) | Responsável pelo modo Slot. Se estiver Preenchido = o recorte não vai criar uma questão nova. Ele vai tentar grudar a foto diretamente numa Alternativa A, B ou C solta. |
| `window.__targetSlotContext` | Delegation Logic | String literal | Amarra um conceito. Ex: "image-slot". Ajuda o Fallback a saber o que estava tentando ser editado quando o botão Cancelar ocorreu. |

---

## 3. Diagrama: O Domínio Master-Node UI State Switching

```mermaid
flowchart TD
    ClickBotao([Usuário Clica Ícone da Tesoura]) --> AcaoInicio[Call: iniciarCropper()]
    
    AcaoInicio --> ChamaOverlay[Dispara initSelectionOverlay()]
    Note right of ChamaOverlay: Tela do PDF ganha uma Div 100% z-index 999 
    
    ChamaOverlay --> ClickMouse([Mouse arrasta Tela / Solta Botão])
    ClickMouse --> PuxaCorte[Call: obterImagemDoCropper()]
    
    PuxaCorte --> CallExtrair[extractImageFromSelection()]
    CallExtrair -->|Caixa de 0 pixels ou clique Misfire| FalhaExtr[customAlert: Selecione Area]
    
    CallExtrair -->|Area > 50px de Altura | BlobMemory(Retorna Imagem Nativa Local em Memória/Blob)
    
    BlobMemory --> ProcessaCorte([Sobe o Corte Para Análise Gemini/Pinecone])
    
    AcaoBtnCancel([Aperta Esc ou Clica Cancelar]) --> ActionCancel[Call: cancelarRecorte()]
    
    ActionCancel --> DelegacaoDeCancelar{Esta Cortando Solto ou Pro Slot?}
    DelegacaoDeCancelar -->|Para um Slot Exato| CancelSlot[Delegado para modo Slot: cancelImageSlotMode()]
    
    DelegacaoDeCancelar -->|Normal ou Errado| DeathToll[Limpeza Brutal DOM]
    DeathToll --> RemoveOverlay[Destrói a Div Falsa Focada no Overlay]
    RemoveOverlay --> DestroiTagTemporaria[Se Tinha TAG de Grupo Temporario Vazia -> CropperState.deleteGroup(id)]
    
    DestroiTagTemporaria --> DesbloqueiaScroll[Restaura Mouse Grabbed Pointer CSS]
```

Um comportamento sensível que esse módulo corrige (Refletido no Diagrama) é o "Cleanup de Grupo Fantasma". Se o professor clicar em "Nova Adição", a memória gera um JSON de Questão vazio. Ele desiste via `cancelarRecorte()`. O sistema identifica pelas `tags.includes("NOVO")` que a entidade existia somente para a seleção, e oblitera o ID, limpando a base do RTDB Local de poluição.

---

## 4. Snippets de Código "Deep Dive" (A Arquitetura Oculta do Overlay Injection)

O Módulo antigo manipulava imagens nativas, estourando The Browser Memory Quota. Hoje, o Módulo lida com restrições arquiteturais passivas.

### A Degradação da Ferramenta Legada `Deprecated` 
Abaixo é possível contemplar as cicatrizes da evolução. A Maia.edu propositalmente abandonou os retornos engessados para dar lugar ao Canvas de Múltiplas Folhas:

```javascript
/* cropper-core.js - Cemetery of V1 */

export async function prepararImagemParaCropper() {
  // Deprecated: Não usamos mais 'imagem única' Base64 Canvas Unico
  // Ele limitava o professor a recortar e perder qualidade do PDF renderizado nativamente.
  return null; 
}

export function instanciarCropper(imageElement) {
  // Deprecated: Não importamos mais bibliotecas pesadas terceiras (Cropper.js de 300kb)
  // Todo o engine da Caixa pontilhada é Vanilla JavaScript hoje The Maya Engine.
}
```

### Remoção Mestra de Locks (`restaurarVisualizacaoOriginal()`)

O DOM Document Object Model trava ao engajar Múltipla Ocupação de Ferramentas. Este pedaço de código tem poder despótico de restaurar Scroll Sync e destrancar a API de Pointer Events:

```javascript
export async function restaurarVisualizacaoOriginal() {
  // Remove a matriz SVG de 100% de largura (As divs estúpidas transparentes).
  removeSelectionOverlay();

  // LIMPEZA DE RESTRIÇÃO DE PÁGINA (EMPTY STATE)
  // O Módulo Cropper State permite trancar o foco numa aba. Isso reseta e livra todos as pages.
  CropperState.setPageConstraint(null);

  // Destrói a Root class Css pra soltar sub-regra CSS ex: .manual-crop-active canvas { blur: 2px }
  document.body.classList.remove("manual-crop-active");
  window.__isManualPageAdd = false;

  const container = document.getElementById("canvasContainer");
  if (container) {
    container.style.overflow = ""; // Libera a Rodinha do Mouse
    // Restaura Multi-Touch Mobile para Pinch-Zoom que o Canvas do Cropper tomou roubado.
    container.style.touchAction = ""; 
    container.style.userSelect = "";
    container.style.cursor = "grab"; // Restaura cursor da Mãozinha de Pan
  }

  // FIX Anti-Zombie: Destranca o header explicitamente caso a classe CSS demore pra Repaint do Hardware Accelaration Browser
  const header = document.getElementById("viewerHeader");
  if (header) {
    header.style.pointerEvents = "auto";
  }
}
```

---

## 5. Integrações de Fluxo Exótico e Slot Mode Architecture

Note que o método `cancelarRecorte()` demonstra uma premissa de arquitetura reativa avançada em JS Vanilla (Não-React).

```javascript
export function cancelarRecorte() {
  // 0. Delegate Slot Mode safely (Preserva Dados Existentes num Edit-Cancel Abort)
  if (window.__targetSlotContext === "image-slot") {
     // Usa Top-Level Await Nativo (Dynamic Import) pra poupar bundle inicial de JavaScript pesado.
    import("./mode.js").then((mod) => mod.cancelImageSlotMode());
    return; // Para tudo e obedece o Módulo Mode.
  }

  /* ... */
}
```
Isso economiza pacotes de Bundle. O `cancelarRecorte` raramente será acionado em Slot Modes (Pessoas que desistem de editar *Alternativas A e B e C* localizadas). Em arquiteturas Monóliticas, o `import` global sugaria memória desde o começo do Refresh (F5). Colocar um `import("./mode.js")` enjaulado *late loading* aumenta a pontuação LightHouse Performance WebVitals da plataforma.

---

## 6. Identificando Vulnerabilidades e Exceções Lógicas Adicionais

Se o sistema é tão intrincado com manipulação Global de Window (Janelas), o que ocorre quando as chaves Window não desvencilham ou bugam no meio de Exceptions atiradas pelo Cloudflare?

| Causa Primária da Exceção Edge | Procedimento Oculto no Core Cropper | Sintomas (O que ocorre sem Pânico) |
|--------------------------------|-------------------------------------|------------------------------------|
| **Mis-Click do Lado De Fora da Página PDF** | A função Extratora é chamada sobre Coordenadas ZeroX Zero Y em `obterImagemDoCropper()`. `BlobUrl` falha silenciosamente e devolve Nulo. | A interface emite o erro simpático _"Selecione uma Área Primeiro!"_, ao invés de atirar um erro vermelho Null Pointer TypeError na tela do celular do Estudante, blindando-o do "Freeze Morto". |
| **Abandono Repentino em Novo Grupo** | Professor clicou Extrator Nova Questão e antes de atirar no Envio Firebase, foi pro Hub e a Máquina destruiu The Main Context. O CropperCore tenta achar esse grupo e excluí-lo no RTDB Array. | Evita a "Epidemia Zumbi" no Firebase Array. O sistema rastreia tags `["NOVO", "slot-mode"]` em `CropperState.deleteGroup(id)`. Deixando as bases de dados enxutas impedindo Custos Extras IBD GCP Cloud. |

---

## 7. Referências Cruzadas Completas

A complexidade escalar atirada do Core afeta Módulos Operacionais Inteiros de Imagem. Conheça as continuações ramificadas:

- [Overlay de Seleção Cruzada Múltipla Plataforma — Como as Caixas Div pontilhadas são pintadas no ecrã (O Braço Direito Desse Módulo Core Pai).](/cropper/overlay)
- [Estado Global do Cortador (`state.js`) — Módulo de Onde Retiramos the IDs Temporários para limpar lixeiras nos Aborts.](/cropper/state)
- [Envio Local Firebase (`envio.js`) — A Interface Onde The Output Extracted desse arquivo Bate Final após Envio Form e Salva Firebase e RDTB.](/firebase/envio)
- [Render Contexto (`render-components.js`) — Modulo UI de Onde o Botão de Cancelar originou essa Lógica Root.](/render/render-components)
