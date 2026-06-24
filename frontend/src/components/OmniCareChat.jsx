"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, Mic, MicOff, Server, Activity, X, CheckCircle2, Loader2, MessageSquare, ChevronDown } from 'lucide-react';
// We need socket.io-client to talk to the Fastify backend
import { io } from 'socket.io-client';

// Intent label display map
const INTENT_LABELS = {
  technical: 'System Diagnostics',
  billing: 'Billing & Payments',
  api: 'API & Integrations',
  account: 'Account Management',
  sla: 'SLA & Compliance',
  security: 'Security & Privacy',
  escalation: 'Escalation Request',
  general: 'General Inquiry',
};

// Sentiment display config
const SENTIMENT_CONFIG = {
  positive: { color: 'text-emerald-400', label: 'Positive' },
  neutral: { color: 'text-blue-400', label: 'Neutral / Inquiry' },
  frustrated: { color: 'text-amber-400', label: 'Frustrated' },
  angry: { color: 'text-red-400', label: 'Angry / Upset' },
  urgent: { color: 'text-orange-400', label: 'Urgent' },
};

export default function OmniCareChat() {
  const [isMounted, setIsMounted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState("");
  
  // --- STATE ---
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Live session context
  const [detectedIntent, setDetectedIntent] = useState('general');
  const [userSentiment, setUserSentiment] = useState({ label: 'neutral', emoji: '😐', escalationRisk: 0.1 });
  
  const [selectedEngine, setSelectedEngine] = useState('OpenRouter Llama 3.3');
  const [engineOpen, setEngineOpen] = useState(false);
  const engines = ['OpenRouter Llama 3.3', 'GPT-4o / Claude 3.5', 'OpenAI GPT-4o', 'Anthropic Claude 3.5'];
  const engineRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (engineRef.current && !engineRef.current.contains(event.target)) {
        setEngineOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  // Ref to hold the current streaming message to avoid state closure issues
  const currentMessageRef = useRef("");

  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "ai",
      type: "text",
      content: "Hi there! I'm OmniCare AI. I can check your server health, track tickets, or help with billing. What can I do for you today?",
      time: "10:00 am"
    },
    {
      id: "2",
      sender: "ai",
      type: "quick_replies",
      replies: ["Check Server Status", "Create Support Ticket", "What is Flowzint?"],
      time: "10:00 am"
    }
  ]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // --- INITIALIZATION & SOCKET SETUP ---
  useEffect(() => {
    const mountId = setTimeout(() => setIsMounted(true), 0);
    
    // Connect to the Fastify Backend
    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const newSocket = io(backendUrl);
    
    newSocket.on('connect', () => {
        console.log('Connected to OmniCare Backend');
    });

    newSocket.on('session_init', (data) => {
        setSessionId(data.sessionId);
    });

    // Handle live session context updates from the backend
    newSocket.on('session_context', (data) => {
      if (data.type === 'sentiment') {
        setUserSentiment(data.data);
      } else if (data.type === 'intent') {
        setDetectedIntent(data.data);
      }
    });

    // Handle incoming streaming responses
    newSocket.on('chat_response', (data) => {
        if (data.type === 'start') {
            setIsTyping(true);
            currentMessageRef.current = "";
            // Add a temporary empty message that we will append tokens to
            setMessages(prev => [...prev, {
                id: 'streaming-temp',
                sender: 'ai',
                type: 'text',
                content: '',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (data.type === 'token') {
            currentMessageRef.current += data.content;
            
            // Normal text streaming
            setMessages(prev => prev.map(msg => 
                msg.id === 'streaming-temp' ? { ...msg, content: currentMessageRef.current } : msg
            ));
        } else if (data.type === 'done') {
            setIsTyping(false);
            // Finalize the message ID
            setMessages(prev => prev.map(msg => 
                msg.id === 'streaming-temp' ? { ...msg, id: Date.now().toString() } : msg
            ));
        }
    });

    setTimeout(() => setSocket(newSocket), 0);

    return () => {
        clearTimeout(mountId);
        newSocket.disconnect();
    };
  }, []);

  // --- HANDLERS ---
  const sendMessage = useCallback((text) => {
    if (!text?.trim()) return;

    const userMessageText = text.trim();
    const newMessage = {
      id: Date.now().toString(),
      sender: "user",
      type: "text",
      content: userMessageText,
      attachment: attachment ? attachment.name : null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText("");
    setAttachment(null);
    setIsTyping(true);

    // Send the message to the backend via WebSocket
    if (socket) {
        socket.emit('chat_message', { content: userMessageText, sessionId });
    } else {
        console.error("Socket not connected");
        setIsTyping(false);
    }
  }, [socket, sessionId, attachment]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() && !attachment) return;
    sendMessage(inputText);
  }, [inputText, attachment, sendMessage]);

  const handleQuickReply = useCallback((reply) => {
    sendMessage(reply);
  }, [sendMessage]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setAttachment(file);
  };

  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Try Chrome!");
      return;
    }
    
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + " " + transcript);
        setIsRecording(false);
      };
      
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
    }
  };

  if (!isMounted) return null;

  const intentLabel = INTENT_LABELS[detectedIntent] || 'General Inquiry';
  const sentimentConfig = SENTIMENT_CONFIG[userSentiment.label] || SENTIMENT_CONFIG.neutral;

  return (
    <div className="flex h-screen bg-[#0f111a] text-slate-300 font-sans">
      
      {/* LEFT SIDEBAR - LIVE CONTEXT */}
      <div className="w-64 border-r border-slate-800 bg-[#13151f] flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xl mb-1">
            <Activity className="w-6 h-6" /> Flowzint
          </div>
          <p className="text-xs text-slate-500">OmniCare AI Agent</p>
        </div>

        <div className="p-4 flex-1 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Live Session Context</h3>
            <div className="space-y-3">
              <div className="bg-slate-800/50 rounded p-3 text-sm border border-slate-700/50 transition-all duration-300">
                <span className="text-slate-400 block text-xs mb-1">Detected Intent</span>
                <span className="text-emerald-400 font-medium">{intentLabel}</span>
              </div>
              <div className="bg-slate-800/50 rounded p-3 text-sm border border-slate-700/50 transition-all duration-300">
                <span className="text-slate-400 block text-xs mb-1">User Sentiment</span>
                <span className={`${sentimentConfig.color} font-medium`}>
                  {userSentiment.emoji} {sentimentConfig.label}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded p-3 text-sm border border-slate-700/50">
                <span className="text-slate-400 block text-xs mb-1">Escalation Risk</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        userSentiment.escalationRisk > 0.7 ? 'bg-red-500' : 
                        userSentiment.escalationRisk > 0.4 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.round(userSentiment.escalationRisk * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{Math.round(userSentiment.escalationRisk * 100)}%</span>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded p-3 text-sm border border-slate-700/50">
                <span className="text-slate-400 block text-xs mb-1">Auth Status</span>
                <span className="text-slate-200 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verified Enterprise
                </span>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Session</h3>
            <div className="bg-slate-800/50 rounded p-3 text-xs border border-slate-700/50 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Session ID</span>
                <span className="text-slate-400 font-mono">{sessionId ? sessionId.slice(0, 8) + '...' : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Messages</span>
                <span className="text-slate-400">{messages.filter(m => m.type === 'text').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative">
        
        {/* HEADER */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#13151f]/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-200">AI Chat Support</h2>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Agent Online
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative" ref={engineRef}>
              <button 
                onClick={() => setEngineOpen(!engineOpen)}
                className="px-3 py-1 rounded-full border border-indigo-500/30 text-indigo-400 text-xs font-medium bg-indigo-500/10 flex items-center gap-1"
              >
                Engine: {selectedEngine}
                <ChevronDown className="w-3 h-3" />
              </button>
              {engineOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1a1d2b] border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  {engines.map((engine) => (
                    <button
                      key={engine}
                      onClick={() => { setSelectedEngine(engine); setEngineOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-indigo-500/10 hover:text-white transition-colors ${selectedEngine === engine ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300'}`}
                    >
                      {engine}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

         {/* CHAT HISTORY */}
         <div className="flex-1 overflow-y-auto p-6 pb-40 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              <div className={`max-w-[70%] ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm p-4' : ''}`}>
                
                {/* AI Avatar */}
                {msg.sender === 'ai' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                      AI
                    </div>
                    <span className="text-xs text-slate-500">{msg.time}</span>
                  </div>
                )}

                 {/* Text Messages */}
                 {msg.type === 'text' && (
                   <div className={msg.sender === 'ai' ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm' : ''}>
                     {msg.sender === 'ai' ? (
                       <ReactMarkdown
                         components={{
                           a: ({ href, children, ...props }) => (
                             <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300" {...props}>
                               {children}
                             </a>
                           ),
                           p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                           strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                           code: ({ children, className, ...props }) => {
                             const match = /language-(\w+)/.exec(className || '');
                             if (match) {
                               return <code className={className} {...props}>{children}</code>;
                             }
                             return <code className="bg-black/20 px-1 py-0.5 rounded text-cyan-300 text-sm" {...props}>{children}</code>;
                           },
                         }}
                       >
                         {msg.content}
                       </ReactMarkdown>
                     ) : (
                       msg.content
                     )}
                     {msg.content === '' && msg.id === 'streaming-temp' && (
                       <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5" />
                     )}
                     {msg.attachment && (
                       <div className="mt-2 text-xs bg-black/20 p-2 rounded flex items-center gap-2">
                         <Paperclip className="w-3 h-3" /> {msg.attachment}
                       </div>
                     )}
                   </div>
                 )}

                {/* Quick Replies */}
                {msg.type === 'quick_replies' && (
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3 inline-block shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      {msg.replies.map((reply, i) => (
                        <button 
                          key={i}
                          onClick={() => handleQuickReply(reply)}
                          className="px-4 py-2 rounded-full border border-indigo-500/50 text-indigo-400 text-sm hover:bg-indigo-500/10 transition-colors bg-slate-900 cursor-pointer hover:scale-105 active:scale-95 transform duration-150"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generative UI Tool Card */}
                {msg.type === 'tool_card' && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mt-2 w-80 shadow-lg">
                    <div className="bg-slate-900/50 p-3 border-b border-slate-700 flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-medium text-slate-200">{msg.toolName}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Server Uptime</span>
                        <span className="text-emerald-400 font-medium">{msg.data?.uptime || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">CPU Load</span>
                        <span className="text-amber-400 font-medium">{msg.data?.load || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-slate-700/50 pt-2 mt-2">
                        <span className="text-slate-400">Region</span>
                        <span className="text-slate-200">{msg.data?.region || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ))}

          {isTyping && !messages.some(m => m.id === 'streaming-temp') && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> OmniCare is thinking...
              </div>
            </div>
          )}

          {/* Spacer to push content above fixed input area */}
          <div className="h-40" />
          
          {/* Invisible scroll anchor */}
          <div ref={chatEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-[#13151f] border-t border-slate-800">
          <div className="max-w-4xl mx-auto relative">
            
            {/* Attachment Badge */}
            {attachment && (
              <div className="absolute -top-10 left-0 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2">
                <Paperclip className="w-3 h-3 text-indigo-400" />
                {attachment.name}
                <button onClick={() => setAttachment(null)} className="hover:text-red-400"><X className="w-3 h-3"/></button>
              </div>
            )}

            <div className="flex items-end gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-inner focus-within:border-indigo-500/50 transition-colors">
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask OmniCare AI anything..."
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-slate-200 placeholder-slate-600 outline-none"
                rows="1"
              />

              <button 
                onClick={toggleRecording}
                className={`p-3 rounded-lg transition-colors ${isRecording ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'}`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button 
                onClick={handleSend}
                disabled={!inputText.trim() && !attachment}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-1 flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2 text-[10px] text-slate-600">
              Flowzint AI can make mistakes. Verify critical system changes.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}