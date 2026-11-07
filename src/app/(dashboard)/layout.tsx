import React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MobileNavProvider } from '@/components/MobileNavContext';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  let business = null;
  try {
    business = await prisma.businessProfile.findFirst();
  } catch {
    // Si la base de datos está offline durante la generación estática
  }

  return (
    <MobileNavProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-50">
        {/* Banner permanente de marca de agua en modo demo */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-xs shrink-0 select-none z-30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wide">Entorno de Prueba en Vivo de daniautoma</span>
          <span className="hidden sm:inline text-blue-200">| Atendia Demo Studio (Modo Demo)</span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar
            businessName={business?.name || 'Atendia Demo Studio'}
            assistantActive={business?.assistantActive ?? true}
            agencyName={business?.agencyName || 'daniautoma'}
            userRole={session?.role || 'AGENT'}
            userName={session?.name || 'Usuario'}
          />
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </MobileNavProvider>
  );
}
