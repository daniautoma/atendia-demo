'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Sparkles, AlertCircle, X, ShieldCheck, Lock } from 'lucide-react';

export interface OpenRouterModelItem {
  id: string;
  name: string;
  provider: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextLength: number;
  recommended?: boolean;
  isFree?: boolean;
  description?: string;
}

interface ModelComboboxProps {
  label: string;
  value: string;
  onChange: (modelId: string) => void;
  models: OpenRouterModelItem[];
  disabled?: boolean;
  helperText?: string;
  disabledNotice?: string;
}

export function ModelCombobox({
  label,
  value,
  onChange,
  models = [],
  disabled = false,
  helperText,
  disabledNotice,
}: ModelComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'RECOMMENDED' | 'FREE'>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modelo seleccionado actualmente
  const selectedModelObj = useMemo(() => {
    return models.find((m) => m.id === value);
  }, [models, value]);

  // Modelos filtrados por pestaña y búsqueda
  const filteredModels = useMemo(() => {
    const q = search.toLowerCase().trim();
    return models.filter((m) => {
      // 1. Filtro por tipo
      if (filterType === 'FREE' && !m.isFree && !m.id.includes(':free')) return false;
      if (filterType === 'RECOMMENDED' && !m.recommended) return false;

      // 2. Filtro por búsqueda
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
      );
    });
  }, [models, search, filterType]);

  const freeCount = useMemo(() => {
    return models.filter((m) => m.isFree || m.id.includes(':free')).length;
  }, [models]);

  const recommendedCount = useMemo(() => {
    return models.filter((m) => m.recommended).length;
  }, [models]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomSelect = () => {
    const clean = search.trim();
    if (clean) {
      handleSelect(clean);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {selectedModelObj?.isFree && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Gratuito (:free)
          </span>
        )}
      </label>

      {/* Botón trigger del selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
          disabled
            ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed opacity-75'
            : isOpen
            ? 'bg-white border-teal-500 ring-2 ring-teal-500/20 text-stone-900 shadow-xs'
            : 'bg-white border-stone-300 hover:border-stone-400 text-stone-900 shadow-2xs'
        }`}
      >
        <div className="min-w-0 flex-1 pr-2">
          {disabled ? (
            <div className="flex items-center gap-2 text-stone-400 text-xs">
              <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>Requiere OPENROUTER_API_KEY</span>
            </div>
          ) : selectedModelObj ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-stone-900 truncate">
                {selectedModelObj.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                {selectedModelObj.provider}
              </span>
              {selectedModelObj.recommended && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0 hidden sm:inline">
                  ★ Recomendado
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-stone-800 truncate">{value || 'Seleccionar modelo...'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                Personalizado
              </span>
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Aviso de desactivado si no hay clave */}
      {disabled && disabledNotice && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-md px-2.5 py-1.5 mt-1.5 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{disabledNotice}</span>
        </p>
      )}

      {/* Desplegable interactivo con buscador */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl shadow-2xl border border-stone-200 p-2 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150 max-h-96 flex flex-col">
          {/* Barra de búsqueda */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, ID o proveedor (ej: gemini, claude, :free)..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-stone-200 text-xs text-stone-900 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all placeholder:text-stone-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chips de filtro rápido */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                filterType === 'ALL'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Todos ({models.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('RECOMMENDED')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer flex items-center gap-1 transition-all ${
                filterType === 'RECOMMENDED'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>★ Recomendados</span>
              <span className="opacity-80">({recommendedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('FREE')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer flex items-center gap-1 transition-all ${
                filterType === 'FREE'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gratis (:free)</span>
              <span className="opacity-80">({freeCount})</span>
            </button>
          </div>

          {/* Lista de modelos */}
          <div className="overflow-y-auto flex-1 space-y-1 pr-1 divide-y divide-stone-100">
            {filteredModels.length > 0 ? (
              filteredModels.map((m) => {
                const isSelected = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 border border-teal-200 text-teal-950 font-medium'
                        : 'hover:bg-stone-50 text-stone-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-stone-900">{m.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200 font-mono">
                          {m.provider}
                        </span>
                        {m.isFree ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            GRATIS
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-stone-500">
                            ${m.inputCostPer1M} / 1M in
                          </span>
                        )}
                        {m.contextLength && (
                          <span className="text-[10px] text-stone-400 font-mono">
                            {Math.round(m.contextLength / 1000)}k ctx
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-stone-400 truncate mt-0.5">{m.id}</p>
                      {m.description && (
                        <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{m.description}</p>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0 mt-1" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center space-y-2">
                <p className="text-stone-500 text-xs">No hay modelos que coincidan con &quot;{search}&quot;</p>
                {search.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleCustomSelect}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <span>Usar ID personalizado:</span>
                    <code className="font-mono text-[11px] text-teal-300">{search.trim()}</code>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Texto de ayuda inferior */}
      {helperText && !disabled && (
        <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">{helperText}</p>
      )}
    </div>
  );
}

