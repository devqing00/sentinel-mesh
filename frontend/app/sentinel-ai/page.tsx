"use client";

import { useState, useRef, useEffect } from "react";
import { chatWithAI, getAIReport, fetchConversations, syncConversations } from "@/lib/api";
import { Bot, User, Send, Sparkles, FileText, Loader2, Download, AlertTriangle, Zap, MessageSquare, Plus, Trash2, Pin, Edit2, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  pinned: boolean;
  updatedAt: Date;
}

const QUICK_ACTIONS = [
  "Why does the highest risk user have that score?",
  "Draft a deployment plan for the highest risk zone.",
  "Summarize the overall network health right now."
];

// Custom component to simulate LLM streaming
const TypingMarkdown = ({ content, isStreaming, onComplete }: { content: string, isStreaming?: boolean, onComplete?: () => void }) => {
  const [displayed, setDisplayed] = useState(isStreaming ? "" : content);
  
  useEffect(() => {
    if (!isStreaming) {
      setDisplayed(content);
      return;
    }
    
    let index = 0;
    const interval = setInterval(() => {
      setDisplayed(content.slice(0, index));
      index += 3; // speed up typing
      if (index > content.length) {
        clearInterval(interval);
        setDisplayed(content); // ensure full content is set
        if (onComplete) onComplete();
      }
    }, 10);
    return () => clearInterval(interval);
  }, [content, isStreaming, onComplete]);

  return <ReactMarkdown>{displayed}</ReactMarkdown>;
};

export default function SentinelAIPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState<string>("");
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [audience, setAudience] = useState("agency");
  
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Operator ID init
  useEffect(() => {
    let opId = localStorage.getItem("operator_id");
    if (!opId) {
      opId = uuidv4();
      localStorage.setItem("operator_id", opId);
    }
    setOperatorId(opId);
    
    // Load from MongoDB
    fetchConversations(opId).then(res => {
      const parsed = res.data.conversations;
      if (parsed && parsed.length > 0) {
        // Revive dates
        parsed.forEach((c: any) => {
          c.updatedAt = new Date(c.updatedAt);
          c.messages.forEach((m: any) => m.timestamp = new Date(m.timestamp));
        });
        setConversations(parsed);
        setActiveConvId(parsed[0].id);
      } else {
        createNewConversation();
      }
    }).catch(e => {
      console.error("Failed to load DB conversations", e);
      createNewConversation();
    });
  }, []);

  // Save to MongoDB whenever conversations change
  useEffect(() => {
    if (conversations.length > 0 && operatorId) {
      syncConversations(operatorId, conversations).catch(e => console.error("Failed to sync", e));
    }
  }, [conversations, operatorId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversations, activeConvId, loading]);

  const activeConv = conversations.find(c => c.id === activeConvId);

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "New Transmission",
      messages: [],
      pinned: false,
      updatedAt: new Date()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(newConv.id);
  };

  const deleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    if (activeConvId === id) {
      setActiveConvId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, pinned: !c.pinned } : c
    ));
  };

  const startEditingTitle = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingTitleId(id);
    setEditTitleValue(currentTitle);
  };

  const saveTitle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editingTitleId) return;
    setConversations(prev => prev.map(c => 
      c.id === editingTitleId ? { ...c, title: editTitleValue || "Unnamed Transmission" } : c
    ));
    setEditingTitleId(null);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeConvId) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    
    // Auto-generate a title if it's still "New Transmission"
    let newTitle = activeConv?.title;
    if (newTitle === "New Transmission") {
      newTitle = text.slice(0, 20) + (text.length > 20 ? "..." : "");
    }

    // Add user message to active conv
    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        return { ...c, title: newTitle!, messages: [...c.messages, userMsg], updatedAt: new Date() };
      }
      return c;
    }));
    
    setInput("");
    setLoading(true);

    try {
      const messagesToSend = activeConv ? [...activeConv.messages, userMsg] : [userMsg];
      const payload = messagesToSend.map(m => ({ role: m.role, content: m.content }));
      
      const res = await chatWithAI(payload, window.location.pathname);
      
      const aiMsg: Message = { 
        id: (Date.now()+1).toString(), 
        role: "ai", 
        content: res.data.response, 
        timestamp: new Date(),
        isStreaming: true // Enable typing effect for new messages
      };
      
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvId) {
          return { ...c, messages: [...c.messages, aiMsg], updatedAt: new Date() };
        }
        return c;
      }));

    } catch (e) {
      const errorMsg: Message = { id: (Date.now()+1).toString(), role: "ai", content: "Error connecting to Sentinel ML Core.", timestamp: new Date() };
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvId) {
          return { ...c, messages: [...c.messages, errorMsg], updatedAt: new Date() };
        }
        return c;
      }));
    }
    setLoading(false);
  };

  const markStreamingComplete = (convId: string, msgId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === convId) {
        return {
          ...c,
          messages: c.messages.map(m => m.id === msgId ? { ...m, isStreaming: false } : m)
        };
      }
      return c;
    }));
  };

  const handleSend = () => sendMessage(input);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await getAIReport(audience);
      setReport(res.data.markdown_report);
    } catch (e) {
      console.error(e);
    }
    setReportLoading(false);
  };

  const handleExport = () => {
    if (!report) return;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;
    
    const content = document.getElementById('report-content')?.innerHTML || `<pre>${report}</pre>`;
    
    printWindow.document.write('<html><head><title>Sentinel Intelligence Briefing</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; line-height: 1.6; color: #111827; }');
    printWindow.document.write('h1, h2, h3 { color: #4f46e5; margin-top: 1.5em; margin-bottom: 0.5em; }');
    printWindow.document.write('ul { margin-bottom: 1em; padding-left: 2em; }');
    printWindow.document.write('li { margin-bottom: 0.5em; }');
    printWindow.document.write('p { margin-bottom: 1em; }');
    printWindow.document.write('strong { color: #111827; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };


  const pinnedConvs = conversations.filter(c => c.pinned).sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const recentConvs = conversations.filter(c => !c.pinned).sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/40 rounded-tl-[1.5rem]">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-600" />
              Sentinel AI Engine
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Conversations Sidebar */}
        <div className="w-[280px] bg-gray-50 border-r border-gray-100 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <button 
              onClick={createNewConversation}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-200"
            >
              <Plus className="w-4 h-4" />
              New Transmission
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            
            {pinnedConvs.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-2 flex items-center gap-1.5">
                  <Pin className="w-3 h-3" /> Pinned
                </h3>
                <div className="space-y-1">
                  {pinnedConvs.map(c => (
                    <ConvItem 
                      key={c.id} c={c} active={activeConvId === c.id}
                      onClick={() => setActiveConvId(c.id)}
                      onPin={(e: any) => togglePin(e, c.id)}
                      onDelete={(e: any) => deleteConversation(e, c.id)}
                      onEdit={(e: any) => startEditingTitle(e, c.id, c.title)}
                      isEditing={editingTitleId === c.id}
                      editVal={editTitleValue}
                      setEditVal={setEditTitleValue}
                      saveEdit={saveTitle}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-2">Recent</h3>
              <div className="space-y-1">
                {recentConvs.map(c => (
                  <ConvItem 
                    key={c.id} c={c} active={activeConvId === c.id}
                    onClick={() => setActiveConvId(c.id)}
                    onPin={(e: any) => togglePin(e, c.id)}
                    onDelete={(e: any) => deleteConversation(e, c.id)}
                    onEdit={(e: any) => startEditingTitle(e, c.id, c.title)}
                    isEditing={editingTitleId === c.id}
                    editVal={editTitleValue}
                    setEditVal={setEditTitleValue}
                    saveEdit={saveTitle}
                  />
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Center Pane: Chat Interface */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-8 space-y-6" ref={scrollRef}>
            {activeConv?.messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full mt-20">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
                  <Bot className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">Hello Operator. I am Sentinel AI.</h2>
                <p className="text-gray-500 max-w-md mb-8">
                  I am constantly analyzing the mesh network, user risk trajectories, and hardware telemetry. How can I assist you today?
                </p>
              </div>
            ) : (
              activeConv?.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className={`px-4 py-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : 'bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-200 prose prose-sm prose-indigo w-full'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <TypingMarkdown 
                        content={msg.content} 
                        isStreaming={msg.isStreaming} 
                        onComplete={() => markStreamingComplete(activeConv.id, msg.id)}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 font-medium px-1">
                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            ))
          )}
            
            {loading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-gray-100 flex flex-col gap-3">
            {/* Quick Actions */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center justify-center text-indigo-400 bg-indigo-50 px-2 py-1.5 rounded-lg shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action)}
                  className="shrink-0 bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-indigo-600 py-1.5 px-3 rounded-full transition-colors whitespace-nowrap"
                >
                  {action}
                </button>
              ))}
            </div>

            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Sentinel AI about risk clusters, anomalies, or network status..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-full pl-6 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="absolute right-2 w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-200"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-medium">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              AI responses are ML-generated and should be verified by a human operator.
            </div>
          </div>
        </div>

        {/* Right Pane: Automated Reporting */}
        <div className="w-[400px] bg-gray-50/50 border-l border-gray-200 p-6 flex flex-col overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
              <FileText className="w-4 h-4 text-indigo-500" />
              Intelligence Brief
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Generate a snapshot of epidemiological shifts across the mesh.
            </p>
          </div>

          {!report && !reportLoading && (
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-1 flex shadow-sm">
                <button
                  onClick={() => setAudience('agency')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${audience === 'agency' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Agency
                </button>
                <button
                  onClick={() => setAudience('practitioner')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${audience === 'practitioner' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Practitioner
                </button>
              </div>
              <button
                onClick={handleGenerateReport}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-800 font-bold py-2.5 rounded-xl transition-all shadow-sm text-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Compile Report
              </button>
            </div>
          )}

          {reportLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-indigo-500 gap-4">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Data...</span>
            </div>
          )}

          {report && !reportLoading && (
            <div className="flex flex-col flex-1">
              <div id="report-content" className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex-1 prose prose-xs prose-indigo max-w-none overflow-y-auto">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
              <button onClick={handleExport} className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm text-sm">
                <Download className="w-4 h-4" />
                Export Briefing
              </button>
              <button onClick={() => setReport(null)} className="mt-2 w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-2 px-4 rounded-xl transition-all text-xs">
                New Briefing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-component for sidebar conversation item
function ConvItem({ c, active, onClick, onPin, onDelete, onEdit, isEditing, editVal, setEditVal, saveEdit }: any) {
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
        active ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-gray-200/50 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <MessageSquare className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-500' : 'text-gray-400'}`} />
        {isEditing ? (
          <input 
            autoFocus
            className="flex-1 bg-white border border-indigo-400 text-xs px-1.5 py-0.5 rounded outline-none w-full"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            onBlur={() => saveEdit()}
          />
        ) : (
          <span className={`text-xs font-semibold truncate ${active ? 'text-gray-900' : 'text-gray-600'}`}>
            {c.title}
          </span>
        )}
      </div>

      {!isEditing && (
        <div className={`flex items-center gap-1 shrink-0 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onPin} className={`p-1 transition-colors ${c.pinned ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}>
            <Pin className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
      {isEditing && (
        <button onClick={() => saveEdit()} className="p-1 text-indigo-600 shrink-0">
          <Check className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
