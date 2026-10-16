import React from 'react';
import { DEFECT_DESCRIPTIONS, DefectType } from '../types';

const TAXONOMY_ITEMS: Array<{ type: DefectType; severity: string }> = [
  { type: DefectType.AMBIGUOUS_INSTRUCTION, severity: 'high' },
  { type: DefectType.INCOMPLETE_INFORMATION, severity: 'medium' },
  { type: DefectType.CONTRADICTION, severity: 'critical' },
  { type: DefectType.INFORMATION_LOSS, severity: 'high' },
  { type: DefectType.MISINTERPRETATION, severity: 'high' },
  { type: DefectType.REDUNDANT_LOOP, severity: 'high' },
  { type: DefectType.IGNORED_REQUEST, severity: 'high' },
  { type: DefectType.ROLE_VIOLATION, severity: 'high' },
  { type: DefectType.HALLUCINATED_CLAIM, severity: 'high' },
  { type: DefectType.PROTOCOL_VIOLATION, severity: 'high' },
];

export const AboutPage: React.FC = () => {
  return (
    <div className="tab-page active">
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">🔍 About AgentLens</span>
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '760px' }}>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>AgentLens</strong> is an LLM-powered
            multi-agent communication defect detection and analysis platform. It helps AI engineers
            identify systematic breakdowns in agent collaboration, hallucinations, contradictions, and protocol failures.
          </p>
          <br />
          <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', marginBottom: '10px' }}>
            🏗️ Methodology
          </h3>
          <p>Detection uses a two-stage hybrid pipeline:</p>
          <ol style={{ marginLeft: '20px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>
              <strong>Rule-Based Detector</strong> — Cosine similarity for loop detection, regex-based unanswered request tracking, and structural protocol anomaly checks.
            </li>
            <li>
              <strong>LLM Judge</strong> — Semantic analysis evaluating ambiguity, role boundary violations, tech-stack contradictions, and hallucinations.
            </li>
            <li>
              <strong>Merge & Deduplicate</strong> — Matched findings become hybrid defects with boosted confidence; unique findings from each source are preserved.
            </li>
          </ol>
          <br />
          <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', marginBottom: '10px' }}>
            🧬 Defect Taxonomy
          </h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '12px',
            marginTop: '12px',
          }}
        >
          {TAXONOMY_ITEMS.map(({ type, severity }) => (
            <div
              key={type}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {type.replace(/_/g, ' ')}
                </span>
                <span className={`badge badge-${severity}`}>{severity.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {DEFECT_DESCRIPTIONS[type]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">⚡ Health Score Formula</span>
        </div>
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
          }}
        >
          <span style={{ color: '#10b981' }}>Base Score</span>: 100
          <br />
          <span style={{ color: '#f97316' }}>Defect Penalty</span>: raw = Σ weight(severity) × defect_count
          <br />
          &nbsp;&nbsp;weight: critical=18 | high=10 | medium=5 | low=2
          <br />
          &nbsp;&nbsp;defect_density = defect_count / message_count
          <br />
          &nbsp;&nbsp;volume_factor = 0.6 + 0.4 × min(1, density)
          <br />
          &nbsp;&nbsp;scaled_penalty = min(85, raw × volume_factor)
          <br />
          <span style={{ color: '#6366f1' }}>Network Penalty</span>: 5 per isolated agent (max 10) + 5 if cycles ≥ 2
          <br />
          <span style={{ color: '#0ea5e9' }}>Final Score</span>: max(0, min(100, round(100 − scaled_penalty − network_penalty)))
          <br />
          <span style={{ color: '#94a3b8' }}>Grade</span>: A≥90 | B≥80 | C≥70 | D≥60 | F&lt;60
        </div>
      </div>
    </div>
  );
};
