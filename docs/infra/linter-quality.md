# Ferramental de Qualidade de Código — Biome & SonarQube (`docs/infra/linter-quality.md`)

O repositório **maia.api** adota padrões modernos e automatizados de linting, formatação e verificação estática de código.

---

## ⚡ Biome JS (`biome.json`)

O **Biome** substitui o ESLint/Prettier com uma engine em Rust extremamente rápida.

### Comandos de Uso

```bash
# Verificar e corrigir automaticamente formatação e linting nos arquivos
npx biome check --write <caminho_dos_arquivos>

# Exemplo: aplicar em todos os arquivos em docs/ e js/
npx biome check --write docs/ js/
```

### Configurações (`biome.json`)
- Indentação de 2 espaços.
- Aspas simples (`'`) para JavaScript/TypeScript.
- Regra obrigatória executada via regra de IA em `.agents/rules/quality.md`.

---

## 🔍 SonarQube (`sonar-project.properties`)

Utilizado para análise estática contínua de segurança, duplicidade e manutenibilidade.

```bash
# Executar análise estática do Sonar
npm run sonar
```

---

## 🔗 Referências Cruzadas
- [Regras do Agente - Qualidade](file:///c:/Users/jcamp/Downloads/maia.api/.agents/rules/quality.md)
- [Visão Geral de Infraestrutura](/infra/visao-geral)
