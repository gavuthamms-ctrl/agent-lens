import React, { useState } from 'react';
import { DefectSchema, GraphEdge, GraphNode, TraceReport } from '../types';
import { AgentGraph } from './AgentGraph';
import { ExportService } from '../services/export';
import { DrawerContent } from './DefectDrawer';

interface AnalysisPageProps {
  report: TraceReport | null;
  theme: 'dark' | 'light';
  onReanalyze: (traceId: number) => void;
  onOpenEval: (traceId: number) => void;
  onOpenDrawer: (content: DrawerContent) => void;
}

function healthBarColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#0ea5e9';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  report,
  theme,
  onReanalyze,
  onOpenEval,
  onOpenDrawer,
}) => {
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (!report) {
    return (
      <div className="tab-page active">
        <div className="empty-state">
          <div className="empty-icon">🔬</div>
          <div className="empty-text">No trace selected for analysis</div>
          <div className="empty-sub">
            Please choose a trace from the dashboard or upload a new trace.
          </div>
        </div>
      </div>
    );
  }

  // Filter messages
  const defectMap = new Map<number, DefectSchema[]>();
  for (const d of report.defects) {
    for (const mid of d.message_ids) {
      if (!defectMap.has(mid)) defectMap.set(mid, []);
      defectMap.get(mid)!.push(d);
    }
  }

  let filteredMessages = report.messages;

  if (filterAgent) {
    filteredMessages = filteredMessages.filter(
      m => m.sender === filterAgent || m.receiver === filterAgent
    );
  }

  if (filterType || filterSeverity || filterSource) {
    const defectMsgIds = new Set<number>();
    report.defects
      .filter(d => {
        if (filterType && d.type !== filterType) return false;
        if (filterSeverity && d.severity !== filterSeverity) return false;
        if (filterSource && d.detected_by !== filterSource) return false;
        return true;
      })
      .forEach(d => d.message_ids.forEach(id => defectMsgIds.add(id)));

    filteredMessages = filteredMessages.filter(m => defectMsgIds.has(m.id));
  }

  const handleClearFilters = () => {
    setFilterType('');
    setFilterSeverity('');
    setFilterAgent('');
    setFilterSource('');
  };

  const handleNodeClick = (node: GraphNode) => {
    const defects = report.defects.filter(d => d.agents.includes(node.id));
    onOpenDrawer({ type: 'node', node, defects });
  };

  const handleEdgeClick = (edge: GraphEdge) => {
    const msgs = report.messages.filter(m => edge.message_ids.includes(m.id));
    onOpenDrawer({ type: 'edge', edge, messages: msgs });
  };

  const defectTypes = Array.from(new Set(report.defects.map(d => d.type)));

  return (
    <div className="tab-page active">
      {/* Analysis Header */}
      <div className="analysis-header">
        <div className="analysis-trace-info">
          <h2>{report.trace_name}</h2>
          <p>{report.task}</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Trace <strong>#{report.trace_id}</strong>
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              🤖 <strong>{report.agents.length}</strong> agents
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              💬 <strong>{report.messages.length}</strong> messages
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ⚠️ <strong>{report.defects.length}</strong> defects
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <div className="health-banner">
            <div
              className="health-gauge"
              style={{ background: healthBarColor(report.health.health_score) }}
            >
              {report.health.health_score}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>Communication Health</div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  maxWidth: '340px',
                }}
              >
                Grade {report.health.grade} — {report.health.formula_summary}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onReanalyze(report.trace_id)}
            >
              🔄 Re-analyze
            </button>
            {report.has_ground_truth && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenEval(report.trace_id)}
              >
                📏 Evaluate
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                ⬇️ Export ▾
              </button>
              {showExportMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    width: '160px',
                    zIndex: 50,
                    boxShadow: 'var(--shadow-md)',
                    padding: '8px 4px',
                  }}
                  onClick={() => setShowExportMenu(false)}
                >
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px' }}
                    onClick={() => ExportService.exportJson(report)}
                  >
                    📄 JSON Report
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px' }}
                    onClick={() => ExportService.exportCsv(report)}
                  >
                    📊 CSV Defects
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => ExportService.exportPdfReadyHtml(report)}
                  >
                    🖨️ PDF-Ready HTML
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          🔍 Filter:
        </span>

        <div className="filter-group">
          <label>Type</label>
          <select
            className="filter-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {defectTypes.map(t => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Severity</label>
          <select
            className="filter-select"
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Agent</label>
          <select
            className="filter-select"
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
          >
            <option value="">All Agents</option>
            {report.agents.map(a => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Source</label>
          <select
            className="filter-select"
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
          >
            <option value="">All</option>
            <option value="rule">Rule</option>
            <option value="llm">LLM</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        <button className="btn btn-outline btn-sm" onClick={handleClearFilters}>
          ✕ Clear
        </button>
      </div>

      {/* Split Workspace: Graph | Timeline */}
      <div className="analysis-workspace">
        {/* Left: Agent Graph */}
        <div className="panel-container">
          <div className="panel-header">
            <span>🕸️ Agent Communication Network</span>
          </div>
          <div id="graph-container">
            <AgentGraph
              graphData={report.graph}
              theme={theme}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          </div>
        </div>

        {/* Right: Message Timeline */}
        <div className="panel-container">
          <div className="panel-header">
            <span>💬 Message Timeline</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Click a defect badge for details
            </span>
          </div>

          <div className="timeline-wrapper">
            {filteredMessages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">No messages match filters</div>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const msgDefects = defectMap.get(msg.id) || [];
                const hasDefect = msgDefects.length > 0;
                const hasCritical = msgDefects.some(d => d.severity === 'critical');

                return (
                  <div
                    key={msg.id}
                    className={`timeline-message ${hasDefect ? 'has-defect' : ''} ${
                      hasCritical ? 'critical' : ''
                    }`}
                  >
                    <div className="msg-meta">
                      <div className="msg-sender-receiver">
                        <span
                          className="badge"
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          #{msg.id}
                        </span>
                        <span className="msg-agent">{msg.sender}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span
                          className="msg-agent"
                          style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}
                        >
                          {msg.receiver}
                        </span>
                      </div>
                      <span className="msg-time">{msg.timestamp || ''}</span>
                    </div>

                    <div className="msg-content">{msg.content}</div>

                    {hasDefect && (
                      <div className="msg-defect-badges">
                        {msgDefects.map(d => (
                          <span
                            key={d.id}
                            className={`badge badge-${d.severity} clickable-defect-badge`}
                            onClick={() => onOpenDrawer({ type: 'defect', defect: d })}
                            title={d.explanation}
                          >
                            {d.type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
