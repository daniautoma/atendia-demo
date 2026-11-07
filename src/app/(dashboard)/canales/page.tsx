'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Share2,
  QrCode,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Power,
  RefreshCw,
  Phone,
  Building,
  Save,
  Check,
  Radio,
  Sliders,
  Send,
  Lock,
} from 'lucide-react';

export default function CanalesPage() {
  const [loading, setLoading] = useState(true);
  const [savingWa, setSavingWa] = useState(false);
  const [savingWeb, setSavingWeb] = useState(false);
  const [successWa, setSuccessWa] = useState(false);
  const [successWeb, setSuccessWeb] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de WhatsApp
  const [provider, setProvider] = useState<'BAILEYS' | 'YCLOUD'>('BAILEYS');
  const [waStatus, setWaStatus] = useState<string>('DISCONNECTED');
  const [waPhone, setWaPhone] = useState<string>('');
  const [waBusinessName, setWaBusinessName] = useState<string>('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  // YCloud fields
  const [ycloudApiKey, setYcloudApiKey] = useState('');
  const [ycloudWebhookSecret, setYcloudWebhookSecret] = useState('');
  const [ycloudWabaId, setYcloudWabaId] = useState('');
  const [ycloudPhoneNumberId, setYcloudPhoneNumberId] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);

  // Estados del Chat Web
  const [webEnabled, setWebEnabled] = useState(true);
  const [webColor, setWebColor] = useState('#2563eb');
  const [webTitle, setWebTitle] = useState('Valentina | Asistente Virtual Demo');
  const [webWelcome, setWebWelcome] = useState('¡Hola! Soy Valentina de daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?');
  const [appUrl, setAppUrl] = useState('http://localhost:3000');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  const fetchChannelData = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.whatsapp) {
        setProvider(data.whatsapp.provider || 'BAILEYS');
        setWaStatus(data.whatsapp.status || 'DISCONNECTED');
        setWaPhone(data.whatsapp.phoneNumber || '');
        setWaBusinessName(data.whatsapp.businessName || '');
        if (data.whatsapp.qrCode) {
          setQrCodeData(data.whatsapp.qrCode);
        } else if (data.whatsapp.status === 'CONNECTED') {
          setQrCodeData(null);
        }
        setYcloudWabaId(data.whatsapp.wabaId || '');
        setYcloudPhoneNumberId(data.whatsapp.phoneNumberId || '');
        setMaskedApiKey(data.whatsapp.maskedApiKey);
      }
      if (data.web) {
        setWebEnabled(data.web.enabled ?? true);
        setWebColor(data.web.color || '#2563eb');
        setWebTitle(data.web.title || 'Valentina | Asistente Virtual Demo');
        setWebWelcome(data.web.welcome || '');
      }
      if (data.appUrl) setAppUrl(data.appUrl);
    } catch {
      setError('Error al consultar estado de canales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannelData();
    // Polling ligero para refresco de QR y estados de conexión
    const interval = setInterval(fetchChannelData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveWhatsApp = async (action?: 'CONNECT' | 'DISCONNECT' | 'RESET') => {
    setSavingWa(true);
    setError(null);
    try {
      const res = await fetch('/api/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: {
            provider,
            apiKey: ycloudApiKey || undefined,
            webhookSecret: ycloudWebhookSecret || undefined,
            wabaId: ycloudWabaId,
            phoneNumberId: ycloudPhoneNumberId,
            action,
          },
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar WhatsApp');
      const updated = await res.json();
      if (updated.whatsapp) {
        setWaStatus(updated.whatsapp.status || 'DISCONNECTED');
        if (updated.whatsapp.qrCode) {
          setQrCodeData(updated.whatsapp.qrCode);
        } else if (action === 'RESET' || action === 'DISCONNECT') {
          setQrCodeData(null);
          if (action === 'DISCONNECT') setWaPhone('');
        }
        if (updated.whatsapp.phoneNumber) setWaPhone(updated.whatsapp.phoneNumber);
      }
      setSuccessWa(true);
      setTimeout(() => setSuccessWa(false), 2500);
      fetchChannelData();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSavingWa(false);
    }
  };

  const handleSaveWeb = async () => {
    setSavingWeb(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          web: {
            enabled: webEnabled,
            color: webColor,
            title: webTitle,
            welcome: webWelcome,
          },
        }),
      });
      if (res.ok) {
        setSuccessWeb(true);
        setTimeout(() => setSuccessWeb(false), 2500);
      }
    } catch {
      alert('Error al guardar configuración web');
    } finally {
      setSavingWeb(false);
    }
  };

  const webhookPublicUrl = `${appUrl}/api/webhooks/ycloud`;
  const embedScriptCode = `<script src="${appUrl}/widget.js" data-atendia-color="${webColor}" async></script>`;

  const copyScript = () => {
    navigator.clipboard.writeText(embedScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookPublicUrl);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
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
        title="Canales de Atención"
        subtitle="Configura WhatsApp (Baileys QR o API Oficial YCloud) y el Chat Web embeddable"
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 max-w-5xl">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. SECCIÓN: WhatsApp con Arquitectura Modular */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                WA
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Canal WhatsApp</h3>
                <p className="text-xs text-stone-500">
                  Arquitectura modular: Elige entre conexión por código QR (Baileys) o API Oficial de Meta (YCloud)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                  waStatus === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : waStatus === 'WAITING_QR'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                    : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}
              >
                {waStatus === 'CONNECTED'
                  ? 'Conectado'
                  : waStatus === 'WAITING_QR'
                  ? 'Esperando escaneo QR'
                  : 'Desconectado'}
              </span>
            </div>
          </div>

          {/* Selector de Proveedor */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Proveedor de WhatsApp
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setProvider('BAILEYS')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  provider === 'BAILEYS'
                    ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-900">Baileys (Conexión por Código QR)</span>
                  <input
                    type="radio"
                    name="waProvider"
                    checked={provider === 'BAILEYS'}
                    onChange={() => setProvider('BAILEYS')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Conexión directa escaneando el código QR desde la app de WhatsApp del móvil de la clínica. Sesión persistida en disco.
                </p>
              </div>

              <div
                onClick={() => setProvider('YCLOUD')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  provider === 'YCLOUD'
                    ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-900">YCloud (API Oficial WhatsApp Business)</span>
                  <input
                    type="radio"
                    name="waProvider"
                    checked={provider === 'YCLOUD'}
                    onChange={() => setProvider('YCLOUD')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Integración empresarial vía REST API oficial de Meta. Alta estabilidad, soporte de plantillas aprobadas y webhooks verificados.
                </p>
              </div>
            </div>
          </div>

          {/* CASO 1: Baileys QR */}
          {provider === 'BAILEYS' && (
            <div className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Conexión con Baileys
              </h4>

              {waStatus === 'CONNECTED' ? (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        Dispositivo Vinculado: {waPhone || '+503 Teléfono Conectado'}
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        La sesión está activa y atendiendo mensajes automáticamente.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveWhatsApp('DISCONNECT')}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer"
                  >
                    Desconectar dispositivo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-white rounded-xl border border-stone-200">
                  <div className="w-52 h-52 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center p-2 shrink-0">
                    {qrCodeData ? (
                      <img src={qrCodeData} alt="Código QR WhatsApp" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center p-4 text-xs text-stone-400">
                        <QrCode className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                        <p>Pulsa "Generar Código QR" para iniciar la vinculación</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-stone-900">Instrucciones para vincular:</h5>
                    <ol className="text-xs text-stone-600 space-y-1.5 list-decimal pl-4">
                      <li>Abre WhatsApp en el teléfono del negocio.</li>
                      <li>Toca <b>Dispositivos vinculados</b> y luego <b>Vincular un dispositivo</b>.</li>
                      <li>Apunta la cámara del móvil a este código QR para escanearlo.</li>
                    </ol>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSaveWhatsApp('CONNECT')}
                        disabled={savingWa}
                        className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {savingWa ? 'Generando QR...' : 'Generar / Refrescar Código QR'}
                      </button>
                      <button
                        onClick={() => handleSaveWhatsApp('RESET')}
                        disabled={savingWa}
                        className="px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer border border-stone-200"
                        title="Elimina cualquier intento previo y fuerza un QR nuevo desde cero"
                      >
                        Reiniciar desde cero
                      </button>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ¿WhatsApp dice que ya tienes muchos dispositivos vinculados?
                      </p>
                      <p>
                        WhatsApp limita a 4 los dispositivos simultáneos. En tu móvil, ve a <b>Ajustes &gt; Dispositivos vinculados</b>, toca los dispositivos viejos o inactivos y pulsa <b>Cerrar sesión</b> antes de escanear.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CASO 2: YCloud API Oficial */}
          {provider === 'YCLOUD' && (
            <div className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Configuración YCloud (WhatsApp Business Cloud REST)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    API Key de YCloud
                  </label>
                  <input
                    type="password"
                    value={ycloudApiKey}
                    onChange={(e) => setYcloudApiKey(e.target.value)}
                    placeholder="ycloud_api_key_..."
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono bg-white"
                  />
                  {maskedApiKey && (
                    <p className="text-[11px] text-stone-400 mt-1 font-mono">
                      Clave guardada: {maskedApiKey} (Cifrada con AES-256-GCM)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Secreto de Firma Webhook (Signing Secret)
                  </label>
                  <input
                    type="password"
                    value={ycloudWebhookSecret}
                    onChange={(e) => setYcloudWebhookSecret(e.target.value)}
                    placeholder="whsec_..."
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono bg-white"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">
                    Utilizado para validar criptográficamente la cabecera <code>YCloud-Signature</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    ID de Cuenta de WhatsApp Business (WABA ID)
                  </label>
                  <input
                    type="text"
                    value={ycloudWabaId}
                    onChange={(e) => setYcloudWabaId(e.target.value)}
                    placeholder="ej: waba_123456789"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    ID del Número de Teléfono (Phone Number ID)
                  </label>
                  <input
                    type="text"
                    value={ycloudPhoneNumberId}
                    onChange={(e) => setYcloudPhoneNumberId(e.target.value)}
                    placeholder="ej: phone_num_987654321"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono bg-white"
                  />
                </div>
              </div>

              {/* Endpoint Webhook a configurar en YCloud Console */}
              <div className="p-3 bg-white rounded-lg border border-stone-200 text-xs space-y-1.5">
                <p className="font-semibold text-stone-800">URL del Webhook para YCloud Console:</p>
                <div className="flex items-center gap-2">
                  <code className="p-1.5 bg-stone-100 rounded border border-stone-200 text-stone-900 font-mono text-[11px] flex-1 select-all">
                    {webhookPublicUrl}
                  </code>
                  <button
                    onClick={copyWebhookUrl}
                    className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 rounded text-stone-800 text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    {copiedWebhookUrl ? '¡Copiado!' : 'Copiar URL'}
                  </button>
                </div>
                <p className="text-[10px] text-stone-400">
                  Suscríbete en YCloud a los eventos: <code>whatsapp.inbound_message.received</code> y <code>whatsapp.message.updated</code>.
                </p>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={() => handleSaveWhatsApp('DISCONNECT')}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Desconectar YCloud
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveWhatsApp('CONNECT')}
                    disabled={savingWa}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {savingWa ? 'Comprobando...' : 'Comprobar Conexión y Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 2. SECCIÓN: Chat para tu Web */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Chat para tu Web</h3>
                <p className="text-xs text-stone-500">
                  Widget flotante de atención automática personalizable para la web de tu cliente
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="/demo"
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-colors"
              >
                <span>Ver página /demo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={webEnabled}
                  onChange={(e) => setWebEnabled(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-stone-800">
                  {webEnabled ? 'Widget Activo' : 'Desactivado'}
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Opciones de personalización */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Color Corporativo del Widget
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={webColor}
                    onChange={(e) => setWebColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-stone-300 p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={webColor}
                    onChange={(e) => setWebColor(e.target.value)}
                    className="w-28 px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Título de la Cabecera
                </label>
                <input
                  type="text"
                  value={webTitle}
                  onChange={(e) => setWebTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Mensaje de Bienvenida del Chat
                </label>
                <textarea
                  rows={2}
                  value={webWelcome}
                  onChange={(e) => setWebWelcome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                />
              </div>

              {/* Fragmento de código script para incrustar */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fragmento de Código para la Web del Cliente
                </label>
                <div className="relative">
                  <pre className="p-3 bg-stone-900 text-stone-200 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                    {embedScriptCode}
                  </pre>
                  <button
                    onClick={copyScript}
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedScript ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Pega este código antes del cierre de la etiqueta <code>&lt;/body&gt;</code> en la web del negocio local.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveWeb}
                  disabled={savingWeb}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingWeb ? <span>Guardando...</span> : successWeb ? <span>¡Guardado!</span> : <span>Guardar Ajustes Web</span>}
                </button>
              </div>
            </div>

            {/* Vista previa en tiempo real del Widget */}
            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/60 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 block">
                Vista Previa del Widget
              </span>

              <div className="w-full max-w-[320px] mx-auto bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden text-xs">
                <div style={{ backgroundColor: webColor }} className="p-3 text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    L
                  </div>
                  <div>
                    <p className="font-bold text-xs">{webTitle}</p>
                    <p className="text-[10px] text-white/80">En línea • Asistente IA</p>
                  </div>
                </div>

                <div className="p-3 space-y-2 bg-stone-50/50 min-h-[140px] flex flex-col justify-end">
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200 text-stone-800 text-[11px] max-w-[85%] rounded-tl-xs">
                    {webWelcome}
                  </div>
                </div>

                <div className="p-2 border-t border-stone-100 flex gap-1">
                  <input
                    type="text"
                    disabled
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-2.5 py-1 text-[11px] border border-stone-200 rounded-lg bg-stone-50"
                  />
                  <div style={{ backgroundColor: webColor }} className="p-1.5 rounded-lg text-white flex items-center justify-center">
                    <Send className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <p className="text-center text-[11px] text-stone-400 mt-4">
                Puedes probarlo en acción navegando a la página <b>/demo</b>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
