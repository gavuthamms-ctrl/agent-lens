/**
 * AgentLens API Client
 */
const API = {
  baseUrl: '/api',

  async getHealth() {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error('Failed to fetch system health status.');
    return res.json();
  },

  async listTraces() {
    const res = await fetch(`${this.baseUrl}/traces`);
    if (!res.ok) throw new Error('Failed to fetch traces.');
    return res.json();
  },

  async getTraceReport(traceId) {
    const res = await fetch(`${this.baseUrl}/traces/${traceId}/report`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch trace #${traceId} report.`);
    }
    return res.json();
  },

  async uploadTraceFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${this.baseUrl}/traces/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload trace file.');
    }
    return res.json();
  },

  async pasteTrace(text, traceName = null, task = null) {
    const res = await fetch(`${this.baseUrl}/traces/paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, trace_name: traceName, task }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to parse and store pasted trace.');
    }
    return res.json();
  },

  async deleteTrace(traceId) {
    const res = await fetch(`${this.baseUrl}/traces/${traceId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete trace #${traceId}.`);
    return res.json();
  },

  async reanalyzeTrace(traceId) {
    const res = await fetch(`${this.baseUrl}/traces/${traceId}/analyze`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to re-analyze trace #${traceId}.`);
    }
    return res.json();
  },

  async generateDemoTrace(params = {}) {
    const res = await fetch(`${this.baseUrl}/demo/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate demo trace.');
    }
    return res.json();
  },

  async evaluateTrace(traceId) {
    const res = await fetch(`${this.baseUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trace_id: traceId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to evaluate trace accuracy.');
    }
    return res.json();
  },

  getExportUrl(traceId, format) {
    return `${this.baseUrl}/export/${traceId}?format=${format}`;
  }
};

window.API = API;
