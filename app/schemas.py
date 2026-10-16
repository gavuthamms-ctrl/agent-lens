"""Pydantic schemas and taxonomy definitions for AgentLens."""
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class DefectType(str, Enum):
    AMBIGUOUS_INSTRUCTION = "AMBIGUOUS_INSTRUCTION"
    INCOMPLETE_INFORMATION = "INCOMPLETE_INFORMATION"
    CONTRADICTION = "CONTRADICTION"
    INFORMATION_LOSS = "INFORMATION_LOSS"
    MISINTERPRETATION = "MISINTERPRETATION"
    REDUNDANT_LOOP = "REDUNDANT_LOOP"
    IGNORED_REQUEST = "IGNORED_REQUEST"
    ROLE_VIOLATION = "ROLE_VIOLATION"
    HALLUCINATED_CLAIM = "HALLUCINATED_CLAIM"
    PROTOCOL_VIOLATION = "PROTOCOL_VIOLATION"


DEFECT_DESCRIPTIONS: Dict[DefectType, str] = {
    DefectType.AMBIGUOUS_INSTRUCTION: "Vague, unclear, or underspecified prompt or request that causes agent misalignment.",
    DefectType.INCOMPLETE_INFORMATION: "Crucial parameters, context, or code missing from a message needed by the receiver.",
    DefectType.CONTRADICTION: "A statement or directive directly conflicts with earlier verified context or requirements.",
    DefectType.INFORMATION_LOSS: "Key constraints or context established in earlier steps are omitted or dropped by later agents.",
    DefectType.MISINTERPRETATION: "An agent misreads, skews, or misapprehends another agent's request or response.",
    DefectType.REDUNDANT_LOOP: "Repetitive ping-pong or cycle of duplicate messages that creates churn with zero task progress.",
    DefectType.IGNORED_REQUEST: "A direct question or actionable request sent to an agent that remains unanswered or bypassed.",
    DefectType.ROLE_VIOLATION: "An agent takes actions or issues decisions outside of its assigned system role/capabilities.",
    DefectType.HALLUCINATED_CLAIM: "An agent asserts unsupported, fabricated, or unverified facts/results as established truth.",
    DefectType.PROTOCOL_VIOLATION: "Message breaks expected schema, addresses unknown agents, is empty, or exhibits anomaly."
}


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DetectedBy(str, Enum):
    RULE = "rule"
    LLM = "llm"
    HYBRID = "hybrid"


class AgentSchema(BaseModel):
    name: str = Field(..., description="Agent identifier/name")
    role: str = Field(..., description="Agent assigned role and responsibilities")


class MessageSchema(BaseModel):
    id: int = Field(..., description="Message sequential ID")
    sender: str = Field(..., description="Sender agent name")
    receiver: str = Field(..., description="Receiver agent name")
    content: str = Field(..., description="Message text content")
    timestamp: Optional[str] = Field(default="", description="ISO timestamp or relative time string")


class DefectSchema(BaseModel):
    id: str = Field(..., description="Unique defect ID")
    type: DefectType = Field(..., description="Defect taxonomy type")
    severity: Severity = Field(..., description="Severity level")
    message_ids: List[int] = Field(default_factory=list, description="IDs of messages involved")
    agents: List[str] = Field(default_factory=list, description="Agent names involved")
    explanation: str = Field(..., description="Human-readable explanation of why this defect occurred")
    evidence_quote: str = Field(default="", description="Direct quotation or snippet showing the defect")
    suggested_fix: str = Field(..., description="Actionable recommendation to remediate the defect")
    confidence: float = Field(default=0.85, ge=0.0, le=1.0, description="Detection confidence score")
    detected_by: str = Field(default="rule", description="'rule', 'llm', or 'hybrid'")


class TraceInputSchema(BaseModel):
    trace_name: str = Field(..., description="Name or title for the conversation trace")
    agents: List[AgentSchema] = Field(default_factory=list, description="List of participating agents")
    task: str = Field(default="General Multi-Agent Collaboration", description="Task objective or goal")
    messages: List[MessageSchema] = Field(..., description="Chronological list of messages")
    ground_truth: Optional[List[DefectSchema]] = Field(default=None, description="Optional ground truth defects")


class PasteInputSchema(BaseModel):
    text: str = Field(..., description="Raw JSON or CSV trace content")
    trace_name: Optional[str] = Field(default=None, description="Optional custom trace name")
    task: Optional[str] = Field(default=None, description="Optional task description")


class GraphNode(BaseModel):
    id: str
    label: str
    role: str
    sent_count: int
    received_count: int
    total_messages: int
    defect_count: int
    betweenness: float
    degree_centrality: float
    is_bottleneck: bool
    is_isolated: bool


class GraphEdge(BaseModel):
    id: str
    from_node: str = Field(..., alias="from")
    to_node: str = Field(..., alias="to")
    count: int
    message_ids: List[int]
    defect_count: int
    has_defects: bool
    defect_types: List[str]

    model_config = ConfigDict(populate_by_name=True)


class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    cycles_detected: List[List[str]]
    isolated_agents: List[str]
    bottleneck_agents: List[str]
    density: float
    total_messages: int


class HealthScoreBreakdown(BaseModel):
    health_score: int = Field(..., ge=0, le=100)
    grade: str = Field(..., description="Letter grade (A, B, C, D, F)")
    base_score: int = 100
    defect_penalties: float
    volume_factor: float
    network_penalties: float
    defects_by_severity: Dict[str, int]
    defect_density: float
    formula_summary: str


class TraceSummaryItem(BaseModel):
    id: int
    trace_name: str
    task: str
    created_at: str
    message_count: int
    agent_count: int
    defect_count: int
    health_score: Optional[int] = None
    grade: Optional[str] = None
    has_ground_truth: bool


class TraceReport(BaseModel):
    trace_id: int
    trace_name: str
    task: str
    created_at: str
    agents: List[AgentSchema]
    messages: List[MessageSchema]
    defects: List[DefectSchema]
    health: HealthScoreBreakdown
    graph: GraphData
    defect_counts_by_type: Dict[str, int]
    defect_counts_by_severity: Dict[str, int]
    defect_counts_by_agent: Dict[str, int]
    top_issues: List[DefectSchema]
    has_ground_truth: bool


class EvaluationTypeMetrics(BaseModel):
    defect_type: str
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1_score: float
    ground_truth_count: int
    detected_count: int


class DefectMatchDetail(BaseModel):
    ground_truth_defect: Optional[DefectSchema] = None
    detected_defect: Optional[DefectSchema] = None
    match_type: str = Field(..., description="'TP' (true positive), 'FP' (false positive), or 'FN' (false negative)")
    reason: str


class EvaluationResult(BaseModel):
    trace_id: int
    trace_name: str
    overall_precision: float
    overall_recall: float
    overall_f1: float
    total_ground_truth: int
    total_detected: int
    total_true_positives: int
    total_false_positives: int
    total_false_negatives: int
    per_type_metrics: List[EvaluationTypeMetrics]
    confusion_matrix: Dict[str, Dict[str, int]]
    false_positives: List[DefectSchema]
    false_negatives: List[DefectSchema]
    true_positive_matches: List[Dict[str, Any]]


class DemoGenerateRequest(BaseModel):
    task: Optional[str] = Field(default=None, description="Custom task or standard simulated scenario")
    inject_defects: Optional[List[DefectType]] = Field(default=None, description="Defect types to inject (or all if none)")
    clean: Optional[bool] = Field(default=False, description="Generate a clean flawless trace if True")
