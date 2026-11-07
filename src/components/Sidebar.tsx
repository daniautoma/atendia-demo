'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Blocks,
  Share2,
  Sparkles,
  MessageSquare,
  Activity,
  Settings,
  Calendar,
  ExternalLink,
  LogOut,
  Building2,
  UserCheck,
  Shield,
  X,
} from 'lucide-react';
import { useMobileNav } from '@/components/MobileNavContext';

interface SidebarProps {
  businessName?: string;
  assistantActive?: boolean;
  agencyName?: string;
  userRole?: string;
  userName?: string;
}

export function Sidebar({
  businessName = 'Atendia Demo Studio',
  assistantActive = true,
  agencyName = 'daniautoma',
  userRole = 'AGENT',
  userName = 'Usuario',
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, close } = useMobileNav();

  const isAgent = userRole === 'AGENT';

  // Catálogo completo de navegación
  const allNavItems = [
    { label: 'Resumen', href: '/', icon: LayoutDashboard, adminOnly: true },
    { label: 'Conversaciones', href: '/conversaciones', icon: MessageSquare, adminOnly: false },
    { label: 'Calendario', href: '/calendario', icon: Calendar, adminOnly: false },
    { label: 'Conocimiento', href: '/conocimiento', icon: BookOpen, adminOnly: false },
    { label: 'Comportamiento', href: '/comportamiento', icon: Bot, adminOnly: true },
    { label: 'Integraciones', href: '/integraciones', icon: Blocks, adminOnly: true },
    { label: 'Canales', href: '/canales', icon: Share2, adminOnly: true },
    { label: 'Probar', href: '/probar', icon: Sparkles, adminOnly: true },
    { label: 'Actividad', href: '/actividad', icon: Activity, adminOnly: true },
    { label: 'Ajustes', href: '/ajustes', icon: Settings, adminOnly: true },
  ];

  // Si es AGENT, solo puede ver Conversaciones, Calendario y Conocimiento
  const visibleNavItems = isAgent
    ? allNavItems.filter((item) => !item.adminOnly)
    : allNavItems;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const renderContent = (onItemClick?: () => void) => (
    <>
      {/* Cabecera de la Marca */}
      <div className="p-5 border-b border-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
            A
          </div>
          <div>
            <h1 className="font-semibold text-white text-base tracking-tight leading-none">Atendia Demo Studio</h1>
            <p className="text-[11px] text-blue-300 font-medium mt-0.5">{agencyName || 'daniautoma'}</p>
          </div>
        </div>

        {/* Badge Entorno de Prueba en Vivo */}
        <div className="mt-3 px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/50 flex items-center gap-1.5 text-[11px] text-blue-300 font-medium">
          <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">Entorno de Prueba en Vivo de daniautoma</span>
        </div>

        {/* Tarjeta del Negocio Actual */}
        <div className="mt-3 p-2.5 rounded-lg bg-stone-800/80 border border-stone-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-stone-400 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-medium text-stone-200 truncate">{businessName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    assistantActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[10px] text-stone-400">
                  {assistantActive ? 'Valentina activa' : 'En pausa'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación Principal Filtrada por Rol */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pie con Perfil de Usuario, Demo y Logout */}
      <div className="p-3 border-t border-stone-800 space-y-2">
        {/* Ficha de identidad y rol del usuario */}
        <div className="px-3 py-2 rounded-lg bg-stone-800/50 border border-stone-800 flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-xs font-semibold text-stone-200 truncate">{userName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {isAgent ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded font-medium border border-purple-800/40">
                  <UserCheck className="w-2.5 h-2.5" />
                  Agente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-teal-300 bg-teal-950/60 px-1.5 py-0.2 rounded font-medium border border-teal-800/40">
                  <Shield className="w-2.5 h-2.5" />
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/demo"
          target="_blank"
          onClick={onItemClick}
          className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:text-white hover:bg-stone-800/70 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
            Ver Chat Web (/demo)
          </span>
          <span className="text-[10px] bg-stone-800 px-1.5 py-0.5 rounded text-stone-400">Público</span>
        </Link>

        <button
          onClick={() => {
            onItemClick?.();
            handleLogout();
          }}
          className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Sidebar de Escritorio: Oculto en pantallas pequeñas (< md), fijo y visible en pantallas grandes (>= md) */}
      <aside className="hidden md:flex w-64 bg-stone-900 text-stone-200 flex-col h-screen border-r border-stone-800 shrink-0">
        {renderContent()}
      </aside>

      {/* 2. Menú Móvil Off-Canvas / Modal con Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel Lateral Deslizable */}
          <aside className="relative w-72 max-w-[85vw] bg-stone-900 text-stone-200 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Botón Cerrar (X) */}
            <button
              onClick={close}
              className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer z-20"
              aria-label="Cerrar navegación"
            >
              <X className="w-5 h-5" />
            </button>

            {renderContent(close)}
          </aside>
        </div>
      )}
    </>
  );
}
