import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { encrypt, maskSecret } from '@/lib/crypto';
import { ConnectionStatus, WhatsAppProvider } from '@prisma/client';

export async function GET() {
  try {
    await requireAuth();

    const [channelWa, channelWeb] = await Promise.all([
      prisma.channelConfig.findUnique({ where: { type: 'WHATSAPP' } }),
      prisma.channelConfig.findUnique({ where: { type: 'WEB' } }),
    ]);

    return NextResponse.json({
      whatsapp: {
        provider: channelWa?.waProvider || WhatsAppProvider.BAILEYS,
        status: channelWa?.waStatus || 'DISCONNECTED',
        phoneNumber: channelWa?.waPhoneNumber,
        businessName: channelWa?.waBusinessName,
        qrCode: channelWa?.baileysQrCode,
        wabaId: channelWa?.ycloudWabaId,
        phoneNumberId: channelWa?.ycloudPhoneNumberId,
        hasApiKey: !!channelWa?.ycloudApiKeyEnc,
        hasWebhookSecret: !!channelWa?.ycloudWebhookSecretEnc,
        maskedApiKey: channelWa?.ycloudApiKeyEnc ? maskSecret(channelWa.ycloudApiKeyEnc) : null,
      },
      web: {
        enabled: channelWeb?.webChatEnabled ?? true,
        color: channelWeb?.webChatColor || '#2563eb',
        title: channelWeb?.webChatTitle || 'Valentina | Asistente Virtual Demo',
        welcome: channelWeb?.webChatWelcome || '¡Hola! Soy Valentina de daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?',
      },
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();

    // Actualizar configuración de WhatsApp
    if (body.whatsapp) {
      const wa = body.whatsapp;
      const updateData: any = {
        waProvider: wa.provider,
      };

      if (wa.apiKey) {
        updateData.ycloudApiKeyEnc = encrypt(wa.apiKey);
      }
      if (wa.webhookSecret) {
        updateData.ycloudWebhookSecretEnc = encrypt(wa.webhookSecret);
      }
      if (wa.wabaId !== undefined) {
        updateData.ycloudWabaId = wa.wabaId;
      }
      if (wa.phoneNumberId !== undefined) {
        updateData.ycloudPhoneNumberId = wa.phoneNumberId;
      }
      if (wa.phoneNumber !== undefined) {
        updateData.waPhoneNumber = wa.phoneNumber;
      }

      if (wa.action === 'RESET' || wa.action === 'DISCONNECT') {
        updateData.baileysQrCode = null;
        if (wa.action === 'DISCONNECT') {
          updateData.waStatus = ConnectionStatus.DISCONNECTED;
          updateData.waPhoneNumber = null;
        } else if (wa.action === 'RESET') {
          updateData.waStatus = ConnectionStatus.WAITING_QR;
        }
      }

      await prisma.channelConfig.update({
        where: { type: 'WHATSAPP' },
        data: updateData,
      });

      // Si se solicitó acción de conexión/desconexión o reinicio:
      // Delegar la gestión del socket al Worker (único dueño de Baileys)
      if (wa.action === 'CONNECT' || wa.action === 'RESET' || wa.action === 'DISCONNECT') {
        // Eliminar trabajos anteriores pendientes de WhatsApp para no acumular
        await prisma.workerJob.deleteMany({
          where: {
            type: { in: ['WHATSAPP_CONNECT', 'WHATSAPP_RESET', 'WHATSAPP_DISCONNECT'] },
            status: 'PENDING',
          },
        }).catch(() => {});

        // Crear trabajo para ejecución inmediata en el Worker
        await prisma.workerJob.create({
          data: {
            type: `WHATSAPP_${wa.action}`,
            payload: { provider: wa.provider },
            scheduledFor: new Date(),
          },
        });

        // Esperar brevemente (hasta 4s) a que el Worker genere el QR o cambie de estado
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 200));
          const updatedWa = await prisma.channelConfig.findUnique({ where: { type: 'WHATSAPP' } });
          if (wa.action === 'DISCONNECT' && updatedWa?.waStatus === 'DISCONNECTED') break;
          if (wa.action !== 'DISCONNECT' && (updatedWa?.baileysQrCode || updatedWa?.waStatus === 'CONNECTED')) break;
        }
      }
    }

    // Actualizar configuración del Chat Web
    if (body.web) {
      const web = body.web;
      await prisma.channelConfig.update({
        where: { type: 'WEB' },
        data: {
          webChatEnabled: web.enabled,
          webChatColor: web.color,
          webChatTitle: web.title,
          webChatWelcome: web.welcome,
        },
      });
    }

    // Retornar estado actualizado desde la BD
    const currentWa = await prisma.channelConfig.findUnique({ where: { type: 'WHATSAPP' } });

    return NextResponse.json({
      success: true,
      whatsapp: {
        provider: currentWa?.waProvider || WhatsAppProvider.BAILEYS,
        status: currentWa?.waStatus || 'DISCONNECTED',
        phoneNumber: currentWa?.waPhoneNumber,
        businessName: currentWa?.waBusinessName,
        qrCode: currentWa?.baileysQrCode,
      },
    });
  } catch (error: any) {
    console.error('Error al actualizar canales:', error);
    return NextResponse.json({ error: error?.message || 'Error al guardar' }, { status: 500 });
  }
}
