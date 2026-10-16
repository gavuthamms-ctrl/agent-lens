import React from 'react';
import { TraceReport, TraceSummaryItem } from '../types';
import { DefectsByTypeChart, DefectsBySeverityChart, DefectsByAgentChart } from './Charts';

interface DashboardPageProps {
  traces: TraceSummaryItem[];
  latestReport: TraceReport | null;
  theme: 'dark' | 'light';
  onRefresh: () => void;
  onOpenTrace: (traceId: number) => void;
  onOpenEval: (traceId: number) => void;
  onDeleteTrace: (traceId: number) => void;
  onNavigateUpload: () => void;
  onGenerateDemo: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  traces,
  latestReport,
  theme,
  onRefresh,
  onOpenTrace,
  onOpenEval,
  onDeleteTrace,
  onNavigateUpload,
  onGenerateDemo,
}) => {
  const totalTraces = traces.length;
  const totalDefects = traces.reduce((acc, t) => acc + (t.defect_count || 0), 0);
  const criticalTraces = traces.filter(t => (t.health_score ?? 100) < 50).length;
  const avgHealth =
    totalTraces > 0
      ? Math.round(traces.reduce((acc, t) => acc + (t.health_score ?? 100), 0) / totalTraces)
      : 100;

  // Aggregate charts data or use latest report
  const typeCounts = latestReport ? latestReport.defect_counts_by_type : {};
  const severityCounts = latestReport
    ? latestReport.defect_counts_by_severity
    : { critical: 0, high: 0, medium: 0, low: 0 };
  const agentCounts = latestReport ? latestReport.defect_counts_by_agent : {};

  return (
    <div className="tab-page active">
      {/* Summary Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Traces</div>
          <div className="stat-val">{totalTraces}</div>
          <div className="stat-sub">conversation traces stored</div>
        </div>
        <div className="stat-card high">
          <div className="stat-label">Total Defects</div>
          <div className="stat-val">{totalDefects}</div>
          <div className="stat-sub">across all traces</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-label">Low-Score Traces</div>
          <div className="stat-val">{criticalTraces}</div>
          <div className="stat-sub">health score below 50</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Avg Health Score</div>
          <div className="stat-val">{avgHealth}/100</div>
          <div className="stat-sub">communication quality</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">🏷️ Defects by Type</span>
          </div>
          <div className="chart-container">
            <DefectsByTypeChart typeCounts={typeCounts} theme={theme} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🎯 By Severity</span>
          </div>
          <div className="chart-container">
            <DefectsBySeverityChart severityCounts={severityCounts} theme={theme} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🤖 By Agent</span>
          </div>
          <div className="chart-container">
            <DefectsByAgentChart agentCounts={agentCounts} theme={theme} />
          </div>
        </div>
      </div>

      {/* Traces Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📂 Stored Traces</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
              🔄 Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={onNavigateUpload}>
              📤 New Trace
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Trace Name & Task</th>
                <th>Agents</th>
                <th>Messages</th>
                <th>Defects</th>
                <th>Health</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {traces.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">🤖</div>
                      <div className="empty-text">No traces yet</div>
                      <div className="empty-sub">
                        Upload a trace file or generate a demo to get started.
                      </div>
                      <div style={{ marginTop: '16px' }}>
                        <button className="btn btn-primary" onClick={onNavigateUpload}>
                          📤 Upload Trace
                        </button>
                        &nbsp;
                        <button className="btn btn-secondary" onClick={onGenerateDemo}>
                          🎭 Generate Demo
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                traces.map(t => {
                  const score = t.health_score !== null ? t.health_score : '—';
                  const grade = t.grade || '—';
                  const gradeHtml =
                    t.health_score !== null ? (
                      <span className={`score-pill grade-${grade}`}>
                        {score}/100 <strong>{grade}</strong>
                      </span>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          background: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Not analyzed
                      </span>
                    );

                  return (
                    <tr key={t.id}>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(99,102,241,0.1)',
                            color: '#818cf8',
                            border: '1px solid rgba(99,102,241,0.3)',
                          }}
                        >
                          #{t.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.trace_name}</div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          {t.task.slice(0, 60)}…
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px' }}>{t.agent_count}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px' }}>{t.message_count}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: t.defect_count > 0 ? '#f97316' : '#10b981',
                          }}
                        >
                          {t.defect_count}
                        </span>
                        {t.has_ground_truth && (
                          <span className="badge badge-rule" style={{ marginLeft: '4px' }}>
                            GT
                          </span>
                        )}
                      </td>
                      <td>{gradeHtml}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onOpenTrace(t.id)}
                          >
                            🔬 Analyze
                          </button>
                          {t.has_ground_truth && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onOpenEval(t.id)}
                            >
                              📏 Eval
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onDeleteTrace(t.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
