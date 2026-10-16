"""Export API endpoint for JSON, CSV, and PDF-ready HTML reports."""
import io
import csv
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TraceModel
from app.schemas import TraceReport
from app.api.traces import _build_trace_report_from_db

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/{trace_id}")
def export_trace_report(
    trace_id: int,
    format: str = Query("json", pattern="^(json|csv|pdf-ready-html)$"),
    db: Session = Depends(get_db),
):
    """Export the defect analysis report in JSON, CSV, or PDF-ready printable HTML format."""
    report: TraceReport = _build_trace_report_from_db(db, trace_id)

    # 1. JSON Export
    if format == "json":
        data = report.model_dump(by_alias=True)
        json_bytes = json.dumps(data, indent=2).encode("utf-8")
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="agentlens_report_{trace_id}.json"'},
        )

    # 2. CSV Export
    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "defect_id",
            "type",
            "severity",
            "message_ids",
            "agents",
            "explanation",
            "evidence_quote",
            "suggested_fix",
            "confidence",
            "detected_by",
        ])

        for d in report.defects:
            writer.writerow([
                d.id,
                d.type.value if hasattr(d.type, "value") else str(d.type),
                d.severity.value if hasattr(d.severity, "value") else str(d.severity),
                ";".join(str(m) for m in d.message_ids),
                ";".join(d.agents),
                d.explanation,
                d.evidence_quote,
                d.suggested_fix,
                d.confidence,
                d.detected_by,
            ])

        csv_bytes = output.getvalue().encode("utf-8")
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="agentlens_defects_{trace_id}.csv"'},
        )

    # 3. PDF-Ready HTML Export
    elif format == "pdf-ready-html":
        html_content = _render_pdf_ready_html(report)
        return HTMLResponse(content=html_content, status_code=200)

    raise HTTPException(status_code=400, detail="Invalid export format.")


def _render_pdf_ready_html(report: TraceReport) -> str:
    """Generates an executive, print-optimized HTML document for PDF generation."""
    severity_colors = {
        "critical": "#dc2626",
        "high": "#ea580c",
        "medium": "#ca8a04",
        "low": "#0284c7",
    }

    defect_rows = []
    for d in report.defects:
        s_val = d.severity.value if hasattr(d.severity, "value") else str(d.severity)
        t_val = d.type.value if hasattr(d.type, "value") else str(d.type)
        color = severity_colors.get(s_val, "#475569")
        msgs_str = ", ".join(f"#{m}" for m in d.message_ids) or "N/A"
        agents_str = ", ".join(d.agents) or "System"

        defect_rows.append(f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 10px; font-weight: 600; font-size: 13px; color: #1e293b;">
                <span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: {color}15; color: {color}; border: 1px solid {color}40; margin-bottom: 4px;">
                    {t_val}
                </span><br>
                <span style="font-size: 11px; color: #64748b;">ID: {d.id}</span>
            </td>
            <td style="padding: 12px 10px;">
                <span style="display:inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: {color}; color: #ffffff;">
                    {s_val}
                </span>
            </td>
            <td style="padding: 12px 10px; font-size: 12px; color: #334155;">
                <strong>Msgs:</strong> {msgs_str}<br>
                <strong>Agents:</strong> {agents_str}
            </td>
            <td style="padding: 12px 10px; font-size: 12px; color: #334155; line-height: 1.4;">
                <p style="margin: 0 0 6px 0;">{d.explanation}</p>
                {f'<blockquote style="margin: 0 0 6px 0; padding: 4px 8px; background: #f8fafc; border-left: 3px solid {color}; font-style: italic; font-size: 11px; color: #475569;">"{d.evidence_quote}"</blockquote>' if d.evidence_quote else ''}
                <div style="font-size: 11px; color: #047857; background: #ecfdf5; padding: 4px 6px; border-radius: 4px;">
                    <strong>Fix:</strong> {d.suggested_fix}
                </div>
            </td>
            <td style="padding: 12px 10px; font-size: 12px; color: #475569; text-align: center;">
                {int(d.confidence * 100)}%<br>
                <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">{d.detected_by}</span>
            </td>
        </tr>
        """)

    agent_rows = []
    for a in report.agents:
        agent_rows.append(f"""
        <li style="margin-bottom: 6px; font-size: 13px; color: #334155;">
            <strong>{a.name}</strong>: <span style="color: #64748b;">{a.role}</span>
        </li>
        """)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AgentLens Report - {report.trace_name}</title>
    <style>
        @page {{
            size: A4;
            margin: 15mm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.5;
            margin: 0;
            padding: 24px;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }}
        .brand {{
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
        }}
        .brand span {{
            color: #6366f1;
        }}
        .meta {{
            font-size: 12px;
            color: #64748b;
            text-align: right;
        }}
        .score-card {{
            display: flex;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 24px;
            margin-bottom: 24px;
            gap: 24px;
        }}
        .score-circle {{
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: #6366f1;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 24px;
            line-height: 1;
        }}
        .score-circle small {{
            font-size: 10px;
            font-weight: 500;
            opacity: 0.9;
        }}
        .score-info h3 {{
            margin: 0 0 4px 0;
            font-size: 16px;
        }}
        .score-info p {{
            margin: 0;
            font-size: 13px;
            color: #64748b;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }}
        .stat-box {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-box .num {{
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
        }}
        .stat-box .label {{
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }}
        th {{
            background: #f1f5f9;
            text-align: left;
            padding: 10px;
            font-size: 11px;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
        }}
        .print-btn {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: #6366f1;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        @media print {{
            .print-btn {{
                display: none;
            }}
            body {{
                padding: 0;
            }}
        }}
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

    <div class="header">
        <div>
            <div class="brand">Agent<span>Lens</span></div>
            <div style="font-size: 14px; font-weight: 600; color: #334155; margin-top: 4px;">{report.trace_name}</div>
            <div style="font-size: 12px; color: #64748b; max-width: 600px;">Task: {report.task}</div>
        </div>
        <div class="meta">
            <div>Report ID: AL-{report.trace_id}</div>
            <div>Generated: {report.created_at[:19]} UTC</div>
            <div>Total Messages: {len(report.messages)} | Agents: {len(report.agents)}</div>
        </div>
    </div>

    <div class="score-card">
        <div class="score-circle">
            {report.health.health_score}
            <small>GRADE {report.health.grade}</small>
        </div>
        <div class="score-info">
            <h3>Communication Quality Health Score: {report.health.health_score}/100</h3>
            <p>{report.health.formula_summary}</p>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-box">
            <div class="num">{len(report.defects)}</div>
            <div class="label">Total Defects</div>
        </div>
        <div class="stat-box">
            <div class="num" style="color: #dc2626;">{report.defect_counts_by_severity.get('critical', 0)}</div>
            <div class="label">Critical Issues</div>
        </div>
        <div class="stat-box">
            <div class="num" style="color: #ea580c;">{report.defect_counts_by_severity.get('high', 0)}</div>
            <div class="label">High Severity</div>
        </div>
        <div class="stat-box">
            <div class="num">{len(report.graph.cycles_detected)}</div>
            <div class="label">Cycles Detected</div>
        </div>
    </div>

    <div style="margin-bottom: 24px;">
        <h3 style="font-size: 15px; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Participating Agent Roster</h3>
        <ul style="margin: 0; padding-left: 20px;">
            {''.join(agent_rows)}
        </ul>
    </div>

    <h3 style="font-size: 15px; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Detected Communication Defects & Recommendations</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 22%;">Defect Type</th>
                <th style="width: 10%;">Severity</th>
                <th style="width: 16%;">Context</th>
                <th style="width: 44%;">Explanation & Fix</th>
                <th style="width: 8%;">Confidence</th>
            </tr>
        </thead>
        <tbody>
            {''.join(defect_rows) if defect_rows else '<tr><td colspan="5" style="text-align:center; padding: 24px; color: #10b981; font-weight: 600;">✨ Zero communication defects detected. Excellent multi-agent alignment!</td></tr>'}
        </tbody>
    </table>

    <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        AgentLens Multi-Agent Communication Analysis • Automated Diagnostic Report
    </div>
</body>
</html>
"""
    return html
