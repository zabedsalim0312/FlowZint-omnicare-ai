'use client';

import { useChatStore } from '@/store/chatStore';
import clsx from 'clsx';

export default function Sidebar() {
  const { activePanel, setActivePanel, connectionStatus, messages, tickets, clearMessages, liveContext } = useChatStore();

  const navItems = [
    {
      id: 'chat' as const,
      label: 'AI Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      badge: messages.filter(m => m.role === 'user').length || null,
    },
    {
      id: 'tickets' as const,
      label: 'Tickets',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      badge: tickets.filter(t => t.status === 'open').length || null,
    },
    {
      id: 'analytics' as const,
      label: 'Analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      badge: null,
    },
  ];

  const statusConfig = {
    connected:    { color: 'bg-emerald-400', label: 'Connected', glow: 'shadow-emerald-400' },
    connecting:   { color: 'bg-amber-400',   label: 'Connecting...', glow: 'shadow-amber-400' },
    disconnected: { color: 'bg-slate-500',   label: 'Offline', glow: '' },
    error:        { color: 'bg-red-400',     label: 'Error', glow: 'shadow-red-400' },
  };
  const status = statusConfig[connectionStatus];

  return (
    <aside className="w-64 flex flex-col glass border-r border-white/5">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center glow-brand shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Flowzint</p>
            <p className="text-[10px] text-indigo-400 mt-0.5">OmniCare AI</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
          <div className="relative">
            <div className={clsx('w-2 h-2 rounded-full', status.color)} />
            {connectionStatus === 'connected' && (
              <div className={clsx('absolute inset-0 rounded-full pulse-ring', status.color, 'opacity-60')} />
            )}
          </div>
          <span className="text-xs text-slate-400">{status.label}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest px-2 mb-3">
          Support Center
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              activePanel === item.id
                ? 'gradient-brand text-white glow-brand shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge !== null && item.badge > 0 && (
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                activePanel === item.id
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-500/20 text-indigo-400'
              )}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Live Agent Context Panel */}
      {liveContext && (
        <div className="px-3 py-3 mx-3 mb-3 bg-white/5 border border-white/10 rounded-xl fade-up">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Live Context
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-black/20 rounded p-1.5 px-2">
              <span className="text-xs text-slate-400">Sentiment</span>
              <span className="text-xs font-medium text-white flex items-center gap-1">
                {liveContext.emoji} <span className="capitalize">{liveContext.sentiment}</span>
              </span>
            </div>
            <div className="flex justify-between items-center bg-black/20 rounded p-1.5 px-2">
              <span className="text-xs text-slate-400">Intent</span>
              <span className="text-xs font-medium text-white capitalize">{liveContext.intent}</span>
            </div>
            <div className="flex justify-between items-center bg-black/20 rounded p-1.5 px-2">
              <span className="text-xs text-slate-400">Action</span>
              <span className="text-xs font-medium text-cyan-300">{liveContext.suggestedAction}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="px-3 py-4 border-t border-white/5 space-y-1">
        <button
          onClick={clearMessages}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear Chat
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            U
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">Enterprise User</p>
            <p className="text-[10px] text-slate-500 truncate">Flowzint Client</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
