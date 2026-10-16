# AgentLens — Multi-Agent Communication Defect Analyzer

AgentLens is a diagnostic classification, network visualization, and benchmark evaluation platform for detecting communication defects in Multi-Agent Systems (MAS).

Rewritten as a high-performance modern React SPA application with interactive graph visualization, deterministic rule checks, and offline heuristic judging.

---

## 🚀 Features

- **10-Class Defect Taxonomy**: Detects communication issues including:
  - `AMBIGUOUS_INSTRUCTION`
  - `INCOMPLETE_INFORMATION`
  - `CONTRADICTION`
  - `INFORMATION_LOSS`
  - `MISINTERPRETATION`
  - `REDUNDANT_LOOP`
  - `IGNORED_REQUEST`
  - `ROLE_VIOLATION`
  - `HALLUCINATED_CLAIM`
  - `PROTOCOL_VIOLATION`
- **Hybrid Diagnostic Engine**: Combines deterministic structural/linguistic rule-based checks with heuristic semantic analysis and deduplication.
- **Interactive Topology Network**: Interactive directed graph with node centrality sizing, betweenness metrics, cycle detection, bottleneck identification, and edge inspection.
- **Trace Evaluation & Ground-Truth Benchmarking**: Calculate precision, recall, and F1 scores with confusion matrices and per-defect breakdowns.
- **Sample Presets & Generator**: Instantly generate realistic multi-agent traces with defect injections or test pre-loaded sample traces.
- **Multi-Format Export**: Export diagnostic reports and defect logs to JSON, CSV, or executive PDF-ready printable HTML.

---

## 🛠️ Tech Stack

- **Framework**: React 18, TypeScript, Vite
- **Graph Visualization**: Vis-Network (`vis-network`, `vis-data`)
- **Analytics & Charts**: Chart.js (`chart.js`, `react-chartjs-2`)
- **Icons**: Lucide React
- **Styling**: Modern dark/light glassmorphic theme with CSS custom properties

---

## 🏃 Running the Application

```bash
npm install
npm run dev
```

App runs on `http://localhost:3000`.

To build for production:
```bash
npm run build
```

---

## 📄 License

MIT
