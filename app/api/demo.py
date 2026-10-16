"""API endpoint to generate simulated multi-agent system traces."""
import json
import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TraceModel, MessageModel, DefectModel
from app.schemas import DemoGenerateRequest, TraceReport
from app.services.demo_generator import DemoGeneratorService
from app.services.pipeline import DetectionPipeline

logger = logging.getLogger("agentlens.api.demo")
router = APIRouter(prefix="/demo", tags=["Demo"])
pipeline = DetectionPipeline()


@router.post("/generate", response_model=TraceReport, status_code=status.HTTP_201_CREATED)
async def generate_demo_trace(
    request: DemoGenerateRequest = None,
    db: Session = Depends(get_db),
):
    """Generate a realistic simulated multi-agent conversation trace with ground-truth defect labels."""
    req = request or DemoGenerateRequest()
    trace_input = DemoGeneratorService.generate(
        task=req.task,
        inject_defects=req.inject_defects,
        clean=req.clean or False,
    )

    # 1. Create trace record in DB
    trace_rec = TraceModel(
        trace_name=trace_input.trace_name,
        task=trace_input.task,
        raw_json=json.dumps(trace_input.model_dump()),
    )
    db.add(trace_rec)
    db.flush()

    # 2. Add message records
    for m in trace_input.messages:
        msg_rec = MessageModel(
            trace_id=trace_rec.id,
            msg_id=m.id,
            sender=m.sender,
            receiver=m.receiver,
            content=m.content,
            timestamp=m.timestamp or "",
        )
        db.add(msg_rec)

    db.commit()
    db.refresh(trace_rec)

    # 3. Run analysis pipeline
    report = await pipeline.analyze(
        trace_id=trace_rec.id,
        trace_input=trace_input,
        created_at=trace_rec.created_at.isoformat() if trace_rec.created_at else "",
    )

    # 4. Save analysis results
    trace_rec.health_score = report.health.health_score
    trace_rec.grade = report.health.grade
    trace_rec.graph_data_json = json.dumps(report.graph.model_dump(by_alias=True))
    trace_rec.health_json = json.dumps(report.health.model_dump())

    for d in report.defects:
        defect_rec = DefectModel(
            id=d.id,
            trace_id=trace_rec.id,
            defect_type=d.type.value,
            severity=d.severity.value,
            message_ids_json=json.dumps(d.message_ids),
            agents_json=json.dumps(d.agents),
            explanation=d.explanation,
            evidence_quote=d.evidence_quote,
            suggested_fix=d.suggested_fix,
            confidence=d.confidence,
            detected_by=d.detected_by,
        )
        db.add(defect_rec)

    db.commit()
    db.refresh(trace_rec)

    return report
