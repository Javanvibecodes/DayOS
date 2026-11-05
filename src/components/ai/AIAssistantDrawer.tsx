import { useState, useEffect, useRef } from 'react';
import {
  aiAgentService,
  speechService,
  ollamaService,
  MODEL_RECOMMENDATIONS,
} from '@/services/aiAgentService';
import type { AIMessage, AISettings, AIModelProvider } from '@/types';
import { useLockinStore } from '@/stores/lockinStore';
import { useTaskStore } from '@/stores/taskStore';
import { toast } from '@/stores/toastStore';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistantDrawer({ isOpen, onClose }: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Hello! I am DayOS AI, your local productivity companion. I can check your schedule, create tasks, search notes, or guide your focus sessions. How can I help you today?',
      created_at: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [speechOutputEnabled, setSpeechOutputEnabled] = useState(false);

  // Model & Machine state
  const [installedOllamaModels, setInstalledOllamaModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [machineProfile, setMachineProfile] = useState<{ cores: number; ramGb: number; tier: string }>({
    cores: 4,
    ramGb: 8,
    tier: 'balanced',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { startTimer, hostSession } = useLockinStore();
  const { loadTasks } = useTaskStore();

  useEffect(() => {
    if (isOpen) {
      aiAgentService.getSettings().then((settings) => {
        setAiSettings(settings);
        setSpeechOutputEnabled(settings.speech_output_enabled);
      });

      const profile = ollamaService.getMachineCapabilities();
      setMachineProfile(profile);

      // On-demand launch of Ollama on first user interaction with AI button
      ollamaService.ensureRunning().then((running) => {
        setIsOllamaRunning(running);
        if (running) {
          ollamaService.getInstalledModels().then((models) => {
            setInstalledOllamaModels(models);
            setShowRecommendations(models.length === 0);
          });
        } else {
          setShowRecommendations(true);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isProcessing) return;

    speechService.stopListening();
    setIsListening(false);
    setLiveTranscript('');
    setInputText('');

    const userMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsProcessing(true);

    try {
      // Direct intent checks
      const lower = query.toLowerCase();
      if (lower.includes('start') && (lower.includes('pomodoro') || lower.includes('timer') || lower.includes('focus'))) {
        hostSession('Deep Focus Session', 25);
        startTimer();
        const replyContent = 'Started a 25-minute Pomodoro focus session for you in Collaborate & Lock-in!';
        const assistantMsg: AIMessage = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          created_at: new Date().toISOString(),
        };
        setMessages([...newHistory, assistantMsg]);
        if (speechOutputEnabled) speechService.speak(replyContent, aiSettings?.tts_voice_id);
        setIsProcessing(false);
        return;
      }

      const responseText = await aiAgentService.sendMessage(query, newHistory);

      // If user created a task, reload tasks store
      if (lower.startsWith('create task ') || lower.startsWith('add task ')) {
        loadTasks();
      }

      const assistantMessage: AIMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString(),
      };

      setMessages([...newHistory, assistantMessage]);

      if (speechOutputEnabled) {
        speechService.speak(responseText, aiSettings?.tts_voice_id);
      }
    } catch (err: any) {
      const errorMsg: AIMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Something went wrong.'}`,
        created_at: new Date().toISOString(),
      };
      setMessages([...newHistory, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
      if (liveTranscript) {
        handleSend(liveTranscript);
      }
    } else {
      if (!speechService.isSTTAvailable()) {
        toast.error('Voice input is not supported in this browser/webview.');
        return;
      }
      setIsListening(true);
      setLiveTranscript('');
      const started = speechService.startListening(
        (transcript, isFinal) => {
          setLiveTranscript(transcript);
          if (isFinal) {
            handleSend(transcript);
          }
        },
        () => {
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
      if (!started) {
        setIsListening(false);
        toast.error('Could not initialize speech recognition');
      }
    }
  };

  const toggleTTS = () => {
    const nextVal = !speechOutputEnabled;
    setSpeechOutputEnabled(nextVal);
    if (!nextVal) {
      speechService.stopSpeaking();
    }
    if (aiSettings) {
      aiAgentService.saveSettings({ ...aiSettings, speech_output_enabled: nextVal });
    }
    toast.info(nextVal ? 'Voice output enabled' : 'Voice output muted');
  };

  const handleModelSelect = async (val: string) => {
    if (!aiSettings) return;

    if (val.startsWith('local:')) {
      const modelName = val.replace('local:', '');
      const updated = { ...aiSettings, provider: 'ollama' as AIModelProvider, model_name: modelName };
      setAiSettings(updated);
      await aiAgentService.saveSettings(updated);
      toast.success(`Switched to local ${modelName}`);
    } else if (val.startsWith('cloud:')) {
      const [provider, modelName] = val.replace('cloud:', '').split(':');
      const updated = {
        ...aiSettings,
        provider: provider as AIModelProvider,
        model_name: modelName,
      };
      setAiSettings(updated);
      await aiAgentService.saveSettings(updated);
      toast.success(`Switched to ${provider.toUpperCase()}`);
    }
  };

  // Helper to determine active selection string
  const currentModelVal =
    aiSettings?.provider === 'ollama'
      ? `local:${aiSettings.model_name}`
      : `cloud:${aiSettings?.provider}:${aiSettings?.model_name}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-3.5 border-b border-border flex items-center justify-between gap-2 bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs shrink-0">
              ✨
            </div>

            {/* Model Selector Dropdown with API Indicators */}
            <select
              value={currentModelVal}
              onChange={(e) => handleModelSelect(e.target.value)}
              className="px-2 py-1 bg-surface-container-low border border-border rounded-lg text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary truncate max-w-[190px]"
            >
              <optgroup label="🖥️ Local Models (Ollama)">
                {installedOllamaModels.length > 0 ? (
                  installedOllamaModels.map((m) => (
                    <option key={m} value={`local:${m}`}>
                      🟢 {m} (Local)
                    </option>
                  ))
                ) : (
                  <option value="local:none" disabled>
                    ⚪ No local models installed
                  </option>
                )}
              </optgroup>
              <optgroup label="☁️ Paid / Cloud Models">
                <option value="cloud:openai:gpt-4o-mini">
                  {aiSettings?.api_key && aiSettings.provider === 'openai' ? '🟢' : '⚪'} OpenAI (GPT-4o-mini)
                </option>
                <option value="cloud:gemini:gemini-1.5-flash">
                  {aiSettings?.api_key && aiSettings.provider === 'gemini' ? '🟢' : '⚪'} Google Gemini (Flash)
                </option>
                <option value="cloud:anthropic:claude-3-5-sonnet">
                  {aiSettings?.api_key && aiSettings.provider === 'anthropic' ? '🟢' : '⚪'} Claude 3.5 Sonnet
                </option>
                <option value="cloud:openrouter:deepseek/deepseek-chat">
                  {aiSettings?.api_key && aiSettings.provider === 'openrouter' ? '🟢' : '⚪'} OpenRouter (Multi)
                </option>
              </optgroup>
            </select>

            {aiSettings?.provider === 'ollama' && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 hidden sm:inline ${
                  isOllamaRunning
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}
                title={isOllamaRunning ? 'Ollama server is running' : 'Ollama offline'}
              >
                {isOllamaRunning ? 'Active' : 'Offline'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Model Recommendations Toggle */}
            <button
              onClick={() => setShowRecommendations(!showRecommendations)}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                showRecommendations ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Local Model Recommendations & Specs"
            >
              💡
            </button>

            {/* Text to Speech Toggle */}
            <button
              onClick={toggleTTS}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                speechOutputEnabled
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={speechOutputEnabled ? 'Mute voice responses' : 'Enable voice responses'}
            >
              {speechOutputEnabled ? '🔊' : '🔇'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Local Model Availability & Machine Capability Recommendation Banner */}
        {showRecommendations && (
          <div className="p-3 bg-muted/40 border-b border-border space-y-2.5 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-foreground">Local Model Recommendations</span>
                <p className="text-[10px] text-muted-foreground">
                  Detected: {machineProfile.cores} CPU Cores • ~{machineProfile.ramGb} GB RAM (
                  <span className="capitalize font-semibold text-primary">{machineProfile.tier} Tier</span>)
                </p>
              </div>
              <button
                onClick={() => setShowRecommendations(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {MODEL_RECOMMENDATIONS.map((rec) => (
                <div
                  key={rec.tag}
                  className="p-2 rounded-lg bg-card border border-border flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground text-[11px]">{rec.name}</span>
                      <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground font-mono">
                        {rec.sizeGb}
                      </span>
                      <span className="text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                        {rec.smoothness}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{rec.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rec.command);
                      toast.success(`Copied "${rec.command}" to clipboard!`);
                    }}
                    className="px-2 py-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded shrink-0 hover:bg-primary/90"
                    title="Copy terminal command to download"
                  >
                    Copy Run
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-xs'
                    : 'bg-muted/60 border border-border text-foreground rounded-bl-xs'
                }`}
              >
                {m.content}
              </div>
              <span className="text-[10px] text-muted-foreground/60 px-1 mt-1">
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {isListening && (
            <div className="flex items-center gap-2 p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary animate-pulse">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Listening: {liveTranscript || 'Speak now...'}</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
          <button
            onClick={() => handleSend("What's on my agenda today?")}
            className="px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-foreground whitespace-nowrap transition-colors"
          >
            📅 Today's Agenda
          </button>
          <button
            onClick={() => handleSend('Start a 25 min focus timer')}
            className="px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-foreground whitespace-nowrap transition-colors"
          >
            ⏱️ Start Timer
          </button>
          <button
            onClick={() => handleSend('Create task Finish project presentation')}
            className="px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-foreground whitespace-nowrap transition-colors"
          >
            ➕ Add Task
          </button>
        </div>

        {/* Input Bar with Mic & Send */}
        <div className="p-3 border-t border-border bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`p-2 rounded-lg text-sm transition-all ${
                isListening
                  ? 'bg-rose-500 text-white ring-4 ring-rose-500/20 animate-pulse'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              🎤
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening to voice...' : 'Ask AI or type a command...'}
              className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="px-3 py-2 bg-primary disabled:opacity-50 hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
