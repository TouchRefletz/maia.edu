#!/usr/bin/env python3
"""
extract_pipeline.py — Server-side question extraction pipeline.

Ports the core logic from ai-scanner.js + config.js to Python.
Uses Gemini API directly for:
1. Page region detection (bounding boxes)
2. Question extraction (structured JSON)
3. Gabarito search (answer + explanation)

Saves results via Worker endpoints (/check-duplicate, /extract-and-save).
Tracks detailed progress in manifest.json with per-page Gemini results.
"""

import os
import sys
import json
import time
import glob
import base64
import traceback
from pathlib import Path

import requests
from pdf2image import convert_from_path
from PIL import Image
from google import genai
from google.genai import types

# ─── Configuration ────────────────────────────────────────────────
WORKER_URL = os.environ.get("WORKER_URL", "https://maia-api-worker.willian-campos-ismart.workers.dev")
GEMINI_KEY = os.environ["GOOGLE_GENAI_API_KEY"]
SLUG = os.environ["SLUG"]
MANIFEST_PATH = os.environ.get("MANIFEST_PATH", "work/manifest.json")
QUERY = os.environ.get("QUERY", "")
INSTITUTION = os.environ.get("INSTITUTION", "")
SUBJECT = os.environ.get("SUBJECT", "")
REGION_MODEL = os.environ.get("REGION_MODEL", "models/gemini-3-flash-preview")
EXTRACT_MODEL = os.environ.get("EXTRACT_MODEL", "models/gemini-3-flash-preview")

# Rate limit config
MAX_RETRIES = 3
RETRY_DELAY = 30  # seconds

# Initialize Gemini client
client = genai.Client(api_key=GEMINI_KEY)

# ─── Prompts (ported from ai-scanner.js + config.js) ─────────────

REGION_DETECT_PROMPT = """
Você é um especialista em visão computacional e OCR de documentos educacionais (provas e listas de exercícios).

OBJETIVO:
Identificar as questões completas na imagem e retornar suas coordenadas (bounding boxes) com precisão absoluta.

PRINCÍPIO FUNDAMENTAL: "CAIXA GULOSA" (GREEDY BOX)
A caixa da questão deve englobar TUDO que pertence a ela. Se tiver dúvida se um texto faz parte ou não, INCLUA-O. É melhor pecar pelo excesso do que pelo corte.

O QUE COMPÕE UMA QUESTÃO (Deve estar DENTRO da caixa):
1. **Cabeçalho/Identificador**: O número da questão (ex: "QUESTÃO 03", "14", "Questão 1").
2. **Textos de Apoio / Enunciado**: TODO o texto introdutório, poemas, trechos de livros, notícias.
3. **Referências Bibliográficas / Fontes**: Linhas miúdas como "Disponível em...", "Acesso em...", "Autor X". ISSO É CRUCIAL e frequentemente esquecido. INCLUA AS FONTES.
4. **Imagens/Figuras/Gráficos**: Qualquer elemento visual associado.
5. **Alternativas**: Todas as opções de resposta (A, B, C, D, E). A caixa só termina DEPOIS da última alternativa.
6. **Material de Apoio (Texto/Imagem)**: Textos longos, poemas, tirinhas, mapas, figuras associadas.
   - **ATENÇÃO AO TEXTO COMPARTILHADO**: Se houver "Texto para as questões 10 e 11", VOCÊ DEVE CRIAR ENTRADAS SEPARADAS PARA CADA QUESTÃO.
   - Crie uma region para a Questão 10 contendo esse texto (tipo: "parte_questao").
   - Crie OUTRA region para a Questão 11 contendo O MESMO texto (tipo: "parte_questao").

REGRAS ESTRITAS DE TIPO ("tipo"):
- **"parte_questao"**: Use para textos de apoio, imagens, gráficos ou trechos que servem de base para a questão, mas não contêm as alternativas.
- **"questao_completa"**: Use para o bloco principal que contém o enunciado específico e as alternativas.

REGRAS ESTRITAS DE SEGMENTAÇÃO:
- **Limite Inferior**: A questão só acaba quando começa o cabeçalho da PRÓXIMA questão ou no fim da coluna/página.
- **Não Corte Alternativas**: Garanta que a alternativa (E) ou a última opção esteja totalmente dentro da caixa.
- **Não Corte Fontes**: Olhe abaixo das imagens e dos textos. Tem uma linha pequena citando a fonte? COLOQUE DENTRO DA CAIXA.
- **Questões em Colunas**: Se a prova é em duas colunas, respeite a coluna. Se a questão começa numa coluna e termina na outra, use 2 caixas (split) com o mesmo questionId.

REGRAS DO JSON:
- kind: Sempre "QUESTION".
- questionId: String com o número (ex: "45").
- tipo:
    - "questao_completa": Se a caixa contém a questão inteira.
    - "parte_questao": Se a questão foi dividida em múltiplas caixas (ex: quebra de coluna).
- box: [y1, x1, y2, x2] em escala 0..1000. O box deve ser JUSTO, mas ABRANGENTE.

ANALISE A IMAGEM COM CUIDADO E GERE O JSON.
""".strip()

REGION_DETECT_SCHEMA = {
    "type": "object",
    "properties": {
        "coordinateSystem": {"type": "string", "enum": ["normalized_0_1000_y1x1y2x2"]},
        "regions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "questionId": {"type": "string"},
                    "tipo": {"type": "string", "enum": ["questao_completa", "parte_questao"]},
                    "kind": {"type": "string", "enum": ["QUESTION"]},
                    "box": {"type": "array", "items": {"type": "integer"}, "minItems": 4, "maxItems": 4},
                    "confidence": {"type": "number"},
                    "note": {"type": "string"},
                },
                "required": ["id", "kind", "box", "confidence", "tipo"],
            },
        },
    },
    "required": ["coordinateSystem", "regions"],
}

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "ok": {
            "type": "boolean",
            "description": "Retorne true SE E SOMENTE SE todas as 'regions' (caixas) seguem PERFEITAMENTE o princípio da CAIXA GULOSA (incluem TUDO: enunciado, imagens, fontes, TODAS as alternativas)."
        },
        "feedback": {
            "type": "string",
            "description": "Se ok=false, descreva EXATAMENTE quais questões estão cortadas ou incompletas e O QUE falta nelas (ex: 'Questão 05 cortou a fonte no rodapé', 'Questão 03 faltou a alternativa E')."
        }
    },
    "required": ["ok"]
}

def build_review_prompt(current_json):
    return f"""
VOCÊ É UM AUDITOR DE QUALIDADE RIGOROSO (REVIEWER).
SEU TRABALHO: Analisar se as caixas detectadas (bounding boxes) cobrem 100% do conteúdo de cada questão.

JSON ATUAL (Candidato):
{json.dumps(current_json, ensure_ascii=False, indent=2)}

PRINCÍPIO RIGOROSO: "GREEDY BOX" (Caixa Gulosa)
- A caixa deve ir do topo do número da questão ATÉ O FIM ABSOLUTO dela.
- ISSO INCLUI:
  1. Texto de apoio / Enunciado COMPLETO.
  2. Imagens, tabelas, figuras.
  3. TODAS as alternativas (A, B, C, D, E).
  4. *** FONTES / REFERÊNCIAS BIBLIOGRÁFICAS *** (MUITO IMPORTANTE: Frequentemente estão em letras miúdas no rodapé da questão. DEVEM ESTAR DENTRO DA CAIXA).

TAREFA:
1. Olhe para a imagem original e para as coordenadas no JSON.
2. Verifique se ALGUMA coisa ficou de fora da caixa de cada questão.
3. Se estiver faltando UMA LINHA SEQUER (especialmente fontes ou última alternativa), reprove.

Se estiver tudo 100% perfeito, retorne {{ "ok": true }}.
Se houver falhas, retorne {{ "ok": false, "feedback": "Explique o erro..." }}.
""".strip()

def build_correction_prompt(current_json, feedback):
    return f"""
ATENÇÃO: A GERAÇÃO ANTERIOR FOI REPROVADA PELO AUDITOR.
FEEDBACK DO AUDITOR: "{feedback}"

JSON ANTERIOR (Incompleto/Errado):
{json.dumps(current_json, ensure_ascii=False, indent=2)}

SUA TAREFA:
Refazer as bounding boxes das questões mencionadas no feedback, garantindo que agora sigam o princípio GREEDY BOX (incluindo fontes, notas, todas as alternativas).
Mantenha as questões que já estavam certas (a menos que precisem de ajuste espacial por causa das outras).

GERE O JSON COMPLETO CORRIGIDO.
""".strip()

QUESTION_EXTRACT_PROMPT = """
        Você é um extrator de questões. Seu único objetivo é identificar e organizar os dados fielmente ao layout original no JSON. NÃO DEIXE CAMPOS DO JSON VAZIOS.

        REGRAS DE ESTRUTURAÇÃO ("estrutura"):
        1. NÃO jogue todo o texto em um único campo. Fatie o conteúdo em blocos sequenciais dentro do array "estrutura".
        2. Se a questão apresentar: Texto Introdutório -> Imagem -> Pergunta, seu array deve ter 3 itens: { texto }, { imagem }, { texto }.
        3. Para blocos do tipo "imagem": O campo "conteudo" deve ser uma breve descrição visual (Alt-Text) para acessibilidade. NÃO extraia o texto de dentro da imagem (OCR), apenas descreva o elemento visual.
        4. Para blocos do tipo "texto": Mantenha a formatação original tanto quanto possível.
        5. Se houver "Texto 1" e "Texto 2" separados, crie blocos de texto separados.

        Analise as imagens fornecidas (que compõem uma única questão) e gere o JSON. As imagens enviadas contém partes da mesma questão (enunciado, figuras, alternativas). Junte as informações de todas as imagens. NÃO DESCREVA O TEXTO CONTIDO EM IMAGENS (OCR). Se identificar algo que não se encaixa claramente em nenhum tipo das estruturas solicitadas, use imagem (com descrição visual curta; sem OCR).
        
        DIRETRIZES DE FORMATAÇÃO (RIGOROSAS):
        1. **MARKDOWN OBRIGATÓRIO:** Todo o conteúdo textual (exceto JSON chaves) deve ser formatado em Markdown. Use **negrito**, *itálico* onde aparecer no original.
        
        2. **MATEMÁTICA E QUÍMICA (LATEX):** - TODA fórmula matemática, símbolo, variável (como 'x', 'y') ou equação química DEVE ser escrita exclusivamente em LaTeX.
            - **INLINE (No meio do texto):** Se a fórmula faz parte da frase, use o bloco do tipo 'texto' e envolva o LaTeX entre cifrões unitários. Exemplo: "A massa de $H_2O$ é..." ou "Sendo $x = 2$, calcule...".
            - **DISPLAY (Isolada):** Use um bloco do tipo 'equacao' contendo APENAS o código LaTeX cru (sem cifrões).

        3. **ESTRUTURA:**
            - Se houver Texto -> Equação Isolada -> Texto, gere 3 blocos: {tipo: 'texto'}, {tipo: 'equacao'}, {tipo: 'texto'}.
            - Se houver Texto com equação pequena no meio, gere 1 bloco: {tipo: 'texto', conteudo: 'O valor de $x$ é...'}.
            - JAMAIS use ASCII para matemática (nada de x^2 ou H2O normal). Use $x^2$ e $H_2O$.
            - **TABELAS:** Se a questão contiver uma tabela de dados, use o tipo 'tabela' e formate o conteúdo EXCLUSIVAMENTE como uma tabela Markdown.

        Analise as imagens fornecidas. Junte as informações de todas as imagens.
""".strip()

# Shared bloco conteudo definition (matches $defs/blocoConteudo in config.js)
_BLOCO_CONTEUDO = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "tipo": {
            "type": "string",
            "enum": [
                "texto", "imagem", "citacao", "titulo", "subtitulo",
                "lista", "equacao", "codigo", "destaque", "separador", "fonte", "tabela",
            ],
            "description": "O tipo de conteúdo deste bloco.",
        },
        "conteudo": {
            "type": "string",
            "description": (
                "Conteúdo do bloco conforme o tipo: (texto/citacao/destaque) texto literal em parágrafos; "
                "(titulo/subtitulo) cabeçalho interno do conteúdo, nunca a identificação da questão; "
                "(lista) itens em linhas separadas; (equacao) somente expressão em LaTeX; "
                "(codigo) somente o código; (imagem) descrição visual curta (alt-text) sem OCR; "
                "(separador) pode ser vazio; (fonte) créditos/referência exibível (ex: 'Fonte: ...', "
                "'Adaptado de ...', autor/obra/URL); (tabela) USE FORMATO MARKDOWN TABLE."
            ),
        },
    },
    "required": ["tipo", "conteudo"],
}

QUESTION_EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "identificacao": {
            "type": "string",
            "description": "Identificação da questão (ex: 'ENEM 2023 - Q45').",
        },
        "materias_possiveis": {"type": "array", "items": {"type": "string"}},
        "estrutura": {
            "type": "array",
            "description": (
                "Lista ordenada que representa o fluxo visual da questão, mantendo a ordem exata de textos e imagens. "
                "IMPORTANTÍSSIMO: não inclua a identificação da questão em nenhum item desta lista; isso deve ficar "
                "exclusivamente no campo 'identificacao'. Use 'titulo' and 'subtitulo' apenas para cabeçalhos internos "
                "do conteúdo (ex: 'Texto I', 'Considere o gráfico', 'Fragmento', 'Leia o texto a seguir')."
            ),
            "items": _BLOCO_CONTEUDO,
        },
        "palavras_chave": {
            "type": "array",
            "description": "Principais termos chave.",
            "items": {"type": "string"},
        },
        "tipo_resposta": {
            "type": "string",
            "enum": ["objetiva", "dissertativa"],
            "description": "Se a questão tem alternativas (A, B, C...), é 'objetiva'. Se pede resposta escrita/discursiva, é 'dissertativa'.",
        },
        "alternativas": {
            "type": "array",
            "description": "Lista de alternativas. Para questões dissertativas, este array deve estar VAZIO [].",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "letra": {"type": "string"},
                    "estrutura": {
                        "type": "array",
                        "description": "Lista ordenada que representa o fluxo visual das alternativas.",
                        "items": _BLOCO_CONTEUDO,
                    },
                },
                "required": ["letra", "estrutura"],
            },
        },
    },
    "required": ["identificacao", "materias_possiveis", "palavras_chave", "alternativas", "estrutura", "tipo_resposta"],
}


# ─── Helpers ──────────────────────────────────────────────────────

def load_manifest():
    """Load or create manifest."""
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH) as f:
            return json.load(f)
    return {
        "status": "in_progress",
        "slug": SLUG,
        "query": QUERY,
        "institution": INSTITUTION,
        "subject": SUBJECT,
        "rate_limit_hit": False,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def save_manifest(manifest):
    """Save manifest to disk."""
    manifest["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def image_to_base64(img: Image.Image, fmt="PNG") -> str:
    """Convert PIL Image to base64 string."""
    import io
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def crop_region(page_img: Image.Image, box: list) -> Image.Image:
    """Crop a region from page image using [y1, x1, y2, x2] in 0..1000 scale with validations."""
    if not isinstance(box, list) or len(box) != 4:
        raise ValueError(f"Formato de box inválido: {box}. Deve ser uma lista de 4 números.")
    
    w, h = page_img.size
    
    # Garantir que sejam numéricos
    try:
        y1, x1, y2, x2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
    except (ValueError, TypeError) as e:
        raise ValueError(f"Valores não-numéricos no box: {box}") from e

    # Converter para inteiros
    y1, x1, y2, x2 = int(y1), int(x1), int(y2), int(x2)

    # Limitar ao range 0..1000
    y1 = max(0, min(1000, y1))
    x1 = max(0, min(1000, x1))
    y2 = max(0, min(1000, y2))
    x2 = max(0, min(1000, x2))

    # Garantir ordem correta y1 <= y2 e x1 <= x2
    if y1 > y2:
        y1, y2 = y2, y1
    if x1 > x2:
        x1, x2 = x2, x1

    # Impedir altura ou largura zero
    if y1 == y2:
        y2 = min(1000, y1 + 1)
    if x1 == x2:
        x2 = min(1000, x1 + 1)

    left = int(x1 / 1000 * w)
    top = int(y1 / 1000 * h)
    right = int(x2 / 1000 * w)
    bottom = int(y2 / 1000 * h)
    
    # Garantir pelo menos 1 pixel de tamanho real na imagem
    if right <= left:
        right = min(w, left + 1)
    if bottom <= top:
        bottom = min(h, top + 1)
        
    print(f"      [Crop] Box original: {box} -> Validado: [{y1}, {x1}, {y2}, {x2}] -> Pixels: left={left}, top={top}, right={right}, bottom={bottom}")
    return page_img.crop((left, top, right, bottom))


def parse_json_response(text: str) -> dict:
    """Parse JSON response from LLM, cleaning markdown wraps if present."""
    if not text:
        raise ValueError("Texto de resposta vazio")
    
    text_stripped = text.strip()
    
    # 1. Tentar parse direto
    try:
        return json.loads(text_stripped)
    except json.JSONDecodeError:
        pass
        
    # 2. Tentar extrair de blocos markdown ```json ... ``` ou ``` ... ```
    import re
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text_stripped)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
            
    # 3. Tentar encontrar limites de chaves { ... }
    start_idx = text_stripped.find('{')
    end_idx = text_stripped.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            return json.loads(text_stripped[start_idx:end_idx+1])
        except json.JSONDecodeError:
            pass
            
    raise ValueError(f"Falha ao decodificar JSON da resposta do LLM: {text[:200]}")


def validate_question(questao: dict) -> tuple[bool, str]:
    """Valida a estrutura do JSON extraído da questão para evitar salvar lixo."""
    if not isinstance(questao, dict):
        return False, "O objeto da questão não é um dicionário."
        
    identificacao = questao.get("identificacao")
    if not identificacao or not isinstance(identificacao, str) or not identificacao.strip():
        return False, "Campo 'identificacao' ausente ou vazio."
    if len(identificacao.strip()) < 2:
        return False, f"Campo 'identificacao' é curto demais: '{identificacao}'."
        
    tipo_resposta = questao.get("tipo_resposta")
    if tipo_resposta not in ("objetiva", "dissertativa"):
        return False, f"Campo 'tipo_resposta' inválido ou ausente: '{tipo_resposta}'."
        
    estrutura = questao.get("estrutura")
    if not isinstance(estrutura, list) or not estrutura:
        return False, "Campo 'estrutura' ausente ou vazio."
        
    # Validar se há texto real (evitando zero extrações)
    total_text = ""
    for idx, item in enumerate(estrutura):
        if not isinstance(item, dict):
            return False, f"Item na estrutura na posição {idx} não é um dicionário."
        if "tipo" not in item or "conteudo" not in item:
            return False, f"Item na estrutura na posição {idx} está sem 'tipo' ou 'conteudo'."
        if item.get("tipo") != "imagem":
            total_text += str(item.get("conteudo") or "")
            
    if len(total_text.strip()) < 3:
        return False, "O conteúdo textual extraído da questão é vazio ou curto demais (menos de 3 caracteres)."
        
    # Validar campos de metadados obrigatórios pelo schema
    for field in ("materias_possiveis", "palavras_chave"):
        if field not in questao or not isinstance(questao[field], list):
            return False, f"Campo obrigatório '{field}' ausente ou não é uma lista."
            
    # Validar alternativas para questões objetivas
    if tipo_resposta == "objetiva":
        alternativas = questao.get("alternativas")
        if not isinstance(alternativas, list):
            return False, "Campo 'alternativas' ausente ou não é uma lista para questão objetiva."
        if len(alternativas) == 0:
            return False, "Questão objetiva declarada com lista de alternativas vazia."
        for idx, alt in enumerate(alternativas):
            if not isinstance(alt, dict):
                return False, f"Alternativa na posição {idx} não é um dicionário."
            if "letra" not in alt or "estrutura" not in alt:
                return False, f"Alternativa na posição {idx} está sem 'letra' ou 'estrutura'."
            letra = alt.get("letra")
            if not letra or not isinstance(letra, str) or not letra.strip():
                return False, f"Alternativa na posição {idx} possui campo 'letra' inválido ou vazio."
            alt_estrutura = alt.get("estrutura")
            if not isinstance(alt_estrutura, list) or not alt_estrutura:
                return False, f"Alternativa '{letra}' está sem blocos em 'estrutura' ou está vazia."
                
    return True, ""






def call_gemini_with_retry(model, contents, config, max_retries=MAX_RETRIES):
    """Call Gemini API with rate limit retry logic and fallback models."""
    def clean_schema(schema):
        if isinstance(schema, dict):
            cleaned = {}
            for k, v in schema.items():
                if k in ("additionalProperties", "additional_properties"):
                    continue
                cleaned[k] = clean_schema(v)
            return cleaned
        elif isinstance(schema, list):
            return [clean_schema(item) for item in schema]
        return schema

    if config and hasattr(config, "response_schema") and config.response_schema:
        if isinstance(config.response_schema, dict):
            try:
                config = config.model_copy(update={"response_schema": clean_schema(config.response_schema)})
            except AttributeError:
                try:
                    config = config.copy(update={"response_schema": clean_schema(config.response_schema)})
                except Exception:
                    try:
                        config.response_schema = clean_schema(config.response_schema)
                    except Exception:
                        pass

    primary_model = model
    models_to_try = [primary_model]
    for fb in [
        "models/gemma-4-31b-it",
        "models/gemma-4-26b-a4b-it",
        "models/gemini-3.5-flash",
        "models/gemini-3-flash-preview",
        "models/gemini-3.1-flash-lite",
        "models/gemini-2.5-flash",
        "models/gemini-2.5-flash-lite"
    ]:
        if fb not in models_to_try:
            models_to_try.append(fb)
            
    last_exception = None
    
    for current_model in models_to_try:
        print(f"    🤖 Attempting with model: {current_model}...")
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=current_model,
                    contents=contents,
                    config=config,
                )
                print(f"    ✅ Success with model: {current_model}")
                return response
            except Exception as e:
                error_str = str(e).lower()
                last_exception = e
                
                # Check for rate limit / quota / timeout / transient error / internal error
                is_rate_limit = "429" in error_str or "rate" in error_str or "quota" in error_str
                is_transient = "503" in error_str or "500" in error_str or "internal" in error_str or "timeout" in error_str
                
                if is_rate_limit or is_transient:
                    wait = RETRY_DELAY * (attempt + 1)
                    print(f"      ⚠️ API warning ({e}) on attempt {attempt + 1}/{max_retries}. Waiting {wait}s...")
                    time.sleep(wait)
                else:
                    if isinstance(e, (AttributeError, NameError, TypeError)):
                        raise
                    print(f"      ❌ Model {current_model} failed with non-transient error: {e}. Trying next fallback...")
                    break
        else:
            print(f"      ❌ Model {current_model} exhausted all retries. Trying next fallback...")
            
    if last_exception:
        error_str = str(last_exception).lower()
        if "429" in error_str or "rate" in error_str or "quota" in error_str:
            raise RateLimitError(str(last_exception))
        raise last_exception
    raise Exception("All model attempts failed")


class RateLimitError(Exception):
    pass


# ─── Pipeline Steps ──────────────────────────────────────────────

def detect_regions(page_img: Image.Image):
    """Step 1: Detect question regions in a page image."""
    b64 = image_to_base64(page_img)
    print(f"    [Region Detect] Enviando imagem (base64 size: {len(b64)} chars) para detecção de regiões...")

    start_time = time.time()
    response = call_gemini_with_retry(
        model=REGION_MODEL,
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=base64.b64decode(b64), mime_type="image/png"),
                    types.Part.from_text(text=REGION_DETECT_PROMPT),
                ]
            ),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=REGION_DETECT_SCHEMA,
            temperature=0.1,
        ),
    )

    elapsed = time.time() - start_time
    text = response.text
    print(f"    [Region Detect] Resposta recebida em {elapsed:.2f}s (tamanho: {len(text or '')} chars).")
    return parse_json_response(text)


def extract_question(cropped_img: Image.Image):
    """Step 2: Extract structured question data from a cropped region."""
    b64 = image_to_base64(cropped_img)
    print(f"      [Extract Question] Chamando Gemini com crop (base64 size: {len(b64)} chars)...")

    start_time = time.time()
    response = call_gemini_with_retry(
        model=EXTRACT_MODEL,
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=base64.b64decode(b64), mime_type="image/png"),
                    types.Part.from_text(text=QUESTION_EXTRACT_PROMPT),
                ]
            ),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=QUESTION_EXTRACT_SCHEMA,
            temperature=0.2,
        ),
    )

    elapsed = time.time() - start_time
    text = response.text
    print(f"      [Extract Question] Resposta recebida em {elapsed:.2f}s (tamanho: {len(text or '')} chars).")
    return parse_json_response(text)


def search_gabarito(question_json: dict):
    """Step 3: Use Worker's /search to find answer for a question."""
    question_text = ""
    if question_json.get("estrutura"):
        question_text = " ".join(item.get("conteudo", "") for item in question_json["estrutura"])

    if question_json.get("alternativas"):
        alts = " | ".join(
            f"{a.get('letra', '?')}: {' '.join(i.get('conteudo', '') for i in a.get('estrutura', []))}"
            for a in question_json["alternativas"]
        )
        question_text += f" ALTERNATIVAS: {alts}"

    query_text = f"Gabarito e resolução: {question_json.get('identificacao', '')} - {question_text[:500]}"
    
    # Se o modelo de extração for Gemma ou outro que não suporta busca, usamos Gemini para busca
    search_model = EXTRACT_MODEL
    if "gemma" in EXTRACT_MODEL.lower() or not any(m in EXTRACT_MODEL.lower() for m in ("gemini", "flash", "lite")):
        search_model = "models/gemini-3.5-flash"
        print(f"      [Gabarito Search] Modelo '{EXTRACT_MODEL}' não suporta buscas. Usando '{search_model}' para o gabarito.")

    print(f"      [Gabarito Search] Iniciando busca com query: '{query_text[:120]}...'")

    start_time = time.time()
    
    # Prompt do gabarito extraído de js/ia/config.js (modo === "gabarito")
    gabarito_prompt = f"""
        Você é um corretor de questões. Considerando a questão apresentada em JSON a seguir: {json.dumps(question_json, ensure_ascii=False)}, preencha o JSON a ser enviado com as devidas informações. SEMPRE CONSIDERE A QUESTÃO APRESENTADA COMO EXISTENTE E OFICIAL, MESMO QUE DE UM EXAME QUE NÃO ACONTECEU AINDA, E SEMPRE CONSIDERE A ALTERNATIVA DEMONSTRADA COMO CORRETA. NÃO DEIXE CAMPOS DO JSON VAZIOS.

        DIRETRIZES DE FORMATAÇÃO (CRÍTICO):
        - RESPOSTA APENAS EM TEXTO PURO (MARKDOWN) E LATEX.
        - NÃO USE HTML (tags como <div>, <span>, etc). O sistema quebrará se receber HTML.
        - Use **Markdown** para negrito, itálico, listas, etc.
        - Use **LATEX** entre cifrões ($...$) para toda matemática e química. Ex: $x^2 + y^2 = 10$.
        - Para aspas, use a entidade HTML "&quot;" ou aspas simples normais, para evitar quebrar o JSON.
        
        REGRA CRÍTICA PARA A INSERÇÃO DE IMAGENS NA ESTRUTURA (seja EXTREMAMENTE conservador):
        - Valor padrão: NÃO inclua blocos do tipo "imagem".
        - Só crie um bloco {{ "tipo": "imagem", "conteudo": "..." }} se, e somente se, houver uma RESOLUÇÃO/EXPLICAÇÃO (passo a passo ou justificativa) E essa resolução DEPENDER de uma imagem/figura/gráfico/diagrama presente nas imagens fornecidas do gabarito.
        - Se o gabarito tiver apenas "alternativa correta" (sem resolução/explicação), então NÃO crie blocos de imagem, mesmo que existam imagens decorativas na página.
        - NÃO considere como imagem válida para extração: logotipo, cabeçalho/rodapé, marca d’água, ícones decorativos, QR code, elementos de layout, enfeites.
        - Se houver explicação apenas em texto e ela não usar explicitamente uma figura/gráfico/diagrama do próprio gabarito, NÃO crie bloco de imagem.
        - Se houver qualquer dúvida/incerteza (ex.: parece ter figura mas pode ser só layout, ou não fica claro que a resolução usa a figura), NÃO crie bloco de imagem.
        - Em resumo: só adicione um bloco de imagem na estrutura quando for MUITO evidente que a resolução do gabarito usa uma figura/gráfico/diagrama que está realmente presente nas imagens enviadas.

        “Considere somente imagens com carimbo ATUAL como evidência principal para alternativa correta e resolução.”
        “Use SUPORTE apenas para contexto/consistência; nunca para decidir a letra correta se ATUAL já contém isso. NUNCA utilize imagens de SUPORTE para dizer que há imagens na resolução.”

        ESTRUTURAÇÃO DOS PASSOS ("explicacao"):
        - cada passo da resolução é composto por uma lista de blocos ("estrutura").
        - Se um passo envolve: "Texto explicando -> Equação -> Gráfico", crie 3 blocos dentro da estrutura desse passo.
        - NÃO use OCR em imagens. Se houver uma imagem na resolução, crie um bloco {{tipo: "imagem", conteudo: "descrição visual..."}}.
        - CREDITE CADA PASSO, dado como gerado por IA ou como do material scaneado.

        IMPORTANTE SOBRE ESTILO E ORDEM DOS PASSOS:
        1. NÃO NUMERE OS PASSOS NO CONTEÚDO: O sistema já exibe "Passo 1", "Passo 2" automaticamente.
        - ERRADO: {{tipo: "texto", conteudo: "1. Primeiramente calculamos..."}}
        - CERTO: {{tipo: "texto", conteudo: "Primeiramente calculamos..."}}
        2. TÍTULOS DOS PASSOS: Se o passo tiver um título lógico (ex: "Cálculo da Massa"), use um bloco do tipo "titulo" como o PRIMEIRO item da estrutura desse passo.
        - Exemplo: estrutura: [ {{tipo: "titulo", conteudo: "Cálculo da Massa"}}, {{tipo: "texto", conteudo: "..."}} ]
        3. SEM PREFIXOS REDUNDANTES: Não inicie o texto com "Resolução:", "Explicação:" ou "Passo:". Vá direto ao assunto.
        4. No primeiro passo, NÃO UTILIZE UM TÍTULO como "Resolução", "Explicação", ou parecidos, pois o sistema também já realiza essa estrutura.

        REGRA PARA "analise_complexidade":
        - Seja criterioso. Marque 'true' apenas se o fator for realmente determinante para a dificuldade.
        - Na justificativa, explique qual o maior gargalo para o aluno (ex: "A dificuldade vem da união de vocabulário arcaico com a necessidade de cálculo estequiométrico").
    """.strip()

    # Use Gemini Search (grounding) via Worker
    try:
        resp = requests.post(f"{WORKER_URL}/search", json={
            "texto": gabarito_prompt,
            "query": query_text,
            "model": search_model,
            "schema": _get_gabarito_schema(),
            "jsonMode": True,
        }, timeout=120)
        resp.raise_for_status()
        elapsed = time.time() - start_time
        print(f"      [Gabarito Search] Requisição retornou status {resp.status_code} em {elapsed:.2f}s.")

        # Parse NDJSON stream response
        answer_text = ""
        for line in resp.text.strip().split("\n"):
            if not line.strip():
                continue
            try:
                msg = json.loads(line)
                if msg.get("type") == "answer":
                    answer_text += msg.get("text", "")
            except json.JSONDecodeError:
                pass

        if answer_text:
            import re
            json_match = re.search(r'\{[\s\S]*\}', answer_text)
            if json_match:
                parsed_gabarito = json.loads(json_match.group(0))
                print(f"      [Gabarito Search] Sucesso com grounding! Alternativa correta: {parsed_gabarito.get('alternativa_correta', 'N/A')}")
                return parsed_gabarito
        print(f"      [Gabarito Search] ⚠️ Resposta vazia ou JSON não encontrado no stream.")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"      [Gabarito Search] ⚠️ Falha ao buscar gabarito com grounding em {elapsed:.2f}s: {e}")
        if 'resp' in locals() and hasattr(resp, 'text'):
            print(f"      [Gabarito Search] Resposta de erro do worker: {resp.text[:500]}")

    # Fallback: tentar gerar direto (sem busca grounding) usando o EXTRACT_MODEL
    print(f"      [Gabarito Fallback] 🔄 Geração direta sem grounding usando modelo '{EXTRACT_MODEL}'...")
    start_time_fallback = time.time()
    try:
        resp = requests.post(f"{WORKER_URL}/generate", json={
            "texto": gabarito_prompt,
            "model": EXTRACT_MODEL,
            "schema": _get_gabarito_schema(),
            "jsonMode": True,
        }, timeout=120)
        resp.raise_for_status()
        elapsed_fallback = time.time() - start_time_fallback
        print(f"      [Gabarito Fallback] Geração direta retornou status {resp.status_code} em {elapsed_fallback:.2f}s.")

        # Parse NDJSON stream response
        answer_text = ""
        for line in resp.text.strip().split("\n"):
            if not line.strip():
                continue
            try:
                msg = json.loads(line)
                if msg.get("type") == "answer":
                    answer_text += msg.get("text", "")
            except json.JSONDecodeError:
                pass

        if answer_text:
            import re
            json_match = re.search(r'\{[\s\S]*\}', answer_text)
            if json_match:
                parsed_gabarito = json.loads(json_match.group(0))
                print(f"      [Gabarito Fallback] ✅ Sucesso na geração direta! Alternativa correta: {parsed_gabarito.get('alternativa_correta', 'N/A')}")
                return parsed_gabarito
        print(f"      [Gabarito Fallback] ⚠️ Resposta vazia ou JSON não encontrado na geração direta.")
    except Exception as e:
        elapsed_fallback = time.time() - start_time_fallback
        print(f"      [Gabarito Fallback] ❌ Erro ao gerar gabarito direto em {elapsed_fallback:.2f}s: {e}")
        if 'resp' in locals() and hasattr(resp, 'text'):
            print(f"      [Gabarito Fallback] Resposta de erro do worker: {resp.text[:500]}")

    return None


def check_duplicate(text: str) -> dict:
    """Check if a question already exists in Pinecone."""
    print(f"      [Dedup Check] Buscando duplicata para: '{text[:100]}...'")
    start_time = time.time()
    try:
        resp = requests.post(f"{WORKER_URL}/check-duplicate", json={"text": text}, timeout=30)
        elapsed = time.time() - start_time
        if resp.ok:
            res = resp.json()
            exists = res.get("exists", False)
            matches = res.get("matches", [])
            if exists and matches:
                print(f"      [Dedup Check] Duplicata ENCONTRADA! Score: {matches[0].get('score', 0):.3f} (ID: {matches[0].get('id', '')}) em {elapsed:.2f}s.")
            else:
                print(f"      [Dedup Check] Nenhuma duplicata encontrada em {elapsed:.2f}s.")
            return res
        else:
            print(f"      [Dedup Check] ⚠️ Falha na requisição de dedup (status {resp.status_code}): {resp.text[:200]}")
    except Exception as e:
        print(f"      [Dedup Check] ❌ Erro na requisição de dedup: {e}")
    return {"exists": False, "matches": []}


def save_question(questao: dict, gabarito: dict, source_pdf: str, page_num: int) -> dict:
    """Save extracted question via Worker."""
    print(f"      [Save DB] Salvando questão '{questao.get('identificacao')}' no banco via Worker...")
    start_time = time.time()
    try:
        resp = requests.post(f"{WORKER_URL}/extract-and-save", json={
            "questao": questao,
            "gabarito": gabarito,
            "source_slug": SLUG,
            "source_pdf": source_pdf,
            "page_num": page_num,
        }, timeout=60)

        resp.raise_for_status()

        elapsed = time.time() - start_time
        res = resp.json()
        print(f"      [Save DB] Resposta do Worker (recebida em {elapsed:.2f}s): {json.dumps(res, ensure_ascii=False)}")
        return res
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"      [Save DB] ❌ Erro ao salvar questão em {elapsed:.2f}s: {e}")
        if 'resp' in locals() and hasattr(resp, 'text'):
            print(f"      [Save DB] Resposta de erro do Worker: {resp.text[:500]}")
    return None


def verify_firebase_existence(firebase_path: str, pinecone_id: str = None) -> bool:
    """Verifica com o Worker se a questão realmente existe no Firebase. Se não existir, solicita a exclusão no Pinecone."""
    if not firebase_path:
        return False
    print(f"      [Firebase Check] Verificando existência de '{firebase_path}' no Firebase...")
    try:
        payload = {
            "path": firebase_path,
            "delete_if_missing": True
        }
        if pinecone_id:
            payload["pinecone_id"] = pinecone_id
            
        resp = requests.post(f"{WORKER_URL}/check-question", json=payload, timeout=20)
        if resp.ok:
            data = resp.json()
            exists = data.get("exists", False)
            deleted_pinecone = data.get("deleted_from_pinecone", False)
            if exists:
                print(f"      [Firebase Check] ✅ Questão encontrada no Firebase.")
                return True
            else:
                msg = "⚠️ Questão NÃO encontrada no Firebase!"
                if deleted_pinecone:
                    msg += f" Registro órfão deletado do Pinecone (ID: {data.get('pinecone_id')}) com sucesso."
                msg += " Forçando re-processamento completo."
                print(f"      [Firebase Check] {msg}")
                return False
        else:
            print(f"      [Firebase Check] ⚠️ Erro na resposta do Worker ({resp.status_code}). Assumindo que existe por segurança.")
            return True
    except Exception as e:
        print(f"      [Firebase Check] ❌ Erro ao verificar existência no Firebase: {e}. Assumindo que existe por segurança.")
        return True


def _get_gabarito_schema():
    """Simplified gabarito schema for server-side use."""
    return {
        "type": "object",
        "properties": {
            "alternativa_correta": {"type": "string"},
            "justificativa_curta": {"type": "string"},
            "resposta_modelo": {"type": "string", "description": "Para questões dissertativas"},
            "confianca": {"type": "number", "minimum": 0, "maximum": 1},
            "explicacao": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "estrutura": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "tipo": {"type": "string"},
                                    "conteudo": {"type": "string"},
                                },
                                "required": ["tipo", "conteudo"],
                            },
                        },
                        "origem": {"type": "string"},
                    },
                    "required": ["estrutura"],
                },
            },
            "alternativas_analisadas": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "letra": {"type": "string"},
                        "correta": {"type": "boolean"},
                        "motivo": {"type": "string"},
                    },
                    "required": ["letra", "correta", "motivo"],
                },
            },
            "analise_complexidade": {
                "type": "object",
                "properties": {
                    "fatores": {
                        "type": "object",
                        "properties": {
                            "texto_extenso": {"type": "boolean"},
                            "vocabulario_complexo": {"type": "boolean"},
                            "multiplas_fontes_leitura": {"type": "boolean"},
                            "interpretacao_visual": {"type": "boolean"},
                            "dependencia_conteudo_externo": {"type": "boolean"},
                            "interdisciplinaridade": {"type": "boolean"},
                            "resolucao_multiplas_etapas": {"type": "boolean"},
                            "distratores_semanticos": {"type": "boolean"},
                        },
                    },
                    "justificativa_dificuldade": {"type": "string"},
                },
                "required": ["fatores", "justificativa_dificuldade"],
            },
            "creditos": {
                "type": "object",
                "properties": {
                    "origem_resolucao": {"type": "string"},
                    "material_identificado": {"type": "boolean"},
                    "material": {"type": "string"},
                    "autor_ou_instituicao": {"type": "string"},
                    "ano": {"type": "string"},
                },
            },
        },
        "required": ["alternativa_correta", "justificativa_curta", "confianca", "explicacao"],
    }


# ─── Main Pipeline ───────────────────────────────────────────────

def main():
    print(f"\n{'='*80}")
    print(f"🚀 Iniciando Pipeline de Extração - Manifest: {MANIFEST_PATH}")
    print(f"{'='*80}")

    manifest = load_manifest()
    manifest["status"] = "in_progress"

    items = []
    if isinstance(manifest, list):
        items = manifest
    elif isinstance(manifest, dict):
        items = manifest.get("results", manifest.get("files", manifest.get("items", [])))

    if not items:
        print("❌ Nenhum item válido encontrado no manifesto para processamento")
        manifest["status"] = "error"
        manifest["error"] = "No items to process"
        save_manifest(manifest)
        sys.exit(1)

    pdf_dir = "pdfs"
    os.makedirs(pdf_dir, exist_ok=True)
    
    total_extracted = 0
    total_skipped = 0
    total_failed = 0

    # Recalcular totais a partir dos itens existentes no manifesto
    for item in items:
        data = item.get("extraction_results", {})
        for page, pdata in data.get("pages", {}).items():
            for q in pdata.get("questions", []):
                if q["status"] == "extracted":
                    total_extracted += 1
                elif q["status"] == "skipped_dedup":
                    total_skipped += 1
                elif q["status"] == "failed":
                    total_failed += 1

    print(f"📊 Estado Inicial:")
    print(f"   Total de itens (PDFs) no manifesto: {len(items)}")
    print(f"   Questões já extraídas: {total_extracted}")
    print(f"   Questões já puladas (dedup): {total_skipped}")
    print(f"   Questões falhas anteriormente: {total_failed}")

    try:
        import urllib.request
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        for item_idx, item in enumerate(items):
            url = item.get("url") or item.get("link") or item.get("link_origem") or item.get("external_url")
            if not url or not url.startswith("http"):
                print(f"⚠️ Item {item_idx} pulado: URL ausente ou inválida ('{url}')")
                continue

            if "extraction_results" not in item:
                item["extraction_results"] = {"pages": {}, "status": "pending"}
            
            # Se o status do item já está completo, pulamos o processamento dele
            if item["extraction_results"].get("status") == "complete":
                print(f"⏭️ Item {item_idx} ('{item.get('name')}') já está 'complete'. Pulando.")
                continue

            name = item.get("name") or item.get("nome") or "doc"
            safe_name = "".join(c for c in name if c.isalnum() or c in "._- ")
            if not safe_name.lower().endswith(".pdf"):
                safe_name += ".pdf"
            
            pdf_path = os.path.join(pdf_dir, f"doc_{item_idx}_{safe_name}")
            pdf_name = f"doc_{item_idx}_{safe_name}"

            print(f"\n{'='*60}")
            print(f"📄 Processando Item [{item_idx + 1}/{len(items)}]: {safe_name}")
            print(f"   URL: {url}")
            print(f"{'='*60}")

            # Baixar o PDF caso não exista localmente
            if not os.path.exists(pdf_path):
                print(f"  📥 Baixando arquivo para {pdf_path}...")
                download_start = time.time()
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, context=ctx, timeout=30) as response, open(pdf_path, 'wb') as out_file:
                        out_file.write(response.read())
                    print(f"  ✅ Download finalizado em {time.time() - download_start:.2f}s (tamanho: {os.path.getsize(pdf_path)} bytes).")
                except Exception as e:
                    print(f"  ❌ Falha no download de {url}: {e}")
                    item["extraction_results"]["status"] = "error"
                    item["extraction_results"]["error"] = f"Download failed: {e}"
                    save_manifest(manifest)
                    continue
            else:
                print(f"  💾 Arquivo PDF já existe localmente: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")

            # Converter PDF em imagens
            print(f"  📃 Convertendo PDF em imagens (DPI=200)...")
            convert_start = time.time()
            try:
                pages = convert_from_path(pdf_path, dpi=200)
                print(f"  ✅ PDF convertido em {len(pages)} imagem(ns) de página em {time.time() - convert_start:.2f}s.")
            except Exception as e:
                print(f"  ❌ Falha ao converter PDF: {e}")
                item["extraction_results"]["status"] = "error"
                item["extraction_results"]["error"] = f"PDF convert failed: {e}"
                save_manifest(manifest)
                continue

            for page_idx, page_img in enumerate(pages):
                page_num = page_idx + 1
                page_key = str(page_num)

                # Verificar se a página já foi processada com absoluto sucesso
                results_pages = item["extraction_results"].get("pages", {})
                page_data = results_pages.get(page_key, {})
                questions = page_data.get("questions", [])
                
                has_page_error = "error" in page_data
                has_failed_questions = any(q.get("status") in ("failed", "pending") for q in questions)
                
                # Só pula a página se ela existir no manifesto e não tiver erros nem questões falhas/pendentes
                if page_key in results_pages and not has_page_error and not has_failed_questions:
                    print(f"  ⏭️ Página {page_num}/{len(pages)}: já foi processada com sucesso anteriormente. Pulando.")
                    continue

                print(f"\n  📃 Analisando Página {page_num}/{len(pages)}...")

                # Passo 1: Detecção de Regiões com Loop de Auditoria
                regions = []
                raw_gemini = {}
                try:
                    print(f"    🔍 Detectando regiões da página...")
                    regions_result = detect_regions(page_img)
                    current_json = regions_result
                    raw_gemini = current_json
                    
                    if current_json.get("regions"):
                        print(f"    ️🕵️ Auditando {len(current_json['regions'])} região(ões) detectada(s)...")
                        # 2. Auditoria (Review)
                        b64 = image_to_base64(page_img)
                        review_response = call_gemini_with_retry(
                            model=REGION_MODEL,
                            contents=[
                                types.Content(
                                    parts=[
                                        types.Part.from_bytes(data=base64.b64decode(b64), mime_type="image/png"),
                                        types.Part.from_text(text=build_review_prompt(current_json)),
                                    ]
                                )
                            ],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=REVIEW_SCHEMA,
                                temperature=0.1,
                            ),
                        )
                        review_result = parse_json_response(review_response.text)
                        
                        if review_result.get("ok"):
                            print(f"      ✅ Auditoria aprovada de primeira!")
                            regions = current_json.get("regions", [])
                        else:
                            feedback = review_result.get("feedback", "Correção necessária")
                            print(f"      ❌ Auditoria reprovada: {feedback}")
                            print(f"    🛠️ Aplicando loop de correção com base no feedback...")
                            
                            # 3. Correção (Correction)
                            correction_response = call_gemini_with_retry(
                                model=REGION_MODEL,
                                contents=[
                                    types.Content(
                                        parts=[
                                            types.Part.from_bytes(data=base64.b64decode(b64), mime_type="image/png"),
                                            types.Part.from_text(text=build_correction_prompt(current_json, feedback)),
                                        ]
                                    )
                                ],
                                config=types.GenerateContentConfig(
                                    response_mime_type="application/json",
                                    response_schema=REGION_DETECT_SCHEMA,
                                    temperature=0.1,
                                ),
                            )
                            corrected_json = parse_json_response(correction_response.text)
                            
                            if corrected_json and corrected_json.get("regions"):
                                print(f"      ✅ Correção aplicada com sucesso! ({len(corrected_json['regions'])} regiões novas)")
                                regions = corrected_json.get("regions", [])
                                raw_gemini = corrected_json
                            else:
                                print(f"      ⚠️ Correção retornou vazia, mantendo regiões originais.")
                                regions = current_json.get("regions", [])
                    else:
                        print(f"    ℹ️ Nenhuma região de questão foi detectada pela IA nesta página.")

                except RateLimitError:
                    print(f"  ⚠️ RATE LIMIT atingido na detecção de regiões! Salvando checkpoint e encerrando...")
                    manifest["rate_limit_hit"] = True
                    save_manifest(manifest)
                    sys.exit(0)
                except (AttributeError, NameError, TypeError):
                    raise
                except Exception as e:
                    print(f"    ❌ Falha na detecção de regiões ou auditoria da página: {e}")
                    traceback.print_exc()
                    if "pages" not in item["extraction_results"]:
                        item["extraction_results"]["pages"] = {}
                    item["extraction_results"]["pages"][page_key] = {
                        "regions_detected": 0,
                        "error": str(e),
                        "questions": [],
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
                    save_manifest(manifest)
                    continue

                # Agrupar regiões por questionId
                question_groups = {}
                for region in regions:
                    if not isinstance(region, dict) or "box" not in region:
                        print(f"    ⚠️ Região inválida ignorada no agrupamento: {region}")
                        continue
                    qid = region.get("questionId") or region.get("id") or "unknown"
                    qid = str(qid).strip()
                    if not qid:
                        qid = "unknown"
                    if qid not in question_groups:
                        question_groups[qid] = []
                    question_groups[qid].append(region)

                page_questions = []

                for qid, q_regions in question_groups.items():
                    print(f"    📝 Analisando Questão {qid} ({len(q_regions)} região(ões) agrupada(s))")

                    q_entry = {
                        "questionId": qid,
                        "status": "pending",
                        "regions": len(q_regions),
                    }

                    # --- Lógica de Reaproveitamento de Questões Bem-sucedidas ---
                    # Se esta questão já foi extraída com sucesso numa execução anterior, reutilizamos o status!
                    previous_questions = page_data.get("questions", [])
                    previous_q = next((q for q in previous_questions if q.get("questionId") == qid), None)
                    
                    if previous_q and previous_q.get("status") in ("extracted", "skipped_dedup"):
                        # Se o status for 'extracted', verificamos se a questão realmente existe no Firebase
                        is_in_firebase = True
                        if previous_q.get("status") == "extracted":
                            is_in_firebase = verify_firebase_existence(previous_q.get("firebase_path"), previous_q.get("pinecone_id"))
                            
                        if is_in_firebase:
                            print(f"      ⏭️ Questão {qid} já foi extraída/pulada com sucesso anteriormente (status: {previous_q['status']}). REAPROVEITANDO.")
                            q_entry["status"] = previous_q["status"]
                            # Copiar dados anteriores
                            for key in ("pinecone_id", "firebase_path", "tipo_resposta", "dedup_match_id", "dedup_match_score", "error"):
                                if key in previous_q:
                                    q_entry[key] = previous_q[key]
                            page_questions.append(q_entry)
                            continue

                    try:
                        # Recortar e mesclar as imagens da questão
                        cropped_images = []
                        for idx, region in enumerate(q_regions):
                            try:
                                cropped = crop_region(page_img, region["box"])
                                cropped_images.append(cropped)
                            except Exception as crop_err:
                                print(f"      ❌ Erro ao recortar região {idx} da questão {qid}: {crop_err}")
                                raise

                        main_crop = cropped_images[0]
                        if len(cropped_images) > 1:
                            # Empilhar verticalmente as imagens
                            total_h = sum(img.height for img in cropped_images)
                            max_w = max(img.width for img in cropped_images)
                            combined = Image.new("RGB", (max_w, total_h), "white")
                            y_offset = 0
                            for img in cropped_images:
                                combined.paste(img, (0, y_offset))
                                y_offset += img.height
                            main_crop = combined
                            print(f"      [Merge] Mescladas {len(cropped_images)} regiões verticalmente (W={max_w}, H={total_h}).")

                        # Passo 2: Extrair JSON estruturado da questão
                        questao = extract_question(main_crop)
                        
                        # --- Validação Estrutural Completa (Prevenir Dados Problemáticos) ---
                        is_valid, validation_reason = validate_question(questao)
                        if not is_valid:
                            print(f"      ❌ Validação da Questão {qid} FALHOU: {validation_reason}. Abortando salvamento.")
                            q_entry["status"] = "failed"
                            q_entry["error"] = f"Validation failed: {validation_reason}"
                            total_failed += 1
                            page_questions.append(q_entry)
                            continue

                        print(f"      ✅ Validação da Questão {qid} Aprovada. Identificação extraída: '{questao.get('identificacao')}'")

                        # Construir texto semântico para o Pinecone
                        semantic_parts = []
                        if questao.get("materias_possiveis"):
                            semantic_parts.append(f"MATÉRIA: {', '.join(questao['materias_possiveis'])}")
                        if questao.get("estrutura"):
                            text_content = " ".join(s.get("conteudo", "") for s in questao["estrutura"])
                            semantic_parts.append(text_content[:500])
                        semantic_text = " ".join(semantic_parts)

                        # Passo 3: Verificar duplicatas no Pinecone
                        dedup = check_duplicate(semantic_text)
                        if dedup.get("exists"):
                            q_entry["status"] = "skipped_dedup"
                            q_entry["dedup_match_id"] = dedup["matches"][0]["id"]
                            q_entry["dedup_match_score"] = dedup["matches"][0]["score"]
                            total_skipped += 1
                            page_questions.append(q_entry)
                            continue

                        # Passo 4: Buscar gabarito via Worker (Google Search)
                        gabarito = search_gabarito(questao)
                        if gabarito:
                            print(f"      ✅ Gabarito retornado: {gabarito.get('alternativa_correta', 'dissertativa/modelo')}")
                        else:
                            print(f"      ⚠️ Gabarito não retornado pelo worker. Utilizando fallback vazio.")
                            gabarito = {
                                "alternativa_correta": "",
                                "justificativa_curta": "Gabarito não encontrado automaticamente.",
                                "confianca": 0,
                                "explicacao": [],
                            }

                        # Passo 5: Salvar no Pinecone e Firebase
                        save_result = save_question(questao, gabarito, pdf_name, page_num)
                        if save_result and save_result.get("saved"):
                            q_entry["status"] = "extracted"
                            q_entry["pinecone_id"] = save_result.get("pinecone_id", "")
                            q_entry["firebase_path"] = save_result.get("firebase_path", "")
                            q_entry["tipo_resposta"] = save_result.get("tipo_resposta", "objetiva")
                            total_extracted += 1
                            if "error" in q_entry:
                                del q_entry["error"]
                        else:
                            print(f"      ❌ Falha ao salvar a questão {qid} no banco de dados.")
                            q_entry["status"] = "failed"
                            q_entry["error"] = "Save to database failed"
                            total_failed += 1

                    except RateLimitError:
                        print(f"  ⚠️ RATE LIMIT atingido durante processamento da questão {qid}! Salvando checkpoint...")
                        q_entry["status"] = "pending"
                        page_questions.append(q_entry)
                        
                        if "pages" not in item["extraction_results"]:
                            item["extraction_results"]["pages"] = {}
                        item["extraction_results"]["pages"][page_key] = {
                            "regions_detected": len(regions),
                            "questions": page_questions,
                            "raw_gemini_response": raw_gemini,
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        }
                        manifest["rate_limit_hit"] = True
                        save_manifest(manifest)
                        sys.exit(0)

                    except (AttributeError, NameError, TypeError):
                        raise
                    except Exception as e:
                        print(f"      ❌ Erro inesperado na questão {qid}: {e}")
                        traceback.print_exc()
                        q_entry["status"] = "failed"
                        q_entry["error"] = str(e)
                        total_failed += 1

                    page_questions.append(q_entry)

                # Salvar os resultados da página no manifesto do Hugging Face
                if "pages" not in item["extraction_results"]:
                    item["extraction_results"]["pages"] = {}
                item["extraction_results"]["pages"][page_key] = {
                    "regions_detected": len(regions),
                    "questions": page_questions,
                    "raw_gemini_response": raw_gemini,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
                save_manifest(manifest)
                print(f"  ✅ Página {page_num} processada e manifest atualizado.")

                # Pequeno delay entre páginas para evitar limites de taxa (Rate Limits)
                time.sleep(2)
            
            # --- Validação de Conclusão do Item (PDF) ---
            print(f"  🔍 Verificando integridade da extração do item '{safe_name}'...")
            item_complete = True
            pages_dict = item["extraction_results"].get("pages", {})
            
            if len(pages_dict) < len(pages):
                print(f"  ⚠️ Item incompleto: apenas {len(pages_dict)} de {len(pages)} páginas processadas.")
                item_complete = False
            else:
                for p_key, pdata in pages_dict.items():
                    if "error" in pdata:
                        print(f"  ⚠️ Página {p_key} tem um erro registrado: {pdata['error']}")
                        item_complete = False
                        break
                    p_questions = pdata.get("questions", [])
                    failed_qs = [q.get("questionId") for q in p_questions if q.get("status") in ("failed", "pending")]
                    if failed_qs:
                        print(f"  ⚠️ Página {p_key} possui questões marcadas como falhas ou pendentes: {failed_qs}")
                        item_complete = False
                        break
            
            if item_complete:
                print(f"  🎉 Item '{safe_name}' extraído com 100% de sucesso!")
                item["extraction_results"]["status"] = "complete"
                if "error" in item["extraction_results"]:
                    del item["extraction_results"]["error"]
            else:
                print(f"  ⚠️ Item '{safe_name}' ficará como 'partial' para permitir retentativas futuras.")
                item["extraction_results"]["status"] = "partial"

            save_manifest(manifest)

    except RateLimitError:
        print("\n⚠️ RATE LIMIT global atingido. Checkpoint salvo. Encerrando execução.")
        manifest["rate_limit_hit"] = True
        save_manifest(manifest)
        sys.exit(0)

    except Exception as e:
        print(f"\n❌ Erro crítico no pipeline: {e}")
        traceback.print_exc()
        manifest["status"] = "error"
        manifest["error"] = str(e)
        save_manifest(manifest)
        sys.exit(1)

    # --- Validação de Conclusão de Todo o Manifesto ---
    all_complete = True
    for item_idx, item in enumerate(items):
        item_status = item.get("extraction_results", {}).get("status")
        if item_status != "complete":
            print(f"⚠️ Manifesto pendente: Item {item_idx} ({item.get('name')}) está com status '{item_status}'")
            all_complete = False

    if all_complete:
        print(f"\n🏆 Todos os PDFs foram extraídos com sucesso absoluta! Finalizando manifesto como 'complete'.")
        manifest["status"] = "complete"
        manifest["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        if "error" in manifest:
            del manifest["error"]
    else:
        print(f"\n⚠️ Algumas extrações falharam ou estão incompletas. Manifesto finalizado como 'partial'.")
        manifest["status"] = "partial"
        manifest["error"] = "Alguns itens falharam ou tiveram extrações parciais"
        
    save_manifest(manifest)

    print(f"\n{'='*80}")
    print(f"📊 Resumo Final da Execução:")
    print(f"   Status do Manifesto: {manifest.get('status')}")
    print(f"   Questões Extraídas com Sucesso: {total_extracted}")
    print(f"   Questões Puladas (Deduplicadas): {total_skipped}")
    print(f"   Questões que Falharam (Sem DB): {total_failed}")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
