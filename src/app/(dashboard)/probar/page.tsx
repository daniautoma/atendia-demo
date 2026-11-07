'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Send,
  Sparkles,
  RotateCcw,
  Shield,
  ShieldAlert,
  Bot,
  User,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCode,
  Activity,
  Layers,
  Zap,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'CUSTOMER' | 'ASSISTANT';
  text: string;
  toolCalls?: any[];
  timestamp: string;
}

export default function ProbarPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ASSISTANT',
      text: '¡Hola! Soy Valentina, tu asistente virtual de demostración desarrollado por daniautoma. ¿En qué te puedo ayudar hoy?',
      timestamp: new Date().toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [simulateChannel, setSimulateChannel] = useState<'WHATSAPP_YCLOUD' | 'WHATSAPP_BAILEYS' | 'WEB'>('WHATSAPP_YCLOUD');
  const [timeline, setTimeline] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'CUSTOMER',
      text,
      timestamp: new Date().toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          safeMode,
          simulateChannel,
          history: newHistory.map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al comunicarse con el asistente');

      const assistantMsg: ChatMessage = {
        id: 'asst_' + Date.now(),
        sender: 'ASSISTANT',
        text: data.response || 'He procesado tu consulta con nuestras herramientas clínicas.',
        toolCalls: data.toolCalls,
        timestamp: new Date().toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (data.timeline) setTimeline(data.timeline);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'ASSISTANT',
          text: `⚠️ Error de comunicación: ${err?.message || 'Error del servidor'}`,
          timestamp: new Date().toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = () => {
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        sender: 'ASSISTANT',
        text: '¡Hola! Soy Valentina, tu asistente virtual de demostración desarrollado por daniautoma. ¿En qué te puedo ayudar hoy?',
        timestamp: new Date().toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador' }),
      },
    ]);
    setTimeline([]);
  };

  // Botones de prueba rápida
  const quickPrompts = [
    { label: 'Tarifas Limpieza', text: '¿Qué precio tiene la limpieza dental profunda y cuánto dura la sesión?' },
    { label: 'Urgencia por Dolor', text: 'Tengo un dolor muy fuerte y punzante en una muela desde anoche, ¿podéis atenderme hoy de urgencia?' },
    { label: 'Pedir Cita Martes', text: 'Quiero agendar cita para revisión diagnóstica el próximo martes a las 11:30' },
    { label: 'Test YCloud Oficial', text: 'Ejecutar test de arquitectura modular YCloud: verificar endpoint y firma de webhook' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-50">
      <Header
        title="Probar Asistente"
        subtitle="Simula una conversación en tiempo real con DentalIA inspeccionando tools y contexto"
        actions={
          <div className="flex items-center gap-2">
            {/* Conmutador Modo Seguro */}
            <div
              onClick={() => setSafeMode(!safeMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer select-none transition-all ${
                safeMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse'
              }`}
              title="Modo Seguro: Simula herramientas de escritura y pasarelas sin alterar datos reales"
            >
              <Shield className={`w-3.5 h-3.5 ${safeMode ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>{safeMode ? 'Modo Seguro ACTIVO' : 'Modo Real (PELIGRO)'}</span>
            </div>

            {/* Reiniciar conversación */}
            <button
              onClick={handleResetConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
              <span>Nueva conversación</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-6">
        {/* COLUMNA IZQUIERDA: Simulador de Chat */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {/* Barra superior del chat simulador */}
          <div className="px-5 py-3.5 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 leading-tight">DentalIA (Simulación)</p>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>En línea • America/El_Salvador</span>
                </div>
              </div>
            </div>

            {/* Selector de canal de simulación */}
            <div className="flex items-center gap-1 bg-stone-200/60 p-1 rounded-lg text-[11px] font-medium">
              {[
                { id: 'WHATSAPP_YCLOUD', label: 'WA YCloud' },
                { id: 'WHATSAPP_BAILEYS', label: 'WA Baileys' },
                { id: 'WEB', label: 'Chat Web' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSimulateChannel(c.id as any)}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    simulateChannel === c.id
                      ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Área de mensajes con scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-stone-50/30">
            {messages.map((m) => {
              const isAssistant = m.sender === 'ASSISTANT';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs ${
                      isAssistant
                        ? 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs'
                        : 'bg-teal-600 text-white rounded-tr-xs font-medium'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {/* Badge de Tools invocadas si el asistente usó herramientas */}
                    {isAssistant && m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-stone-100 flex flex-wrap gap-1.5">
                        {m.toolCalls.map((t: any, idx: number) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-mono"
                          >
                            <Wrench className="w-2.5 h-2.5" />
                            <span>{t.tool}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1 px-1">{m.timestamp}</span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-stone-200 w-fit text-xs text-stone-500">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce delay-100" />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce delay-200" />
                </div>
                <span>DentalIA está escribiendo...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Botones de prueba rápida */}
          <div className="px-5 py-2.5 border-t border-stone-100 bg-white flex flex-wrap gap-2">
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider self-center mr-1">
              Pruebas Rápidas:
            </span>
            {quickPrompts.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(q.text)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input de envío */}
          <div className="p-4 border-t border-stone-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escribe como un paciente (ej: '¿Cuánto cuesta un empaste?' o 'Necesito cita urgente')..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: Inspector y Línea de Tiempo */}
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Línea de Tiempo del Asistente
              </h3>
            </div>
            <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-mono font-medium">
              OpenRouter + Tools
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {timeline.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs space-y-2">
                <Layers className="w-8 h-8 mx-auto text-stone-300" />
                <p>Envía un mensaje de prueba para ver el desglose en vivo del razonamiento y herramientas llamadas.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                {timeline.map((item, index) => (
                  <div key={index} className="relative group">
                    <span
                      className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
                        item.step === 'TOOL_INVOKED'
                          ? 'bg-amber-500'
                          : item.step === 'TOOL_RESULT'
                          ? 'bg-teal-500'
                          : item.step === 'RESPONSE_READY'
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-stone-900 leading-tight">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-stone-400 font-mono">{item.timestamp}</span>
                      </div>

                      {item.detail && (
                        <pre className="mt-2 p-2.5 bg-stone-900 text-stone-200 rounded-lg text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-36">
                          {JSON.stringify(item.detail, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pie del Inspector con estado de Modo Seguro */}
          <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between text-[11px] text-stone-500">
            <span>Herramientas activas: 6</span>
            <span className="flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Reglas fijas aplicadas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
