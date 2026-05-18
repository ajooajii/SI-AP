import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Send, 
  MessageSquare, 
  Layers, 
  Download, 
  Plus, 
  History,
  Info,
  ChevronRight,
  Palette,
  X,
  RefreshCw,
  Zap,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface Project {
  id: string;
  name: string;
  images: string[];
  notes: string[];
}

// --- Main App Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'gallery' | 'notes'>('studio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Welcome to Lumina. How can I assist your creative process today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Image Gen State
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Notes/Ideas
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.text }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt })
      });
      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImages(prev => [data.imageUrl, ...prev]);
        setActiveTab('gallery');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
      {/* --- Sidebar Navigation --- */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="h-full bg-white border-r border-[#1A1A1A]/10 flex flex-col relative z-20"
      >
        <div className="p-6 flex items-center justify-between border-bottom border-[#1A1A1A]/5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shrink-0">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-xl tracking-tight uppercase whitespace-nowrap">Lumina</span>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[#F5F2ED] rounded-lg transition-colors"
          >
            <ChevronRight className={`w-5 h-5 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2">
          <NavItem 
            icon={<Palette />} 
            label="Creative Studio" 
            active={activeTab === 'studio'} 
            onClick={() => setActiveTab('studio')} 
            isOpen={isSidebarOpen} 
          />
          <NavItem 
            icon={<ImageIcon />} 
            label="Visual Gallery" 
            active={activeTab === 'gallery'} 
            onClick={() => setActiveTab('gallery')} 
            isOpen={isSidebarOpen} 
          />
          <NavItem 
            icon={<Layers />} 
            label="Project Notes" 
            active={activeTab === 'notes'} 
            onClick={() => setActiveTab('notes')} 
            isOpen={isSidebarOpen} 
          />
        </nav>

        <div className="p-6 border-t border-[#1A1A1A]/5">
          <div className={`flex items-center gap-4 ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 bg-[#1A1A1A]/5 rounded-full flex items-center justify-center text-xs font-bold">LA</div>
            {isSidebarOpen && <span className="text-sm font-medium">Creative Hub</span>}
          </div>
        </div>
      </motion.aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col h-full bg-[#FAF9F6] relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 px-8 flex items-center justify-between bg-white/50 backdrop-blur-sm border-b border-[#1A1A1A]/5 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase tracking-widest font-semibold text-[#1A1A1A]/40">Current View</span>
            <span className="text-sm font-bold flex items-center gap-2">
              {activeTab === 'studio' ? 'Creative Studio' : activeTab === 'gallery' ? 'Visual Gallery' : 'Project Notes'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-black text-white rounded-full hover:opacity-80 transition-opacity">
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 grid grid-cols-12 gap-8 overflow-hidden">
          {activeTab === 'studio' && (
            <>
              {/* Brainstorming Panel */}
              <div className="col-span-12 lg:col-span-7 flex flex-col bg-white border border-[#1A1A1A]/5 rounded-[32px] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1A1A1A]/5 flex items-center justify-between bg-[#FAF9F6]/50">
                  <h3 className="font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" /> 
                    Brainstorming Assistant
                  </h3>
                  <button className="p-2 hover:bg-black/5 rounded-full transition-colors"><RefreshCw className="w-4 h-4" /></button>
                </div>
                
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.map((m, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] px-6 py-4 rounded-3xl ${
                        m.role === 'user' 
                        ? 'bg-black text-white' 
                        : 'bg-[#F5F2ED] text-[#1A1A1A]'
                      }`}>
                        <p className="text-sm leading-relaxed">{m.text}</p>
                      </div>
                    </motion.div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#F5F2ED] px-6 py-4 rounded-3xl">
                        <div className="flex gap-1">
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-black rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-black rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-black rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-[#1A1A1A]/5">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask Lumina anything..."
                      className="w-full bg-[#FAF9F6] border-none rounded-2xl px-6 py-4 pr-16 focus:ring-2 focus:ring-black outline-none transition-all text-sm"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isChatLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions / Image Gen Panel */}
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-8">
                <div className="bg-white border border-[#1A1A1A]/5 rounded-[32px] p-8 shadow-sm">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2 uppercase tracking-wide">
                    <Zap className="w-5 h-5" /> Image Studio
                  </h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Visualization Prompt</label>
                      <textarea 
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="A hyper-realistic sunset over an neon brutalist city skyline..."
                        className="w-full bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-black outline-none resize-none text-sm transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleGenerateImage}
                      disabled={isGenerating || !imagePrompt.trim()}
                      className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#1A1A1A] transition-all disabled:opacity-50 group"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Rendering Vision...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span>Generate Visual</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-black text-white rounded-[32px] p-8 grow shadow-xl relative overflow-hidden flex flex-col justify-end min-h-[200px]">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="relative z-10">
                    <h4 className="text-2xl font-light mb-2 italic">Refine your ideas.</h4>
                    <p className="text-white/60 text-sm mb-6 max-w-[80%]">Use the chat to create complex prompts, then paste them here to see them come to life.</p>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-colors">Documentation</button>
                      <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-colors">Tips</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'gallery' && (
            <div className="col-span-12 overflow-y-auto pr-4">
              {generatedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#1A1A1A]/30">
                  <ImageIcon className="w-24 h-24 mb-4 opacity-10" />
                  <p className="font-bold text-xl">No visuals generated yet.</p>
                  <p className="text-sm">Head over to the Image Studio to start creating.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {generatedImages.map((img, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative aspect-square bg-white border border-[#1A1A1A]/10 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
                    >
                      <img src={img} alt={`Generated visual ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
                          <Download className="w-5 h-5" />
                        </button>
                        <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="col-span-12 max-w-4xl mx-auto w-full">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight">Project Notes</h2>
                <button 
                  onClick={() => setNotes(prev => ['', ...prev])}
                  className="px-6 py-2 bg-black text-white rounded-full font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Plus className="w-4 h-4" /> New Item
                </button>
              </div>
              <div className="space-y-4">
                {notes.map((note, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6 bg-white border border-[#1A1A1A]/5 rounded-3xl shadow-sm flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                    <textarea 
                      className="flex-1 bg-transparent border-none outline-none resize-none focus:ring-0 min-h-[40px] text-sm"
                      placeholder="Type your thought here..."
                      defaultValue={note}
                    />
                    <button onClick={() => setNotes(notes.filter((_, i) => i !== idx))} className="text-[#1A1A1A]/20 hover:text-red-500 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
                {notes.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-[#1A1A1A]/20 border-2 border-dashed border-[#1A1A1A]/5 rounded-[40px]">
                    <Plus className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-bold">Your idea board is empty.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// --- Helper Components ---
function NavItem({ 
  icon, 
  label, 
  active, 
  onClick, 
  isOpen 
}: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  isOpen: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${
        active 
        ? 'bg-black text-white shadow-lg' 
        : 'text-[#1A1A1A]/60 hover:bg-[#F5F2ED]'
      }`}
    >
      <div className={`${active ? 'text-white' : 'group-hover:text-black'} transition-colors shrink-0`}>
        {icon}
      </div>
      {isOpen && (
        <span className="font-bold text-sm tracking-wide whitespace-nowrap overflow-hidden">
          {label}
        </span>
      )}
    </button>
  );
}

