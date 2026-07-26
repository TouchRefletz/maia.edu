#!/usr/bin/env python3
"""
textbook_extractor.py - Extração Autônoma e Headless de Livros Didáticos
Executado em background via GitHub Actions / OpenHands Runner.
"""

import argparse
import base64
import json
import os
import re
import sys
from io import BytesIO
import requests

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


class PythonBookTracker:
    def __init__(self):
        self.covers_and_credits = []
        self.summary_pages = []
        self.topics = {}  # id_topico -> dict
        self.last_page = 0

    def add_page_extraction(self, page_num, page_result):
        if not page_result:
            return
        self.last_page = max(self.last_page, page_num)

        tags = page_result.get("tags", [])
        mapeamento = page_result.get("mapeamento_estrutura", [])
        is_cover = "capa_ou_creditos" in tags or not mapeamento

        if is_cover:
            if page_num not in self.covers_and_credits:
                self.covers_and_credits.append(page_num)
            return

        for item in mapeamento:
            if not item or not item.get("id_topico"):
                continue

            topic_id = str(item["id_topico"]).strip()
            is_sumario = bool(item.get("is_sumario"))
            category = item.get("categoria", "teoria")

            if is_sumario and page_num not in self.summary_pages:
                self.summary_pages.append(page_num)

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

            # APENAS adiciona a páginas de conteúdo se NÃO for página de sumário
            if item.get("this_page") and not is_sumario:
                t = self.topics[topic_id]
                t["content_pages"].add(page_num)
                if category == "exercicio":
                    t["exercise_pages"].add(page_num)
                else:
                    t["theory_pages"].add(page_num)

    def format_ranges(self, page_set):
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

    def to_prompt_context(self):
        formatted = []
        for t in self.topics.values():
            c_str = self.format_ranges(t["content_pages"])
            formatted.append({
                "id_topico": t["id_topico"],
                "titulo_topico": t["titulo_topico"],
                "categoria_dominante": t["categoria"],
                "is_sumario": t["is_sumario"],
                "paginas_discutidas": c_str,
            })

        return {
            "progresso": f"Páginas 1 a {self.last_page} analisadas",
            "paginas_especiais": {
                "capas_e_creditos": sorted(self.covers_and_credits),
                "sumario": sorted(self.summary_pages),
            },
            "topicos_detectados": formatted,
        }


def build_core_vision_prompt(prev_1, prev_2, tracker):
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
"""


def main():
    parser = argparse.ArgumentParser(description="Extrator Autônomo de Livros Didáticos")
    parser.add_argument("--pdf-path", required=True, help="Caminho do arquivo PDF do livro")
    parser.add_argument("--book-slug", required=True, help="Slug do livro didático")
    parser.add_argument("--output-dir", default="./output", help="Diretório de saída")
    parser.add_argument("--gemini-api-key", required=False, help="Google Gemini API Key")
    parser.add_argument("--pinecone-api-key", required=False, help="Pinecone API Key")
    parser.add_argument("--pinecone-host", required=False, help="Pinecone Host (Index livros)")

    args = parser.parse_args()

    api_key = args.gemini_api_key or os.getenv("GOOGLE_GENAI_API_KEY")
    if not api_key:
        print("❌ GOOGLE_GENAI_API_KEY necessária.")
        sys.exit(1)

    print(f"📖 Iniciando extração autônoma do livro: {args.book_slug} ({args.pdf_path})")

    doc = fitz.open(args.pdf_path) if fitz else None
    if not doc:
        print("❌ PyMuPDF (fitz) não disponível para abrir PDF.")
        sys.exit(1)

    tracker = PythonBookTracker()
    prev_1 = None
    prev_2 = None
    extracted_pages = {}

    book_out_dir = os.path.join(args.output_dir, args.book_slug)
    files_dir = os.path.join(book_out_dir, "files")
    os.makedirs(files_dir, exist_ok=True)

    for p in range(1, len(doc) + 1):
        print(f"[TextbookExtractor Python] Processando página {p}/{len(doc)}...")
        page = doc[p - 1]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        base64_img = base64.b64encode(img_bytes).decode("utf-8")

        prompt = build_core_vision_prompt(prev_1, prev_2, tracker)

        headers = {"Content-Type": "application/json"}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": base64_img
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
        }

        resp = requests.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            res_json = resp.json()
            try:
                raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                page_data = json.loads(raw_text)
                extracted_pages[p] = page_data
                prev_2 = prev_1
                prev_1 = page_data
                tracker.add_page_extraction(p, page_data)
            except Exception as e:
                print(f"⚠️ Erro ao decodificar JSON da página {p}: {e}")
        else:
            print(f"⚠️ Chamada Gemini API falhou na página {p}: {resp.status_code}")

    manifest = {
        "slug": args.book_slug,
        "total_pages": len(doc),
        "pages": extracted_pages,
        "tree": tracker.to_prompt_context()
    }

    manifest_path = os.path.join(book_out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"✅ Extração autônoma finalizada com sucesso! Manifest gerado em: {manifest_path}")


if __name__ == "__main__":
    main()
