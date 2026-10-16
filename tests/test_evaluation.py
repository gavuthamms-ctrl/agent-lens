"""Unit tests for evaluation service."""
import pytest
from app.schemas import DefectSchema, DefectType, Severity
from app.services.evaluation import EvaluationService


def test_perfect_evaluation_match():
    gt = [
        DefectSchema(
            id="gt1",
            type=DefectType.CONTRADICTION,
            severity=Severity.HIGH,
            message_ids=[1, 2],
            agents=["Planner", "Coder"],
            explanation="Conflict",
            suggested_fix="Fix",
        )
    ]
    detected = [
        DefectSchema(
            id="det1",
            type=DefectType.CONTRADICTION,
            severity=Severity.HIGH,
            message_ids=[1, 2],
            agents=["Planner", "Coder"],
            explanation="Detected conflict",
            suggested_fix="Fix",
        )
    ]

    res = EvaluationService.evaluate(1, "Test", detected, gt)
    assert res.overall_precision == 1.0
    assert res.overall_recall == 1.0
    assert res.overall_f1 == 1.0
    assert len(res.false_positives) == 0
    assert len(res.false_negatives) == 0


def test_false_positives_and_negatives():
    gt = [
        DefectSchema(
            id="gt1",
            type=DefectType.INCOMPLETE_INFORMATION,
            severity=Severity.MEDIUM,
            message_ids=[3],
            agents=["Coder"],
            explanation="Missing info",
            suggested_fix="Fix",
        )
    ]
    detected = [
        DefectSchema(
            id="det1",
            type=DefectType.REDUNDANT_LOOP,
            severity=Severity.HIGH,
            message_ids=[1, 2],
            agents=["Planner"],
            explanation="Loop",
            suggested_fix="Fix",
        )
    ]

    res = EvaluationService.evaluate(1, "Test", detected, gt)
    assert res.overall_precision == 0.0
    assert res.overall_recall == 0.0
    assert res.overall_f1 == 0.0
    assert len(res.false_positives) == 1
    assert len(res.false_negatives) == 1
