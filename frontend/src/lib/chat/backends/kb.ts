// KB backend stub
export interface KbHit {
  title: string;
  url: string;
  snippet: string;
  score: number;
}
export interface KbResult {
  hits: KbHit[];
}
export async function searchKnowledgeBase(args: {
  query: string;
  topK?: number;
}): Promise<KbResult> {
  const docs: Array<{ title: string; url: string; body: string }> = [
    {
      title: "API quickstart",
      url: "docs.flowzint.com/api",
      body: "Generate API keys at flowzint.com/settings/api. REST and GraphQL are supported.",
    },
    {
      title: "Billing cycles",
      url: "docs.flowzint.com/billing",
      body: "Invoices are issued on the 1st. Update payment method in Settings > Billing.",
    },
    {
      title: "SSO setup",
      url: "docs.flowzint.com/sso",
      body: "SAML 2.0 SSO is available on Enterprise. Configure under Settings > Auth.",
    },
    {
      title: "Webhooks",
      url: "docs.flowzint.com/webhooks",
      body: "Configure webhook endpoints with HMAC-SHA256 signing under Settings > Integrations.",
    },
    {
      title: "Rate limits",
      url: "docs.flowzint.com/rate-limits",
      body: "Default rate limit is 600 req/min. Bursts up to 1000 req/min are allowed.",
    },
  ];
  const q = args.query.toLowerCase();
  const scored = docs.map((d) => ({
    d,
    score:
      (d.title.toLowerCase().includes(q) ? 2 : 0) +
      (d.body.toLowerCase().includes(q) ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, args.topK ?? 3);
  return {
    hits: top.map((s) => ({
      title: s.d.title,
      url: s.d.url,
      snippet: s.d.body,
      score: s.score,
    })),
  };
}
