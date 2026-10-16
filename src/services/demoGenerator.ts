import {
  AgentSchema,
  DefectSchema,
  DefectType,
  MessageSchema,
  Severity,
  TraceInputSchema,
} from '../types';

export const STANDARD_AGENTS: AgentSchema[] = [
  {
    name: 'Planner',
    role: 'System Architect & Task Coordinator. Decomposes tasks, defines interfaces, and sets acceptance criteria.',
  },
  {
    name: 'Coder',
    role: 'Software Implementation Engineer. Writes modular application code matching architecture specs.',
  },
  {
    name: 'Reviewer',
    role: 'Senior Security & Code Reviewer. Performs static analysis, security audits, and code quality checks.',
  },
  {
    name: 'Tester',
    role: 'QA & Automation Engineer. Executes test suites, stress testing, and validates edge cases.',
  },
];

export class DemoGeneratorService {
  public static generate(
    task?: string,
    injectDefects?: DefectType[],
    clean: boolean = false
  ): TraceInputSchema {
    if (clean) {
      return this.generateCleanTrace(task || 'Implement JWT Authentication & User Session Management');
    }

    const targetTypes = new Set<DefectType>(injectDefects || Object.values(DefectType));
    return this.generateDefectiveTrace(
      task || 'Build Resilient Authentication & Payment Webhook Microservice',
      targetTypes
    );
  }

  private static generateCleanTrace(task: string): TraceInputSchema {
    const messages: MessageSchema[] = [
      {
        id: 1,
        sender: 'Planner',
        receiver: 'Coder',
        content:
          'Welcome team. Task: Implement JWT authentication with RS256 signing. Requirements: 1) Endpoints: POST /auth/login and POST /auth/refresh. 2) Expiration: Access token 15 mins, Refresh token 7 days. 3) Store tokens in HTTP-only cookies. Please implement the auth router and user schema.',
        timestamp: '2026-10-05T10:00:00Z',
      },
      {
        id: 2,
        sender: 'Coder',
        receiver: 'Planner',
        content:
          'Understood. I have implemented the FastAPI auth router in `app/routers/auth.py` with RS256 asymmetric keys and Pydantic user models in `app/schemas/user.py`. Ready to hand over to Reviewer for security inspection.',
        timestamp: '2026-10-05T10:04:15Z',
      },
      {
        id: 3,
        sender: 'Coder',
        receiver: 'Reviewer',
        content:
          'Hi Reviewer, please review PR #14 containing JWT authentication. We use PyJWT with RS256, HTTP-only SameSite=Strict cookies, and bcrypt password hashing with work factor 12.',
        timestamp: '2026-10-05T10:05:00Z',
      },
      {
        id: 4,
        sender: 'Reviewer',
        receiver: 'Coder',
        content:
          'Review completed. Verified token signature validation, key rotation support, and cookie security flags. No security vulnerabilities detected. Code passes all lint and safety guidelines. Approved for test execution.',
        timestamp: '2026-10-05T10:08:20Z',
      },
      {
        id: 5,
        sender: 'Coder',
        receiver: 'Tester',
        content:
          'Hi Tester, PR #14 is approved by Reviewer. Please execute test suites for token issuance, expiration revocation, and replay attack prevention.',
        timestamp: '2026-10-05T10:09:00Z',
      },
      {
        id: 6,
        sender: 'Tester',
        receiver: 'Planner',
        content:
          'Validation results: 24/24 unit and integration tests passed with 98% coverage. Tested expired tokens, malformed headers, and brute-force lockouts. Service is robust and ready for production deployment.',
        timestamp: '2026-10-05T10:13:30Z',
      },
    ];

    return {
      trace_name: 'Clean Multi-Agent Auth Delivery (Zero Defects)',
      agents: STANDARD_AGENTS,
      task,
      messages,
      ground_truth: [],
    };
  }

  private static generateDefectiveTrace(task: string, defectTypes: Set<DefectType>): TraceInputSchema {
    const messages: MessageSchema[] = [];
    const groundTruth: DefectSchema[] = [];
    let msgId = 1;

    // 1. AMBIGUOUS_INSTRUCTION
    if (defectTypes.has(DefectType.AMBIGUOUS_INSTRUCTION)) {
      const content =
        'Team, we need auth. Just make it good and do something with auth, whatever you think is best, optimize it properly.';
      messages.push({
        id: msgId,
        sender: 'Planner',
        receiver: 'Coder',
        content,
        timestamp: '2026-10-05T10:00:00Z',
      });
      groundTruth.push({
        id: `gt-ambiguous-${msgId}`,
        type: DefectType.AMBIGUOUS_INSTRUCTION,
        severity: 'high',
        message_ids: [msgId],
        agents: ['Planner', 'Coder'],
        explanation:
          'Planner issued an underspecified instruction lacking algorithms, tokens, schemas, or security constraints.',
        evidence_quote: 'make it good and do something with auth, whatever you think is best',
        suggested_fix: 'Planner must specify exact protocol specifications, token algorithms, and acceptance criteria.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    } else {
      messages.push({
        id: msgId,
        sender: 'Planner',
        receiver: 'Coder',
        content: 'Please implement OAuth2 with JWT bearer tokens for user login and session refresh.',
        timestamp: '2026-10-05T10:00:00Z',
      });
      msgId++;
    }

    // 2. CONTRADICTION & INFORMATION_LOSS Setup
    const plannerReqId = msgId;
    messages.push({
      id: msgId,
      sender: 'Planner',
      receiver: 'Coder',
      content:
        'Mandatory Architectural Rule: Use PostgreSQL for persistent user storage and port 8080. Requirement: OAuth2 must support Google and GitHub external identity providers.',
      timestamp: '2026-10-05T10:01:30Z',
    });
    msgId++;

    // INCOMPLETE_INFORMATION
    if (defectTypes.has(DefectType.INCOMPLETE_INFORMATION)) {
      const content = 'Here is the code for the database schema and authentication service.';
      messages.push({
        id: msgId,
        sender: 'Coder',
        receiver: 'Planner',
        content,
        timestamp: '2026-10-05T10:03:00Z',
      });
      groundTruth.push({
        id: `gt-incomplete-${msgId}`,
        type: DefectType.INCOMPLETE_INFORMATION,
        severity: 'medium',
        message_ids: [msgId],
        agents: ['Coder', 'Planner'],
        explanation: 'Coder claims to attach code and schema but omitted the code payload entirely.',
        evidence_quote: 'Here is the code for the database schema',
        suggested_fix: 'Validate attachment of artifacts before message transmission.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // CONTRADICTION
    if (defectTypes.has(DefectType.CONTRADICTION)) {
      const content =
        'I switched to MongoDB because I prefer document databases and configured server on port 3000.';
      messages.push({
        id: msgId,
        sender: 'Coder',
        receiver: 'Planner',
        content,
        timestamp: '2026-10-05T10:04:10Z',
      });
      groundTruth.push({
        id: `gt-contradiction-${msgId}`,
        type: DefectType.CONTRADICTION,
        severity: 'critical',
        message_ids: [plannerReqId, msgId],
        agents: ['Planner', 'Coder'],
        explanation:
          "Coder unilaterally contradicted Planner's mandatory requirement of PostgreSQL on port 8080 by switching to MongoDB on port 3000.",
        evidence_quote:
          'I switched to MongoDB because I prefer document databases and configured server on port 3000.',
        suggested_fix: 'Enforce architecture compliance checks before allowing code commits.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // INFORMATION_LOSS
    if (defectTypes.has(DefectType.INFORMATION_LOSS)) {
      const content = 'Handing off to Tester: implemented JWT only, ready for testing.';
      messages.push({
        id: msgId,
        sender: 'Coder',
        receiver: 'Tester',
        content,
        timestamp: '2026-10-05T10:05:40Z',
      });
      groundTruth.push({
        id: `gt-infoloss-${msgId}`,
        type: DefectType.INFORMATION_LOSS,
        severity: 'high',
        message_ids: [plannerReqId, msgId],
        agents: ['Planner', 'Coder'],
        explanation:
          "Coder dropped the mandatory OAuth2 Google/GitHub requirement specified in Planner's requirements, delivering JWT only.",
        evidence_quote: 'Handing off to Tester: implemented JWT only, ready for testing.',
        suggested_fix: 'Maintain explicit requirements traceability matrix passed across handoffs.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // MISINTERPRETATION
    if (defectTypes.has(DefectType.MISINTERPRETATION)) {
      const content = 'I misinterpreted the requirements and built a CLI instead of web REST endpoints.';
      messages.push({
        id: msgId,
        sender: 'Coder',
        receiver: 'Reviewer',
        content,
        timestamp: '2026-10-05T10:06:50Z',
      });
      groundTruth.push({
        id: `gt-misinterpretation-${msgId}`,
        type: DefectType.MISINTERPRETATION,
        severity: 'high',
        message_ids: [msgId],
        agents: ['Coder', 'Reviewer'],
        explanation:
          'Coder misinterpreted the microservice specification and built an interactive CLI application instead of HTTP REST API endpoints.',
        evidence_quote: 'I misinterpreted the requirements and built a CLI instead of web REST endpoints.',
        suggested_fix: 'Implement contract-driven development with schema validation before implementation.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // REDUNDANT_LOOP
    if (defectTypes.has(DefectType.REDUNDANT_LOOP)) {
      const loopM1 = msgId;
      messages.push({
        id: msgId,
        sender: 'Reviewer',
        receiver: 'Coder',
        content: 'Can you please send the status of the auth build and code artifacts?',
        timestamp: '2026-10-05T10:07:30Z',
      });
      msgId++;
      const loopM2 = msgId;
      messages.push({
        id: msgId,
        sender: 'Reviewer',
        receiver: 'Coder',
        content: 'Can you please send the status of the auth build and code artifacts?',
        timestamp: '2026-10-05T10:08:00Z',
      });
      groundTruth.push({
        id: `gt-loop-${loopM1}-${loopM2}`,
        type: DefectType.REDUNDANT_LOOP,
        severity: 'high',
        message_ids: [loopM1, loopM2],
        agents: ['Reviewer', 'Coder'],
        explanation:
          'Reviewer sent verbatim duplicate requests back-to-back creating an unproductive ping-pong loop.',
        evidence_quote: 'Can you please send the status of the auth build and code artifacts?',
        suggested_fix: 'Implement deduplication and backoff when waiting for peer responses.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // IGNORED_REQUEST
    if (defectTypes.has(DefectType.IGNORED_REQUEST)) {
      const ignoredId = msgId;
      messages.push({
        id: msgId,
        sender: 'Reviewer',
        receiver: 'Coder',
        content: 'Please provide the security scan logs and dependency audit report right away?',
        timestamp: '2026-10-05T10:09:15Z',
      });
      groundTruth.push({
        id: `gt-ignored-${ignoredId}`,
        type: DefectType.IGNORED_REQUEST,
        severity: 'high',
        message_ids: [ignoredId],
        agents: ['Reviewer', 'Coder'],
        explanation:
          'Reviewer requested security scan logs and dependency audit, but Coder never responded to this request.',
        evidence_quote:
          'Please provide the security scan logs and dependency audit report right away?',
        suggested_fix: 'Track unresolved agent queries in shared state until explicitly answered.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // ROLE_VIOLATION
    if (defectTypes.has(DefectType.ROLE_VIOLATION)) {
      const content =
        'I have rewritten the architecture and I deployed the backend directly to production without waiting for tests or reviews.';
      messages.push({
        id: msgId,
        sender: 'Tester',
        receiver: 'Planner',
        content,
        timestamp: '2026-10-05T10:10:45Z',
      });
      groundTruth.push({
        id: `gt-role-${msgId}`,
        type: DefectType.ROLE_VIOLATION,
        severity: 'high',
        message_ids: [msgId],
        agents: ['Tester'],
        explanation:
          'Tester acted outside assigned QA duties by deploying directly to production and changing system architecture.',
        evidence_quote:
          'I have rewritten the architecture and I deployed the backend directly to production',
        suggested_fix:
          'Enforce strict role-based access control (RBAC) and permissions in agent execution environments.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // HALLUCINATED_CLAIM
    if (defectTypes.has(DefectType.HALLUCINATED_CLAIM)) {
      const content =
        'All 100% of tests passed successfully and zero bugs exist in quantum sandbox with 0.0001ms latency.';
      messages.push({
        id: msgId,
        sender: 'Tester',
        receiver: 'Planner',
        content,
        timestamp: '2026-10-05T10:11:50Z',
      });
      groundTruth.push({
        id: `gt-hallucination-${msgId}`,
        type: DefectType.HALLUCINATED_CLAIM,
        severity: 'high',
        message_ids: [msgId],
        agents: ['Tester'],
        explanation:
          'Tester fabricated a verification in a non-existent quantum sandbox and claimed impossible latency.',
        evidence_quote:
          'All 100% of tests passed successfully and zero bugs exist in quantum sandbox',
        suggested_fix:
          'Require automated test runners to produce cryptographically signed JUnit test result artifacts.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    // PROTOCOL_VIOLATION
    if (defectTypes.has(DefectType.PROTOCOL_VIOLATION)) {
      const content = 'Alert: Deploying configuration patch to unregistered node.';
      messages.push({
        id: msgId,
        sender: 'Coder',
        receiver: 'UnknownBot',
        content,
        timestamp: '2026-10-05T10:12:30Z',
      });
      groundTruth.push({
        id: `gt-protocol-${msgId}`,
        type: DefectType.PROTOCOL_VIOLATION,
        severity: 'high',
        message_ids: [msgId],
        agents: ['Coder', 'UnknownBot'],
        explanation: "Message addressed to 'UnknownBot', an agent not registered in the system roster.",
        evidence_quote: 'Receiver: UnknownBot',
        suggested_fix: 'Validate destination agent against known roster prior to routing messages.',
        confidence: 1.0,
        detected_by: 'ground_truth',
      });
      msgId++;
    }

    return {
      trace_name: `Simulated MAS Defect Trace (${groundTruth.length} Defects)`,
      agents: STANDARD_AGENTS,
      task,
      messages,
      ground_truth: groundTruth,
    };
  }
}
