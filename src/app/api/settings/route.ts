import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getOpenRouterApiKey } from '@/lib/ai/openrouter';
import { encrypt } from '@/lib/crypto';

// Modelos recomendados con soporte de tools en OpenRouter con precios aproximados por 1M tokens
export const POPULAR_TOOL_MODELS = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    contextLength: 128000,
    recommended: true,
    isFree: false,
    description: 'Muy económico, confiable y rápido con soporte nativo estricto de llamadas a herramientas.',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    contextLength: 1048576,
    recommended: false,
    isFree: false,
    description: 'Nueva generación ultrarrápida de Google con soporte nativo de herramientas y 1M de contexto.',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    contextLength: 200000,
    recommended: false,
    isFree: false,
    description: 'Ultra rápido, inteligente y económico para razonamiento contextual en tiempo real.',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    contextLength: 200000,
    recommended: false,
    isFree: false,
    description: 'Máxima capacidad de razonamiento para casos clínicos y agendas complejas.',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    contextLength: 128000,
    recommended: false,
    isFree: false,
    description: 'Modelo insignia multimodelo con excelente soporte de herramientas.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    inputCostPer1M: 0.35,
    outputCostPer1M: 0.4,
    contextLength: 131072,
    recommended: false,
    isFree: false,
    description: 'Código abierto potente con llamada a herramientas estructuradas.',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (Gratuito)',
    provider: 'Google',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    contextLength: 1048576,
    recommended: false,
    isFree: true,
    description: 'Modelo experimental gratuito de Google en OpenRouter. Ideal para pruebas sin costo.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct (Gratuito)',
    provider: 'Meta',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    contextLength: 131072,
    recommended: false,
    isFree: true,
    description: 'Modelo de Meta de alta capacidad gratuito en OpenRouter. Para pruebas sin coste.',
  },
];

export async function GET() {
  try {
    await requireAuth();

    const [business, assistant, users, openRouterKey, dbIntegration] = await Promise.all([
      prisma.businessProfile.findFirst(),
      prisma.assistantConfig.findFirst(),
      prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      getOpenRouterApiKey(),
      prisma.integration.findUnique({ where: { provider: 'openrouter' } }),
    ]);

    const maskedKey = openRouterKey
      ? openRouterKey.length > 12
        ? `${openRouterKey.slice(0, 7)}••••••••${openRouterKey.slice(-4)}`
        : '••••••••••••'
      : '';

    const keySource = dbIntegration?.credentialsEnc ? 'DATABASE' : process.env.OPENROUTER_API_KEY ? 'ENV' : 'NONE';

    return NextResponse.json({
      business,
      assistant: {
        aiModel: assistant?.aiModel || 'openai/gpt-4o-mini',
        aiModelFallback: assistant?.aiModelFallback || 'openai/gpt-4o-mini',
      },
      models: POPULAR_TOOL_MODELS,
      users,
      hasOpenRouterKey: !!openRouterKey,
      maskedOpenRouterKey: maskedKey,
      keySource,
    });
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    // Actualizar datos del negocio / agencia
    if (body.business) {
      const currentBusiness = await prisma.businessProfile.findFirst();
      if (currentBusiness) {
        await prisma.businessProfile.update({
          where: { id: currentBusiness.id },
          data: {
            agencyName: body.business.agencyName ?? currentBusiness.agencyName,
            agencyLogo: body.business.agencyLogo !== undefined ? body.business.agencyLogo : currentBusiness.agencyLogo,
            timezone: body.business.timezone ?? currentBusiness.timezone,
          },
        });
      }
    }

    // Actualizar modelo de IA
    if (body.assistant) {
      const currentAssistant = await prisma.assistantConfig.findFirst();
      if (currentAssistant) {
        await prisma.assistantConfig.update({
          where: { id: currentAssistant.id },
          data: {
            aiModel: body.assistant.aiModel ?? currentAssistant.aiModel,
            aiModelFallback: body.assistant.aiModelFallback ?? currentAssistant.aiModelFallback,
          },
        });
      }
    }

    // Guardar API Key de OpenRouter en Integration
    if (body.openrouterApiKey !== undefined) {
      const rawKey = (body.openrouterApiKey || '').trim();
      if (rawKey.length > 0) {
        const encrypted = encrypt(JSON.stringify({ apiKey: rawKey }));
        await prisma.integration.upsert({
          where: { provider: 'openrouter' },
          update: {
            enabled: true,
            credentialsEnc: encrypted,
            updatedAt: new Date(),
          },
          create: {
            provider: 'openrouter',
            name: 'OpenRouter AI',
            enabled: true,
            credentialsEnc: encrypted,
          },
        });
        process.env.OPENROUTER_API_KEY = rawKey;
      }
    }

    // Crear o modificar usuario (si es admin)
    if (body.newUser && session.role === 'ADMIN') {
      const { email, password, name, role } = body.newUser;
      if (email && password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.create({
          data: {
            email: email.toLowerCase().trim(),
            passwordHash,
            name: name || 'Miembro del equipo',
            role: role || 'AGENT',
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al guardar ajustes:', error);
    return NextResponse.json({ error: error?.message || 'Error al actualizar ajustes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();

    if (body.action === 'FETCH_OPENROUTER_MODELS') {
      try {
        const apiKey = await getOpenRouterApiKey();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const res = await fetch('https://openrouter.ai/api/v1/models', {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          return NextResponse.json({ ok: false, error: 'No se pudo obtener el catálogo de OpenRouter' }, { status: 502 });
        }

        const json = await res.json();
        const allModels = json.data || [];

        const RECOMMENDED_IDS = new Set([
          'openai/gpt-4o-mini',
          'google/gemini-2.0-flash-001',
          'anthropic/claude-3.5-haiku',
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'meta-llama/llama-3.3-70b-instruct',
          'google/gemini-2.0-flash-exp:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'deepseek/deepseek-chat',
        ]);

        const PROVIDER_NAMES: Record<string, string> = {
          openai: 'OpenAI',
          google: 'Google',
          anthropic: 'Anthropic',
          'meta-llama': 'Meta',
          mistralai: 'Mistral',
          deepseek: 'DeepSeek',
          cohere: 'Cohere',
          qwen: 'Qwen',
          amazon: 'Amazon',
          microsoft: 'Microsoft',
        };

        const formattedModels = allModels.map((m: any) => {
          const rawPrompt = parseFloat(m.pricing?.prompt || '0');
          const rawCompletion = parseFloat(m.pricing?.completion || '0');
          const inputCostPer1M = +(rawPrompt * 1_000_000).toFixed(4);
          const outputCostPer1M = +(rawCompletion * 1_000_000).toFixed(4);
          const isFree = m.id.endsWith(':free') || m.id.includes(':free') || (inputCostPer1M === 0 && outputCostPer1M === 0);
          const rawProvider = (m.id.split('/')[0] || 'OpenRouter').toLowerCase();
          const provider = PROVIDER_NAMES[rawProvider] || m.id.split('/')[0] || 'OpenRouter';
          const isRecommended = RECOMMENDED_IDS.has(m.id);

          return {
            id: m.id,
            name: m.name || m.id,
            provider,
            inputCostPer1M,
            outputCostPer1M,
            contextLength: m.context_length || 32768,
            recommended: isRecommended,
            isFree,
            description: m.description ? m.description.slice(0, 180) + '...' : (isFree ? 'Modelo gratuito sin costo de tokens.' : 'Modelo disponible en OpenRouter.'),
          };
        });

        // Ordenar: primero recomendados, luego gratuitos, luego alfabético
        formattedModels.sort((a: any, b: any) => {
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          if (a.isFree && !b.isFree) return -1;
          if (!a.isFree && b.isFree) return 1;
          return a.name.localeCompare(b.name);
        });

        return NextResponse.json({ ok: true, models: formattedModels, total: allModels.length });
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Error consultando modelos' }, { status: 500 });
      }
    }

    if (body.action === 'TEST_OPENROUTER') {
      const testKey = body.apiKey && body.apiKey.trim().length > 0
        ? body.apiKey.trim()
        : await getOpenRouterApiKey();

      if (!testKey) {
        return NextResponse.json({
          ok: false,
          error: 'No hay ninguna clave de OpenRouter proporcionada ni guardada.',
        });
      }

      // Probar autenticación con la API oficial de OpenRouter
      try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${testKey}`,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const info = await res.json();
          return NextResponse.json({
            ok: true,
            message: '¡Conexión con OpenRouter verificada con éxito!',
            data: info.data,
          });
        }

        const errText = await res.text();
        let parsedMessage = errText;
        try {
          const parsed = JSON.parse(errText);
          parsedMessage = parsed?.error?.message || errText;
        } catch {}

        return NextResponse.json({
          ok: false,
          error: `Error de OpenRouter (HTTP ${res.status}): ${parsedMessage}`,
        });
      } catch (reqErr: any) {
        return NextResponse.json({
          ok: false,
          error: `Fallo de red o timeout al conectar con OpenRouter: ${reqErr?.message || reqErr}`,
        });
      }
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error en petición' }, { status: 500 });
  }
}
