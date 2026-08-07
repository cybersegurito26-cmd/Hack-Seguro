// Mock data for Hack-Seguro Phase 1 (frontend only)
// Shapes are intentionally designed to map cleanly onto future FastAPI endpoints.
// Endpoints suggested (future): GET /api/modules, GET /api/lessons/:id, POST /api/progress ...

export type ProfileType = "nino" | "adolescente" | "padre" | "adulto";

export const PROFILES: { id: ProfileType; label: string; icon: string; color: string; desc: string }[] = [
  { id: "nino", label: "Niño / Estudiante", icon: "school", color: "#3B82F6", desc: "6 a 12 años" },
  { id: "adolescente", label: "Adolescente", icon: "game-controller", color: "#8B5CF6", desc: "13 a 17 años" },
  { id: "padre", label: "Padre / Madre", icon: "people", color: "#16A34A", desc: "Cuida a tu familia" },
  { id: "adulto", label: "Adulto Mayor", icon: "heart", color: "#F59E0B", desc: "Aprende con calma" },
];

export type LessonKind = "quiz" | "truefalse" | "spot" | "order";

export type LessonStep = {
  kind: LessonKind;
  prompt: string;
  context?: string; // scam text or scenario
  options?: string[];
  correctIndex?: number;
  correctIndexes?: number[]; // for "spot" multi-answer or "order"
  explanation: string;
};

export type Module = {
  id: string;
  title: string;
  subtitle: string;
  icon: string; // ionicons name
  color: string;
  lessons: LessonStep[];
};

export const MODULES: Module[] = [
  {
    id: "passwords",
    title: "Contraseñas seguras",
    subtitle: "Crea claves que nadie adivine",
    icon: "lock-closed",
    color: "#00357a",
    lessons: [
      {
        kind: "quiz",
        prompt: "¿Cuál es la contraseña MÁS segura?",
        options: ["123456", "Miguel2010", "P3rr0!Az*L2029", "contraseña"],
        correctIndex: 2,
        explanation: "Una contraseña fuerte combina mayúsculas, minúsculas, números y símbolos, con al menos 12 caracteres.",
      },
      {
        kind: "truefalse",
        prompt: "Puedo usar la misma contraseña en todas mis cuentas si es larga.",
        options: ["Verdadero", "Falso"],
        correctIndex: 1,
        explanation: "Si un servicio se filtra, todas tus cuentas quedan expuestas. Usa una contraseña única por cuenta.",
      },
      {
        kind: "quiz",
        prompt: "¿Qué debes activar además de tu contraseña?",
        options: ["Modo avión", "Verificación en dos pasos (2FA)", "Modo oscuro", "Bluetooth"],
        correctIndex: 1,
        explanation: "La verificación en dos pasos añade una capa extra: aunque roben tu clave, no podrán entrar sin el código.",
      },
    ],
  },
  {
    id: "phishing",
    title: "Phishing",
    subtitle: "Detecta mensajes trampa",
    icon: "fish",
    color: "#0891B2",
    lessons: [
      {
        kind: "spot",
        prompt: "¿Este SMS es un intento de fraude?",
        context: "ESTAFETA: Tu paquete está detenido. Paga $28 MXN para liberarlo: http://estafet4-mx.co/pagar",
        options: ["Es fraude (phishing)", "Es un aviso real"],
        correctIndex: 0,
        explanation: "Las paqueterías oficiales nunca piden pagos por SMS con enlaces sospechosos. Fíjate en el dominio 'estafet4-mx.co': no es oficial.",
      },
      {
        kind: "quiz",
        prompt: "Recibes un correo del banco pidiendo tu NIP. ¿Qué haces?",
        options: ["Se lo envío por si es urgente", "Llamo al banco desde el número de la tarjeta", "Respondo con mis datos", "Reenvío a mis contactos"],
        correctIndex: 1,
        explanation: "Ningún banco en México pide NIP, CVV o contraseñas por correo. Siempre verifica llamando al número oficial de tu tarjeta.",
      },
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp seguro",
    subtitle: "Protégete de estafas y suplantación",
    icon: "logo-whatsapp",
    color: "#16A34A",
    lessons: [
      {
        kind: "spot",
        prompt: "Detecta el fraude en este mensaje:",
        context: "Hola mamá, este es mi nuevo número. Perdí mi teléfono. ¿Me puedes prestar $2,500? Te pago mañana.",
        options: ["Es un fraude clásico", "Es un mensaje normal"],
        correctIndex: 0,
        explanation: "Los estafadores fingen ser familiares desde un número desconocido. Siempre confirma llamando al número real de la persona.",
      },
      {
        kind: "truefalse",
        prompt: "Debo activar la verificación en dos pasos en WhatsApp.",
        options: ["Verdadero", "Falso"],
        correctIndex: 0,
        explanation: "Sí. Ajustes → Cuenta → Verificación en dos pasos. Evita que roben tu WhatsApp aunque te copien el código SMS.",
      },
    ],
  },
  {
    id: "redes",
    title: "Redes sociales",
    subtitle: "Cuida lo que compartes",
    icon: "people-circle",
    color: "#EC4899",
    lessons: [
      {
        kind: "quiz",
        prompt: "¿Qué NO debes publicar en tus redes?",
        options: ["Tu comida", "Tu domicilio y horarios", "Un paisaje", "Tu mascota"],
        correctIndex: 1,
        explanation: "Compartir tu dirección o rutinas facilita robos y acoso. Cuida tu privacidad.",
      },
    ],
  },
  {
    id: "videojuegos",
    title: "Videojuegos seguros",
    subtitle: "Juega sin riesgos",
    icon: "game-controller",
    color: "#8B5CF6",
    lessons: [
      {
        kind: "truefalse",
        prompt: "Puedo aceptar 'V-Bucks gratis' que me ofrece un desconocido.",
        options: ["Verdadero", "Falso"],
        correctIndex: 1,
        explanation: "Las ofertas de monedas gratis dentro del juego suelen robar tu cuenta. Nunca compartas tu contraseña.",
      },
    ],
  },
  {
    id: "bancos",
    title: "Fraudes bancarios",
    subtitle: "Detecta suplantación de bancos",
    icon: "card",
    color: "#059669",
    lessons: [
      {
        kind: "spot",
        prompt: "¿Es fraude?",
        context: "BBVA: Detectamos un cargo por $8,999. Si NO fuiste tú, cancela aquí: https://bbva-cancelar.mx-secure.info",
        options: ["Sí, es fraude", "Es aviso oficial"],
        correctIndex: 0,
        explanation: "Los enlaces oficiales de BBVA usan bbva.mx. El dominio 'mx-secure.info' es falso y busca robar tus datos.",
      },
    ],
  },
  {
    id: "compras",
    title: "Compras en línea",
    subtitle: "Marketplace sin fraudes",
    icon: "cart",
    color: "#F59E0B",
    lessons: [
      {
        kind: "quiz",
        prompt: "En Marketplace, un iPhone 15 nuevo cuesta $3,000 y piden depósito por adelantado. ¿Qué haces?",
        options: ["Deposito rápido antes que suba", "Descarto: es fraude", "Le doy mi INE", "Le doy mi domicilio"],
        correctIndex: 1,
        explanation: "Precios demasiado bajos y depósitos por adelantado son señales claras de fraude. Compra en persona en lugares seguros.",
      },
    ],
  },
  {
    id: "privacidad",
    title: "Privacidad digital",
    subtitle: "Controla tus datos",
    icon: "shield-checkmark",
    color: "#0EA5E9",
    lessons: [
      {
        kind: "truefalse",
        prompt: "Debo revisar los permisos de las apps que instalo.",
        options: ["Verdadero", "Falso"],
        correctIndex: 0,
        explanation: "Muchas apps piden acceso a cámara, contactos o ubicación sin necesitarlo. Revisa y niega lo que no haga falta.",
      },
    ],
  },
  {
    id: "ia",
    title: "IA segura",
    subtitle: "Usa la inteligencia artificial con cuidado",
    icon: "sparkles",
    color: "#7C3AED",
    lessons: [
      {
        kind: "quiz",
        prompt: "¿Qué NO debes darle a un chatbot de IA?",
        options: ["Una pregunta escolar", "Tu CURP y datos bancarios", "Una receta", "Un chiste"],
        correctIndex: 1,
        explanation: "Nunca compartas información personal sensible (CURP, tarjetas, contraseñas) con un chatbot.",
      },
    ],
  },
  {
    id: "ciberacoso",
    title: "Ciberacoso y denuncia",
    subtitle: "No estás solo",
    icon: "megaphone",
    color: "#EF4444",
    lessons: [
      {
        kind: "quiz",
        prompt: "Si sufres ciberacoso, ¿qué es lo PRIMERO que debes hacer?",
        options: ["Responder con enojo", "Guardar capturas y contárselo a un adulto de confianza", "Borrar todo", "Publicarlo"],
        correctIndex: 1,
        explanation: "Guarda las pruebas y busca ayuda. En México puedes denunciar en la Policía Cibernética: 088.",
      },
    ],
  },
];

export type Badge = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  unlocked: boolean;
};

export const BADGES: Badge[] = [
  { id: "detective", name: "Detective Digital", icon: "search", color: "#00357a", desc: "Detecta 5 fraudes", unlocked: true },
  { id: "guardian", name: "Guardián de Contraseñas", icon: "key", color: "#F59E0B", desc: "Completa el módulo de contraseñas", unlocked: false },
  { id: "phishcazador", name: "Cazador de Phishing", icon: "fish", color: "#0891B2", desc: "Domina el módulo de phishing", unlocked: false },
  { id: "escudo", name: "Escudo de Familia", icon: "shield-checkmark", color: "#16A34A", desc: "Completa 3 módulos", unlocked: false },
  { id: "racha7", name: "Racha de 7 días", icon: "flame", color: "#F97316", desc: "Practica 7 días seguidos", unlocked: false },
  { id: "maestro", name: "Maestro Ciber", icon: "trophy", color: "#EAB308", desc: "Completa todos los módulos", unlocked: false },
  { id: "embajador_digital", name: "Embajador Digital", icon: "megaphone", color: "#0EA5E9", desc: "Invita a 3 amigos que completen una lección", unlocked: false },
  { id: "embajador_oro", name: "Embajador de Oro", icon: "medal", color: "#D0E80B", desc: "Invita a 10 amigos que completen una lección", unlocked: false },
];

export type GameCard = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
  xp: number;
};

export const GAMES: GameCard[] = [
  { id: "fraude", title: "¿Fraude o Real?", subtitle: "Desliza y decide", icon: "swap-horizontal", color: "#EF4444", route: "/game/fraude-real", xp: 30 },
  { id: "memorama", title: "Memorama Ciber", subtitle: "Empareja los conceptos", icon: "grid", color: "#8B5CF6", route: "/game/memorama", xp: 25 },
  { id: "password", title: "Reto de Contraseña", subtitle: "Crea la clave más fuerte", icon: "key", color: "#F59E0B", route: "/game/password", xp: 20 },
  { id: "escape", title: "Escape del Hacker", subtitle: "Aventura de decisiones", icon: "footsteps", color: "#00357a", route: "/game/escape", xp: 40 },
];

export type DailyChallenge = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  xp: number;
  done: boolean;
};

export const DAILY_CHALLENGES: DailyChallenge[] = [
  { id: "d1", title: "Detecta un phishing", desc: "Completa 1 reto de detectar fraudes", icon: "fish", xp: 20, done: false },
  { id: "d2", title: "Cambia una contraseña débil", desc: "Prueba el Reto de Contraseña", icon: "key", xp: 15, done: false },
  { id: "d3", title: "Aprende algo nuevo", desc: "Completa 1 lección", icon: "book", xp: 25, done: false },
];

// CiberBot: pre-scripted, no LLM. Keyword-based responses in Spanish.
export type BotIntent = {
  keywords: string[];
  response: string;
};

export const BOT_QUICK_ACTIONS = [
  "Revisar mensaje sospechoso",
  "Crear contraseña segura",
  "Qué hacer si me hackearon",
  "Configurar mi privacidad",
];

export const BOT_INTENTS: BotIntent[] = [
  {
    keywords: ["hola", "buenas", "saludos", "hi"],
    response: "¡Hola! Soy CiberBot 🛡️. Estoy aquí para ayudarte a estar seguro en internet. ¿Sobre qué tema quieres aprender hoy?",
  },
  {
    keywords: ["contraseña", "clave", "password", "crear contraseña"],
    response: "Una buena contraseña tiene al menos 12 caracteres, mezcla mayúsculas, minúsculas, números y símbolos. Ejemplo: G4t0!Az*L_2029. Nunca la compartas y usa una diferente por cada cuenta.",
  },
  {
    keywords: ["phishing", "sospechoso", "revisar mensaje", "fraude", "estafa"],
    response: "Para revisar un mensaje sospechoso fíjate en: 1) El remitente y el dominio, 2) Errores ortográficos, 3) Urgencia ('ahora o nunca'), 4) Enlaces raros. Si sospechas: NO hagas clic, NO compartas datos.",
  },
  {
    keywords: ["hackearon", "hackeado", "robaron", "cuenta robada"],
    response: "Actúa así: 1) Cambia la contraseña desde otro dispositivo, 2) Activa verificación en dos pasos, 3) Cierra sesión en todos los dispositivos, 4) Avisa a tus contactos, 5) Denuncia en la Policía Cibernética: 088.",
  },
  {
    keywords: ["privacidad", "datos", "configurar privacidad"],
    response: "Para proteger tu privacidad: revisa los permisos de tus apps, pon tus redes en privado, no compartas ubicación en tiempo real y activa la verificación en dos pasos en todas tus cuentas importantes.",
  },
  {
    keywords: ["whatsapp", "wasap"],
    response: "En WhatsApp: activa la verificación en dos pasos (Ajustes → Cuenta), no aceptes archivos raros, desconfía de familiares que escriben desde un número nuevo pidiendo dinero.",
  },
  {
    keywords: ["banco", "bancario", "transferencia"],
    response: "Ningún banco pide NIP, CVV ni contraseñas por SMS, WhatsApp o correo. Si dudas, cuelga y llama al número atrás de tu tarjeta. En México también puedes reportar a CONDUSEF.",
  },
  {
    keywords: ["denuncia", "denunciar", "reportar"],
    response: "En México puedes denunciar ciberdelitos en: Policía Cibernética (088), CONDUSEF si es bancario, o cert-mx@sspc.gob.mx. Guarda capturas de pantalla como evidencia.",
  },
  {
    keywords: ["ciberacoso", "acoso", "bullying"],
    response: "No estás solo. Guarda capturas de todo, no respondas al acosador, bloquéalo y cuéntaselo a un adulto de confianza. En México llama a la línea 088 (Policía Cibernética).",
  },
];

export const BOT_DEFAULT =
  "No estoy seguro de entender esa pregunta 🤔. Prueba con temas como 'contraseñas', 'phishing', 'WhatsApp' o toca uno de los botones rápidos.";

// Game data
export const FRAUD_CARDS: { id: string; text: string; isFraud: boolean; explanation: string }[] = [
  {
    id: "f1",
    text: "SEP: ¡Felicidades! Ganaste una Beca Benito Juárez extra. Deposita $500 de trámite a esta cuenta para liberarla.",
    isFraud: true,
    explanation: "Las becas oficiales NUNCA piden dinero por adelantado. Es un fraude clásico en México.",
  },
  {
    id: "f2",
    text: "Amazon: Tu pedido #A28311 será entregado hoy entre 3-5 pm.",
    isFraud: false,
    explanation: "Es un aviso normal de entrega, sin pedir datos ni pagos.",
  },
  {
    id: "f3",
    text: "Netflix: Tu cuenta será suspendida. Actualiza tu tarjeta aquí: netflix-mx.pago-secure.com",
    isFraud: true,
    explanation: "El dominio real es netflix.com. 'pago-secure.com' es phishing.",
  },
  {
    id: "f4",
    text: "Bienestar: El pago del próximo bimestre estará disponible el 5 de marzo.",
    isFraud: false,
    explanation: "Es un aviso informativo que no pide datos personales ni pagos.",
  },
  {
    id: "f5",
    text: "Tu tío te escribe desde un número nuevo: 'Sobrino, préstame $3,000 urgente, ya te pago mañana'.",
    isFraud: true,
    explanation: "Fraude de suplantación familiar. Verifica llamando al número real de tu tío.",
  },
  {
    id: "f6",
    text: "CFE: Tu recibo está listo. Consulta en cfe.mx con tu número de servicio.",
    isFraud: false,
    explanation: "Aviso legítimo que redirige al sitio oficial cfe.mx.",
  },
];

export const MEMORY_PAIRS = [
  { id: "p1", concept: "Contraseña fuerte", match: "12+ caracteres" },
  { id: "p2", concept: "2FA", match: "Doble verificación" },
  { id: "p3", concept: "Phishing", match: "Mensaje trampa" },
  { id: "p4", concept: "Denuncia 088", match: "Policía Cibernética" },
  { id: "p5", concept: "HTTPS", match: "Conexión segura" },
  { id: "p6", concept: "Antivirus", match: "Protección" },
];

// Escape del Hacker: narrative decisions
export type EscapeNode = {
  id: string;
  text: string;
  options: { label: string; next: string; correct?: boolean; feedback?: string }[];
};

export const ESCAPE_STORY: Record<string, EscapeNode> = {
  start: {
    id: "start",
    text: "Recibes un WhatsApp: 'Mamá, este es mi nuevo número, préstame $2,000 urgente'. ¿Qué haces?",
    options: [
      { label: "Deposito el dinero de inmediato", next: "fail1", correct: false, feedback: "¡Cuidado! Es una estafa muy común." },
      { label: "Llamo al número real de mi hijo para confirmar", next: "step2", correct: true, feedback: "¡Correcto! Verificar es clave." },
    ],
  },
  step2: {
    id: "step2",
    text: "Bien hecho. Luego, ves un correo del 'banco' pidiendo que actualices tu NIP. ¿Qué haces?",
    options: [
      { label: "Envío mi NIP para no perder la cuenta", next: "fail2", correct: false, feedback: "Ningún banco pide NIP por correo." },
      { label: "Ignoro el correo y llamo al banco desde el número oficial", next: "step3", correct: true, feedback: "Perfecto." },
    ],
  },
  step3: {
    id: "step3",
    text: "Finalmente, alguien te ofrece 'V-Bucks gratis' en un juego pidiendo tu contraseña. ¿Qué respondes?",
    options: [
      { label: "Se la doy, total, es un juego", next: "fail3", correct: false, feedback: "Nunca compartas contraseñas." },
      { label: "Rechazo y reporto al usuario", next: "win", correct: true, feedback: "¡Ganaste!" },
    ],
  },
  fail1: {
    id: "fail1",
    text: "Perdiste $2,000 en una estafa. Recuerda: siempre verifica llamando al número real. ¿Quieres intentarlo de nuevo?",
    options: [{ label: "Reintentar", next: "start" }],
  },
  fail2: {
    id: "fail2",
    text: "Un ciberdelincuente vació tu cuenta. Aprende: los bancos nunca piden NIP por correo. ¿Reintentar?",
    options: [{ label: "Reintentar", next: "start" }],
  },
  fail3: {
    id: "fail3",
    text: "Perdiste tu cuenta del juego. Las contraseñas son solo para ti. ¿Reintentar?",
    options: [{ label: "Reintentar", next: "start" }],
  },
  win: {
    id: "win",
    text: "🎉 ¡Escapaste del hacker! Tomaste 3 decisiones seguras y ganaste 40 XP + 20 CiberMonedas.",
    options: [{ label: "Volver a juegos", next: "start" }],
  },
};
