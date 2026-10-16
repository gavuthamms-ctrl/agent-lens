# agent-lens

LLM-based detection, diagnostic classification, and evaluation of communication defects in Multi-Agent Systems (MAS).

AgentLens ingests execution traces from multi-agent systems, diagnoses breakdown points across a rigorous 10-class defect taxonomy, visualizes communication topologies, and generates quantitative evaluation metrics.

---

## 🚀 Features

- **10-Class Defect Taxonomy**: Detects communication issues such as:
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
- **Hybrid Diagnostic Engine**: Combines fast deterministic graph/rule-based heuristics with LLM-as-a-judge reasoning (Anthropic Claude).
- **Communication Topology Graph**: Interactive network graph showing agent interaction patterns, message density, defect-burdened pathways, and centrality metrics.
- **Trace Evaluation & Ground-Truth Benchmarking**: Calculate precision, recall, F1 scores, and taxonomy breakdown against benchmark traces.
- **REST API & Web UI**: Complete FastAPI backend with an interactive web dashboard and Swagger OpenAPI documentation.
- **Exporting**: Export diagnostic reports and evaluation metrics to JSON or CSV.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Uvicorn, Pydantic v2, SQLAlchemy
- **Data & Analysis**: NetworkX, Pandas, Scikit-learn
- **AI/LLM**: Anthropic API (`claude-3-5-sonnet-20241022`) with offline heuristic fallback
- **Frontend**: Responsive HTML5, CSS3, Vanilla JavaScript, Canvas-based visualization

---

## 📦 Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/gavuthamms-ctrl/agent-lens.git
cd agent-lens
```

### 2. Set up virtual environment
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` if using Anthropic API:
```env
MOCK_MODE=false
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LLM_MODEL=claude-3-5-sonnet-20241022
HOST=127.0.0.1
PORT=8000
```
> **Note**: When `MOCK_MODE=true` or when no API key is provided, AgentLens automatically runs in offline heuristic mode.

---

## 🏃 Running the Application

Start the development server:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Web Dashboard**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **API Docs (ReDoc)**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## 🧪 Testing

Run the test suite with pytest:
```bash
pytest
```

---

## 📁 Project Structure

```
agent-lens/
├── app/
│   ├── api/             # FastAPI endpoint routers (traces, demo, evaluate, export)
│   ├── services/        # Pipeline, rule engine, graph analyzer, LLM judge, scoring
│   ├── static/          # Web dashboard (HTML, CSS, JS)
│   ├── db.py            # SQLite database initialization and sessions
│   ├── main.py          # FastAPI application entry point
│   ├── models.py        # SQLAlchemy ORM models
│   └── schemas.py       # Pydantic schemas and taxonomy definitions
├── samples/             # Sample traces and ground-truth benchmark datasets
├── tests/               # Test suite covering APIs, parsing, rules, and scoring
├── requirements.txt     # Python project dependencies
├── .env.example         # Example environment configuration
└── README.md
```

---

## 📄 License

MIT
