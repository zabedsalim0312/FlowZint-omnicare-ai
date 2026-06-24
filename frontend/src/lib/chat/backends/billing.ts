// ─── Billing backend (Stripe-shaped) ─────────────────────────────────────────
// Real implementation: hits Stripe's Invoices API. Falls back to a deterministic
// mock invoice store when STRIPE_SECRET_KEY is not set.

export interface InvoiceLineItem {
  description: string;
  amountCents: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  customerEmail: string;
  status: "paid" | "open" | "void" | "uncollectible";
  totalCents: number;
  currency: string;
  issuedAt: string;
  paidAt?: string;
  lineItems: InvoiceLineItem[];
  hostedUrl?: string;
}

const mockInvoices: Invoice[] = [
  {
    id: "INV-2025-0042",
    customerEmail: "demo@flowzint.com",
    status: "paid",
    totalCents: 24900,
    currency: "usd",
    issuedAt: "2025-03-01T00:00:00.000Z",
    paidAt: "2025-03-01T03:14:22.000Z",
    hostedUrl: "https://invoice.stripe.com/i/mock_42",
    lineItems: [
      {
        description: "Flowzint Pro plan — monthly",
        amountCents: 19900,
        quantity: 1,
      },
      { description: "Additional seats × 2", amountCents: 5000, quantity: 2 },
    ],
  },
  {
    id: "INV-2025-0091",
    customerEmail: "demo@flowzint.com",
    status: "open",
    totalCents: 24900,
    currency: "usd",
    issuedAt: "2025-04-01T00:00:00.000Z",
    hostedUrl: "https://invoice.stripe.com/i/mock_91",
    lineItems: [
      {
        description: "Flowzint Pro plan — monthly",
        amountCents: 19900,
        quantity: 1,
      },
      { description: "Additional seats × 2", amountCents: 5000, quantity: 2 },
    ],
  },
];

async function stripeLookup(args: {
  customerEmail: string;
  invoiceId?: string;
}): Promise<Invoice | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Find customer by email.
  const custRes = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(args.customerEmail)}&limit=1`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!custRes.ok) return null;
  const custJson: any = await custRes.json();
  const customer = custJson.data?.[0];
  if (!customer) return null;
  const path = args.invoiceId
    ? `/v1/invoices/${encodeURIComponent(args.invoiceId)}`
    : `/v1/invoices?customer=${customer.id}&limit=1`;
  const invRes = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!invRes.ok) return null;
  const invJson: any = await invRes.json();
  const inv = args.invoiceId ? invJson : invJson.data?.[0];
  if (!inv) return null;
  return {
    id: inv.id,
    customerEmail: args.customerEmail,
    status: inv.status,
    totalCents: inv.amount_paid ?? inv.amount_due ?? 0,
    currency: inv.currency,
    issuedAt: new Date(inv.created * 1000).toISOString(),
    paidAt:
      inv.status === "paid"
        ? new Date(inv.created * 1000).toISOString()
        : undefined,
    hostedUrl: inv.hosted_invoice_url,
    lineItems: (inv.lines?.data ?? []).map((l: any) => ({
      description: l.description,
      amountCents: l.amount,
      quantity: l.quantity ?? 1,
    })),
  };
}

function mockLookup(args: {
  customerEmail: string;
  invoiceId?: string;
}): Invoice | null {
  const list = mockInvoices.filter(
    (i) => i.customerEmail === args.customerEmail,
  );
  if (args.invoiceId) return list.find((i) => i.id === args.invoiceId) ?? null;
  return list[0] ?? null;
}

export async function getInvoice(args: {
  customerEmail: string;
  invoiceId?: string;
}): Promise<Invoice | { error: string }> {
  const inv =
    (await stripeLookup(args).catch((err) => {
      console.warn(
        "[billing] Stripe failed, falling back to mock:",
        (err as Error).message,
      );
      return null;
    })) ?? mockLookup(args);
  if (!inv)
    return {
      error: `No invoice found for ${args.customerEmail}${args.invoiceId ? ` with id ${args.invoiceId}` : ""}.`,
    };
  return inv;
}
