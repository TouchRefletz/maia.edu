#!/usr/bin/env python3
"""
auto_question_auditor.py — Auditor e Corretor Automático de Questões por IA (100% Autônomo)
Port em Python de text-audit-service.ts, sem dependência de LanguageTool e aplicando alterações diretamente no JSON.
"""

import json
import os
import re
import sys
import time
from typing import Dict, Any, List, Tuple

from google import genai
from google.genai import types

# Regex de caracteres orientais alucinados e caracteres corrompidos
CJK_REGEX = re.compile(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+")
BROKEN_SYMBOL_REGEX = re.compile(r"(?:ï¿½|\uFFFD)+")
DOUBLE_UTF8_REGEX = re.compile(r"Ã[£©§¡³ºª´]")


def fix_double_utf8(text: str) -> str:
    """Corrige corrupções duplas de UTF-8 comuns no OCR (ex: QUESTÃ££O -> QUESTÃO)"""
    if not text:
        return text
    fixed = text
    replacements = {
        "Ã££Ã££": "ã",
        "Ã££": "ã",
        "Ã£": "ã",
        "Ã©": "é",
        "Ã§": "ç",
        "Ã¡": "á",
        "Ã³": "ó",
        "Ãº": "ú",
        "Ãª": "ê",
        "Ã´": "ô",
        "Ã": "à",
    }
    for bad, good in replacements.items():
        fixed = fixed.replace(bad, good)
    return fixed


def run_heuristics_audit(q: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """Aplica limpeza heurística imediata em todos os campos de texto do JSON da questão"""
    fixes_count = 0

    def clean_text(text: str) -> str:
        nonlocal fixes_count
        if not isinstance(text, str) or len(text.strip()) < 2:
            return text

        cleaned = text

        # 1. Ideogramas orientais
        if CJK_REGEX.search(cleaned):
            cleaned = CJK_REGEX.sub("", cleaned).strip()
            fixes_count += 1

        # 2. Símbolos quebrados
        if BROKEN_SYMBOL_REGEX.search(cleaned):
            cleaned = BROKEN_SYMBOL_REGEX.sub("", cleaned).strip()
            fixes_count += 1

        # 3. UTF-8 Duplo
        if DOUBLE_UTF8_REGEX.search(cleaned):
            fixed_utf = fix_double_utf8(cleaned)
            if fixed_utf != cleaned:
                cleaned = fixed_utf
                fixes_count += 1

        return cleaned

    def traverse_and_clean(obj: Any) -> Any:
        if isinstance(obj, str):
            return clean_text(obj)
        elif isinstance(obj, list):
            return [traverse_and_clean(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: traverse_and_clean(v) for k, v in obj.items()}
        return obj

    cleaned_q = traverse_and_clean(q)
    return cleaned_q, fixes_count


AUDIT_PROMPT = """Você é o Auditor Especialista em Questões e OCR Acadêmico do Maia.edu.
Sua missão é auditar o recorte visual da questão em comparação com a extração estruturada em JSON fornecida abaixo.

DADOS DA EXTRAÇÃO ATUAL:
{question_json}

OBJETIVO DA AUDITORIA:
1. Detectar discrepâncias entre o texto da imagem e o texto extraído (enunciado cortado, fórmulas incompletas).
2. Garantir que todas as fórmulas matemáticas e químicas estejam estritamente formatadas em LaTeX ($...$ ou $$...$$).
3. Verificar a coerência da alternativa correta e dos passos de resolução com a imagem.
4. Identificar qualquer caractere estranho, símbolo corrompido ou alucinação do modelo anterior.

RETORNE APENAS UM JSON NO SEGUINTE FORMATO:
{
  "aprovada": true,
  "correcoes_necessarias": [
    {
      "campo": "enunciado",
      "texto_original": "trecho incorreto",
      "texto_sugerido": "trecho corrigido",
      "motivo": "Explicação curta"
    }
  ],
  "justificativa_geral": "Breve resumo da auditoria"
}
"""


def apply_ai_audit(
    client: genai.Client,
    model_id: str,
    question_data: Dict[str, Any],
    image_bytes: bytes = None,
) -> Tuple[Dict[str, Any], int]:
    """Executa auditoria multimodal profunda com Gemini 3.7 Flash e auto-aplica as correções no JSON"""
    prompt = AUDIT_PROMPT.replace(
        "{question_json}", json.dumps(question_data, indent=2, ensure_ascii=False)
    )

    contents = []
    if image_bytes:
        contents.append(types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"))
    contents.append(prompt)

    clean_model_id = (model_id or "").replace("vertex/", "").replace("models/", "") or "gemini-3.7-flash"

    try:
        response = client.models.generate_content(
            model=clean_model_id,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        audit_result = json.loads(response.text)
        correcoes = audit_result.get("correcoes_necessarias", [])

        fixes_count = 0
        updated_q = json.loads(json.dumps(question_data))

        # Auto-aplicação das correções diretamente nos campos
        for corr in correcoes:
            campo = corr.get("campo", "")
            orig = corr.get("texto_original", "")
            sugg = corr.get("texto_sugerido", "")

            if not campo or not orig or not sugg:
                continue

            # Se o campo estiver na raiz de dados_questao ou similar
            target = updated_q.get("dados_questao", updated_q)
            if campo in target and isinstance(target[campo], str):
                val = target[campo]
                if orig in val:
                    target[campo] = val.replace(orig, sugg)
                    fixes_count += 1
                elif len(val) > 0 and len(orig) / len(val) >= 0.75:
                    target[campo] = sugg
                    fixes_count += 1
            elif isinstance(target.get("alternativas"), dict) and campo in target["alternativas"]:
                val = target["alternativas"][campo]
                if orig in val:
                    target["alternativas"][campo] = val.replace(orig, sugg)
                    fixes_count += 1
            elif isinstance(target.get("alternativas"), list):
                for alt in target["alternativas"]:
                    if isinstance(alt, dict):
                        for b in alt.get("estrutura", []):
                            if isinstance(b, dict) and b.get("conteudo") and orig in b["conteudo"]:
                                b["conteudo"] = b["conteudo"].replace(orig, sugg)
                                fixes_count += 1
            if isinstance(target.get("estrutura"), list):
                for b in target["estrutura"]:
                    if isinstance(b, dict) and b.get("conteudo") and orig in b["conteudo"]:
                        b["conteudo"] = b["conteudo"].replace(orig, sugg)
                        fixes_count += 1

        return updated_q, fixes_count
    except Exception as e:
        print(f"   ⚠️ Auditoria por IA encontrou erro (mantendo heurística): {e}")
        return question_data, 0


def audit_and_patch_question(
    client: genai.Client,
    model_id: str,
    question_data: Dict[str, Any],
    image_bytes: bytes = None,
) -> Tuple[Dict[str, Any], int]:
    """
    Função principal: Executa heurística + Auditoria IA e retorna o JSON higienizado
    """
    # 1. Limpeza Heurística Instantânea
    q_heur, count_heur = run_heuristics_audit(question_data)

    # 2. Auditoria Multimodal com IA
    q_final, count_ai = apply_ai_audit(client, model_id, q_heur, image_bytes)

    total_fixes = count_heur + count_ai
    return q_final, total_fixes
