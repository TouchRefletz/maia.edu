# /generate (Chat Mode) — Modo Multi-Turn

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+generate-chat&labels=docs)

## Visão Geral

Quando o endpoint `/generate` recebe `chatMode: true`, ele cria uma sessão de chat multi-turn via `client.chats.create()`, injetando histórico e system instruction. Este modo é usado pelo chat da Maia para conversas contextuais.

## Diferenças do Modo Padrão

| Aspecto | Modo Padrão | Chat Mode |
|---------|-------------|-----------|
| API | `generateContentStream` | `chats.create().sendMessageStream` |
| Histórico | Não suportado | Injetado via `history` |
| System Instruction | Via `config` | Via `chats.create()` config |
| Memória | Sem contexto anterior | Todas as mensagens anteriores |

## Request Chat Mode

```json
{
  "chatMode": true,
  "texto": "Explique cinemática",
  "systemInstruction": "Você é a Maia, tutora de IA educacional...",
  "history": [
    {
      "role": "user",
      "parts": [{ "text": "Oi Maia!" }]
    },
    {
      "role": "model",
      "parts": [{ "text": "{\"layout\":\"standard\",\"blocks\":[...]}" }]
    }
  ],
  "schema": { ... },
  "jsonMode": true,
  "thinking": true
}
```

## Detalhamento Técnico

### Criação do Chat

```javascript
const chat = client.chats.create({
  model: modelo,
  history: history,  // Mensagens anteriores
  config: {
    systemInstruction: systemInstruction,  // Prompt do sistema
  },
});
```

### Envio da Mensagem

```javascript
stream = await chat.sendMessageStream({
  message: { role: 'user', parts },  // Mensagem atual + imagens
  config: {
    thinkingConfig: { includeThoughts: true },
    responseMimeType: 'application/json',
    responseJsonSchema: schema,
    safetySettings,
  },
});
```

### Estrutura do Histórico

O frontend constrói o histórico a partir do chat storage (IndexedDB/Firestore):

```javascript
// Cada mensagem do usuário
{ role: "user", parts: [{ text: "pergunta do usuário" }] }

// Cada resposta do modelo (JSON completo)
{ role: "model", parts: [{ text: '{"layout":"standard","blocks":[...]}' }] }
```

### Tokens vs Janela de Contexto

O histórico é enviado integralmente. O modelo Gemini gerencia truncamento automático quando o contexto excede a janela (1M tokens para Flash).

## Edge Cases

| Caso | Tratamento |
|------|-----------|
| Histórico muito longo | Gemini trunca automaticamente |
| System instruction vazio | Sem restrições de comportamento |
| Imagens em mensagem | Processadas via `processAttachments()` |
| Chat + RECITATION | Mesmo fallback chain do modo padrão |

## Referências Cruzadas

- [/generate](/api-worker/generate) — Endpoint principal
- [Chat Index](/chat/index) — Frontend que constrói o histórico
- [System Prompts](/chat/system-prompts) — Prompts por modo
