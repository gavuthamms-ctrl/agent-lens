import React from 'react';
import { DefectSchema, GraphEdge, GraphNode } from '../types';

export type DrawerContent =
  | { type: 'defect'; defect: DefectSchema }
  | { type: 'node'; node: GraphNode; defects: DefectSchema[] }
  | { type: 'edge'; edge: GraphEdge; messages: Array<{ id: number; content: string; timestamp?: string }> }
  | null;

interface DefectDrawerProps {
  content: DrawerContent;
  onClose: () => void;
  onSelectDefect?: (defect: DefectSchema) => void;
}

export const DefectDrawer: React.FC<DefectDrawerProps> = ({
  content,
  onClose,
  onSelectDefect,
}) => {
  const isOpen = content !== null;

  return (
    <aside className={`defect-drawer ${isOpen ? 'open' : ''}`}>
      <div className="drawer-header">
        <span className="drawer-title">
          {content?.type === 'defect' && `⚠️ ${content.defect.type.replace(/_/g, ' ')}`}
          {content?.type === 'node' && `Agent: ${content.node.label}`}
          {content?.type === 'edge' && `Edge: ${content.edge.from_node} → ${content.edge.to_node}`}
          {!content && 'Details'}
        </span>
        <button className="drawer-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="drawer-body">
        {content?.type === 'defect' && (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span className={`badge badge-${content.defect.severity}`}>
                {content.defect.severity.toUpperCase()}
              </span>
              <span className={`badge badge-${content.defect.detected_by}`}>
                {content.defect.detected_by}
              </span>
              <span
                className="badge"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Confidence: {Math.round(content.defect.confidence * 100)}%
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                📋 Explanation
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.6 }}>{content.defect.explanation}</p>
            </div>

            {content.defect.evidence_quote && (
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  🔍 Evidence
                </div>
                <div className="quote-box">"{content.defect.evidence_quote}"</div>
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                🔧 Suggested Fix
              </div>
              <div className="fix-box">
                <strong>Recommendation:</strong>
                {content.defect.suggested_fix}
              </div>
            </div>

            {content.defect.message_ids && content.defect.message_ids.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Affected messages:{' '}
                {content.defect.message_ids.map(id => (
                  <strong key={id} style={{ marginRight: '6px' }}>
                    #{id}
                  </strong>
                ))}
              </div>
            )}

            {content.defect.agents && content.defect.agents.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Agents involved:{' '}
                {content.defect.agents.map(a => (
                  <span key={a} className="msg-agent" style={{ marginRight: '6px' }}>
                    {a}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {content?.type === 'node' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Role
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{content.node.role}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center', background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{content.node.sent_count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sent</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{content.node.received_count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Received</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: content.node.defect_count > 0 ? '#ef4444' : '#10b981',
                  }}
                >
                  {content.node.defect_count}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Defects</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Betweenness: <strong>{content.node.betweenness}</strong>
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Degree: <strong>{content.node.degree_centrality}</strong>
              </span>
              {content.node.is_bottleneck && <span className="badge badge-high">Bottleneck</span>}
              {content.node.is_isolated && <span className="badge badge-medium">Isolated</span>}
            </div>

            {content.defects.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  Associated Defects
                </div>
                {content.defects.map(d => (
                  <div
                    key={d.id}
                    style={{
                      background: 'var(--bg-surface)',
                      borderRadius: '6px',
                      padding: '10px',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                    }}
                    onClick={() => onSelectDefect && onSelectDefect(d)}
                  >
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                      <span className={`badge badge-${d.severity}`}>{d.severity.toUpperCase()}</span>
                      <span className={`badge badge-${d.detected_by}`}>{d.detected_by}</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{d.type.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {d.explanation.slice(0, 90)}…
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {content?.type === 'edge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600 }}>
              <span style={{ color: 'var(--accent-primary)' }}>{content.edge.from_node}</span>
              <span>→</span>
              <span style={{ color: 'var(--accent-secondary)' }}>{content.edge.to_node}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{content.edge.count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Messages</div>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: content.edge.defect_count > 0 ? '#ef4444' : '#10b981',
                  }}
                >
                  {content.edge.defect_count}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Defects</div>
              </div>
            </div>

            {content.edge.defect_types && content.edge.defect_types.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>DEFECT TYPES</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {content.edge.defect_types.map(t => (
                    <span key={t} className="badge badge-high">
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                MESSAGES ON THIS EDGE
              </div>
              {content.messages.slice(0, 5).map(m => (
                <div
                  key={m.id}
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Msg #{m.id} · {m.timestamp || ''}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    {m.content.slice(0, 100)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
