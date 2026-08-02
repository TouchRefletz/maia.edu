"""
Script de Seleção Estratificada de Questões para o Projeto MAIA.edu (125 Questões).

Este script realiza a amostragem estratificada matricial (5x5):
- 5 Grupos de Área: Linguagens, Humanas, Natureza, Matematica (ENEM) e Interdisciplinar (FUVEST)
- 5 Faixas de Dificuldade TRI / Acerto Invertido: 0%-20%, 20%-40%, 40%-60%, 60%-80%, 80%-100%
- Target de dificuldade: 10%, 30%, 50%, 70%, 90% (5 questões por célula, total N = 125 questões).

Seed aleatória fixa: 2026 (para reprodutibilidade).
"""

import csv
import os
import random
import sys
from collections import Counter

# --- Critérios de Estratificação ---
AREAS_ENEM = ["Linguagens", "Humanas", "Natureza", "Matematica"]
AREA_INTER = "Interdisciplinar"

BANDS = [
    (0, 20, 10),
    (20, 40, 30),
    (40, 60, 50),
    (60, 80, 70),
    (80, 100, 90),
]

Q_PER_BAND = 5
SEED = 2026


def select_closest(pool, target, n):
    """
    Seleciona do pool as n questões com dificuldade_pct mais próxima de target.
    Se len(pool) < n, retorna todas. Desempate aleatório com seed fixa.
    """
    pool = sorted(pool, key=lambda r: str(r.get("id", "")))
    pool = sorted(pool, key=lambda r: abs(float(r["dificuldade_pct"]) - target))
    result = []
    remaining = list(pool)
    while len(result) < n and remaining:
        best_dist = abs(float(remaining[0]["dificuldade_pct"]) - target)
        tied = [r for r in remaining if abs(float(r["dificuldade_pct"]) - target) == best_dist]
        if len(tied) > 1:
            tied = sorted(tied, key=lambda r: str(r.get("id", "")))
            random.shuffle(tied)
        chosen = tied[0]
        result.append(chosen)
        remaining.remove(chosen)
    return result


def find_questoes_csv():
    """Localiza o arquivo questoes.csv no repositório ou em caminhos conhecidos."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    candidate_paths = [
        os.path.join(project_root, "experiments", "questoes.csv"),
        os.path.join(project_root, "questoes.csv"),
        os.path.join(script_dir, "questoes.csv"),
        r"C:\Users\jcamp\Downloads\selecionar questões\questoes.csv",
        r"C:\Users\jcamp\Downloads\selecionar questoes\questoes.csv",
    ]

    for path in candidate_paths:
        if os.path.isfile(path):
            return path
            
    # Procura iterativa em subpastas de Downloads se disponível
    downloads = r"C:\Users\jcamp\Downloads"
    if os.path.exists(downloads):
        for entry in os.scandir(downloads):
            if entry.is_dir() and "selecionar" in entry.name.lower():
                q_csv = os.path.join(entry.path, "questoes.csv")
                if os.path.isfile(q_csv):
                    return q_csv

    return None


def main():
    random.seed(SEED)

    csv_path = find_questoes_csv()
    if not csv_path:
        print("ERRO: Arquivo 'questoes.csv' não foi encontrado nos caminhos padrão.", file=sys.stderr)
        sys.exit(1)

    print(f"Lendo base de questões de: {csv_path}")

    with open(csv_path, "r", encoding="utf-8") as f:
        all_rows = list(csv.DictReader(f))

    print(f"Total de questões no pool bruto: {len(all_rows)}")

    # --- Pool de Seleção ---
    pool_enem = {a: [] for a in AREAS_ENEM}
    pool_fuvest = []

    for r in all_rows:
        qid = r.get("id", "")
        qarea = r.get("area", "")
        if qid.startswith("ENEM") and qarea in AREAS_ENEM:
            pool_enem[qarea].append(dict(r))
        elif qid.startswith("FUVEST") and qarea == AREA_INTER:
            pool_fuvest.append(dict(r))

    # --- Processo de Seleção Estratificada ---
    selected = []

    for area in AREAS_ENEM:
        pool = pool_enem[area]
        print(f"\n{area} ({len(pool)} disponíveis):")
        for lo, hi, target in BANDS:
            band = [r for r in pool if lo <= float(r["dificuldade_pct"]) < hi]
            if len(band) < Q_PER_BAND:
                picked = select_closest(pool, target, Q_PER_BAND)
                note = f"(expandido, {len(band)} na faixa)"
            else:
                picked = select_closest(band, target, Q_PER_BAND)
                note = ""
            for r in picked:
                r["grupo"] = area
                r["faixa"] = f"{lo}%-{hi}%"
                selected.append(r)
                if r in pool:
                    pool.remove(r)
            pcts = sorted(float(r["dificuldade_pct"]) for r in picked)
            print(f"  target {target:2d}%: {len(picked)} questões {note} | {[round(p,1) for p in pcts]}")

    print(f"\nInterdisciplinar ({len(pool_fuvest)} disponíveis):")
    for lo, hi, target in BANDS:
        band = [r for r in pool_fuvest if lo <= float(r["dificuldade_pct"]) < hi]
        if len(band) < Q_PER_BAND:
            picked = select_closest(pool_fuvest, target, Q_PER_BAND)
            note = f"(expandido, {len(band)} na faixa)"
        else:
            picked = select_closest(band, target, Q_PER_BAND)
            note = ""
        for r in picked:
            r["grupo"] = "Interdisciplinar"
            r["faixa"] = f"{lo}%-{hi}%"
            selected.append(r)
            if r in pool_fuvest:
                pool_fuvest.remove(r)
        pcts = sorted(float(r["dificuldade_pct"]) for r in picked)
        print(f"  target {target:2d}%: {len(picked)} questões {note} | {[round(p,1) for p in pcts]}")

    # --- Estatísticas Finais ---
    print(f"\n\n=== TOTAL SELECIONADO: {len(selected)} questões ===")
    gcnt = Counter(r["grupo"] for r in selected)
    for g, c in sorted(gcnt.items()):
        print(f"  {g}: {c}")
    fcnt = Counter(r["faixa"] for r in selected)
    print("  Por faixa:")
    for f, c in sorted(fcnt.items()):
        print(f"    {f}: {c}")

    # Salva o arquivo de saída
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.abspath(os.path.join(script_dir, "..", "experiments"))
    if not os.path.isdir(out_dir):
        out_dir = script_dir

    out_path = os.path.join(out_dir, "questoes_selecionadas_125.csv")
    fieldnames = list(all_rows[0].keys())
    for col in ["grupo", "faixa"]:
        if col not in fieldnames:
            fieldnames.append(col)

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(selected)

    print(f"\nSalvo com sucesso em: {out_path}")


if __name__ == "__main__":
    main()
