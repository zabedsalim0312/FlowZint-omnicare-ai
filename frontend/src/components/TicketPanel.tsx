'use client';

import { useEffect, useState } from 'react';
import { useChatStore, Ticket, TicketPriority } from '@/store/chatStore';
import clsx from 'clsx';

const PRIORITY_CONFIG = {
  low:      { color: 'text-emerald-400 bg-emerald-400/10', dot: 'bg-emerald-400', label: 'Low' },
  medium:   { color: 'text-amber-400 bg-amber-400/10',     dot: 'bg-amber-400',   label: 'Medium' },
  high:     { color: 'text-orange-400 bg-orange-400/10',   dot: 'bg-orange-400',  label: 'High' },
  critical: { color: 'text-red-400 bg-red-400/10',         dot: 'bg-red-400',     label: 'Critical' },
};

const STATUS_CONFIG = {
  open:        { color: 'text-blue-400 bg-blue-400/10',     label: 'Open' },
  in_progress: { color: 'text-violet-400 bg-violet-400/10', label: 'In Progress' },
  resolved:    { color: 'text-emerald-400 bg-emerald-400/10', label: 'Resolved' },
  closed:      { color: 'text-slate-400 bg-slate-400/10',   label: 'Closed' },
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  const pr = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const date = new Date(ticket.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="glass rounded-xl p-4 hover:bg-white/5 transition-all duration-200 fade-up group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 text-xs font-mono shrink-0">#{ticket.id}</span>
          <h4 className="text-sm font-medium text-white truncate">{ticket.subject}</h4>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1', pr.color)}>
            <span className={clsx('w-1 h-1 rounded-full', pr.dot)} />
            {pr.label}
          </span>
          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', st.color)}>
            {st.label}
          </span>
        </div>
      </div>
      {ticket.description && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{ticket.description}</p>
      )}
      <p className="text-[10px] text-slate-600">{date}</p>
    </div>
  );
}

export default function TicketPanel() {
  const { tickets, loadTickets, createTicket, sessionId } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', priority: 'medium' as TicketPriority, description: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) return;
    setIsLoading(true);
    await createTicket(form);
    setForm({ subject: '', priority: 'medium', description: '' });
    setIsCreating(false);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Support Tickets</h2>
          <p className="text-xs text-slate-500 mt-0.5">{tickets.length} total tickets</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 gradient-brand text-white text-xs font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all glow-brand"
        >
          + New Ticket
        </button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="px-6 py-4 border-b border-white/5 bg-white/2">
          <h3 className="text-sm font-semibold text-white mb-3">Create New Ticket</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Subject *"
              value={form.subject}
              onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-colors"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
            >
              <option value="low">🟢 Low Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="high">🟠 High Priority</option>
              <option value="critical">🔴 Critical</option>
            </select>
            <textarea
              placeholder="Describe the issue..."
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 resize-none transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 gradient-brand text-white text-sm font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Ticket'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 glass text-slate-400 text-sm rounded-lg hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-4xl">🎫</div>
            <p className="text-slate-400 text-sm">No tickets yet.</p>
            <p className="text-slate-600 text-xs">Create a ticket to track your support requests.</p>
          </div>
        ) : (
          tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
        )}
      </div>
    </div>
  );
}
