"""Integration tests for AgentLens FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


def test_healthcheck():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "mock_mode" in data


def test_demo_generate():
    response = client.post("/api/demo/generate", json={"clean": False})
    assert response.status_code == 201
    data = response.json()
    assert "trace_id" in data
    assert "defects" in data
    assert "health" in data
    assert "graph" in data
    assert data["health"]["health_score"] >= 0


def test_list_traces_and_report():
    # 1. Generate a demo trace first
    gen_res = client.post("/api/demo/generate", json={"clean": True})
    assert gen_res.status_code == 201
    trace_id = gen_res.json()["trace_id"]

    # 2. List traces
    list_res = client.get("/api/traces")
    assert list_res.status_code == 200
    traces = list_res.json()
    assert len(traces) >= 1
    assert any(t["id"] == trace_id for t in traces)

    # 3. Get trace report
    rep_res = client.get(f"/api/traces/{trace_id}/report")
    assert rep_res.status_code == 200
    report = rep_res.json()
    assert report["trace_id"] == trace_id
    assert len(report["messages"]) > 0


def test_paste_trace_csv():
    csv_payload = {
        "text": "id,sender,receiver,content,timestamp\n1,Planner,Coder,Do auth,10:00\n2,Coder,Planner,Auth done,10:05",
        "trace_name": "CSV Pasted Test",
        "task": "Auth Task",
    }
    res = client.post("/api/traces/paste", json=csv_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["trace_name"] == "CSV Pasted Test"
    assert len(data["messages"]) == 2


def test_evaluate_endpoint():
    # Generate trace with defects & ground truth
    gen_res = client.post("/api/demo/generate", json={"clean": False})
    assert gen_res.status_code == 201
    trace_id = gen_res.json()["trace_id"]

    eval_res = client.post("/api/evaluate", json={"trace_id": trace_id})
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert "overall_f1" in eval_data
    assert "overall_precision" in eval_data
    assert "overall_recall" in eval_data
    assert "confusion_matrix" in eval_data


def test_export_formats():
    gen_res = client.post("/api/demo/generate", json={"clean": True})
    trace_id = gen_res.json()["trace_id"]

    # JSON export
    res_json = client.get(f"/api/export/{trace_id}?format=json")
    assert res_json.status_code == 200
    assert res_json.headers["content-type"].startswith("application/json")

    # CSV export
    res_csv = client.get(f"/api/export/{trace_id}?format=csv")
    assert res_csv.status_code == 200
    assert res_csv.headers["content-type"].startswith("text/csv")

    # PDF-ready HTML export
    res_html = client.get(f"/api/export/{trace_id}?format=pdf-ready-html")
    assert res_html.status_code == 200
    assert "AgentLens" in res_html.text
