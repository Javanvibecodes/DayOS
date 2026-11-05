import { settingsApi, taskApi, meetingApi, noteApi } from '@/lib/db/api';
import type { AIMessage, AISettings } from '@/types';
import { format } from 'date-fns';

const AI_SETTINGS_KEY = 'dayos_ai_agent_settings';

export const defaultAISettings: AISettings = {
  provider: 'ollama',
  model_name: 'llama3.2',
  endpoint_url: 'http://localhost:11434',
  api_key: '',
  speech_input_enabled: true,
  speech_output_enabled: false,
  voice_pitch: 1.0,
  voice_rate: 1.0,
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

  speak: (text: string, rate = 1.0, pitch = 1.0) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner pronunciation
    const cleanText = text
      .replace(/[*#_`~[\]]/g, '')
      .replace(/\(https?:\/\/[^)]+\)/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Zira')
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    window.speechSynthesis.speak(utterance);
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

