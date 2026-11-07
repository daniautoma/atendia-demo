'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, CheckCircle2 } from 'lucide-react';

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

  useEffect(() => {
    let saved = localStorage.getItem('atendia_web_session');
    if (!saved) {
      saved = 'web_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('atendia_web_session', saved);
    }
    setSessionId(saved);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
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

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Botón flotante para abrir/cerrar */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{ backgroundColor: color }}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 transition-all cursor-pointer ring-4 ring-white/60"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Ventana de chat desplegada */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[520px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Cabecera del widget */}
          <div
            style={{ backgroundColor: color }}
            className="p-4 text-white flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs backdrop-blur-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold leading-tight">{title}</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>En línea • Asistente IA</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de conversación */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/40 text-xs leading-relaxed">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.sender === 'ASSISTANT' ? 'items-start' : 'items-end'}`}
              >
                <div
                  style={m.sender === 'CUSTOMER' ? { backgroundColor: color } : {}}
                  className={`max-w-[85%] rounded-2xl p-3 shadow-2xs ${
                    m.sender === 'ASSISTANT'
                      ? 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs'
                      : 'text-white rounded-tr-xs font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
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

          {/* Input inferior */}
          <form onSubmit={handleSend} className="p-3 border-t border-stone-100 bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-stone-900"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{ backgroundColor: color }}
              className="px-3.5 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Pie de marca */}
          <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-100 text-center text-[10px] text-stone-400">
            Powered by <b>daniautoma</b> • Atendia Demo Studio
          </div>
        </div>
      )}
    </div>
  );
}

