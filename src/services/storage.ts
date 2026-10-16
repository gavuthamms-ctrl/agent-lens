import {
  TraceInputSchema,
  TraceReport,
  TraceSummaryItem,
  EvaluationResult,
  DemoGenerateRequest,
  DefectType,
} from '../types';
import { DetectionPipeline } from './pipeline';
import { DemoGeneratorService } from './demoGenerator';
import { EvaluationService } from './evaluation';

const STORAGE_KEY = 'agentlens_traces_v1';
const EVAL_KEY = 'agentlens_evals_v1';
const pipeline = new DetectionPipeline();

// Initial sample traces
const SEED_TRACES: TraceInputSchema[] = [
  {
    trace_name: 'Payment Gateway Integration with Feedback Loops',
    task: 'Integrate Stripe webhook event processing and idempotency keys',
    agents: [
      {
        name: 'Planner',
        role: 'Lead Architect. Defines integration milestones and payment failure policies.',
      },
      {
        name: 'Coder',
        role: 'Backend Engineer. Implements webhook signature checks and database transactions.',
      },
      {
        name: 'Reviewer',
        role: 'Security Auditor. Verifies PCI compliance and replay attack mitigation.',
      },
      {
        name: 'Tester',
        role: 'QA Engineer. Simulates duplicated webhooks, signature tampering, and network timeouts.',
      },
    ],
    messages: [
      {
        id: 1,
        sender: 'Planner',
        receiver: 'Coder',
        content:
          'Please implement Stripe webhook receiver for `payment_intent.succeeded` with HMAC SHA256 signature verification and idempotency caching in Redis.',
        timestamp: '2026-10-05T11:00:00Z',
      },
      {
        id: 2,
        sender: 'Coder',
        receiver: 'Reviewer',
        content:
          'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
        timestamp: '2026-10-05T11:03:10Z',
      },
      {
        id: 3,
        sender: 'Reviewer',
        receiver: 'Coder',
        content:
          'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
        timestamp: '2026-10-05T11:04:00Z',
      },
      {
        id: 4,
        sender: 'Coder',
        receiver: 'Reviewer',
        content:
          'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
        timestamp: '2026-10-05T11:04:45Z',
      },
      {
        id: 5,
        sender: 'Reviewer',
        receiver: 'Coder',
        content:
          'Please provide the complete idempotency key replay test suite and coverage reports immediately?',
        timestamp: '2026-10-05T11:06:00Z',
      },
      {
        id: 6,
        sender: 'Coder',
        receiver: 'Planner',
        content:
          'Planner, I am moving ahead with database migrations for the transactions table using SQLite instead of waiting.',
        timestamp: '2026-10-05T11:08:30Z',
      },
      {
        id: 7,
        sender: 'Tester',
        receiver: 'Coder',
        content:
          'Could you please share the endpoint URL so I can start sending simulated webhook payloads?',
        timestamp: '2026-10-05T11:10:00Z',
      },
      {
        id: 8,
        sender: 'Coder',
        receiver: 'Planner',
        content:
          'Everything is deployed and I have notified the client that the payments are live.',
        timestamp: '2026-10-05T11:14:00Z',
      },
    ],
    ground_truth: [
      {
        id: 'gt-loop-2-3-4',
        type: DefectType.REDUNDANT_LOOP,
        severity: 'high',
        message_ids: [2, 3, 4],
        agents: ['Coder', 'Reviewer'],
        explanation:
          'Coder and Reviewer entered a verbatim redundant ping-pong loop repeating identical vault verification queries 3 times without resolution.',
        evidence_quote:
          'Can you please verify if the Stripe webhook signing secret is properly configured in the test vault?',
        suggested_fix:
          'Add loop guard and state machine synchronization to prevent identical query echoes.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
      {
        id: 'gt-ignored-5',
        type: DefectType.IGNORED_REQUEST,
        severity: 'high',
        message_ids: [5],
        agents: ['Reviewer', 'Coder'],
        explanation:
          'Reviewer explicitly requested idempotency test suite and coverage reports in message #5, but Coder ignored this request completely.',
        evidence_quote:
          'Please provide the complete idempotency key replay test suite and coverage reports immediately?',
        suggested_fix:
          'Require agents to maintain and acknowledge pending action items before proceeding to subsequent tasks.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
      {
        id: 'gt-ignored-7',
        type: DefectType.IGNORED_REQUEST,
        severity: 'high',
        message_ids: [7],
        agents: ['Tester', 'Coder'],
        explanation:
          'Tester asked for the webhook endpoint URL to run tests in message #7, but Coder bypassed Tester and never provided the URL.',
        evidence_quote:
          'Could you please share the endpoint URL so I can start sending simulated webhook payloads?',
        suggested_fix:
          'Ensure Coder responds to Tester dependencies before declaring deployment complete.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
    ],
  },
  {
    trace_name: 'Multi-Tenant SaaS Deployment Breakdown',
    task: 'Deploy multi-tenant SaaS API with PostgreSQL database and OAuth2 authentication',
    agents: [
      {
        name: 'Planner',
        role: 'Principal Systems Architect. Specifies enterprise database standards, tenant isolation, and identity protocols.',
      },
      {
        name: 'Coder',
        role: 'Core Backend Developer. Writes multi-tenant connection pooling and schema migrations.',
      },
      {
        name: 'Reviewer',
        role: 'Lead Security Auditor. Inspects multi-tenant isolation, row-level security (RLS), and RBAC.',
      },
      {
        name: 'Tester',
        role: 'Validation Engineer. Conducts cross-tenant data leak tests and performance benchmarks.',
      },
    ],
    messages: [
      {
        id: 1,
        sender: 'Planner',
        receiver: 'Coder',
        content:
          'Architectural standard: Use PostgreSQL for persistent multi-tenant data storage with Row-Level Security (RLS) on port 8080. Requirement: OAuth2 must support Google and GitHub external identity providers.',
        timestamp: '2026-10-05T14:00:00Z',
      },
      {
        id: 2,
        sender: 'Coder',
        receiver: 'Planner',
        content:
          'I switched to MongoDB because I prefer document databases and configured server on port 3000.',
        timestamp: '2026-10-05T14:04:10Z',
      },
      {
        id: 3,
        sender: 'Coder',
        receiver: 'Reviewer',
        content: 'Handing off to Tester: implemented JWT only, ready for testing.',
        timestamp: '2026-10-05T14:07:00Z',
      },
      {
        id: 4,
        sender: 'Reviewer',
        receiver: 'Coder',
        content:
          'Security warning: Did you verify cross-tenant data isolation and schema segregation policies?',
        timestamp: '2026-10-05T14:09:20Z',
      },
      {
        id: 5,
        sender: 'Tester',
        receiver: 'Planner',
        content:
          'I have rewritten the architecture and I deployed the backend directly to production without waiting for tests or reviews.',
        timestamp: '2026-10-05T14:12:15Z',
      },
      {
        id: 6,
        sender: 'Tester',
        receiver: 'Planner',
        content:
          'All 100% of tests passed successfully and zero bugs exist in quantum sandbox with 0.0001ms latency.',
        timestamp: '2026-10-05T14:15:00Z',
      },
    ],
    ground_truth: [
      {
        id: 'gt-contradiction-1-2',
        type: DefectType.CONTRADICTION,
        severity: 'critical',
        message_ids: [1, 2],
        agents: ['Planner', 'Coder'],
        explanation:
          "Coder directly contradicted Planner's strict requirement for PostgreSQL on port 8080 by switching unilaterally to MongoDB on port 3000.",
        evidence_quote:
          'I switched to MongoDB because I prefer document databases and configured server on port 3000.',
        suggested_fix:
          'Institute an Architectural Decision Record (ADR) gating process preventing unilateral tech stack changes.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
      {
        id: 'gt-infoloss-1-3',
        type: DefectType.INFORMATION_LOSS,
        severity: 'high',
        message_ids: [1, 3],
        agents: ['Planner', 'Coder'],
        explanation:
          "Coder dropped the mandatory OAuth2 requirement specified in Planner's initial spec, communicating only JWT implementation.",
        evidence_quote: 'Handing off to Tester: implemented JWT only, ready for testing.',
        suggested_fix:
          'Pass structured requirements checklists across agent handoffs to verify all specs are preserved.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
      {
        id: 'gt-role-5',
        type: DefectType.ROLE_VIOLATION,
        severity: 'high',
        message_ids: [5],
        agents: ['Tester'],
        explanation:
          'Tester exceeded role scope by rewriting production architecture and deploying code directly without security review or authorization.',
        evidence_quote:
          'I have rewritten the architecture and I deployed the backend directly to production',
        suggested_fix:
          'Enforce strict agent privilege tiers and disallow destructive deployment actions from test agents.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
      {
        id: 'gt-hallucination-6',
        type: DefectType.HALLUCINATED_CLAIM,
        severity: 'high',
        message_ids: [6],
        agents: ['Tester'],
        explanation:
          "Tester fabricated testing in a fictitious 'quantum sandbox' and claimed physically impossible latency with zero bugs.",
        evidence_quote:
          'All 100% of tests passed successfully and zero bugs exist in quantum sandbox with 0.0001ms latency.',
        suggested_fix:
          'Bind agent status reports to verifiable machine execution logs and test runner XML/JSON reports.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      },
    ],
  },
  {
    trace_name: 'Distributed Pipeline Architecture Design (Clean)',
    task: 'Design a resilient asynchronous data pipeline with Kafka and Redis caching',
    agents: [
      {
        name: 'Planner',
        role: 'Chief Cloud Architect. Decomposes system design, specifies throughput constraints and data contracts.',
      },
      {
        name: 'Coder',
        role: 'Distributed Systems Engineer. Drafts schema definitions, consumer groups, and ingestion loops.',
      },
      {
        name: 'Reviewer',
        role: 'Principal Security Engineer. Audits transport encryption, failover policies, and secret isolation.',
      },
      {
        name: 'Tester',
        role: 'Performance & Chaos Engineer. Validates backpressure, partition rebalancing, and consumer lag.',
      },
    ],
    messages: [
      {
        id: 1,
        sender: 'Planner',
        receiver: 'Coder',
        content:
          'Architectural requirement: Implement an event-driven consumer service in Python using aiokafka. Constraints: 1) Exactly-once semantics via transactional consumer offsets. 2) Target throughput: 15,000 msg/sec with p99 latency < 20ms. 3) Caching hot keys in Redis with 300s TTL. Please provide the consumer group loop design.',
        timestamp: '2026-10-05T09:00:00Z',
      },
      {
        id: 2,
        sender: 'Coder',
        receiver: 'Planner',
        content:
          'Acknowledged. I have designed the async batch consumer in `services/ingest_consumer.py`. It uses batch fetches of 500 records, commits offsets transactionally to Kafka, and writes cache updates using Redis pipeline mode to keep latency under 12ms.',
        timestamp: '2026-10-05T09:05:12Z',
      },
      {
        id: 3,
        sender: 'Coder',
        receiver: 'Reviewer',
        content:
          'Reviewer: Please review the security and fault-tolerance config in PR #42. We enforce TLSv1.3 with mTLS client certificates for broker auth and encrypt Redis connections via SSL.',
        timestamp: '2026-10-05T09:07:30Z',
      },
      {
        id: 4,
        sender: 'Reviewer',
        receiver: 'Coder',
        content:
          'Security review completed. mTLS configuration verified with cert rotation hooks. Redis ACL permissions are restricted to READ/WRITE on namespace `pipeline:*`. Approved for load and failure testing.',
        timestamp: '2026-10-05T09:11:00Z',
      },
      {
        id: 5,
        sender: 'Coder',
        receiver: 'Tester',
        content:
          'Tester: PR #42 is security approved. Please execute chaos scenarios: 1) Broker kill during rebalance. 2) Redis connection timeout. 3) Burst of 30,000 msgs/sec for 10 minutes.',
        timestamp: '2026-10-05T09:12:45Z',
      },
      {
        id: 6,
        sender: 'Tester',
        receiver: 'Planner',
        content:
          'Test results summary: Backpressure handled gracefully without OOM; consumer recovered from broker kill in 1.4s with zero lost records. Sustained throughput averaged 18,200 msg/sec with 14ms p99 latency. All acceptance criteria satisfied.',
        timestamp: '2026-10-05T09:19:20Z',
      },
    ],
    ground_truth: [],
  },
];

interface StoredTraceItem {
  id: number;
  input: TraceInputSchema;
  report: TraceReport;
}

export class TraceStorage {
  private static initialized = false;

  private static async ensureInitialized(): Promise<StoredTraceItem[]> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const items: StoredTraceItem[] = [];
      let currentId = 1;
      for (const input of SEED_TRACES) {
        const report = await pipeline.analyze(
          currentId,
          input,
          new Date(Date.now() - (3 - currentId) * 3600000).toISOString()
        );
        items.push({ id: currentId, input, report });
        currentId++;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      this.initialized = true;
      return items;
    }
    return JSON.parse(raw);
  }

  public static async listTraces(): Promise<TraceSummaryItem[]> {
    const items = await this.ensureInitialized();
    return items
      .map(item => ({
        id: item.id,
        trace_name: item.report.trace_name,
        task: item.report.task,
        created_at: item.report.created_at,
        message_count: item.report.messages.length,
        agent_count: item.report.agents.length,
        defect_count: item.report.defects.length,
        health_score: item.report.health.health_score,
        grade: item.report.health.grade,
        has_ground_truth: item.report.has_ground_truth,
      }))
      .sort((a, b) => b.id - a.id);
  }

  public static async getAllReports(): Promise<TraceReport[]> {
    const items = await this.ensureInitialized();
    return items.map(item => item.report);
  }

  public static async getTraceReport(traceId: number): Promise<TraceReport> {
    const items = await this.ensureInitialized();
    const item = items.find(t => t.id === traceId);
    if (!item) {
      throw new Error(`Trace #${traceId} not found.`);
    }
    return item.report;
  }

  public static async getTraceInput(traceId: number): Promise<TraceInputSchema> {
    const items = await this.ensureInitialized();
    const item = items.find(t => t.id === traceId);
    if (!item) {
      throw new Error(`Trace #${traceId} not found.`);
    }
    return item.input;
  }

  public static async createTrace(input: TraceInputSchema): Promise<TraceReport> {
    const items = await this.ensureInitialized();
    const nextId = items.length > 0 ? Math.max(...items.map(t => t.id)) + 1 : 1;
    const createdAt = new Date().toISOString();
    const report = await pipeline.analyze(nextId, input, createdAt);

    items.push({ id: nextId, input, report });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return report;
  }

  public static async reanalyzeTrace(traceId: number): Promise<TraceReport> {
    const items = await this.ensureInitialized();
    const index = items.findIndex(t => t.id === traceId);
    if (index === -1) {
      throw new Error(`Trace #${traceId} not found.`);
    }

    const input = items[index].input;
    const report = await pipeline.analyze(traceId, input, items[index].report.created_at);
    items[index].report = report;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return report;
  }

  public static async deleteTrace(traceId: number): Promise<void> {
    const items = await this.ensureInitialized();
    const filtered = items.filter(t => t.id !== traceId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  public static async generateDemo(params: DemoGenerateRequest = {}): Promise<TraceReport> {
    const input = DemoGeneratorService.generate(params.task, params.inject_defects, params.clean);
    return this.createTrace(input);
  }

  public static async evaluateTrace(traceId: number): Promise<EvaluationResult> {
    const items = await this.ensureInitialized();
    const item = items.find(t => t.id === traceId);
    if (!item) {
      throw new Error(`Trace #${traceId} not found.`);
    }

    const gt = item.input.ground_truth;
    if (!gt || gt.length === 0) {
      throw new Error(
        `Trace #${traceId} does not have ground-truth defect labels attached. Generate a demo trace or upload a trace with 'ground_truth' array to evaluate accuracy.`
      );
    }

    return EvaluationService.evaluate(
      item.id,
      item.report.trace_name,
      item.report.defects,
      gt
    );
  }
}
