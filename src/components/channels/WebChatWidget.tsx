'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, RotateCcw } from 'lucide-react';

interface WebChatWidgetProps {
  color?: string;
  title?: string;
  welcomeMessage?: string;
}

export function WebChatWidget({
  color = '#2563eb',
  title = 'Valentina | Asistente Virtual Demo',
  welcomeMessage = '¡Hola! Soy Valentina, tu asistente virtual de demostración desarrollado por daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?',
}: WebChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'CUSTOMER' | 'ASSISTANT'; text: string }>>([
    { sender: 'ASSISTANT', text: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let saved = localStorage.getItem('atendia_web_session');
    if (!saved) {
      saved = 'web_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('atendia_web_session', saved);
    }
    setSessionId(saved);
  }, []);

  // Auto-ajuste de altura del textarea para no dejar el texto oculto
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 110)}px`;
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  const handleResetChat = () => {
    if (loading) return;
    const newSession = 'web_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('atendia_web_session', newSession);
    setSessionId(newSession);
    setMessages([{ sender: 'ASSISTANT', text: welcomeMessage }]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setMessages((prev) => [...prev, { sender: 'CUSTOMER', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          sessionId,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { sender: 'ASSISTANT', text: data.response || 'Disculpa, no he podido procesar tu solicitud.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'ASSISTANT', text: 'Error temporal de conexión con el asistente.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Si presiona Ctrl+Enter o Cmd+Enter, enviar mensaje como atajo rápido
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    // Enter normal simplemente baja de renglón (comportamiento nativo de textarea)
  };

  return (
    <div className="font-sans">
      {/* Botón flotante para abrir/cerrar */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            style={{ backgroundColor: color }}
            aria-label="Abrir chat de atención"
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 transition-all cursor-pointer ring-4 ring-white/60 active:scale-95"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Ventana de chat desplegada (completamente adaptada a móviles y desktop) */}
      {isOpen && (
        <div className="fixed inset-x-2 bottom-2 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-auto sm:w-[400px] h-[calc(100dvh-1rem)] sm:h-[540px] max-h-[640px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Cabecera del widget */}
          <div
            style={{ backgroundColor: color }}
            className="p-3.5 sm:p-4 text-white flex items-center justify-between shrink-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs backdrop-blur-xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold leading-tight truncate">{title}</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                  <span className="truncate">En línea • Asistente IA</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reiniciar conversación"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Cerrar chat"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área de conversación */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-stone-50/40 text-xs leading-relaxed">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.sender === 'ASSISTANT' ? 'items-start' : 'items-end'}`}
              >
                <div
                  style={m.sender === 'CUSTOMER' ? { backgroundColor: color } : {}}
                  className={`max-w-[88%] sm:max-w-[85%] rounded-2xl p-3 shadow-2xs ${
                    m.sender === 'ASSISTANT'
                      ? 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs'
                      : 'text-white rounded-tr-xs font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-2.5 bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce delay-200" />
                <span className="text-[11px]">Escribiendo...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input inferior con textarea multilínea auto-ajustable */}
          <div className="p-2.5 sm:p-3 border-t border-stone-100 bg-white shrink-0">
            <div className="flex items-end gap-2 bg-stone-50 rounded-xl p-1.5 border border-stone-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje... (Enter baja de renglón)"
                rows={1}
                className="flex-1 bg-transparent px-2 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none resize-none min-h-[36px] max-h-28 overflow-y-auto leading-relaxed"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{ backgroundColor: color }}
                title="Enviar mensaje"
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-xs shrink-0 hover:brightness-110 active:scale-95 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-stone-400">
              <span>Enter baja de renglón • Envía con botón</span>
              <span>Powered by <b>daniautoma</b></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
