# Modal Seletores de Provedores de IA (`ModelSelectorModal.tsx`)

O `ModelSelectorModal.tsx` é o componente reativo (React 19) responsável pelo gerenciamento client-side de provedores de IA e chaves de API personalizadas.

---

## 🔑 Provedores e Modelos Selecionáveis

| Provedor | Modelos Suportados | Tipo de Credencial |
|---|---|---|
| **Google Gemini** | `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-flash` | Gemini API Key |
| **Google Vertex AI** | Endpoints corporativos dedicados | GCP ADC / Vertex Key |
| **Groq Acceleration** | `gpt-oss-120b` (Llama/Mixture-of-Experts) | Groq API Key |
| **OpenAI / GitHub** | `gpt-5`, `gpt-4.1`, `o3-mini`, `o1` | GitHub Personal Access Token |

---

## 🔗 Referências Cruzadas
- [Configuração de Chat Multi-Vendor](/chat/config)
- [Modais UI](/ui/modais)
