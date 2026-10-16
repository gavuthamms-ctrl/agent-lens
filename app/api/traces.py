"""API endpoints for Trace management, upload, analysis, and reporting."""
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TraceModel, MessageModel, DefectModel
from app.schemas import (
    TraceInputSchema,
    PasteInputSchema,
    TraceSummaryItem,
    TraceReport,
    DefectSchema,
)
from app.services.parser import TraceParser, TraceParseError
from app.services.pipeline import DetectionPipeline
from app.services.graph import GraphService
from app.services.scoring import HealthScoringService

logger = logging.getLogger("agentlens.api.traces")
router = APIRouter(prefix="/traces", tags=["Traces"])
pipeline = DetectionPipeline()


@router.post("/upload", response_model=TraceReport, status_code=status.HTTP_201_CREATED)
async def upload_trace_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a JSON or CSV trace file. Validates, stores, and runs full analysis."""
    try:
        content_bytes = await file.read()
        raw_text = content_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read uploaded file: {str(e)}",
        )

    filename = file.filename or "uploaded_trace"
    default_name = filename.rsplit(".", 1)[0].replace("_", " ").title()

    try:
        trace_input = TraceParser.parse_auto(raw_text, default_name=default_name)
    except TraceParseError as pe:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(pe))
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse trace: {str(ex)}")

    return await _save_and_analyze_trace(db, trace_input)


@router.post("/paste", response_model=TraceReport, status_code=status.HTTP_201_CREATED)
async def paste_trace(
    payload: PasteInputSchema,
    db: Session = Depends(get_db),
):
    """Paste raw JSON or CSV trace text. Validates, stores, and runs full analysis."""
    try:
        trace_input = TraceParser.parse_auto(
            payload.text,
            default_name=payload.trace_name,
            default_task=payload.task,
        )
    except TraceParseError as pe:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(pe))
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse trace: {str(ex)}")

    return await _save_and_analyze_trace(db, trace_input)


@router.get("", response_model=List[TraceSummaryItem])
def list_traces(db: Session = Depends(get_db)):
    """List all stored traces with summary health and defect metrics."""
    records = db.query(TraceModel).order_by(TraceModel.created_at.desc()).all()
    summaries: List[TraceSummaryItem] = []

    for rec in records:
        try:
            raw_data = json.loads(rec.raw_json)
            has_gt = bool(raw_data.get("ground_truth"))
            agent_cnt = len(raw_data.get("agents", []))
        except Exception:
            has_gt = False
            agent_cnt = 0

        msg_cnt = len(rec.messages)
        defect_cnt = len(rec.defects)

        summaries.append(
            TraceSummaryItem(
                id=rec.id,
                trace_name=rec.trace_name,
                task=rec.task,
                created_at=rec.created_at.isoformat() if rec.created_at else "",
                message_count=msg_cnt,
                agent_count=agent_cnt,
                defect_count=defect_cnt,
                health_score=rec.health_score,
                grade=rec.grade,
                has_ground_truth=has_gt,
            )
        )
    return summaries


@router.get("/{trace_id}", response_model=TraceReport)
def get_trace(trace_id: int, db: Session = Depends(get_db)):
    """Retrieve full analysis report for a given trace ID."""
    return _build_trace_report_from_db(db, trace_id)


@router.get("/{trace_id}/report", response_model=TraceReport)
def get_trace_report(trace_id: int, db: Session = Depends(get_db)):
    """Retrieve report for trace (alias for /{trace_id})."""
    return _build_trace_report_from_db(db, trace_id)


@router.post("/{trace_id}/analyze", response_model=TraceReport)
async def reanalyze_trace(trace_id: int, db: Session = Depends(get_db)):
    """Re-run the full rule-based + LLM judge detection pipeline on an existing trace."""
    rec = db.query(TraceModel).filter(TraceModel.id == trace_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace #{trace_id} not found.")

    raw_data = json.loads(rec.raw_json)
    trace_input = TraceInputSchema(**raw_data)

    # Delete prior detected defects
    db.query(DefectModel).filter(DefectModel.trace_id == trace_id).delete()
    db.commit()

    # Re-run pipeline
    report = await pipeline.analyze(
        trace_id=rec.id,
        trace_input=trace_input,
        created_at=rec.created_at.isoformat() if rec.created_at else "",
    )

    # Update database record
    rec.health_score = report.health.health_score
    rec.grade = report.health.grade
    rec.graph_data_json = json.dumps(report.graph.model_dump(by_alias=True))
    rec.health_json = json.dumps(report.health.model_dump())

    # Save defects
    for d in report.defects:
        defect_rec = DefectModel(
            id=d.id,
            trace_id=rec.id,
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
    db.refresh(rec)
    return report


@router.delete("/{trace_id}", status_code=status.HTTP_200_OK)
def delete_trace(trace_id: int, db: Session = Depends(get_db)):
    """Delete a trace and all associated messages, defects, and evaluation results."""
    rec = db.query(TraceModel).filter(TraceModel.id == trace_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace #{trace_id} not found.")

    db.delete(rec)
    db.commit()
    return {"status": "success", "message": f"Trace #{trace_id} deleted successfully."}


async def _save_and_analyze_trace(db: Session, trace_input: TraceInputSchema) -> TraceReport:
    """Helper to persist new trace and execute analysis pipeline."""
    # 1. Create trace record
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


def _build_trace_report_from_db(db: Session, trace_id: int) -> TraceReport:
    rec = db.query(TraceModel).filter(TraceModel.id == trace_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace #{trace_id} not found.")

    raw_data = json.loads(rec.raw_json)
    trace_input = TraceInputSchema(**raw_data)

    defects = [
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

    graph_data = (
        json.loads(rec.graph_data_json)
        if rec.graph_data_json
        else None
    )
    if not graph_data:
        graph_obj = GraphService.analyze(trace_input.agents, trace_input.messages, defects)
    else:
        graph_obj = GraphService.analyze(trace_input.agents, trace_input.messages, defects)

    if rec.health_json:
        try:
            health_obj = json.loads(rec.health_json)
        except Exception:
            health_obj = HealthScoringService.calculate(len(trace_input.messages), defects, graph_obj)
    else:
        health_obj = HealthScoringService.calculate(len(trace_input.messages), defects, graph_obj)

    counts_by_type = {}
    for d in defects:
        t = d.type.value if hasattr(d.type, "value") else str(d.type)
        counts_by_type[t] = counts_by_type.get(t, 0) + 1

    counts_by_severity = {}
    for d in defects:
        s = d.severity.value if hasattr(d.severity, "value") else str(d.severity)
        counts_by_severity[s] = counts_by_severity.get(s, 0) + 1

    counts_by_agent = {}
    for d in defects:
        for ag in d.agents:
            counts_by_agent[ag] = counts_by_agent.get(ag, 0) + 1

    return TraceReport(
        trace_id=rec.id,
        trace_name=rec.trace_name,
        task=rec.task,
        created_at=rec.created_at.isoformat() if rec.created_at else "",
        agents=trace_input.agents,
        messages=trace_input.messages,
        defects=defects,
        health=health_obj,
        graph=graph_obj,
        defect_counts_by_type=counts_by_type,
        defect_counts_by_severity=counts_by_severity,
        defect_counts_by_agent=counts_by_agent,
        top_issues=defects[:6],
        has_ground_truth=bool(trace_input.ground_truth),
    )
