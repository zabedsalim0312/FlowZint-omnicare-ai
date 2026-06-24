import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Ticket {
  id: string | number;
  sessionId: string;
  subject: string;
  priority: TicketPriority;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: Date;
}

export interface LiveContext {
  sentiment: string;
  emoji: string;
  intent: string;
  suggestedAction: string;
}

interface ChatStore {
  // State
  messages: Message[];
  sessionId: string;
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  isTyping: boolean;
  streamingMessageId: string | null;
  tickets: Ticket[];
  activePanel: 'chat' | 'tickets' | 'analytics';
  inputValue: string;
  isSidebarOpen: boolean;
  liveContext: LiveContext | null;

  // Actions
  initSocket: () => void;
  disconnectSocket: () => void;
  sendMessage: (content: string) => void;
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string;
  appendToMessage: (id: string, token: string) => void;
  finalizeMessage: (id: string) => void;
  setActivePanel: (panel: 'chat' | 'tickets' | 'analytics') => void;
  setInputValue: (val: string) => void;
  toggleSidebar: () => void;
  loadTickets: () => Promise<void>;
  createTicket: (data: { subject: string; priority: TicketPriority; description: string }) => Promise<void>;
  clearMessages: () => void;
  setLiveContext: (ctx: LiveContext) => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socketInstance: Socket | null = null;

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial State
        messages: [],
        sessionId: '',
        socket: null,
        connectionStatus: 'disconnected',
        isTyping: false,
        streamingMessageId: null,
        tickets: [],
        activePanel: 'chat',
        inputValue: '',
        isSidebarOpen: true,
        liveContext: null,

        initSocket: () => {
          if (socketInstance?.connected) return;

          set({ connectionStatus: 'connecting' });

          socketInstance = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
          });

          set({ socket: socketInstance });

          socketInstance.on('connect', () => {
            set({ connectionStatus: 'connected' });
          });

          socketInstance.on('disconnect', () => {
            set({ connectionStatus: 'disconnected' });
          });

          socketInstance.on('connect_error', () => {
            set({ connectionStatus: 'error' });
          });

          socketInstance.on('session_init', ({ sessionId }: { sessionId: string }) => {
            set({ sessionId });
          });

          socketInstance.on('chat_response', (data: { type: string; content?: string }) => {
            const { streamingMessageId } = get();

            if (data.type === 'start') {
              const id = get().addMessage({ role: 'assistant', content: '', isStreaming: true });
              set({ streamingMessageId: id, isTyping: false });
            } else if (data.type === 'token' && data.content && streamingMessageId) {
              get().appendToMessage(streamingMessageId, data.content);
              // Also eagerly check for ui_context to update panel dynamically
              if (data.content.includes('ui_context')) {
                const fullMsg = get().messages.find(m => m.id === streamingMessageId)?.content + data.content;
                const match = fullMsg.match(/```json\n([\s\S]*?)\n```/g);
                if (match) {
                  match.forEach(block => {
                    try {
                      const jsonStr = block.replace(/```json\n/, '').replace(/\n```/, '');
                      const parsed = JSON.parse(jsonStr);
                      if (parsed.type === 'ui_context') get().setLiveContext(parsed.context);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (e) {}
                  });
                }
              }
            } else if (data.type === 'done' && streamingMessageId) {
              get().finalizeMessage(streamingMessageId);
              set({ streamingMessageId: null });
            }
          });
        },

        disconnectSocket: () => {
          socketInstance?.disconnect();
          socketInstance = null;
          set({ socket: null, connectionStatus: 'disconnected' });
        },

        sendMessage: (content: string) => {
          const { socket, sessionId } = get();
          if (!content.trim()) return;

          get().addMessage({ role: 'user', content: content.trim() });
          set({ isTyping: true, inputValue: '' });

          if (socket?.connected) {
            socket.emit('chat_message', { content: content.trim(), sessionId });
          } else {
            // Offline mode — re-init and queue
            get().initSocket();
            setTimeout(() => {
              const { socket: newSocket, sessionId: newSid } = get();
              newSocket?.emit('chat_message', { content: content.trim(), sessionId: newSid });
            }, 1500);
          }
        },

        addMessage: (msg) => {
          const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const newMsg: Message = { ...msg, id, timestamp: new Date() };
          set((state) => ({ messages: [...state.messages, newMsg] }));
          return id;
        },

        appendToMessage: (id, token) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === id ? { ...m, content: m.content + token } : m
            ),
          }));
        },

        finalizeMessage: (id) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === id ? { ...m, isStreaming: false } : m
            ),
          }));
        },

        setActivePanel: (panel) => set({ activePanel: panel }),
        setInputValue: (val) => set({ inputValue: val }),
        toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

        loadTickets: async () => {
          try {
            const res = await fetch(`${API_URL}/api/tickets`);
            if (res.ok) {
              const data = await res.json();
              set({ tickets: data });
            }
          } catch { /* backend may not be running */ }
        },

        createTicket: async ({ subject, priority, description }) => {
          const { sessionId } = get();
          try {
            const res = await fetch(`${API_URL}/api/tickets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, subject, priority, description }),
            });
            if (res.ok) {
              const ticket = await res.json();
              set((s) => ({ tickets: [ticket, ...s.tickets] }));
            }
          } catch { /* backend offline */ }
        },

        clearMessages: () => set({ messages: [], liveContext: null }),
        setLiveContext: (ctx) => set({ liveContext: ctx }),
      }),
      {
        name: 'flowzint-chat-store',
        partialize: (state) => ({
          messages: state.messages.slice(-50),
          sessionId: state.sessionId,
          tickets: state.tickets,
        }),
      }
    )
  )
);
