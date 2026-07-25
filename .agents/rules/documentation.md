# Regra de Sincronização e Manutenção de Documentação

Esta regra se aplica obrigatoriamente a qualquer desenvolvimento, edição, refatoração ou adição de código neste repositório (`maia.api`).

## Instruções Obrigatórias para o Assistente de IA:

1. **Análise Obrigatória da Documentação**:
   - Antes e durante o planejamento de qualquer alteração relevante no código, analise os arquivos correspondentes em `docs/` e a configuração do nav/sidebar em `docs/.vitepress/config.js`.

2. **Sincronização Ativa em Grandes Mudanças**:
   - Em qualquer grande mudança no código (ex.: novos endpoints na API Worker, novos provedores de IA como Groq/Vertex, novos componentes UI/Render, alterações no Chat/Prompting/Memória, suporte a novos temas CSS/Design Tokens como Modo Claro, atualizações em linters/Biome/SonarQube ou correções estruturais de persistência/Firestore):
     - **Atualizar**: Modifique imediatamente os arquivos em `docs/` afetados para refletir com exatidão a implementação real.
     - **Criar**: Caso um novo módulo, handler, utilitário, linter ou componente seja criado, crie o respetivo arquivo `.md` técnico em `docs/`.
     - **Navegação**: Registre qualquer novo arquivo `.md` no sidebar global em `docs/.vitepress/config.js`.

3. **Padrão de Qualidade e Proibição de Placeholders**:
   - NUNCA crie ou mantenha arquivos stubs/placeholders (arquivos pequenos com avisos genéricos "Página de documentação para..."), marcações `TODO`/`FIXME`, seções vazias ou escapes Unicode corrompidos (`u{...}`).
   - Toda página de documentação deve conter:
     - Visão Geral detalhada e contexto arquitetural.
     - Tabela de parâmetros, métodos, props ou endpoints.
     - Exemplos reais de uso e payloads de código.
     - Diagramas Mermaid explicativos (sempre que a lógica for de fluxo ou componentes).
     - Referências cruzadas válidas no ecossistema VitePress.

4. **Manutenção do Ecossistema**:
   - A documentação é parte viva do código e deve evoluir simultaneamente a ele. Nenhuma funcionalidade é considerada concluída sem a respectiva documentação atualizada.
