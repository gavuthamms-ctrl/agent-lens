import React, { useEffect, useState } from 'react';
import { EvaluationResult, TraceSummaryItem } from '../types';
import { TraceStorage } from '../services/storage';
import { EvaluationChart } from './Charts';

interface EvaluationPageProps {
  traces: TraceSummaryItem[];
  selectedTraceId: number | null;
  theme: 'dark' | 'light';
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showLoading: (msg?: string) => void;
  hideLoading: () => void;
}

export const EvaluationPage: React.FC<EvaluationPageProps> = ({
  traces,
  selectedTraceId,
  theme,
  showToast,
  showLoading,
  hideLoading,
}) => {
  const [activeTraceId, setActiveTraceId] = useState<string>(
    selectedTraceId ? String(selectedTraceId) : ''
  );
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);

  const gtTraces = traces.filter(t => t.has_ground_truth);

  useEffect(() => {
    if (selectedTraceId) {
      setActiveTraceId(String(selectedTraceId));
      executeEvaluation(selectedTraceId);
    }
  }, [selectedTraceId]);

  const executeEvaluation = async (tid: number) => {
    showLoading('Evaluating detection accuracy against ground truth…');
    try {
      const result = await TraceStorage.evaluateTrace(tid);
      setEvalResult(result);
    } catch (err: any) {
      showToast(err.message || 'Evaluation failed', 'error');
      setEvalResult(null);
    } finally {
      hideLoading();
    }
  };

  const handleRunEvaluation = () => {
    const tid = parseInt(activeTraceId, 10);
    if (!tid) {
      showToast('Please select a trace with ground truth first.', 'error');
      return;
    }
    executeEvaluation(tid);
  };

  return (
    <div className="tab-page active">
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">📏 Detector Accuracy Evaluation</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Compare detected defects against ground-truth labels to compute Precision, Recall, and F1 Score.
          Demo traces and sample files include ground-truth labels.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Select Trace (with ground truth)
            </label>
            <select
              className="filter-select"
              style={{ width: '100%', padding: '9px 12px', fontSize: '13px' }}
              value={activeTraceId}
              onChange={e => setActiveTraceId(e.target.value)}
            >
              <option value="">— Select a trace with ground truth —</option>
              {gtTraces.map(t => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.trace_name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleRunEvaluation}>
            ▶ Run Evaluation
          </button>
        </div>
      </div>

      {evalResult && (
        <div id="eval-results-section">
          {/* Overall Metrics */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">Precision</div>
              <div className="stat-val" style={{ color: '#0ea5e9' }}>
                {(evalResult.overall_precision * 100).toFixed(1)}%
              </div>
              <div className="stat-sub">TP / (TP + FP)</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Recall</div>
              <div className="stat-val" style={{ color: '#eab308' }}>
                {(evalResult.overall_recall * 100).toFixed(1)}%
              </div>
              <div className="stat-sub">TP / (TP + FN)</div>
            </div>
            <div className="stat-card success">
              <div className="stat-label">F1 Score</div>
              <div className="stat-val" style={{ color: '#6366f1' }}>
                {(evalResult.overall_f1 * 100).toFixed(1)}%
              </div>
              <div className="stat-sub">Harmonic mean</div>
            </div>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card success">
              <div className="stat-label">True Positives</div>
              <div className="stat-val" style={{ color: '#10b981' }}>
                {evalResult.total_true_positives}
              </div>
            </div>
            <div className="stat-card critical">
              <div className="stat-label">False Positives</div>
              <div className="stat-val" style={{ color: '#ef4444' }}>
                {evalResult.total_false_positives}
              </div>
            </div>
            <div className="stat-card high">
              <div className="stat-label">False Negatives</div>
              <div className="stat-val" style={{ color: '#f97316' }}>
                {evalResult.total_false_negatives}
              </div>
            </div>
          </div>

          {/* Per-Type Chart */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <span className="card-title">📊 Per-Type Precision / Recall / F1</span>
            </div>
            <div className="chart-container" style={{ height: '280px' }}>
              <EvaluationChart perTypeMetrics={evalResult.per_type_metrics} theme={theme} />
            </div>
          </div>

          {/* Per-Type Table */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <span className="card-title">📋 Per Defect Type Breakdown</span>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Defect Type</th>
                    <th style={{ textAlign: 'center' }}>GT Count</th>
                    <th style={{ textAlign: 'center' }}>Detected</th>
                    <th style={{ textAlign: 'center', color: '#10b981' }}>TP</th>
                    <th style={{ textAlign: 'center', color: '#ef4444' }}>FP</th>
                    <th style={{ textAlign: 'center', color: '#f97316' }}>FN</th>
                    <th style={{ textAlign: 'center' }}>Precision</th>
                    <th style={{ textAlign: 'center' }}>Recall</th>
                    <th style={{ textAlign: 'center' }}>F1</th>
                  </tr>
                </thead>
                <tbody>
                  {evalResult.per_type_metrics
                    .filter(m => m.ground_truth_count > 0 || m.detected_count > 0)
                    .map(m => (
                      <tr key={m.defect_type}>
                        <td>
                          <span className="badge badge-medium" style={{ fontSize: '10px' }}>
                            {m.defect_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{m.ground_truth_count}</td>
                        <td style={{ textAlign: 'center' }}>{m.detected_count}</td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#10b981' }}>{m.true_positives}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#ef4444' }}>{m.false_positives}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#f97316' }}>{m.false_negatives}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>{(m.precision * 100).toFixed(0)}%</td>
                        <td style={{ textAlign: 'center' }}>{(m.recall * 100).toFixed(0)}%</td>
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 700,
                            color:
                              m.f1_score >= 0.7
                                ? '#10b981'
                                : m.f1_score >= 0.4
                                ? '#eab308'
                                : '#ef4444',
                          }}
                        >
                          {(m.f1_score * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FP / FN Lists */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--sev-high)' }}>
                  🟠 False Positives
                </span>
              </div>
              <div>
                {evalResult.false_positives.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    ✅ No false positives
                  </div>
                ) : (
                  evalResult.false_positives.map(d => (
                    <div
                      key={d.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--sev-high-border)',
                        padding: '10px',
                        borderRadius: '6px',
                        marginBottom: '6px',
                      }}
                    >
                      <span className={`badge badge-${d.severity}`}>{d.severity.toUpperCase()}</span>{' '}
                      <strong>{d.type.replace(/_/g, ' ')}</strong>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px',
                        }}
                      >
                        {d.explanation.slice(0, 100)}…
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--sev-critical)' }}>
                  🔴 False Negatives
                </span>
              </div>
              <div>
                {evalResult.false_negatives.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    ✅ No false negatives
                  </div>
                ) : (
                  evalResult.false_negatives.map(d => (
                    <div
                      key={d.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--sev-critical-border)',
                        padding: '10px',
                        borderRadius: '6px',
                        marginBottom: '6px',
                      }}
                    >
                      <span className={`badge badge-${d.severity}`}>{d.severity.toUpperCase()}</span>{' '}
                      <strong>{d.type.replace(/_/g, ' ')}</strong>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px',
                        }}
                      >
                        {d.explanation.slice(0, 100)}…
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
