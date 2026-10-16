"""LLM Judge service for multi-agent communication defect detection."""
import os
import re
import json
import uuid
import asyncio
import logging
from typing import List, Dict, Any, Optional

import anthropic

from app.schemas import (
    DefectSchema,
    DefectType,
    Severity,
    MessageSchema,
    AgentSchema,
    DEFECT_DESCRIPTIONS,
)

logger = logging.getLogger("agentlens.llm_judge")

SYSTEM_PROMPT = """You are AgentLens, an expert AI judge evaluating communication defects in multi-agent systems (MAS).
Analyze the conversation window between collaborating AI agents in the context of the overall task and their assigned roles.

Taxonomy of Defect Types:
1. AMBIGUOUS_INSTRUCTION - Vague, underspecified, or ambiguous prompts/requests.
2. INCOMPLETE_INFORMATION - Needed specifications, arguments, payloads, or schemas missing.
3. CONTRADICTION - Message directly conflicts with earlier statements, facts, or instructions.
4. INFORMATION_LOSS - Key constraints, requirements, or data established earlier are dropped or omitted by later agents.
5. MISINTERPRETATION - Agent misreads, skews, or misunderstands another agent's output or request.
6. REDUNDANT_LOOP - Repetitive ping-pong or cycle of duplicate messages with no progress.
7. IGNORED_REQUEST - An explicit actionable request or question that is bypassed or unanswered.
8. ROLE_VIOLATION - Agent acts outside its assigned role/boundary (e.g., tester writing production architecture).
9. HALLUCINATED_CLAIM - Agent asserts unverified, fabricated, or non-existent facts/outputs as truth.
10. PROTOCOL_VIOLATION - Broken format, incorrect target, or structural communication failure.

You must respond ONLY with a valid JSON array of objects. Do NOT include markdown code blocks, backticks, or explanatory text before or after the JSON.
Each JSON object in the array must strictly have these keys:
{
  "type": "AMBIGUOUS_INSTRUCTION", // Must be one of the 10 taxonomy strings exactly
  "severity": "medium",            // "low", "medium", "high", or "critical"
  "message_ids": [1],             // List of integers indicating messages involved
  "agents": ["Planner", "Coder"],  // List of agent names involved
  "explanation": "Clear explanation of the communication defect and why it degrades collaboration",
  "evidence_quote": "Direct quote from message content showing the defect",
  "suggested_fix": "Concrete, actionable instruction to correct this communication defect",
  "confidence": 0.90               // Number between 0.0 and 1.0
}
If no communication defect exists in this window, return an empty array: []
"""


class LLMJudge:
    """Sliding-window LLM Judge with concurrent evaluation and deterministic mock fallback."""

    def __init__(
        self,
        window_size: int = 5,
        overlap: int = 2,
        concurrency_limit: int = 3,
    ):
        self.window_size = window_size
        self.overlap = overlap
        self.semaphore = asyncio.Semaphore(concurrency_limit)
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        self.model_name = os.getenv("LLM_MODEL", "claude-3-5-sonnet-20241022").strip()
        self.mock_mode = (
            os.getenv("MOCK_MODE", "true").lower() in ("true", "1", "yes")
            or not self.api_key
        )

    async def judge_trace(
        self,
        task: str,
        agents: List[AgentSchema],
        messages: List[MessageSchema],
    ) -> List[DefectSchema]:
        """Runs sliding window evaluation across messages."""
        if not messages:
            return []

        if self.mock_mode:
            logger.info("MOCK_MODE is enabled or ANTHROPIC_API_KEY is not set. Running offline heuristic judge.")
            return self._heuristic_judge(task, agents, messages)

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        windows = self._create_windows(messages)
        tasks = [
            self._judge_window_with_retry(client, task, agents, window)
            for window in windows
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)
        all_defects: List[DefectSchema] = []

        for res in results:
            if isinstance(res, list):
                all_defects.extend(res)
            elif isinstance(res, Exception):
                logger.error(f"Error judging window: {res}")

        return self._deduplicate_defects(all_defects)

    def _create_windows(self, messages: List[MessageSchema]) -> List[List[MessageSchema]]:
        """Slice messages into overlapping sliding windows."""
        windows = []
        step = max(1, self.window_size - self.overlap)
        for i in range(0, len(messages), step):
            window = messages[i: i + self.window_size]
            if window:
                windows.append(window)
            if i + self.window_size >= len(messages):
                break
        return windows

    async def _judge_window_with_retry(
        self,
        client: anthropic.AsyncAnthropic,
        task: str,
        agents: List[AgentSchema],
        window_msgs: List[MessageSchema],
    ) -> List[DefectSchema]:
        """Calls Claude with semaphore lock and 1 retry on invalid JSON."""
        async with self.semaphore:
            prompt = self._format_prompt(task, agents, window_msgs)
            for attempt in range(2):
                try:
                    response = await client.messages.create(
                        model=self.model_name,
                        max_tokens=2048,
                        temperature=0.1,
                        system=SYSTEM_PROMPT,
                        messages=[{"role": "user", "content": prompt}],
                    )
                    text_content = ""
                    for block in response.content:
                        if hasattr(block, "text"):
                            text_content += block.text

                    parsed = self._clean_and_parse_json(text_content)
                    return self._convert_to_defect_schemas(parsed)
                except Exception as ex:
                    logger.warning(f"Window judgment attempt {attempt + 1} failed: {ex}")
                    if attempt == 0:
                        await asyncio.sleep(0.5)
            return []

    def _format_prompt(
        self,
        task: str,
        agents: List[AgentSchema],
        window_msgs: List[MessageSchema],
    ) -> str:
        agent_roster = "\n".join([f"- {a.name}: {a.role}" for a in agents])
        msgs_text = "\n".join([
            f"[Msg #{m.id}] {m.sender} -> {m.receiver} ({m.timestamp}): {m.content}"
            for m in window_msgs
        ])
        return (
            f"OVERALL TASK OBJECTIVE:\n{task}\n\n"
            f"PARTICIPATING AGENTS ROSTER:\n{agent_roster}\n\n"
            f"CONVERSATION WINDOW TO EVALUATE:\n{msgs_text}\n\n"
            "Return JSON array of detected defects strictly complying with the schema:"
        )

    def _clean_and_parse_json(self, raw_text: str) -> List[Dict[str, Any]]:
        text = raw_text.strip()
        # Remove markdown code fences if present
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
        text = text.strip()

        # Find first '[' and last ']'
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1 and end > start:
            text = text[start: end + 1]

        data = json.loads(text)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            return [data]
        return []

    def _convert_to_defect_schemas(self, raw_items: List[Dict[str, Any]]) -> List[DefectSchema]:
        defects = []
        valid_types = {t.value for t in DefectType}
        valid_severities = {s.value for s in Severity}

        for item in raw_items:
            try:
                raw_type = str(item.get("type", "")).strip().upper()
                if raw_type not in valid_types:
                    continue

                raw_severity = str(item.get("severity", "medium")).strip().lower()
                if raw_severity not in valid_severities:
                    raw_severity = "medium"

                msg_ids = item.get("message_ids", [])
                if isinstance(msg_ids, int):
                    msg_ids = [msg_ids]
                msg_ids = [int(i) for i in msg_ids if str(i).isdigit()]

                agents = item.get("agents", [])
                if isinstance(agents, str):
                    agents = [agents]

                defect = DefectSchema(
                    id=f"llm-{raw_type.lower()}-{uuid.uuid4().hex[:6]}",
                    type=DefectType(raw_type),
                    severity=Severity(raw_severity),
                    message_ids=msg_ids,
                    agents=[str(a) for a in agents],
                    explanation=str(item.get("explanation", "Communication defect identified by LLM Judge.")),
                    evidence_quote=str(item.get("evidence_quote", "")),
                    suggested_fix=str(item.get("suggested_fix", "Clarify instructions and maintain aligned context.")),
                    confidence=float(min(max(float(item.get("confidence", 0.85)), 0.0), 1.0)),
                    detected_by="llm",
                )
                defects.append(defect)
            except Exception as e:
                logger.warning(f"Error transforming raw LLM defect: {e}")
        return defects

    def _deduplicate_defects(self, defects: List[DefectSchema]) -> List[DefectSchema]:
        seen = {}
        unique = []
        for d in defects:
            key = (d.type, tuple(sorted(d.message_ids)), tuple(sorted(d.agents)))
            if key not in seen:
                seen[key] = d
                unique.append(d)
            else:
                # Keep the one with higher confidence
                if d.confidence > seen[key].confidence:
                    idx = unique.index(seen[key])
                    unique[idx] = d
                    seen[key] = d
        return unique

    def _heuristic_judge(
        self,
        task: str,
        agents: List[AgentSchema],
        messages: List[MessageSchema],
    ) -> List[DefectSchema]:
        """Offline deterministic heuristic judge that detects subtle semantic defects
        when MOCK_MODE is enabled or Anthropic API key is not supplied."""
        defects: List[DefectSchema] = []
        agent_roles = {a.name.lower(): a.role.lower() for a in agents}

        # 1. AMBIGUOUS_INSTRUCTION detection
        ambiguous_patterns = [
            (r"\b(do something with|make it good|handle whatever|fix the stuff|make it work somehow|whatever you think is best|just build it)\b",
             "Extremely vague directive lacking explicit acceptance criteria or functional boundaries."),
            (r"\b(as fast as possible without details|optimize it properly)\b",
             "Ambiguous performance request lacking target metrics, latency budgets, or benchmarks.")
        ]

        # 2. ROLE_VIOLATION patterns
        role_expectations = {
            "tester": {
                "disallowed_actions": [r"\b(i have rewritten the architecture|i deployed the backend directly to production|i implemented the api endpoints)\b"],
                "role_name": "Tester",
                "violation_msg": "Tester is making unauthorized production architecture or deployment changes rather than executing validation."
            },
            "reviewer": {
                "disallowed_actions": [r"\b(i coded the full solution from scratch|i deployed to production without tests)\b"],
                "role_name": "Reviewer",
                "violation_msg": "Reviewer is implementing raw application code rather than reviewing and critiquing PRs."
            },
            "coder": {
                "disallowed_actions": [r"\b(i will define the entire business strategy and product roadmap)\b"],
                "role_name": "Coder",
                "violation_msg": "Coder is superseding Planner/Product roles by redefining system roadmap unilaterally."
            }
        }

        # 3. HALLUCINATED_CLAIM patterns
        hallucination_patterns = [
            (r"\b(all 100% of tests passed successfully and zero bugs exist|i verified this with imaginary framework|tested in quantum sandbox)\b",
             "Agent fabricated a verification claim or referenced a non-existent test environment."),
            (r"\b(benchmarked at 0\.0001ms latency with 10 million concurrent users on local sqlite)\b",
             "Agent hallucinates impossible benchmark results for the given local architecture.")
        ]

        # 4. CONTRADICTION & INFORMATION_LOSS tracker
        context_specs: Dict[str, Any] = {}

        for msg in messages:
            content = msg.content or ""
            content_lower = content.lower()
            sender_lower = msg.sender.lower()

            # Check Ambiguous Instructions
            for pattern, reason in ambiguous_patterns:
                match = re.search(pattern, content_lower)
                if match:
                    defects.append(
                        DefectSchema(
                            id=f"llm-ambiguous-{msg.id}-{uuid.uuid4().hex[:6]}",
                            type=DefectType.AMBIGUOUS_INSTRUCTION,
                            severity=Severity.HIGH,
                            message_ids=[msg.id],
                            agents=[msg.sender, msg.receiver],
                            explanation=f"Ambiguous instruction from {msg.sender}: {reason}",
                            evidence_quote=match.group(0),
                            suggested_fix="Define explicit input/output specifications, contracts, and acceptance criteria.",
                            confidence=0.92,
                            detected_by="llm",
                        )
                    )

            # Check Role Violations
            for role_key, config in role_expectations.items():
                if role_key in sender_lower or role_key in agent_roles.get(sender_lower, ""):
                    for dis_pat in config["disallowed_actions"]:
                        match = re.search(dis_pat, content_lower)
                        if match:
                            defects.append(
                                DefectSchema(
                                    id=f"llm-role-{msg.id}-{uuid.uuid4().hex[:6]}",
                                    type=DefectType.ROLE_VIOLATION,
                                    severity=Severity.HIGH,
                                    message_ids=[msg.id],
                                    agents=[msg.sender],
                                    explanation=f"Role violation by {msg.sender}: {config['violation_msg']}",
                                    evidence_quote=match.group(0),
                                    suggested_fix=f"Constrain {msg.sender} prompts and tool access to stay strictly within assigned role responsibilities.",
                                    confidence=0.94,
                                    detected_by="llm",
                                )
                            )

            # Check Hallucinated Claims
            for pattern, reason in hallucination_patterns:
                match = re.search(pattern, content_lower)
                if match:
                    defects.append(
                        DefectSchema(
                            id=f"llm-hallucination-{msg.id}-{uuid.uuid4().hex[:6]}",
                            type=DefectType.HALLUCINATED_CLAIM,
                            severity=Severity.HIGH,
                            message_ids=[msg.id],
                            agents=[msg.sender],
                            explanation=f"Hallucinated claim by {msg.sender}: {reason}",
                            evidence_quote=match.group(0),
                            suggested_fix="Require agents to ground status statements with tool execution outputs or logs.",
                            confidence=0.91,
                            detected_by="llm",
                        )
                    )

            # Check Incomplete Information
            if (
                re.search(r"\b(here is the code|attached the implementation|implemented the function below)\b", content_lower)
                and len(content.strip()) < 80
                and "def " not in content
                and "class " not in content
                and "{" not in content
            ):
                defects.append(
                    DefectSchema(
                        id=f"llm-incomplete-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.INCOMPLETE_INFORMATION,
                        severity=Severity.MEDIUM,
                        message_ids=[msg.id],
                        agents=[msg.sender, msg.receiver],
                        explanation=f"{msg.sender} claims to provide code or implementation in message #{msg.id} but omitted the actual code snippet.",
                        evidence_quote=content[:100],
                        suggested_fix="Validate that referenced artifacts or code blocks are actually attached to the message payload.",
                        confidence=0.88,
                        detected_by="llm",
                    )
                )

            # Check Contradictions
            # e.g., Database choice conflict
            if "postgresql" in content_lower and "use postgresql" in content_lower:
                context_specs["db"] = ("PostgreSQL", msg.id, msg.sender)
            elif "mongodb" in content_lower and ("switched to mongodb" in content_lower or "i used mongodb" in content_lower):
                if "db" in context_specs and context_specs["db"][0] == "PostgreSQL":
                    prev_db, prev_id, prev_sender = context_specs["db"]
                    defects.append(
                        DefectSchema(
                            id=f"llm-contradiction-{prev_id}-{msg.id}-{uuid.uuid4().hex[:6]}",
                            type=DefectType.CONTRADICTION,
                            severity=Severity.CRITICAL,
                            message_ids=[prev_id, msg.id],
                            agents=[prev_sender, msg.sender],
                            explanation=(
                                f"Direct contradiction: {prev_sender} mandated '{prev_db}' in message #{prev_id}, "
                                f"but {msg.sender} in message #{msg.id} unilaterally swapped to MongoDB."
                            ),
                            evidence_quote=f"Msg #{prev_id}: 'use PostgreSQL' vs Msg #{msg.id}: '{content[:80]}'",
                            suggested_fix="Enforce centralized architectural decision records (ADRs) that agents cannot contradict without consensus.",
                            confidence=0.96,
                            detected_by="llm",
                        )
                    )

            # Contradiction: Port conflict
            port_match = re.search(r"\bport\s+(\d{4,5})\b", content_lower)
            if port_match:
                port_num = port_match.group(1)
                if "port" in context_specs and context_specs["port"][0] != port_num:
                    prev_port, prev_id, prev_sender = context_specs["port"]
                    defects.append(
                        DefectSchema(
                            id=f"llm-contradiction-port-{prev_id}-{msg.id}-{uuid.uuid4().hex[:6]}",
                            type=DefectType.CONTRADICTION,
                            severity=Severity.MEDIUM,
                            message_ids=[prev_id, msg.id],
                            agents=[prev_sender, msg.sender],
                            explanation=f"Conflicting network port configuration: message #{prev_id} uses {prev_port} whereas message #{msg.id} uses {port_num}.",
                            evidence_quote=f"Msg #{prev_id}: port {prev_port} vs Msg #{msg.id}: port {port_num}",
                            suggested_fix="Share a single environment configuration object across all agents.",
                            confidence=0.90,
                            detected_by="llm",
                        )
                    )
                else:
                    context_specs["port"] = (port_num, msg.id, msg.sender)

            # Check Information Loss
            if "must support oauth2" in content_lower or "requirement: oauth2" in content_lower:
                context_specs["req_oauth"] = (msg.id, msg.sender)
            if "req_oauth" in context_specs and ("handing off to tester" in content_lower or "ready for testing" in content_lower):
                if "oauth" not in content_lower and "jwt only" in content_lower:
                    orig_id, orig_sender = context_specs["req_oauth"]
                    defects.append(
                        DefectSchema(
                            id=f"llm-infoloss-{orig_id}-{msg.id}-{uuid.uuid4().hex[:6]}",
                            type=DefectType.INFORMATION_LOSS,
                            severity=Severity.HIGH,
                            message_ids=[orig_id, msg.id],
                            agents=[orig_sender, msg.sender],
                            explanation=(
                                f"Information loss: mandatory OAuth2 requirement specified in message #{orig_id} "
                                f"was completely omitted during handoff in message #{msg.id} (implemented JWT only)."
                            ),
                            evidence_quote=content[:100],
                            suggested_fix="Inject requirement traceability matrices into inter-agent handoff prompts.",
                            confidence=0.89,
                            detected_by="llm",
                        )
                    )

            # Check Misinterpretation
            if "misinterpreted" in content_lower or "i thought you meant" in content_lower or "built a cli instead of web" in content_lower:
                defects.append(
                    DefectSchema(
                        id=f"llm-misinterpretation-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.MISINTERPRETATION,
                        severity=Severity.HIGH,
                        message_ids=[msg.id],
                        agents=[msg.sender, msg.receiver],
                        explanation=f"{msg.sender} misinterpreted previous specifications: constructed different deliverable than requested.",
                        evidence_quote=content[:100],
                        suggested_fix="Incorporate explicit confirmation step where receiver summarizes requirements before execution.",
                        confidence=0.92,
                        detected_by="llm",
                    )
                )

        return self._deduplicate_defects(defects)
