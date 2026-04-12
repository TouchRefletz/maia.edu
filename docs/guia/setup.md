# Começando — Setup de Desenvolvimento

## Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

| Ferramenta | Versão Mínima | Verificar |
|-----------|--------------|-----------|
| **Node.js** | 18.x+ | `node --version` |
| **npm** | 9.x+ | `npm --version` |
| **Git** | 2.x+ | `git --version` |
| **Wrangler CLI** | 3.x+ | `npx wrangler --version` |

---

## 1. Clonar o Repositório

```bash
git clone https://github.com/maia-edu/maia.api.git
cd maia.api
```

## 2. Instalar Dependências

```bash
npm install
```

### Dependências Principais

| Pacote | Propósito |
|--------|----------|
| `vite` | Build tool e dev server |
| `@xenova/transformers` | Embeddings locais (CDN mode) |
| `pdfjs-dist` | Renderização de PDF |
| `best-effort-json-parser` | Parsing resiliente de JSON parcial |
| `jsonrepair` | Reparo de JSON malformado |
| `firebase` | SDK do Firebase (Auth + RTDB + Firestore) |
| `@google/genai` | SDK do Google Gemini (Worker) |

---

## 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# === FIREBASE ===
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://seu-projeto-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# === WORKER ===
VITE_WORKER_URL=http://localhost:8787
```

### Tabela Completa de Variáveis de Ambiente

#### Frontend (Vite — prefixo `VITE_`)

| Variável | Obrigatória | Descrição |
|----------|------------|-----------|
| `VITE_FIREBASE_API_KEY` | ✅ | Chave da API do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Domínio de autenticação |
| `VITE_FIREBASE_DATABASE_URL` | ✅ | URL do Realtime Database |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | ID do projeto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Bucket do Firebase Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | ID do sender de mensagens |
| `VITE_FIREBASE_APP_ID` | ✅ | ID do app Firebase |
| `VITE_WORKER_URL` | ✅ | URL do Worker (local ou prod) |

#### Worker (Cloudflare — `wrangler.jsonc` > `vars` ou secrets)

| Variável | Obrigatória | Descrição |
|----------|------------|-----------|
| `GOOGLE_GENAI_API_KEY` | ✅ | Chave da API do Google Gemini |
| `PINECONE_API_KEY` | ✅ | Chave da API do Pinecone |
| `PINECONE_HOST` | ✅ | Host do index principal |
| `PINECONE_HOST_DEEP_SEARCH` | ✅ | Host do index de deep search |
| `PINECONE_HOST_FILTER` | ✅ | Host do index de filtros |
| `PINECONE_HOST_MEMORY` | ✅ | Host do index de memória |
| `IMGBB_API_KEY` | ⚠️ | Chave para upload de imagens (ImgBB) |
| `GOOGLE_CSE_KEY` | ⚠️ | Chave para Google Custom Search |
| `GOOGLE_CSE_CX` | ⚠️ | ID do Custom Search Engine |
| `GH_PAT_TOKEN` | ⚠️ | GitHub Personal Access Token (para Actions) |
| `FIREBASE_RTDB_URL` | ⚠️ | URL do RTDB (usado pelo Worker) |

> ⚠️ = Opcional para desenvolvimento básico, necessário para funcionalidades específicas

---

## 4. Iniciar o Desenvolvimento

### Terminal 1: Frontend (Vite)

```bash
npm run dev
```

Isso inicia o Vite dev server em `http://localhost:5173` com:
- Hot Module Replacement (HMR)
- Proxy automático para o Worker (`/api` → `localhost:8787`)

### Terminal 2: Worker (Wrangler)

```bash
cd maia-api-worker
npx wrangler dev
```

Isso inicia o Worker localmente em `http://localhost:8787` com:
- Acesso às variáveis de ambiente do `wrangler.jsonc`
- Hot reload automático

---

## 5. Configuração do Vite

O `vite.config.js` contém configurações importantes:

```javascript
export default defineConfig({
  plugins: [react()],
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database', 'firebase/firestore'],
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
  
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  
  resolve: {
    alias: {
      '@': '/js',
    },
  },
});
```

**Chunking Strategy:** O Firebase e o PDF.js são separados em chunks dedicados para evitar que o bundle principal fique pesado.

---

## 6. Estrutura de Build

```bash
npm run build     # Build de produção
npm run preview   # Preview do build
npm run docs:dev  # Dev server da documentação
```

### Output de Build

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js        # Bundle principal
│   ├── firebase-[hash].js     # Chunk Firebase
│   ├── pdfjs-[hash].js        # Chunk PDF.js
│   └── index-[hash].css       # Estilos compilados
└── sounds/                    # Assets estáticos
```

---

## 7. TypeScript

O `tsconfig.json` está configurado com:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "noEmit": true,
    "allowJs": true,
    "checkJs": false
  },
  "include": ["js/**/*"]
}
```

**Notas:**
- `strict: true` — Tipagem estrita habilitada
- `allowJs: true` — Arquivos JS podem ser importados
- `checkJs: false` — JS não é verificado (apenas TS/TSX)
- `jsxImportSource: preact` — JSX usa Preact como runtime

---

## Troubleshooting

### Worker não conecta

```
[Worker] Attempt 1/3 - API Key present: false
Error: NETWORK_ERROR
```

**Solução:** Certifique-se de que o Wrangler está rodando no terminal 2 e que `VITE_WORKER_URL=http://localhost:8787` está no `.env`.

### PDF não renderiza

```
PDF-Core: Load Error: MissingPDFException
```

**Solução:** O PDF.js worker precisa ser acessível. Verifique se o CDN do `pdf.worker.min.js` está disponível ou configure um worker local.

### Firebase "Permission Denied"

**Solução:** Configure as regras de segurança do Firebase RTDB para permitir leitura/escrita durante desenvolvimento:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ **Nunca use essas regras em produção!**

---

## Referências

- [Vite Documentation](https://vitejs.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Google Gemini API](https://ai.google.dev/gemini-api)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [Firebase Documentation](https://firebase.google.com/docs)
