'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore, Message } from '@/store/chatStore';
import clsx from 'clsx';

// ─── Widget Types ─────────────────────────────────────────────────────────────
interface StatusWidget {
  type: 'ui_status';
  data: { overall: string; services: { name: string; status: string }[] };
}
interface TicketWidget {
  type: 'ui_ticket';
  ticket: { id: string; priority: string };
}
interface ToolCallWidget {
  type: 'ui_tool_call';
  action: string;
}
interface InvoiceWidget {
  type: 'ui_invoice';
  invoice: {
    id: string;
    dueDate: string;
    status: string;
    items: { description: string; amount: string }[];
    totalAmount: string;
  };
}
type Widget = StatusWidget | TicketWidget | ToolCallWidget | InvoiceWidget;

// ─── Markdown renderer ──────────────────────────────────────────────────────
function getTextWithoutJsonBlocks(text: string): string {
  return text.replace(/```json\n[\s\S]*?\n```/g, '').trim();
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4 fade-up">
      <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0 glow-brand">
        AI
      </div>
      <div className="glass rounded-2xl rounded-bl-none px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-violet-400 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
        </div>
      </div>
    </div>
  );
}

// ─── Individual Message ───────────────────────────────────────────────────────
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const textWithoutJson = getTextWithoutJsonBlocks(message.content);

  const widgets: Widget[] = [];
  const jsonBlocks = message.content.match(/```json\n([\s\S]*?)\n```/g);
  if (jsonBlocks) {
    jsonBlocks.forEach((block) => {
      try {
        const jsonStr = block.replace(/```json\n/, '').replace(/\n```/, '');
        const data = JSON.parse(jsonStr);
        widgets.push(data);
      } catch {}
    });
  }

  return (
    <div
      className={clsx(
        'flex items-end gap-3 mb-4 fade-up',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          isUser
            ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
            : 'gradient-brand glow-brand text-white'
        )}
      >
        {isUser ? 'ME' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={clsx('max-w-[75%] relative', isUser ? 'items-end' : 'items-start')}>
        {isUser ? (
          <div
            className={clsx(
              'px-4 py-3 rounded-2xl text-sm leading-relaxed',
              isUser
                ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-none shadow-lg shadow-indigo-900/30'
                : 'glass text-slate-100 rounded-bl-none'
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  if (match) {
                    return <code className={className} {...props}>{children}</code>;
                  }
                  return <code className="bg-white/10 px-1 py-0.5 rounded text-cyan-300 text-sm" {...props}>{children}</code>;
                },
                a: ({ href, children, ...props }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300" {...props}>
                    {children}
                  </a>
                ),
              }}
            >
              {textWithoutJson}
            </ReactMarkdown>
          </div>
        ) : (
          <div
            className={clsx(
              'px-4 py-3 rounded-2xl text-sm leading-relaxed',
              isUser
                ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-none shadow-lg shadow-indigo-900/30'
                : 'glass text-slate-100 rounded-bl-none'
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  if (match) {
                    return <code className={className} {...props}>{children}</code>;
                  }
                  return <code className="bg-white/10 px-1 py-0.5 rounded text-cyan-300 text-sm" {...props}>{children}</code>;
                },
                a: ({ href, children, ...props }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300" {...props}>
                    {children}
                  </a>
                ),
              }}
            >
              {textWithoutJson}
            </ReactMarkdown>
          </div>
        )}
        {widgets.map((w, i) => {
          if (w.type === 'ui_status') {
            return (
              <div key={i} className="mt-3 p-3 bg-indigo-900/40 rounded-xl border border-indigo-500/30 w-full max-w-sm fade-up">
                <div className="font-semibold text-white mb-2 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  System Status: {w.data?.overall}
                </div>
                <div className="space-y-1 text-xs">
                  {w.data?.services?.map((s: { name: string; status: string }, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-300">{s.name}</span>
                      <span className={s.status === 'operational' ? 'text-emerald-400' : 'text-amber-400'}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (w.type === 'ui_ticket') {
             return (
              <div key={i} className="mt-3 p-3 bg-rose-900/40 rounded-xl border border-rose-500/30 w-full max-w-sm fade-up">
                <div className="font-semibold text-white mb-1 text-sm flex items-center gap-2">
                  🚨 Escalation Ticket Created
                </div>
                <div className="text-xs text-slate-300">
                  Ticket ID: <span className="text-white font-mono">{w.ticket?.id}</span><br/>
                  Priority: <span className="text-rose-400">{w.ticket?.priority}</span>
                </div>
              </div>
            );
          }
          if (w.type === 'ui_tool_call') {
            return (
              <div key={i} className="mt-2 mb-2 px-3 py-1.5 bg-slate-800/50 rounded-lg inline-flex items-center gap-2 border border-slate-700/50 fade-up">
                <svg className="w-3.5 h-3.5 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs text-slate-300 font-medium">{w.action}</span>
              </div>
            );
          }
          if (w.type === 'ui_invoice') {
            return (
              <div key={i} className="mt-3 p-4 bg-slate-900/60 rounded-xl border border-slate-700/50 w-full max-w-sm fade-up shadow-xl shadow-black/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-white font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Invoice {w.invoice.id}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Due {w.invoice.dueDate}</p>
                  </div>
                  <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", w.invoice.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400')}>
                    {w.invoice.status}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  {w.invoice.items.map((item: { description: string; amount: string }, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-slate-300">{item.description}</span>
                      <span className="text-white font-medium">{item.amount}</span>
                    </div>
                  ))}
                  <div className="border-t border-white/10 pt-2 flex justify-between font-semibold mt-2">
                    <span className="text-slate-300">Total</span>
                    <span className="text-white">{w.invoice.totalAmount}</span>
                  </div>
                </div>

                <button className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </button>
              </div>
            );
          }
          return null;
        })}
        {message.isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse" />
        )}
        <p
          className={clsx(
            'text-[10px] text-slate-500 mt-1 px-1',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────
export default function ChatWindow() {
  const { messages, isTyping, sendMessage, inputValue, setInputValue, connectionStatus } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const QUICK_REPLIES = [
    "Track Order",
    "Billing Issue",
    "Talk to Human",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOffline = connectionStatus === 'disconnected' || connectionStatus === 'error';

  return (
    <div className="flex flex-col h-full">
      {/* Offline Banner */}
      {isOffline && (
        <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs text-center flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Backend offline — reconnecting... (demo mode active)
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center pb-8">
            {/* Hero Icon */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl gradient-brand flex items-center justify-center text-3xl glow-brand float">
                🤖
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">OmniCare AI Ready</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Your intelligent Flowzint support agent. Ask me anything about billing, APIs, integrations, account management, sales, or product support.
              </p>
            </div>
            {/* Quick Reply Chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 glass rounded-full text-xs text-indigo-300 hover:text-white hover:border-indigo-400/50 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id}>
            <ChatMessage message={msg} />
            {/* Show quick replies under the first AI message if it's the only AI message */}
            {idx === 1 && msg.role === 'assistant' && messages.length <= 3 && (
              <div className="flex flex-wrap gap-2 ml-12 mb-6">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 glass rounded-full text-xs text-indigo-300 hover:text-white hover:border-indigo-400/50 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5">
        <div
          className={clsx(
            'glass-md rounded-2xl transition-all duration-300',
            isFocused ? 'ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-900/20' : ''
          )}
        >
          <div className="flex items-start">
            <button className="p-3 text-slate-500 hover:text-white transition-colors" title="Attach file">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask OmniCare AI anything..."
              rows={1}
              className="w-full bg-transparent px-2 pt-3 pb-2 text-sm text-white placeholder-slate-500 resize-none outline-none max-h-32"
              style={{ minHeight: '44px' }}
            />
            <button className="p-3 text-slate-500 hover:text-white transition-colors" title="Voice Input">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-xs text-slate-600">
              {inputValue.length > 0 ? `${inputValue.length} chars` : 'Enter to send · Shift+Enter for newline'}
            </span>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200',
                inputValue.trim()
                  ? 'gradient-brand text-white hover:opacity-90 active:scale-95 glow-brand'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed'
              )}
            >
              <span>Send</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
