'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Modal } from '@/components/ui/Modal';
import { formatPrice } from '@/lib/utils';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Sparkles,
  HelpCircle,
  FileText,
  Save,
  Check,
  AlertCircle,
  Clock,
  ExternalLink,
  Phone,
  MapPin,
  Lock,
} from 'lucide-react';

export default function ConocimientoPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'ADMIN' | 'AGENT'>('ADMIN');
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Perfil del negocio
  const [business, setBusiness] = useState({
    name: 'Atendia Demo Studio',
    activity: 'Demostración de Asistente de IA Omnicanal y Agendamiento Automatizado',
    address: 'Entorno de Prueba en Vivo de daniautoma',
    phone: '+503 2200 1234',
    website: 'https://demo.daniautoma.cloud',
  });

  // Servicios
  const [services, setServices] = useState<any[]>([]);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  // FAQs
  const [faqs, setFaqs] = useState<any[]>([]);
  const [editingFaq, setEditingFaq] = useState<any | null>(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  // Modal «Importar desde una web»
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importProposal, setImportProposal] = useState<any | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resBiz, resServ, resFaqs, resMe] = await Promise.all([
        fetch('/api/business/profile'),
        fetch('/api/knowledge/services'),
        fetch('/api/knowledge/faqs'),
        fetch('/api/auth/me'),
      ]);

      const [bizData, servData, faqsData, meData] = await Promise.all([
        resBiz.json(),
        resServ.json(),
        resFaqs.json(),
        resMe.json().catch(() => null),
      ]);

      if (meData?.user?.role) {
        setUserRole(meData.user.role);
      }

      if (bizData && !bizData.error) {
        setBusiness({
          name: bizData.name || '',
          activity: bizData.activity || '',
          address: bizData.address || '',
          phone: bizData.phone || '',
          website: bizData.website || '',
        });
      }
      if (Array.isArray(servData)) setServices(servData);
      if (Array.isArray(faqsData)) setFaqs(faqsData);
    } catch {
      setError('Error al cargar la información de conocimiento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveBusiness = async () => {
    setSavingBusiness(true);
    setError(null);
    try {
      const res = await fetch('/api/business/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(business),
      });
      if (!res.ok) throw new Error('Error al guardar perfil');
      setBusinessSuccess(true);
      setTimeout(() => setBusinessSuccess(false), 2500);
    } catch {
      setError('No se pudo guardar la información del negocio.');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      const isEdit = !!editingService.id;
      const res = await fetch('/api/knowledge/services', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingService),
      });

      if (!res.ok) throw new Error('Error al guardar servicio');
      setIsServiceModalOpen(false);
      setEditingService(null);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Error al guardar el servicio');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este servicio?')) return;
    try {
      await fetch(`/api/knowledge/services?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      alert('Error al eliminar');
    }
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;

    try {
      const isEdit = !!editingFaq.id;
      const res = await fetch('/api/knowledge/faqs', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFaq),
      });

      if (!res.ok) throw new Error('Error al guardar FAQ');
      setIsFaqModalOpen(false);
      setEditingFaq(null);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Error al guardar FAQ');
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta pregunta frecuente?')) return;
    try {
      await fetch(`/api/knowledge/faqs?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      alert('Error al eliminar FAQ');
    }
  };

  const handleStartImport = async () => {
    if (!importUrl) return;
    setImportLoading(true);
    setImportProposal(null);
    setImportNotice(null);

    try {
      const res = await fetch('/api/knowledge/import-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar web');
      setImportProposal(data.proposal);
      if (data.notice) setImportNotice(data.notice);
    } catch (err: any) {
      alert(err?.message || 'No se pudo analizar la web.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importProposal) return;

    // Aplicar servicios y faqs propuestos
    try {
      if (importProposal.services && Array.isArray(importProposal.services)) {
        for (const s of importProposal.services) {
          await fetch('/api/knowledge/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          });
        }
      }

      if (importProposal.faqs && Array.isArray(importProposal.faqs)) {
        for (const f of importProposal.faqs) {
          await fetch('/api/knowledge/faqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(f),
          });
        }
      }

      if (importProposal.businessInfo) {
        await fetch('/api/business/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: importProposal.businessInfo.name || business.name,
            activity: importProposal.businessInfo.activity || business.activity,
            address: importProposal.businessInfo.address || business.address,
            phone: importProposal.businessInfo.phone || business.phone,
          }),
        });
      }

      setIsImportModalOpen(false);
      setImportProposal(null);
      setImportUrl('');
      fetchData();
      alert('¡Información importada y guardada con éxito en el conocimiento del asistente!');
    } catch {
      alert('Hubo un error al aplicar la propuesta.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-50">
      <Header
        title="Conocimiento del Negocio"
        subtitle="Datos de la empresa, catálogo de servicios, precios y preguntas frecuentes"
        actions={
          userRole !== 'AGENT' ? (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Importar desde una web</span>
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 max-w-5xl">
        {userRole === 'AGENT' && (
          <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-200/60 text-amber-800 flex items-center justify-center font-bold shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-amber-950">Modo Solo Lectura (Rol Agente)</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Puedes consultar el catálogo de servicios, tarifas oficiales y preguntas frecuentes para informar a los pacientes. La creación, edición y borrado de información está reservada a Administradores.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] bg-amber-200/70 text-amber-900 font-bold uppercase tracking-wider shrink-0 ml-3">
              Solo Lectura
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Datos del Negocio */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Datos Principales del Negocio</h3>
                <p className="text-xs text-stone-500">Información básica que el asistente utiliza para situarse</p>
              </div>
            </div>
            {userRole !== 'AGENT' && (
              <button
                onClick={handleSaveBusiness}
                disabled={savingBusiness}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-all cursor-pointer"
              >
                {savingBusiness ? (
                  <span>Guardando...</span>
                ) : businessSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Guardado</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Actualizar datos</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre Comercial</label>
              <input
                type="text"
                disabled={userRole === 'AGENT'}
                value={business.name}
                onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-stone-100 disabled:text-stone-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Actividad / Especialidad</label>
              <input
                type="text"
                disabled={userRole === 'AGENT'}
                value={business.activity}
                onChange={(e) => setBusiness({ ...business, activity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-stone-100 disabled:text-stone-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Dirección Completa</label>
              <input
                type="text"
                disabled={userRole === 'AGENT'}
                value={business.address}
                onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-stone-100 disabled:text-stone-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  disabled={userRole === 'AGENT'}
                  value={business.phone}
                  onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-stone-100 disabled:text-stone-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Sitio Web</label>
                <input
                  type="url"
                  disabled={userRole === 'AGENT'}
                  value={business.website}
                  onChange={(e) => setBusiness({ ...business, website: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-stone-100 disabled:text-stone-600"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Catálogo de Servicios */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Servicios y Tarifas ({services.length})
                </h3>
                <p className="text-xs text-stone-500">
                  El asistente consulta esta lista para informar y calcular la duración de las citas
                </p>
              </div>
            </div>
            {userRole !== 'AGENT' && (
              <button
                onClick={() => {
                  setEditingService({
                    name: '',
                    description: '',
                    durationMinutes: 30,
                    price: 0,
                    isPriceFrom: false,
                    requiresEvaluation: false,
                  });
                  setIsServiceModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir servicio</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-stone-200 hover:border-stone-300 bg-white shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-stone-900">{s.name}</h4>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full shrink-0">
                      {formatPrice(s.price, s.isPriceFrom)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{s.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      {s.durationMinutes} min
                    </span>
                    {s.requiresEvaluation && (
                      <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200">
                        Requiere valoración
                      </span>
                    )}
                  </div>

                  {userRole !== 'AGENT' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingService(s);
                          setIsServiceModalOpen(true);
                        }}
                        className="p-1 hover:text-stone-900 text-stone-400 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(s.id)}
                        className="p-1 hover:text-rose-600 text-stone-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Preguntas Frecuentes (FAQs) */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Preguntas Frecuentes ({faqs.length})
                </h3>
                <p className="text-xs text-stone-500">Respuestas oficiales a dudas recurrentes de pacientes</p>
              </div>
            </div>
            {userRole !== 'AGENT' && (
              <button
                onClick={() => {
                  setEditingFaq({ question: '', answer: '' });
                  setIsFaqModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir FAQ</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {faqs.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 hover:bg-white transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-stone-900">{f.question}</p>
                    <p className="text-xs text-stone-600 leading-relaxed">{f.answer}</p>
                  </div>
                  {userRole !== 'AGENT' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingFaq(f);
                          setIsFaqModalOpen(true);
                        }}
                        className="p-1 hover:text-stone-900 text-stone-400 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFaq(f.id)}
                        className="p-1 hover:text-rose-600 text-stone-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modal Añadir/Editar Servicio */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title={editingService?.id ? 'Editar Servicio' : 'Nuevo Servicio'}
        description="Define el nombre, descripción clínica, duración y condiciones de precio"
      >
        {editingService && (
          <form onSubmit={handleSaveService} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre del Servicio</label>
              <input
                type="text"
                required
                value={editingService.name}
                onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                placeholder="ej: Higiene Dental y Pulido"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Descripción</label>
              <textarea
                required
                rows={2}
                value={editingService.description}
                onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                placeholder="Explica qué incluye el tratamiento..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Duración (minutos)</label>
                <input
                  type="number"
                  required
                  min={5}
                  step={5}
                  value={editingService.durationMinutes}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      durationMinutes: parseInt(e.target.value) || 30,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Precio ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingService.price ?? ''}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      price: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                  placeholder="0 = Gratis"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-stone-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editingService.isPriceFrom}
                  onChange={(e) => setEditingService({ ...editingService, isPriceFrom: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span className="text-xs text-stone-700 font-medium">Es un precio de partida («Desde...»)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editingService.requiresEvaluation}
                  onChange={(e) =>
                    setEditingService({ ...editingService, requiresEvaluation: e.target.checked })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span className="text-xs text-stone-700 font-medium">Requiere valoración clínica previa</span>
              </label>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700"
              >
                Guardar Servicio
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Añadir/Editar FAQ */}
      <Modal
        isOpen={isFaqModalOpen}
        onClose={() => setIsFaqModalOpen(false)}
        title={editingFaq?.id ? 'Editar Pregunta Frecuente' : 'Nueva Pregunta Frecuente'}
        description="Añade la duda del cliente y la respuesta oficial y clara que debe dar el asistente"
      >
        {editingFaq && (
          <form onSubmit={handleSaveFaq} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Pregunta</label>
              <input
                type="text"
                required
                value={editingFaq.question}
                onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                placeholder="ej: ¿Atendéis urgencias el fin de semana?"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Respuesta</label>
              <textarea
                required
                rows={3}
                value={editingFaq.answer}
                onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                placeholder="Escribe la respuesta detallada..."
              />
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700"
              >
                Guardar FAQ
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal «Importar desde una web» */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportProposal(null);
        }}
        title="Importar Conocimiento desde una Web"
        description="Pega la URL de la página del cliente. El servidor descargará el sitio y extraerá servicios, horarios y FAQs automáticamente."
        maxWidth="2xl"
      >
        <div className="space-y-5">
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://dentalsansalvador.sv"
              className="flex-1 px-3.5 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <button
              onClick={handleStartImport}
              disabled={importLoading || !importUrl}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {importLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analizando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extraer</span>
                </>
              )}
            </button>
          </div>

          {importNotice && (
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              {importNotice}
            </p>
          )}

          {importProposal && (
            <div className="space-y-4 pt-4 border-t border-stone-100 max-h-[50vh] overflow-y-auto pr-1">
              <div className="p-3 bg-stone-50 rounded-lg text-xs space-y-1">
                <p className="font-bold text-stone-900">Negocio Detectado:</p>
                <p className="text-stone-700">{importProposal.businessInfo?.name} - {importProposal.businessInfo?.activity}</p>
                <p className="text-stone-500">{importProposal.businessInfo?.address} | {importProposal.businessInfo?.phone}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-stone-800 mb-1.5">
                  Servicios Detectados ({importProposal.services?.length || 0}):
                </p>
                <div className="space-y-1.5">
                  {importProposal.services?.map((s: any, i: number) => (
                    <div key={i} className="p-2 border border-stone-200 rounded text-xs flex justify-between">
                      <div>
                        <span className="font-semibold text-stone-900">{s.name}</span>
                        <p className="text-stone-500 text-[11px]">{s.description}</p>
                      </div>
                      <span className="text-teal-700 font-medium shrink-0">
                        {formatPrice(s.price, s.isPriceFrom)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-stone-800 mb-1.5">
                  Preguntas Frecuentes ({importProposal.faqs?.length || 0}):
                </p>
                <div className="space-y-1.5">
                  {importProposal.faqs?.map((f: any, i: number) => (
                    <div key={i} className="p-2 border border-stone-200 rounded text-xs">
                      <p className="font-semibold text-stone-900">{f.question}</p>
                      <p className="text-stone-600 text-[11px] mt-0.5">{f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportProposal(null)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleApplyImport}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700"
                >
                  Aceptar e Incorporar al Asistente
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

