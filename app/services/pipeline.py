"""Detection pipeline orchestrating Rule-based checks, LLM Judge, Graph analysis, and Health scoring."""
import json
import logging
from typing import List, Dict, Tuple, Any

from app.schemas import (
    DefectSchema,
    DefectType,
    Severity,
    TraceInputSchema,
    TraceReport,
    HealthScoreBreakdown,
    GraphData,
)
from app.services.rules import RuleBasedDetector
from app.services.llm_judge import LLMJudge
from app.services.graph import GraphService
from app.services.scoring import HealthScoringService

logger = logging.getLogger("agentlens.pipeline")

SEVERITY_ORDER = {
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}


class DetectionPipeline:
    """End-to-end multi-agent communication defect analysis pipeline."""

    def __init__(self):
        self.rule_detector = RuleBasedDetector()
        self.llm_judge = LLMJudge()

    async def analyze(
        self,
        trace_id: int,
        trace_input: TraceInputSchema,
        created_at: str = "",
    ) -> TraceReport:
        agents = trace_input.agents
        messages = trace_input.messages
        task = trace_input.task
        trace_name = trace_input.trace_name

        # 1. Run rule-based detection
        rule_defects = self.rule_detector.detect(messages, agents)

        # 2. Run LLM judge
        llm_defects = await self.llm_judge.judge_trace(task, agents, messages)

        # 3. Merge and deduplicate defects
        merged_defects = self._merge_defects(rule_defects, llm_defects)

        # 4. Graph analysis with NetworkX
        graph_data: GraphData = GraphService.analyze(agents, messages, merged_defects)

        # 5. Health score calculation
        health: HealthScoreBreakdown = HealthScoringService.calculate(
            message_count=len(messages),
            defects=merged_defects,
            graph_data=graph_data,
        )

        # 6. Aggregations & breakdowns
        counts_by_type: Dict[str, int] = {t.value: 0 for t in DefectType}
        for d in merged_defects:
            t_val = d.type.value
            counts_by_type[t_val] = counts_by_type.get(t_val, 0) + 1

        counts_by_severity: Dict[str, int] = {s.value: 0 for s in Severity}
        for d in merged_defects:
            s_val = d.severity.value
            counts_by_severity[s_val] = counts_by_severity.get(s_val, 0) + 1

        counts_by_agent: Dict[str, int] = {a.name: 0 for a in agents}
        for d in merged_defects:
            for ag in d.agents:
                counts_by_agent[ag] = counts_by_agent.get(ag, 0) + 1

        # Sort top issues by severity weight desc, then confidence desc
        top_issues = sorted(
            merged_defects,
            key=lambda x: (SEVERITY_ORDER.get(x.severity, 1), x.confidence),
            reverse=True,
        )[:6]

        has_ground_truth = bool(trace_input.ground_truth and len(trace_input.ground_truth) > 0)

        return TraceReport(
            trace_id=trace_id,
            trace_name=trace_name,
            task=task,
            created_at=created_at,
            agents=agents,
            messages=messages,
            defects=merged_defects,
            health=health,
            graph=graph_data,
            defect_counts_by_type=counts_by_type,
            defect_counts_by_severity=counts_by_severity,
            defect_counts_by_agent=counts_by_agent,
            top_issues=top_issues,
            has_ground_truth=has_ground_truth,
        )

    def _merge_defects(
        self,
        rule_defects: List[DefectSchema],
        llm_defects: List[DefectSchema],
    ) -> List[DefectSchema]:
        """Merge rule and LLM findings into a unified, non-redundant defect inventory."""
        merged: List[DefectSchema] = []
        matched_llm_ids = set()

        for r in rule_defects:
            matched_llm = None
            for l in llm_defects:
                if l.id in matched_llm_ids:
                    continue

                # Match if same defect type and overlapping message ids
                same_type = (r.type == l.type)
                overlap = bool(set(r.message_ids) & set(l.message_ids)) if (r.message_ids and l.message_ids) else False

                if same_type and overlap:
                    matched_llm = l
                    break

            if matched_llm:
                matched_llm_ids.add(matched_llm.id)
                # Determine higher severity
                sev = (
                    r.severity
                    if SEVERITY_ORDER.get(r.severity, 1) >= SEVERITY_ORDER.get(matched_llm.severity, 1)
                    else matched_llm.severity
                )
                # Combine explanations
                explanation = f"{matched_llm.explanation} [Rule check confirmed structural pattern]."
                combined_agents = list(dict.fromkeys(r.agents + matched_llm.agents))
                combined_msgs = sorted(list(set(r.message_ids + matched_llm.message_ids)))

                merged.append(
                    DefectSchema(
                        id=f"hybrid-{r.type.value.lower()}-{r.id[:8]}",
                        type=r.type,
                        severity=sev,
                        message_ids=combined_msgs,
                        agents=combined_agents,
                        explanation=explanation,
                        evidence_quote=matched_llm.evidence_quote or r.evidence_quote,
                        suggested_fix=matched_llm.suggested_fix or r.suggested_fix,
                        confidence=min(1.0, max(r.confidence, matched_llm.confidence) + 0.05),
                        detected_by="hybrid",
                    )
                )
            else:
                merged.append(r)

        # Append unmatched LLM defects
        for l in llm_defects:
            if l.id not in matched_llm_ids:
                merged.append(l)

        return merged
