import { DefectSchema, GraphData, HealthScoreBreakdown, Severity } from '../types';

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 18.0,
  high: 10.0,
  medium: 5.0,
  low: 2.0,
};

export class HealthScoringService {
  public static calculate(
    messageCount: number,
    defects: DefectSchema[],
    graphData?: GraphData | null
  ): HealthScoreBreakdown {
    const severityCounts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let rawPenalty = 0.0;
    for (const d of defects) {
      const sev = d.severity as Severity;
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
      rawPenalty += SEVERITY_WEIGHTS[sev] ?? 5.0;
    }

    const effMsgCount = Math.max(messageCount, 1);
    const defectDensity = defects.length / effMsgCount;
    const volumeFactor = 0.6 + 0.4 * Math.min(1.0, defectDensity);
    const scaledDefectPenalty = Math.min(85.0, rawPenalty * volumeFactor);

    // Structural network penalties
    let isolatedPenalty = 0.0;
    let cyclePenalty = 0.0;
    if (graphData) {
      const isolatedCount = graphData.isolated_agents.length;
      isolatedPenalty = Math.min(10.0, isolatedCount * 5.0);
      if (graphData.cycles_detected.length >= 2) {
        cyclePenalty = 5.0;
      }
    }

    const networkPenalties = isolatedPenalty + cyclePenalty;
    const finalScore = Math.max(
      0,
      Math.min(100, Math.round(100.0 - scaledDefectPenalty - networkPenalties))
    );

    let grade = 'F';
    if (finalScore >= 90) grade = 'A';
    else if (finalScore >= 80) grade = 'B';
    else if (finalScore >= 70) grade = 'C';
    else if (finalScore >= 60) grade = 'D';

    const formulaSummary = `100 (base) - ${scaledDefectPenalty.toFixed(1)} (defects: ${defects.length} weighted by severity & density) - ${networkPenalties.toFixed(1)} (structural network penalties) = ${finalScore}/100 [Grade ${grade}]`;

    return {
      health_score: finalScore,
      grade,
      base_score: 100,
      defect_penalties: Number(scaledDefectPenalty.toFixed(1)),
      volume_factor: Number(volumeFactor.toFixed(2)),
      network_penalties: Number(networkPenalties.toFixed(1)),
      defects_by_severity: severityCounts,
      defect_density: Number(defectDensity.toFixed(3)),
      formula_summary: formulaSummary,
    };
  }
}
