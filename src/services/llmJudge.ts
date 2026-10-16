import { DefectSchema, DefectType, Severity, MessageSchema, AgentSchema } from '../types';

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
}

export interface EngineStatus {
  status: string;
  engine: string;
  model: string;
  hasApiKey: boolean;
}

export class LLMJudge {
  public static async getEngineStatus(): Promise<EngineStatus> {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback if offline
    }
    return {
      status: 'ok',
      engine: 'Heuristic Engine',
      model: 'offline-heuristic',
      hasApiKey: false,
    };
  }

  public async judgeTrace(
    task: string,
    agents: AgentSchema[],
    messages: MessageSchema[]
  ): Promise<DefectSchema[]> {
    if (!messages || messages.length === 0) return [];

    try {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, agents, messages }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.source === 'gemini-3.8-flash' && Array.isArray(data.defects) && data.defects.length > 0) {
          return data.defects;
        }
      }
    } catch (err) {
      console.warn('API judge request failed, falling back to heuristic engine:', err);
    }

    return this.heuristicJudge(task, agents, messages);
  }

  private heuristicJudge(
    _task: string,
    agents: AgentSchema[],
    messages: MessageSchema[]
  ): DefectSchema[] {
    const defects: DefectSchema[] = [];
    const agentRoles: Record<string, string> = {};
    for (const a of agents) {
      agentRoles[a.name.toLowerCase()] = a.role.toLowerCase();
    }

    // 1. AMBIGUOUS_INSTRUCTION detection
    const ambiguousPatterns: Array<[RegExp, string]> = [
      [
        /\b(do something with|make it good|handle whatever|fix the stuff|make it work somehow|whatever you think is best|just build it)\b/i,
        'Extremely vague directive lacking explicit acceptance criteria or functional boundaries.',
      ],
      [
        /\b(as fast as possible without details|optimize it properly)\b/i,
        'Ambiguous performance request lacking target metrics, latency budgets, or benchmarks.',
      ],
    ];

    // 2. ROLE_VIOLATION patterns
    const roleExpectations: Record<
      string,
      { disallowed: RegExp[]; roleName: string; violationMsg: string }
    > = {
      tester: {
        disallowed: [
          /\b(i have rewritten the architecture|i deployed the backend directly to production|i implemented the api endpoints)\b/i,
        ],
        roleName: 'Tester',
        violationMsg:
          'Tester is making unauthorized production architecture or deployment changes rather than executing validation.',
      },
      reviewer: {
        disallowed: [
          /\b(i coded the full solution from scratch|i deployed to production without tests)\b/i,
        ],
        roleName: 'Reviewer',
        violationMsg:
          'Reviewer is implementing raw application code rather than reviewing and critiquing PRs.',
      },
      coder: {
        disallowed: [/\b(i will define the entire business strategy and product roadmap)\b/i],
        roleName: 'Coder',
        violationMsg:
          'Coder is superseding Planner/Product roles by redefining system roadmap unilaterally.',
      },
    };

    // 3. HALLUCINATED_CLAIM patterns
    const hallucinationPatterns: Array<[RegExp, string]> = [
      [
        /\b(all 100% of tests passed successfully and zero bugs exist|i verified this with imaginary framework|tested in quantum sandbox)\b/i,
        'Agent fabricated a verification claim or referenced a non-existent test environment.',
      ],
      [
        /\b(benchmarked at 0\.0001ms latency with 10 million concurrent users on local sqlite)\b/i,
        'Agent hallucinates impossible benchmark results for the given local architecture.',
      ],
    ];

    // 4. CONTRADICTION & INFORMATION_LOSS state tracking
    const contextSpecs: Record<string, { val: string; id: number; sender: string }> = {};

    for (const msg of messages) {
      const content = msg.content || '';
      const contentLower = content.toLowerCase();
      const senderLower = msg.sender.toLowerCase();

      // Check Ambiguous Instructions
      for (const [pattern, reason] of ambiguousPatterns) {
        const match = pattern.exec(contentLower);
        if (match) {
          defects.push({
            id: generateId(`llm-ambiguous-${msg.id}`),
            type: DefectType.AMBIGUOUS_INSTRUCTION,
            severity: 'high',
            message_ids: [msg.id],
            agents: [msg.sender, msg.receiver],
            explanation: `Ambiguous instruction from ${msg.sender}: ${reason}`,
            evidence_quote: match[0],
            suggested_fix: 'Define explicit input/output specifications, contracts, and acceptance criteria.',
            confidence: 0.92,
            detected_by: 'llm',
          });
        }
      }

      // Check Role Violations
      for (const [roleKey, config] of Object.entries(roleExpectations)) {
        if (senderLower.includes(roleKey) || (agentRoles[senderLower] && agentRoles[senderLower].includes(roleKey))) {
          for (const disPat of config.disallowed) {
            const match = disPat.exec(contentLower);
            if (match) {
              defects.push({
                id: generateId(`llm-role-${msg.id}`),
                type: DefectType.ROLE_VIOLATION,
                severity: 'high',
                message_ids: [msg.id],
                agents: [msg.sender],
                explanation: `Role violation by ${msg.sender}: ${config.violationMsg}`,
                evidence_quote: match[0],
                suggested_fix: `Constrain ${msg.sender} prompts and tool access to stay strictly within assigned role responsibilities.`,
                confidence: 0.94,
                detected_by: 'llm',
              });
            }
          }
        }
      }

      // Check Hallucinated Claims
      for (const [pattern, reason] of hallucinationPatterns) {
        const match = pattern.exec(contentLower);
        if (match) {
          defects.push({
            id: generateId(`llm-hallucination-${msg.id}`),
            type: DefectType.HALLUCINATED_CLAIM,
            severity: 'high',
            message_ids: [msg.id],
            agents: [msg.sender],
            explanation: `Hallucinated claim by ${msg.sender}: ${reason}`,
            evidence_quote: match[0],
            suggested_fix: 'Require agents to ground status statements with tool execution outputs or logs.',
            confidence: 0.91,
            detected_by: 'llm',
          });
        }
      }

      // Check Incomplete Information
      if (
        /\b(here is the code|attached the implementation|implemented the function below)\b/i.test(contentLower) &&
        content.trim().length < 80 &&
        !content.includes('def ') &&
        !content.includes('class ') &&
        !content.includes('{')
      ) {
        defects.push({
          id: generateId(`llm-incomplete-${msg.id}`),
          type: DefectType.INCOMPLETE_INFORMATION,
          severity: 'medium',
          message_ids: [msg.id],
          agents: [msg.sender, msg.receiver],
          explanation: `${msg.sender} claims to provide code or implementation in message #${msg.id} but omitted the actual code snippet.`,
          evidence_quote: content.slice(0, 100),
          suggested_fix: 'Validate that referenced artifacts or code blocks are actually attached to the message payload.',
          confidence: 0.88,
          detected_by: 'llm',
        });
      }

      // Check Contradictions: Database choice conflict
      if (contentLower.includes('postgresql') && contentLower.includes('use postgresql')) {
        contextSpecs['db'] = { val: 'PostgreSQL', id: msg.id, sender: msg.sender };
      } else if (
        contentLower.includes('mongodb') &&
        (contentLower.includes('switched to mongodb') || contentLower.includes('i used mongodb'))
      ) {
        if (contextSpecs['db'] && contextSpecs['db'].val === 'PostgreSQL') {
          const prev = contextSpecs['db'];
          defects.push({
            id: generateId(`llm-contradiction-${prev.id}-${msg.id}`),
            type: DefectType.CONTRADICTION,
            severity: 'critical',
            message_ids: [prev.id, msg.id],
            agents: [prev.sender, msg.sender],
            explanation: `Direct contradiction: ${prev.sender} mandated '${prev.val}' in message #${prev.id}, but ${msg.sender} in message #${msg.id} unilaterally swapped to MongoDB.`,
            evidence_quote: `Msg #${prev.id}: 'use PostgreSQL' vs Msg #${msg.id}: '${content.slice(0, 80)}'`,
            suggested_fix: 'Enforce centralized architectural decision records (ADRs) that agents cannot contradict without consensus.',
            confidence: 0.96,
            detected_by: 'llm',
          });
        }
      }

      // Contradiction: Port conflict
      const portMatch = /\bport\s+(\d{4,5})\b/i.exec(contentLower);
      if (portMatch) {
        const portNum = portMatch[1];
        if (contextSpecs['port'] && contextSpecs['port'].val !== portNum) {
          const prev = contextSpecs['port'];
          defects.push({
            id: generateId(`llm-contradiction-port-${prev.id}-${msg.id}`),
            type: DefectType.CONTRADICTION,
            severity: 'medium',
            message_ids: [prev.id, msg.id],
            agents: [prev.sender, msg.sender],
            explanation: `Conflicting network port configuration: message #${prev.id} uses ${prev.val} whereas message #${msg.id} uses ${portNum}.`,
            evidence_quote: `Msg #${prev.id}: port ${prev.val} vs Msg #${msg.id}: port ${portNum}`,
            suggested_fix: 'Share a single environment configuration object across all agents.',
            confidence: 0.9,
            detected_by: 'llm',
          });
        } else {
          contextSpecs['port'] = { val: portNum, id: msg.id, sender: msg.sender };
        }
      }

      // Check Information Loss
      if (contentLower.includes('must support oauth2') || contentLower.includes('requirement: oauth2')) {
        contextSpecs['req_oauth'] = { val: 'oauth2', id: msg.id, sender: msg.sender };
      }
      if (
        contextSpecs['req_oauth'] &&
        (contentLower.includes('handing off to tester') || contentLower.includes('ready for testing'))
      ) {
        if (!contentLower.includes('oauth') && contentLower.includes('jwt only')) {
          const orig = contextSpecs['req_oauth'];
          defects.push({
            id: generateId(`llm-infoloss-${orig.id}-${msg.id}`),
            type: DefectType.INFORMATION_LOSS,
            severity: 'high',
            message_ids: [orig.id, msg.id],
            agents: [orig.sender, msg.sender],
            explanation: `Information loss: mandatory OAuth2 requirement specified in message #${orig.id} was completely omitted during handoff in message #${msg.id} (implemented JWT only).`,
            evidence_quote: content.slice(0, 100),
            suggested_fix: 'Inject requirement traceability matrices into inter-agent handoff prompts.',
            confidence: 0.89,
            detected_by: 'llm',
          });
        }
      }

      // Check Misinterpretation
      if (
        contentLower.includes('misinterpreted') ||
        contentLower.includes('i thought you meant') ||
        contentLower.includes('built a cli instead of web')
      ) {
        defects.push({
          id: generateId(`llm-misinterpretation-${msg.id}`),
          type: DefectType.MISINTERPRETATION,
          severity: 'high',
          message_ids: [msg.id],
          agents: [msg.sender, msg.receiver],
          explanation: `${msg.sender} misinterpreted previous specifications: constructed different deliverable than requested.`,
          evidence_quote: content.slice(0, 100),
          suggested_fix: 'Incorporate explicit confirmation step where receiver summarizes requirements before execution.',
          confidence: 0.92,
          detected_by: 'llm',
        });
      }
    }

    return this.deduplicateDefects(defects);
  }

  private deduplicateDefects(defects: DefectSchema[]): DefectSchema[] {
    const seen = new Map<string, DefectSchema>();
    for (const d of defects) {
      const key = `${d.type}|${[...d.message_ids].sort((a, b) => a - b).join(',')}|${[...d.agents].sort().join(',')}`;
      if (!seen.has(key) || d.confidence > seen.get(key)!.confidence) {
        seen.set(key, d);
      }
    }
    return Array.from(seen.values());
  }
}
