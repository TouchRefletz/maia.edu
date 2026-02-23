# O que é o Maia.edu?

O **Maia.edu** é uma aplicação web voltada para a educação e estruturação do conhecimento, combinando análises precisas em documentos e um assistente inteligente.

A plataforma utiliza o poder da inteligência artificial para potencializar o estudo e a criação de conteúdo:

- **Extração Inteligente:** Permite subir arquivos PDF para que a IA analise, recorte e converta exercícios, inclusive com equações e marcações de química/física complexas (OCR + LaTeX).
- **Chat Interativo:** Conta com um assistente integrado (Maia.ai) oferecendo modelos adaptados ao seu contexto (Automático, Rápido ou Raciocínio profundo) onde você pode anexar imagens, questões e tirar dúvidas no formato de tutoria.
- **Banco de Questões:** Explore todo o repositório de exercícios já extraídos, filtre por conteúdo, identifique métricas de dificuldade (fácil, médio, difícil baseado em IRT) e visualize imagens originais e resoluções completas lado a lado.
- **Interface Otimizada:** Construída para responder velozmente tanto na versão desktop quanto na visualização em abas/bottom sheets do mobile.

## Começando

Siga as etapas abaixo para ligar a infraestrutura local:

### 1. Pré-requisitos

- **Node.js** (v20+ recomendado).
- Chaves de configuração definidas no arquivo `.env` ou `.secrets` (Cloudflare, Gemini, etc).

### 2. Rodar a Plataforma Web e Documentação

O projeto é configurado para ser iniciado de forma conjunta (Frontend App e VitePress Docs) a partir da raiz:

```bash
npm install
npm run dev
```

1. Acesse o **App Principal**: `https://maia-api.vercel.app/`
2. Acesse esta **Documentação**: `https://maia-api.vercel.app/docs/` (ou pelo botão no menu lateral da plataforma).
