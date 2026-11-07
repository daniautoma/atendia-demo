'use client';

import React, { useState, useEffect } from 'react';
import { Power, Clock, Menu, Sparkles } from 'lucide-react';
import { useMobileNav } from '@/components/MobileNavContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { toggle } = useMobileNav();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    // Cargar estado inicial del asistente
    fetch('/api/business/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.assistantActive !== undefined) {
          setIsActive(data.assistantActive);
        }
      })
      .catch(() => {});

    // Actualizar reloj en hora de El Salvador (UTC-6)
    const updateClock = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('es-SV', {
        timeZone: 'America/El_Salvador',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTime(timeStr);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleAssistant = async () => {
    setLoading(true);
    const nextState = !isActive;
    setIsActive(nextState);

    try {
      await fetch('/api/business/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantActive: nextState }),
      });
    } catch (err) {
      console.error('Error toggling assistant:', err);
      setIsActive(!nextState); // revert
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="h-16 px-4 sm:px-8 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menú"
          className="md:hidden p-2 -ml-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-stone-500 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Marca de agua / aviso en modo demo */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Entorno de Prueba en Vivo de daniautoma</span>
        </div>

        {/* Hora oficial en El Salvador */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>El Salvador: {currentTime || '...'}</span>
        </div>

        {/* Interruptor General del Asistente */}
        <button
          onClick={toggleAssistant}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-semibold transition-all border shadow-xs ${
            isActive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
          title="Conmuta la atención automática de todos los canales"
        >
          <Power
            className={`w-3.5 h-3.5 ${
              isActive ? 'text-emerald-600 animate-pulse' : 'text-amber-600'
            }`}
          />
          <span className="hidden sm:inline">{isActive ? 'Asistente Encendido' : 'Asistente en Pausa'}</span>
          <span className="sm:hidden">{isActive ? 'Activo' : 'Pausa'}</span>
        </button>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
