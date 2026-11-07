'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Modal } from '@/components/ui/Modal';
import {
  Bot,
  Save,
  Eye,
  Check,
  AlertCircle,
  Copy,
  Clock,
  Sparkles,
  ShieldAlert,
  UserCheck,
  Calendar,
  Edit3,
  RotateCcw,
} from 'lucide-react';

export default function ComportamientoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados del formulario
  const [name, setName] = useState('Valentina (Asistente Virtual Demo)');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [tone, setTone] = useState('cercano');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [neverDoList, setNeverDoList] = useState('');
  const [outsideHoursBehavior, setOutsideHoursBehavior] = useState('APPOINTMENT_OR_MESSAGE');
  const [businessHours, setBusinessHours] = useState<any>({
    monday: { open: '09:00', close: '20:00', enabled: true },
    tuesday: { open: '09:00', close: '20:00', enabled: true },
    wednesday: { open: '09:00', close: '20:00', enabled: true },
    thursday: { open: '09:00', close: '20:00', enabled: true },
    friday: { open: '09:00', close: '20:00', enabled: true },
    saturday: { open: '10:00', close: '14:00', enabled: true },
    sunday: { open: '00:00', close: '00:00', enabled: false },
  });

  const [handoffRules, setHandoffRules] = useState<any>({
    onComplaint: true,
    onUrgency: true,
    onHumanRequest: true,
    onUnknownAnswer: true,
    customRule: '',
  });

  // Modal para ver y editar prompt completo
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [fullPrompt, setFullPrompt] = useState('');
  const [isCustomPrompt, setIsCustomPrompt] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaveSuccess, setPromptSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/assistant/behavior')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setName(data.name || 'DentalIA');
          setAvatarUrl(data.avatarUrl || '');
          setTone(data.tone || 'cercano');
          setWelcomeMessage(data.welcomeMessage || '');
          setCustomInstructions(data.customInstructions || '');
          setNeverDoList(data.neverDoList || '');
          if (data.businessHours) setBusinessHours(data.businessHours);
          if (data.outsideHoursBehavior) setOutsideHoursBehavior(data.outsideHoursBehavior);
          if (data.handoffRules) setHandoffRules(data.handoffRules);
          if (data.systemPromptOverride) {
            setIsCustomPrompt(true);
            setCustomPromptText(data.systemPromptOverride);
          }
        }
      })
      .catch((err) => setError('Error al cargar la configuración.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/assistant/behavior', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          avatarUrl,
          tone,
          welcomeMessage,
          customInstructions,
          neverDoList,
          businessHours,
          outsideHoursBehavior,
          handoffRules,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPromptModal = async () => {
    setIsPromptModalOpen(true);
    setLoadingPrompt(true);
    setIsEditingPrompt(false);
    try {
      const res = await fetch('/api/assistant/prompt');
      const data = await res.json();
      setFullPrompt(data.prompt || 'No se pudo generar el prompt.');
      setIsCustomPrompt(!!data.isCustom);
      setCustomPromptText(data.systemPromptOverride || data.prompt || '');
    } catch {
      setFullPrompt('Error al obtener el prompt completo.');
    } finally {
      setLoadingPrompt(false);
    }
  };

  const handleSaveCustomPrompt = async () => {
    setSavingPrompt(true);
    try {
      const res = await fetch('/api/assistant/behavior', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPromptOverride: customPromptText,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar prompt');
      setIsCustomPrompt(true);
      setFullPrompt(customPromptText);
      setPromptSaveSuccess(true);
      setTimeout(() => setPromptSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar prompt personalizado');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleResetDefaultPrompt = async () => {
    if (!confirm('¿Deseas restablecer el prompt a la plantilla automática basada en servicios, horarios y FAQs?')) {
      return;
    }
    setSavingPrompt(true);
    try {
      const res = await fetch('/api/assistant/behavior', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPromptOverride: null,
        }),
      });
      if (!res.ok) throw new Error('Error al restablecer prompt');
      setIsCustomPrompt(false);
      // Recargar prompt dinámico
      const pRes = await fetch('/api/assistant/prompt');
      const pData = await pRes.json();
      setFullPrompt(pData.prompt);
      setCustomPromptText(pData.prompt);
      setIsEditingPrompt(false);
      setPromptSaveSuccess(true);
      setTimeout(() => setPromptSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(err?.message || 'Error al restablecer prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(isEditingPrompt ? customPromptText : fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dayLabels: Record<string, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
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
        title="Comportamiento del Asistente"
        subtitle="Configura la personalidad, tono, horarios y reglas de derivación de DentalIA"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPromptModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-stone-500" />
              <span>Ver y editar prompt</span>
              {isCustomPrompt && (
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Prompt personalizado activo" />
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span>Guardando...</span>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 max-w-5xl">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Identidad y Tono */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Identidad y Tono del Asistente</h3>
              <p className="text-xs text-stone-500">Cómo se presenta y se comunica con los pacientes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">Nombre del Asistente</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="ej: DentalIA"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">URL del Avatar (Opcional)</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="https://ejemplo.es/avatar.png"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">Tono de Comunicación</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'cercano',
                  title: 'Cercano',
                  desc: 'Empático, cálido y amable. Trata al paciente con cordialidad y tuteo respetuoso.',
                },
                {
                  id: 'profesional',
                  title: 'Profesional',
                  desc: 'Formal, riguroso y educado. Máxima seriedad y claridad técnica.',
                },
                {
                  id: 'directo',
                  title: 'Directo',
                  desc: 'Conciso y ágil. Responde rápido a lo solicitado sin rodeos.',
                },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    tone === t.id
                      ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-stone-900">{t.title}</span>
                    <input
                      type="radio"
                      name="tone"
                      checked={tone === t.id}
                      onChange={() => setTone(t.id)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Mensaje de Bienvenida</label>
            <textarea
              rows={2}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="El primer mensaje que envía al iniciar la conversación..."
            />
          </div>
        </section>

        {/* 2. Instrucciones y Restricciones */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Directrices y Límites</h3>
              <p className="text-xs text-stone-500">Reglas libres de actuación y líneas rojas estrictas</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Instrucciones Específicas del Negocio (Texto Libre)
            </label>
            <textarea
              rows={3}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Explica cómo debe comportarse ante situaciones particulares de la clínica..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Lista de cosas que NUNCA debe hacer
            </label>
            <textarea
              rows={3}
              value={neverDoList}
              onChange={(e) => setNeverDoList(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-rose-950 font-mono text-xs"
              placeholder="Ej: No dar diagnósticos definitivos. No dar presupuestos cerrados sin revisión..."
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Estas directrices se inyectan en el prompt con máxima prioridad de cumplimiento.
            </p>
          </div>
        </section>

        {/* 3. Horarios y Política Fuera de Horario */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Horario de Atención del Negocio</h3>
              <p className="text-xs text-stone-500">Configuración por días y política de respuesta fuera de horario</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {Object.keys(dayLabels).map((dayKey) => {
              const d = businessHours[dayKey] || { open: '09:00', close: '20:00', enabled: false };
              return (
                <div
                  key={dayKey}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-stone-100 bg-stone-50/50"
                >
                  <div className="flex items-center gap-3 w-32">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) =>
                        setBusinessHours({
                          ...businessHours,
                          [dayKey]: { ...d, enabled: e.target.checked },
                        })
                      }
                      className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-stone-800">{dayLabels[dayKey]}</span>
                  </div>

                  {d.enabled ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-stone-500">De</span>
                      <input
                        type="time"
                        value={d.open}
                        onChange={(e) =>
                          setBusinessHours({
                            ...businessHours,
                            [dayKey]: { ...d, open: e.target.value },
                          })
                        }
                        className="px-2 py-1 rounded border border-stone-300 text-stone-800 bg-white"
                      />
                      <span className="text-stone-500">a</span>
                      <input
                        type="time"
                        value={d.close}
                        onChange={(e) =>
                          setBusinessHours({
                            ...businessHours,
                            [dayKey]: { ...d, close: e.target.value },
                          })
                        }
                        className="px-2 py-1 rounded border border-stone-300 text-stone-800 bg-white"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-stone-400 italic">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-stone-100">
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              ¿Qué contesta el asistente fuera del horario de apertura?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setOutsideHoursBehavior('APPOINTMENT_OR_MESSAGE')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  outsideHoursBehavior === 'APPOINTMENT_OR_MESSAGE'
                    ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">Seguir atendiendo y dar cita</span>
                  <input
                    type="radio"
                    name="outside"
                    checked={outsideHoursBehavior === 'APPOINTMENT_OR_MESSAGE'}
                    onChange={() => setOutsideHoursBehavior('APPOINTMENT_OR_MESSAGE')}
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Responde dudas del negocio y permite agendar citas en Google Calendar para los siguientes días laborables.
                </p>
              </div>

              <div
                onClick={() => setOutsideHoursBehavior('ONLY_MESSAGE')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  outsideHoursBehavior === 'ONLY_MESSAGE'
                    ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">Solo tomar recado</span>
                  <input
                    type="radio"
                    name="outside"
                    checked={outsideHoursBehavior === 'ONLY_MESSAGE'}
                    onChange={() => setOutsideHoursBehavior('ONLY_MESSAGE')}
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Avisa que la clínica está cerrada y pide el teléfono o recado para que el equipo llame a primera hora.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Criterios de Pase a Humano */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Cuándo pasar la conversación a una persona</h3>
              <p className="text-xs text-stone-500">
                El asistente activará la herramienta de derivación y avisará al equipo
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'onComplaint',
                label: 'El cliente expresa una queja o descontento',
              },
              {
                key: 'onUrgency',
                label: 'Urgencia médica, traumatismo o dolor severo',
              },
              {
                key: 'onHumanRequest',
                label: 'El cliente pide expresamente hablar con una persona',
              },
              {
                key: 'onUnknownAnswer',
                label: 'El asistente no sabe con seguridad la respuesta',
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!handoffRules[rule.key]}
                  onChange={(e) =>
                    setHandoffRules({
                      ...handoffRules,
                      [rule.key]: e.target.checked,
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span className="text-xs font-medium text-stone-800">{rule.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Regla Libre Adicional</label>
            <input
              type="text"
              value={handoffRules.customRule || ''}
              onChange={(e) =>
                setHandoffRules({
                  ...handoffRules,
                  customRule: e.target.value,
                })
              }
              className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ej: Si el paciente pide presupuestos de más de $3,000 o financiamiento bancario complejo..."
            />
          </div>
        </section>
      </div>

      {/* Modal «Ver y editar el prompt» */}
      <Modal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        title="Prompt de Sistema del Asistente"
        description="Esta es la instrucción exacta, en tiempo real, que recibe el modelo de OpenRouter en cada llamada."
        maxWidth="3xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2">
              {isCustomPrompt ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  ★ Prompt Personalizado Activo
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Plantilla Automática Dinámica
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                <span>{isEditingPrompt ? 'Ver vista previa' : 'Editar prompt'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isCustomPrompt && (
                <button
                  type="button"
                  onClick={handleResetDefaultPrompt}
                  disabled={savingPrompt}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200 cursor-pointer transition-colors disabled:opacity-50"
                  title="Eliminar personalización y volver a la plantilla automática"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>
              )}

              {isEditingPrompt && (
                <button
                  type="button"
                  onClick={handleSaveCustomPrompt}
                  disabled={savingPrompt}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {savingPrompt ? (
                    <span>Guardando...</span>
                  ) : promptSaveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-200" />
                      <span>¡Guardado!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar prompt</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {loadingPrompt ? (
            <div className="py-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : isEditingPrompt ? (
            <div className="space-y-2">
              <p className="text-[11px] text-stone-500">
                Puedes editar directamente las instrucciones del sistema. Incluye <code className="bg-stone-200 text-stone-800 px-1 py-0.5 rounded font-mono text-[10px]">&#123;fecha&#125;</code> para inyectar automáticamente la fecha y hora de San Salvador.
              </p>
              <textarea
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                className="w-full h-[55vh] p-4 bg-stone-900 text-stone-100 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 overflow-y-auto whitespace-pre-wrap"
                placeholder="Escribe aquí las instrucciones de sistema completas..."
              />
            </div>
          ) : (
            <pre className="p-4 bg-stone-900 text-stone-100 rounded-xl text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[60vh]">
              {fullPrompt}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
}

