import { getConversationHistory } from '../db/repository';
import { analyzeSentiment, getTonePrefix } from './sentiment';
import { agentTools } from './tools';

const OPENROUTER_API_KEY = (): string => process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'openai/gpt-4o-mini';

// --- TOOL DEFINITIONS ---
const tools = [
  {
    name: 'check_server_status',
    description: 'Check the health and uptime of the Flowzint server or specific services.',
    parameters: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Optional AWS region.', enum: ['us-east-1', 'eu-west-1', 'ap-southeast-1'] },
      },
    },
    execute: async () => agentTools.check_system_status({}),
  },
  {
    name: 'create_ticket',
    description: 'Create a support ticket.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4'] },
      },
      required: ['subject', 'description', 'priority'],
    },
    execute: async (args: { subject: string; description: string; priority: string }) =>
      agentTools.create_support_ticket({ sessionId: 'anonymous', ...args }),
  },
  {
    name: 'search_knowledge_base',
    description: 'Search Flowzint knowledge base.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: async (args: { query: string }) => agentTools.search_knowledge_base({ query: args.query }),
  },
  {
    name: 'get_invoice',
    description: 'Look up invoice details.',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
      },
    },
    execute: async (args: { invoiceId?: string }) => agentTools.lookup_invoice({ invoiceId: args.invoiceId }),
  },
];

function buildOpenAITools() {
  return tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

// --- MAIN AGENT HANDLER ---
export interface ChatMessageOptions {
  message: string;
  sessionId: string;
  onToken: (token: string) => void;
  onSentiment?: (sentiment: { label: string; emoji: string; escalationRisk: number }) => void;
  onIntent?: (intent: string) => void;
}

async function callOpenRouter(messages: any[], stream = false): Promise<any> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY()}`,
      'HTTP-Referer': 'https://flowzint.com',
      'X-Title': 'OmniCare AI',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: buildOpenAITools(),
      stream,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${text}`);
  }

  return stream ? response : response.json();
}

export async function handleChatMessage({ message, sessionId, onToken, onSentiment, onIntent }: ChatMessageOptions) {
  const sentiment = analyzeSentiment(message);
  onSentiment?.({ label: sentiment.label, emoji: sentiment.emoji, escalationRisk: sentiment.escalationRisk });

  const intent = detectIntent(message);
  onIntent?.(intent);

  const history = await getConversationHistory(sessionId);

  const tonePrefix = getTonePrefix(sentiment.tone, sentiment.label);
  const systemInstructions = `You are OmniCare AI, a professional customer support agent for Flowzint.

Primary goal: resolve issues quickly. Tools available: check_server_status, create_ticket, search_knowledge_base, get_invoice.

Rules:
- Server health/status → check_server_status
- Features/billing/API questions → search_knowledge_base  
- Invoices/payments → get_invoice
- Complex issues → create_ticket
- Keep responses concise (2-3 sentences)

${tonePrefix ? `User sentiment: "${sentiment.label}". Tone: ${tonePrefix}` : ''}`;

  // Build conversation
  const messages: any[] = [
    { role: 'system', content: systemInstructions },
    ...history.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message },
  ];

  const MAX_TOOL_ROUNDS = 3;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await callOpenRouter(messages, false);
      const choice = result?.choices?.[0];
      const assistantMsg = choice?.message;
      const toolCalls = assistantMsg?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        const text = assistantMsg?.content || '';
        onToken(text);
        return text;
      }

      // Add assistant message with tool calls
      messages.push({ role: 'assistant', content: assistantMsg.content, tool_calls: toolCalls });

      // Execute tool calls in parallel
      const toolResults = await Promise.all(toolCalls.map(async (call: any) => {
        const tool = tools.find(t => t.name === call.function.name);
        let output: any;

        if (!tool) {
          output = { error: 'Unknown tool' };
        } else {
          try {
            const args = typeof call.function.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : call.function.arguments;
            output = await tool.execute(args);
          } catch (e) {
            output = { error: (e as Error).message };
          }
        }

        return {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output),
        };
      }));

      messages.push(...toolResults);
    }

    // Final response after tool rounds
    const finalResult = await callOpenRouter([...messages, { role: 'system', content: 'Provide a concise answer based on tool results.' }], false);
    const finalText = finalResult?.choices?.[0]?.message?.content || '';
    onToken(finalText);
    return finalText;

  } catch (error) {
    console.error("Error calling OpenRouter:", error);
    throw error;
  }
}

function detectIntent(message: string): string {
  const text = message.toLowerCase();
  if (/server|status|health|uptime|down|outage|system/.test(text)) return 'technical';
  if (/bill|invoice|payment|charge|refund|pricing/.test(text)) return 'billing';
  if (/api|endpoint|webhook|sdk|integration/.test(text)) return 'api';
  if (/account|login|password|sso|mfa|role/.test(text)) return 'account';
  if (/sla|breach|credit|uptime guarantee/.test(text)) return 'sla';
  if (/security|compliance|encryption|audit/.test(text)) return 'security';
  if (/ticket|escalate|manager|help|support/.test(text)) return 'escalation';
  return 'general';
}