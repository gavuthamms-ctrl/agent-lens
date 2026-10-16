"""Unit tests for the rule-based detector."""
import pytest
from app.schemas import MessageSchema, AgentSchema, DefectType, Severity
from app.services.rules import RuleBasedDetector


@pytest.fixture
def detector():
    return RuleBasedDetector(unanswered_window_limit=3, similarity_threshold=0.85)


@pytest.fixture
def agents():
    return [
        AgentSchema(name="Planner", role="Task decomposition"),
        AgentSchema(name="Coder", role="Implementation"),
        AgentSchema(name="Tester", role="QA testing"),
    ]


def test_empty_message_detection(detector, agents):
    messages = [
        MessageSchema(id=1, sender="Planner", receiver="Coder", content="   ", timestamp=""),
    ]
    defects = detector.detect(messages, agents)
    assert any(d.type == DefectType.PROTOCOL_VIOLATION and "empty" in d.explanation.lower() for d in defects)


def test_unknown_agent_detection(detector, agents):
    messages = [
        MessageSchema(id=1, sender="Planner", receiver="HackerBot", content="Deploy the app", timestamp=""),
    ]
    defects = detector.detect(messages, agents)
    assert any(d.type == DefectType.PROTOCOL_VIOLATION and "HackerBot" in d.explanation for d in defects)


def test_short_length_anomaly(detector, agents):
    messages = [
        MessageSchema(id=1, sender="Planner", receiver="Coder", content="ok", timestamp=""),
    ]
    defects = detector.detect(messages, agents)
    assert any(d.type == DefectType.PROTOCOL_VIOLATION and "short" in d.explanation.lower() for d in defects)


def test_self_talk_detection(detector, agents):
    messages = [
        MessageSchema(id=1, sender="Coder", receiver="Coder", content="Thinking to myself about code...", timestamp=""),
    ]
    defects = detector.detect(messages, agents)
    assert any(d.type == DefectType.PROTOCOL_VIOLATION and "itself" in d.explanation.lower() for d in defects)


def test_redundant_loop_detection(detector, agents):
    messages = [
        MessageSchema(id=1, sender="Planner", receiver="Coder", content="Please build the user login endpoint now.", timestamp=""),
        MessageSchema(id=2, sender="Planner", receiver="Coder", content="Please build the user login endpoint now.", timestamp=""),
    ]
    defects = detector.detect(messages, agents)
    assert any(d.type == DefectType.REDUNDANT_LOOP for d in defects)


def test_unanswered_request_detection(detector, agents):
    messages = [
        MessageSchema(id=1, sender="Planner", receiver="Coder", content="Could you please send the database schema?", timestamp=""),
        MessageSchema(id=2, sender="Planner", receiver="Tester", content="Are tests running?", timestamp=""),
        MessageSchema(id=3, sender="Tester", receiver="Planner", content="Yes, running tests now.", timestamp=""),
    ]
    # Coder never replied to message 1
    defects = detector.detect(messages, agents)
    assert any(d.type == DefectType.IGNORED_REQUEST and 1 in d.message_ids for d in defects)
