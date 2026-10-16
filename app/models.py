"""SQLAlchemy database models for AgentLens."""
from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base


class TraceModel(Base):
    __tablename__ = "traces"

    id = Column(Integer, primary_key=True, index=True)
    trace_name = Column(String(255), nullable=False)
    task = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    health_score = Column(Integer, nullable=True)
    grade = Column(String(10), nullable=True)
    raw_json = Column(Text, nullable=False)  # Full trace input with agents, messages, ground_truth
    graph_data_json = Column(Text, nullable=True)
    health_json = Column(Text, nullable=True)

    messages = relationship("MessageModel", back_populates="trace", cascade="all, delete-orphan")
    defects = relationship("DefectModel", back_populates="trace", cascade="all, delete-orphan")
    evaluations = relationship("EvaluationModel", back_populates="trace", cascade="all, delete-orphan")


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    trace_id = Column(Integer, ForeignKey("traces.id", ondelete="CASCADE"), nullable=False)
    msg_id = Column(Integer, nullable=False)  # Original sequential id
    sender = Column(String(100), nullable=False)
    receiver = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(String(100), default="")

    trace = relationship("TraceModel", back_populates="messages")


class DefectModel(Base):
    __tablename__ = "defects"

    id = Column(String(64), primary_key=True, index=True)
    trace_id = Column(Integer, ForeignKey("traces.id", ondelete="CASCADE"), nullable=False)
    defect_type = Column(String(64), nullable=False)
    severity = Column(String(20), nullable=False)
    message_ids_json = Column(Text, default="[]")
    agents_json = Column(Text, default="[]")
    explanation = Column(Text, nullable=False)
    evidence_quote = Column(Text, default="")
    suggested_fix = Column(Text, nullable=False)
    confidence = Column(Float, default=0.85)
    detected_by = Column(String(20), default="rule")

    trace = relationship("TraceModel", back_populates="defects")

    @property
    def message_ids(self):
        try:
            return json.loads(self.message_ids_json)
        except Exception:
            return []

    @property
    def agents(self):
        try:
            return json.loads(self.agents_json)
        except Exception:
            return []


class EvaluationModel(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    trace_id = Column(Integer, ForeignKey("traces.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    overall_precision = Column(Float, nullable=False)
    overall_recall = Column(Float, nullable=False)
    overall_f1 = Column(Float, nullable=False)
    metrics_json = Column(Text, nullable=False)

    trace = relationship("TraceModel", back_populates="evaluations")
