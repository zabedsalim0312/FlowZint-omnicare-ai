// ─── Sentiment Analysis Engine ────────────────────────────────────────────────
// Classifies user sentiment and adapts AI tone accordingly.

export type SentimentLabel = 'positive' | 'neutral' | 'frustrated' | 'angry' | 'urgent';
export type ToneAdaptation = 'empathetic' | 'professional' | 'concise' | 'reassuring' | 'escalating';

export interface SentimentResult {
  label: SentimentLabel;
  score: number;          // 0–1 confidence
  tone: ToneAdaptation;
  escalationRisk: number; // 0–1, probability of needing human
  emoji: string;
}

// ─── Keyword Lexicons ─────────────────────────────────────────────────────────
const ANGRY_KEYWORDS = [
  'terrible', 'awful', 'horrible', 'useless', 'ridiculous', 'disgusting',
  'unacceptable', 'furious', 'outraged', 'incompetent', 'scam', 'fraud',
  'demand', 'lawsuit', 'refund now', 'cancel immediately', 'this is bs',
];

const FRUSTRATED_KEYWORDS = [
  'not working', "doesn't work", 'broken', 'failed', 'error', 'issue',
  'problem', 'stuck', 'frustrated', 'why is', 'impossible', 'can\'t',
  'unable', 'keeps failing', 'again', 'still not', 'hours', 'days',
];

const URGENT_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'right now', 'emergency', 'critical',
  'production down', 'outage', 'down', 'not responding', 'sla breach',
  'escalate', 'manager', 'supervisor', 'deadline',
];

const POSITIVE_KEYWORDS = [
  'thank', 'great', 'excellent', 'helpful', 'amazing', 'perfect',
  'love', 'appreciate', 'resolved', 'works', 'fixed', 'awesome', 'good',
];

// ─── Analyze ──────────────────────────────────────────────────────────────────
export function analyzeSentiment(message: string): SentimentResult {
  const text = message.toLowerCase();
  const words = text.split(/\s+/);

  let angryScore = 0, frustratedScore = 0, urgentScore = 0, positiveScore = 0;

  for (const kw of ANGRY_KEYWORDS) {
    if (text.includes(kw)) angryScore += 1.5;
  }
  for (const kw of FRUSTRATED_KEYWORDS) {
    if (text.includes(kw)) frustratedScore += 1;
  }
  for (const kw of URGENT_KEYWORDS) {
    if (text.includes(kw)) urgentScore += 1.2;
  }
  for (const kw of POSITIVE_KEYWORDS) {
    if (text.includes(kw)) positiveScore += 1;
  }

  // Amplifiers
  if (text.includes('!')) angryScore += 0.3 * (text.match(/!/g)?.length ?? 0);
  if (text === text.toUpperCase() && text.length > 10) angryScore += 1;

  const maxScore = Math.max(angryScore, frustratedScore, urgentScore, positiveScore);

  let label: SentimentLabel;
  let tone: ToneAdaptation;
  let escalationRisk: number;
  let emoji: string;
  let score: number;

  if (angryScore >= 2 || (angryScore > 0 && text.length < 50)) {
    label = 'angry'; tone = 'empathetic'; escalationRisk = 0.85; emoji = '😠';
    score = Math.min(1, angryScore / 4);
  } else if (urgentScore >= 2) {
    label = 'urgent'; tone = 'concise'; escalationRisk = 0.70; emoji = '🚨';
    score = Math.min(1, urgentScore / 4);
  } else if (frustratedScore >= 1.5) {
    label = 'frustrated'; tone = 'reassuring'; escalationRisk = 0.45; emoji = '😤';
    score = Math.min(1, frustratedScore / 3);
  } else if (positiveScore >= 1) {
    label = 'positive'; tone = 'professional'; escalationRisk = 0.05; emoji = '😊';
    score = Math.min(1, positiveScore / 3);
  } else {
    label = 'neutral'; tone = 'professional'; escalationRisk = 0.10; emoji = '😐';
    score = 0.5;
  }

  return { label, score, tone, escalationRisk, emoji };
}

// ─── Tone-Adapted Prefix ──────────────────────────────────────────────────────
export function getTonePrefix(tone: ToneAdaptation, sentiment: SentimentLabel): string {
  const prefixes: Record<ToneAdaptation, string> = {
    empathetic:   "I completely understand your frustration, and I sincerely apologize for the trouble. Let me resolve this for you right away. ",
    reassuring:   "I hear you, and I want to make sure we get this sorted out. Don't worry — ",
    concise:      "On it immediately. ",
    professional: "",
    escalating:   "I've flagged this as high priority. A senior support engineer will be in touch shortly. Meanwhile, ",
  };
  return prefixes[tone] ?? '';
}
