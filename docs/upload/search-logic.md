# Search Logic — O Motor de Busca Profunda (Deep Search)

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+search-logic&labels=docs)

## Visão Geral

O arquivo `search-logic.js` (`js/upload/search-logic.js`) é indiscutivelmente um dos maiores e mais complexos controladores (Controllers) da aplicação cliente da Maia. Com mais de 1.700 linhas, ele não cuida de botões genéricos: este arquivo orquestra o **Workflow do Agente Baseado em Tarefas**.

Quando um usuário digita *"Provas de Física ITA 2023"* no Input da Home (`#searchInput`), é o Search Logic que dispara Requisições de Inicialização na Cloudflare, intercepta a criação de instâncias de máquinas no exterior (GitHub Actions Runner / Docker), gerencia conflitos de estado de Redes, desenha Cards na tela e salva o estado no Cache Local.

## Preflight e "Exact Match" (O Bypass)

Um agente de busca (`OpenHands`) consome muito recurso da nuvem (5 a 10 centavos de Dólar por pesquisa extensa). 

O módulo reduz isso à zero adotando Padrão Preflight:
```javascript
const response = await fetch(`${PROD_WORKER_URL}/trigger-deep-search`, {
  method: "POST",
  body: JSON.stringify({ query, confirm: false }), // NÃO GIRE O DOCKER!
});
```

A Edge API analisa o token *"Física ITA"* gerando um `canonical_slug` (`fisica-ita-2023`). Se o Repositório da Inteligência Coletiva (Hugging Face) possuir o arquivo exato `huggingface.co/.../fisica-ita-2023/manifest.json`, o Servidor responde com flag `exact_match`.

O Frontend então encerra e **bypassa** a Inteligência Arbitrária, chamando a função local `loadResults()` para printar arquivos prementes instantaneamente na HUD do Usuário, simulando um Database ultrarápido.

## Modo de Atualização ("Add More" e Retry)

Há pastas no repositório que são criadas apenas quando um Usuário envia *manualmente* um PDF do computador pela tela secundária (o Upload Normal). 
O `checkAndAutoUpgrade()` monitora agressivamente o `manifest.json`. 

Se o Usuário pede *"Prova do ENEM"*, e reparamos que todos os itens no banco contêm a flag `link_origem === "manual-upload"`, isso indica uma estrutura "Manca" gerada por um Humano. Nós automaticamente ativamos o **MODO UPDATE** (`mode: "update"`). 
Este modo envoca uma Recursão de busca, onde subimos a Máquina Virtual de IA para procurar os Gabaritos ou Mídias faltantes, mesclando-os assincronamente à pasta sem perder a Prova PDF já contida lá!

## O Terminal Overlay Global (Window Docking)

Mesclado intimamente ao componente `TerminalUI`, o `search-logic.js` lida com a mobilidade da tela. Se o terminal do Agente de Pesquisa demorar 4 minutos (Padrão) as pessoas desistem da aba. 

Se o Professor navega voltando para `Home` (`bt-voltar-inicio`), esse módulo acorda o comando de repacting de DOM:
```javascript
terminalInstance.setFloatMode(true);
wrapper.appendChild(terminalInstance.container);
wrapper.style.display = "block";
```
A janela terminal se desprende do *Search Results Container*, torna-se um Float Action Element (Bolha flutuante transparente) com barra de loading circular verde e persegue o Usuário. Ao finalizar, ela vibra.

## Conflitos Semânticos

Se um Upload Humano possui uma variação parecida de arquivo já na Nuvem, o motor pausa toda Ingestão de API e pinta um React-less Component (Gerado com HTML template strings brutas do `showConflictResolutionModal`) exibindo duas colunas: "☁️ Na Nuvem" vs "📂 Seu Upload".

Isso obriga a aprovação de mesclagem ou troca de Fonte de Verdade da Arquitetura Caching, impedindo lixo binário no GitHub LFS / HuggingFace Repos.

## Referências Cruzadas

- [Terminal UI — O terminal retro forjado que imprime os resultados físicos](/upload/terminal-ui)
- [Form Logic — O Arquivo que invoca os modais de Merge deste controlador](/upload/form-logic)
- [Chat Input — A barra inicial que acidentalmente e indiretamente aciona essa arquitetura de busca](/chat/chat-input)
