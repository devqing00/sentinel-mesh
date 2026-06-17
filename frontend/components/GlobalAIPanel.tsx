"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, User } from "lucide-react";
import { chatWithAI } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
}

export default function GlobalAIPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Send the current URL path as context
      const context = window.location.pathname;
      const payload = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      
      const res = await chatWithAI(payload, context);
      
      const aiMsg: Message = { id: (Date.now()+1).toString(), role: "ai", content: res.data.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", content: "Error connecting to Sentinel Core." }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl hover:shadow-[0_10px_40px_rgba(79,70,229,0.5)] transition-all group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <Bot className="w-7 h-7 group-hover:scale-110 transition-transform" />
      </button>

      {/* Slide-over Panel */}
      <div className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 h-[500px]' : 'scale-0 opacity-0 h-0 pointer-events-none'}`}>
        
        {/* Header */}
        <div className="bg-indigo-600 p-4 flex items-center justify-between text-white shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <h3 className="font-display font-bold text-sm">Ask Sentinel AI</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-indigo-500 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-indigo-500" />
              </div>
              <p className="text-xs text-gray-500">I am aware of your current context. Ask me anything about this page or the network.</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
                <div className={`px-3 py-2 rounded-xl text-xs max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm prose prose-xs prose-indigo'}`}>
                  {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Bot className="w-3 h-3" />
              </div>
              <div className="px-3 py-2 rounded-xl bg-white border border-gray-200 rounded-tl-sm flex items-center gap-1">
                <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Sentinel..."
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400 transition-all"
            />
            <button 
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-1 w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-full transition-colors"
            >
              <Send className="w-3 h-3 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
