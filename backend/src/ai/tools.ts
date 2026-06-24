// ─── LLM Agentic Tools ───────────────────────────────────────────────────────
// Each tool can be invoked by the AI agent to take real actions.
// LangChain DynamicStructuredTool-compatible definitions.

import { createTicket, getConversationHistory } from '../db/repository';
import { cacheGet, cacheSet } from './cache';

export interface ToolResult {
  success: boolean;
  data: any;
  message: string;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────
export const agentTools = {
  /**
   * TOOL: search_knowledge_base
   * Searches Flowzint's internal knowledge base for policy / how-to answers.
   */
  async search_knowledge_base({ query }: { query: string }): Promise<ToolResult> {
    const cacheKey = `kb:${query.toLowerCase().slice(0, 60)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return { success: true, data: cached, message: 'KB hit (cached)' };

    const KB: Record<string, string[]> = {
      billing: [
        'Billing cycles run monthly on the 1st. View invoices at flowzint.com/billing.',
        'Payment methods: Visa, Mastercard, Stripe, wire transfer (Enterprise).',
        'Disputes: Contact billing@flowzint.com with your account ID.',
        'Refund policy: Pro-rata refunds available within 7 days of charge.',
      ],
      api: [
        'API keys: Generate at flowzint.com/settings/api. Rate limits are configurable per key.',
        'Base URL: https://api.flowzint.com/v2. Supports REST and GraphQL.',
        'Auth: Bearer token in Authorization header. Keys rotate every 90 days by default.',
        'Webhook signatures: HMAC-SHA256 with your webhook secret.',
      ],
      account: [
        'Password reset: flowzint.com/auth/reset — link valid for 30 minutes.',
        'SSO: SAML 2.0 and OAuth 2.0 supported. Configure under Settings → SSO.',
        'Team roles: Owner, Admin, Developer, Viewer. Permissions are role-based.',
        'MFA: TOTP and SMS supported. Mandatory for Enterprise accounts.',
      ],
      integration: [
        'Native integrations: Slack, Salesforce, HubSpot, Zapier, Jira, PagerDuty.',
        'OAuth apps: Create at flowzint.com/settings/oauth-apps.',
        'Webhook events: 40+ event types. Retry policy: 3 attempts with exponential backoff.',
        'SDK: Available for Python, Node.js, Go, Ruby at docs.flowzint.com/sdk.',
      ],
      sla: [
        'Enterprise: 99.99% uptime, P1 response in 1 hour, P2 in 4 hours.',
        'Pro: 99.9% uptime, P1 response in 4 hours, P2 in 24 hours.',
        'Standard: 99.5% uptime. Community support only.',
        'SLA credits: Automatic for qualifying outages over 30 minutes.',
      ],
      security: [
        'Data encryption: AES-256 at rest, TLS 1.3 in transit.',
        'Compliance: SOC 2 Type II, ISO 27001, GDPR, CCPA certified.',
        'Penetration testing: Quarterly by third-party firms.',
        'Data residency: US (us-east-1), EU (eu-west-1), APAC (ap-southeast-1).',
      ],
    };

    const q = query.toLowerCase();
    const matched: string[] = [];
    for (const [topic, answers] of Object.entries(KB)) {
      if (q.includes(topic) || answers.some(a => a.toLowerCase().includes(q.split(' ')[0]))) {
        matched.push(...answers);
      }
    }

    const results = matched.length > 0 ? matched.slice(0, 3) : [
      'For detailed documentation visit docs.flowzint.com.',
      'Contact support@flowzint.com for specialized assistance.',
    ];

    await cacheSet(cacheKey, results, 300); // 5 min TTL
    return { success: true, data: results, message: `Found ${results.length} KB entries` };
  },

  /**
   * TOOL: create_support_ticket
   * Autonomously creates a support ticket on behalf of the user.
   */
  async create_support_ticket({
    sessionId, subject, priority, description,
  }: { sessionId: string; subject: string; priority: string; description: string }): Promise<ToolResult> {
    const ticket = await createTicket({ sessionId, subject, priority, description });
    return {
      success: true,
      data: ticket,
      message: `Ticket #${ticket.id} created with ${priority} priority`,
    };
  },

  /**
   * TOOL: check_system_status
   * Returns current Flowzint platform health status.
   */
  async check_system_status(_: {}): Promise<ToolResult> {
    const cached = await cacheGet('system:status');
    if (cached) return { success: true, data: cached, message: 'Status (cached)' };

    const status = {
      overall: 'operational',
      services: [
        { name: 'API Gateway',       status: 'operational',    latency: '42ms' },
        { name: 'Webhook Delivery',  status: 'operational',    latency: '89ms' },
        { name: 'Data Pipeline',     status: 'degraded',       latency: '320ms' },
        { name: 'Auth Service',      status: 'operational',    latency: '28ms' },
        { name: 'Analytics Engine',  status: 'operational',    latency: '156ms' },
      ],
      last_incident: '2026-06-15 — Resolved: Data Pipeline latency spike',
      uptime_30d: '99.94%',
    };

    await cacheSet('system:status', status, 60); // 1 min TTL
    return { success: true, data: status, message: 'System status retrieved' };
  },

  /**
   * TOOL: lookup_account_info
   * Returns mock account information for a session.
   */
  async lookup_account_info({ sessionId }: { sessionId: string }): Promise<ToolResult> {
    const history = await getConversationHistory(sessionId);
    const account = {
      plan: 'Enterprise',
      account_id: `ACC-${sessionId.slice(0, 6).toUpperCase()}`,
      status: 'active',
      since: '2024-03-01',
      support_tier: 'Priority',
      api_calls_this_month: 1_247_832,
      quota: 5_000_000,
      contacts: [
        { name: 'Enterprise Support', email: 'enterprise@flowzint.com' },
        { name: 'Account Manager', email: 'am-team@flowzint.com' },
      ],
    };
    return { success: true, data: account, message: 'Account info retrieved' };
  },

  /**
   * TOOL: lookup_invoice
   * Returns mock invoice data.
   */
  async lookup_invoice({ invoiceId }: { invoiceId?: string }): Promise<ToolResult> {
    const invoice = {
      id: invoiceId || 'INV-2026-0642',
      date: '2026-06-01',
      dueDate: '2026-06-15',
      status: 'Paid',
      amountDue: '$0.00',
      totalAmount: '$4,500.00',
      items: [
        { description: 'Flowzint Enterprise License (June)', amount: '$3,500.00' },
        { description: 'Overage: API Requests (1M)', amount: '$1,000.00' }
      ]
    };
    return { success: true, data: invoice, message: 'Invoice retrieved' };
  },

  /**
   * TOOL: calculate_sla_breach
   * Checks if current issue qualifies for SLA breach credit.
   */
  async calculate_sla_breach({ issue_duration_hours, priority }: { issue_duration_hours: number; priority: string }): Promise<ToolResult> {
    const thresholds: Record<string, number> = { P1: 1, P2: 4, P3: 24, P4: 72 };
    const threshold = thresholds[priority] ?? 24;
    const breached = issue_duration_hours > threshold;
    return {
      success: true,
      data: {
        breached,
        threshold_hours: threshold,
        credit_eligible: breached,
        estimated_credit: breached ? `${Math.min(100, Math.floor((issue_duration_hours / threshold) * 10))}%` : '0%',
      },
      message: breached ? `SLA breached — credit applicable` : 'Within SLA bounds',
    };
  },
};

export type ToolName = keyof typeof agentTools;

// ─── Tool Executor ────────────────────────────────────────────────────────────
export async function executeTool(name: ToolName, args: any): Promise<ToolResult> {
  const tool = agentTools[name];
  if (!tool) return { success: false, data: null, message: `Unknown tool: ${name}` };
  try {
    return await (tool as Function)(args);
  } catch (err: any) {
    return { success: false, data: null, message: err.message };
  }
}

// ─── Intent → Tool Map ────────────────────────────────────────────────────────
export function getToolsForIntent(intent: string): ToolName[] {
  const map: Record<string, ToolName[]> = {
    billing:     ['lookup_invoice', 'search_knowledge_base', 'lookup_account_info'],
    api:         ['search_knowledge_base', 'check_system_status'],
    account:     ['lookup_account_info', 'search_knowledge_base'],
    integration: ['search_knowledge_base'],
    sla:         ['check_system_status', 'calculate_sla_breach', 'search_knowledge_base'],
    technical:   ['check_system_status', 'search_knowledge_base'],
    general:     ['search_knowledge_base'],
  };
  return map[intent] ?? ['search_knowledge_base'];
}
