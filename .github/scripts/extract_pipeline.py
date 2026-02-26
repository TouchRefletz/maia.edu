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
WORKER_URL = os.environ.get("WORKER_URL", "https://maia-api.jfrfrfr.workers.dev")
GEMINI_KEY = os.environ["GOOGLE_GENAI_API_KEY"]
SLUG = os.environ["SLUG"]
MANIFEST_PATH = os.environ.get("MANIFEST_PATH", "work/manifest.json")
QUERY = os.environ.get("QUERY", "")
INSTITUTION = os.environ.get("INSTITUTION", "")
SUBJECT = os.environ.get("SUBJECT", "")

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

DIRETRIZES DE FORMATAÇÃO (RIGOROSAS):
1. **MARKDOWN OBRIGATÓRIO:** Todo o conteúdo textual (exceto JSON chaves) deve ser formatado em Markdown. Use **negrito**, *itálico* onde aparecer no original.
2. **MATEMÁTICA E QUÍMICA (LATEX):**
   - TODA fórmula matemática, símbolo, variável (como 'x', 'y') ou equação química DEVE ser em LaTeX.
   - **INLINE (No meio do texto):** Use cifrões unitários. Exemplo: "A massa de $H_2O$ é..."
   - **DISPLAY (Isolada):** Use um bloco do tipo 'equacao' contendo APENAS o código LaTeX cru (sem cifrões).
3. **ESTRUTURA:**
   - Se houver Texto -> Equação Isolada -> Texto, gere 3 blocos: {tipo: 'texto'}, {tipo: 'equacao'}, {tipo: 'texto'}.
   - JAMAIS use ASCII para matemática (nada de x^2 ou H2O normal). Use $x^2$ e $H_2O$.
   - **TABELAS:** Se a questão contiver uma tabela de dados, use o tipo 'tabela' e formate em Markdown table.

Analise as imagens fornecidas e gere o JSON.
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
                "exclusivamente no campo 'identificacao'. Use 'titulo' e 'subtitulo' apenas para cabeçalhos internos "
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
    """Crop a region from page image using [y1, x1, y2, x2] in 0..1000 scale."""
    w, h = page_img.size
    y1, x1, y2, x2 = box
    left = int(x1 / 1000 * w)
    top = int(y1 / 1000 * h)
    right = int(x2 / 1000 * w)
    bottom = int(y2 / 1000 * h)
    return page_img.crop((left, top, right, bottom))





def call_gemini_with_retry(model, contents, config, max_retries=MAX_RETRIES):
    """Call Gemini API with rate limit retry logic."""
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            return response
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate" in error_str or "quota" in error_str:
                if attempt < max_retries - 1:
                    wait = RETRY_DELAY * (attempt + 1)
                    print(f"  ⏳ Rate limited (attempt {attempt + 1}/{max_retries}), waiting {wait}s...")
                    time.sleep(wait)
                else:
                    raise RateLimitError(str(e))
            else:
                raise
    raise RateLimitError("Max retries exceeded")


class RateLimitError(Exception):
    pass


# ─── Pipeline Steps ──────────────────────────────────────────────

def detect_regions(page_img: Image.Image):
    """Step 1: Detect question regions in a page image."""
    b64 = image_to_base64(page_img)

    response = call_gemini_with_retry(
        model="models/gemini-3-flash-preview",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_image(image=types.Image(image_bytes=base64.b64decode(b64), mime_type="image/png")),
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

    text = response.text
    return json.loads(text)


def extract_question(cropped_img: Image.Image):
    """Step 2: Extract structured question data from a cropped region."""
    b64 = image_to_base64(cropped_img)

    response = call_gemini_with_retry(
        model="models/gemini-3-flash-preview",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_image(image=types.Image(image_bytes=base64.b64decode(b64), mime_type="image/png")),
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

    return json.loads(response.text)


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

    # Use Gemini Search (grounding) via Worker
    try:
        resp = requests.post(f"{WORKER_URL}/search", json={
            "texto": f"""Você é um corretor de questões. Considerando a questão apresentada em JSON a seguir: {json.dumps(question_json, ensure_ascii=False)}, preencha o JSON a ser enviado com as devidas informações. SEMPRE CONSIDERE A QUESTÃO COMO EXISTENTE E OFICIAL.""",
            "query": query_text,
            "model": "models/gemini-3-flash-preview",
            "schema": _get_gabarito_schema(),
            "jsonMode": True,
        }, timeout=120)

        if resp.ok:
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
                    return json.loads(json_match.group(0))
    except Exception as e:
        print(f"  ⚠️ Gabarito search error: {e}")

    return None


def check_duplicate(text: str) -> dict:
    """Check if a question already exists in Pinecone."""
    try:
        resp = requests.post(f"{WORKER_URL}/check-duplicate", json={"text": text}, timeout=30)
        if resp.ok:
            return resp.json()
    except Exception as e:
        print(f"  ⚠️ Dedup check error: {e}")
    return {"exists": False, "matches": []}


def save_question(questao: dict, gabarito: dict, source_pdf: str, page_num: int) -> dict:
    """Save extracted question via Worker."""
    try:
        resp = requests.post(f"{WORKER_URL}/extract-and-save", json={
            "questao": questao,
            "gabarito": gabarito,
            "source_slug": SLUG,
            "source_pdf": source_pdf,
            "page_num": page_num,
        }, timeout=60)

        if resp.ok:
            return resp.json()
        else:
            print(f"  ⚠️ Save failed: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"  ⚠️ Save error: {e}")
    return None


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
    manifest = load_manifest()
    manifest["status"] = "in_progress"

    items = []
    if isinstance(manifest, list):
        items = manifest
    elif isinstance(manifest, dict):
        items = manifest.get("results", manifest.get("files", manifest.get("items", [])))

    if not items:
        print("❌ No valid items found in manifest to process")
        manifest["status"] = "error"
        manifest["error"] = "No items to process"
        save_manifest(manifest)
        sys.exit(1)

    pdf_dir = "pdfs"
    os.makedirs(pdf_dir, exist_ok=True)
    
    total_extracted = 0
    total_skipped = 0
    total_failed = 0

    # Recalculate totals from existing items
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

    print(f"📄 Found {len(items)} items to process")

    try:
        import urllib.request
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        for item_idx, item in enumerate(items):
            url = item.get("url") or item.get("link") or item.get("link_origem") or item.get("external_url")
            if not url or not url.startswith("http"):
                continue

            if "extraction_results" not in item:
                item["extraction_results"] = {"pages": {}, "status": "pending"}
            
            # Check if this item is already fully extracted
            if item["extraction_results"].get("status") == "complete":
                continue

            name = item.get("name") or item.get("nome") or "doc"
            safe_name = "".join(c for c in name if c.isalnum() or c in "._- ")
            if not safe_name.lower().endswith(".pdf"):
                safe_name += ".pdf"
            
            pdf_path = os.path.join(pdf_dir, f"doc_{item_idx}_{safe_name}")
            pdf_name = f"doc_{item_idx}_{safe_name}"

            print(f"\n{'='*60}")
            print(f"📄 Processing: {safe_name}")
            print(f"{'='*60}")

            # Download if not exists
            if not os.path.exists(pdf_path):
                print(f"  📥 Downloading {url}...")
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, context=ctx, timeout=30) as response, open(pdf_path, 'wb') as out_file:
                        out_file.write(response.read())
                except Exception as e:
                    print(f"  ❌ Failed to download {url}: {e}")
                    item["extraction_results"]["status"] = "error"
                    item["extraction_results"]["error"] = f"Download failed: {e}"
                    save_manifest(manifest)
                    continue

            # Convert PDF to images
            try:
                pages = convert_from_path(pdf_path, dpi=200)
            except Exception as e:
                print(f"  ❌ Failed to convert PDF: {e}")
                item["extraction_results"]["status"] = "error"
                item["extraction_results"]["error"] = f"PDF convert failed: {e}"
                save_manifest(manifest)
                continue

            print(f"  📃 {len(pages)} pages")

            for page_idx, page_img in enumerate(pages):
                page_num = page_idx + 1
                page_key = str(page_num)

                # Check if already processed
                results_pages = item["extraction_results"].get("pages", {})
                page_data = results_pages.get(page_key, {})
                questions = page_data.get("questions", [])
                
                if questions and all(q["status"] in ("extracted", "skipped_dedup") for q in questions):
                    print(f"  ⏭️ Page {page_num}: already processed, skipping")
                    continue

                print(f"\n  📃 Page {page_num}/{len(pages)}")

                # Step 0: Regions Extraction with Audit Loop
                regions = []
                raw_gemini = {}
                try:
                    # 1. Primeira Extração (Extraction)
                    print(f"    🔍 Detecting regions...")
                    regions_result = detect_regions(page_img)
                    current_json = regions_result
                    raw_gemini = current_json
                    
                    if current_json.get("regions"):
                        print(f"    �️‍♂️ Auditing {len(current_json['regions'])} regions...")
                        # 2. Auditoria (Review)
                        b64 = image_to_base64(page_img)
                        review_response = call_gemini_with_retry(
                            model="models/gemini-3-flash-preview",
                            contents=[
                                types.Content(
                                    parts=[
                                        types.Part.from_image(image=types.Image(image_bytes=base64.b64decode(b64), mime_type="image/png")),
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
                        review_result = json.loads(review_response.text)
                        
                        if review_result.get("ok"):
                            print(f"      ✅ Audit passed!")
                            regions = current_json.get("regions", [])
                        else:
                            feedback = review_result.get("feedback", "Correção necessária")
                            print(f"      ❌ Audit failed: {feedback}")
                            print(f"    🛠️ Correcting regions...")
                            
                            # 3. Correção (Correction)
                            correction_response = call_gemini_with_retry(
                                model="models/gemini-3-flash-preview",
                                contents=[
                                    types.Content(
                                        parts=[
                                            types.Part.from_image(image=types.Image(image_bytes=base64.b64decode(b64), mime_type="image/png")),
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
                            corrected_json = json.loads(correction_response.text)
                            
                            if corrected_json and corrected_json.get("regions"):
                                print(f"      ✅ Correction applied! ({len(corrected_json['regions'])} regions)")
                                regions = corrected_json.get("regions", [])
                                raw_gemini = corrected_json
                            else:
                                print(f"      ⚠️ Correction failed, keeping original regions.")
                                regions = current_json.get("regions", [])
                    else:
                        print(f"    ℹ️ No regions detected originally.")

                except RateLimitError:
                    print(f"  ⚠️ RATE LIMITED on region detection - saving checkpoint")
                    manifest["rate_limit_hit"] = True
                    save_manifest(manifest)
                    sys.exit(0)
                except Exception as e:
                    print(f"    ❌ Region detection/audit failed: {e}")
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

                # Group regions by questionId
                question_groups = {}
                for region in regions:
                    qid = region.get("questionId", region.get("id", "unknown"))
                    if qid not in question_groups:
                        question_groups[qid] = []
                    question_groups[qid].append(region)

                page_questions = []

                for qid, q_regions in question_groups.items():
                    print(f"    📝 Question {qid} ({len(q_regions)} region(s))")

                    q_entry = {
                        "questionId": qid,
                        "status": "pending",
                        "regions": len(q_regions),
                    }

                    try:
                        # Crop and merge regions for this question
                        cropped_images = []
                        for region in q_regions:
                            cropped = crop_region(page_img, region["box"])
                            cropped_images.append(cropped)

                        # Use first (or combined) cropped image for extraction
                        main_crop = cropped_images[0]
                        if len(cropped_images) > 1:
                            # Stack images vertically for multi-region questions
                            total_h = sum(img.height for img in cropped_images)
                            max_w = max(img.width for img in cropped_images)
                            combined = Image.new("RGB", (max_w, total_h), "white")
                            y_offset = 0
                            for img in cropped_images:
                                combined.paste(img, (0, y_offset))
                                y_offset += img.height
                            main_crop = combined

                        # Step 2: Extract structured question
                        questao = extract_question(main_crop)
                        print(f"      ✅ Extracted: {questao.get('identificacao', '?')}")

                        # Build semantic text for dedup
                        semantic_parts = []
                        if questao.get("materias_possiveis"):
                            semantic_parts.append(f"MATÉRIA: {', '.join(questao['materias_possiveis'])}")
                        if questao.get("estrutura"):
                            text_content = " ".join(s.get("conteudo", "") for s in questao["estrutura"])
                            semantic_parts.append(text_content[:500])
                        semantic_text = " ".join(semantic_parts)

                        # Step 3: Check for duplicates
                        dedup = check_duplicate(semantic_text)
                        if dedup.get("exists"):
                            print(f"      ⏭️ Duplicate found (score: {dedup['matches'][0]['score']:.3f})")
                            q_entry["status"] = "skipped_dedup"
                            q_entry["dedup_match_id"] = dedup["matches"][0]["id"]
                            q_entry["dedup_match_score"] = dedup["matches"][0]["score"]
                            total_skipped += 1
                            page_questions.append(q_entry)
                            continue

                        # Step 4: Search for gabarito
                        print(f"      🔍 Searching gabarito...")
                        gabarito = search_gabarito(questao)
                        if gabarito:
                            print(f"      ✅ Gabarito found: {gabarito.get('alternativa_correta', 'dissertativa')}")
                        else:
                            print(f"      ⚠️ No gabarito found, using empty")
                            gabarito = {
                                "alternativa_correta": "",
                                "justificativa_curta": "Gabarito não encontrado automaticamente.",
                                "confianca": 0,
                                "explicacao": [],
                            }

                        # Step 5: Save to Pinecone + Firebase
                        save_result = save_question(questao, gabarito, pdf_name, page_num)
                        if save_result and save_result.get("saved"):
                            q_entry["status"] = "extracted"
                            q_entry["pinecone_id"] = save_result.get("pinecone_id", "")
                            q_entry["firebase_path"] = save_result.get("firebase_path", "")
                            q_entry["tipo_resposta"] = save_result.get("tipo_resposta", "objetiva")
                            total_extracted += 1
                            print(f"      💾 Saved: {save_result.get('firebase_path')}")
                        else:
                            q_entry["status"] = "failed"
                            q_entry["error"] = "Save failed"
                            total_failed += 1

                    except RateLimitError:
                        print(f"  ⚠️ RATE LIMITED — saving checkpoint")
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

                    except Exception as e:
                        print(f"      ❌ Error: {e}")
                        traceback.print_exc()
                        q_entry["status"] = "failed"
                        q_entry["error"] = str(e)
                        total_failed += 1

                    page_questions.append(q_entry)

                # Save page results to manifest under item
                if "pages" not in item["extraction_results"]:
                    item["extraction_results"]["pages"] = {}
                item["extraction_results"]["pages"][page_key] = {
                    "regions_detected": len(regions),
                    "questions": page_questions,
                    "raw_gemini_response": raw_gemini,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
                save_manifest(manifest)

                # Small delay between pages to avoid rate limits
                time.sleep(2)
            
            # Check if ANY region was detected across all pages
            total_regions = sum(p.get("regions_detected", 0) for p in item["extraction_results"].get("pages", {}).values())
            if total_regions == 0:
                item["extraction_results"]["status"] = "error"
                item["extraction_results"]["error"] = "zero_regions_detected"
            else:
                item["extraction_results"]["status"] = "complete"

            save_manifest(manifest)

    except RateLimitError:
        print("\n⚠️ RATE LIMITED — saving checkpoint and exiting")
        manifest["rate_limit_hit"] = True
        save_manifest(manifest)
        sys.exit(0)

    except Exception as e:
        print(f"\n❌ Pipeline error: {e}")
        traceback.print_exc()
        manifest["status"] = "error"
        manifest["error"] = str(e)
        save_manifest(manifest)
        sys.exit(1)

    # Complete!
    manifest["status"] = "complete"
    manifest["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    save_manifest(manifest)

    print(f"\n{'='*60}")
    print(f"✅ Extraction complete!")
    print(f"   Extracted: {total_extracted}")
    print(f"   Skipped (dedup): {total_skipped}")
    print(f"   Failed: {total_failed}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
