"""Simulated multi-agent system trace and defect generator for AgentLens."""
import uuid
from typing import List, Optional, Tuple
from app.schemas import (
    DefectType,
    Severity,
    DefectSchema,
    AgentSchema,
    MessageSchema,
    TraceInputSchema,
)

STANDARD_AGENTS = [
    AgentSchema(name="Planner", role="System Architect & Task Coordinator. Decomposes tasks, defines interfaces, and sets acceptance criteria."),
    AgentSchema(name="Coder", role="Software Implementation Engineer. Writes modular application code matching architecture specs."),
    AgentSchema(name="Reviewer", role="Senior Security & Code Reviewer. Performs static analysis, security audits, and code quality checks."),
    AgentSchema(name="Tester", role="QA & Automation Engineer. Executes test suites, stress testing, and validates edge cases."),
]


class DemoGeneratorService:
    """Generates realistic simulated MAS traces with precise ground-truth defect injections."""

    @classmethod
    def generate(
        cls,
        task: Optional[str] = None,
        inject_defects: Optional[List[DefectType]] = None,
        clean: bool = False,
    ) -> TraceInputSchema:
        if clean:
            return cls._generate_clean_trace(task or "Implement JWT Authentication & User Session Management")

        target_types = set(inject_defects) if inject_defects else set(DefectType)
        return cls._generate_defective_trace(
            task=task or "Build Resilient Authentication & Payment Webhook Microservice",
            defect_types=target_types,
        )

    @classmethod
    def _generate_clean_trace(cls, task: str) -> TraceInputSchema:
        messages = [
            MessageSchema(
                id=1,
                sender="Planner",
                receiver="Coder",
                content=(
                    "Welcome team. Task: Implement JWT authentication with RS256 signing. "
                    "Requirements: 1) Endpoints: POST /auth/login and POST /auth/refresh. "
                    "2) Expiration: Access token 15 mins, Refresh token 7 days. "
                    "3) Store tokens in HTTP-only cookies. Please implement the auth router and user schema."
                ),
                timestamp="2026-10-05T10:00:00Z",
            ),
            MessageSchema(
                id=2,
                sender="Coder",
                receiver="Planner",
                content=(
                    "Understood. I have implemented the FastAPI auth router in `app/routers/auth.py` "
                    "with RS256 asymmetric keys and Pydantic user models in `app/schemas/user.py`. "
                    "Ready to hand over to Reviewer for security inspection."
                ),
                timestamp="2026-10-05T10:04:15Z",
            ),
            MessageSchema(
                id=3,
                sender="Coder",
                receiver="Reviewer",
                content=(
                    "Hi Reviewer, please review PR #14 containing JWT authentication. "
                    "We use PyJWT with RS256, HTTP-only SameSite=Strict cookies, and bcrypt password hashing with work factor 12."
                ),
                timestamp="2026-10-05T10:05:00Z",
            ),
            MessageSchema(
                id=4,
                sender="Reviewer",
                receiver="Coder",
                content=(
                    "Review completed. Verified token signature validation, key rotation support, and cookie security flags. "
                    "No security vulnerabilities detected. Code passes all lint and safety guidelines. Approved for test execution."
                ),
                timestamp="2026-10-05T10:08:20Z",
            ),
            MessageSchema(
                id=5,
                sender="Coder",
                receiver="Tester",
                content=(
                    "Hi Tester, PR #14 is approved by Reviewer. "
                    "Please execute test suites for token issuance, expiration revocation, and replay attack prevention."
                ),
                timestamp="2026-10-05T10:09:00Z",
            ),
            MessageSchema(
                id=6,
                sender="Tester",
                receiver="Planner",
                content=(
                    "Validation results: 24/24 unit and integration tests passed with 98% coverage. "
                    "Tested expired tokens, malformed headers, and brute-force lockouts. Service is robust and ready for production deployment."
                ),
                timestamp="2026-10-05T10:13:30Z",
            ),
        ]

        return TraceInputSchema(
            trace_name="Clean Multi-Agent Auth Delivery (Zero Defects)",
            agents=STANDARD_AGENTS,
            task=task,
            messages=messages,
            ground_truth=[],
        )

    @classmethod
    def _generate_defective_trace(
        cls,
        task: str,
        defect_types: set,
    ) -> TraceInputSchema:
        messages: List[MessageSchema] = []
        ground_truth: List[DefectSchema] = []
        msg_id = 1

        # 1. AMBIGUOUS_INSTRUCTION
        if DefectType.AMBIGUOUS_INSTRUCTION in defect_types:
            content = "Team, we need auth. Just make it good and do something with auth, whatever you think is best, optimize it properly."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Planner",
                    receiver="Coder",
                    content=content,
                    timestamp="2026-10-05T10:00:00Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-ambiguous-{msg_id}",
                    type=DefectType.AMBIGUOUS_INSTRUCTION,
                    severity=Severity.HIGH,
                    message_ids=[msg_id],
                    agents=["Planner", "Coder"],
                    explanation="Planner issued an underspecified instruction lacking algorithms, tokens, schemas, or security constraints.",
                    evidence_quote="make it good and do something with auth, whatever you think is best",
                    suggested_fix="Planner must specify exact protocol specifications, token algorithms, and acceptance criteria.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1
        else:
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Planner",
                    receiver="Coder",
                    content="Please implement OAuth2 with JWT bearer tokens for user login and session refresh.",
                    timestamp="2026-10-05T10:00:00Z",
                )
            )
            msg_id += 1

        # 2. CONTRADICTION & INFORMATION_LOSS Setup
        planner_req_id = msg_id
        messages.append(
            MessageSchema(
                id=msg_id,
                sender="Planner",
                receiver="Coder",
                content=(
                    "Mandatory Architectural Rule: Use PostgreSQL for persistent user storage and port 8080. "
                    "Requirement: OAuth2 must support Google and GitHub external identity providers."
                ),
                timestamp="2026-10-05T10:01:30Z",
            )
        )
        msg_id += 1

        # INCOMPLETE_INFORMATION
        if DefectType.INCOMPLETE_INFORMATION in defect_types:
            content = "Here is the code for the database schema and authentication service."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Coder",
                    receiver="Planner",
                    content=content,
                    timestamp="2026-10-05T10:03:00Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-incomplete-{msg_id}",
                    type=DefectType.INCOMPLETE_INFORMATION,
                    severity=Severity.MEDIUM,
                    message_ids=[msg_id],
                    agents=["Coder", "Planner"],
                    explanation="Coder claims to attach code and schema but omitted the code payload entirely.",
                    evidence_quote="Here is the code for the database schema",
                    suggested_fix="Validate attachment of artifacts before message transmission.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # CONTRADICTION
        if DefectType.CONTRADICTION in defect_types:
            content = "I switched to MongoDB because I prefer document databases and configured server on port 3000."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Coder",
                    receiver="Planner",
                    content=content,
                    timestamp="2026-10-05T10:04:10Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-contradiction-{msg_id}",
                    type=DefectType.CONTRADICTION,
                    severity=Severity.CRITICAL,
                    message_ids=[planner_req_id, msg_id],
                    agents=["Planner", "Coder"],
                    explanation="Coder unilaterally contradicted Planner's mandatory requirement of PostgreSQL on port 8080 by switching to MongoDB on port 3000.",
                    evidence_quote="I switched to MongoDB because I prefer document databases and configured server on port 3000.",
                    suggested_fix="Enforce architecture compliance checks before allowing code commits.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # INFORMATION_LOSS
        if DefectType.INFORMATION_LOSS in defect_types:
            content = "Handing off to Tester: implemented JWT only, ready for testing."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Coder",
                    receiver="Tester",
                    content=content,
                    timestamp="2026-10-05T10:05:40Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-infoloss-{msg_id}",
                    type=DefectType.INFORMATION_LOSS,
                    severity=Severity.HIGH,
                    message_ids=[planner_req_id, msg_id],
                    agents=["Planner", "Coder"],
                    explanation="Coder dropped the mandatory OAuth2 Google/GitHub requirement specified in Planner's requirements, delivering JWT only.",
                    evidence_quote="Handing off to Tester: implemented JWT only, ready for testing.",
                    suggested_fix="Maintain explicit requirements traceability matrix passed across handoffs.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # MISINTERPRETATION
        if DefectType.MISINTERPRETATION in defect_types:
            content = "I misinterpreted the requirements and built a CLI instead of web REST endpoints."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Coder",
                    receiver="Reviewer",
                    content=content,
                    timestamp="2026-10-05T10:06:50Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-misinterpretation-{msg_id}",
                    type=DefectType.MISINTERPRETATION,
                    severity=Severity.HIGH,
                    message_ids=[msg_id],
                    agents=["Coder", "Reviewer"],
                    explanation="Coder misinterpreted the microservice specification and built an interactive CLI application instead of HTTP REST API endpoints.",
                    evidence_quote="I misinterpreted the requirements and built a CLI instead of web REST endpoints.",
                    suggested_fix="Implement contract-driven development with schema validation before implementation.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # REDUNDANT_LOOP
        if DefectType.REDUNDANT_LOOP in defect_types:
            loop_m1 = msg_id
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Reviewer",
                    receiver="Coder",
                    content="Can you please send the status of the auth build and code artifacts?",
                    timestamp="2026-10-05T10:07:30Z",
                )
            )
            msg_id += 1
            loop_m2 = msg_id
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Reviewer",
                    receiver="Coder",
                    content="Can you please send the status of the auth build and code artifacts?",
                    timestamp="2026-10-05T10:08:00Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-loop-{loop_m1}-{loop_m2}",
                    type=DefectType.REDUNDANT_LOOP,
                    severity=Severity.HIGH,
                    message_ids=[loop_m1, loop_m2],
                    agents=["Reviewer", "Coder"],
                    explanation="Reviewer sent verbatim duplicate requests back-to-back creating an unproductive ping-pong loop.",
                    evidence_quote="Can you please send the status of the auth build and code artifacts?",
                    suggested_fix="Implement deduplication and backoff when waiting for peer responses.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # IGNORED_REQUEST
        if DefectType.IGNORED_REQUEST in defect_types:
            ignored_id = msg_id
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Reviewer",
                    receiver="Coder",
                    content="Please provide the security scan logs and dependency audit report right away?",
                    timestamp="2026-10-05T10:09:15Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-ignored-{ignored_id}",
                    type=DefectType.IGNORED_REQUEST,
                    severity=Severity.HIGH,
                    message_ids=[ignored_id],
                    agents=["Reviewer", "Coder"],
                    explanation="Reviewer requested security scan logs and dependency audit, but Coder never responded to this request.",
                    evidence_quote="Please provide the security scan logs and dependency audit report right away?",
                    suggested_fix="Track unresolved agent queries in shared state until explicitly answered.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # ROLE_VIOLATION
        if DefectType.ROLE_VIOLATION in defect_types:
            content = "I have rewritten the architecture and I deployed the backend directly to production without waiting for tests or reviews."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Tester",
                    receiver="Planner",
                    content=content,
                    timestamp="2026-10-05T10:10:45Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-role-{msg_id}",
                    type=DefectType.ROLE_VIOLATION,
                    severity=Severity.HIGH,
                    message_ids=[msg_id],
                    agents=["Tester"],
                    explanation="Tester acted outside assigned QA duties by deploying directly to production and changing system architecture.",
                    evidence_quote="I have rewritten the architecture and I deployed the backend directly to production",
                    suggested_fix="Enforce strict role-based access control (RBAC) and permissions in agent execution environments.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # HALLUCINATED_CLAIM
        if DefectType.HALLUCINATED_CLAIM in defect_types:
            content = "All 100% of tests passed successfully and zero bugs exist in quantum sandbox with 0.0001ms latency."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Tester",
                    receiver="Planner",
                    content=content,
                    timestamp="2026-10-05T10:11:50Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-hallucination-{msg_id}",
                    type=DefectType.HALLUCINATED_CLAIM,
                    severity=Severity.HIGH,
                    message_ids=[msg_id],
                    agents=["Tester"],
                    explanation="Tester fabricated a verification in a non-existent quantum sandbox and claimed impossible latency.",
                    evidence_quote="All 100% of tests passed successfully and zero bugs exist in quantum sandbox",
                    suggested_fix="Require automated test runners to produce cryptographically signed JUnit test result artifacts.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        # PROTOCOL_VIOLATION
        if DefectType.PROTOCOL_VIOLATION in defect_types:
            # Send message to an unregistered agent
            content = "Alert: Deploying configuration patch to unregistered node."
            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender="Coder",
                    receiver="UnknownBot",
                    content=content,
                    timestamp="2026-10-05T10:12:30Z",
                )
            )
            ground_truth.append(
                DefectSchema(
                    id=f"gt-protocol-{msg_id}",
                    type=DefectType.PROTOCOL_VIOLATION,
                    severity=Severity.HIGH,
                    message_ids=[msg_id],
                    agents=["Coder", "UnknownBot"],
                    explanation="Message addressed to 'UnknownBot', an agent not registered in the system roster.",
                    evidence_quote="Receiver: UnknownBot",
                    suggested_fix="Validate destination agent against known roster prior to routing messages.",
                    confidence=1.0,
                    detected_by="ground_truth",
                )
            )
            msg_id += 1

        return TraceInputSchema(
            trace_name=f"Simulated MAS Defect Trace ({len(ground_truth)} Defects)",
            agents=STANDARD_AGENTS,
            task=task,
            messages=messages,
            ground_truth=ground_truth,
        )
