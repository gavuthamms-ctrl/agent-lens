import React, { useRef, useState } from 'react';
import { TraceParser } from '../services/parser';
import { TraceStorage } from '../services/storage';
import { TraceReport } from '../types';

interface UploadPageProps {
  onSuccess: (report: TraceReport) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showLoading: (msg?: string) => void;
  hideLoading: () => void;
  onGenerateDemo: (clean?: boolean) => void;
}

const EXAMPLE_FORMAT = `{"trace_name":"My Trace","task":"Build auth","agents":[{"name":"Planner","role":"Lead"}],"messages":[{"id":1,"sender":"Planner","receiver":"Coder","content":"Do the auth","timestamp":"2026-10-05T10:00:00Z"}]}`;

export const UploadPage: React.FC<UploadPageProps> = ({
  onSuccess,
  showToast,
  showLoading,
  hideLoading,
  onGenerateDemo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [pasteTask, setPasteTask] = useState('');
  const [showExample, setShowExample] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large (max 10 MB).', 'error');
      return;
    }

    showLoading(`Uploading & analyzing "${file.name}"…`);
    try {
      const text = await file.text();
      const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const input = TraceParser.parseAuto(text, defaultName);
      const report = await TraceStorage.createTrace(input);
      showToast(`Trace "${report.trace_name}" analyzed successfully!`, 'success');
      onSuccess(report);
    } catch (err: any) {
      showToast(err.message || 'Failed to parse file', 'error');
    } finally {
      hideLoading();
    }
  };

  const handlePasteSubmit = async () => {
    const text = pasteText.trim();
    if (!text) {
      showToast('Please paste a trace before submitting.', 'error');
      return;
    }

    showLoading('Parsing & analyzing pasted trace…');
    try {
      const input = TraceParser.parseAuto(
        text,
        pasteName.trim() || undefined,
        pasteTask.trim() || undefined
      );
      const report = await TraceStorage.createTrace(input);
      showToast('Trace analyzed successfully!', 'success');
      onSuccess(report);
    } catch (err: any) {
      showToast(err.message || 'Failed to parse trace', 'error');
    } finally {
      hideLoading();
    }
  };

  const loadPreset = async (presetType: 'clean' | 'loops' | 'contradictions') => {
    showLoading('Loading preset trace…');
    try {
      let report: TraceReport;
      if (presetType === 'clean') {
        report = await TraceStorage.generateDemo({ clean: true });
      } else if (presetType === 'loops') {
        const input = TraceParser.parseJson(
          JSON.stringify({
            trace_name: 'Payment Gateway Integration with Feedback Loops',
            task: 'Integrate Stripe webhook event processing and idempotency keys',
            agents: [
              { name: 'Planner', role: 'Lead Architect' },
              { name: 'Coder', role: 'Backend Engineer' },
              { name: 'Reviewer', role: 'Security Auditor' },
              { name: 'Tester', role: 'QA Engineer' },
            ],
            messages: [
              {
                id: 1,
                sender: 'Planner',
                receiver: 'Coder',
                content: 'Please implement Stripe webhook receiver for payment_intent.succeeded with HMAC SHA256.',
              },
              {
                id: 2,
                sender: 'Coder',
                receiver: 'Reviewer',
                content: 'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
              },
              {
                id: 3,
                sender: 'Reviewer',
                receiver: 'Coder',
                content: 'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
              },
              {
                id: 4,
                sender: 'Coder',
                receiver: 'Reviewer',
                content: 'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
              },
              {
                id: 5,
                sender: 'Reviewer',
                receiver: 'Coder',
                content: 'Please provide the complete idempotency key replay test suite and coverage reports immediately?',
              },
            ],
            ground_truth: [
              {
                id: 'gt-loop-2-3-4',
                type: 'REDUNDANT_LOOP',
                severity: 'high',
                message_ids: [2, 3, 4],
                agents: ['Coder', 'Reviewer'],
                explanation: 'Ping-pong loop repeating identical queries 3 times without resolution.',
                suggested_fix: 'Add loop guard and state machine synchronization.',
                confidence: 1.0,
              },
              {
                id: 'gt-ignored-5',
                type: 'IGNORED_REQUEST',
                severity: 'high',
                message_ids: [5],
                agents: ['Reviewer', 'Coder'],
                explanation: 'Reviewer requested test suite but Coder never responded.',
                suggested_fix: 'Require agents to acknowledge pending requests.',
                confidence: 1.0,
              },
            ],
          })
        );
        report = await TraceStorage.createTrace(input);
      } else {
        report = await TraceStorage.generateDemo({ clean: false });
      }

      showToast(`Preset trace "${report.trace_name}" loaded!`, 'success');
      onSuccess(report);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  return (
    <div className="tab-page active">
      <div className="upload-grid">
        {/* File Dropzone */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📁 Upload File</span>
          </div>
          <div
            className={`dropzone ${dragOver ? 'dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <div className="dropzone-icon">📂</div>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
              Drop file here or click to browse
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Accepts: JSON trace, CSV (id, sender, receiver, content, timestamp)
            </div>
            <div style={{ marginTop: '14px' }}>
              <span
                className="badge"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Max 10 MB
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.csv,.txt"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>

        {/* Paste Box */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Paste Raw Trace</span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowExample(!showExample)}
            >
              {showExample ? 'Hide Format' : 'Show Format'}
            </button>
          </div>

          {showExample && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                overflowX: 'auto',
              }}
            >
              {EXAMPLE_FORMAT}
            </div>
          )}

          <textarea
            className="paste-area"
            placeholder="Paste your JSON or CSV trace here..."
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <input
              type="text"
              className="filter-input"
              placeholder="Optional: Custom trace name"
              value={pasteName}
              onChange={e => setPasteName(e.target.value)}
            />
            <input
              type="text"
              className="filter-input"
              placeholder="Optional: Task description"
              value={pasteTask}
              onChange={e => setPasteTask(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handlePasteSubmit}>
              🔍 Analyze Trace
            </button>
          </div>
        </div>
      </div>

      {/* Quick Demo & Sample Presets */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🎭 Quick Demo & Sample Presets</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Instantly simulate complex multi-agent defects or test with pre-built ground-truth traces.
        </p>

        <div className="presets-grid">
          <div className="preset-card" onClick={() => onGenerateDemo(false)}>
            <div>
              <div className="preset-title">🚨 Simulate MAS Failure</div>
              <div className="preset-desc">
                Generates a simulated trace injecting all 10 defect types with full ground-truth labels.
              </div>
            </div>
            <button className="btn btn-primary btn-sm">Generate → Analyze</button>
          </div>

          <div className="preset-card" onClick={() => loadPreset('loops')}>
            <div>
              <div className="preset-title">🔄 Loops & Ignored Requests</div>
              <div className="preset-desc">
                Payment integration trace with redundant ping-pong loops and unanswered questions.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm">Load Sample</button>
          </div>

          <div className="preset-card" onClick={() => loadPreset('contradictions')}>
            <div>
              <div className="preset-title">💥 Contradictions & Role Violations</div>
              <div className="preset-desc">
                SaaS deployment trace with tech stack contradictions, information loss, and hallucinations.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm">Load Sample</button>
          </div>

          <div className="preset-card" onClick={() => loadPreset('clean')}>
            <div>
              <div className="preset-title">🏆 Perfect Pipeline</div>
              <div className="preset-desc">
                Distributed Kafka pipeline trace — ideal agent interactions with zero defects.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm">Load Sample</button>
          </div>
        </div>
      </div>
    </div>
  );
};
