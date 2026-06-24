// ─── OmniCare AI: tool registry ───────────────────────────────────────────────
// Each tool is a typed unit of work the model can call. The model decides when
// to invoke a tool — we never match keywords on the client or the server.

import {
  checkServerStatus,
  createTicket,
  getTicketStatus,
  getInvoice,
  escalateToHuman,
  searchKnowledgeBase,
} from "./backends";

// ─── JSON Schema helpers (kept tiny so we don't pull in a dep) ───────────────
type JSONSchema = Record<string, unknown>;

const stringProp = (description: string, minLength = 1): JSONSchema => ({
  type: "string",
  minLength,
  description,
});

const enumProp = (description: string, values: string[]): JSONSchema => ({
  type: "string",
  enum: values,
  description,
});

const numberProp = (description: string): JSONSchema => ({
  type: "number",
  description,
});

const boolProp = (description: string): JSONSchema => ({
  type: "boolean",
  description,
});

// ─── Tool shape exposed to Gemini via `tools[].functionDeclarations` ─────────
export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}

export interface ToolContext {
  requestId: string;
  ip: string;
  sessionId?: string;
}

// ─── Registry ────────────────────────────────────────────────────────────────
export const tools: ToolDefinition[] = [
  {
    name: "check_server_status",
    description:
      "Check the current health of the Flowzint platform and its services. Use this when the user asks whether the system is up, reports a slow/down service, or asks for an incident status. Returns an overall health verdict plus per-service status.",
    parameters: {
      type: "object",
      properties: {
        region: enumProp("Optional AWS region to scope the check to.", [
          "us-east-1",
          "eu-west-1",
          "ap-southeast-1",
        ]),
      },
      additionalProperties: false,
    },
    execute: (args) =>
      checkServerStatus({ region: (args as { region?: string }).region }),
  },
  {
    name: "create_ticket",
    description:
      "Open a new support ticket in the ticketing system (Zendesk-shaped). Use this when the user explicitly asks to file a ticket, open a case, or get follow-up from a human. Returns the created ticket including its id and priority.",
    parameters: {
      type: "object",
      properties: {
        subject: stringProp(
          "Short, one-line summary of the issue. Max 120 chars.",
          1,
        ),
        description: stringProp(
          "Full description of the issue, with any relevant context. Max 4000 chars.",
          1,
        ),
        priority: enumProp("Urgency of the ticket.", ["P1", "P2", "P3", "P4"]),
        customerEmail: stringProp(
          "Customer contact email. Required so a human can follow up.",
          1,
        ),
      },
      required: ["subject", "description", "priority", "customerEmail"],
      additionalProperties: false,
    },
    execute: (args: unknown, ctx) =>
      createTicket({
        sessionId: ctx.sessionId,
        subject: (args as { subject: string }).subject,
        description: (args as { description: string }).description,
        priority: (args as { priority: "P1" | "P2" | "P3" | "P4" }).priority,
        customerEmail: (args as { customerEmail: string }).customerEmail,
      }),
  },
  {
    name: "get_ticket_status",
    description:
      "Look up the current status and last update of an existing support ticket by its id. Use this when the user asks about a specific ticket or wants an update on a case they previously opened.",
    parameters: {
      type: "object",
      properties: {
        ticketId: stringProp(
          "The id of the ticket to look up (e.g. T-1042).",
          1,
        ),
      },
      required: ["ticketId"],
      additionalProperties: false,
    },
    execute: (args: unknown) =>
      getTicketStatus({ ticketId: (args as { ticketId: string }).ticketId }),
  },
  {
    name: "get_invoice",
    description:
      "Retrieve the most recent (or a specific) invoice for a customer. Use this when the user asks about a charge, a billing question, a receipt, or wants to confirm a payment. Returns line items, total, and status.",
    parameters: {
      type: "object",
      properties: {
        customerEmail: stringProp("Customer email on the account.", 1),
        invoiceId: stringProp(
          "Optional specific invoice id. If omitted, returns the latest.",
          1,
        ),
      },
      required: ["customerEmail"],
      additionalProperties: false,
    },
    execute: (args: unknown) =>
      getInvoice({
        customerEmail: (args as { customerEmail: string }).customerEmail,
        invoiceId: (args as { invoiceId?: string }).invoiceId,
      }),
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate the conversation to a human support agent. Creates an urgent (P1) ticket and notifies the on-call channel. Use this only when the user explicitly asks for a human, expresses legal/safety concerns, or is clearly frustrated after multiple failed resolutions.",
    parameters: {
      type: "object",
      properties: {
        reason: stringProp(
          "Short reason for the escalation (will be included in the ticket).",
          1,
        ),
        urgency: enumProp("How urgent the escalation is.", [
          "high",
          "medium",
          "low",
        ]),
        customerEmail: stringProp(
          "Customer contact email so a human can reach them.",
          1,
        ),
      },
      required: ["reason", "urgency", "customerEmail"],
      additionalProperties: false,
    },
    execute: (args: unknown, ctx) =>
      escalateToHuman({
        sessionId: ctx.sessionId,
        reason: (args as { reason: string }).reason,
        urgency: (args as { urgency: "high" | "medium" | "low" }).urgency,
        customerEmail: (args as { customerEmail: string }).customerEmail,
      }),
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the Flowzint knowledge base for documentation articles relevant to the user's question. Use this for product, API, integration, billing, account, and SLA questions to ground your answer in official docs.",
    parameters: {
      type: "object",
      properties: {
        query: stringProp("Natural language search query.", 1),
        topK: numberProp("How many results to return. Defaults to 3, max 5."),
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: (args: unknown) =>
      searchKnowledgeBase({
        query: (args as { query: string }).query,
        topK: Math.min((args as { topK?: number }).topK ?? 3, 5),
      }),
  },
];

// ─── Helpers used by the route handler ───────────────────────────────────────
export function findTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}

// Shape Gemini expects in the `tools` field of generateContent.
export function geminiToolDeclarations() {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

// Suppress unused-import hints for the helpers above in some configs.
void stringProp;
void boolProp;
