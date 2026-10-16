import { AgentSchema, DefectSchema, MessageSchema, TraceInputSchema } from '../types';

export class TraceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TraceParseError';
  }
}

export class TraceParser {
  public static parseAuto(
    rawText: string,
    defaultName?: string,
    defaultTask?: string
  ): TraceInputSchema {
    const cleaned = rawText.trim();
    if (!cleaned) {
      throw new TraceParseError('Provided trace content is empty.');
    }

    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      return this.parseJson(cleaned, defaultName, defaultTask);
    } else {
      return this.parseCsv(cleaned, defaultName, defaultTask);
    }
  }

  public static parseJson(
    jsonText: string,
    defaultName?: string,
    defaultTask?: string
  ): TraceInputSchema {
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch (err: any) {
      throw new TraceParseError(`JSON Syntax Error: ${err.message || String(err)}`);
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const traceName = data.trace_name || defaultName || 'Imported Conversation Trace';
      const task = data.task || defaultTask || 'Multi-Agent Collaboration Task';
      const rawAgents = data.agents || [];
      const rawMessages = data.messages || [];
      const rawGt = data.ground_truth || [];

      if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
        throw new TraceParseError("JSON trace must contain a non-empty 'messages' list.");
      }

      const messages: MessageSchema[] = [];
      const foundAgentNames = new Set<string>();

      for (let idx = 0; idx < rawMessages.length; idx++) {
        const m = rawMessages[idx];
        if (typeof m !== 'object' || m === null) {
          throw new TraceParseError(`Message #${idx + 1} must be a JSON object.`);
        }
        const sender = String(m.sender || '').trim();
        const receiver = String(m.receiver || '').trim();
        const content = String(m.content || '');

        if (!sender) {
          throw new TraceParseError(`Message #${idx + 1} is missing required 'sender' field.`);
        }
        if (!receiver) {
          throw new TraceParseError(`Message #${idx + 1} is missing required 'receiver' field.`);
        }

        foundAgentNames.add(sender);
        foundAgentNames.add(receiver);

        const mId = m.id !== undefined && !isNaN(Number(m.id)) ? Number(m.id) : idx + 1;
        messages.push({
          id: mId,
          sender,
          receiver,
          content,
          timestamp: m.timestamp ? String(m.timestamp) : '',
        });
      }

      const agents: AgentSchema[] = [];
      if (Array.isArray(rawAgents) && rawAgents.length > 0) {
        for (const a of rawAgents) {
          if (typeof a === 'object' && a !== null && a.name) {
            agents.push({
              name: String(a.name).trim(),
              role: String(a.role || 'Collaborator').trim(),
            });
          }
        }
      }
      if (agents.length === 0) {
        for (const name of Array.from(foundAgentNames).sort()) {
          agents.push({ name, role: 'Collaborating Agent' });
        }
      }

      const groundTruth: DefectSchema[] = [];
      if (Array.isArray(rawGt)) {
        for (const gt of rawGt) {
          if (gt && gt.id && gt.type && gt.severity) {
            groundTruth.push({
              id: String(gt.id),
              type: gt.type,
              severity: gt.severity,
              message_ids: Array.isArray(gt.message_ids) ? gt.message_ids : [],
              agents: Array.isArray(gt.agents) ? gt.agents : [],
              explanation: String(gt.explanation || ''),
              evidence_quote: String(gt.evidence_quote || ''),
              suggested_fix: String(gt.suggested_fix || ''),
              confidence: Number(gt.confidence || 1.0),
              detected_by: gt.detected_by || 'ground_truth',
            });
          }
        }
      }

      return {
        trace_name: traceName,
        agents,
        task,
        messages,
        ground_truth: groundTruth,
      };
    } else if (Array.isArray(data)) {
      const messages: MessageSchema[] = [];
      const foundNames = new Set<string>();

      for (let idx = 0; idx < data.length; idx++) {
        const m = data[idx];
        if (typeof m !== 'object' || m === null) {
          throw new TraceParseError(`Item #${idx + 1} in message list must be a JSON object.`);
        }
        const sender = String(m.sender || '').trim();
        const receiver = String(m.receiver || '').trim();
        const content = String(m.content || '');

        if (!sender || !receiver) {
          throw new TraceParseError(`Item #${idx + 1} is missing sender or receiver field.`);
        }
        foundNames.add(sender);
        foundNames.add(receiver);

        const mId = m.id !== undefined && !isNaN(Number(m.id)) ? Number(m.id) : idx + 1;
        messages.push({
          id: mId,
          sender,
          receiver,
          content,
          timestamp: m.timestamp ? String(m.timestamp) : '',
        });
      }

      const agents: AgentSchema[] = Array.from(foundNames)
        .sort()
        .map(n => ({ name: n, role: 'Collaborating Agent' }));

      return {
        trace_name: defaultName || 'Imported Conversation Trace',
        agents,
        task: defaultTask || 'Multi-Agent System Task',
        messages,
        ground_truth: [],
      };
    }

    throw new TraceParseError('JSON root must be either a Trace object or an array of message objects.');
  }

  public static parseCsv(
    csvText: string,
    defaultName?: string,
    defaultTask?: string
  ): TraceInputSchema {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new TraceParseError('CSV trace is empty or has no header row.');
    }

    const header = this.parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const colMap: Record<string, number> = {};

    for (let i = 0; i < header.length; i++) {
      const col = header[i];
      if (['id', 'msg_id', 'message_id', 'seq'].includes(col)) colMap['id'] = i;
      else if (['sender', 'from', 'source', 'author'].includes(col)) colMap['sender'] = i;
      else if (['receiver', 'to', 'target', 'recipient'].includes(col)) colMap['receiver'] = i;
      else if (['content', 'message', 'text', 'body', 'payload'].includes(col)) colMap['content'] = i;
      else if (['timestamp', 'time', 'date', 'created_at'].includes(col)) colMap['timestamp'] = i;
    }

    if (colMap['sender'] === undefined || colMap['receiver'] === undefined || colMap['content'] === undefined) {
      const missing: string[] = [];
      if (colMap['sender'] === undefined) missing.push('sender');
      if (colMap['receiver'] === undefined) missing.push('receiver');
      if (colMap['content'] === undefined) missing.push('content');
      throw new TraceParseError(
        `CSV is missing required columns: ${missing.join(', ')}. Expected: id, sender, receiver, content, timestamp. Found: ${header.join(', ')}`
      );
    }

    const messages: MessageSchema[] = [];
    const foundAgents = new Set<string>();

    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      const row = this.parseCsvLine(lines[rowIdx]);
      if (row.length === 0) continue;

      const sender = (row[colMap['sender']] || '').trim();
      const receiver = (row[colMap['receiver']] || '').trim();
      const content = row[colMap['content']] || '';
      const timestamp = colMap['timestamp'] !== undefined ? (row[colMap['timestamp']] || '').trim() : '';

      if (!sender && !receiver && !content) continue;
      if (!sender || !receiver) {
        throw new TraceParseError(`Row ${rowIdx} is missing sender or receiver.`);
      }

      foundAgents.add(sender);
      foundAgents.add(receiver);

      const rawId = colMap['id'] !== undefined ? row[colMap['id']] : '';
      const msgId = rawId && !isNaN(Number(rawId)) ? Number(rawId) : rowIdx;

      messages.push({
        id: msgId,
        sender,
        receiver,
        content,
        timestamp,
      });
    }

    if (messages.length === 0) {
      throw new TraceParseError('No valid message rows found in CSV.');
    }

    const agents = Array.from(foundAgents)
      .sort()
      .map(n => ({ name: n, role: 'Collaborating Agent' }));

    return {
      trace_name: defaultName || 'Imported CSV Trace',
      agents,
      task: defaultTask || 'Multi-Agent System Task',
      messages,
      ground_truth: [],
    };
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
