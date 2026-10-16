import {
  DefectSchema,
  DefectType,
  Severity,
  TraceInputSchema,
  TraceReport,
} from '../types';
import { RuleBasedDetector } from './rules';
import { LLMJudge } from './llmJudge';
import { GraphService } from './graph';
import { HealthScoringService } from './scoring';

const SEVERITY_ORDER: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class DetectionPipeline {
  private ruleDetector: RuleBasedDetector;
  private llmJudge: LLMJudge;

  constructor() {
    this.ruleDetector = new RuleBasedDetector();
    this.llmJudge = new LLMJudge();
  }

  public async analyze(
    traceId: number,
    traceInput: TraceInputSchema,
    createdAt: string = new Date().toISOString()
  ): Promise<TraceReport> {
    const { agents, messages, task, trace_name, ground_truth } = traceInput;

    // 1. Run rule-based detection
    const ruleDefects = this.ruleDetector.detect(messages, agents);

    // 2. Run LLM judge
    const llmDefects = await this.llmJudge.judgeTrace(task, agents, messages);

    // 3. Merge and deduplicate defects
    const mergedDefects = this.mergeDefects(ruleDefects, llmDefects);

    // 4. Graph analysis
    const graphData = GraphService.analyze(agents, messages, mergedDefects);

    // 5. Health score calculation
    const health = HealthScoringService.calculate(messages.length, mergedDefects, graphData);

    // 6. Aggregations & breakdowns
    const countsByType: Record<string, number> = {};
    for (const t of Object.values(DefectType)) {
      countsByType[t] = 0;
    }
    for (const d of mergedDefects) {
      countsByType[d.type] = (countsByType[d.type] || 0) + 1;
    }

    const countsBySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const d of mergedDefects) {
      countsBySeverity[d.severity] = (countsBySeverity[d.severity] || 0) + 1;
    }

    const countsByAgent: Record<string, number> = {};
    for (const a of agents) {
      countsByAgent[a.name] = 0;
    }
    for (const d of mergedDefects) {
      for (const ag of d.agents) {
        countsByAgent[ag] = (countsByAgent[ag] || 0) + 1;
      }
    }

    // Top issues sorted by severity weight desc, then confidence desc
    const topIssues = [...mergedDefects]
      .sort((a, b) => {
        const diff = (SEVERITY_ORDER[b.severity] || 1) - (SEVERITY_ORDER[a.severity] || 1);
        if (diff !== 0) return diff;
        return b.confidence - a.confidence;
      })
      .slice(0, 6);

    const hasGroundTruth = Boolean(ground_truth && Array.isArray(ground_truth));

    return {
      trace_id: traceId,
      trace_name: trace_name,
      task,
      created_at: createdAt,
      agents,
      messages,
      defects: mergedDefects,
      health,
      graph: graphData,
      defect_counts_by_type: countsByType,
      defect_counts_by_severity: countsBySeverity,
      defect_counts_by_agent: countsByAgent,
      top_issues: topIssues,
      has_ground_truth: hasGroundTruth,
    };
  }

  private mergeDefects(
    ruleDefects: DefectSchema[],
    llmDefects: DefectSchema[]
  ): DefectSchema[] {
    const merged: DefectSchema[] = [];
    const matchedLlmIds = new Set<string>();

    for (const r of ruleDefects) {
      let matchedLlm: DefectSchema | null = null;
      for (const l of llmDefects) {
        if (matchedLlmIds.has(l.id)) continue;

        const sameType = r.type === l.type;
        const overlap =
          r.message_ids.length > 0 && l.message_ids.length > 0
            ? r.message_ids.some(mid => l.message_ids.includes(mid))
            : false;

        if (sameType && overlap) {
          matchedLlm = l;
          break;
        }
      }

      if (matchedLlm) {
        matchedLlmIds.add(matchedLlm.id);
        const sev: Severity =
          (SEVERITY_ORDER[r.severity] || 1) >= (SEVERITY_ORDER[matchedLlm.severity] || 1)
            ? r.severity
            : matchedLlm.severity;

        const explanation = `${matchedLlm.explanation} [Rule check confirmed structural pattern].`;
        const combinedAgents = Array.from(new Set([...r.agents, ...matchedLlm.agents]));
        const combinedMsgs = Array.from(new Set([...r.message_ids, ...matchedLlm.message_ids])).sort(
          (a, b) => a - b
        );

        merged.push({
          id: `hybrid-${r.type.toLowerCase()}-${r.id.slice(-6)}`,
          type: r.type,
          severity: sev,
          message_ids: combinedMsgs,
          agents: combinedAgents,
          explanation,
          evidence_quote: matchedLlm.evidence_quote || r.evidence_quote,
          suggested_fix: matchedLlm.suggested_fix || r.suggested_fix,
          confidence: Math.min(1.0, Math.max(r.confidence, matchedLlm.confidence) + 0.05),
          detected_by: 'hybrid',
        });
      } else {
        merged.push(r);
      }
    }

    for (const l of llmDefects) {
      if (!matchedLlmIds.has(l.id)) {
        merged.push(l);
      }
    }

    return merged;
  }
}
