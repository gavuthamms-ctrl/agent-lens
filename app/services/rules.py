"""Rule-based communication defect detector for multi-agent traces."""
import re
import uuid
from typing import List, Dict, Set
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.schemas import (
    DefectSchema,
    DefectType,
    Severity,
    MessageSchema,
    AgentSchema,
)


REQUEST_INDICATORS = [
    r"\?",
    r"\bplease\b",
    r"\bcould you\b",
    r"\bcan you\b",
    r"\bneed you to\b",
    r"\bkindly\b",
    r"\bprovide\b",
    r"\bshare\b",
    r"\blet me know\b",
    r"\brequest\b",
    r"\bwaiting for\b",
    r"\bhelp me\b"
]


class RuleBasedDetector:
    """Detects multi-agent communication defects using deterministic linguistic,
    statistical, and structural rules."""

    def __init__(
        self,
        unanswered_window_limit: int = 4,
        similarity_threshold: float = 0.82,
        min_content_length: int = 3,
    ):
        self.unanswered_window_limit = unanswered_window_limit
        self.similarity_threshold = similarity_threshold
        self.min_content_length = min_content_length

    def detect(
        self,
        messages: List[MessageSchema],
        agents: List[AgentSchema],
    ) -> List[DefectSchema]:
        """Run all rule-based checks and return detected defects."""
        defects: List[DefectSchema] = []

        if not messages:
            return defects

        known_agent_names: Set[str] = {a.name.strip().lower() for a in agents}

        # 1. Structural / Protocol checks (empty, unknown agent, self-talk, length anomaly)
        defects.extend(self._check_protocol_and_anomalies(messages, known_agent_names))

        # 2. Redundant loops (TF-IDF cosine similarity and cycle repetitions)
        defects.extend(self._check_redundant_loops(messages))

        # 3. Unanswered / Ignored requests
        defects.extend(self._check_unanswered_requests(messages))

        return defects

    def _check_protocol_and_anomalies(
        self,
        messages: List[MessageSchema],
        known_agent_names: Set[str],
    ) -> List[DefectSchema]:
        defects: List[DefectSchema] = []
        lengths = [len(m.content.strip()) for m in messages if m.content]

        mean_len = float(np.mean(lengths)) if lengths else 50.0
        std_len = float(np.std(lengths)) if lengths and len(lengths) > 3 else 50.0
        outlier_upper_bound = max(mean_len + (3.0 * std_len), 3000.0)

        for msg in messages:
            content_stripped = (msg.content or "").strip()
            sender_clean = (msg.sender or "").strip()
            receiver_clean = (msg.receiver or "").strip()

            # Empty message check
            if not content_stripped:
                defects.append(
                    DefectSchema(
                        id=f"rule-empty-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.PROTOCOL_VIOLATION,
                        severity=Severity.HIGH,
                        message_ids=[msg.id],
                        agents=[sender_clean, receiver_clean] if receiver_clean else [sender_clean],
                        explanation=f"Message #{msg.id} from {sender_clean} to {receiver_clean} has empty or whitespace-only content.",
                        evidence_quote="[EMPTY MESSAGE BODY]",
                        suggested_fix="Ensure agents validate non-empty message payloads before sending.",
                        confidence=1.0,
                        detected_by="rule",
                    )
                )
                continue

            # Length anomaly: extremely short
            if len(content_stripped) < self.min_content_length:
                defects.append(
                    DefectSchema(
                        id=f"rule-short-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.PROTOCOL_VIOLATION,
                        severity=Severity.MEDIUM,
                        message_ids=[msg.id],
                        agents=[sender_clean, receiver_clean],
                        explanation=f"Message #{msg.id} content '{content_stripped}' is abnormally short (< {self.min_content_length} characters) and lacks necessary semantic context.",
                        evidence_quote=content_stripped,
                        suggested_fix="Enforce minimum informative token thresholds on agent outputs.",
                        confidence=0.95,
                        detected_by="rule",
                    )
                )

            # Length anomaly: extreme outlier
            elif len(content_stripped) > outlier_upper_bound and len(content_stripped) > 2500:
                defects.append(
                    DefectSchema(
                        id=f"rule-long-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.PROTOCOL_VIOLATION,
                        severity=Severity.LOW,
                        message_ids=[msg.id],
                        agents=[sender_clean, receiver_clean],
                        explanation=f"Message #{msg.id} is an extreme length anomaly ({len(content_stripped)} chars vs mean {mean_len:.1f} chars), likely dumping unparsed raw logs or unconstrained generation.",
                        evidence_quote=content_stripped[:120] + "... [truncated]",
                        suggested_fix="Implement summarization or structured output schemas before dispatching large dumps.",
                        confidence=0.85,
                        detected_by="rule",
                    )
                )

            # Self-directed message
            if sender_clean.lower() == receiver_clean.lower() and sender_clean:
                defects.append(
                    DefectSchema(
                        id=f"rule-selftalk-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.PROTOCOL_VIOLATION,
                        severity=Severity.MEDIUM,
                        message_ids=[msg.id],
                        agents=[sender_clean],
                        explanation=f"Agent '{sender_clean}' dispatched a communication message to itself in message #{msg.id}.",
                        evidence_quote=content_stripped[:100],
                        suggested_fix="Correct router logic so agents do not route outward network messages to themselves.",
                        confidence=1.0,
                        detected_by="rule",
                    )
                )

            # Unknown receiver agent
            if known_agent_names and receiver_clean.lower() not in known_agent_names:
                defects.append(
                    DefectSchema(
                        id=f"rule-unknown-rcv-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.PROTOCOL_VIOLATION,
                        severity=Severity.HIGH,
                        message_ids=[msg.id],
                        agents=[sender_clean, receiver_clean],
                        explanation=f"Message #{msg.id} addressed recipient '{receiver_clean}', which is not a recognized agent in this system roster.",
                        evidence_quote=f"Receiver: {receiver_clean}",
                        suggested_fix=f"Configure agent roster validation; valid recipients are: {', '.join(sorted(known_agent_names))}.",
                        confidence=0.98,
                        detected_by="rule",
                    )
                )

            # Unknown sender agent
            if known_agent_names and sender_clean.lower() not in known_agent_names:
                defects.append(
                    DefectSchema(
                        id=f"rule-unknown-snd-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.PROTOCOL_VIOLATION,
                        severity=Severity.HIGH,
                        message_ids=[msg.id],
                        agents=[sender_clean],
                        explanation=f"Message #{msg.id} originated from unauthorized or unregistered sender '{sender_clean}'.",
                        evidence_quote=f"Sender: {sender_clean}",
                        suggested_fix="Ensure all interacting agents are authenticated and initialized in the agent roster.",
                        confidence=0.98,
                        detected_by="rule",
                    )
                )

        return defects

    def _check_redundant_loops(self, messages: List[MessageSchema]) -> List[DefectSchema]:
        """Detect repeated near-duplicate messages or ping-pong loops using TF-IDF cosine similarity."""
        defects: List[DefectSchema] = []
        if len(messages) < 2:
            return defects

        valid_msgs = [m for m in messages if len((m.content or "").strip()) >= 5]
        if len(valid_msgs) < 2:
            return defects

        contents = [m.content.strip().lower() for m in valid_msgs]

        try:
            vectorizer = TfidfVectorizer(stop_words="english", min_df=1)
            tfidf_matrix = vectorizer.fit_transform(contents)
            sim_matrix = cosine_similarity(tfidf_matrix)
        except Exception:
            return defects

        flagged_pairs = set()

        for i in range(len(valid_msgs)):
            for j in range(i + 1, min(i + 6, len(valid_msgs))):
                sim = sim_matrix[i, j]
                msg_i = valid_msgs[i]
                msg_j = valid_msgs[j]

                # Check if same sender/receiver pair or reverse ping-pong pair
                same_direction = (msg_i.sender == msg_j.sender and msg_i.receiver == msg_j.receiver)
                is_ping_pong = (msg_i.sender == msg_j.receiver and msg_i.receiver == msg_j.sender)

                if sim >= self.similarity_threshold and (same_direction or is_ping_pong):
                    pair_key = tuple(sorted([msg_i.id, msg_j.id]))
                    if pair_key in flagged_pairs:
                        continue
                    flagged_pairs.add(pair_key)

                    severity = Severity.HIGH if sim >= 0.95 else Severity.MEDIUM
                    defects.append(
                        DefectSchema(
                            id=f"rule-loop-{msg_i.id}-{msg_j.id}-{uuid.uuid4().hex[:6]}",
                            type=DefectType.REDUNDANT_LOOP,
                            severity=severity,
                            message_ids=[msg_i.id, msg_j.id],
                            agents=list({msg_i.sender, msg_i.receiver, msg_j.sender, msg_j.receiver}),
                            explanation=(
                                f"Redundant loop detected between messages #{msg_i.id} and #{msg_j.id} "
                                f"with {sim * 100:.1f}% semantic similarity without meaningful state change."
                            ),
                            evidence_quote=f"Msg #{msg_i.id}: '{msg_i.content[:70]}...' vs Msg #{msg_j.id}: '{msg_j.content[:70]}...'",
                            suggested_fix="Implement loop-detection guards and pass explicit delta state rather than resending queries.",
                            confidence=round(float(sim), 2),
                            detected_by="rule",
                        )
                    )

        return defects

    def _check_unanswered_requests(self, messages: List[MessageSchema]) -> List[DefectSchema]:
        """Detect messages posing clear questions or tasks where the recipient never responds within N turns."""
        defects: List[DefectSchema] = []
        if len(messages) < 2:
            return defects

        request_pattern = re.compile("|".join(REQUEST_INDICATORS), re.IGNORECASE)

        for idx, msg in enumerate(messages):
            sender = msg.sender.strip()
            receiver = msg.receiver.strip()
            content = (msg.content or "").strip()

            if not request_pattern.search(content):
                continue

            # Look ahead in subsequent messages for an answer from receiver back to sender
            answered = False
            subsequent_limit = min(idx + 1 + self.unanswered_window_limit, len(messages))
            subsequent_msgs = messages[idx + 1: subsequent_limit]

            for next_msg in subsequent_msgs:
                # Answer is expected from the receiver back to original sender (or broadcast to all/team)
                if (
                    next_msg.sender.strip().lower() == receiver.lower()
                    and (
                        next_msg.receiver.strip().lower() == sender.lower()
                        or next_msg.receiver.strip().lower() in {"all", "team", "coordinator", "planner"}
                    )
                ):
                    answered = True
                    break

            # Also check if receiver answered anytime in the rest of the trace
            if not answered:
                later_msgs = messages[idx + 1:]
                for later_msg in later_msgs:
                    if later_msg.sender.strip().lower() == receiver.lower() and later_msg.receiver.strip().lower() == sender.lower():
                        answered = True
                        break

            if not answered:
                defects.append(
                    DefectSchema(
                        id=f"rule-ignored-{msg.id}-{uuid.uuid4().hex[:6]}",
                        type=DefectType.IGNORED_REQUEST,
                        severity=Severity.HIGH,
                        message_ids=[msg.id],
                        agents=[sender, receiver],
                        explanation=(
                            f"In message #{msg.id}, {sender} sent a direct request or question to {receiver}, "
                            f"but {receiver} never responded to it in the subsequent conversation."
                        ),
                        evidence_quote=content[:140] + ("..." if len(content) > 140 else ""),
                        suggested_fix=f"Configure agent {receiver} to acknowledge incoming task requests and maintain an unresolved question queue.",
                        confidence=0.90,
                        detected_by="rule",
                    )
                )

        return defects
