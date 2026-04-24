import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  MessageSquare, 
  BookOpen, 
  Upload, 
  Youtube, 
  Globe, 
  FileText, 
  Send, 
  MoreVertical, 
  Trash2, 
  Mic, 
  Search,
  ChevronRight,
  Settings,
  User,
  Sparkles,
  ArrowRight,
  AlertCircle,
  X,
  HelpCircle,
  Trophy,
  CheckCircle2,
  XCircle,
  Volume2,
  Square,
  Loader2,
  MicOff
} from 'lucide-react';

// --- Constants & Config ---
const apiKey = ""; // Provided by environment

// --- Types & Mock Data ---

const INITIAL_NOTEBOOKS = [
  { id: '1', name: 'Machine Learning Basics', sources: 3, lastUpdated: '2h ago' },
  { id: '2', name: 'Market Research 2024', sources: 5, lastUpdated: '1d ago' },
  { id: '3', name: 'Product Strategy PDF', sources: 1, lastUpdated: '3d ago' },
];

const MOCK_QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "What is the primary benefit of the 'Self-Attention' mechanism in Transformers?",
    options: ["Reduces memory usage", "Allows parallelization of sequence processing", "Eliminates the need for GPU", "Simplifies backpropagation"],
    correct: 1
  },
  {
    id: 2,
    question: "According to the analysis in this notebook, what was the efficiency gain from the RAG pipeline?",
    options: ["12%", "18%", "24%", "32%"],
    correct: 2
  },
  {
    id: 3,
    question: "Which data source type provides the 'Transcribed' status in your list?",
    options: ["PDF Document", "YouTube Link", "Website URL", "Text File"],
    correct: 1
  }
];

// --- Helper: PCM to WAV ---
function pcmToWav(pcmData, sampleRate = 24000) {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// --- Shared Components ---

const SidebarItem = ({ notebook, isActive, onClick, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div 
      onClick={onClick}
      onMouseLeave={() => setShowMenu(false)}
      className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
        isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'
      }`}
    >
      <BookOpen size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm">{notebook.name}</p>
        <p className="text-[10px] opacity-60">{notebook.sources} sources • {notebook.lastUpdated}</p>
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="p-1 hover:bg-gray-200 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical size={14} />
      </button>

      {showMenu && (
        <div className="absolute right-2 top-10 w-32 bg-white border border-gray-100 shadow-xl rounded-lg py-1 z-20 animate-in fade-in zoom-in duration-100">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notebook);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const Message = ({ role, content, suggestions }) => (
  <div className={`flex flex-col mb-6 ${role === 'user' ? 'items-end' : 'items-start'}`}>
    <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
      role === 'user' 
        ? 'bg-blue-600 text-white rounded-tr-none' 
        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
    }`}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
    {role === 'assistant' && suggestions && (
      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map((s, i) => (
          <button key={i} className="text-xs bg-gray-50 border border-gray-200 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-full transition-colors">
            {s}
          </button>
        ))}
      </div>
    )}
  </div>
);

// --- Quiz Component ---

const QuizView = ({ onClose }) => {
  const [step, setStep] = useState('intro'); // intro, active, result
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const handleSelect = (idx) => {
    if (isAnswered) return;
    setSelected(idx);
    setIsAnswered(true);
    if (idx === MOCK_QUIZ_QUESTIONS[currentIndex].correct) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < MOCK_QUIZ_QUESTIONS.length - 1) {
      setCurrentIndex(c => c + 1);
      setSelected(null);
      setIsAnswered(false);
    } else {
      setStep('result');
    }
  };

  if (step === 'intro') {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <HelpCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-3">Source Mastery Quiz</h2>
        <p className="text-gray-500 mb-8">We've analyzed your notebook sources to generate a custom quiz. Test your understanding of the material!</p>
        <button 
          onClick={() => setStep('active')}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  if (step === 'active') {
    const q = MOCK_QUIZ_QUESTIONS[currentIndex];
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-1.5">
            {MOCK_QUIZ_QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full transition-all ${i <= currentIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Question {currentIndex + 1}/{MOCK_QUIZ_QUESTIONS.length}</span>
        </div>
        
        <h3 className="text-xl font-bold text-gray-800 mb-8 leading-tight">{q.question}</h3>
        
        <div className="space-y-3 mb-10">
          {q.options.map((opt, i) => {
            let variant = "border-gray-100 bg-gray-50 hover:border-gray-300";
            if (isAnswered) {
              if (i === q.correct) variant = "border-green-500 bg-green-50 text-green-700";
              else if (i === selected) variant = "border-red-500 bg-red-50 text-red-700";
              else variant = "border-gray-100 opacity-40";
            } else if (selected === i) {
              variant = "border-blue-500 bg-blue-50 text-blue-700";
            }

            return (
              <button 
                key={i}
                disabled={isAnswered}
                onClick={() => handleSelect(i)}
                className={`w-full text-left p-5 border-2 rounded-2xl transition-all flex items-center justify-between group ${variant}`}
              >
                <span className="font-semibold">{opt}</span>
                {isAnswered && i === q.correct && <CheckCircle2 size={20} className="text-green-600" />}
                {isAnswered && i === selected && i !== q.correct && <XCircle size={20} className="text-red-600" />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <button 
            onClick={handleNext}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
          >
            {currentIndex === MOCK_QUIZ_QUESTIONS.length - 1 ? 'Finish' : 'Next Question'} <ArrowRight size={18} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-10 text-center max-w-lg mx-auto">
      <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
        <Trophy size={48} />
      </div>
      <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
      <p className="text-gray-500 mb-8 text-lg">You scored <span className="text-blue-600 font-bold">{score}</span> out of {MOCK_QUIZ_QUESTIONS.length}</p>
      
      <div className="bg-blue-50 rounded-2xl p-6 text-left mb-8 border border-blue-100">
        <p className="text-sm text-blue-800 leading-relaxed italic">
          "Excellent progress! Your understanding of efficiency metrics and transformer mechanisms is quite deep based on these results."
        </p>
      </div>

      <button 
        onClick={onClose}
        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
      >
        Continue Research
      </button>
    </div>
  );
};

// --- Main Application ---

export default function App() {
  const [view, setView] = useState('landing');
  const [notebooks, setNotebooks] = useState(INITIAL_NOTEBOOKS);
  const [activeNotebook, setActiveNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [notebookToDelete, setNotebookToDelete] = useState(null);
  
  // Voice/Audio States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  
  const audioRef = useRef(null);
  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        // In a real app, you'd send this to an STT service or upload it.
        // For now, we simulate a text translation of the audio.
        handleVoiceSubmit("I recorded a question about the RAG pipeline architecture.");
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone Access Error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const startNewChat = () => {
    const id = Date.now().toString();
    const newNb = { id, name: 'Untitled Notebook', sources: 0, lastUpdated: 'Just now' };
    setNotebooks([newNb, ...notebooks]);
    setActiveNotebook(newNb);
    setMessages([]);
    setView('app');
  };

  const confirmDelete = () => {
    if (!notebookToDelete) return;
    const updated = notebooks.filter(nb => nb.id !== notebookToDelete.id);
    setNotebooks(updated);
    if (activeNotebook?.id === notebookToDelete.id) {
      setActiveNotebook(updated[0] || null);
      setMessages([]);
    }
    setNotebookToDelete(null);
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;
    processMessage(input);
    setInput('');
  };

  const handleVoiceSubmit = (text) => {
    processMessage(text);
  };

  const processMessage = (content) => {
    const userMsg = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const assistantMsg = { 
        role: 'assistant', 
        content: "Analysis complete. Based on the documents provided, the core findings suggest a 24% increase in processing efficiency when utilizing the new RAG pipeline architecture. I can delve deeper into the specific transformer mechanisms if you'd like.",
        suggestions: ["Compare with previous version", "Summarize findings", "Take a quiz"]
      };
      setMessages(prev => [...prev, assistantMsg]);
    }, 1000);
  };

  const speakLastMessage = async () => {
    const lastMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastMessage || isSpeaking) return;

    setIsTtsLoading(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say warmly and clearly: ${lastMessage.content}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Kore" }
              }
            }
          }
        })
      });

      const data = await response.json();
      const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (audioBase64) {
        const pcmData = new Int16Array(Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0)).buffer);
        const wavBlob = pcmToWav(pcmData, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          setIsSpeaking(true);
        }
      }
    } catch (err) {
      console.error("Speech Error:", err);
    } finally {
      setIsTtsLoading(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-4xl w-full">
          <div className="flex items-center justify-center gap-2 mb-8 text-blue-600">
            <Sparkles size={40} />
            <h1 className="text-4xl font-black tracking-tighter">CORELLM</h1>
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Your Personalized <span className="text-blue-600">AI Research</span> Notebook
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            The intelligent layer for your data. Upload anything and transform it into knowledge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={startNewChat}
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200"
            >
              Get Started Free <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans">
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} hidden />
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <div className="p-4 flex items-center gap-2 mb-4">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Sparkles size={20} className="text-white" />
          </div>
          <h2 className="font-black tracking-tighter text-xl text-gray-800">CORELLM</h2>
        </div>

        <div className="px-4 mb-4">
          <button 
            onClick={startNewChat}
            className="w-full bg-blue-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            <Plus size={18} /> New Notebook
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <p className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recent Notebooks</p>
          {notebooks.map(nb => (
            <SidebarItem 
              key={nb.id} 
              notebook={nb} 
              isActive={activeNotebook?.id === nb.id} 
              onClick={() => {
                setActiveNotebook(nb);
                setMessages([]);
                setIsQuizMode(false);
                stopSpeaking();
              }}
              onDelete={(nb) => setNotebookToDelete(nb)}
            />
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <User size={18} />
            </div>
            <p className="text-sm font-medium">Pro User</p>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg text-gray-800 truncate max-w-md">{activeNotebook?.name || 'Create a Notebook'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsQuizMode(true)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                isQuizMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <HelpCircle size={16} /> Quiz Mode
            </button>
            <button 
              onClick={() => setIsUploading(true)}
              className="bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-100 flex items-center gap-2"
            >
              <Upload size={16} /> Add Source
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:px-12 lg:px-24">
          {isQuizMode ? (
            <div className="max-w-2xl mx-auto mt-8 bg-white border border-gray-100 rounded-[32px] shadow-2xl shadow-blue-900/5 overflow-hidden">
              <QuizView onClose={() => setIsQuizMode(false)} />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <MessageSquare size={48} className="mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold">Ready to research?</h3>
              <p>Upload your first source to begin.</p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <Message key={i} role={m.role} content={m.content} suggestions={m.suggestions} />
              ))}
              {isSpeaking && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 w-fit animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i} 
                        className="w-1 bg-blue-600 rounded-full animate-bounce" 
                        style={{ height: '12px', animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Assistant is speaking...</span>
                  <button onClick={stopSpeaking} className="ml-2 p-1 bg-blue-600 text-white rounded-lg"><Square size={12} /></button>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        {!isQuizMode && (
          <div className="p-6 md:px-12 lg:px-24">
            <div className="max-w-4xl mx-auto flex flex-col gap-2">
              <div className="flex gap-3 bg-white border border-gray-200 rounded-2xl shadow-lg p-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all items-center">
                
                {/* Voice Recorder Button */}
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-3 rounded-xl transition-all relative ${
                    isRecording 
                    ? 'bg-red-50 text-red-600' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-blue-600'
                  }`}
                >
                  {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                  {isRecording && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  )}
                </button>

                {isRecording ? (
                  <div className="flex-1 flex items-center gap-4 px-3">
                    <div className="flex-1 h-8 bg-red-50 rounded-lg flex items-center justify-center gap-1.5 px-3">
                      {[...Array(12)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-red-400 rounded-full animate-pulse" 
                          style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-mono font-bold text-red-600">{formatDuration(recordDuration)}</span>
                  </div>
                ) : (
                  <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask anything about your sources..."
                    className="flex-1 bg-transparent border-none focus:ring-0 p-3"
                  />
                )}
                
                <div className="flex gap-1 pr-1">
                  <button 
                    disabled={messages.length === 0 || isTtsLoading || isRecording}
                    onClick={isSpeaking ? stopSpeaking : speakLastMessage}
                    className={`p-3 rounded-xl transition-all flex items-center gap-2 ${
                      isSpeaking 
                      ? 'bg-red-50 text-red-600' 
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-30'
                    }`}
                  >
                    {isTtsLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : isSpeaking ? (
                      <Square size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                  <button 
                    onClick={isRecording ? stopRecording : handleSendMessage}
                    className={`p-3 text-white rounded-xl transition-all ${
                      isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRecording ? <Square size={18} /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {/* Upload Modal */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Add Source</h2>
              <button onClick={() => setIsUploading(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 p-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 hover:border-blue-100 transition-all"><FileText className="text-blue-500" /> PDF Document</button>
              <button className="w-full flex items-center gap-3 p-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 hover:border-red-100 transition-all"><Youtube className="text-red-500" /> YouTube Transcript</button>
              <button className="w-full flex items-center gap-3 p-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 hover:border-green-100 transition-all"><Globe className="text-green-500" /> Website URL</button>
            </div>
            <button 
              onClick={() => setIsUploading(false)}
              className="mt-8 w-full py-3 font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {notebookToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Notebook?</h2>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-gray-800">"{notebookToDelete.name}"</span>? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmDelete}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Delete Permanently
                </button>
                <button 
                  onClick={() => setNotebookToDelete(null)}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
