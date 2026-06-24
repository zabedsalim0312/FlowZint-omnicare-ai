// ─── Escalation backend (P1 ticket + on-call notification) ───────────────────
// Always creates an urgent ticket via the ticketing backend, then pings the
// on-call channel (Slack/PagerDuty-shaped webhook) if ESCALATION_WEBHOOK_URL
// is set. In dev (no URL), the notification is logged only.

import { createTicket, type Ticket } from "./ticketing";

export interface EscalationResult {
  ticket: Ticket;
  notified: boolean;
  channel: string;
}

export async function escalateToHuman(args: {
  sessionId?: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  customerEmail: string;
}): Promise<EscalationResult> {
  const priority: Ticket["priority"] =
    args.urgency === "high" ? "P1" : args.urgency === "medium" ? "P2" : "P3";

  const ticket = await createTicket({
    sessionId: args.sessionId,
    subject: `Escalation: ${args.reason.slice(0, 80)}`,
    description: `Customer requested human escalation.\nUrgency: ${args.urgency}\nReason: ${args.reason}`,
    priority,
    customerEmail: args.customerEmail,
  });

  let notified = false;
  const channel = process.env.ESCALATION_WEBHOOK_URL ? "webhook" : "log";
  if (process.env.ESCALATION_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.ESCALATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `:rotating_light: *Escalation* — ticket ${ticket.id} (${priority}) for ${args.customerEmail}: ${args.reason}`,
          ticket,
        }),
      });
      notified = res.ok;
    } catch (err) {
      console.warn("[escalation] webhook failed:", (err as Error).message);
    }
  } else {
    console.log(
      `[escalation] (no webhook configured) ticket ${ticket.id} (${priority}) for ${args.customerEmail}: ${args.reason}`,
    );
  }

  return { ticket, notified, channel };
}
