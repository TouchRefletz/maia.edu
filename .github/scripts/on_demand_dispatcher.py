#!/usr/bin/env python3
"""
on_demand_dispatcher.py - Orquestrador de Busca OpenHands e Geração de Matriz Paralela
Coleta resultados gerados pelos workers do OpenHands (Livros e Questões) e monta a matriz de jobs 1-por-PDF.
"""

import argparse
import glob
import json
import os
import re
import shutil
import sys
from pathlib import Path


def sanitize_slug(text: str) -> str:
    """Gera um slug canônico a partir do título do arquivo ou tema"""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text).strip("-")
    return text[:60] or "material-coletado"


def discover_openhands_materials(search_dirs: list, query: str) -> tuple[list, list]:
    """
    Varre os diretórios de saída do OpenHands buscando PDFs e manifestos gerados.
    Retorna (books_items, questions_items).
    """
    books_results = []
    questions_results = []
    seen_files = set()

    for s_dir in search_dirs:
        if not os.path.exists(s_dir):
            continue

        print(f"📂 [Dispatcher] Inspecionando diretório de artefatos: {s_dir}")
        for root, dirs, files in os.walk(s_dir):
            # Verificar se há manifest.json de busca
            manifest_data = None
            if "manifest.json" in files:
                m_path = os.path.join(root, "manifest.json")
                try:
                    with open(m_path, "r", encoding="utf-8") as f:
                        manifest_data = json.load(f)
                except Exception as e:
                    print(f"⚠️ Erro ao ler {m_path}: {e}")

            # Identificar tipo baseado no caminho
            path_lower = root.lower().replace("\\", "/")
            is_book = "livro" in path_lower or "book" in path_lower

            # Mapear itens do manifesto se existir
            manifest_items = []
            if isinstance(manifest_data, dict):
                manifest_items = manifest_data.get("results", manifest_data.get("files", []))
            elif isinstance(manifest_data, list):
                manifest_items = manifest_data

            # Mapeamento por arquivo PDF físico
            pdf_files = [f for f in files if f.lower().endswith(".pdf")]
            for pdf_file in pdf_files:
                full_pdf_path = os.path.abspath(os.path.join(root, pdf_file))
                if full_pdf_path in seen_files:
                    continue
                seen_files.add(full_pdf_path)

                # Verificar se o arquivo é válido (> 1KB)
                if os.path.getsize(full_pdf_path) < 1024:
                    print(f"⚠️ Ignorando PDF corrompido/pequeno: {full_pdf_path}")
                    continue

                # Tentar recuperar URL e dados do manifesto
                origin_url = ""
                item_tipo = "livro" if is_book else "questao"
                for m_it in manifest_items:
                    if isinstance(m_it, dict) and m_it.get("filename") == pdf_file:
                        origin_url = m_it.get("link_origem", m_it.get("url", ""))
                        if m_it.get("tipo") == "livro":
                            item_tipo = "livro"
                        break

                item_slug = f"{'book' if item_tipo == 'livro' else 'question'}-{sanitize_slug(query)}-{len(books_results) + len(questions_results) + 1}"

                item_entry = {
                    "slug": item_slug,
                    "pdf_path": full_pdf_path,
                    "pdf_name": pdf_file,
                    "type": "book" if item_tipo == "livro" else "question",
                    "url": origin_url or f"file://{full_pdf_path}",
                }

                if item_tipo == "livro":
                    books_results.append(item_entry)
                    print(f"  📚 [Livro Encontrado] {pdf_file} -> {item_slug}")
                else:
                    questions_results.append(item_entry)
                    print(f"  📝 [Lista de Questões Encontrada] {pdf_file} -> {item_slug}")

    return books_results, questions_results


def main():
    parser = argparse.ArgumentParser(description="Orquestrador de Coleta Paralela sob Demanda")
    parser.add_argument("--query", required=True, help="Tema da requisição")
    parser.add_argument("--batch-id", required=True, help="ID do lote")
    parser.add_argument("--model", default="vertex/gemini-3.7-flash", help="Modelo de IA")
    parser.add_argument("--output-json", default="matrix.json", help="Arquivo JSON de saída da matriz")

    args = parser.parse_args()

    print(f"🚀 [Dispatcher] Consolidando resultados de busca OpenHands para o lote: {args.batch_id}")
    print(f"🎯 Tema: '{args.query}' | Modelo: {args.model}")

    search_dirs = [
        os.path.abspath("work/search_output"),
        os.path.abspath("output"),
        os.path.abspath("work"),
    ]

    books_results, questions_results = discover_openhands_materials(search_dirs, args.query)
    matrix_items = books_results + questions_results
    has_files = "true" if len(matrix_items) > 0 else "false"

    if not matrix_items:
        print("⚠️ Nenhum PDF retornado pela busca OpenHands. Gerando matriz neutra.")
        matrix_payload = {"include": [{"slug": "none", "pdf_path": "", "pdf_name": "", "type": "none", "url": ""}]}
    else:
        matrix_payload = {"include": matrix_items}

    # Salva no arquivo local
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(matrix_payload, f, indent=2)

    # Escreve na saída do GitHub Actions para a matriz de jobs
    matrix_str = json.dumps(matrix_payload)
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"matrix={matrix_str}\n")
            f.write(f"has_files={has_files}\n")
            f.write(f"books_count={len(books_results)}\n")
            f.write(f"questions_count={len(questions_results)}\n")

    print(f"✨ [Dispatcher] Matriz gerada com sucesso! Total de jobs paralelos: {len(matrix_items)} (has_files={has_files})")
    print(f"   📚 Livros identificados: {len(books_results)} | 📝 Questões/Provas identificadas: {len(questions_results)}")


if __name__ == "__main__":
    main()
