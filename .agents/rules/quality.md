# Regra de Qualidade de Código (Biome & SonarQube)

Esta regra se aplica obrigatoriamente a qualquer desenvolvimento, edição ou refatoração neste repositório.

## Instruções para o Assistente de IA:
1. **Verificação com Biome por Arquivo**: Antes de concluir qualquer tarefa ou alterar arquivos de código, execute obrigatoriamente `npx biome check --write <caminho_dos_arquivos_modificados>` no terminal para garantir formatação e linting perfeitos dos arquivos alterados.
2. **Correção Automática de Formatação**: Sempre aplique a sinalização `--write` para corrigir automaticamente problemas de espaçamento, estilo e sintaxe.
3. **Padrão de Código**: Mantenha o código limpo, sem imports não utilizados, seguindo as diretrizes descritas no `sonar-project.properties` e no `biome.json`.
