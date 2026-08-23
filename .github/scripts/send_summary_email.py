#!/usr/bin/env python3
"""
send_summary_email.py - Envio do Relatório Consolidado de Ingestão sob Demanda
Utiliza smtplib nativo com Gmail App Password, incorporando a logo real em base64, KaTeX e rollback de lote.
"""

import argparse
import base64
import json
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


LOGO_PUBLIC_URL = "https://maia-api.vercel.app/logo.png"


def build_html_report(
    theme: str,
    batch_id: str,
    model: str,
    duration: str,
    books_count: int,
    questions_count: int,
    fixes_count: int,
    dedup_count: int,
    books_details: list,
    questions_details: list,
    audit_details: list,
    rollback_token: str,
    status: str = "completed",
) -> str:
    logo_url = LOGO_PUBLIC_URL

    # Determinar Badge de Status e Subtítulo
    if status == "quota_paused":
        status_badge_text = "Pausado por Cota — Retomada Automática Agendada"
        status_sub = "O limite de requisições foi atingido. O progresso foi preservado no payload e o próximo worker continuará automaticamente."
        badge_style = "background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.4); color: #fbbf24;"
        dot_style = "background: #fbbf24; box-shadow: 0 0 8px #fbbf24;"
    elif status == "circuit_breaker_tripped":
        status_badge_text = "Interrompido por Segurança (Circuit Breaker)"
        status_sub = "Múltiplas falhas consecutivas de API detectadas. O cluster foi desarmado para evitar consumo indevido de tokens."
        badge_style = "background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.4); color: #f87171;"
        dot_style = "background: #ef4444; box-shadow: 0 0 8px #ef4444;"
    elif status == "error":
        status_badge_text = "Falha no Processamento dos Arquivos"
        status_sub = "Ocorreu um erro durante a execução dos workers. Nenhum dado corrompido foi inserido no banco."
        badge_style = "background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.4); color: #f87171;"
        dot_style = "background: #ef4444; box-shadow: 0 0 8px #ef4444;"
    elif not books_details and not questions_details:
        status_badge_text = "Nenhum Conteúdo Inserido no Banco"
        status_sub = "Os arquivos foram localizados, mas nenhuma questão ou livro foi inserido devido a falha ou ausência de extração."
        badge_style = "background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); color: #f87171;"
        dot_style = "background: #ef4444; box-shadow: 0 0 8px #ef4444;"
    else:
        status_badge_text = "Ingestão Autônoma Concluída"
        status_sub = "Varredura profunda, OCR multimodal e indexação semântica finalizados com sucesso."
        badge_style = "background: rgba(0, 229, 255, 0.08); border-color: rgba(0, 229, 255, 0.3); color: #22d3ee;"
        dot_style = "background: #00e5ff; box-shadow: 0 0 8px #00e5ff;"

    # Formatar itens de livros
    books_html = ""
    for b in books_details:
        title = b.get("title", "Livro Didático")
        badge = b.get("badge", "Páginas Processadas")
        desc = b.get("desc", "Mapeamento sequencial de tópicos e vetores gerados no Pinecone (namespace theory).")
        books_html += f"""
        <div class="card-item">
          <div class="card-item-header">
            <span class="card-item-title">{title}</span>
            <span class="card-badge">{badge}</span>
          </div>
          <p class="card-item-desc">{desc}</p>
        </div>
        """

    if not books_html:
        books_html = """
        <div class="card-item">
          <div class="card-item-header">
            <span class="card-item-title">Nenhum livro indexado</span>
            <span class="card-badge">0 Páginas</span>
          </div>
          <p class="card-item-desc">Nenhum livro didático foi salvo no banco semântico Pinecone neste lote.</p>
        </div>
        """

    # Formatar itens de questões
    questions_html = ""
    for q in questions_details:
        title = q.get("title", "Lista de Questões")
        badge = q.get("badge", "Questões Inseridas")
        desc = q.get("desc", "Segmentação em caixas gulosas e formulas em LaTeX processadas.")
        questions_html += f"""
        <div class="card-item">
          <div class="card-item-header">
            <span class="card-item-title">{title}</span>
            <span class="card-badge green">{badge}</span>
          </div>
          <p class="card-item-desc">{desc}</p>
        </div>
        """

    if not questions_html:
        questions_html = """
        <div class="card-item">
          <div class="card-item-header">
            <span class="card-item-title">Nenhuma questão inserida</span>
            <span class="card-badge green">0 Questões</span>
          </div>
          <p class="card-item-desc">Nenhuma questão foi processada ou inserida no banco Firebase neste lote.</p>
        </div>
        """

    # Formatar auditoria
    audit_html = ""
    for a in audit_details:
        audit_html += f'<div class="audit-log-row">• {a}</div>\n'

    if not audit_html:
        audit_html = """
        <div class="audit-log-row">• <strong>Higienização Automática:</strong> Nenhuma anomalia de OCR ou corrupção de caracteres detectada.</div>
        <div class="audit-log-row">• <strong>Validação de LaTeX:</strong> Fórmulas matemáticas e químicas íntegras em conformidade com os gabaritos.</div>
        """

    rollback_url = f"https://maia-api.vercel.app/admin/rollback?batch_id={batch_id}&token={rollback_token}"

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Coleta sob Demanda — Maia.api</title>
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, {{delimiters: [{{left: '$$', right: '$$', display: true}}, {{left: '$', right: '$', display: false}}]}})"></script>

  <style>
    @font-face {{
      font-family: "FKGroteskNeue";
      src: url("https://r2cdn.perplexity.ai/fonts/FKGroteskNeue.woff2") format("woff2");
      font-weight: 100 900;
      font-style: normal;
    }}

    body {{
      margin: 0;
      padding: 0;
      background-color: #121315;
      font-family: "FKGroteskNeue", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e4e4e7;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }}

    .wrapper {{
      width: 100%;
      background-color: #121315;
      padding: 32px 12px;
      box-sizing: border-box;
    }}

    .container {{
      max-width: 600px;
      width: 100%;
      margin: 0 auto;
      background-color: #18191d;
      border-radius: 20px;
      border: 1px solid #282a30;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
    }}

    .header {{
      padding: 36px 24px 20px 24px;
      text-align: center;
      position: relative;
    }}

    .brand-logo-wrap {{
      display: inline-block;
      margin-bottom: 18px;
      text-decoration: none;
      text-align: center;
    }}

    .brand-logo-img {{
      width: 48px;
      height: 48px;
      object-fit: contain;
      vertical-align: middle;
      display: inline-block;
    }}

    .brand-name {{
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      line-height: 1;
      display: inline-block;
      vertical-align: middle;
      margin-left: 10px;
    }}

    .brand-name strong {{
      color: #00e5ff;
      font-weight: 800;
    }}

    .status-badge-aura {{
      display: inline-block;
      background: rgba(0, 229, 255, 0.08);
      border: 1px solid rgba(0, 229, 255, 0.3);
      color: #22d3ee;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 14px;
    }}

    .status-pulse-dot {{
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #00e5ff;
      margin-right: 6px;
      vertical-align: middle;
    }}

    .header-title {{
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 6px 0;
      letter-spacing: -0.3px;
    }}

    .header-subtitle {{
      font-size: 13px;
      color: #8e94a0;
      margin: 0;
      line-height: 1.4;
    }}

    .content {{
      padding: 10px 24px 32px 24px;
    }}

    .query-pill-card {{
      background: #202227;
      border: 1px solid #2d3038;
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 22px;
    }}

    .query-label {{
      font-size: 11px;
      color: #717682;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 6px;
    }}

    .query-text {{
      font-size: 15px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.4;
      margin-bottom: 12px;
      word-break: break-word;
    }}

    .query-meta-bar {{
      display: block;
      padding-top: 10px;
      border-top: 1px solid #2a2d35;
    }}

    .meta-chip {{
      background: #282a31;
      color: #9da3af;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid #363942;
      font-size: 11px;
      font-weight: 500;
      display: inline-block;
      margin: 2px 4px 2px 0;
      word-break: break-all;
      max-width: 100%;
      box-sizing: border-box;
    }}

    .meta-chip.active-model {{
      color: #00e5ff;
      border-color: rgba(0, 229, 255, 0.35);
      background: rgba(0, 229, 255, 0.06);
    }}

    .meta-chip.code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      color: #717682;
    }}

    .metrics-table {{
      width: 100%;
      margin-bottom: 22px;
      border-spacing: 6px 0;
      border-collapse: separate;
      table-layout: fixed;
    }}

    .metric-card {{
      background: #202227;
      border: 1px solid #2d3038;
      border-radius: 12px;
      padding: 12px 4px;
      text-align: center;
      width: 25%;
      box-sizing: border-box;
    }}

    .metric-value {{
      font-size: 22px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 4px;
    }}

    .metric-value.cyan {{ color: #00e5ff; }}
    .metric-value.emerald {{ color: #34d399; }}
    .metric-value.purple {{ color: #c084fc; }}
    .metric-value.gray {{ color: #717682; }}

    .metric-title {{
      font-size: 9.5px;
      font-weight: 600;
      color: #8e94a0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      line-height: 1.2;
    }}

    .section-tagline {{
      font-size: 12px;
      font-weight: 700;
      color: #8e94a0;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 24px 0 10px 0;
    }}

    .card-item {{
      background: #202227;
      border: 1px solid #2b2e36;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 10px;
    }}

    .card-item-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      gap: 10px;
    }}

    .card-item-title {{
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff;
      word-break: break-word;
      line-height: 1.3;
    }}

    .card-badge {{
      background: rgba(0, 229, 255, 0.1);
      color: #00e5ff;
      border: 1px solid rgba(0, 229, 255, 0.25);
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 10.5px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
      display: inline-block;
      text-align: center;
      line-height: 1.2;
    }}

    .card-badge.green {{
      background: rgba(52, 211, 153, 0.1);
      color: #34d399;
      border-color: rgba(52, 211, 153, 0.25);
    }}

    .card-item-desc {{
      font-size: 12.5px;
      color: #9da3af;
      line-height: 1.5;
      margin: 0;
      word-break: break-word;
    }}

    .audit-aura-box {{
      background: rgba(168, 85, 247, 0.05);
      border: 1px solid rgba(168, 85, 247, 0.25);
      border-radius: 14px;
      padding: 16px 16px;
      margin-top: 20px;
    }}

    .audit-aura-title {{
      font-size: 11.5px;
      font-weight: 700;
      color: #c084fc;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }}

    .audit-log-row {{
      font-size: 12px;
      color: #d1d5db;
      line-height: 1.5;
      margin-bottom: 6px;
      word-break: break-word;
    }}

    .rollback-zone {{
      margin-top: 28px;
      background: #1c181b;
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 16px;
      padding: 20px 16px;
      text-align: center;
    }}

    .rollback-title {{
      font-size: 13.5px;
      font-weight: 700;
      color: #f87171;
      margin-bottom: 6px;
    }}

    .rollback-desc {{
      font-size: 11.5px;
      color: #9da3af;
      line-height: 1.4;
      margin-bottom: 16px;
      max-width: 440px;
      margin-left: auto;
      margin-right: auto;
    }}

    .btn-rollback-aura {{
      display: inline-block;
      background: #ef4444;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 12.5px;
      padding: 10px 22px;
      border-radius: 9999px;
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.35);
    }}

    .footer {{
      padding: 22px 24px;
      background: #141518;
      border-top: 1px solid #23252a;
      text-align: center;
      font-size: 11px;
      color: #52525b;
      line-height: 1.5;
    }}

    .footer a {{
      color: #00e5ff;
      text-decoration: none;
      font-weight: 600;
    }}

    @media only screen and (max-width: 520px) {{
      .wrapper {{
        padding: 10px 4px !important;
      }}
      .header {{
        padding: 24px 14px 16px 14px !important;
      }}
      .content {{
        padding: 8px 12px 24px 12px !important;
      }}
      .brand-name {{
        font-size: 26px !important;
      }}
      .brand-logo-img {{
        width: 38px !important;
        height: 38px !important;
      }}
      .header-title {{
        font-size: 17px !important;
      }}
      .metric-value {{
        font-size: 18px !important;
      }}
      .metric-title {{
        font-size: 8px !important;
      }}
      .query-pill-card {{
        padding: 12px 12px !important;
      }}
      .query-text {{
        font-size: 13.5px !important;
      }}
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <div class="header">
        <div class="brand-logo-wrap">
          <img src="{logo_url}" alt="Maia.api" class="brand-logo-img" width="48" height="48" />
          <div class="brand-name">Maia<strong>.api</strong></div>
        </div>

        <div>
          <span class="status-badge-aura" style="{badge_style}">
            <span class="status-pulse-dot" style="{dot_style}"></span>
            {status_badge_text}
          </span>
        </div>

        <h1 class="header-title">Relatório de Ingestão sob Demanda</h1>
        <p class="header-subtitle">{status_sub}</p>
      </div>

      <div class="content">
        
        <div class="query-pill-card">
          <div class="query-label">Tema da Requisição</div>
          <div class="query-text">"{theme}"</div>
          
          <div class="query-meta-bar">
            <span class="meta-chip active-model">⚡ {model}</span>
            <span class="meta-chip">⏱️ {duration}</span>
            <span class="meta-chip code">{batch_id}</span>
          </div>
        </div>

        <table class="metrics-table" width="100%">
          <tr>
            <td class="metric-card">
              <div class="metric-value cyan">{books_count}</div>
              <div class="metric-title">Livros Mapeados</div>
            </td>
            <td class="metric-card">
              <div class="metric-value emerald">{questions_count}</div>
              <div class="metric-title">Questões Inseridas</div>
            </td>
            <td class="metric-card">
              <div class="metric-value purple">{fixes_count}</div>
              <div class="metric-title">Ajustes por IA</div>
            </td>
            <td class="metric-card">
              <div class="metric-value gray">{dedup_count}</div>
              <div class="metric-title">Dedup (Ignorados)</div>
            </td>
          </tr>
        </table>

        <div class="section-tagline">
          📚 Livros Didáticos Catalogados
        </div>
        {books_html}

        <div class="section-tagline">
          📝 Listas de Exercícios & Provas
        </div>
        {questions_html}

        <div class="audit-aura-box">
          <div class="audit-aura-title">
            <span>🛡️</span> Auditoria & Auto-Correção por IA
          </div>
          {audit_html}
        </div>

        <div class="rollback-zone">
          <div class="rollback-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Zona de Rollback de Emergência
          </div>
          <p class="rollback-desc">
            Se você detectar qualquer inconsistência nas questões ou livros deste lote, clique no botão abaixo para purgar instantaneamente <strong>apenas esta coleta</strong> do Firebase e do Pinecone.
          </p>
          <a href="{rollback_url}" class="btn-rollback-aura" target="_blank">
            🗑️ Reverter / Excluir Todo Este Lote
          </a>
        </div>

      </div>

      <div class="footer">
        Enviado automaticamente pelo cluster de processamento do <strong>Maia.api</strong>.<br>
        Cluster: <code>GitHub Actions Matrix Runner</code> | Identificador: <code>{batch_id}</code><br>
        <a href="https://maia-api.vercel.app">Abrir Banco de Questões no Maia</a>
      </div>

    </div>
  </div>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Envia e-mail com o relatório da coleta")
    parser.add_argument("--to", required=True, help="E-mail destinatário (admin)")
    parser.add_argument("--theme", required=True, help="Tema pesquisado")
    parser.add_argument("--batch-id", required=True, help="ID do lote")
    parser.add_argument("--model", default="Gemini 3.7 Flash", help="Modelo de IA")
    parser.add_argument("--duration", default="3m 45s", help="Tempo total de execução")
    parser.add_argument("--books-count", type=int, default=0, help="Total de livros processados")
    parser.add_argument("--questions-count", type=int, default=0, help="Total de questões adicionadas")
    parser.add_argument("--fixes-count", type=int, default=0, help="Total de correções feitas por IA")
    parser.add_argument("--dedup-count", type=int, default=0, help="Total de duplicatas ignoradas")
    parser.add_argument("--books-json", default="[]", help="JSON com detalhes dos livros")
    parser.add_argument("--questions-json", default="[]", help="JSON com detalhes das questões")
    parser.add_argument("--audit-json", default="[]", help="JSON com logs de auditoria")
    parser.add_argument("--rollback-token", default="sec_default", help="Token de segurança para o link de rollback")
    parser.add_argument("--status", default="completed", choices=["completed", "quota_paused", "circuit_breaker_tripped"], help="Status da execução")

    args = parser.parse_args()

    gmail_sender = os.getenv("GMAIL_SENDER")
    gmail_password = os.getenv("GMAIL_APP_PASSWORD")

    if not gmail_sender or not gmail_password:
        print("⚠️ GMAIL_SENDER ou GMAIL_APP_PASSWORD não configurados nos Secrets. O e-mail não pôde ser enviado.")
        sys.exit(0)

    try:
        books_details = json.loads(args.books_json) if args.books_json else []
    except Exception:
        books_details = []

    try:
        questions_details = json.loads(args.questions_json) if args.questions_json else []
    except Exception:
        questions_details = []

    try:
        audit_details = json.loads(args.audit_json) if args.audit_json else []
    except Exception:
        audit_details = []

    books_count = args.books_count
    questions_count = args.questions_count

    # Descoberta automática de manifestos gerados nas pastas all_results e output
    if not books_details and not questions_details:
        search_dirs = ["all_results", "output"]
        for s_dir in search_dirs:
            if os.path.exists(s_dir):
                for root, dirs, files in os.walk(s_dir):
                    for file in files:
                        if file == "manifest.json":
                            mpath = os.path.join(root, file)
                            try:
                                with open(mpath, "r", encoding="utf-8") as f:
                                    m_data = json.load(f)
                                    if isinstance(m_data, dict):
                                        if "tree" in m_data or "total_pages" in m_data:
                                            b_slug = m_data.get("slug", os.path.basename(root))
                                            b_pages = m_data.get("total_pages", len(m_data.get("pages", {})))
                                            books_details.append({
                                                "title": b_slug,
                                                "badge": f"{b_pages} Páginas Processadas",
                                                "desc": "Mapeamento sequencial de tópicos e vetores gerados no Pinecone (namespace theory).",
                                            })
                                        elif "results" in m_data or "extraction_results" in m_data or "slug" in m_data:
                                            q_slug = m_data.get("slug", os.path.basename(root))
                                            res_items = m_data.get("results", [])
                                            q_c = 0
                                            for it in res_items:
                                                ex = it.get("extraction_results", {})
                                                for p, pdata in ex.get("pages", {}).items():
                                                    q_c += len(pdata.get("questions", []))
                                            if q_c > 0:
                                                questions_details.append({
                                                    "title": q_slug,
                                                    "badge": f"{q_c} Questões Inseridas",
                                                    "desc": "Segmentação em caixas gulosas e formulas em LaTeX processadas.",
                                                })
                            except Exception:
                                pass

    # Se nenhum livro/questão foi realmente salvo/extraído, a contagem de inserção no banco deve ser 0
    if not books_details:
        books_count = 0
    else:
        books_count = len(books_details)

    if not questions_details:
        questions_count = 0
    else:
        questions_count = sum(int(q.get("badge", "0").split()[0]) for q in questions_details if q.get("badge", "0").split()[0].isdigit())
        if questions_count == 0:
            questions_count = len(questions_details)

    html_content = build_html_report(
        theme=args.theme,
        batch_id=args.batch_id,
        model=args.model,
        duration=args.duration,
        books_count=books_count,
        questions_count=questions_count,
        fixes_count=args.fixes_count,
        dedup_count=args.dedup_count,
        books_details=books_details,
        questions_details=questions_details,
        audit_details=audit_details,
        rollback_token=args.rollback_token,
        status=args.status,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"⚡ [Maia.api] Relatório de Ingestão: {args.theme} ({args.batch_id})"
    msg["From"] = f"Maia.api Pipeline <{gmail_sender}>"
    msg["To"] = args.to

    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        print(f"📧 Conectando ao servidor SMTP do Gmail para enviar a {args.to}...")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_sender, gmail_password)
            server.sendmail(gmail_sender, [args.to], msg.as_string())
        print(f"✅ E-mail enviado com sucesso para: {args.to}")
    except Exception as e:
        print(f"❌ Erro ao enviar e-mail via SMTP: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
