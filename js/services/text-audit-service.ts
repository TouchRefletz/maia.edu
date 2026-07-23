import { gerarConteudoEmJSONComImagemStream, sanitizeJsonForPrompt } from "../api/worker.js";

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
  signal?: AbortSignal;
  chaveProva?: string;
  idQuestao?: string;
  identificacao?: string;
  meta?: any;
  imageBase64?: string | null;
  imageMimeType?: string;
  checkInconsistencies?: boolean;
}

// Regex para ideogramas CJK (Chinês, Japonês, Coreano) e caracteres UTF-8 corrompidos
const CJK_REGEX_GLOBAL = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g;
const BROKEN_SYMBOL_REGEX_GLOBAL = /(?:ï¿½|\uFFFD)+/g;

/**
 * Verifica se uma string é texto legível humano e descarta dados base64 / imagens
 */
function isCleanTextString(val: any): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 2) return false;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false;
  if (trimmed.length > 80 && !trimmed.includes(' ')) return false;
  if (trimmed.length > 3000) return false; // descarta grandes blocos de dados
  return true;
}

/**
 * Remove apenas dados pesados de binários de imagem e base64, mantendo TODOS os campos de texto (meta, identificacao, creditos, etc.)
 */
function cleanObjectForAudit(obj: any): any {
  if (typeof obj === 'string') {
    return isCleanTextString(obj) ? obj : '[REMOVED_NON_TEXT_DATA]';
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanObjectForAudit).filter(item => item !== '[REMOVED_NON_TEXT_DATA]');
  }
  if (typeof obj === 'object' && obj !== null) {
    const cleaned: Record<string, any> = {};
    const keysToIgnore = [
      'fotos_originais', 'foto_original', 'imagens', 'base64', 'cropped_base64', 'imagem_base64',
      'pdfjs_x', 'pdfjs_y', 'pdfjs_crop_w', 'pdfjs_crop_h', 'pdfjs_source_w', 'pdfjs_source_h', 'src'
    ];

    for (const [key, value] of Object.entries(obj)) {
      if (keysToIgnore.includes(key) || /base64|foto_original|fotos_originais|cropped|image_data|svg/i.test(key)) {
        continue;
      }
      const cleanedValue = cleanObjectForAudit(value);
      if (cleanedValue !== '[REMOVED_NON_TEXT_DATA]') {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Extrai todos os campos de texto analisáveis dos objetos de questão e gabarito (incluindo identificacao, creditos e meta)
 */
function extractTextFields(
  q: any,
  g: any,
  extra: { identificacao?: string; chaveProva?: string; meta?: any } = {}
): Array<{ path: string; target: 'questao' | 'gabarito'; text: string }> {
  const fields: Array<{ path: string; target: 'questao' | 'gabarito'; text: string }> = [];

  const ident = extra.identificacao || q?.identificacao || g?.identificacao || q?.id || '';
  if (ident && typeof ident === 'string' && isCleanTextString(ident)) {
    fields.push({ path: 'identificacao', target: 'questao', text: ident });
  }

  const prova = extra.chaveProva || q?.chaveProva || g?.chaveProva || '';
  if (prova && typeof prova === 'string' && isCleanTextString(prova)) {
    fields.push({ path: 'chaveProva', target: 'questao', text: prova });
  }

  const addIfText = (obj: any, pathPrefix: string, target: 'questao' | 'gabarito') => {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, val] of Object.entries(obj)) {
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (/base64|foto_original|fotos_originais|cropped|image_data|svg/i.test(key)) {
        continue;
      }

      if (typeof val === 'string') {
        if (isCleanTextString(val)) {
          fields.push({ path: currentPath, target, text: val });
        }
      } else if (Array.isArray(val)) {
        val.forEach((item, idx) => {
          if (typeof item === 'string' && isCleanTextString(item)) {
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
  if (extra.meta) {
    addIfText(extra.meta, 'meta', 'questao');
  }

  return fields;
}

/**
 * Tenta corrigir corrupção dupla de encoding UTF-8 (ex: QUESTÃ££Ã££O -> QUESTÃO)
 */
function fixUtf8Corruption(str: string): string {
  if (!str || typeof str !== 'string') return str;
  let fixed = str;
  // Corrupção dupla de UTF-8 comum no extrator (ex: QUESTÃ££Ã££O, nûmero)
  fixed = fixed
    .replace(/Ã££Ã££/g, 'ã')
    .replace(/Ã££/g, 'ã')
    .replace(/Ã£/g, 'ã')
    .replace(/Ã©/g, 'é')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã/g, 'à');
  return fixed;
}

/**
 * Executa detecção rápida de caracteres estranhos, ideogramas e UTF-8 corrompidos
 */
function runHeuristicCheck(fields: Array<{ path: string; target: 'questao' | 'gabarito'; text: string }>): AuditItem[] {
  const items: AuditItem[] = [];

  fields.forEach(({ path, target, text }) => {
    // 1. Ideogramas orientais (Chinês/Japonês/Coreano)
    const cjkMatches = Array.from(text.matchAll(CJK_REGEX_GLOBAL));
    const seenCjk = new Set<string>();

    cjkMatches.forEach(m => {
      const badSnippet = m[0];
      if (!badSnippet || seenCjk.has(badSnippet)) return;
      seenCjk.add(badSnippet);

      const cleanedText = text.replace(new RegExp(badSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').replace(/\s+/g, ' ').trim();
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
    });

    // 2. Símbolos corrompidos de encoding (ï¿½ ou \uFFFD)
    const brokenMatches = Array.from(text.matchAll(BROKEN_SYMBOL_REGEX_GLOBAL));
    const seenBroken = new Set<string>();

    brokenMatches.forEach(m => {
      const badSnippet = m[0];
      if (!badSnippet || seenBroken.has(badSnippet)) return;
      seenBroken.add(badSnippet);

      const cleanedText = text.replace(new RegExp(badSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();
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
    });

    // 3. Corrupção dupla de encoding UTF-8 (ex: QUESTÃ££Ã££O)
    if (/Ã[£©§¡³ºª´]/.test(text)) {
      const fixedText = fixUtf8Corruption(text);
      if (fixedText !== text) {
        items.push({
          id: `heur_utf8_double_${Math.random().toString(36).substring(2, 9)}`,
          fieldPath: path,
          targetObject: target,
          originalText: text,
          suggestedText: fixedText,
          reason: `Corrupção de codificação UTF-8 (ex: QUESTÃ££Ã££O -> QUESTÃO)`,
          source: 'heuristica',
          status: 'pending'
        });
      }
    }
  });

  return items;
}

/**
 * Consulta a API do LanguageTool para checagem gramatical e de acentuação sem IA
 */
async function checkWithLanguageTool(
  fields: Array<{ path: string; target: 'questao' | 'gabarito'; text: string }>,
  onStatusUpdate?: (status: string) => void,
  signal?: AbortSignal
): Promise<AuditItem[]> {
  const items: AuditItem[] = [];
  const fieldsToScan = fields.slice(0, 8);

  for (let i = 0; i < fieldsToScan.length; i++) {
    if (signal?.aborted) break;
    const { path, target, text } = fieldsToScan[i];
    if (text.length < 4 || text.length > 1500) continue;

    onStatusUpdate?.(`LanguageTool: Analisando campo ${i + 1}/${fieldsToScan.length}...`);

    try {
      const formData = new URLSearchParams();
      formData.append('text', text);
      formData.append('language', 'pt-BR');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
          reason: `LanguageTool: ${match.message || match.rule?.description || 'Correção ortográfica'}`,
          source: 'languagetool',
          status: 'pending'
        });
      });
    } catch (err) {
      console.warn(`[LanguageTool] Erro ou timeout no campo ${path}:`, err);
    }
  }

  return items;
}

/**
 * Esquema estruturado para resposta da IA (Structured Output Schema)
 */
const auditResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    issues: {
      type: "array",
      description: "Lista de problemas, alucinações e incoerências de texto encontrados na questão e no gabarito.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldPath: {
            type: "string",
            description: "Caminho do campo no JSON (ex: identificacao, dados_questao.enunciado, dados_questao.alternativas.A, dados_gabarito.explicacao)"
          },
          targetObject: {
            type: "string",
            enum: ["questao", "gabarito"],
            description: "Objeto afetado ('questao' ou 'gabarito')"
          },
          originalText: {
            type: "string",
            description: "Trecho exato do texto original cadastrado com a falha"
          },
          suggestedText: {
            type: "string",
            description: "Trecho de substituição sugerido com a correção"
          },
          reason: {
            type: "string",
            description: "Motivo explicativo curto sobre a correção realizada (ortografia, digitação, ou incoerência com a foto)"
          }
        },
        required: ["fieldPath", "targetObject", "originalText", "suggestedText", "reason"]
      }
    }
  },
  required: ["issues"]
};

/**
 * Executa auditoria via IA utilizando Saída Estruturada com suporte a Imagem da Prova Original
 */
async function checkWithAI(
  q: any,
  g: any,
  options: AuditOptions = {}
): Promise<AuditItem[]> {
  const {
    chaveProva = '',
    idQuestao = '',
    identificacao = '',
    meta = {},
    modelId = 'models/gemini-3.5-flash',
    imageBase64,
    imageMimeType = 'image/jpeg',
    checkInconsistencies = true,
    onStatusUpdate,
    signal
  } = options;

  if (signal?.aborted) return [];
  onStatusUpdate?.(imageBase64 ? 'IA: Analisando foto da prova e verificando todo o JSON da questão...' : 'IA: Enviando JSON completo da questão para auditoria de texto e lógica...');

  const cleanQ = cleanObjectForAudit(q || {});
  const cleanG = cleanObjectForAudit(g || {});
  const cleanMeta = cleanObjectForAudit(meta || q?.meta || g?.meta || {});

  const finalIdent = identificacao || idQuestao || q?.identificacao || g?.identificacao || q?.id || '';
  const finalProva = chaveProva || q?.chaveProva || g?.chaveProva || '';

  const payloadToScan = {
    identificacao: finalIdent,
    idQuestao: idQuestao || finalIdent,
    chaveProva: finalProva,
    meta: cleanMeta,
    dados_questao: cleanQ,
    dados_gabarito: cleanG
  };

  const jsonText = JSON.stringify(payloadToScan, null, 2);

  let prompt = `Você é um Auditor Especialista e Revisor Pedagógico para questões escolares e acadêmicas em Português (pt-BR).

Examine o JSON COMPLETO fornecido (incluindo identificacao, meta, dados_questao e dados_gabarito) ${imageBase64 ? 'e COMPARE rigorosamente com a foto da prova original anexa' : ''}.

Identifique e reporte APENAS:
1. Nomes, identificações ou títulos de questão corrompidos por UTF-8 (ex: 'QUESTÃ££Ã££O 164' em vez de 'QUESTÃO 164', 'PROVA_123_DÃ©' em vez de 'PROVA_123_DÉ').
2. Ideogramas orientais (chinês/japonês/coreano como 汉字) ou caracteres corrompidos inseridos por falha de OCR.
3. Acentuação corrompida ou trocada (ex: 'questâo' em vez de 'questão', 'nâo' em vez de 'não', 'voce' em vez de 'você').
4. Símbolos UTF-8 quebrados (ex: ï¿½) ou erros de digitação gritantes.
5. ${checkInconsistencies ? 'Incoerências pedagógicas, contradições entre o enunciado e as alternativas ou divergências entre a foto da prova e o texto digitado (palavras omitidas, números trocados ou letras de opção erradas).' : 'Divergências diretas de digitação.'}

Instruções Estritas:
- 'fieldPath' DEVE indicar o campo exato (ex: identificacao, dados_questao.enunciado, dados_questao.estrutura[0].conteudo, dados_questao.alternativas[0].texto, dados_gabarito.explicacao).
- 'originalText' DEVE ser o trecho exato que atualmente está no JSON.
- 'suggestedText' DEVE conter a substituição corrigida e fiel à foto da prova original.

JSON COMPLETO para auditoria:
${jsonText}`;

  try {
    let resultJson: any = null;
    const attachments = imageBase64 ? [imageBase64] : [];

    if (typeof gerarConteudoEmJSONComImagemStream === 'function') {
      resultJson = await (gerarConteudoEmJSONComImagemStream as any)(
        prompt,
        auditResponseSchema as any,
        attachments,
        imageMimeType,
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
    chaveProva = '',
    idQuestao = '',
    identificacao = '',
    meta = {},
    useLanguageTool = true,
    useAI = true,
    modelId = 'models/gemini-3.5-flash',
    imageBase64,
    imageMimeType = 'image/jpeg',
    checkInconsistencies = true,
    onStatusUpdate,
    signal
  } = options;

  const allItems: AuditItem[] = [];
  const fields = extractTextFields(q, g, {
    identificacao: identificacao || idQuestao || q?.identificacao,
    chaveProva: chaveProva || q?.chaveProva,
    meta: meta || q?.meta
  });

  // 1. Executa Heurísticas locais para ideogramas e UTF-8 corrompido (Instantâneo, 0ms)
  onStatusUpdate?.('Verificando ideogramas orientais e codificação...');
  const heuristicItems = runHeuristicCheck(fields);
  allItems.push(...heuristicItems);

  // 2. Executa LanguageTool se ativado
  if (useLanguageTool && !signal?.aborted) {
    try {
      const ltItems = await checkWithLanguageTool(fields, onStatusUpdate, signal);
      allItems.push(...ltItems);
    } catch (e) {
      console.error('[Full Audit] Erro no LanguageTool:', e);
    }
  }

  // 3. Executa IA se ativada
  if (useAI && !signal?.aborted) {
    try {
      const aiItems = await checkWithAI(q, g, options);
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
      const normVal = val.replace(/\s+/g, ' ');
      const normOrig = item.originalText.replace(/\s+/g, ' ');
      if (normVal.includes(normOrig)) {
        current[lastKey] = val.replace(item.originalText.trim(), item.suggestedText.trim());
      } else if (val.length <= item.suggestedText.length * 2 && item.suggestedText.length <= val.length * 2) {
        current[lastKey] = item.suggestedText;
      } else {
        console.warn(`[applyAuditFix] Trecho original não encontrado exatamente no campo ${pathStr}, aplicando substituição direta do texto sugerido.`);
        current[lastKey] = item.suggestedText;
      }
    }
  }

  return { updatedQ, updatedG };
}
