import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // API Status & Configuration Endpoint
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'Google Gemini',
      model: 'gemini-3.8-flash',
      hasApiKey: Boolean(apiKey),
    });
  });

  // Server-side LLM Judge Endpoint
  app.post('/api/judge', async (req: Request, res: Response): Promise<void> => {
    const { task, agents, messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.json({ source: 'gemini-3.8-flash', defects: [] });
      return;
    }

    if (!ai || !apiKey) {
      res.json({
        source: 'heuristic',
        fallback: true,
        message: 'No GEMINI_API_KEY detected in environment; using offline heuristic detector.',
        defects: [],
      });
      return;
    }

    try {
      const prompt = `You are an expert multi-agent AI system auditor and defect judge for the AgentLens platform.
Analyze the following multi-agent communication trace and identify defects based on the AgentLens defect taxonomy.

Trace Context:
Task: "${task || 'Collaborative agent execution'}"

Registered Agents:
${(agents || []).map((a: any) => `- ${a.name}: ${a.role || 'Unspecified role'}`).join('\n')}

Communication Messages Chronology:
${messages
  .map(
    (m: any) =>
      `[Message #${m.id}] (${m.timestamp || ''}) From: "${m.sender}" To: "${m.receiver}"
Content: ${m.content}`
  )
  .join('\n\n')}

AgentLens Defect Taxonomy to detect:
1. AMBIGUOUS_INSTRUCTION: Directive lacking actionable constraints, parameters, or clear acceptance criteria.
2. INCOMPLETE_INFORMATION: Agent promised details or code or schema in message but omitted key parts.
3. CONTRADICTION: Direct factual or architectural contradiction between messages (e.g. database choice, ports, schemas, logic).
4. INFORMATION_LOSS: Crucial requirement or context received earlier is lost or ignored when handing off.
5. MISINTERPRETATION: An agent misinterpreted instructions and performed the wrong task or deliverable.
6. REDUNDANT_LOOP: Agents caught in repetitive ping-pong or looping without progressive advancement.
7. IGNORED_REQUEST: An explicit question or inquiry from an agent received no response.
8. ROLE_VIOLATION: An agent performs actions outside its assigned role boundary (e.g. Tester writing production architecture, Reviewer writing raw code).
9. HALLUCINATED_CLAIM: Agent claims verification, tests passing, or metrics that contradict reality or couldn't have occurred.
10. PROTOCOL_VIOLATION: Malformed payload, self-messaging, or message to unregistered agent.

Instructions:
- Carefully inspect every message against the taxonomy.
- Only return genuine defects with high confidence.
- Format the response strictly matching the schema provided.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are AgentLens, an analytical auditor for multi-agent systems. Return only structured defect findings according to the requested JSON schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              defects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description:
                        'One of: AMBIGUOUS_INSTRUCTION, INCOMPLETE_INFORMATION, CONTRADICTION, INFORMATION_LOSS, MISINTERPRETATION, REDUNDANT_LOOP, IGNORED_REQUEST, ROLE_VIOLATION, HALLUCINATED_CLAIM, PROTOCOL_VIOLATION',
                    },
                    severity: {
                      type: Type.STRING,
                      description: 'critical, high, medium, or low',
                    },
                    message_ids: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: 'IDs of the messages directly involved in this defect',
                    },
                    agents: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Names of agents responsible or involved',
                    },
                    explanation: {
                      type: Type.STRING,
                      description: 'Detailed explanation of why this is a defect',
                    },
                    evidence_quote: {
                      type: Type.STRING,
                      description: 'Exact verbatim excerpt from message demonstrating the defect',
                    },
                    suggested_fix: {
                      type: Type.STRING,
                      description: 'Actionable fix or prompt engineering mitigation',
                    },
                    confidence: {
                      type: Type.NUMBER,
                      description: 'Confidence score between 0.0 and 1.0',
                    },
                  },
                  required: [
                    'type',
                    'severity',
                    'message_ids',
                    'agents',
                    'explanation',
                    'suggested_fix',
                    'confidence',
                  ],
                },
              },
            },
            required: ['defects'],
          },
        },
      });

      const text = response.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { defects: [] };
      }

      const rawDefects: any[] = Array.isArray(parsed?.defects) ? parsed.defects : [];
      const sanitizedDefects = rawDefects.map((d: any, idx: number) => ({
        id: `gemini-${(d.type || 'defect').toLowerCase()}-${idx + 1}`,
        type: d.type,
        severity: ['critical', 'high', 'medium', 'low'].includes(String(d.severity).toLowerCase())
          ? String(d.severity).toLowerCase()
          : 'high',
        message_ids: Array.isArray(d.message_ids) ? d.message_ids.map(Number) : [],
        agents: Array.isArray(d.agents) ? d.agents : [],
        explanation: d.explanation || 'Semantic anomaly detected by Gemini Judge.',
        evidence_quote: d.evidence_quote || '',
        suggested_fix: d.suggested_fix || 'Review agent prompt and output constraints.',
        confidence: typeof d.confidence === 'number' ? Math.min(1.0, Math.max(0.1, d.confidence)) : 0.9,
        detected_by: 'llm',
      }));

      res.json({
        source: 'gemini-3.8-flash',
        fallback: false,
        defects: sanitizedDefects,
      });
    } catch (err: any) {
      console.error('Error invoking Gemini 3.8 Flash model:', err);
      res.json({
        source: 'heuristic',
        fallback: true,
        error: err.message || 'Gemini inference failed; fallback to heuristic judge',
        defects: [],
      });
    }
  });

  // Serve Frontend
  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('dist directory not found; ensure build step ran successfully.');
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgentLens server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
