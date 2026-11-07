import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { getWhatsAppAdapter } from '../lib/channels/whatsapp/factory';
import { buildSystemPrompt } from '../lib/prompt-builder';
import { callOpenRouter, OpenRouterMessage } from '../lib/ai/openrouter';
import { ASSISTANT_TOOLS, executeToolCall } from '../lib/ai/tools';
import { sendTelegramAlert } from '../lib/integrations/telegram/alert';
import { sendGmailEmail } from '../lib/integrations/google/gmail';
import { MessageSender, LogStatus, ConnectionStatus } from '@prisma/client';

console.log('⚙️ [Worker Atendia] Worker de fondo en ejecución.');

let isProcessingJobs = false;

/**
 * 1. Procesa trabajos encolados de mensajes entrantes (Inbound) con Debounce de 8 segundos
 */
async function processWorkerJobs() {
  if (isProcessingJobs) return;
  isProcessingJobs = true;

  try {
    const now = new Date();
    // Buscar trabajos pendientes cuya fecha programada ya haya llegado
    const pendingJobs = await prisma.workerJob.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: now },
      },
      take: 5,
      orderBy: { scheduledFor: 'asc' },
    });

    for (const job of pendingJobs) {
      await prisma.workerJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      try {
        const payload = job.payload as any;

        if (job.type === 'PROCESS_INBOUND') {
          await handleInboundMessageJob(payload);
        } else if (job.type === 'SEND_REMINDER') {
          await handleAppointmentReminderJob(payload);
        } else if (job.type === 'DAILY_SUMMARY') {
          await handleDailySummaryJob();
        } else if (job.type === 'WHATSAPP_CONNECT') {
          console.log('[Worker] Ejecutando orden WHATSAPP_CONNECT...');
          const adapter = await getWhatsAppAdapter('BAILEYS');
          await adapter.connect(false);
        } else if (job.type === 'WHATSAPP_RESET') {
          console.log('[Worker] Ejecutando orden WHATSAPP_RESET (Desconexión limpia + Espera 1s + Nuevo Socket)...');
          const adapter = await getWhatsAppAdapter('BAILEYS');
          await adapter.disconnect();
          await new Promise((r) => setTimeout(r, 1000));
          await adapter.connect(true);
        } else if (job.type === 'WHATSAPP_DISCONNECT') {
          console.log('[Worker] Ejecutando orden WHATSAPP_DISCONNECT...');
          const adapter = await getWhatsAppAdapter('BAILEYS');
          await adapter.disconnect();
        } else if (job.type === 'SEND_OUTBOUND') {
          console.log(`[Worker] Enviando mensaje saliente a ${payload.to}...`);
          const adapter = await getWhatsAppAdapter(payload.provider);
          await adapter.sendMessage({
            to: payload.to,
            text: payload.text,
            recipientBsuid: payload.recipientBsuid,
            waLid: payload.waLid,
          });
          console.log(`[Worker] Mensaje saliente enviado con éxito a ${payload.to}`);
        }

        await prisma.workerJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' },
        });
      } catch (err: any) {
        console.error(`[Worker] Error ejecutando trabajo ${job.id}:`, err);
        await prisma.workerJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', error: err?.message || 'Error desconocido' },
        });
      }
    }
  } catch (error) {
    console.error('[Worker] Error consultando WorkerJob:', error);
  } finally {
    isProcessingJobs = false;
  }
}

async function handleInboundMessageJob(payload: {
  conversationId: string;
  contactId: string;
  channel: string;
  text: string;
  to: string;
  bsuid?: string;
}) {
  const { conversationId, contactId, channel, to, bsuid } = payload;

  const [conversation, business] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { take: 25, orderBy: { createdAt: 'desc' } },
        contact: true,
      },
    }),
    prisma.businessProfile.findFirst(),
  ]);

  if (!conversation) return;

  // Si el asistente está pausado o la conversación está en manos de una persona, no responder
  if (conversation.status === 'WAITING_HUMAN' || (business && !business.assistantActive)) {
    return;
  }

  // Activar estado 'escribiendo' en el canal antes de responder
  const adapter = await getWhatsAppAdapter();
  await adapter.sendTyping(to).catch(() => {});

  // Detección directa de solicitud expresa de atención humana
  const normalizedText = (payload.text || '').toLowerCase().trim();
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
    const handoffMsg = 'Entendido perfectamente. He transferido tu conversación a nuestro equipo clínico para que un asesor te atienda personalmente por aquí en unos momentos.';
    await executeToolCall('pasar_a_humano', {
      motivo: 'Solicitud expresa del cliente: ' + payload.text,
      urgencia: 'alta',
    }, {
      safeMode: false,
      conversationId: conversation.id,
      contactId,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: MessageSender.ASSISTANT,
        text: handoffMsg,
        toolCalls: ['pasar_a_humano'],
      },
    });

    await adapter.sendMessage({
      to: conversation.contact?.waLid || to,
      text: handoffMsg,
      recipientBsuid: conversation.contact?.ycloudBsuid || bsuid,
      waLid: conversation.contact?.waLid || undefined,
    });

    console.log(`[Worker] Derivación expresa a humano procesada para ${conversation.contact?.waLid || to}`);
    return;
  }

  // Preparar contexto del asistente
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
  if (!lastHistoryMsg || lastHistoryMsg.role !== 'user' || lastHistoryMsg.content !== payload.text) {
    formattedHistory.push({ role: 'user', content: payload.text });
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

    // Si el modelo solicita ejecutar herramientas
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
          contactId,
        });

        executedTools.push(toolName);

        messages.push({
          role: 'tool' as any,
          tool_call_id: call.id,
          name: toolName,
          content: JSON.stringify(toolRes.result),
        });
      }
      // Reingresar al bucle para que el modelo genere su respuesta analizando el resultado de la herramienta
      continue;
    }

    // Si no hubo llamadas a herramientas, la respuesta conversacional está lista
    finalAssistantText = assistantMsg.content || '¿En qué te puedo ayudar hoy?';
    break;
  }

  if (!finalAssistantText && lastCompletion?.message?.content) {
    finalAssistantText = lastCompletion.message.content;
  }
  if (!finalAssistantText) {
    finalAssistantText = 'He consultado tu solicitud. ¿Hay algo más en lo que te pueda ayudar?';
  }

  // Si se activó respuesta de contingencia por falta de clave o fallo de proveedor, derivar a humano
  if (lastCompletion?.modelUsed?.startsWith('sistema/')) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'WAITING_HUMAN',
        needsHumanReason: 'Derivado automáticamente a equipo humano (Intermitencia técnica de IA)',
      },
    }).catch(() => {});

    const contactName = conversation.contact?.name || conversation.contact?.phone || 'Paciente';
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const panelUrl = `${baseUrl.replace(/\/$/, '')}/conversaciones`;
    const telegramMessage = [
      '🚨 *Atención Requerida*',
      `El paciente *${contactName}* necesita asistencia humana.`,
      `*Motivo:* Derivado automáticamente a equipo humano (Intermitencia técnica de IA)`,
      `*Canal:* WhatsApp`,
      `[Abrir Panel](${panelUrl})`,
    ].join('\n');

    sendTelegramAlert(telegramMessage).catch(() => {});
  }

  // Guardar mensaje generado por el asistente
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      sender: MessageSender.ASSISTANT,
      text: finalAssistantText,
      toolCalls: executedTools.length > 0 ? executedTools : undefined,
    },
  });

  // Enviar mensaje hacia WhatsApp mediante el adaptador
  await adapter.sendMessage({
    to: conversation.contact?.waLid || to,
    text: finalAssistantText,
    recipientBsuid: conversation.contact?.ycloudBsuid || bsuid,
    waLid: conversation.contact?.waLid || undefined,
  });

  console.log(`[Worker] Respuesta de Valentina enviada a ${conversation.contact?.waLid || to} (${executedTools.length} tools usadas)`);
}

/**
 * 2. Tarea Programada: Recordatorio de citas por WhatsApp 24 horas antes
 */
async function checkUpcomingAppointments() {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        startTime: { gte: in24Hours, lte: in25Hours },
        reminderSent: false,
        status: 'CONFIRMED',
      },
      include: { contact: true },
    });

    for (const appt of appointments) {
      if (appt.contact?.phone) {
        const adapter = await getWhatsAppAdapter();
        const dateStr = appt.startTime.toLocaleDateString('es-SV', {
          timeZone: 'America/El_Salvador',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });

        const reminderText = `Hola ${appt.contact.name || ''}, te recordamos tu cita de mañana para ${appt.serviceName} a las ${dateStr} en Atendia Demo Studio. Si necesitas reprogramarla o cancelarla, avísanos por este medio. ¡Te esperamos!`;

        await adapter.sendMessage({
          to: appt.contact.phone,
          text: reminderText,
          template: {
            name: 'cita_recordatorio_24h',
            language: 'es',
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: appt.contact.name || 'Paciente' },
                  { type: 'text', text: appt.serviceName },
                  { type: 'text', text: dateStr },
                ],
              },
            ],
          },
        });

        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        });

        await prisma.activityLog.create({
          data: {
            action: 'appointment.reminder_sent',
            status: LogStatus.SUCCESS,
            details: {
              appointmentId: appt.id,
              phone: appt.contact.phone,
              service: appt.serviceName,
            },
          },
        });

        console.log(`[Worker] Recordatorio enviado a ${appt.contact.phone} para cita de ${appt.serviceName}`);
      }
    }
  } catch (err) {
    console.error('[Worker] Error revisando recordatorios:', err);
  }
}

async function handleAppointmentReminderJob(payload: any) {
  // Manejo directo de recordatorios encolados
}

/**
 * 3. Tarea Programada: Resumen diario al equipo a las 20:00 vía Gmail
 */
async function checkDailySummarySchedule() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
  });
  const timeStr = formatter.format(now);

  // A las 20:00 en hora de El Salvador
  if (timeStr === '20:00') {
    await handleDailySummaryJob();
  }
}

async function handleDailySummaryJob() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [convCount, apptCount, waitingCount, admin] = await Promise.all([
      prisma.conversation.count({ where: { updatedAt: { gte: today } } }),
      prisma.appointment.count({ where: { createdAt: { gte: today } } }),
      prisma.conversation.count({ where: { status: 'WAITING_HUMAN' } }),
      prisma.user.findFirst({ where: { role: 'ADMIN' } }),
    ]);

    const recipient = admin?.email || process.env.ADMIN_EMAIL || 'admin@atendia.local';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 12px;">
        <h2 style="color: #0f766e;">Resumen Diario de Atención — Atendia</h2>
        <p>Aquí tienes el balance de actividad de hoy en <b>Atendia Demo Studio</b>:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><b>Conversaciones atendidas hoy:</b></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #0f766e; font-size: 18px;"><b>${convCount}</b></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><b>Citas agendadas por el asistente:</b></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #059669; font-size: 18px;"><b>${apptCount}</b></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><b>Conversaciones esperando a humano:</b></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${waitingCount > 0 ? '#b91c1c' : '#374151'}; font-size: 18px;"><b>${waitingCount}</b></td>
          </tr>
        </table>
        <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Informe generado automáticamente a las 20:00 (America/El_Salvador) por Atendia.</p>
      </div>
    `;

    await sendGmailEmail({
      to: recipient,
      subject: `Resumen de Atención Atendia — ${new Date().toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' })}`,
      htmlBody,
    });

    console.log(`[Worker] Resumen diario enviado por Gmail a ${recipient}`);
  } catch (err) {
    console.log('[Worker] Resumen diario omitido (Gmail no conectado o en desarrollo):', (err as any)?.message);
  }
}

/**
 * Bucle maestro del worker (cada 1.5s para trabajos, cada 60s para citas)
 */
async function runWorkerLoop() {
  console.log('✓ [Worker] Bucle de procesamiento de colas y debounce activado.');

  // Inicializar adaptador de WhatsApp Baileys si ya estaba previamente conectado
  try {
    const waConfig = await prisma.channelConfig.findUnique({ where: { type: 'WHATSAPP' } });
    if (waConfig?.waProvider === 'BAILEYS' && waConfig?.waStatus === 'CONNECTED') {
      console.log('📱 [Worker] Conectando sesión existente de Baileys WhatsApp en background...');
      const adapter = await getWhatsAppAdapter('BAILEYS');
      await adapter.connect(false);
    }
  } catch (err) {
    console.error('[Worker] Error iniciando Baileys:', err);
  }

  let tickCount = 0;
  while (true) {
    try {
      await processWorkerJobs();

      // Cada 100 ticks (~60 segundos), revisar citas y resúmenes
      tickCount++;
      if (tickCount >= 100) {
        tickCount = 0;
        await checkUpcomingAppointments();
        await checkDailySummarySchedule();
      }

      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (err) {
      console.error('[Worker] Error en el bucle principal:', err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

runWorkerLoop();

process.on('SIGINT', async () => {
  console.log('[Worker] Deteniendo worker...');
  await prisma.$disconnect();
  process.exit(0);
});
