# vite.config.js — Configuração do Vite

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+vite-config&labels=docs)

## Visão Geral

O `vite.config.js` configura o bundler Vite para o frontend da plataforma maia.edu. Gerencia plugins (React), estratégia de chunking, proxy de desenvolvimento, e prefixos de variáveis de ambiente.

## Arquivo

| Arquivo | Caminho |
|---------|---------|
| `vite.config.js` | Raiz do projeto |

## Detalhamento Técnico

### Plugins

```javascript
plugins: process.env.VITEPRESS ? [] : [react()]
```

Quando `VITEPRESS=true` (ambiente de documentação), desabilita o plugin React para evitar conflitos com o VitePress (que usa Vue).

### Build Configuration

#### Target
```javascript
target: "esnext"
```
Permite uso de todas as features modernas do JavaScript (top-level await, import.meta, etc.).

#### Chunk Size Warning
```javascript
chunkSizeWarningLimit: 1500 // 1500kB (padrão: 500kB)
```
Limite aumentado devido às dependências pesadas (Transformers.js, PDF.js, Tesseract.js).

#### Manual Chunks

Estratégia de code splitting para otimizar carregamento:

| Chunk | Pacotes | Justificativa |
|-------|---------|--------------|
| `vendor` | `react`, `react-dom` | Framework base, cacheável |
| `transformers` | `@xenova/transformers` | ~30MB, carregamento sob demanda |
| `pdfjs` | `pdfjs-dist` | Viewer de PDF, lazy loaded |
| `tesseract` | `tesseract.js` | OCR, carregamento sob demanda |

### Environment Prefixes

```javascript
envPrefix: ["VITE_", "FIREBASE_", "IMGBB_", "GOOGLE_", "PINECONE_"]
```

Prefixos permitidos para exposição ao client-side. Variáveis com esses prefixos são injetadas via `import.meta.env`.

### Dev Server

#### Watch
```javascript
watch: { ignored: ["**/docs/**"] }
```
Ignora mudanças na pasta `docs/` (VitePress) para evitar reloads desnecessários.

#### Headers CORS
```javascript
"Cross-Origin-Opener-Policy": "same-origin-allow-popups"
```
Necessário para Google Sign-In funcionar com popups.

#### Proxy VitePress
```javascript
proxy: {
  "/docs": {
    target: "http://localhost:5174",
    changeOrigin: true
  }
}
```
Redireciona `/docs` para o servidor VitePress em desenvolvimento, permitindo acesso unificado.

## Referências Cruzadas

- [TypeScript e Ambiente](/infra/typescript-env) — Config TypeScript e variáveis
- [Arquitetura Geral](/guia/arquitetura) — Visão geral do stack
