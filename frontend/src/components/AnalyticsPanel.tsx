'use client';

import { useChatStore } from '@/store/chatStore';

const STATS = [
  { label: 'Avg Response', value: '< 2s', icon: '⚡', change: '+12%', positive: true },
  { label: 'Resolution Rate', value: '94.7%', icon: '✅', change: '+3.2%', positive: true },
  { label: 'Active Sessions', value: '1,247', icon: '👥', change: '+8.1%', positive: true },
  { label: 'Escalations', value: '2.1%', icon: '📈', change: '-0.4%', positive: true },
];

const PERFORMANCE = [
  { label: 'Billing Queries', pct: 87 },
  { label: 'API Support', pct: 92 },
  { label: 'Account Issues', pct: 79 },
  { label: 'Integrations', pct: 95 },
  { label: 'Technical Debug', pct: 83 },
];

const RECENT_ACTIVITY = [
  { action: 'Ticket #1021 resolved', time: '2 min ago', icon: '✅' },
  { action: 'API key regenerated for ACME Corp', time: '8 min ago', icon: '🔑' },
  { action: 'SLA breach alert — P1 escalated', time: '14 min ago', icon: '🚨' },
  { action: 'New integration: Salesforce CRM', time: '31 min ago', icon: '🔗' },
  { action: 'Billing invoice dispute closed', time: '1 hr ago', icon: '💵' },
];

function BarChart({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function AnalyticsPanel() {
  const { messages, tickets } = useChatStore();
  const totalMsgs = messages.length;
  const userMsgs = messages.filter(m => m.role === 'user').length;
  const openTickets = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="text-base font-semibold text-white">Analytics Dashboard</h2>
        <p className="text-xs text-slate-500 mt-0.5">Real-time performance overview</p>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Session Stats */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Your Session</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Messages', value: totalMsgs, icon: '💬' },
              { label: 'Queries', value: userMsgs, icon: '❓' },
              { label: 'Open Tickets', value: openTickets, icon: '🎫' },
            ].map(stat => (
              <div key={stat.label} className="glass rounded-xl p-3 text-center">
                <p className="text-xl mb-1">{stat.icon}</p>
                <p className="text-2xl font-bold gradient-text">{stat.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Stats */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Platform KPIs</h3>
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{s.icon}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    s.positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                  }`}>
                    {s.change}
                  </span>
                </div>
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Performance */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">AI Resolution by Topic</h3>
          <div className="space-y-3">
            {PERFORMANCE.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{p.label}</span>
                  <span className="text-indigo-400 font-semibold">{p.pct}%</span>
                </div>
                <BarChart
                  pct={p.pct}
                  color={p.pct >= 90 ? 'bg-emerald-500' : p.pct >= 80 ? 'bg-indigo-500' : 'bg-amber-500'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} className="glass rounded-lg px-3 py-2.5 flex items-center gap-3">
                <span className="text-base shrink-0">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{a.action}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
