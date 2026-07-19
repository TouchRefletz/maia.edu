import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js";

export interface AuditItem {
  id: string;
  fieldPath: string; // e.g. "dados_questao.enunciado", "dados_questao.alternativas.A"
  targetObject: 'questao' | 'gabarito';
  originalText: string;
  suggestedText: string;
  reason: string;
  source: 'languagetool' | 'ia' | 'heuristica';
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AuditOptions {
  useLanguageTool?: boolean;
  useAI?: boolean;
  modelId?: string;
  onStatusUpdate?: (status: string) => void;
}

// Regex para ideogramas CJK (Chinês, Japonês, Coreano) e caracteres UTF-8 corrompidos
const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g;
const BROKEN_SYMBOL_REGEX = /(?:ï¿½|)+/g;

/**
 * Esquema estruturado para resposta da IA (Structured Output Schema)
 */
const auditResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    issues: {
      type: "array",
      description: "Lista de problemas e alucinações de texto encontrados na questão e no gabarito.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldPath: {
            type: "string",
            description: "Caminho do campo no JSON (ex: dados_questao.enunciado, dados_questao.alternativas.A, dados_gabarito.explicacao)"
          },
          targetObject: {
            type: "string",
            enum: ["questao", "gabarito"],
            description: "Objeto afetado ('questao' ou 'gabarito')"
          },
          originalText: {
            type: "string",
            description: "Trecho exato do texto original com a falha"
          },
          suggestedText: {
            type: "string",
            description: "Trecho de substituição sugerido com a correção"
          },
          reason: {
            type: "string",
            description: "Motivo explicativo curto sobre a correção realizada"
          }
        },
        required: ["fieldPath", "targetObject", "originalText", "suggestedText", "reason"]
      }
    }
  },
  required: ["issues"]
};

/**
 * Extrai todos os campos de texto analisáveis dos objetos de questão e gabarito
 */
function extractTextFields(q: any, g: any): Array<{ path: string; target: 'questao' | 'gabarito'; text: string }> {
  const fields: Array<{ path: string; target: 'questao' | 'gabarito'; text: string }> = [];

  const addIfText = (obj: any, pathPrefix: string, target: 'questao' | 'gabarito') => {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, val] of Object.entries(obj)) {
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (['fotos_originais', 'foto_original', 'alertas_credito', 'creditos', 'meta', 'imagens'].includes(key)) {
        continue;
      }

      if (typeof val === 'string' && val.trim().length > 0) {
        fields.push({ path: currentPath, target, text: val });
      } else if (Array.isArray(val)) {
        val.forEach((item, idx) => {
          if (typeof item === 'string' && item.trim().length > 0) {
            fields.push({ path: `${currentPath}[${idx}]`, target, text: item });
          } else if (typeof item === 'object' && item !== null) {
            addIfText(item, `${currentPath}[${idx}]`, target);
          }
        });
      } else if (typeof val === 'object' && val !== null) {
        addIfText(val, currentPath, target);
      }
    }
  };

  addIfText(q, 'dados_questao', 'questao');
  addIfText(g, 'dados_gabarito', 'gabarito');

  return fields;
}

/**
 * Executa detecção rápida de caracteres estranhos e UTF-8 corrompidos
 */
function runHeuristicCheck(fields: Array<{ path: string; target: 'questao' | 'gabarito'; text: string }>): AuditItem[] {
  const items: AuditItem[] = [];

  fields.forEach(({ path, target, text }) => {
    // 1. Ideogramas orientais (Chinês/Japonês/Coreano)
    let cjkMatch;
    CJK_REGEX.lastIndex = 0;
    while ((cjkMatch = CJK_REGEX.exec(text)) !== null) {
      const badSnippet = cjkMatch[0];
      const cleanedText = text.replace(badSnippet, '').replace(/\s+/g, ' ').trim();
      items.push({
        id: `heur_cjk_${Math.random().toString(36).substring(2, 9)}`,
        fieldPath: path,
        targetObject: target,
        originalText: text,
        suggestedText: cleanedText,
        reason: `Alucinação do modelo: Inclusão indevida de ideogramas orientais ("${badSnippet}")`,
        source: 'heuristica',
        status: 'pending'
      });
    }

    // 2. Símbolos corrompidos de encoding (ï¿½ ou )
    let brokenMatch;
    BROKEN_SYMBOL_REGEX.lastIndex = 0;
    while ((brokenMatch = BROKEN_SYMBOL_REGEX.exec(text)) !== null) {
      const badSnippet = brokenMatch[0];
      const cleanedText = text.replace(badSnippet, '').trim();
      items.push({
        id: `heur_symbol_${Math.random().toString(36).substring(2, 9)}`,
        fieldPath: path,
        targetObject: target,
        originalText: text,
        suggestedText: cleanedText,
        reason: `Caractere UTF-8 corrompido ou símbolo inválido ("${badSnippet}")`,
        source: 'heuristica',
        status: 'pending'
      });
    }
  });

  return items;
}

/**
 * Consulta a API do LanguageTool para checagem gramatical e de acentuação sem IA
 */
async function checkWithLanguageTool(
  fields: Array<{ path: string; target: 'questao' | 'gabarito'; text: string }>,
  onStatusUpdate?: (status: string) => void
): Promise<AuditItem[]> {
  const items: AuditItem[] = [];

  for (let i = 0; i < fields.length; i++) {
    const { path, target, text } = fields[i];
    if (text.length < 3) continue;

    onStatusUpdate?.(`LanguageTool: Analisando campo ${i + 1}/${fields.length}...`);

    try {
      const formData = new URLSearchParams();
      formData.append('text', text);
      formData.append('language', 'pt-BR');
      formData.append('enabledOnly', 'false');

      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (!data || !Array.isArray(data.matches)) continue;

      data.matches.forEach((match: any) => {
        if (!match.replacements || match.replacements.length === 0) return;

        const replacement = match.replacements[0].value;
        const badSnippet = text.substring(match.offset, match.offset + match.length);

        if (!badSnippet || badSnippet === replacement || /^\d+$/.test(badSnippet)) return;

        const fixedText = text.substring(0, match.offset) + replacement + text.substring(match.offset + match.length);

        items.push({
          id: `lt_${Math.random().toString(36).substring(2, 9)}`,
          fieldPath: path,
          targetObject: target,
          originalText: text,
          suggestedText: fixedText,
          reason: `LanguageTool: ${match.message || match.rule?.description || 'Correção gramatical/ortográfica'}`,
          source: 'languagetool',
          status: 'pending'
        });
      });
    } catch (err) {
      console.warn(`[LanguageTool] Erro ao consultar campo ${path}:`, err);
    }
  }

  return items;
}

/**
 * Executa auditoria via IA utilizando Saída Estruturada (Structured Output Schema)
 */
async function checkWithAI(
  q: any,
  g: any,
  modelId: string = 'models/gemini-3.5-flash',
  onStatusUpdate?: (status: string) => void
): Promise<AuditItem[]> {
  onStatusUpdate?.('IA: Enviando JSON para auditoria tipográfica via Saída Estruturada...');

  const cleanQ = JSON.parse(JSON.stringify(q || {}));
  const cleanG = JSON.parse(JSON.stringify(g || {}));

  delete cleanQ.fotos_originais;
  delete cleanQ.foto_original;
  delete cleanG.fotos_originais;
  delete cleanG.foto_original;

  const payloadToScan = {
    dados_questao: cleanQ,
    dados_gabarito: cleanG
  };

  const prompt = `Você é um Auditor Tipográfico e Especialista em Detecção de Alucinações de LLM para questões em Português (pt-BR).

Examine cuidadosamente a estrutura JSON fornecida contendo a questão e o gabarito.
Sua única responsabilidade é identificar:
1. Ideogramas chineses, japoneses, coreanos ou símbolos de línguas estrangeiras inseridos indevidamente no meio do texto.
2. Acentuação corrompida ou trocada (por exemplo, uso de 'â' em vez de 'ã' como em 'questâo' -> 'questão', 'nâo' -> 'não', acentos invertidos).
3. Palavras com erros gráficos de OCR ou símbolos UTF-8 quebrados.
4. Repetições anormais ou degeneradas de palavras/frases.

REGRAS:
- NÃO modifique o conteúdo conceitual nem a lógica das alternativas.
- Altere apenas falhas de acentuação, ortografia ou ideogramas indesejados.

Dados para auditoria:
${JSON.stringify(payloadToScan, null, 2)}`;

  try {
    let resultJson: any = null;

    if (typeof gerarConteudoEmJSONComImagemStream === 'function') {
      resultJson = await gerarConteudoEmJSONComImagemStream(
        prompt,
        auditResponseSchema,
        [],
        'image/jpeg',
        {},
        { model: modelId }
      );
    }

    if (!resultJson || !Array.isArray(resultJson.issues)) {
      return [];
    }

    return resultJson.issues.map((issue: any) => ({
      id: `ia_${Math.random().toString(36).substring(2, 9)}`,
      fieldPath: issue.fieldPath || 'dados_questao.enunciado',
      targetObject: (issue.targetObject === 'gabarito' ? 'gabarito' : 'questao') as 'questao' | 'gabarito',
      originalText: issue.originalText || '',
      suggestedText: issue.suggestedText || '',
      reason: issue.reason || 'Correção sugerida por auditoria de IA',
      source: 'ia' as const,
      status: 'pending' as const
    }));
  } catch (err) {
    console.error('[AI Audit Error]', err);
    return [];
  }
}

/**
 * Executa a auditoria completa combinando Heurísticas, LanguageTool e Saída Estruturada de IA
 */
export async function runFullTextAudit(
  q: any,
  g: any,
  options: AuditOptions = {}
): Promise<AuditItem[]> {
  const {
    useLanguageTool = true,
    useAI = true,
    modelId = 'models/gemini-3.5-flash',
    onStatusUpdate
  } = options;

  const allItems: AuditItem[] = [];
  const fields = extractTextFields(q, g);

  // 1. Executa Heurísticas locais para ideogramas e UTF-8 corrompido
  onStatusUpdate?.('Verificando ideogramas orientais e codificação...');
  const heuristicItems = runHeuristicCheck(fields);
  allItems.push(...heuristicItems);

  // 2. Executa LanguageTool se ativado
  if (useLanguageTool) {
    try {
      const ltItems = await checkWithLanguageTool(fields, onStatusUpdate);
      allItems.push(...ltItems);
    } catch (e) {
      console.error('[Full Audit] Erro no LanguageTool:', e);
    }
  }

  // 3. Executa IA com Saída Estruturada se ativada
  if (useAI) {
    try {
      const aiItems = await checkWithAI(q, g, modelId, onStatusUpdate);
      allItems.push(...aiItems);
    } catch (e) {
      console.error('[Full Audit] Erro na IA:', e);
    }
  }

  // Deduplica itens por campo e texto original idênticos
  const uniqueItemsMap = new Map<string, AuditItem>();
  allItems.forEach(item => {
    const key = `${item.fieldPath}_${item.originalText}_${item.suggestedText}`;
    if (!uniqueItemsMap.has(key)) {
      uniqueItemsMap.set(key, item);
    }
  });

  onStatusUpdate?.('Auditoria concluída com sucesso!');
  return Array.from(uniqueItemsMap.values());
}

/**
 * Aplica a correção de um item de auditoria nos objetos q (questão) ou g (gabarito)
 */
export function applyAuditFix(q: any, g: any, item: AuditItem): { updatedQ: any; updatedG: any } {
  const updatedQ = JSON.parse(JSON.stringify(q || {}));
  const updatedG = JSON.parse(JSON.stringify(g || {}));

  const rootObj = item.targetObject === 'gabarito' ? updatedG : updatedQ;

  let pathStr = item.fieldPath;
  if (pathStr.startsWith('dados_questao.')) {
    pathStr = pathStr.substring('dados_questao.'.length);
  } else if (pathStr.startsWith('dados_gabarito.')) {
    pathStr = pathStr.substring('dados_gabarito.'.length);
  }

  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: any = rootObj;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (current[k] === undefined || current[k] === null) {
      return { updatedQ, updatedG };
    }
    current = current[k];
  }

  const lastKey = keys[keys.length - 1];
  if (typeof current[lastKey] === 'string') {
    const val = current[lastKey];
    if (val.includes(item.originalText)) {
      current[lastKey] = val.replace(item.originalText, item.suggestedText);
    } else {
      current[lastKey] = item.suggestedText;
    }
  }

  return { updatedQ, updatedG };
}
