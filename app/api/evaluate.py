"""API endpoint for evaluating detector accuracy against ground-truth labels."""
import json
import logging
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TraceModel, EvaluationModel
from app.schemas import (
    DefectSchema,
    EvaluationResult,
)
from app.services.evaluation import EvaluationService

logger = logging.getLogger("agentlens.api.evaluate")
router = APIRouter(prefix="/evaluate", tags=["Evaluation"])


class EvaluatePayload(BaseModel):
    trace_id: int = Field(..., description="ID of trace containing ground-truth labels")


@router.post("", response_model=EvaluationResult)
def evaluate_trace(
    payload: Optional[EvaluatePayload] = None,
    trace_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Compare detected defects against ground-truth labels.
    Computes precision, recall, F1 overall and per defect type, and confusion matrix."""
    tid = None
    if payload and payload.trace_id:
        tid = payload.trace_id
    elif trace_id:
        tid = trace_id

    if not tid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide trace_id in request body or query parameter.",
        )

    rec = db.query(TraceModel).filter(TraceModel.id == tid).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace #{tid} not found.")

    raw_data = json.loads(rec.raw_json)
    raw_gt = raw_data.get("ground_truth", [])

    if not raw_gt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trace #{tid} does not have ground-truth defect labels attached. Generate a demo trace or upload a trace with 'ground_truth' array to evaluate accuracy.",
        )

    ground_truth_defects = [DefectSchema(**g) for g in raw_gt]

    detected_defects = [
        DefectSchema(
            id=d.id,
            type=d.defect_type,
            severity=d.severity,
            message_ids=d.message_ids,
            agents=d.agents,
            explanation=d.explanation,
            evidence_quote=d.evidence_quote,
            suggested_fix=d.suggested_fix,
            confidence=d.confidence,
            detected_by=d.detected_by,
        )
        for d in rec.defects
    ]

    result = EvaluationService.evaluate(
        trace_id=rec.id,
        trace_name=rec.trace_name,
        detected_defects=detected_defects,
        ground_truth_defects=ground_truth_defects,
    )

    # Persist evaluation record
    eval_rec = EvaluationModel(
        trace_id=rec.id,
        overall_precision=result.overall_precision,
        overall_recall=result.overall_recall,
        overall_f1=result.overall_f1,
        metrics_json=json.dumps(result.model_dump()),
    )
    db.add(eval_rec)
    db.commit()

    return result
