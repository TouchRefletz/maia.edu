# update_manifest.py — Atualização de Manifesto

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+update-manifest.py&labels=docs)

## Visão Geral

O `update_manifest.py` é um utilitário Python que remove entradas específicas do manifesto JSON do dataset HuggingFace. É chamado pelo workflow `delete-artifact.yml` para manter o manifesto sincronizado com os arquivos físicos após deleções.

## Arquivos Relacionados

| Arquivo | Caminho | Papel |
|---------|---------|-------|
| `update_manifest.py` | `.github/scripts/update_manifest.py` | Script de atualização |
| `delete-artifact.yml` | `.github/workflows/delete-artifact.yml` | Workflow que o executa |

## API / Interface Pública

### Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `MANIFEST_PATH` | Sim | Caminho do `manifest.json` |
| `FILENAME` | Não | Arquivo singular para remoção |
| `FILENAMES_JSON` | Não | JSON array de arquivos para remoção batch |

### Exemplo de Uso

```bash
export MANIFEST_PATH="hf_repo/output/enem-2022/manifest.json"
export FILENAMES_JSON='["prova-dia1.pdf", "gabarito-dia1.pdf"]'
python3 update_manifest.py
```

## Detalhamento Técnico

### Lógica de Match

O script usa match flexível comparando os targets contra múltiplos campos:

```python
candidates = [fname, link, link_origem, url_source, path]
for c in candidates:
    # Exact match
    if c in targets: is_match = True
    # Base match (remove prefixo "files/")
    c_base = c.replace("files/", "")
    if c_base in target_bases: is_match = True
```

### Preservação de Estrutura

O manifesto pode ter dois formatos:
1. **Array direto**: `[{item1}, {item2}]`
2. **Wrapper dict**: `{"results": [{item1}]}` ou `{"files": [{item1}]}`

O script detecta automaticamente e preserva a estrutura:

```python
if is_wrapped:
    data["results"] = filtered_items
    final_json = data
else:
    final_json = filtered_items
```

### Output

```
Alvos para remoção (2): ['prova-dia1.pdf', 'gabarito-dia1.pdf']
REMOVENDO entrada do manifesto: prova-dia1.pdf (Match encontrado)
REMOVENDO entrada do manifesto: gabarito-dia1.pdf (Match encontrado)
Total itens antes: 6, depois: 4
```

## Edge Cases e Tratamento de Erros

| Caso | Tratamento |
|------|-----------|
| `MANIFEST_PATH` vazio | `sys.exit(1)` |
| Nenhum target | `sys.exit(0)` gracioso |
| Manifesto inexistente | `sys.exit(1)` |
| `FILENAMES_JSON` malformado | `try/except`, ignora |
| Item sem `filename` | Compara com `link`, `path`, etc. |

## Referências Cruzadas

- [delete-artifact.yml](/infra/delete-artifact) — Workflow que usa este script
- [Deep Search](/infra/deep-search) — Merge de manifestos
