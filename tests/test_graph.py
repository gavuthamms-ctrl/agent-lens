"""Unit tests for NetworkX graph analysis."""
import pytest
from app.schemas import AgentSchema, MessageSchema, DefectSchema, DefectType, Severity
from app.services.graph import GraphService


def test_graph_analysis():
    agents = [
        AgentSchema(name="Planner", role="Lead"),
        AgentSchema(name="Coder", role="Dev"),
        AgentSchema(name="Tester", role="QA"),
        AgentSchema(name="IsolatedAgent", role="Idle"),
    ]
    messages = [
        MessageSchema(id=1, sender="Planner", receiver="Coder", content="Start task"),
        MessageSchema(id=2, sender="Coder", receiver="Tester", content="Test this"),
        MessageSchema(id=3, sender="Tester", receiver="Coder", content="Found bug"),
        MessageSchema(id=4, sender="Coder", receiver="Tester", content="Fixed bug"),
    ]
    defects = [
        DefectSchema(
            id="d1",
            type=DefectType.REDUNDANT_LOOP,
            severity=Severity.HIGH,
            message_ids=[2, 4],
            agents=["Coder", "Tester"],
            explanation="Loop",
            suggested_fix="Fix",
        )
    ]

    graph = GraphService.analyze(agents, messages, defects)

    # Check isolated agent detected
    assert "IsolatedAgent" in graph.isolated_agents

    # Check nodes count
    node_names = {n.id for n in graph.nodes}
    assert "Planner" in node_names
    assert "Coder" in node_names
    assert "Tester" in node_names
    assert "IsolatedAgent" in node_names

    # Check cycles (Coder <-> Tester cycle)
    assert len(graph.cycles_detected) >= 1

    # Check edge defects mapped
    defective_edges = [e for e in graph.edges if e.has_defects]
    assert len(defective_edges) >= 1
