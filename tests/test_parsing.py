"""Unit tests for JSON and CSV trace parsing."""
import pytest
from app.services.parser import TraceParser, TraceParseError


def test_parse_valid_json():
    json_data = """{
        "trace_name": "Test Trace",
        "task": "Test Task",
        "agents": [{"name": "A1", "role": "Worker"}],
        "messages": [
            {"id": 1, "sender": "A1", "receiver": "A2", "content": "Hello", "timestamp": "2026-10-05T10:00:00Z"}
        ]
    }"""
    parsed = TraceParser.parse_auto(json_data)
    assert parsed.trace_name == "Test Trace"
    assert len(parsed.messages) == 1
    assert parsed.messages[0].sender == "A1"


def test_parse_valid_csv():
    csv_data = """id,sender,receiver,content,timestamp
1,Planner,Coder,Implement auth,2026-10-05T10:00:00Z
2,Coder,Planner,Auth implemented,2026-10-05T10:05:00Z"""
    parsed = TraceParser.parse_auto(csv_data)
    assert len(parsed.messages) == 2
    assert parsed.messages[0].sender == "Planner"
    assert parsed.messages[1].receiver == "Planner"
    assert len(parsed.agents) == 2


def test_parse_invalid_json_raises_error():
    with pytest.raises(TraceParseError):
        TraceParser.parse_auto("{invalid_json: true")


def test_parse_missing_required_csv_columns():
    with pytest.raises(TraceParseError):
        TraceParser.parse_auto("foo,bar,baz\n1,2,3")
