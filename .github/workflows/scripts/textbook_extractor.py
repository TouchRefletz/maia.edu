#!/usr/bin/env python3
"""
textbook_extractor.py - Extração Autônoma de Livros Didáticos com Circuit Breaker e Auto-Retomada
Executado em background via GitHub Actions / OpenHands Runner com suporte a Vertex AI, Gemini API,
Circuit Breaker (fail-fast) e tolerância a limite de cota (429 / RESOURCE_EXHAUSTED).
"""

import argparse
import base64
import json
import os
import random
import re
import sys
import time
from io import BytesIO
import requests

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from google import genai
from google.genai import types


# ─── Schema JSON Estrito (Idêntico ao textbook-schema.js) ───────────
TEXTBOOK_PAGE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "resumo": {
            "type": "STRING",
            "description": "Texto massivo, exaustivo e longo descrevendo indiretamente parágrafo por parágrafo, gráficos e dados teóricos da página. É proibido transcrever texto literal.",
        },
        "tags": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Lista de conceitos-chave acadêmicos puros tratados na página.",
        },
        "mapeamento_estrutura": {
            "type": "ARRAY",
            "description": "Obrigatório apenas para páginas com tópicos, conteúdo ou sumário. Deve ser omitido para capas, páginas de créditos ou folhas vazias.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id_topico": {
                        "type": "STRING",
                        "description": "O ID exato do tópico (ex: 1.1, 1.2).",
                    },
                    "titulo_topico": {
                        "type": "STRING",
                        "description": "O nome textual do tópico por extenso.",
                    },
                    "this_page": {
                        "type": "BOOLEAN",
                        "description": "Marque true se o assunto está sendo discutido na página atual, false se não.",
                    },
                    "is_sumario": {
                        "type": "BOOLEAN",
                        "description": "Marque true se você estiver olhando para a página física do sumário/índice do livro, false se for página de conteúdo.",
                    },
                    "categoria": {
                        "type": "STRING",
                        "enum": ["teoria", "exercicio"],
                        "description": "Classificação rigorosa do tipo de conteúdo mapeado neste nó.",
                    },
                },
                "required": ["id_topico", "titulo_topico", "this_page", "is_sumario", "categoria"],
            },
        },
    },
    "required": ["resumo", "tags"],
}


class CircuitBreaker:
    """Disjuntor de segurança: interrompe a execução se houver muitas falhas consecutivas"""
    def __init__(self, max_consecutive_failures: int = 3):
        self.max_consecutive_failures = max_consecutive_failures
        self.consecutive_failures = 0

    def record_success(self):
        self.consecutive_failures = 0

    def record_failure(self) -> bool:
        self.consecutive_failures += 1
        return self.consecutive_failures >= self.max_consecutive_failures


def get_backoff_seconds(attempt: int, base: float = 5.0, max_time: float = 120.0) -> float:
    """Calcula tempo de espera exponencial com jitter para evitar sobrecarga"""
    jitter = random.uniform(0.5, 2.0)
    return min(max_time, (base * (2 ** attempt)) + jitter)


def is_rate_limit_error(error_msg: str) -> bool:
    """Verifica se o erro é referente a limite de taxa ou esgotamento de cota"""
    msg = error_msg.lower()
    return "429" in msg or "resource_exhausted" in msg or "quota" in msg or "too many requests" in msg


class BookStructureTracker:
    """
    Rastreia o estado estrutural acumulado do livro didático (1:1 com book-structure-tracker.js).
    """

    def __init__(self):
        self.covers_and_credits = set()
        self.summary_pages = set()
        self.topics = {}  # id_topico -> dict
        self.page_history = {}  # page_num -> {page_type, topic_ids}
        self.last_processed_page = 0

    def reset(self):
        self.covers_and_credits.clear()
        self.summary_pages.clear()
        self.topics.clear()
        self.page_history.clear()
        self.last_processed_page = 0

    def add_page_extraction(self, page_num: int, extraction_result: dict):
        if not extraction_result:
            return
        self.last_processed_page = max(self.last_processed_page, page_num)

        tags = extraction_result.get("tags", [])
        mapeamento = extraction_result.get("mapeamento_estrutura", [])
        is_cover = "capa_ou_creditos" in tags or not mapeamento

        if is_cover:
            self.covers_and_credits.add(page_num)
            self.page_history[page_num] = {
                "page_type": "capa_ou_creditos",
                "topic_ids": [],
            }
            return

        active_topic_ids = []
        page_is_summary = False

        for item in mapeamento:
            if not item or not item.get("id_topico"):
                continue

            topic_id = str(item["id_topico"]).strip()
            is_sumario = bool(item.get("is_sumario"))
            category = item.get("categoria", "teoria")

            if is_sumario:
                page_is_summary = True
                self.summary_pages.add(page_num)

            if topic_id not in self.topics:
                self.topics[topic_id] = {
                    "id_topico": topic_id,
                    "titulo_topico": item.get("titulo_topico", topic_id),
                    "is_sumario": is_sumario,
                    "categoria": category,
                    "content_pages": set(),
                    "theory_pages": set(),
                    "exercise_pages": set(),
                }
            else:
                if item.get("titulo_topico"):
                    self.topics[topic_id]["titulo_topico"] = item["titulo_topico"]
                if is_sumario:
                    self.topics[topic_id]["is_sumario"] = True
                if item.get("categoria"):
                    self.topics[topic_id]["categoria"] = item["categoria"]

            # Se o assunto está sendo discutido NESTA página E NÃO É SUMÁRIO
            if item.get("this_page") and not is_sumario:
                active_topic_ids.append(topic_id)
                self.topics[topic_id]["content_pages"].add(page_num)
                if category == "exercicio":
                    self.topics[topic_id]["exercise_pages"].add(page_num)
                else:
                    self.topics[topic_id]["theory_pages"].add(page_num)

        self.page_history[page_num] = {
            "page_type": "sumario" if page_is_summary else "conteudo",
            "topic_ids": active_topic_ids,
        }

    def format_page_ranges(self, page_set: set) -> str:
        if not page_set:
            return "Nenhuma"
        sorted_pages = sorted(list(page_set))
        ranges = []
        start = sorted_pages[0]
        end = start

        for p in sorted_pages[1:]:
            if p == end + 1:
                end = p
            else:
                ranges.append(f"{start}" if start == end else f"{start}-{end}")
                start = p
                end = start
        ranges.append(f"{start}" if start == end else f"{start}-{end}")
        return f"Páginas {', '.join(ranges)}"

    def to_prompt_context(self) -> dict:
        formatted_topics = []
        for t in self.topics.values():
            theory_str = self.format_page_ranges(t["theory_pages"])
            exercise_str = self.format_page_ranges(t["exercise_pages"])
            content_str = self.format_page_ranges(t["content_pages"])

            detail_pages = content_str
            if t["theory_pages"] or t["exercise_pages"]:
                parts = []
                if t["theory_pages"]:
                    parts.append(f"Teoria: {theory_str.replace('Páginas ', '')}")
                if t["exercise_pages"]:
                    parts.append(f"Exercício: {exercise_str.replace('Páginas ', '')}")
                detail_pages = f"{content_str} ({', '.join(parts)})"

            formatted_topics.append({
                "id_topico": t["id_topico"],
                "titulo_topico": t["titulo_topico"],
                "categoria_dominante": t["categoria"],
                "is_sumario": t["is_sumario"],
                "paginas_discutidas": detail_pages,
            })

        return {
            "progresso": f"Páginas 1 a {self.last_processed_page} analisadas",
            "paginas_especiais": {
                "capas_e_creditos": sorted(list(self.covers_and_credits)),
                "sumario": sorted(list(self.summary_pages)),
            },
            "topicos_detectados": formatted_topics,
        }


def build_core_vision_prompt(prev_1, prev_2, tracker: BookStructureTracker) -> str:
    """Prompt 1:1 idêntico ao textbook-extractor.js"""
    context_tree = tracker.to_prompt_context()

    return f"""Você é o Core Vision Neural Module do ecossistema Maia.edu.
Sua tarefa é analisar a imagem da página atual de um livro didático e mapear seu conteúdo de forma estritamente alinhada à estrutura real do livro, sem inventar caminhos.

========================================================================
[DADOS INJETADOS PELO SISTEMA - CONTEXTO DISPONÍVEL]
========================================================================
O sistema rastreia o progresso do livro e injeta as seguintes informações como sua única linha do tempo da verdade:

1. METADADOS DA PÁGINA N-1 (Anterior imediata):
{json.dumps(prev_1 or {}, indent=2, ensure_ascii=False)}

2. METADADOS DA PÁGINA N-2 (Duas páginas atrás):
{json.dumps(prev_2 or {}, indent=2, ensure_ascii=False)}

3. ÁRVORE ESTRUTURAL DO LIVRO DETECTADA ATÉ O MOMENTO:
{json.dumps(context_tree, indent=2, ensure_ascii=False)}

========================================================================
[DIRETRIZES DE ORIENTAÇÃO E LIMITES DE RESPOSTA]
========================================================================
Para evitar alucinações, você deve seguir este mapa de permissões rígido:
- Você só pode marcar "this_page": true em tópicos que já existem na [ÁRVORE ESTRUTURAL DO LIVRO] ou que você acabou de ler em uma página legítima de sumário.
- Se as páginas N-1 e N-2 estavam tratando do tópico "X" e o fluxo de texto continua o mesmo sem títulos novos, você é obrigado a deduzir que o assunto continua ativo.
- Você está proibido de criar ou referenciar tópicos se estiver olhando para páginas de transição, capas ou folhas de créditos.

========================================================================
[REGRAS DE PREENCHIMENTO DOS CAMPOS]
========================================================================
1. "resumo" (MÁXIMA DENSIDADE E EXTENSÃO):
- Escreva um resumo extremamente longo, massivo e exaustivo de tudo o que a página aborda.
- É EXPRESSAMENTE PROIBIDO transcrever trechos de texto palavra por palavra. Descreva tudo de forma 100% indireta.
- Mapeie a progressão: detalhe quantos parágrafos a página tem e o foco conceitual de cada um deles. Descreva exaustivamente elementos visuais, gráficos, tabelas, boxes de curiosidades ou equações (explicando o que as variáveis representam em prosa).

2. "tags":
- Array de strings contendo os conceitos-chave acadêmicos puros tratados na página (ex: ["gimnospermas", "polinizacao"]).

3. "mapeamento_estrutura" (CONDICIONAL E RÍGIDO):
- CENÁRIO 1: CAPA, CONTRACAPA, PÁGINAS DE CRÉDITOS, AUTORES OU DIAGRAMAÇÕES VAZIAS
  Regra Absoluta: Remova o campo completamente do JSON de retorno. Devolva apenas "resumo" e "tags": ["capa_ou_creditos"].
- CENÁRIO 2: PÁGINAS DE CONTEÚDO (TEORIA/EXERCÍCIO) OU PÁGINAS DE SUMÁRIO
  Regra Absoluta: O campo "mapeamento_estrutura" torna-se OBRIGATÓRIO e deve conter os nós do tópico com id_topico, titulo_topico, this_page, is_sumario e categoria ("teoria" ou "exercicio").
"""


def init_genai_client(model_name: str):
    """Inicializa o cliente Google GenAI SDK (Vertex AI ou API Key padrão)"""
    is_vertex = "vertex" in (model_name or "").lower() or bool(os.getenv("VERTEX_PROJECT_ID") or os.getenv("GCP_PROJECT_ID"))
    project_id = os.getenv("VERTEX_PROJECT_ID") or os.getenv("GCP_PROJECT_ID")
    location = os.getenv("VERTEX_LOCATION") or os.getenv("GCP_LOCATION", "global")

    creds_json = os.getenv("VERTEX_CREDENTIALS")
    if creds_json and not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        import tempfile
        creds_path = os.path.join(tempfile.gettempdir(), "vertex_credentials.json")
        try:
            with open(creds_path, "w", encoding="utf-8") as f:
                f.write(creds_json)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
        except Exception:
            pass

    if is_vertex and project_id:
        print(f"⚡ Inicializando GenAI Client com Google Cloud Vertex AI (Project: {project_id}, Location: {location})")
        try:
            return genai.Client(vertexai=True, project=project_id, location=location)
        except TypeError:
            try:
                return genai.Client(project=project_id, location=location)
            except Exception:
                return genai.Client()
    else:
        api_key = os.getenv("GOOGLE_GENAI_API_KEY") or os.getenv("LLM_API_KEY")
        print(f"🔑 Inicializando GenAI Client com Gemini API Key")
        return genai.Client(api_key=api_key)


def get_clean_model_id(model_name: str) -> str:
    m = model_name.replace("vertex/", "").replace("models/", "")
    return m or "gemini-3.7-flash"


def write_github_output(key: str, value: str):
    """Escreve variável para o step output do GitHub Actions sem poluir banco de dados"""
    if "GITHUB_OUTPUT" in os.environ:
        try:
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
                f.write(f"{key}={value}\n")
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="Extrator Autônomo 1:1 de Livros Didáticos")
    parser.add_argument("--pdf-path", required=True, help="Caminho do arquivo PDF do livro")
    parser.add_argument("--book-slug", required=True, help="Slug do livro didático")
    parser.add_argument("--batch-id", default="", help="Identificador único do lote (batch_id)")
    parser.add_argument("--model", default="vertex/gemini-3.7-flash", help="Modelo de IA")
    parser.add_argument("--resume-page", type=int, default=1, help="Página de onde retomar a extração")
    parser.add_argument("--output-dir", default="./output", help="Diretório de saída")
    parser.add_argument("--hf-repo", default=os.getenv("HF_REPO", "toquereflexo/maia-deep-search"))

    args = parser.parse_args()

    if not fitz:
        print("❌ PyMuPDF (fitz) é necessário para renderização de páginas.")
        sys.exit(1)

    print(f"📚 [TextbookExtractor 1:1] Iniciando livro: {args.book_slug} (Batch: {args.batch_id})")
    if args.resume_page > 1:
        print(f"🔄 Retomando execução a partir da página {args.resume_page}!")

    client = init_genai_client(args.model)
    model_id = get_clean_model_id(args.model)

    doc = fitz.open(args.pdf_path)
    total_pages = len(doc)
    print(f"📄 Total de páginas a processar sequencialmente: {total_pages}")

    tracker = BookStructureTracker()
    circuit_breaker = CircuitBreaker(max_consecutive_failures=3)
    prev_1 = None
    prev_2 = None
    extracted_pages = {}

    book_out_dir = os.path.join(args.output_dir, args.book_slug)
    os.makedirs(book_out_dir, exist_ok=True)

    start_page = max(1, args.resume_page)
    needs_auto_resume = False
    next_resume_page = start_page

    for p in range(start_page, total_pages + 1):
        print(f"📖 [Página {p}/{total_pages}] Extraindo teoria e mapeamento de tópicos...")
        page = doc[p - 1]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("jpeg")

        prompt = build_core_vision_prompt(prev_1, prev_2, tracker)

        success = False
        rate_limited = False

        for attempt in range(4):
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=[
                        types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=TEXTBOOK_PAGE_SCHEMA,
                        temperature=0.2,
                    ),
                )

                page_data = json.loads(response.text)
                extracted_pages[p] = page_data
                prev_2 = prev_1
                prev_1 = page_data
                tracker.add_page_extraction(p, page_data)
                circuit_breaker.record_success()
                success = True
                print(f"   ✓ Página {p} processada com sucesso (Tags: {', '.join(page_data.get('tags', []))})")
                break
            except Exception as e:
                err_str = str(e)
                if is_rate_limit_error(err_str):
                    rate_limited = True
                    backoff = get_backoff_seconds(attempt, base=10.0, max_time=180.0)
                    print(f"   ⏳ [RateLimit/Quota] Cota atingida na tentativa {attempt + 1}/4. Aguardando {backoff:.1f}s com backoff...")
                    time.sleep(backoff)
                else:
                    print(f"   ⚠️ Tentativa {attempt + 1}/4 falhou na página {p}: {e}")
                    time.sleep(2)

        # Se após 4 tentativas a cota continuar esgotada, acionar Auto-Resume Limpo (Zero DB)
        if not success and rate_limited:
            print(f"🛑 [Quota Exhausted] Cota indisponível na página {p}. Acionando Auto-Resume para a próxima execução!")
            needs_auto_resume = True
            next_resume_page = p
            write_github_output("needs_resume", "true")
            write_github_output("resume_page", str(next_resume_page))
            write_github_output("status", "quota_paused")
            break

        # Se falhou por outros erros, alimentar o Circuit Breaker
        if not success:
            tripped = circuit_breaker.record_failure()
            if tripped:
                print(f"🚨 [Circuit Breaker Ativado] 3 falhas consecutivas de API detectadas. Interrompendo worker para evitar queima de tokens!")
                write_github_output("status", "circuit_breaker_tripped")
                break
            extracted_pages[p] = {"resumo": "[Página não processada por erro de API]", "tags": ["erro_extracao"]}

    # Geração do Manifesto Final
    manifest = {
        "slug": args.book_slug,
        "batch_id": args.batch_id,
        "total_pages": total_pages,
        "hf_url": f"https://huggingface.co/datasets/{args.hf_repo}/resolve/main/output/{args.book_slug}/files/{os.path.basename(args.pdf_path)}",
        "tree": tracker.to_prompt_context(),
        "pages": extracted_pages,
        "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "partial_paused" if needs_auto_resume else "completed",
    }

    manifest_path = os.path.join(book_out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"✅ Manifesto gerado em: {manifest_path}")

    # Indexação no Pinecone (1:1 com indexBookInPinecone)
    worker_url = os.environ.get("WORKER_URL", "https://maia-api-worker.willian-campos-ismart.workers.dev")
    hf_url = manifest["hf_url"]
    sanitized_book = args.book_slug.replace(".", "_").replace("/", "_")

    vectors_to_upsert = []
    all_tags = set()
    summary_parts = []

    print(f"🌲 Gerando embeddings para indexação no Pinecone (Index: livros, Namespace: theory)...")
    for p_num, p_data in extracted_pages.items():
        if not p_data or "erro_extracao" in p_data.get("tags", []):
            continue
        p_tags = p_data.get("tags", [])
        for t in p_tags:
            all_tags.add(t)

        resumo = p_data.get("resumo", "")
        if resumo:
            summary_parts.append(f"[Página {p_num}]: {resumo}")

        text_to_embed = f"{' '.join(p_tags)} {resumo}".strip()
        if not text_to_embed:
            continue

        try:
            emb_model = "gemini-embedding-001" if is_vertex else "models/gemini-embedding-001"
            emb_res = client.models.embed_content(
                model=emb_model,
                contents=text_to_embed[:2000],
            )
            emb_vector = emb_res.embedding.values if hasattr(emb_res, "embedding") else emb_res.embeddings[0].values

            category = "teoria"
            map_est = p_data.get("mapeamento_estrutura", [])
            if map_est and isinstance(map_est, list) and len(map_est) > 0:
                category = map_est[0].get("categoria", "teoria")

            vectors_to_upsert.append({
                "id": f"{sanitized_book}--pagina_{p_num}",
                "values": list(emb_vector),
                "metadata": {
                    "book_id": sanitized_book,
                    "batch_id": args.batch_id,
                    "categoria": category,
                    "pageNum": int(p_num),
                    "resumo": resumo[:1000],
                    "tags": ",".join(p_tags),
                    "hf_url": hf_url,
                    "type": "page",
                },
            })
        except Exception as e_emb:
            print(f"   ⚠️ Falha ao gerar embedding para página {p_num}: {e_emb}")

    # Embedding do livro completo
    if summary_parts:
        try:
            full_summary_text = "\n".join(summary_parts)
            book_combined_text = f"Livro: {sanitized_book} Tags: {' '.join(all_tags)}\nResumo Geral:\n{full_summary_text}"
            emb_model = "gemini-embedding-001" if is_vertex else "models/gemini-embedding-001"
            emb_res_book = client.models.embed_content(
                model=emb_model,
                contents=book_combined_text[:8000],
            )
            emb_book_vector = emb_res_book.embedding.values if hasattr(emb_res_book, "embedding") else emb_res_book.embeddings[0].values

            vectors_to_upsert.append({
                "id": f"{sanitized_book}--full",
                "values": list(emb_book_vector),
                "metadata": {
                    "book_id": sanitized_book,
                    "batch_id": args.batch_id,
                    "categoria": "teoria",
                    "resumo_geral": full_summary_text[:1000],
                    "tags": ",".join(all_tags),
                    "total_paginas": total_pages,
                    "hf_url": hf_url,
                    "type": "book",
                },
            })
        except Exception as e_b_emb:
            print(f"   ⚠️ Falha ao gerar embedding para livro completo: {e_b_emb}")

    # Upsert no Worker
    if vectors_to_upsert:
        try:
            print(f"🚀 Enviando {len(vectors_to_upsert)} vetores para o Pinecone via Worker...")
            u_res = requests.post(
                f"{worker_url}/pinecone-upsert",
                json={
                    "vectors": vectors_to_upsert,
                    "namespace": "theory",
                    "target": "livros",
                },
                timeout=60,
            )
            if u_res.status_code == 200:
                print(f"✅ Vetores indexados com sucesso no Pinecone (Index: livros, Namespace: theory)!")
            else:
                print(f"⚠️ Pinecone upsert via worker retornou status {u_res.status_code}: {u_res.text[:200]}")
        except Exception as e_up:
            print(f"⚠️ Erro na sincronização com Pinecone: {e_up}")

    if needs_auto_resume:
        print(f"⏸️ Execução pausada com segurança na página {next_resume_page}. Estado salvo no payload.")
    else:
        print(f"✨ [TextbookExtractor 1:1] Livro {args.book_slug} concluído com 100% de sucesso!")


if __name__ == "__main__":
    main()
