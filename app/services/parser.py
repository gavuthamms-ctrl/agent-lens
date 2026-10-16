"""Parser and validator for JSON and CSV conversation traces."""
import csv
import io
import json
from typing import Tuple, List, Dict, Any, Optional

from app.schemas import (
    TraceInputSchema,
    AgentSchema,
    MessageSchema,
    DefectSchema,
)


class TraceParseError(Exception):
    """Raised when trace content cannot be parsed or validated."""
    pass


class TraceParser:
    """Parses JSON and CSV trace payloads into validated TraceInputSchema models."""

    @classmethod
    def parse_auto(
        cls,
        raw_text: str,
        default_name: Optional[str] = None,
        default_task: Optional[str] = None,
    ) -> TraceInputSchema:
        """Autodetects JSON vs CSV format and parses trace."""
        cleaned = raw_text.strip()
        if not cleaned:
            raise TraceParseError("Provided trace content is empty.")

        if cleaned.startswith("{") or cleaned.startswith("["):
            try:
                return cls.parse_json(cleaned, default_name, default_task)
            except TraceParseError:
                raise
            except Exception as e:
                raise TraceParseError(f"Invalid JSON format: {str(e)}")
        else:
            return cls.parse_csv(cleaned, default_name, default_task)

    @classmethod
    def parse_json(
        cls,
        json_text: str,
        default_name: Optional[str] = None,
        default_task: Optional[str] = None,
    ) -> TraceInputSchema:
        try:
            data = json.loads(json_text)
        except json.JSONDecodeError as err:
            raise TraceParseError(f"JSON Syntax Error at line {err.lineno}, col {err.colno}: {err.msg}")

        # Case 1: Standard dictionary payload
        if isinstance(data, dict):
            trace_name = data.get("trace_name") or default_name or "Imported Conversation Trace"
            task = data.get("task") or default_task or "Multi-Agent Collaboration Task"
            raw_agents = data.get("agents", [])
            raw_messages = data.get("messages", [])
            raw_gt = data.get("ground_truth", [])

            if not raw_messages:
                raise TraceParseError("JSON trace must contain a non-empty 'messages' list.")

            messages: List[MessageSchema] = []
            for idx, m in enumerate(raw_messages, start=1):
                if not isinstance(m, dict):
                    raise TraceParseError(f"Message #{idx} must be a JSON object.")
                sender = str(m.get("sender", "")).strip()
                receiver = str(m.get("receiver", "")).strip()
                content = str(m.get("content", ""))
                if not sender:
                    raise TraceParseError(f"Message #{idx} is missing required 'sender' field.")
                if not receiver:
                    raise TraceParseError(f"Message #{idx} is missing required 'receiver' field.")

                m_id = m.get("id")
                try:
                    m_id_int = int(m_id) if m_id is not None else idx
                except ValueError:
                    m_id_int = idx

                messages.append(
                    MessageSchema(
                        id=m_id_int,
                        sender=sender,
                        receiver=receiver,
                        content=content,
                        timestamp=str(m.get("timestamp", "")),
                    )
                )

            # Extract agents if missing
            agents: List[AgentSchema] = []
            if raw_agents:
                for a in raw_agents:
                    if isinstance(a, dict) and "name" in a:
                        agents.append(
                            AgentSchema(
                                name=str(a["name"]).strip(),
                                role=str(a.get("role", "Collaborator")).strip(),
                            )
                        )
            if not agents:
                found_names = set()
                for m in messages:
                    found_names.add(m.sender)
                    found_names.add(m.receiver)
                agents = [AgentSchema(name=n, role="Collaborating Agent") for n in sorted(found_names) if n]

            # Ground truth if provided
            ground_truth: List[DefectSchema] = []
            if raw_gt:
                for item in raw_gt:
                    try:
                        ground_truth.append(DefectSchema(**item))
                    except Exception:
                        pass

            return TraceInputSchema(
                trace_name=trace_name,
                agents=agents,
                task=task,
                messages=messages,
                ground_truth=ground_truth,
            )

        # Case 2: Direct list of messages
        elif isinstance(data, list):
            messages = []
            found_names = set()
            for idx, m in enumerate(data, start=1):
                if not isinstance(m, dict):
                    raise TraceParseError(f"Item #{idx} in message list must be a JSON object.")
                sender = str(m.get("sender", "")).strip()
                receiver = str(m.get("receiver", "")).strip()
                content = str(m.get("content", ""))
                if not sender or not receiver:
                    raise TraceParseError(f"Item #{idx} is missing sender or receiver field.")
                found_names.add(sender)
                found_names.add(receiver)
                m_id = m.get("id", idx)
                try:
                    m_id_int = int(m_id)
                except ValueError:
                    m_id_int = idx
                messages.append(
                    MessageSchema(
                        id=m_id_int,
                        sender=sender,
                        receiver=receiver,
                        content=content,
                        timestamp=str(m.get("timestamp", "")),
                    )
                )

            agents = [AgentSchema(name=n, role="Collaborating Agent") for n in sorted(found_names)]
            return TraceInputSchema(
                trace_name=default_name or "Imported Conversation Trace",
                agents=agents,
                task=default_task or "Multi-Agent System Task",
                messages=messages,
                ground_truth=[],
            )

        raise TraceParseError("JSON root must be either a Trace object or an array of message objects.")

    @classmethod
    def parse_csv(
        cls,
        csv_text: str,
        default_name: Optional[str] = None,
        default_task: Optional[str] = None,
    ) -> TraceInputSchema:
        f = io.StringIO(csv_text.strip())
        reader = csv.DictReader(f)

        if not reader.fieldnames:
            raise TraceParseError("CSV trace is empty or has no header row.")

        # Normalize column headers
        col_map = {}
        for fn in reader.fieldnames:
            clean_fn = fn.strip().lower()
            if clean_fn in ("id", "msg_id", "message_id", "seq"):
                col_map["id"] = fn
            elif clean_fn in ("sender", "from", "source", "author"):
                col_map["sender"] = fn
            elif clean_fn in ("receiver", "to", "target", "recipient"):
                col_map["receiver"] = fn
            elif clean_fn in ("content", "message", "text", "body", "payload"):
                col_map["content"] = fn
            elif clean_fn in ("timestamp", "time", "date", "created_at"):
                col_map["timestamp"] = fn

        if "sender" not in col_map or "receiver" not in col_map or "content" not in col_map:
            missing = [c for c in ["sender", "receiver", "content"] if c not in col_map]
            raise TraceParseError(
                f"CSV is missing required columns: {', '.join(missing)}. "
                f"Expected columns: id, sender, receiver, content, timestamp. Found: {', '.join(reader.fieldnames)}"
            )

        messages: List[MessageSchema] = []
        found_agents = set()

        for row_idx, row in enumerate(reader, start=1):
            sender = str(row.get(col_map["sender"], "")).strip()
            receiver = str(row.get(col_map["receiver"], "")).strip()
            content = str(row.get(col_map["content"], ""))
            timestamp = str(row.get(col_map.get("timestamp", ""), "")).strip()

            if not sender and not receiver and not content:
                continue

            if not sender or not receiver:
                raise TraceParseError(f"Row {row_idx} is missing sender or receiver.")

            found_agents.add(sender)
            found_agents.add(receiver)

            raw_id = row.get(col_map.get("id", ""), "")
            try:
                msg_id = int(raw_id) if raw_id else row_idx
            except ValueError:
                msg_id = row_idx

            messages.append(
                MessageSchema(
                    id=msg_id,
                    sender=sender,
                    receiver=receiver,
                    content=content,
                    timestamp=timestamp,
                )
            )

        if not messages:
            raise TraceParseError("No valid message rows found in CSV.")

        agents = [AgentSchema(name=n, role="Collaborating Agent") for n in sorted(found_agents)]

        return TraceInputSchema(
            trace_name=default_name or "Imported CSV Trace",
            agents=agents,
            task=default_task or "Multi-Agent System Task",
            messages=messages,
            ground_truth=[],
        )
