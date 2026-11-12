import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Building2, Phone, Calendar, Bot, Cpu } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { WebChatWidget } from '@/components/channels/WebChatWidget';

export default async function DemoPage() {
  let business = null;
  let channelWeb = null;
  try {
    [business, channelWeb] = await Promise.all([
      prisma.businessProfile.findFirst(),
      prisma.channelConfig.findUnique({ where: { type: 'WEB' } }),
    ]);

    // Garantizar que exista configuración por defecto si la BD no se ha sembrado
    if (!channelWeb) {
      try {
        channelWeb = await prisma.channelConfig.create({
          data: {
            type: 'WEB',
            webChatEnabled: true,
            webChatColor: '#2563eb',
            webChatTitle: 'Valentina | Asistente Virtual Demo',
            webChatWelcome: '¡Hola! Soy Valentina, asistente virtual de demostración desarrollado por daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?',
          },
        });
      } catch {}
    }
  } catch {}

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col relative font-sans">
      {/* Barra superior de aviso de prueba en vivo */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white text-xs font-medium py-1 px-4 text-center flex items-center justify-center gap-2 shadow-xs shrink-0 select-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold tracking-wide">Entorno de Prueba en Vivo de daniautoma</span>
        <span className="hidden sm:inline text-blue-200">| Atendia Demo Studio</span>
      </div>

      {/* Barra de cabecera */}
      <nav className="bg-white border-b border-stone-200 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-xs shrink-0">
            D
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-stone-900 text-xs sm:text-sm truncate">{business?.name || 'Atendia Demo Studio'}</h1>
            <p className="text-[10px] sm:text-[11px] text-stone-500 truncate">{business?.activity || 'Demostración de Asistente de IA Omnicanal y Agendamiento'}</p>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Volver al Panel</span>
          <span className="sm:hidden">Panel</span>
        </Link>
      </nav>

      {/* Hero de demostración */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:p-8 flex flex-col justify-center items-center text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] sm:text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Sitio Web Demo para Clientes Potenciales (Negocios, Clínicas y Servicios)
        </span>

        <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight max-w-2xl px-2">
          Atención al Cliente 24/7 y Agendamiento Inteligente con IA
        </h2>

        <p className="mt-3 sm:mt-4 text-stone-600 text-xs sm:text-sm max-w-xl leading-relaxed px-2">
          Esta es la página pública donde se integra el widget de <b>Valentina</b>. Los clientes pueden resolver dudas al instante, conocer los servicios y agendar citas en un calendario interactivo en tiempo real.
        </p>

        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl text-left">
          <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-stone-200 shadow-2xs hover:border-blue-300 transition-colors">
            <Calendar className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-bold text-xs text-stone-900">Consulta Inicial (30 min)</h3>
            <p className="text-[11px] text-stone-500 mt-1">Evaluación diagnóstica y asesoría general sin costo para tu negocio.</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-stone-200 shadow-2xs hover:border-blue-300 transition-colors">
            <Bot className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-bold text-xs text-stone-900">Cita Especializada (45 min)</h3>
            <p className="text-[11px] text-stone-500 mt-1">Atención personalizada para definir alcance y soluciones específicas.</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-stone-200 shadow-2xs hover:border-blue-300 transition-colors">
            <Cpu className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-bold text-xs text-stone-900">Muestrario con n8n</h3>
            <p className="text-[11px] text-stone-500 mt-1">Demostración en vivo de automatización omnicanal, webhooks y Google Calendar.</p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-xs flex items-center gap-2 max-w-lg">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Haz clic en el botón flotante en la esquina inferior derecha para conversar con <b>Valentina</b>.</span>
        </div>
      </main>

      {/* Widget Interactivo Real del Chat Web */}
      {(channelWeb ? channelWeb.webChatEnabled : true) && (
        <WebChatWidget
          color={channelWeb?.webChatColor || '#2563eb'}
          title={channelWeb?.webChatTitle || 'Valentina | Asistente Virtual Demo'}
          welcomeMessage={channelWeb?.webChatWelcome || '¡Hola! Soy Valentina, asistente virtual de demostración desarrollado por daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?'}
        />
      )}
    </div>
  );
}
