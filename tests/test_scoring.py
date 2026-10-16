"""Unit tests for health scoring formula."""
import pytest
from app.schemas import DefectSchema, DefectType, Severity
from app.services.scoring import HealthScoringService


def test_perfect_score_zero_defects():
    score = HealthScoringService.calculate(message_count=10, defects=[])
    assert score.health_score == 100
    assert score.grade == "A"


def test_critical_defect_reduces_score():
    critical_defects = [
        DefectSchema(
            id="c1",
            type=DefectType.CONTRADICTION,
            severity=Severity.CRITICAL,
            message_ids=[1, 2],
            agents=["Planner", "Coder"],
            explanation="Critical conflict",
            suggested_fix="Fix",
        )
    ]
    score = HealthScoringService.calculate(message_count=5, defects=critical_defects)
    assert score.health_score < 100
    assert score.defects_by_severity[Severity.CRITICAL.value] == 1


def test_multiple_severe_defects_yield_low_grade():
    heavy_defects = [
        DefectSchema(
            id=f"c{i}",
            type=DefectType.CONTRADICTION,
            severity=Severity.CRITICAL,
            message_ids=[i],
            agents=["Planner", "Coder"],
            explanation="Critical conflict",
            suggested_fix="Fix",
        )
        for i in range(1, 6)
    ]
    score = HealthScoringService.calculate(message_count=6, defects=heavy_defects)
    assert score.health_score < 60
    assert score.grade in ("D", "F")
