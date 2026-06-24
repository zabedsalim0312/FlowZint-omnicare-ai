'use client';

import { useChatStore } from '@/store/chatStore';
import clsx from 'clsx';

const PANEL_META = {
  chat:      { title: 'AI Chat Support', subtitle: 'Real-time intelligent assistance', icon: '💬' },
  tickets:   { title: 'Support Tickets',  subtitle: 'Track and manage your issues', icon: '🎫' },
  analytics: { title: 'Analytics',        subtitle: 'Platform performance insights', icon: '📊' },
};

export default function Header() {
  const { activePanel, connectionStatus, toggleSidebar } = useChatStore();
  const meta = PANEL_META[activePanel];

  const isConnected = connectionStatus === 'connected';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 glass">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-slate-400 hover:text-white transition-colors lg:hidden"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{meta.icon}</span>
            <h1 className="text-base font-semibold text-white">{meta.title}</h1>
          </div>
          <p className="text-xs text-slate-500">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right: status indicators */}
      <div className="flex items-center gap-3">
        {/* AI Engine Badge */}
        <div className="hidden sm:flex items-center gap-2 glass rounded-full px-3 py-1.5">
          <span className="text-xs text-slate-400">Engine</span>
          <span className="text-xs font-semibold gradient-text">GPT-4o / Claude 3.5</span>
        </div>

        {/* SLA indicator */}
        <div className="hidden md:flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">99.9% SLA</span>
        </div>

        {/* Live dot */}
        <div className={clsx(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
          isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'
        )}>
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full',
            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
          )} />
          {isConnected ? 'Live' : 'Demo'}
        </div>
      </div>
    </header>
  );
}
