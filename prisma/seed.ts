import { PrismaClient, Role, ChannelType, WhatsAppProvider, ConnectionStatus, ConversationStatus, MessageSender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando semilla de datos para Atendia Demo Studio (daniautoma)...');

  // 1. Usuarios: Administrador y Agente de Soporte
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@demo.daniautoma.cloud';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234password';
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: Role.ADMIN },
    create: {
      email: adminEmail,
      name: 'Administrador Demo',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });
  console.log(`✓ Administrador verificado: ${admin.email}`);

  const agentEmail = 'agente@demo.daniautoma.cloud';
  const agentPassword = 'agente1234password';
  const agentHash = await bcrypt.hash(agentPassword, 10);

  const agent = await prisma.user.upsert({
    where: { email: agentEmail },
    update: { passwordHash: agentHash, role: Role.AGENT },
    create: {
      email: agentEmail,
      name: 'Carlos Martínez (Agente Demo)',
      passwordHash: agentHash,
      role: Role.AGENT,
    },
  });
  console.log(`✓ Agente de soporte verificado: ${agent.email}`);

  // 2. Perfil del Negocio (Atendia Demo Studio - daniautoma)
  const business = await prisma.businessProfile.upsert({
    where: { id: 'default-business' },
    update: {
      name: 'Atendia Demo Studio',
      activity: 'Demostración de Asistente de IA Omnicanal y Agendamiento Automatizado',
      address: 'Entorno de Prueba en Vivo de daniautoma',
      phone: '+503 2200 1234',
      website: 'https://demo.daniautoma.cloud',
      timezone: 'America/El_Salvador',
      agencyName: 'daniautoma',
      assistantActive: true,
    },
    create: {
      id: 'default-business',
      name: 'Atendia Demo Studio',
      activity: 'Demostración de Asistente de IA Omnicanal y Agendamiento Automatizado',
      address: 'Entorno de Prueba en Vivo de daniautoma',
      phone: '+503 2200 1234',
      website: 'https://demo.daniautoma.cloud',
      timezone: 'America/El_Salvador',
      assistantActive: true,
      agencyName: 'daniautoma',
    },
  });
  console.log(`✓ Perfil de negocio verificado: ${business.name} (${business.agencyName})`);

  // 3. Configuración del Asistente (Valentina)
  const businessHours = {
    monday: { open: '08:00', close: '18:00', enabled: true },
    tuesday: { open: '08:00', close: '18:00', enabled: true },
    wednesday: { open: '08:00', close: '18:00', enabled: true },
    thursday: { open: '08:00', close: '18:00', enabled: true },
    friday: { open: '08:00', close: '18:00', enabled: true },
    saturday: { open: '08:00', close: '14:00', enabled: true },
    sunday: { open: '00:00', close: '00:00', enabled: false },
  };

  const handoffRules = {
    onComplaint: true,
    onUrgency: true,
    onHumanRequest: true,
    onUnknownAnswer: true,
    customRule: 'Si el cliente solicita un desarrollo a la medida o integración personalizada fuera del catálogo.',
  };

  const assistantConfig = await prisma.assistantConfig.upsert({
    where: { id: 'default-assistant' },
    update: {
      name: 'Valentina (Asistente Virtual Demo)',
      avatarUrl: null,
      tone: 'cercano',
      welcomeMessage: '¡Hola! Soy Valentina, tu asistente virtual de demostración desarrollado por daniautoma. Estoy aquí para mostrarte cómo la IA puede atender consultas 24/7, calificar prospectos y agendar citas en tiempo real. ¿En qué puedo ayudarte hoy?',
      customInstructions: 'Eres Valentina, un asistente virtual de demostración desarrollado por daniautoma. Tu función es mostrar a los clientes potenciales cómo la inteligencia artificial puede atender consultas 24/7, calificar prospectos y agendar citas en un calendario interactivo. Responde de forma amable, clara e invita al usuario a probar las capacidades del sistema.',
      neverDoList: 'No dar información engañosa o no validada. No confirmar citas fuera del horario permitido sin validarlo. Mantener siempre un tono profesional, cordial y de demostración tecnológica.',
      businessHours,
      outsideHoursBehavior: 'APPOINTMENT_OR_MESSAGE',
      handoffRules,
      aiModel: 'openai/gpt-4o-mini',
      aiModelFallback: 'openai/gpt-4o-mini',
      systemPromptOverride: null,
    },
    create: {
      id: 'default-assistant',
      name: 'Valentina (Asistente Virtual Demo)',
      avatarUrl: null,
      tone: 'cercano',
      welcomeMessage: '¡Hola! Soy Valentina, tu asistente virtual de demostración desarrollado por daniautoma. Estoy aquí para mostrarte cómo la IA puede atender consultas 24/7, calificar prospectos y agendar citas en tiempo real. ¿En qué puedo ayudarte hoy?',
      customInstructions: 'Eres Valentina, un asistente virtual de demostración desarrollado por daniautoma. Tu función es mostrar a los clientes potenciales cómo la inteligencia artificial puede atender consultas 24/7, calificar prospectos y agendar citas en un calendario interactivo. Responde de forma amable, clara e invita al usuario a probar las capacidades del sistema.',
      neverDoList: 'No dar información engañosa o no validada. No confirmar citas fuera del horario permitido sin validarlo. Mantener siempre un tono profesional, cordial y de demostración tecnológica.',
      businessHours,
      outsideHoursBehavior: 'APPOINTMENT_OR_MESSAGE',
      handoffRules,
      aiModel: 'openai/gpt-4o-mini',
      aiModelFallback: 'openai/gpt-4o-mini',
      systemPromptOverride: null,
    },
  });
  console.log(`✓ Asistente configurado: ${assistantConfig.name}`);

  // 4. Servicios de demostración multipropósito
  // Limpiar servicios anteriores si los hubiese para mantener el catálogo limpio
  await prisma.service.deleteMany({});

  const services = [
    {
      name: 'Consulta / Valoración Inicial (30 min)',
      description: 'Sesión inicial de evaluación y asesoría general para conocer las necesidades de tu negocio y explorar soluciones con IA.',
      durationMinutes: 30,
      price: 0,
      isPriceFrom: false,
      requiresEvaluation: false,
    },
    {
      name: 'Reserva de Cita de Servicio (45 min)',
      description: 'Sesión personalizada de atención especializada para definir alcance y requerimientos específicos de tu empresa.',
      durationMinutes: 45,
      price: 50,
      isPriceFrom: false,
      requiresEvaluation: false,
    },
    {
      name: 'Demostración Técnica de Integración con n8n',
      description: 'Muestrario práctico en vivo de flujos de trabajo, automatización omnicanal, webhooks y conexión con n8n.',
      durationMinutes: 45,
      price: 0,
      isPriceFrom: false,
      requiresEvaluation: false,
    },
  ];

  for (const s of services) {
    await prisma.service.create({ data: s });
  }
  console.log(`✓ ${services.length} servicios de demostración registrados.`);

  // 5. Preguntas Frecuentes de Demostración
  await prisma.faq.deleteMany({});

  const faqs = [
    {
      question: '¿Qué es Atendia Demo Studio?',
      answer: 'Es un entorno de demostración en vivo desarrollado por daniautoma para mostrar cómo un asistente de IA atiende clientes 24/7 por WhatsApp y Web, califica prospectos y agenda citas en tiempo real.',
    },
    {
      question: '¿Cómo funciona la reserva de citas en tiempo real?',
      answer: 'El asistente consulta la disponibilidad directamente en el calendario interactivo y sincroniza la cita con Google Calendar, enviando confirmaciones inmediatas por correo y WhatsApp.',
    },
    {
      question: '¿Se puede integrar con plataformas como n8n o Make?',
      answer: 'Sí. Atendia cuenta con un motor de webhooks salientes firmados con HMAC-SHA256 que disparan eventos instantáneos hacia flujos en n8n, Make o tu propio CRM.',
    },
    {
      question: '¿Qué canales de mensajería están soportados?',
      answer: 'Soporta WhatsApp con conexión dual (código QR con Baileys o API oficial empresarial con YCloud) y un Widget de Chat Web integrable en cualquier sitio web.',
    },
    {
      question: '¿Cómo interviene un agente humano si es necesario?',
      answer: 'Cuando el usuario solicita hablar con una persona o se detecta una consulta no contemplada, el asistente cede el control inmediatamente activando el modo de espera humana en el panel.',
    },
  ];

  for (const f of faqs) {
    await prisma.faq.create({ data: f });
  }
  console.log(`✓ ${faqs.length} preguntas frecuentes registradas.`);

  // 6. Canales iniciales
  await prisma.channelConfig.upsert({
    where: { type: ChannelType.WHATSAPP },
    update: {
      waBusinessName: 'Atendia Demo Studio',
    },
    create: {
      type: ChannelType.WHATSAPP,
      waProvider: WhatsAppProvider.BAILEYS,
      waStatus: ConnectionStatus.DISCONNECTED,
      waBusinessName: 'Atendia Demo Studio',
      baileysSessionDir: process.env.WHATSAPP_SESSION_DIR || './whatsapp-session',
    },
  });

  await prisma.channelConfig.upsert({
    where: { type: ChannelType.WEB },
    update: {
      webChatEnabled: true,
      webChatColor: '#2563eb',
      webChatTitle: 'Valentina | Asistente Virtual Demo',
      webChatWelcome: '¡Hola! Soy Valentina, asistente virtual de demostración desarrollado por daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?',
    },
    create: {
      type: ChannelType.WEB,
      webChatEnabled: true,
      webChatColor: '#2563eb',
      webChatTitle: 'Valentina | Asistente Virtual Demo',
      webChatWelcome: '¡Hola! Soy Valentina, asistente virtual de demostración desarrollado por daniautoma. ¿Te gustaría agendar una cita o conocer nuestras automatizaciones?',
    },
  });
  console.log('✓ Canales de WhatsApp y Web Chat inicializados con tema azul moderno.');

  // 7. Integraciones
  const integrations = [
    { provider: 'google_calendar', name: 'Google Calendar' },
    { provider: 'gmail', name: 'Gmail' },
    { provider: 'google_sheets', name: 'Google Sheets' },
    { provider: 'slack', name: 'Slack' },
    { provider: 'stripe', name: 'Stripe' },
    { provider: 'webhooks', name: 'Webhooks Salientes' },
  ];

  for (const intg of integrations) {
    await prisma.integration.upsert({
      where: { provider: intg.provider },
      update: {},
      create: {
        provider: intg.provider,
        name: intg.name,
        enabled: false,
        config: {},
      },
    });
  }
  console.log('✓ 6 integraciones del catálogo inicializadas.');

  // 8. Contacto y Conversaciones de ejemplo
  const contact1 = await prisma.contact.upsert({
    where: { phone: '+50371234567' },
    update: {
      name: 'Elena Rodríguez',
      notes: 'Interesada en demostración de automatización con n8n y agendamiento IA.',
    },
    create: {
      name: 'Elena Rodríguez',
      phone: '+50371234567',
      email: 'elena.rodriguez@ejemplo.com',
      notes: 'Interesada en demostración de automatización con n8n y agendamiento IA.',
    },
  });

  const conv1 = await prisma.conversation.upsert({
    where: { id: 'sample-conv-1' },
    update: {},
    create: {
      id: 'sample-conv-1',
      contactId: contact1.id,
      channel: ChannelType.WEB,
      waProvider: WhatsAppProvider.BAILEYS,
      status: ConversationStatus.BOT_ACTIVE,
      lastMessageAt: new Date(),
    },
  });

  const msgCount = await prisma.message.count({ where: { conversationId: conv1.id } });
  if (msgCount === 0) {
    await prisma.message.createMany({
      data: [
        {
          conversationId: conv1.id,
          sender: MessageSender.CUSTOMER,
          text: 'Hola, me gustaría agendar una sesión de demostración de integración con n8n.',
          createdAt: new Date(Date.now() - 3600000 * 2),
        },
        {
          conversationId: conv1.id,
          sender: MessageSender.ASSISTANT,
          text: '¡Hola Elena! Con gusto. En Atendia Demo Studio contamos con la sesión "Demostración Técnica de Integración con n8n" de 45 minutos sin costo. ¿Qué día y horario te conviene para coordinar la cita?',
          createdAt: new Date(Date.now() - 3600000 * 2 + 10000),
        },
        {
          conversationId: conv1.id,
          sender: MessageSender.CUSTOMER,
          text: '¿Tienen espacio este próximo jueves por la mañana?',
          createdAt: new Date(Date.now() - 3600000),
        },
      ],
    });
  }

  console.log('✓ Conversaciones de ejemplo creadas.');
  console.log('Semilla de datos completada con éxito.');
}

main()
  .catch((e) => {
    console.error('Error al ejecutar la semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
