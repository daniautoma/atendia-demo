import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { LogStatus } from '@prisma/client';
import { decrypt } from '@/lib/crypto';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ChatCompletionOptions {
  model: string;
  fallbackModel?: string;
  messages: OpenRouterMessage[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  message: OpenRouterMessage;
  modelUsed: string;
  wasFallback: boolean;
  rawUsage?: any;
}

const DEPRECATED_MODELS: Record<string, string> = {
  'anthropic/claude-haiku-5.5': 'openai/gpt-4o-mini',
  'anthropic/claude-3-5-haiku-20241022': 'anthropic/claude-3.5-haiku',
  'anthropic/claude-3-5-sonnet-20241022': 'anthropic/claude-3.5-sonnet',
  'google/gemini-flash-1.5-8b': 'google/gemini-2.0-flash-001',
  'google/gemini-flash-1.5': 'google/gemini-2.0-flash-001',
  'google/gemini-flash-1.5-8b:free': 'google/gemini-2.0-flash-001',
};

/**
 * Obtiene la API Key de OpenRouter.
 * DECISIÓN DE ARQUITECTURA:
 * 1. PRIORIDAD ABSOLUTA: Base de datos (tabla Integration). La clave guardada en la interfaz de Atendia
 *    es la fuente de verdad definitiva y anula cualquier variable en archivos .env o contenedores.
 * 2. RESPALDO: Variable de entorno process.env.OPENROUTER_API_KEY únicamente si en la base de datos
 *    no se ha configurado ninguna clave todavía.
 */
export async function getOpenRouterApiKey(): Promise<string | null> {
  // 1. Prioridad Máxima: Clave guardada en Atendia (Base de datos)
  try {
    const integration = await prisma.integration.findUnique({
      where: { provider: 'openrouter' },
    });

    if (integration?.credentialsEnc) {
      try {
        const decrypted = decrypt(integration.credentialsEnc);
        if (decrypted) {
          let key = decrypted;
          try {
            const parsed = JSON.parse(decrypted);
            key = parsed.apiKey || decrypted;
          } catch {}
          if (key && typeof key === 'string' && key.trim().length > 0) {
            return key.trim();
          }
        }
      } catch (decErr) {
        // Si se guardó en texto plano por contingencia
        if (integration.credentialsEnc.startsWith('sk-or-')) {
          return integration.credentialsEnc.trim();
        }
      }
    }
  } catch (dbErr) {
    console.warn('[OpenRouter] No se pudo leer la API Key de la base de datos:', dbErr);
  }

  // 2. Respaldo: Archivo .env / entorno del contenedor (solo si la BD está vacía)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return null;
}

export async function callOpenRouter(options: ChatCompletionOptions): Promise<CompletionResult> {
  const apiKey = await getOpenRouterApiKey();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // Remapeo de seguridad para modelos obsoletos o descatalogados en OpenRouter
  const primaryModel = DEPRECATED_MODELS[options.model] || options.model || 'openai/gpt-4o-mini';
  let defaultFallback = DEPRECATED_MODELS[options.fallbackModel || ''] || options.fallbackModel || 'openai/gpt-4o-mini';

  if (defaultFallback === primaryModel) {
    defaultFallback = primaryModel === 'openai/gpt-4o-mini' ? 'google/gemini-2.0-flash-001' : 'openai/gpt-4o-mini';
  }

  // Si no hay API key configurada ni en .env ni en la base de datos, devolver respuesta honesta de contingencia
  if (!apiKey || apiKey.trim() === '') {
    console.warn('[OpenRouter] ⚠️ OPENROUTER_API_KEY no detectada ni en entorno ni en DB.');
    await prisma.activityLog.create({
      data: {
        action: 'ai.missing_api_key',
        status: LogStatus.WARNING,
        details: {
          message: 'Falta configurar OPENROUTER_API_KEY en el panel de Ajustes o en el archivo .env',
        },
      },
    }).catch(() => {});

    return {
      modelUsed: 'sistema/sin_api_key',
      wasFallback: true,
      message: {
        role: 'assistant',
        content: '¡Hola! Gracias por comunicarte con Clínica Dental San Salvador. En este momento nuestro sistema de atención automática está en configuración técnica. Un miembro de nuestro equipo te atenderá personalmente por este medio a la brevedad. Para urgencias directas puedes llamarnos al +503 2200 1234.',
      },
    };
  }

  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': appUrl,
    'X-Title': 'Atendia Dental',
  };

  // 1. Intento con modelo principal
  try {
    const payload: any = {
      model: primaryModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
    };
    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      payload.tool_choice = 'auto';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (response.ok) {
      const data = await response.json();
      const choice = data.choices?.[0];
      if (choice?.message) {
        return {
          message: choice.message,
          modelUsed: primaryModel,
          wasFallback: false,
          rawUsage: data.usage,
        };
      }
    }

    const errorBody = await response.text();
    console.warn(`[OpenRouter] Fallo en modelo ${primaryModel} (HTTP ${response.status}):`, errorBody);

    // Registrar advertencia en Actividad
    await prisma.activityLog.create({
      data: {
        action: 'ai.model_fallback',
        status: LogStatus.WARNING,
        details: {
          originalModel: primaryModel,
          fallbackModel: defaultFallback,
          httpStatus: response.status,
          error: errorBody.slice(0, 300),
        },
      },
    }).catch(() => {});
  } catch (err: any) {
    console.warn(`[OpenRouter] Excepción en modelo ${primaryModel}:`, err?.message);
    await prisma.activityLog.create({
      data: {
        action: 'ai.model_error',
        status: LogStatus.WARNING,
        details: {
          originalModel: primaryModel,
          fallbackModel: defaultFallback,
          error: err?.message,
        },
      },
    }).catch(() => {});
  }

  // 2. Reintento con modelo de respaldo (defaultFallback)
  console.log(`[OpenRouter] Reintentando con modelo de respaldo: ${defaultFallback}`);
  try {
    const fallbackPayload: any = {
      model: defaultFallback,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
    };
    if (options.tools && options.tools.length > 0) {
      fallbackPayload.tools = options.tools;
      fallbackPayload.tool_choice = 'auto';
    }

    const fallbackResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(fallbackPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (fallbackResponse.ok) {
      const fbData = await fallbackResponse.json();
      const choice = fbData.choices?.[0];
      if (choice?.message) {
        return {
          message: choice.message,
          modelUsed: defaultFallback,
          wasFallback: true,
          rawUsage: fbData.usage,
        };
      }
    } else {
      const fbErrBody = await fallbackResponse.text();
      console.error(`[OpenRouter] Fallback ${defaultFallback} falló (HTTP ${fallbackResponse.status}):`, fbErrBody);
    }
  } catch (fbErr: any) {
    console.error(`[OpenRouter] Fallback también falló con excepción:`, fbErr?.message);
  }

  // Si ambos fallaron o hubo problema de cuota/conexión en OpenRouter
  return {
    modelUsed: 'sistema/fallback_error',
    wasFallback: true,
    message: {
      role: 'assistant',
      content: '¡Hola! Gracias por comunicarte con Atendia Demo Studio. En este momento estoy experimentando una breve intermitencia técnica y he transferido tu consulta a nuestro equipo de daniautoma. Un asesor te responderá a la brevedad.',
    },
  };
}
