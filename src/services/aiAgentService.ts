import { settingsApi, taskApi, meetingApi, noteApi, ollamaApi } from '@/lib/db/api';
import type { AIMessage, AISettings } from '@/types';
import { format } from 'date-fns';

const AI_SETTINGS_KEY = 'dayos_ai_agent_settings';

export interface NeuralVoice {
  id: string;
  name: string;
  engine: 'kokoro' | 'piper' | 'system';
  gender: 'female' | 'male';
  accent: string;
  description: string;
  pitch: number;
  rate: number;
}

export const LOCAL_NEURAL_VOICES: NeuralVoice[] = [
  {
    id: 'kokoro-heart',
    name: 'Kokoro - Heart',
    engine: 'kokoro',
    gender: 'female',
    accent: 'US English',
    description: 'Warm, expressive, natural conversational tone (Default)',
    pitch: 1.05,
    rate: 1.0,
  },
  {
    id: 'kokoro-adam',
    name: 'Kokoro - Adam',
    engine: 'kokoro',
    gender: 'male',
    accent: 'US English',
    description: 'Crisp, articulate, professional presentation tone',
    pitch: 0.95,
    rate: 1.02,
  },
  {
    id: 'kokoro-emma',
    name: 'Kokoro - Emma',
    engine: 'kokoro',
    gender: 'female',
    accent: 'British English',
    description: 'Refined, calm, studio audiobook narrator',
    pitch: 1.02,
    rate: 0.98,
  },
  {
    id: 'kokoro-george',
    name: 'Kokoro - George',
    engine: 'kokoro',
    gender: 'male',
    accent: 'British English',
    description: 'Deep, resonant, authoritative executive tone',
    pitch: 0.9,
    rate: 0.96,
  },
  {
    id: 'piper-lessac',
    name: 'Piper - Lessac',
    engine: 'piper',
    gender: 'female',
    accent: 'US English',
    description: 'Natural, cheerful, daily focus guide',
    pitch: 1.1,
    rate: 1.05,
  },
  {
    id: 'piper-ryan',
    name: 'Piper - Ryan',
    engine: 'piper',
    gender: 'male',
    accent: 'US English',
    description: 'Casual, friendly, energetic productivity partner',
    pitch: 0.98,
    rate: 1.05,
  },
  {
    id: 'system-natural',
    name: 'System Natural',
    engine: 'system',
    gender: 'female',
    accent: 'System Default',
    description: 'Built-in Windows system natural speech voice',
    pitch: 1.0,
    rate: 1.0,
  },
];

export interface ModelRecommendation {
  name: string;
  tag: string;
  sizeGb: string;
  minRamGb: number;
  smoothness: 'Ultra-Fast' | 'Smooth' | 'Balanced';
  stars: number;
  description: string;
  command: string;
}

export const MODEL_RECOMMENDATIONS: ModelRecommendation[] = [
  {
    name: 'Llama 3.2 (3B)',
    tag: 'llama3.2',
    sizeGb: '2.0 GB',
    minRamGb: 4,
    smoothness: 'Ultra-Fast',
    stars: 5,
    description: 'Ultra-responsive and lightweight. Runs smoothly on almost any modern laptop (4GB+ RAM, no GPU required).',
    command: 'ollama run llama3.2',
  },
  {
    name: 'Phi-3.5 Mini (3.8B)',
    tag: 'phi3.5',
    sizeGb: '2.2 GB',
    minRamGb: 4,
    smoothness: 'Ultra-Fast',
    stars: 5,
    description: 'Microsoft’s highly efficient compact model. Excellent at task planning, logic, and rapid drafting.',
    command: 'ollama run phi3.5',
  },
  {
    name: 'Qwen 2.5 (7B)',
    tag: 'qwen2.5',
    sizeGb: '4.7 GB',
    minRamGb: 8,
    smoothness: 'Balanced',
    stars: 4,
    description: 'Top-tier accuracy for scheduling, complex reasoning, and coding assistance. Recommended for 8GB+ RAM.',
    command: 'ollama run qwen2.5',
  },
  {
    name: 'Mistral (7B)',
    tag: 'mistral',
    sizeGb: '4.1 GB',
    minRamGb: 8,
    smoothness: 'Smooth',
    stars: 4,
    description: 'Renowned general-purpose model with rich reasoning and polite conversational skills for 8GB+ RAM.',
    command: 'ollama run mistral',
  },
];

export const defaultAISettings: AISettings = {
  provider: 'ollama',
  model_name: 'llama3.2',
  endpoint_url: 'http://localhost:11434',
  api_key: '',
  speech_input_enabled: true,
  speech_output_enabled: false,
  voice_pitch: 1.0,
  voice_rate: 1.0,
  tts_voice_id: 'kokoro-heart',
};

export const ollamaService = {
  isServerRunning: async (): Promise<boolean> => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  },

  ensureRunning: async (): Promise<boolean> => {
    const running = await ollamaService.isServerRunning();
    if (running) return true;

    try {
      await ollamaApi.start();
      for (let i = 0; i < 7; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await ollamaService.isServerRunning()) return true;
      }
    } catch {
      // outside tauri
    }
    return false;
  },

  getInstalledModels: async (): Promise<string[]> => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name || m.model);
    } catch {
      return [];
    }
  },

  getMachineCapabilities: () => {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const ramGb = typeof navigator !== 'undefined' && (navigator as any).deviceMemory ? (navigator as any).deviceMemory : 8;
    return {
      cores,
      ramGb,
      tier: ramGb >= 16 ? 'high' : ramGb >= 8 ? 'balanced' : 'entry',
    };
  },
};

// Web Speech API Types
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

let activeRecognition: any = null;

export const speechService = {
  isSTTAvailable: (): boolean => {
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  },

  startListening: (
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (err: unknown) => void,
    onEnd?: () => void
  ): boolean => {
    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) return false;

    try {
      if (activeRecognition) {
        activeRecognition.stop();
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = (finalTranscript || interimTranscript).trim();
        if (text) {
          onResult(text, !!finalTranscript);
        }
      };

      recognition.onerror = (e: any) => {
        if (onError) onError(e);
      };

      recognition.onend = () => {
        activeRecognition = null;
        if (onEnd) onEnd();
      };

      activeRecognition = recognition;
      recognition.start();
      return true;
    } catch (e) {
      if (onError) onError(e);
      return false;
    }
  },

  stopListening: () => {
    if (activeRecognition) {
      try {
        activeRecognition.stop();
      } catch {
        // ignore
      }
      activeRecognition = null;
    }
  },

  speak: (text: string, voiceId?: string, customRate?: number, customPitch?: number) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner pronunciation
    const cleanText = text
      .replace(/[*#_`~[\]]/g, '')
      .replace(/\(https?:\/\/[^)]+\)/g, '')
      .trim();

    if (!cleanText) return;

    const voiceMeta = LOCAL_NEURAL_VOICES.find((v) => v.id === voiceId) || LOCAL_NEURAL_VOICES[0];
    const rate = customRate ?? voiceMeta.rate;
    const pitch = customPitch ?? voiceMeta.pitch;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = voiceMeta.accent.includes('British') ? 'en-GB' : 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice =
      voices.find((v) => {
        const name = v.name.toLowerCase();
        if (
          voiceMeta.accent.includes('British') &&
          (v.lang === 'en-GB' || name.includes('united kingdom') || name.includes('george') || name.includes('hazel'))
        ) {
          return true;
        }
        if (
          voiceMeta.gender === 'female' &&
          (name.includes('zira') || name.includes('jenny') || name.includes('aria') || name.includes('female'))
        ) {
          return true;
        }
        if (
          voiceMeta.gender === 'male' &&
          (name.includes('david') || name.includes('guy') || name.includes('male'))
        ) {
          return true;
        }
        return v.name.includes('Natural');
      }) || voices[0];

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
  },

  previewVoice: (voiceId: string) => {
    const voice = LOCAL_NEURAL_VOICES.find((v) => v.id === voiceId) || LOCAL_NEURAL_VOICES[0];
    const sampleText = `Hello! This is ${voice.name}. I am your local DayOS productivity assistant.`;
    speechService.speak(sampleText, voice.id);
  },

  stopSpeaking: () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  },
};

export const aiAgentService = {
  getSettings: async (): Promise<AISettings> => {
    try {
      const data = await settingsApi.get(AI_SETTINGS_KEY);
      if (!data) return defaultAISettings;
      return { ...defaultAISettings, ...JSON.parse(data) };
    } catch {
      return defaultAISettings;
    }
  },

  saveSettings: async (settings: AISettings): Promise<void> => {
    await settingsApi.set(AI_SETTINGS_KEY, JSON.stringify(settings));
  },

  // Build DayOS context (today's tasks, meetings, notes)
  getContext: async (): Promise<string> => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let context = `Current date: ${todayStr} (${format(new Date(), 'EEEE')}).\n`;

    try {
      const tasks = await taskApi.getByDate(todayStr);
      const todoTasks = tasks.filter((t) => t.status !== 'completed');
      context += `\nToday's active tasks (${todoTasks.length}):\n`;
      todoTasks.slice(0, 10).forEach((t) => {
        context += `- [${t.priority.toUpperCase()}] ${t.title}${t.start_time ? ` at ${t.start_time}` : ''}\n`;
      });

      const meetings = await meetingApi.getByDate(todayStr);
      context += `\nToday's scheduled meetings (${meetings.length}):\n`;
      meetings.forEach((m) => {
        context += `- ${m.title} from ${m.start_time}${m.end_time ? ` to ${m.end_time}` : ''}\n`;
      });
    } catch {
      // ignore
    }

    return context;
  },

  // Tool execution
  executeTool: async (toolName: string, args: Record<string, any>): Promise<string> => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (toolName === 'create_task') {
      try {
        const task = await taskApi.create({
          title: args.title || 'Untitled Task',
          priority: args.priority || 'medium',
          scheduled_date: args.scheduled_date || todayStr,
          start_time: args.start_time,
          description: args.description,
        });
        return `Created task: "${task.title}" with ${task.priority} priority for ${task.scheduled_date}.`;
      } catch (err: any) {
        return `Failed to create task: ${err.message || String(err)}`;
      }
    }

    if (toolName === 'search_notes') {
      try {
        const notes = await noteApi.getAll();
        const query = (args.query || '').toLowerCase();
        const matched = notes.filter(
          (n) => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
        );
        if (matched.length === 0) return `No notes found matching "${query}".`;
        return `Found ${matched.length} notes:\n` + matched.map((n) => `- ${n.title}`).join('\n');
      } catch (err: any) {
        return `Failed to search notes: ${err.message || String(err)}`;
      }
    }

    return `Tool ${toolName} executed.`;
  },

  // Process User Query
  sendMessage: async (userPrompt: string, history: AIMessage[]): Promise<string> => {
    const settings = await aiAgentService.getSettings();
    const context = await aiAgentService.getContext();

    // Check for quick intent handling
    const lower = userPrompt.toLowerCase().trim();
    if (lower.startsWith('create task ') || lower.startsWith('add task ')) {
      const taskTitle = userPrompt.replace(/^(create|add) task /i, '').trim();
      const result = await aiAgentService.executeTool('create_task', { title: taskTitle });
      return result;
    }

    if (lower.includes('today') && (lower.includes('agenda') || lower.includes('schedule') || lower.includes('what do i have'))) {
      return `Here is your agenda for today:\n${context}`;
    }

    // Call Local LLM (Ollama) or Online LLM
    if (settings.provider === 'ollama') {
      await ollamaService.ensureRunning();
      const endpoint = `${settings.endpoint_url || 'http://localhost:11434'}/api/chat`;
      try {
        const messages = [
          {
            role: 'system',
            content: `You are DayOS AI, a helpful, concise, and focused local productivity assistant. You help the user manage their day, organize tasks, plan meetings, and stay in deep focus. Keep responses actionable and direct.\n\nContext:\n${context}`,
          },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userPrompt },
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.model_name || 'llama3.2',
            messages,
            stream: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama error: HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.message?.content || 'No response received from local model.';
      } catch (e: any) {
        return `Could not reach local Ollama server at ${settings.endpoint_url}. Is Ollama running? (Error: ${e.message})`;
      }
    }

    // Cloud Providers (OpenAI, Gemini, OpenRouter)
    if (settings.api_key) {
      try {
        let apiUrl = 'https://api.openai.com/v1/chat/completions';
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.api_key}`,
        };

        if (settings.provider === 'openrouter') {
          apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        }

        const messages = [
          {
            role: 'system',
            content: `You are DayOS AI, a local-first productivity assistant. Context:\n${context}`,
          },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userPrompt },
        ];

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: settings.model_name || 'gpt-4o-mini',
            messages,
          }),
        });

        if (!res.ok) {
          throw new Error(`Cloud API error: HTTP ${res.status}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'No response from AI model.';
      } catch (err: any) {
        return `Cloud AI request failed: ${err.message}`;
      }
    }

    return `DayOS Assistant here! To connect your AI model, go to Settings → AI Agent and configure either your local Ollama server or your API key. In the meantime, you can ask me to "create task <name>" or "what is on my agenda today".`;
  },
};

