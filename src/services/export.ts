import { TraceReport } from '../types';

export class ExportService {
  public static exportJson(report: TraceReport): void {
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentlens_report_${report.trace_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public static exportCsv(report: TraceReport): void {
    const headers = [
      'defect_id',
      'type',
      'severity',
      'message_ids',
      'agents',
      'explanation',
      'evidence_quote',
      'suggested_fix',
      'confidence',
      'detected_by',
    ];

    const rows = report.defects.map(d => [
      d.id,
      d.type,
      d.severity,
      d.message_ids.join(';'),
      d.agents.join(';'),
      `"${(d.explanation || '').replace(/"/g, '""')}"`,
      `"${(d.evidence_quote || '').replace(/"/g, '""')}"`,
      `"${(d.suggested_fix || '').replace(/"/g, '""')}"`,
      d.confidence,
      d.detected_by,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentlens_defects_${report.trace_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public static exportPdfReadyHtml(report: TraceReport): void {
    const severityColors: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#0284c7',
    };

    const defectRows = report.defects.map(d => {
      const color = severityColors[d.severity] || '#475569';
      const msgsStr = d.message_ids.map(m => `#${m}`).join(', ') || 'N/A';
      const agentsStr = d.agents.join(', ') || 'System';

      return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 10px; font-weight: 600; font-size: 13px; color: #1e293b;">
          <span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: ${color}15; color: ${color}; border: 1px solid ${color}40; margin-bottom: 4px;">
            ${d.type}
          </span><br>
          <span style="font-size: 11px; color: #64748b;">ID: ${d.id}</span>
        </td>
        <td style="padding: 12px 10px;">
          <span style="display:inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: ${color}; color: #ffffff;">
            ${d.severity}
          </span>
        </td>
        <td style="padding: 12px 10px; font-size: 12px; color: #334155;">
          <strong>Msgs:</strong> ${msgsStr}<br>
          <strong>Agents:</strong> ${agentsStr}
        </td>
        <td style="padding: 12px 10px; font-size: 12px; color: #334155; line-height: 1.4;">
          <p style="margin: 0 0 6px 0;">${d.explanation}</p>
          ${
            d.evidence_quote
              ? `<blockquote style="margin: 0 0 6px 0; padding: 4px 8px; background: #f8fafc; border-left: 3px solid ${color}; font-style: italic; font-size: 11px; color: #475569;">"${d.evidence_quote}"</blockquote>`
              : ''
          }
          <div style="font-size: 11px; color: #047857; background: #ecfdf5; padding: 4px 6px; border-radius: 4px;">
            <strong>Fix:</strong> ${d.suggested_fix}
          </div>
        </td>
        <td style="padding: 12px 10px; font-size: 12px; color: #475569; text-align: center;">
          ${Math.round(d.confidence * 100)}%<br>
          <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">${d.detected_by}</span>
        </td>
      </tr>
      `;
    });

    const agentRows = report.agents.map(
      a => `
      <li style="margin-bottom: 6px; font-size: 13px; color: #334155;">
        <strong>${a.name}</strong>: <span style="color: #64748b;">${a.role}</span>
      </li>
    `
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AgentLens Report - ${report.trace_name}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.5;
            margin: 0;
            padding: 24px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; }
        .brand span { color: #6366f1; }
        .meta { font-size: 12px; color: #64748b; text-align: right; }
        .score-card {
            display: flex;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 24px;
            margin-bottom: 24px;
            gap: 24px;
        }
        .score-circle {
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
        }
        .score-circle small { font-size: 10px; font-weight: 500; opacity: 0.9; }
        .score-info h3 { margin: 0 0 4px 0; font-size: 16px; }
        .score-info p { margin: 0; font-size: 13px; color: #64748b; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }
        .stat-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-box .num { font-size: 20px; font-weight: 700; color: #0f172a; }
        .stat-box .label { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th {
            background: #f1f5f9;
            text-align: left;
            padding: 10px;
            font-size: 11px;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
        }
        .print-btn {
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
        }
        @media print {
            .print-btn { display: none; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

    <div class="header">
        <div>
            <div class="brand">Agent<span>Lens</span></div>
            <div style="font-size: 14px; font-weight: 600; color: #334155; margin-top: 4px;">${report.trace_name}</div>
            <div style="font-size: 12px; color: #64748b; max-width: 600px;">Task: ${report.task}</div>
        </div>
        <div class="meta">
            <div>Report ID: AL-${report.trace_id}</div>
            <div>Generated: ${report.created_at.slice(0, 19)} UTC</div>
            <div>Total Messages: ${report.messages.length} | Agents: ${report.agents.length}</div>
        </div>
    </div>

    <div class="score-card">
        <div class="score-circle">
            ${report.health.health_score}
            <small>GRADE ${report.health.grade}</small>
        </div>
        <div class="score-info">
            <h3>Communication Quality Health Score: ${report.health.health_score}/100</h3>
            <p>${report.health.formula_summary}</p>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-box">
            <div class="num">${report.defects.length}</div>
            <div class="label">Total Defects</div>
        </div>
        <div class="stat-box">
            <div class="num" style="color: #dc2626;">${report.defect_counts_by_severity['critical'] || 0}</div>
            <div class="label">Critical Issues</div>
        </div>
        <div class="stat-box">
            <div class="num" style="color: #ea580c;">${report.defect_counts_by_severity['high'] || 0}</div>
            <div class="label">High Severity</div>
        </div>
        <div class="stat-box">
            <div class="num">${report.graph.cycles_detected.length}</div>
            <div class="label">Cycles Detected</div>
        </div>
    </div>

    <div style="margin-bottom: 24px;">
        <h3 style="font-size: 15px; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Participating Agent Roster</h3>
        <ul style="margin: 0; padding-left: 20px;">
            ${agentRows.join('')}
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
            ${
              defectRows.length > 0
                ? defectRows.join('')
                : '<tr><td colspan="5" style="text-align:center; padding: 24px; color: #10b981; font-weight: 600;">✨ Zero communication defects detected. Excellent multi-agent alignment!</td></tr>'
            }
        </tbody>
    </table>

    <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        AgentLens Multi-Agent Communication Analysis • Automated Diagnostic Report
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener,noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
