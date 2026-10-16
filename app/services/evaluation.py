"""Evaluation service to benchmark detector accuracy against ground truth."""
from typing import List, Dict, Set, Tuple, Any
from app.schemas import (
    DefectSchema,
    DefectType,
    EvaluationResult,
    EvaluationTypeMetrics,
)


class EvaluationService:
    """Evaluates detected defects against ground truth labels."""

    @classmethod
    def evaluate(
        cls,
        trace_id: int,
        trace_name: str,
        detected_defects: List[DefectSchema],
        ground_truth_defects: List[DefectSchema],
    ) -> EvaluationResult:
        all_defect_types = [t.value for t in DefectType]

        matched_gt_ids: Set[str] = set()
        matched_det_ids: Set[str] = set()
        tp_matches: List[Dict[str, Any]] = []

        # Confusion matrix: ground_truth_type -> {detected_type -> count}
        confusion_matrix: Dict[str, Dict[str, int]] = {
            gt_t: {det_t: 0 for det_t in all_defect_types} for gt_t in all_defect_types
        }

        # Match detected with ground truth based on DefectType and overlapping message_ids
        for det in detected_defects:
            for gt in ground_truth_defects:
                if gt.id in matched_gt_ids:
                    continue

                if cls._is_match(det, gt):
                    matched_gt_ids.add(gt.id)
                    matched_det_ids.add(det.id)
                    tp_matches.append({
                        "ground_truth_id": gt.id,
                        "detected_id": det.id,
                        "defect_type": gt.type.value,
                        "message_ids": list(set(gt.message_ids) | set(det.message_ids)),
                        "confidence": det.confidence,
                    })

                    gt_type = gt.type.value
                    det_type = det.type.value
                    if gt_type in confusion_matrix and det_type in confusion_matrix[gt_type]:
                        confusion_matrix[gt_type][det_type] += 1
                    break

        # Tally counts
        total_tp = len(matched_gt_ids)
        total_fp = len(detected_defects) - len(matched_det_ids)
        total_fn = len(ground_truth_defects) - len(matched_gt_ids)

        overall_precision = round(total_tp / (total_tp + total_fp), 3) if (total_tp + total_fp) > 0 else 1.0
        overall_recall = round(total_tp / (total_tp + total_fn), 3) if (total_tp + total_fn) > 0 else 1.0
        overall_f1 = (
            round((2 * overall_precision * overall_recall) / (overall_precision + overall_recall), 3)
            if (overall_precision + overall_recall) > 0
            else 0.0
        )

        # Per defect type breakdown
        per_type_metrics: List[EvaluationTypeMetrics] = []
        for dtype in all_defect_types:
            gt_for_type = [g for g in ground_truth_defects if g.type.value == dtype]
            det_for_type = [d for d in detected_defects if d.type.value == dtype]

            type_tp = sum(1 for m in tp_matches if m["defect_type"] == dtype)
            type_fp = len(det_for_type) - type_tp
            type_fn = len(gt_for_type) - type_tp

            # Bound values to avoid negative counts if multiple detected matched
            type_fp = max(0, type_fp)
            type_fn = max(0, type_fn)

            prec = round(type_tp / (type_tp + type_fp), 3) if (type_tp + type_fp) > 0 else (1.0 if not gt_for_type and not det_for_type else 0.0)
            rec = round(type_tp / (type_tp + type_fn), 3) if (type_tp + type_fn) > 0 else (1.0 if not gt_for_type else 0.0)
            f1 = round((2 * prec * rec) / (prec + rec), 3) if (prec + rec) > 0 else 0.0

            per_type_metrics.append(
                EvaluationTypeMetrics(
                    defect_type=dtype,
                    true_positives=type_tp,
                    false_positives=type_fp,
                    false_negatives=type_fn,
                    precision=prec,
                    recall=rec,
                    f1_score=f1,
                    ground_truth_count=len(gt_for_type),
                    detected_count=len(det_for_type),
                )
            )

        false_positives = [d for d in detected_defects if d.id not in matched_det_ids]
        false_negatives = [g for g in ground_truth_defects if g.id not in matched_gt_ids]

        return EvaluationResult(
            trace_id=trace_id,
            trace_name=trace_name,
            overall_precision=overall_precision,
            overall_recall=overall_recall,
            overall_f1=overall_f1,
            total_ground_truth=len(ground_truth_defects),
            total_detected=len(detected_defects),
            total_true_positives=total_tp,
            total_false_positives=total_fp,
            total_false_negatives=total_fn,
            per_type_metrics=per_type_metrics,
            confusion_matrix=confusion_matrix,
            false_positives=false_positives,
            false_negatives=false_negatives,
            true_positive_matches=tp_matches,
        )

    @staticmethod
    def _is_match(detected: DefectSchema, ground_truth: DefectSchema) -> bool:
        """Determines if a detected defect matches a ground truth defect."""
        if detected.type != ground_truth.type:
            return False

        # If both specify message IDs, check for intersection
        det_msgs = set(detected.message_ids)
        gt_msgs = set(ground_truth.message_ids)

        if det_msgs and gt_msgs:
            if det_msgs & gt_msgs:
                return True
            # Also allow close proximity (+- 1 message turn for fuzzy timing in sliding windows)
            for dm in det_msgs:
                for gm in gt_msgs:
                    if abs(dm - gm) <= 1:
                        return True
            return False

        # Fallback to agents involved if message IDs empty
        det_agents = {a.lower() for a in detected.agents}
        gt_agents = {a.lower() for a in ground_truth.agents}
        if det_agents and gt_agents and (det_agents & gt_agents):
            return True

        return True
