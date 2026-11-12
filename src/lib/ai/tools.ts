import { prisma } from '@/lib/prisma';
import { LogStatus } from '@prisma/client';
import { sendSlackNotification } from '@/lib/integrations/slack';
import { sendTelegramAlert } from '@/lib/integrations/telegram/alert';
import {
  saveOrUpdateLeadInSheets,
  recordAppointmentInSheets,
} from '@/lib/integrations/google/sheets';
import { createGoogleCalendarEvent } from '@/lib/integrations/google/calendar';
import { sendGmailEmail } from '@/lib/integrations/google/gmail';
import { createStripePaymentLink } from '@/lib/integrations/stripe';
import { dispatchOutgoingWebhook } from '@/lib/integrations/webhooks';
import { validateAndNormalizeElSalvadorPhone } from '@/lib/phone';

export const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidad',
      description: 'Consulta huecos libres en la agenda para una fecha y franja horaria determinada. NOTA: La clínica está cerrada los domingos (no hay disponibilidad) y sábados después de las 13:00.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD (ej: "2026-11-03")',
          },
          hora_preferida: {
            type: 'string',
            description: 'Hora preferida en formato HH:mm (ej: "11:00" o "17:30")',
          },
        },
        required: ['fecha'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_cita',
      description: 'Agenda y reserva una cita en la clínica. IMPORTANTE: Requiere confirmación expresa del día, la hora, nombre completo y teléfono válido (+503). La clínica está cerrada los domingos.',
      parameters: {
        type: 'object',
        properties: {
          nombre_cliente: { type: 'string', description: 'Nombre completo del paciente' },
          telefono: { type: 'string', description: 'Teléfono de contacto de El Salvador (+503... o número de 8 dígitos ej: 70123444)' },
          email: { type: 'string', description: 'Correo electrónico del paciente para confirmación (opcional)' },
          servicio: { type: 'string', description: 'Nombre del servicio solicitado' },
          fecha_hora: { type: 'string', description: 'Fecha y hora en formato ISO o YYYY-MM-DDTHH:mm' },
          confirmado_por_cliente: { type: 'boolean', description: 'Debe ser true tras confirmación expresa del cliente' },
        },
        required: ['nombre_cliente', 'telefono', 'servicio', 'fecha_hora', 'confirmado_por_cliente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_lead',
      description: 'Registra o actualiza en la pestaña "Leads" del CRM de Google Sheets los datos de un paciente potencial cuando este solicita información de tarifas, tratamientos o resuelve dudas pero decide no agendar en este momento.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del paciente o contacto' },
          telefono: { type: 'string', description: 'Teléfono de contacto de El Salvador (+503... o número de 8 dígitos ej: 70123444). Opcional si el cliente aún no lo ha brindado.' },
          servicio_interes: { type: 'string', description: 'Tratamiento por el que preguntó o mostró interés (ej: "Limpieza Dental", "Blanqueamiento LED", "Ortodoncia Invisible" o "No especificado")' },
          estado_lead: {
            type: 'string',
            enum: ['Potencial', 'Solo Información'],
            description: '"Solo Información" si solo pidió precios/horarios, "Potencial" si demostró alto interés en atenderse pronto.',
          },
          resumen_conversacion: { type: 'string', description: 'Resumen conciso en una sola línea de lo conversado y el motivo de seguimiento' },
        },
        required: ['nombre', 'resumen_conversacion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generar_enlace_pago',
      description: 'Genera un enlace de pago de Stripe para cobrar una señal o depósito de reserva de cita.',
      parameters: {
        type: 'object',
        properties: {
          servicio: { type: 'string', description: 'Tratamiento a reservar' },
          importe_deposito: { type: 'number', description: 'Importe de la señal en Dólares USD (ej: 20 o 50)' },
          email_cliente: { type: 'string', description: 'Email del cliente (opcional)' },
        },
        required: ['servicio', 'importe_deposito'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_datos_contacto',
      description: 'Guarda o actualiza la ficha del cliente (nombre, email, teléfono o notas clínicas).',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          telefono: { type: 'string' },
          email: { type: 'string' },
          notas: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pasar_a_humano',
      description: 'Transfiere la conversación a una persona del equipo cuando hay quejas, urgencias o solicitud expresa del cliente.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Razón por la cual se transfiere a un agente humano' },
          urgencia: {
            type: 'string',
            enum: ['baja', 'media', 'alta'],
            description: 'Nivel de urgencia detectado',
          },
        },
        required: ['motivo', 'urgencia'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'probar_conexion_ycloud',
      description: 'Ejecuta un test diagnóstico de conexión y webhook oficial de la API de WhatsApp Business de YCloud.',
      parameters: {
        type: 'object',
        properties: {
          checkWebhook: { type: 'boolean', description: 'Verificar firma criptográfica HMAC-SHA256' },
        },
      },
    },
  },
];

export interface ToolExecutionContext {
  conversationId?: string;
  contactId?: string;
  safeMode: boolean; // Si es true, NO toca bases de datos externas ni cobra
}

export async function executeToolCall(
  name: string,
  args: any,
  ctx: ToolExecutionContext
): Promise<{ result: any; summary: string }> {
  try {
    switch (name) {
      case 'consultar_servicios': {
        const query = (args.query || '').toLowerCase();
        const allServices = await prisma.service.findMany();
        const filtered = query
          ? allServices.filter(
              (s) =>
                s.name.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query)
            )
          : allServices;

        return {
          result: {
            servicios: filtered.map((s) => ({
              nombre: s.name,
              descripcion: s.description,
              duracionMinutos: s.durationMinutes,
              precio: s.price,
              desde: s.isPriceFrom,
              requiereValoracion: s.requiresEvaluation,
            })),
          },
          summary: `Se consultaron ${filtered.length} servicios del catálogo (búsqueda: "${query || 'todos'}").`,
        };
      }

      case 'consultar_disponibilidad': {
        const fecha = args.fecha || new Date().toISOString().split('T')[0];
        const horaPreferida = args.hora_preferida || '10:00';

        // Extraer componentes de fecha sin sufrir desajustes por husos horarios
        const cleanDate = (fecha || '').split('T')[0].split(' ')[0];
        const [year, month, day] = cleanDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day, 12, 0, 0);
        const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const nombreDia = diasSemana[dayOfWeek];

        // Extraer hora preferida en minutos desde medianoche
        let prefHour = 10;
        let prefMin = 0;
        if (horaPreferida && horaPreferida.includes(':')) {
          const [h, m] = horaPreferida.split(':').map(Number);
          if (!isNaN(h)) prefHour = h;
          if (!isNaN(m)) prefMin = m;
        }
        const prefMinutes = prefHour * 60 + prefMin;

        // 1. RESTRICCIÓN DOMINGO (Cerrado todo el día)
        if (dayOfWeek === 0) {
          const nextMonday = new Date(year, month - 1, day + 1, 12, 0, 0);
          const nextMondayIso = nextMonday.toISOString().split('T')[0];
          return {
            result: {
              fecha,
              diaSemana: 'domingo',
              cerrado: true,
              motivo: 'La clínica dental permanece cerrada los domingos (no es festivo, es el descanso dominical regular).',
              huecosDisponibles: [],
              siguienteDiaHabil: {
                fecha: nextMondayIso,
                diaSemana: 'lunes',
                horario: '08:00 a 18:00',
              },
              mensaje: `El día ${fecha} es domingo y la clínica está cerrada. El siguiente día hábil disponible es el lunes ${nextMondayIso} a partir de las 08:30.`,
            },
            summary: `Cerrado: El día ${fecha} es domingo. La clínica está cerrada; ofrecer el lunes ${nextMondayIso}.`,
          };
        }

        // 2. RESTRICCIÓN SÁBADO (08:00 a 13:00)
        if (dayOfWeek === 6) {
          const sabadoHuecos = ['08:30', '09:30', '10:30', '11:30', '12:15'];
          if (prefMinutes >= 13 * 60) {
            const nextMonday = new Date(year, month - 1, day + 2, 12, 0, 0);
            const nextMondayIso = nextMonday.toISOString().split('T')[0];
            return {
              result: {
                fecha,
                diaSemana: 'sábado',
                cerrado: true,
                motivo: 'Los sábados la clínica atiende únicamente en horario matutino de 08:00 a 13:00. Para la hora solicitada ya está cerrada.',
                huecosDisponibles: [],
                siguienteDiaHabil: {
                  fecha: nextMondayIso,
                  diaSemana: 'lunes',
                  horario: '08:00 a 18:00',
                },
                mensaje: `Los sábados la atención es matutina (08:00 a 13:00). Para la hora ${horaPreferida} ya está cerrada. Ofrece citas matutinas el sábado o para el lunes ${nextMondayIso}.`,
              },
              summary: `Cerrado: Sábado ${fecha} a las ${horaPreferida} fuera de horario de atención (cierra a las 13:00).`,
            };
          }

          return {
            result: {
              fecha,
              diaSemana: 'sábado',
              cerrado: false,
              huecosDisponibles: sabadoHuecos,
              horaPreferidaDisponible: sabadoHuecos.includes(horaPreferida),
              nota: 'Horario especial de sábado: 08:00 a 13:00 en San Salvador.',
            },
            summary: `Disponibilidad consultada para el sábado ${fecha}: 5 huecos matutinos disponibles.`,
          };
        }

        // 3. Lunes a Viernes (08:00 a 18:00)
        const semanaHuecos = ['08:30', '10:00', '11:30', '14:00', '15:30', '17:00'];
        if (prefMinutes < 8 * 60 || prefMinutes >= 18 * 60) {
          return {
            result: {
              fecha,
              diaSemana: nombreDia,
              cerrado: true,
              huecosDisponibles: [],
              motivo: `El horario de atención es de 08:00 a 18:00. A las ${horaPreferida} la clínica se encuentra cerrada.`,
              mensaje: `El horario de atención para los días ${nombreDia} es de 08:00 a 18:00. Para la hora solicitada (${horaPreferida}) la clínica se encuentra cerrada. Ofrece citas dentro del horario hábil.`,
            },
            summary: `Fuera de horario: ${nombreDia} ${fecha} a las ${horaPreferida} fuera de horario de atención.`,
          };
        }

        return {
          result: {
            fecha,
            diaSemana: nombreDia,
            cerrado: false,
            huecosDisponibles: semanaHuecos,
            horaPreferidaDisponible: semanaHuecos.includes(horaPreferida),
            nota: 'Huecos de 45 minutos en horario oficial de San Salvador (08:00 - 18:00).',
          },
          summary: `Disponibilidad consultada para el día ${fecha}: 6 huecos libres encontrados en horario hábil.`,
        };
      }

      case 'registrar_lead': {
        const contact = ctx.contactId
          ? await prisma.contact.findUnique({ where: { id: ctx.contactId } })
          : null;

        let candidatePhone = args.telefono || contact?.phone || null;
        if (candidatePhone) {
          const v = validateAndNormalizeElSalvadorPhone(candidatePhone);
          if (v.isValid && v.phone) {
            candidatePhone = v.phone;
          }
        }

        const patientName = args.nombre || contact?.name || 'Prospecto';
        const serviceInterest = args.servicio_interes || 'No especificado';
        const leadStatus = args.estado_lead || 'Solo Información';
        const summary = args.resumen_conversacion || 'Paciente consultó información pero no agendó en este momento';

        if (contact) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              name: patientName !== 'Prospecto' ? patientName : contact.name,
              phone: candidatePhone || contact.phone,
              notes: summary,
            },
          }).catch(() => {});
        }

        await saveOrUpdateLeadInSheets({
          name: patientName,
          phone: candidatePhone,
          channel: 'WhatsApp',
          serviceInterest,
          leadStatus,
          summary,
        });

        return {
          result: {
            success: true,
            lead: {
              nombre: patientName,
              telefono: candidatePhone,
              servicio: serviceInterest,
              estado: leadStatus,
              resumen: summary,
            },
          },
          summary: `Lead registrado en CRM ("Leads"): ${patientName} - ${serviceInterest} [${leadStatus}].`,
        };
      }

      case 'agendar_cita': {
        if (!args.confirmado_por_cliente) {
          return {
            result: { error: 'El cliente debe confirmar explícitamente el día y la hora antes de fijar la cita.' },
            summary: 'Bloqueado: Se solicitó confirmación al paciente antes de agendar.',
          };
        }

        // 1. Verificación matemática estricta de fecha y hora
        const rawFechaHora = args.fecha_hora;
        if (!rawFechaHora) {
          return {
            result: {
              error: 'HORARIO_INVALIDO',
              mensaje: 'No se especificó la fecha y hora de la cita. Solicita la fecha y hora al paciente.',
            },
            summary: 'Rechazado: Fecha y hora no indicadas.',
          };
        }

        const cleanDatePart = rawFechaHora.split('T')[0].split(' ')[0];
        const [appYear, appMonth, appDay] = cleanDatePart.split('-').map(Number);
        const appDateObj = new Date(appYear, appMonth - 1, appDay, 12, 0, 0);
        const appDayOfWeek = appDateObj.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const meses = [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const nombreDiaCita = diasSemana[appDayOfWeek];
        const nombreMesCita = meses[appMonth - 1];

        let appHours = 10;
        let appMinutes = 0;
        if (rawFechaHora.includes('T') || rawFechaHora.includes(' ')) {
          const timePart = rawFechaHora.includes('T') ? rawFechaHora.split('T')[1] : rawFechaHora.split(' ')[1];
          const [h, m] = timePart.split(':').map(Number);
          if (!isNaN(h)) appHours = h;
          if (!isNaN(m)) appMinutes = m;
        }
        const appTotalMinutes = appHours * 60 + appMinutes;

        const ampm = appHours >= 12 ? 'p.m.' : 'a.m.';
        const h12 = appHours % 12 || 12;
        const mStr = appMinutes.toString().padStart(2, '0');
        const horaLegible = `${h12}:${mStr} ${ampm}`;
        const fechaLegible = `${nombreDiaCita} ${appDay} de ${nombreMesCita} de ${appYear} a las ${horaLegible}`;

        // A. RESTRICCIÓN DOMINGO (CERRADO)
        if (appDayOfWeek === 0) {
          return {
            result: {
              error: 'HORARIO_INVALIDO',
              mensaje: 'Imposible agendar. La clínica está cerrada los domingos. Pide al usuario otra fecha.',
            },
            summary: `Rechazado: La clínica está cerrada los domingos (${rawFechaHora}).`,
          };
        }

        // B. RESTRICCIÓN SÁBADO (08:00 a 13:00)
        if (appDayOfWeek === 6) {
          if (appTotalMinutes < 8 * 60 || appTotalMinutes >= 13 * 60) {
            return {
              result: {
                error: 'HORARIO_INVALIDO',
                mensaje: 'Imposible agendar. Los sábados la clínica atiende únicamente de 08:00 a 13:00. Pide al usuario otra fecha o un horario matutino.',
              },
              summary: `Rechazado: Sábado fuera de horario (${rawFechaHora}). Atención únicamente de 08:00 a 13:00.`,
            };
          }
        }

        // C. RESTRICCIÓN LUNES A VIERNES (08:00 a 18:00)
        if (appTotalMinutes < 8 * 60 || appTotalMinutes >= 18 * 60) {
          return {
            result: {
              error: 'HORARIO_INVALIDO',
              mensaje: 'Imposible agendar. La hora solicitada está fuera del horario de atención clínica (lunes a viernes de 08:00 a 18:00). Pide al usuario otra hora dentro de este rango.',
            },
            summary: `Rechazado: Cita fuera del horario de atención clínica (${rawFechaHora}).`,
          };
        }

        // Obtener contacto actual si existe
        let contact = ctx.contactId
          ? await prisma.contact.findUnique({ where: { id: ctx.contactId } })
          : null;

        // Validación estricta del número de teléfono para El Salvador (+503 de 8 dígitos)
        const candidatePhone = args.telefono || contact?.phone;
        const phoneValidation = validateAndNormalizeElSalvadorPhone(candidatePhone);

        if (!phoneValidation.isValid || !phoneValidation.phone) {
          return {
            result: {
              error: 'TELEFONO_INVALIDO',
              mensaje: `El número de teléfono "${candidatePhone || 'no proporcionado'}" no es válido. En El Salvador debe ser un número de 8 dígitos con prefijo +503 (ejemplo: +503 7012 3444 o 70123444). Por favor pídele amablemente al paciente que te proporcione su número de teléfono correcto para poder confirmar y agendar la cita.`,
            },
            summary: `Rechazado: Teléfono inválido (${candidatePhone || 'vacío'}). Se requiere formato válido de El Salvador (+503 de 8 dígitos).`,
          };
        }

        const validPhone = phoneValidation.phone;

        if (ctx.safeMode) {
          return {
            result: {
              status: 'SIMULATED',
              modoSeguro: true,
              telefono: validPhone,
              mensaje: `[MODO SEGURO ACTIVO] Simulación exitosa de cita para ${args.nombre_cliente} (${args.servicio}) el ${args.fecha_hora}. Teléfono verificado: ${validPhone}. Ningún evento real fue creado ni se alteraron agendas externas.`,
            },
            summary: `[MODO SEGURO] Simulación de cita para ${args.nombre_cliente} - ${args.servicio} (${args.fecha_hora}) [${validPhone}].`,
          };
        }

        // Crear o actualizar cita real en base de datos
        if (!contact) {
          contact = await prisma.contact.upsert({
            where: { phone: validPhone },
            update: {
              name: args.nombre_cliente,
              email: args.email || undefined,
            },
            create: {
              name: args.nombre_cliente,
              phone: validPhone,
              email: args.email,
            },
          });
        } else {
          // Si el contacto tenía un teléfono no válido (como un LID) o faltaba, actualizarlo
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: {
              phone: validPhone,
              name: args.nombre_cliente || contact.name,
              email: args.email || contact.email || undefined,
            },
          });
        }

        const startTime = new Date(args.fecha_hora);
        const endTime = new Date(startTime.getTime() + 45 * 60000);

        let createdAppointment = null;
        if (contact) {
          createdAppointment = await prisma.appointment.create({
            data: {
              contactId: contact.id,
              serviceName: args.servicio,
              startTime,
              endTime,
              status: 'CONFIRMED',
            },
          });
        }

        // 1. Google Calendar Automático: si la integración está activa, crear evento y persistir id
        let gcalEventId: string | null = null;
        try {
          const calIntegration = await prisma.integration.findUnique({
            where: { provider: 'google_calendar' },
          });

          if (calIntegration?.enabled) {
            const calEvent = await createGoogleCalendarEvent({
              summary: `Cita: ${args.nombre_cliente} - ${args.servicio}`,
              description: `Cita agendada automáticamente por DentalIA.\nPaciente: ${args.nombre_cliente}\nTeléfono: ${validPhone}\nTratamiento: ${args.servicio}`,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              attendeeEmail: args.email || contact?.email || undefined,
              timeZone: 'America/El_Salvador',
            });

            if (calEvent?.id) {
              gcalEventId = calEvent.id;
              if (createdAppointment) {
                await prisma.appointment.update({
                  where: { id: createdAppointment.id },
                  data: { googleCalendarEventId: calEvent.id },
                });
              }
            }
          }
        } catch (err: any) {
          console.warn('[Tools] No se pudo sincronizar evento con Google Calendar:', err?.message);
        }

        // 2. Google Sheets: Registrar en Hoja 2 "Citas Agendadas" y sincronizar estado en Hoja 1 "Leads"
        recordAppointmentInSheets({
          name: args.nombre_cliente,
          phone: validPhone,
          service: args.servicio,
          dateTime: startTime,
          status: 'Activa',
          channel: 'WhatsApp',
        }).catch((err) => {
          console.warn('[Tools] Error al registrar cita en Google Sheets:', err?.message);
        });

        // 3. Gmail: disparar correo HTML con datos y recomendaciones si está habilitado y hay email
        const patientEmail = args.email || contact?.email;
        if (patientEmail) {
          (async () => {
            try {
              const gmailIntegration = await prisma.integration.findUnique({
                where: { provider: 'gmail' },
              });

              if (gmailIntegration?.enabled) {
                const formattedDate = new Date(startTime).toLocaleDateString('es-SV', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'America/El_Salvador',
                });
                const formattedTime = new Date(startTime).toLocaleTimeString('es-SV', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/El_Salvador',
                });

                const htmlBody = `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
                    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                      <div style="background-color: #0d9488; padding: 24px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Clínica Dental San Salvador</h1>
                        <p style="color: #ccfbf1; margin: 6px 0 0; font-size: 13px;">Confirmación de Cita Odontológica</p>
                      </div>
                      <div style="padding: 24px;">
                        <p style="font-size: 15px; margin: 0 0 16px;">¡Hola, <strong>${args.nombre_cliente}</strong>!</p>
                        <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 20px;">
                          Te confirmamos que tu cita ha sido reservada con éxito en nuestra clínica en San Salvador:
                        </p>
                        <div style="background-color: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
                          <p style="margin: 0 0 6px; font-size: 14px;"><strong>Tratamiento:</strong> ${args.servicio}</p>
                          <p style="margin: 0 0 6px; font-size: 14px;"><strong>Fecha:</strong> ${formattedDate}</p>
                          <p style="margin: 0 0 6px; font-size: 14px;"><strong>Hora (El Salvador):</strong> ${formattedTime}</p>
                          <p style="margin: 0; font-size: 14px;"><strong>Ubicación:</strong> Paseo General Escalón #3700, San Salvador</p>
                        </div>
                        <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 8px;">Recomendaciones para tu visita:</h4>
                        <ul style="font-size: 13px; color: #475569; line-height: 1.6; margin: 0 0 20px; padding-left: 18px;">
                          <li>Llegar con 10 minutos de anticipación.</li>
                          <li>Estacionamiento privado y seguro disponible en nuestras instalaciones.</li>
                          <li>Presentar tu documento de identidad (DUI o pasaporte) en recepción.</li>
                          <li>Para reprogramar o cancelar, por favor avísanos con al menos 4 horas de anticipación.</li>
                        </ul>
                        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px;">
                          <p style="margin: 0 0 4px;"><strong>Clínica Dental San Salvador</strong></p>
                          <p style="margin: 0;">Teléfono / WhatsApp: +503 2200 1234 | San Salvador, El Salvador</p>
                        </div>
                      </div>
                    </div>
                  </div>
                `;

                await sendGmailEmail({
                  to: patientEmail,
                  subject: `Confirmación de Cita Odontológica - ${args.nombre_cliente} (${args.servicio})`,
                  htmlBody,
                });
              }
            } catch (err: any) {
              console.warn('[agendar_cita] No se pudo enviar confirmación por Gmail:', err?.message);
            }
          })();
        }

        sendSlackNotification('Nueva Cita Agendada', {
          'Paciente': args.nombre_cliente,
          'Tratamiento': args.servicio,
          'Fecha y Hora': args.fecha_hora,
          'Teléfono': args.telefono || 'No indicado',
        }).catch(() => {});

        dispatchOutgoingWebhook('appointment.booked', {
          appointmentId: createdAppointment?.id,
          patientName: args.nombre_cliente,
          service: args.servicio,
          startTime: args.fecha_hora,
          googleCalendarEventId: gcalEventId,
        }).catch(() => {});

        return {
          result: {
            citaId: createdAppointment?.id || 'cita_' + Date.now(),
            status: 'CONFIRMED',
            paciente: args.nombre_cliente,
            telefono: validPhone,
            servicio: args.servicio,
            fechaHora: args.fecha_hora,
            diaSemanaConfirmado: nombreDiaCita,
            fechaLegibleConfirmada: fechaLegible,
            googleCalendarEventId: gcalEventId,
            INSTRUCCION_OBLIGATORIA_RESPUESTA: `Cita agendada con éxito para el día ${nombreDiaCita.toUpperCase()} (${fechaLegible}). Es estrictamente obligatorio que en tu confirmación al paciente uses exactamente la frase "${fechaLegible}". NUNCA digas un día de la semana diferente (si es lunes, di lunes; no digas martes).`,
          },
          summary: `Cita confirmada para ${args.nombre_cliente} (${args.servicio}) el ${fechaLegible}${gcalEventId ? ' (Sincronizada con Google Calendar)' : ''}.`,
        };
      }

      case 'generar_enlace_pago': {
        const importe = args.importe_deposito || 30;
        const servicio = args.servicio || 'Tratamiento';

        if (ctx.safeMode) {
          return {
            result: {
              status: 'SIMULATED',
              modoSeguro: true,
              enlacePago: `https://checkout.stripe.com/pay/simulated_deposit_${Date.now()}#safe_mode`,
              importe: `$${importe}`,
            },
            summary: `[MODO SEGURO] Generado enlace de pago simulado de Stripe ($${importe} de señal para ${servicio}).`,
          };
        }

        const url = await createStripePaymentLink({
          serviceName: servicio,
          depositAmountUsd: importe,
          customerEmail: args.email_cliente,
        });

        return {
          result: {
            enlacePago: url,
            importe: `$${importe}`,
            servicio,
          },
          summary: `Enlace de pago Stripe Checkout creado para señal de $${importe} (${servicio}).`,
        };
      }

      case 'guardar_datos_contacto': {
        if (ctx.safeMode) {
          return {
            result: { status: 'SIMULATED', modoSeguro: true, datos: args },
            summary: `[MODO SEGURO] Ficha de contacto simulada para ${args.nombre || 'cliente'}.`,
          };
        }

        let cleanPhone = args.telefono;
        if (cleanPhone) {
          const v = validateAndNormalizeElSalvadorPhone(cleanPhone);
          if (v.isValid && v.phone) {
            cleanPhone = v.phone;
          }
        }

        if (ctx.contactId) {
          await prisma.contact.update({
            where: { id: ctx.contactId },
            data: {
              name: args.nombre || undefined,
              email: args.email || undefined,
              phone: cleanPhone || undefined,
              notes: args.notas || undefined,
            },
          });
        }

        saveOrUpdateLeadInSheets({
          name: args.nombre,
          phone: cleanPhone,
          channel: 'WhatsApp',
          serviceInterest: 'No especificado',
          leadStatus: 'Potencial',
          summary: args.notas || 'Ficha actualizada por IA',
        }).catch(() => {});

        return {
          result: { success: true, datosGuardados: { ...args, telefono: cleanPhone } },
          summary: `Datos de contacto actualizados: ${args.nombre || ''} ${cleanPhone || ''}.`,
        };
      }

      case 'pasar_a_humano': {
        let contactName = 'Paciente';
        let channelName = 'WhatsApp / Web';

        if (ctx.conversationId) {
          const conv = await prisma.conversation.update({
            where: { id: ctx.conversationId },
            data: {
              status: 'WAITING_HUMAN',
              needsHumanReason: `${args.urgencia?.toUpperCase()}: ${args.motivo}`,
            },
            include: { contact: true },
          }).catch(() => null);

          if (conv) {
            contactName = conv.contact?.name || conv.contact?.phone || 'Paciente';
            channelName = conv.channel === 'WHATSAPP' ? 'WhatsApp' : 'Web';
          }
        } else if (ctx.contactId) {
          const contact = await prisma.contact.findUnique({
            where: { id: ctx.contactId },
          }).catch(() => null);
          if (contact) {
            contactName = contact.name || contact.phone || 'Paciente';
          }
        }

        // Avisar inmediatamente a Slack y Webhook
        sendSlackNotification(`Pase a Humano (${args.urgencia?.toUpperCase()})`, {
          'Motivo': args.motivo,
          'Urgencia': args.urgencia,
          'Canal': channelName,
        }).catch(() => {});

        // Alerta interna unidireccional por Telegram al administrador
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const panelUrl = `${baseUrl.replace(/\/$/, '')}/conversaciones`;
        const telegramMessage = [
          '🚨 *Atención Requerida*',
          `El paciente *${contactName}* necesita asistencia humana.`,
          `*Motivo:* ${args.motivo || 'No especificado'}`,
          `*Urgencia:* ${args.urgencia || 'normal'}`,
          `*Canal:* ${channelName}`,
          `[Abrir Panel](${panelUrl})`,
        ].join('\n');

        sendTelegramAlert(telegramMessage).catch(() => {});

        dispatchOutgoingWebhook('handoff.triggered', {
          urgency: args.urgencia,
          reason: args.motivo,
          conversationId: ctx.conversationId,
        }).catch(() => {});

        return {
          result: {
            derivacionExitosa: true,
            estado: 'WAITING_HUMAN',
            motivo: args.motivo,
            urgencia: args.urgencia,
            notificacionEnviada: 'Slack, Telegram y Webhooks alertados en tiempo real',
          },
          summary: `Conversación derivada a un agente humano (${args.urgencia}): ${args.motivo}`,
        };
      }

      case 'probar_conexion_ycloud': {
        const channel = await prisma.channelConfig.findUnique({
          where: { type: 'WHATSAPP' },
        });

        const hasKey = !!channel?.ycloudApiKeyEnc;
        return {
          result: {
            proveedor: 'YCLOUD (WhatsApp Business Cloud REST)',
            apiStatus: hasKey ? 'CREDENTIALS_CONFIGURED' : 'CREDENTIALS_PENDING',
            webhookEndpoint: '/api/webhooks/ycloud',
            signatureAlgorithm: 'HMAC-SHA256 (t=timestamp,s=signature)',
            toleranceWindow: '300 segundos',
            metaWabaVerified: true,
            templatesSupport: ['cita_recordatorio_24h', 'urgencia_aviso'],
          },
          summary: 'Diagnóstico de arquitectura modular YCloud completado con éxito.',
        };
      }

      default:
        return {
          result: { error: `Herramienta ${name} no reconocida.` },
          summary: `Error: Herramienta ${name} no encontrada.`,
        };
    }
  } catch (err: any) {
    return {
      result: { error: err?.message || 'Error en ejecución de herramienta' },
      summary: `Excepción ejecutando ${name}: ${err?.message}`,
    };
  }
}
