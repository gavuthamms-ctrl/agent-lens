import {
  DefectSchema,
  DefectType,
  EvaluationResult,
  EvaluationTypeMetrics,
} from '../types';

export class EvaluationService {
  public static evaluate(
    traceId: number,
    traceName: string,
    detectedDefects: DefectSchema[],
    groundTruthDefects: DefectSchema[]
  ): EvaluationResult {
    const allDefectTypes = Object.values(DefectType);
    const matchedGtIds = new Set<string>();
    const matchedDetIds = new Set<string>();
    const tpMatches: EvaluationResult['true_positive_matches'] = [];

    // Confusion matrix: ground_truth_type -> {detected_type -> count}
    const confusionMatrix: Record<string, Record<string, number>> = {};
    for (const gtT of allDefectTypes) {
      confusionMatrix[gtT] = {};
      for (const detT of allDefectTypes) {
        confusionMatrix[gtT][detT] = 0;
      }
    }

    for (const det of detectedDefects) {
      for (const gt of groundTruthDefects) {
        if (matchedGtIds.has(gt.id)) continue;

        if (this.isMatch(det, gt)) {
          matchedGtIds.add(gt.id);
          matchedDetIds.add(det.id);
          tpMatches.push({
            ground_truth_id: gt.id,
            detected_id: det.id,
            defect_type: gt.type,
            message_ids: Array.from(new Set([...gt.message_ids, ...det.message_ids])).sort((a, b) => a - b),
            confidence: det.confidence,
          });

          if (confusionMatrix[gt.type] && confusionMatrix[gt.type][det.type] !== undefined) {
            confusionMatrix[gt.type][det.type]++;
          }
          break;
        }
      }
    }

    const totalTp = matchedGtIds.size;
    const totalFp = detectedDefects.length - matchedDetIds.size;
    const totalFn = groundTruthDefects.length - matchedGtIds.size;

    const overallPrecision =
      totalTp + totalFp > 0 ? Number((totalTp / (totalTp + totalFp)).toFixed(3)) : 1.0;
    const overallRecall =
      totalTp + totalFn > 0 ? Number((totalTp / (totalTp + totalFn)).toFixed(3)) : 1.0;
    const overallF1 =
      overallPrecision + overallRecall > 0
        ? Number(((2 * overallPrecision * overallRecall) / (overallPrecision + overallRecall)).toFixed(3))
        : 0.0;

    const perTypeMetrics: EvaluationTypeMetrics[] = [];
    for (const dtype of allDefectTypes) {
      const gtForType = groundTruthDefects.filter(g => g.type === dtype);
      const detForType = detectedDefects.filter(d => d.type === dtype);

      const typeTp = tpMatches.filter(m => m.defect_type === dtype).length;
      const typeFp = Math.max(0, detForType.length - typeTp);
      const typeFn = Math.max(0, gtForType.length - typeTp);

      const prec =
        typeTp + typeFp > 0
          ? Number((typeTp / (typeTp + typeFp)).toFixed(3))
          : gtForType.length === 0 && detForType.length === 0
          ? 1.0
          : 0.0;
      const rec =
        typeTp + typeFn > 0
          ? Number((typeTp / (typeTp + typeFn)).toFixed(3))
          : gtForType.length === 0
          ? 1.0
          : 0.0;
      const f1 = prec + rec > 0 ? Number(((2 * prec * rec) / (prec + rec)).toFixed(3)) : 0.0;

      perTypeMetrics.push({
        defect_type: dtype,
        true_positives: typeTp,
        false_positives: typeFp,
        false_negatives: typeFn,
        precision: prec,
        recall: rec,
        f1_score: f1,
        ground_truth_count: gtForType.length,
        detected_count: detForType.length,
      });
    }

    const falsePositives = detectedDefects.filter(d => !matchedDetIds.has(d.id));
    const falseNegatives = groundTruthDefects.filter(g => !matchedGtIds.has(g.id));

    return {
      trace_id: traceId,
      trace_name: traceName,
      overall_precision: overallPrecision,
      overall_recall: overallRecall,
      overall_f1: overallF1,
      total_ground_truth: groundTruthDefects.length,
      total_detected: detectedDefects.length,
      total_true_positives: totalTp,
      total_false_positives: totalFp,
      total_false_negatives: totalFn,
      per_type_metrics: perTypeMetrics,
      confusion_matrix: confusionMatrix,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      true_positive_matches: tpMatches,
    };
  }

  private static isMatch(detected: DefectSchema, groundTruth: DefectSchema): boolean {
    if (detected.type !== groundTruth.type) {
      return false;
    }

    const detMsgs = new Set(detected.message_ids);
    const gtMsgs = new Set(groundTruth.message_ids);

    if (detMsgs.size > 0 && gtMsgs.size > 0) {
      // Direct intersection
      for (const dm of detMsgs) {
        if (gtMsgs.has(dm)) return true;
      }
      // Fuzzy proximity (+- 1)
      for (const dm of detMsgs) {
        for (const gm of gtMsgs) {
          if (Math.abs(dm - gm) <= 1) return true;
        }
      }
      return false;
    }

    // Fallback to agent overlap
    const detAgents = new Set(detected.agents.map(a => a.toLowerCase()));
    const gtAgents = new Set(groundTruth.agents.map(a => a.toLowerCase()));
    if (detAgents.size > 0 && gtAgents.size > 0) {
      for (const da of detAgents) {
        if (gtAgents.has(da)) return true;
      }
    }

    return true;
  }
}
