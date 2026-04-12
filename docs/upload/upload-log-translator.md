# Upload Log Translator — Pareador de Porcentagem do Upload Local

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+upload-log&labels=docs)

## Visão Geral

O módulo `upload-log-translator.js` (`js/upload/upload-log-translator.js`) atua como um primo do LogTranslator focado exclusivamente no **Pipeline de Arquivos** gerado inicialmente pela aba "Upload". Encarregado de traduzir a sincronização crua entre a API do Pusher e o Form Logic, este arquivo não só injeta a humanização da String, como *Hard-Codes* (fixo em código) os valores percentuais da barra de progresso do Modal Central flutuante (`div#upload-progress-modal`).

Esta camada garante previsibilidade matemática no Front-End: sempre que o backend diz que o Hash foi validado, a interface **sabe** que o sistema pulou matematicamente de 20% para 25%.

## Padrão Estrutural: A Injeção de "Percent"

Diferente do Translator clássico que foca na narrativa de Terminal (com cores e "Types"), este foca em uma interface limpa, devolvendo Structs pareados `{ percent: Number, text: String }`. O Modal Progress Bar engole as propriedades e aciona transições polidas.

A divisão técnica é feita em três estágios operacionais de Deploy.

### Estágio 1: HASH & PRE-PROCESS (0-33%)
O momento crítico onde a integridade local choca com a Nuvem.
```javascript
if (msg.includes("Solicitando cálculo de hash"))
   return { percent: 20, text: "Verificando integridade e duplicidade..." };
```
Aqui o código avança incrementalmente a cada passo detectado pelo TmpFiles (Hash Prova, Hash Gabarito, Análise Visual).

### Estágio 2: WORKER & AI (33-66%)
Um "Vale Negro" na usabilidade. A Cloudflare já transferiu os bytes, mas a Google precisa autorizar tokens e recursos no Gemini, abrindo o canal Realtime (`Pusher`).
```javascript
if (msg.includes("Subscribing to Pusher"))
   return { percent: 65, text: "Conectado. Aguardando sincronização..." };
```

### Estágio 3: CLOUD SYNC (66-95%)
A etapa densa do Hugging Face. Clonar o dataset de 5GB, empurrar os novos nós da árvore e limpar o histórico.
```javascript
if (msg.includes("Resolve collisions"))
   return { text: "Resolvendo conflito de nomes automaticamente..." }; 
   // Note: Sem "percent" altera apenas a narrativa visual sem empurrar a barra!
```

E enfim o gatilho glorioso: Se ler `"Cloud sync complete"`, a tradução injeta `{ percent: 100 }`, mandando o FrontEnd estourar a verificação e injetar de modo agressivo o Modal do PDF View Renderer por cima da janela preta, livrando o docente de um estado de Looping.

## Referências Cruzadas

- [Form Logic — O Orquestrador primário que aciona essas traduções em seu interior](/upload/form-logic)
- [Log Translator — Módulo complementar voltado ao OpenHands e não ao File Upload Base](/upload/log-translator)
- [Pdf Renderers — Como o PDF.js interage ao batermos os 100% desta tradução](/ui/pdf-renderers)
