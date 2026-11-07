import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildSystemPrompt } from '@/lib/prompt-builder';
import { callOpenRouter, OpenRouterMessage } from '@/lib/ai/openrouter';
import { ASSISTANT_TOOLS, executeToolCall } from '@/lib/ai/tools';
import { MessageSender, ChannelType } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, sessionId, contactInfo } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    // Comprobar si el chat web está activo y si el negocio tiene el asistente encendido
    const [business, channelWeb] = await Promise.all([
      prisma.businessProfile.findFirst(),
      prisma.channelConfig.findUnique({ where: { type: 'WEB' } }),
    ]);

    if (channelWeb && channelWeb.webChatEnabled === false) {
      return NextResponse.json({ error: 'El chat web está desactivado temporalmente' }, { status: 403 });
    }

    // 1. Crear o recuperar contacto
    const effectiveSessionId = sessionId || `web_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let contact = await prisma.contact.findFirst({
      where: { webSessionId: effectiveSessionId },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          webSessionId: effectiveSessionId,
          name: contactInfo?.name || 'Visitante Web',
          phone: contactInfo?.phone || null,
          email: contactInfo?.email || null,
        },
      });
    }

    // 2. Recuperar o crear conversación
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        channel: ChannelType.WEB,
      },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { take: 25, orderBy: { createdAt: 'desc' } } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          channel: ChannelType.WEB,
          status: 'BOT_ACTIVE',
          unreadCount: 1,
        },
        include: { messages: true },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });
    }

    // Guardar mensaje del usuario
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: MessageSender.CUSTOMER,
        text: message,
      },
    });

    // Si la conversación ha sido tomada por un agente humano, no responde la IA
    if (conversation.status === 'WAITING_HUMAN') {
      return NextResponse.json({
        response: 'Un miembro de nuestro equipo ha tomado la conversación y te responderá en unos instantes.',
        sessionId: effectiveSessionId,
        waitingHuman: true,
      });
    }

    // Detección directa de solicitud expresa de atención humana
    const normalizedText = (message || '').toLowerCase().trim();
    const isExplicitHumanRequest =
      normalizedText.includes('atencion humana') ||
      normalizedText.includes('atención humana') ||
      normalizedText.includes('intervencion humana') ||
      normalizedText.includes('intervención humana') ||
      normalizedText.includes('hablar con un humano') ||
      normalizedText.includes('hablar con una persona') ||
      normalizedText.includes('pasar a humano') ||
      normalizedText.includes('asesor humano') ||
      normalizedText.includes('un humano') ||
      normalizedText.includes('quiero un humano') ||
      normalizedText.includes('agente humano') ||
      normalizedText.includes('con un humano') ||
      normalizedText.includes('persona real') ||
      normalizedText.includes('operador') ||
      normalizedText.includes('asistencia humana');

    if (isExplicitHumanRequest) {
      const handoffMsg = 'Entendido. He transferido tu conversación a nuestro equipo de atención humana. Un asesor de daniautoma te responderá en unos instantes.';
      await executeToolCall('pasar_a_humano', {
        motivo: 'Solicitud expresa del cliente: ' + message,
        urgencia: 'alta',
      }, {
        safeMode: false,
        conversationId: conversation.id,
        contactId: contact.id,
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: MessageSender.ASSISTANT,
          text: handoffMsg,
          toolCalls: ['pasar_a_humano'],
        },
      });

      return NextResponse.json({
        response: handoffMsg,
        sessionId: effectiveSessionId,
        waitingHuman: true,
      });
    }

    // Si el interruptor general del asistente está en pausa
    if (business && !business.assistantActive) {
      return NextResponse.json({
        response: 'El asistente se encuentra temporalmente en pausa. Por favor déjanos tu consulta y te atenderemos pronto.',
        sessionId: effectiveSessionId,
      });
    }

    // 3. Ejecutar IA con herramientas
    const [assistant, services, faqs, notes] = await Promise.all([
      prisma.assistantConfig.findFirst(),
      prisma.service.findMany({ orderBy: { name: 'asc' } }),
      prisma.faq.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.knowledgeNote.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

    const systemPrompt = buildSystemPrompt({
      assistantName: assistant?.name || 'Valentina (Asistente Virtual Demo)',
      businessName: business?.name || 'Atendia Demo Studio',
      activity: business?.activity || 'Demostración de Asistente de IA Omnicanal y Agendamiento Automatizado',
      address: business?.address || 'Entorno de Prueba en Vivo de daniautoma',
      phone: business?.phone || '+503 2200 1234',
      website: business?.website || 'https://demo.daniautoma.cloud',
      timezone: business?.timezone || 'America/El_Salvador',
      tone: assistant?.tone || 'cercano',
      welcomeMessage: assistant?.welcomeMessage || '',
      customInstructions: assistant?.customInstructions || '',
      neverDoList: assistant?.neverDoList || '',
      businessHours: (assistant?.businessHours as any) || {},
      outsideHoursBehavior: assistant?.outsideHoursBehavior || 'APPOINTMENT_OR_MESSAGE',
      handoffRules: (assistant?.handoffRules as any) || {},
      services,
      faqs,
      knowledgeNotes: notes,
      systemPromptOverride: assistant?.systemPromptOverride,
    });

    // Invertir para tener orden cronológico de los mensajes más recientes
    const chronologicalDbMessages = (conversation.messages || []).reverse();

    const formattedHistory: OpenRouterMessage[] = chronologicalDbMessages.map((m) => ({
      role: m.sender === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }));

    // Garantizar que el mensaje recién recibido del paciente esté al final del historial
    const lastHistoryMsg = formattedHistory[formattedHistory.length - 1];
    if (!lastHistoryMsg || lastHistoryMsg.role !== 'user' || lastHistoryMsg.content !== message) {
      formattedHistory.push({ role: 'user', content: message });
    }

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
    ];

    const model = assistant?.aiModel || 'openai/gpt-4o-mini';
    const fallbackModel = assistant?.aiModelFallback || 'openai/gpt-4o-mini';

    let currentTurn = 0;
    const maxToolIterations = 5;
    const executedTools: string[] = [];
    let finalAssistantText = '';
    let lastCompletion: any = null;

    while (currentTurn < maxToolIterations) {
      currentTurn++;

      const completion = await callOpenRouter({
        model,
        fallbackModel,
        messages,
        tools: ASSISTANT_TOOLS,
        temperature: 0.2,
      });
      lastCompletion = completion;

      const assistantMsg = completion.message;
      messages.push(assistantMsg);

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        for (const call of assistantMsg.tool_calls) {
          const toolName = call.function.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(call.function.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          const toolRes = await executeToolCall(toolName, toolArgs, {
            safeMode: false,
            conversationId: conversation.id,
            contactId: contact.id,
          });

          executedTools.push(toolName);

          messages.push({
            role: 'tool' as any,
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify(toolRes.result),
          });
        }
        continue;
      }

      finalAssistantText = assistantMsg.content || '¿En qué te puedo ayudar hoy?';
      break;
    }

    if (!finalAssistantText && lastCompletion?.message?.content) {
      finalAssistantText = lastCompletion.message.content;
    }
    if (!finalAssistantText) {
      finalAssistantText = 'He consultado tu solicitud. ¿Hay algo más en lo que te pueda ayudar?';
    }

    // Guardar respuesta del asistente
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: MessageSender.ASSISTANT,
        text: finalAssistantText,
        toolCalls: executedTools.length > 0 ? executedTools : undefined,
      },
    });

    return NextResponse.json({
      response: finalAssistantText,
      sessionId: effectiveSessionId,
    });
  } catch (error: any) {
    console.error('Error en /api/chat web:', error);
    return NextResponse.json({ error: error.message || 'Error en el chat' }, { status: 500 });
  }
}
