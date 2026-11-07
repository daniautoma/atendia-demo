'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Modal } from '@/components/ui/Modal';
import {
  Settings,
  Cpu,
  Coins,
  Shield,
  Users,
  Building,
  Save,
  Check,
  AlertCircle,
  Plus,
  Key,
  Globe,
  Sparkles,
} from 'lucide-react';

export default function AjustesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos
  const [timezone, setTimezone] = useState('America/El_Salvador');
  const [agencyName, setAgencyName] = useState('daniautoma');
  const [agencyLogo, setAgencyLogo] = useState('');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [fallbackModel, setFallbackModel] = useState('openai/gpt-4o-mini');
  const [models, setModels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [maskedOpenRouterKey, setMaskedOpenRouterKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [testingOpenRouter, setTestingOpenRouter] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [keySource, setKeySource] = useState<'DATABASE' | 'ENV' | 'NONE'>('NONE');
  const [fetchingFreeModels, setFetchingFreeModels] = useState(false);
  const [freeModelsLoaded, setFreeModelsLoaded] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

  // Estimador de costes
  const [conversationsPerMonth, setConversationsPerMonth] = useState(600);
  const [messagesPerConversation, setMessagesPerConversation] = useState(6);

  // Modal nuevo usuario
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('AGENT');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.business) {
          setTimezone(data.business.timezone || 'America/El_Salvador');
          setAgencyName(data.business.agencyName || 'daniautoma');
          setAgencyLogo(data.business.agencyLogo || '');
        }
        if (data.assistant) {
          setSelectedModel(data.assistant.aiModel || 'openai/gpt-4o-mini');
          setFallbackModel(data.assistant.aiModelFallback || 'openai/gpt-4o-mini');
        }
        if (Array.isArray(data.models)) setModels(data.models);
        if (Array.isArray(data.users)) setUsers(data.users);
        setHasOpenRouterKey(!!data.hasOpenRouterKey);
        if (data.maskedOpenRouterKey) setMaskedOpenRouterKey(data.maskedOpenRouterKey);
        if (data.keySource) setKeySource(data.keySource);
      })
      .catch(() => setError('Error al cargar la configuración.'))
      .finally(() => setLoading(false));
  }, []);

  const handleTestAndSaveOpenRouter = async () => {
    setTestingOpenRouter(true);
    setTestResult(null);
    const keyToTest = openrouterApiKey.trim();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST_OPENROUTER',
          apiKey: keyToTest || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Si el usuario introdujo una clave nueva y es válida, guardarla directamente en la BD
        if (keyToTest) {
          await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              openrouterApiKey: keyToTest,
            }),
          });
          setMaskedOpenRouterKey(
            keyToTest.length > 12
              ? `${keyToTest.slice(0, 7)}••••••••${keyToTest.slice(-4)}`
              : '••••••••••••'
          );
          setOpenrouterApiKey('');
          setKeySource('DATABASE');
          setHasOpenRouterKey(true);
          setTestResult({
            success: true,
            message: '✓ Clave verificada con OpenRouter y GUARDADA en la base de datos de Atendia.',
          });
        } else {
          setTestResult({
            success: true,
            message: '✓ Conexión con OpenRouter verificada exitosamente.',
          });
        }
      } else {
        setTestResult({
          success: false,
          message: data.error || 'No se pudo conectar con OpenRouter.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Error de red al conectar con OpenRouter.',
      });
    } finally {
      setTestingOpenRouter(false);
    }
  };

  const handleFetchFreeModels = async () => {
    setFetchingFreeModels(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FETCH_OPENROUTER_MODELS' }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.models)) {
        const existingIds = new Set(models.map((m) => m.id));
        const newModels = data.models.filter((m: any) => !existingIds.has(m.id));
        setModels((prev) => [...prev, ...newModels]);
        setFreeModelsLoaded(true);
      } else {
        alert(data.error || 'No se pudieron consultar modelos gratuitos.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error de red al consultar modelos.');
    } finally {
      setFetchingFreeModels(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        business: {
          agencyName,
          agencyLogo,
          timezone,
        },
        assistant: {
          aiModel: selectedModel,
          aiModelFallback: fallbackModel,
        },
      };

      if (openrouterApiKey.trim().length > 0) {
        payload.openrouterApiKey = openrouterApiKey.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error al guardar ajustes');
      setSaveSuccess(true);
      if (openrouterApiKey.trim().length > 0) {
        setHasOpenRouterKey(true);
        setMaskedOpenRouterKey(
          openrouterApiKey.length > 12
            ? `${openrouterApiKey.slice(0, 7)}••••••••${openrouterApiKey.slice(-4)}`
            : '••••••••••••'
        );
        setOpenrouterApiKey('');
      }
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setError('No se pudieron guardar los ajustes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUser: {
            name: newUserName,
            email: newUserEmail,
            password: newUserPassword,
            role: newUserRole,
          },
        }),
      });
      if (!res.ok) throw new Error('Error al crear usuario');
      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      // Refrescar
      const refreshed = await fetch('/api/settings').then((r) => r.json());
      if (refreshed.users) setUsers(refreshed.users);
    } catch (err: any) {
      alert(err?.message || 'Error al crear usuario');
    }
  };

  // Cálculo de estimación interactiva de coste
  const activeModelObj = models.find((m) => m.id === selectedModel) || models[0];
  const totalMessagesMonth = conversationsPerMonth * messagesPerConversation;
  // Promedio estimado: 1.200 tokens de entrada por mensaje (prompt + contexto) y 250 tokens de salida
  const estimatedInputTokens = (totalMessagesMonth * 1200) / 1000000;
  const estimatedOutputTokens = (totalMessagesMonth * 250) / 1000000;
  const monthlyCostEstimate = activeModelObj
    ? estimatedInputTokens * activeModelObj.inputCostPer1M +
      estimatedOutputTokens * activeModelObj.outputCostPer1M
    : 0;

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
        title="Ajustes Generales"
        subtitle="Zona horaria, modelo de IA de OpenRouter, marca de agencia y usuarios"
        actions={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <span>Guardando...</span>
            ) : saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-200" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Guardar ajustes</span>
              </>
            )}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 max-w-5xl">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Selección del Modelo de IA y Estimador de Costes */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Modelo de Inteligencia Artificial</h3>
                <p className="text-xs text-stone-500">
                  Modelos de OpenRouter con soporte para llamada a herramientas (Function Calling)
                </p>
              </div>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                hasOpenRouterKey
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {hasOpenRouterKey ? 'OPENROUTER_API_KEY Configurada' : 'Falta OPENROUTER_API_KEY'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Modelo Principal de IA
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {!models.some((m) => m.id === selectedModel) && (
                  <option value={selectedModel}>
                    {selectedModel} (Personalizado)
                  </option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider}) {m.recommended ? '★ Recomendado' : ''}
                  </option>
                ))}
              </select>
              {activeModelObj && (
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  {activeModelObj.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Modelo de Respaldo (Fallback)
              </label>
              <select
                value={fallbackModel}
                onChange={(e) => setFallbackModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {!models.some((m) => m.id === fallbackModel) && (
                  <option value={fallbackModel}>
                    {fallbackModel} (Personalizado)
                  </option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-stone-400 mt-1.5">
                Si el modelo principal falla o no responde, se registrará en Actividad y se reintentará una vez con este modelo.
              </p>
            </div>
          </div>

          {/* Selector de modelos gratuitos y personalizados */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Modelos Gratuitos y Personalizados de OpenRouter
              </span>
              <button
                type="button"
                onClick={handleFetchFreeModels}
                disabled={fetchingFreeModels}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  {fetchingFreeModels
                    ? 'Consultando OpenRouter...'
                    : freeModelsLoaded
                    ? '✓ Modelos gratuitos agregados a la lista'
                    : 'Buscar modelos gratuitos (:free) en OpenRouter'}
                </span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                O escribir ID exacto de cualquier modelo de OpenRouter (ej: google/gemma-4-26b-a4b-it:free)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="ej: google/gemma-4-26b-a4b-it:free"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = customModelInput.trim();
                    if (clean) {
                      setSelectedModel(clean);
                      if (!models.some((m) => m.id === clean)) {
                        setModels((prev) => [
                          ...prev,
                          {
                            id: clean,
                            name: `${clean} (Personalizado)`,
                            provider: clean.split('/')[0] || 'OpenRouter',
                            inputCostPer1M: 0,
                            outputCostPer1M: 0,
                            contextLength: 32768,
                            recommended: false,
                            description: 'Modelo definido manualmente.',
                          },
                        ]);
                      }
                      setCustomModelInput('');
                    }
                  }}
                  disabled={!customModelInput.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer shrink-0"
                >
                  Asignar como Principal
                </button>
              </div>
            </div>
          </div>

          {/* Configuración de API Key de OpenRouter */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-teal-600" />
                <label className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Clave de API de OpenRouter (OPENROUTER_API_KEY)
                </label>
              </div>
              <div className="flex items-center gap-2">
                {keySource === 'DATABASE' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ✓ Activa en: Atendia (Prioridad 1)
                  </span>
                )}
                {keySource === 'ENV' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    ⚠ Activa desde: .env
                  </span>
                )}
                {maskedOpenRouterKey && (
                  <span className="text-[11px] font-mono text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded">
                    {maskedOpenRouterKey}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={openrouterApiKey}
                onChange={(e) => setOpenrouterApiKey(e.target.value)}
                placeholder={hasOpenRouterKey ? 'Pega tu nueva clave para actualizarla en Atendia (sk-or-v1-...)' : 'Pega aquí tu clave sk-or-v1-...'}
                className="flex-1 px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTestAndSaveOpenRouter}
                disabled={testingOpenRouter || (!openrouterApiKey.trim() && !hasOpenRouterKey)}
                className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
              >
                {testingOpenRouter ? (
                  <span>Verificando y guardando...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                    <span>{openrouterApiKey.trim() ? 'Probar y Guardar en Atendia' : 'Probar Clave Actual'}</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <p className="text-[11px] text-stone-500 leading-relaxed">
              <strong>Decisión de prioridad:</strong> La clave guardada en este formulario de Atendia tiene <strong>prioridad absoluta</strong> sobre cualquier variable de entorno o archivo <code className="text-stone-700 font-mono">.env</code>. Al pulsar en &quot;Probar y Guardar en Atendia&quot;, se valida en vivo contra OpenRouter y se almacena cifrada en la base de datos de PostgreSQL con efecto inmediato para todo el sistema.
            </p>
          </div>

          {/* Estimación interactiva de costes */}
          <div className="mt-4 p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-teal-600" />
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Estimación Interactiva de Costes OpenRouter
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                  Conversaciones al mes: <b>{conversationsPerMonth}</b>
                </label>
                <input
                  type="range"
                  min="50"
                  max="3000"
                  step="50"
                  value={conversationsPerMonth}
                  onChange={(e) => setConversationsPerMonth(parseInt(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                  Mensajes por conversación: <b>{messagesPerConversation}</b>
                </label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={messagesPerConversation}
                  onChange={(e) => setMessagesPerConversation(parseInt(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div className="flex flex-col justify-center items-start sm:items-end">
                <span className="text-[11px] text-stone-500">Coste estimado de IA al mes:</span>
                <span className="text-lg font-bold text-teal-700">
                  {monthlyCostEstimate < 0.01 ? '< $0.01' : `~$${monthlyCostEstimate.toFixed(2)} USD/mes`}
                </span>
                <span className="text-[10px] text-stone-400">
                  {totalMessagesMonth.toLocaleString()} mensajes / mes
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Zona Horaria y Marca de Agencia */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Configuración Regional y Marca</h3>
              <p className="text-xs text-stone-500">Datos para la zona horaria y marca blanca de la agencia</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Zona Horaria Oficial</label>
              <input
                type="text"
                disabled
                value={timezone}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 bg-stone-50"
              />
              <p className="text-[11px] text-stone-400 mt-1">
                Fijada en <b>America/El_Salvador</b> (UTC-6) para citas, recordatorios y resúmenes diarios.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre de la Agencia</label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="ej: daniautoma"
              />
            </div>
          </div>
        </section>

        {/* 3. Gestión de Usuarios y Equipo */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Usuarios y Equipo</h3>
                <p className="text-xs text-stone-500">Miembros con acceso al panel de control</p>
              </div>
            </div>

            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir miembro</span>
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {users.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-900">{u.name}</p>
                  <p className="text-xs text-stone-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      u.role === 'ADMIN'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {u.role === 'ADMIN' ? 'Administrador' : 'Agente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title="Añadir Miembro del Equipo"
        description="Crea una cuenta para que un compañero pueda acceder al panel y atender conversaciones"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              placeholder="ej: Laura Martínez"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              placeholder="laura@negocio.es"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Rol de Acceso</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm bg-white"
            >
              <option value="AGENT">Agente (Atención y bandeja)</option>
              <option value="ADMIN">Administrador (Control total)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700"
            >
              Crear Usuario
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

