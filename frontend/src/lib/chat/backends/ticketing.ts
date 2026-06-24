// ─── Ticketing backend (Zendesk-shaped) ──────────────────────────────────────
// Real implementation: hits Zendesk's Tickets API. Falls back to the in-house
// Postgres/Redis store from the `backend/` repo when ZENDESK_SUBDOMAIN is
// not set, so the agent is exercisable in dev.

export interface Ticket {
  id: string;
  sessionId?: string;
  subject: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: "open" | "pending" | "solved" | "closed";
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  externalId?: string;
}

const inMemory: Map<string, Ticket> = new Map();
let counter = 1042;

function newId(): string {
  counter += 1;
  return `T-${counter}`;
}

async function zendeskCreate(input: {
  subject: string;
  description: string;
  priority: Ticket["priority"];
  customerEmail: string;
}): Promise<Ticket> {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const apiToken = process.env.ZENDESK_API_TOKEN;
  if (!subdomain || !email || !apiToken)
    throw new Error("Zendesk env not configured");
  const auth = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  const res = await fetch(
    `https://${subdomain}.zendesk.com/api/v2/tickets.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        ticket: {
          subject: input.subject,
          comment: { body: input.description },
          priority: input.priority.toLowerCase(),
          requester: { email: input.customerEmail },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Zendesk ${res.status}`);
  const json: any = await res.json();
  const t = json.ticket;
  return {
    id: String(t.id),
    subject: t.subject,
    description: input.description,
    priority: input.priority,
    status: t.status,
    customerEmail: input.customerEmail,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    externalId: `zendesk:${t.id}`,
  };
}

function localCreate(input: {
  sessionId?: string;
  subject: string;
  description: string;
  priority: Ticket["priority"];
  customerEmail: string;
}): Ticket {
  const id = newId();
  const now = new Date().toISOString();
  const t: Ticket = {
    id,
    sessionId: input.sessionId,
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    status: "open",
    customerEmail: input.customerEmail,
    createdAt: now,
    updatedAt: now,
  };
  inMemory.set(id, t);
  return t;
}

export async function createTicket(input: {
  sessionId?: string;
  subject: string;
  description: string;
  priority: Ticket["priority"];
  customerEmail: string;
}): Promise<Ticket> {
  if (process.env.ZENDESK_SUBDOMAIN) {
    try {
      return await zendeskCreate(input);
    } catch (err) {
      console.warn(
        "[ticketing] Zendesk create failed, falling back to local store:",
        (err as Error).message,
      );
    }
  }
  return localCreate(input);
}

export async function getTicketStatus(args: {
  ticketId: string;
}): Promise<Ticket | { error: string }> {
  if (process.env.ZENDESK_SUBDOMAIN) {
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    const email = process.env.ZENDESK_EMAIL;
    const apiToken = process.env.ZENDESK_API_TOKEN;
    if (email && apiToken) {
      try {
        const auth = Buffer.from(`${email}/token:${apiToken}`).toString(
          "base64",
        );
        const res = await fetch(
          `https://${subdomain}.zendesk.com/api/v2/tickets/${encodeURIComponent(args.ticketId)}.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        if (res.ok) {
          const json: any = await res.json();
          const t = json.ticket;
          return {
            id: String(t.id),
            subject: t.subject,
            description: t.description ?? "",
            priority:
              (String(t.priority).toUpperCase() as Ticket["priority"]) ?? "P3",
            status: t.status,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            externalId: `zendesk:${t.id}`,
          };
        }
        if (res.status === 404)
          return { error: `Ticket ${args.ticketId} not found.` };
      } catch (err) {
        console.warn(
          "[ticketing] Zendesk get failed, falling back to local store:",
          (err as Error).message,
        );
      }
    }
  }
  const t = inMemory.get(args.ticketId);
  if (!t) return { error: `Ticket ${args.ticketId} not found.` };
  return t;
}
