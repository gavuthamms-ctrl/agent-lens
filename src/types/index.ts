export enum DefectType {
  AMBIGUOUS_INSTRUCTION = 'AMBIGUOUS_INSTRUCTION',
  INCOMPLETE_INFORMATION = 'INCOMPLETE_INFORMATION',
  CONTRADICTION = 'CONTRADICTION',
  INFORMATION_LOSS = 'INFORMATION_LOSS',
  MISINTERPRETATION = 'MISINTERPRETATION',
  REDUNDANT_LOOP = 'REDUNDANT_LOOP',
  IGNORED_REQUEST = 'IGNORED_REQUEST',
  ROLE_VIOLATION = 'ROLE_VIOLATION',
  HALLUCINATED_CLAIM = 'HALLUCINATED_CLAIM',
  PROTOCOL_VIOLATION = 'PROTOCOL_VIOLATION',
}

export const DEFECT_DESCRIPTIONS: Record<DefectType, string> = {
  [DefectType.AMBIGUOUS_INSTRUCTION]: 'Vague, unclear, or underspecified prompt or request that causes agent misalignment.',
  [DefectType.INCOMPLETE_INFORMATION]: 'Crucial parameters, context, or code missing from a message needed by the receiver.',
  [DefectType.CONTRADICTION]: 'A statement or directive directly conflicts with earlier verified context or requirements.',
  [DefectType.INFORMATION_LOSS]: 'Key constraints or context established in earlier steps are omitted or dropped by later agents.',
  [DefectType.MISINTERPRETATION]: "An agent misreads, skews, or misapprehends another agent's request or response.",
  [DefectType.REDUNDANT_LOOP]: 'Repetitive ping-pong or cycle of duplicate messages that creates churn with zero task progress.',
  [DefectType.IGNORED_REQUEST]: 'A direct question or actionable request sent to an agent that remains unanswered or bypassed.',
  [DefectType.ROLE_VIOLATION]: 'An agent takes actions or issues decisions outside of its assigned system role/capabilities.',
  [DefectType.HALLUCINATED_CLAIM]: 'An agent asserts unsupported, fabricated, or unverified facts/results as established truth.',
  [DefectType.PROTOCOL_VIOLATION]: 'Message breaks expected schema, addresses unknown agents, is empty, or exhibits anomaly.',
};

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type DetectedBy = 'rule' | 'llm' | 'hybrid' | 'ground_truth';

export interface AgentSchema {
  name: string;
  role: string;
}

export interface MessageSchema {
  id: number;
  sender: string;
  receiver: string;
  content: string;
  timestamp?: string;
}

export interface DefectSchema {
  id: string;
  type: DefectType;
  severity: Severity;
  message_ids: number[];
  agents: string[];
  explanation: string;
  evidence_quote: string;
  suggested_fix: string;
  confidence: number;
  detected_by: DetectedBy | string;
}

export interface TraceInputSchema {
  trace_name: string;
  agents: AgentSchema[];
  task: string;
  messages: MessageSchema[];
  ground_truth?: DefectSchema[];
}

export interface GraphNode {
  id: string;
  label: string;
  role: string;
  sent_count: number;
  received_count: number;
  total_messages: number;
  defect_count: number;
  betweenness: number;
  degree_centrality: number;
  is_bottleneck: boolean;
  is_isolated: boolean;
}

export interface GraphEdge {
  id: string;
  from_node: string;
  to_node: string;
  count: number;
  message_ids: number[];
  defect_count: number;
  has_defects: boolean;
  defect_types: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles_detected: string[][];
  isolated_agents: string[];
  bottleneck_agents: string[];
  density: number;
  total_messages: number;
}

export interface HealthScoreBreakdown {
  health_score: number;
  grade: string;
  base_score: number;
  defect_penalties: number;
  volume_factor: number;
  network_penalties: number;
  defects_by_severity: Record<string, number>;
  defect_density: number;
  formula_summary: string;
}

export interface TraceSummaryItem {
  id: number;
  trace_name: string;
  task: string;
  created_at: string;
  message_count: number;
  agent_count: number;
  defect_count: number;
  health_score: number | null;
  grade: string | null;
  has_ground_truth: boolean;
}

export interface TraceReport {
  trace_id: number;
  trace_name: string;
  task: string;
  created_at: string;
  agents: AgentSchema[];
  messages: MessageSchema[];
  defects: DefectSchema[];
  health: HealthScoreBreakdown;
  graph: GraphData;
  defect_counts_by_type: Record<string, number>;
  defect_counts_by_severity: Record<string, number>;
  defect_counts_by_agent: Record<string, number>;
  top_issues: DefectSchema[];
  has_ground_truth: boolean;
}

export interface EvaluationTypeMetrics {
  defect_type: string;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1_score: number;
  ground_truth_count: number;
  detected_count: number;
}

export interface EvaluationResult {
  trace_id: number;
  trace_name: string;
  overall_precision: number;
  overall_recall: number;
  overall_f1: number;
  total_ground_truth: number;
  total_detected: number;
  total_true_positives: number;
  total_false_positives: number;
  total_false_negatives: number;
  per_type_metrics: EvaluationTypeMetrics[];
  confusion_matrix: Record<string, Record<string, number>>;
  false_positives: DefectSchema[];
  false_negatives: DefectSchema[];
  true_positive_matches: Array<{
    ground_truth_id: string;
    detected_id: string;
    defect_type: string;
    message_ids: number[];
    confidence: number;
  }>;
}

export interface DemoGenerateRequest {
  task?: string;
  inject_defects?: DefectType[];
  clean?: boolean;
}
