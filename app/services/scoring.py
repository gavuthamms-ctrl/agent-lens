"""Communication Health Score calculation service for AgentLens."""
from typing import List, Dict
from app.schemas import (
    DefectSchema,
    Severity,
    HealthScoreBreakdown,
    GraphData,
)

# Severity weights used in penalty deduction
SEVERITY_WEIGHTS: Dict[str, float] = {
    Severity.CRITICAL.value: 18.0,
    Severity.HIGH.value: 10.0,
    Severity.MEDIUM.value: 5.0,
    Severity.LOW.value: 2.0,
}


class HealthScoringService:
    """Calculates a normalized 0-100 communication health score for a multi-agent trace.

    SCORING FORMULA SPECIFICATION:
    ----------------------------------------------------------------------------
    Base Score: 100.0 points
    1. Defect Penalty:
       raw_penalty = sum(SEVERITY_WEIGHTS[defect.severity] for defect in defects)
       defect_density = defect_count / max(message_count, 1)
       volume_factor = 0.6 + 0.4 * min(1.0, defect_density)
       scaled_penalty = min(85.0, raw_penalty * volume_factor)

    2. Network Structural Penalty:
       isolated_penalty = 5.0 points per isolated agent (up to 10.0)
       cycle_penalty = 5.0 points if uncontrolled cyclic ping-pongs exist (up to 5.0)

    3. Final Score:
       Health Score = max(0, min(100, round(100.0 - scaled_penalty - network_penalties)))

    Grade Scale:
       A: 90 - 100 (Optimal MAS Communication)
       B: 80 - 89  (Minor communication friction)
       C: 70 - 79  (Moderate defects, review advised)
       D: 60 - 69  (Severe degradation in agent alignment)
       F: 0  - 59  (Critical communication breakdown)
    ----------------------------------------------------------------------------
    """

    @classmethod
    def calculate(
        cls,
        message_count: int,
        defects: List[DefectSchema],
        graph_data: GraphData = None,
    ) -> HealthScoreBreakdown:
        severity_counts = {
            Severity.CRITICAL.value: 0,
            Severity.HIGH.value: 0,
            Severity.MEDIUM.value: 0,
            Severity.LOW.value: 0,
        }

        raw_penalty = 0.0
        for d in defects:
            s_val = d.severity.value
            severity_counts[s_val] = severity_counts.get(s_val, 0) + 1
            raw_penalty += SEVERITY_WEIGHTS.get(s_val, 5.0)

        eff_msg_count = max(message_count, 1)
        defect_density = len(defects) / eff_msg_count
        volume_factor = 0.6 + (0.4 * min(1.0, defect_density))
        scaled_defect_penalty = min(85.0, raw_penalty * volume_factor)

        # Structural network penalties
        isolated_penalty = 0.0
        cycle_penalty = 0.0
        if graph_data:
            isolated_count = len(graph_data.isolated_agents)
            isolated_penalty = min(10.0, isolated_count * 5.0)
            if len(graph_data.cycles_detected) >= 2:
                cycle_penalty = 5.0

        network_penalties = isolated_penalty + cycle_penalty
        final_score = int(max(0, min(100, round(100.0 - scaled_defect_penalty - network_penalties))))

        # Determine grade
        if final_score >= 90:
            grade = "A"
        elif final_score >= 80:
            grade = "B"
        elif final_score >= 70:
            grade = "C"
        elif final_score >= 60:
            grade = "D"
        else:
            grade = "F"

        formula_summary = (
            f"100 (base) - {scaled_defect_penalty:.1f} (defects: {len(defects)} weighted by severity & density) "
            f"- {network_penalties:.1f} (structural network penalties) = {final_score}/100 [Grade {grade}]"
        )

        return HealthScoreBreakdown(
            health_score=final_score,
            grade=grade,
            base_score=100,
            defect_penalties=round(scaled_defect_penalty, 1),
            volume_factor=round(volume_factor, 2),
            network_penalties=round(network_penalties, 1),
            defects_by_severity=severity_counts,
            defect_density=round(defect_density, 3),
            formula_summary=formula_summary,
        )
