import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Atendia | Sistema de Asistentes IA & Agendamiento (Modo Demo)',
  description: 'Atendia Demo Studio — Entorno de Prueba en Vivo de daniautoma',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-stone-50 text-stone-900 selection:bg-teal-100 selection:text-teal-900">
        {children}
      </body>
    </html>
  );
}
