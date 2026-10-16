import { DefectSchema, DefectType, Severity, MessageSchema, AgentSchema } from '../types';

const REQUEST_INDICATORS = [
  /\?/,
  /\bplease\b/i,
  /\bcould you\b/i,
  /\bcan you\b/i,
  /\bneed you to\b/i,
  /\bkindly\b/i,
  /\bprovide\b/i,
  /\bshare\b/i,
  /\blet me know\b/i,
  /\brequest\b/i,
  /\bwaiting for\b/i,
  /\bhelp me\b/i,
];

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
}

// Tokenize text into word frequency map for cosine similarity
function getTermFrequencies(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

function calculateCosineSimilarity(tf1: Map<string, number>, tf2: Map<string, number>): number {
  if (tf1.size === 0 || tf2.size === 0) return 0;
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const [w, count] of tf1.entries()) {
    mag1 += count * count;
    if (tf2.has(w)) {
      dotProduct += count * tf2.get(w)!;
    }
  }
  for (const [, count] of tf2.entries()) {
    mag2 += count * count;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export class RuleBasedDetector {
  private unansweredWindowLimit: number;
  private similarityThreshold: number;
  private minContentLength: number;

  constructor(
    unansweredWindowLimit: number = 4,
    similarityThreshold: number = 0.82,
    minContentLength: number = 3
  ) {
    this.unansweredWindowLimit = unansweredWindowLimit;
    this.similarityThreshold = similarityThreshold;
    this.minContentLength = minContentLength;
  }

  public detect(messages: MessageSchema[], agents: AgentSchema[]): DefectSchema[] {
    const defects: DefectSchema[] = [];
    if (!messages || messages.length === 0) return defects;

    const knownAgentNames = new Set(agents.map(a => a.name.trim().toLowerCase()));

    // 1. Structural / Protocol checks
    defects.push(...this.checkProtocolAndAnomalies(messages, knownAgentNames));

    // 2. Redundant loops
    defects.push(...this.checkRedundantLoops(messages));

    // 3. Unanswered / Ignored requests
    defects.push(...this.checkUnansweredRequests(messages));

    return defects;
  }

  private checkProtocolAndAnomalies(messages: MessageSchema[], knownAgents: Set<string>): DefectSchema[] {
    const defects: DefectSchema[] = [];
    const lengths = messages.map(m => (m.content || '').trim().length).filter(l => l > 0);

    const meanLen = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 50;
    const variance =
      lengths.length > 3
        ? lengths.reduce((acc, val) => acc + Math.pow(val - meanLen, 2), 0) / lengths.length
        : 2500;
    const stdLen = Math.sqrt(variance);
    const outlierUpperBound = Math.max(meanLen + 3.0 * stdLen, 3000.0);

    for (const msg of messages) {
      const contentStripped = (msg.content || '').trim();
      const senderClean = (msg.sender || '').trim();
      const receiverClean = (msg.receiver || '').trim();

      // Empty message check
      if (!contentStripped) {
        defects.push({
          id: generateId(`rule-empty-${msg.id}`),
          type: DefectType.PROTOCOL_VIOLATION,
          severity: 'high',
          message_ids: [msg.id],
          agents: receiverClean ? [senderClean, receiverClean] : [senderClean],
          explanation: `Message #${msg.id} from ${senderClean} to ${receiverClean} has empty or whitespace-only content.`,
          evidence_quote: '[EMPTY MESSAGE BODY]',
          suggested_fix: 'Ensure agents validate non-empty message payloads before sending.',
          confidence: 1.0,
          detected_by: 'rule',
        });
        continue;
      }

      // Length anomaly: abnormally short
      if (contentStripped.length < this.minContentLength) {
        defects.push({
          id: generateId(`rule-short-${msg.id}`),
          type: DefectType.PROTOCOL_VIOLATION,
          severity: 'medium',
          message_ids: [msg.id],
          agents: [senderClean, receiverClean],
          explanation: `Message #${msg.id} content '${contentStripped}' is abnormally short (< ${this.minContentLength} characters) and lacks necessary semantic context.`,
          evidence_quote: contentStripped,
          suggested_fix: 'Enforce minimum informative token thresholds on agent outputs.',
          confidence: 0.95,
          detected_by: 'rule',
        });
      }
      // Length anomaly: extreme outlier
      else if (contentStripped.length > outlierUpperBound && contentStripped.length > 2500) {
        defects.push({
          id: generateId(`rule-long-${msg.id}`),
          type: DefectType.PROTOCOL_VIOLATION,
          severity: 'low',
          message_ids: [msg.id],
          agents: [senderClean, receiverClean],
          explanation: `Message #${msg.id} is an extreme length anomaly (${contentStripped.length} chars vs mean ${meanLen.toFixed(1)} chars), likely dumping unparsed raw logs or unconstrained generation.`,
          evidence_quote: contentStripped.slice(0, 120) + '... [truncated]',
          suggested_fix: 'Implement summarization or structured output schemas before dispatching large dumps.',
          confidence: 0.85,
          detected_by: 'rule',
        });
      }

      // Self-directed message
      if (senderClean && receiverClean && senderClean.toLowerCase() === receiverClean.toLowerCase()) {
        defects.push({
          id: generateId(`rule-selftalk-${msg.id}`),
          type: DefectType.PROTOCOL_VIOLATION,
          severity: 'medium',
          message_ids: [msg.id],
          agents: [senderClean],
          explanation: `Agent '${senderClean}' dispatched a communication message to itself in message #${msg.id}.`,
          evidence_quote: contentStripped.slice(0, 100),
          suggested_fix: 'Correct router logic so agents do not route outward network messages to themselves.',
          confidence: 1.0,
          detected_by: 'rule',
        });
      }

      // Unknown receiver agent
      if (knownAgents.size > 0 && receiverClean && !knownAgents.has(receiverClean.toLowerCase())) {
        defects.push({
          id: generateId(`rule-unknown-rcv-${msg.id}`),
          type: DefectType.PROTOCOL_VIOLATION,
          severity: 'high',
          message_ids: [msg.id],
          agents: [senderClean, receiverClean],
          explanation: `Message #${msg.id} addressed recipient '${receiverClean}', which is not a recognized agent in this system roster.`,
          evidence_quote: `Receiver: ${receiverClean}`,
          suggested_fix: `Configure agent roster validation; valid recipients are: ${Array.from(knownAgents).sort().join(', ')}.`,
          confidence: 0.98,
          detected_by: 'rule',
        });
      }

      // Unknown sender agent
      if (knownAgents.size > 0 && senderClean && !knownAgents.has(senderClean.toLowerCase())) {
        defects.push({
          id: generateId(`rule-unknown-snd-${msg.id}`),
          type: DefectType.PROTOCOL_VIOLATION,
          severity: 'high',
          message_ids: [msg.id],
          agents: [senderClean],
          explanation: `Message #${msg.id} originated from unauthorized or unregistered sender '${senderClean}'.`,
          evidence_quote: `Sender: ${senderClean}`,
          suggested_fix: 'Ensure all interacting agents are authenticated and initialized in the agent roster.',
          confidence: 0.98,
          detected_by: 'rule',
        });
      }
    }

    return defects;
  }

  private checkRedundantLoops(messages: MessageSchema[]): DefectSchema[] {
    const defects: DefectSchema[] = [];
    if (messages.length < 2) return defects;

    const validMsgs = messages.filter(m => (m.content || '').trim().length >= 5);
    if (validMsgs.length < 2) return defects;

    const termFreqs = validMsgs.map(m => getTermFrequencies(m.content));
    const flaggedPairs = new Set<string>();

    for (let i = 0; i < validMsgs.length; i++) {
      for (let j = i + 1; j < Math.min(i + 6, validMsgs.length); j++) {
        const msgI = validMsgs[i];
        const msgJ = validMsgs[j];

        const sameDirection = msgI.sender === msgJ.sender && msgI.receiver === msgJ.receiver;
        const isPingPong = msgI.sender === msgJ.receiver && msgI.receiver === msgJ.sender;

        if (!sameDirection && !isPingPong) continue;

        let sim = calculateCosineSimilarity(termFreqs[i], termFreqs[j]);

        // Exact substring or identical content boost
        const textI = msgI.content.trim().toLowerCase();
        const textJ = msgJ.content.trim().toLowerCase();
        if (textI === textJ) {
          sim = 1.0;
        }

        if (sim >= this.similarityThreshold) {
          const pairKey = [msgI.id, msgJ.id].sort((a, b) => a - b).join('-');
          if (flaggedPairs.has(pairKey)) continue;
          flaggedPairs.add(pairKey);

          const severity: Severity = sim >= 0.95 ? 'high' : 'medium';
          const involvedAgents = Array.from(new Set([msgI.sender, msgI.receiver, msgJ.sender, msgJ.receiver]));

          defects.push({
            id: generateId(`rule-loop-${msgI.id}-${msgJ.id}`),
            type: DefectType.REDUNDANT_LOOP,
            severity,
            message_ids: [msgI.id, msgJ.id],
            agents: involvedAgents,
            explanation: `Redundant loop detected between messages #${msgI.id} and #${msgJ.id} with ${(sim * 100).toFixed(1)}% semantic similarity without meaningful state change.`,
            evidence_quote: `Msg #${msgI.id}: '${msgI.content.slice(0, 70)}...' vs Msg #${msgJ.id}: '${msgJ.content.slice(0, 70)}...'`,
            suggested_fix: 'Implement loop-detection guards and pass explicit delta state rather than resending queries.',
            confidence: Number(sim.toFixed(2)),
            detected_by: 'rule',
          });
        }
      }
    }

    return defects;
  }

  private checkUnansweredRequests(messages: MessageSchema[]): DefectSchema[] {
    const defects: DefectSchema[] = [];
    if (messages.length < 2) return defects;

    for (let idx = 0; idx < messages.length; idx++) {
      const msg = messages[idx];
      const sender = msg.sender.trim();
      const receiver = msg.receiver.trim();
      const content = (msg.content || '').trim();

      const hasRequestIndicator = REQUEST_INDICATORS.some(regex => regex.test(content));
      if (!hasRequestIndicator) continue;

      let answered = false;
      const subsequentLimit = Math.min(idx + 1 + this.unansweredWindowLimit, messages.length);
      const subsequentMsgs = messages.slice(idx + 1, subsequentLimit);

      for (const nextMsg of subsequentMsgs) {
        const nextSender = nextMsg.sender.trim().toLowerCase();
        const nextReceiver = nextMsg.receiver.trim().toLowerCase();

        if (
          nextSender === receiver.toLowerCase() &&
          (nextReceiver === sender.toLowerCase() ||
            ['all', 'team', 'coordinator', 'planner'].includes(nextReceiver))
        ) {
          answered = true;
          break;
        }
      }

      if (!answered) {
        const laterMsgs = messages.slice(idx + 1);
        for (const laterMsg of laterMsgs) {
          if (
            laterMsg.sender.trim().toLowerCase() === receiver.toLowerCase() &&
            laterMsg.receiver.trim().toLowerCase() === sender.toLowerCase()
          ) {
            answered = true;
            break;
          }
        }
      }

      if (!answered) {
        defects.push({
          id: generateId(`rule-ignored-${msg.id}`),
          type: DefectType.IGNORED_REQUEST,
          severity: 'high',
          message_ids: [msg.id],
          agents: [sender, receiver],
          explanation: `In message #${msg.id}, ${sender} sent a direct request or question to ${receiver}, but ${receiver} never responded to it in the subsequent conversation.`,
          evidence_quote: content.slice(0, 140) + (content.length > 140 ? '...' : ''),
          suggested_fix: `Configure agent ${receiver} to acknowledge incoming task requests and maintain an unresolved question queue.`,
          confidence: 0.9,
          detected_by: 'rule',
        });
      }
    }

    return defects;
  }
}
