// Publica Trinidad en Cloudflare: este Worker recibe el tráfico y lo pasa a un contenedor (el sistema completo,
// tal cual corre en la PC). Los datos NO están en el contenedor: viven en Supabase.
import { Container } from "@cloudflare/containers";

/** Variables y secretos que se le pasan al sistema (Cloudflare: Workers → trinidad → Settings → Variables y secretos). */
const PASAR = ["DATABASE_URL", "DATABASE_SSL", "ADMIN_PASSWORD"] as const;

type Entorno = { TRINIDAD: DurableObjectNamespace<Trinidad> } & Partial<Record<(typeof PASAR)[number], string>>;

export class Trinidad extends Container<Entorno> {
  defaultPort = 4500;
  // Si nadie usa el sistema durante este tiempo, el contenedor se duerme (y deja de cobrar). Se despierta solo con el próximo pedido.
  sleepAfter = "30m";

  constructor(ctx: DurableObjectState<{}>, env: Entorno) {
    super(ctx, env);
    const vars: Record<string, string> = {
      PORT: "4500",
      NODE_ENV: "production",
      TRUST_PROXY: "1",
      // Si falta DATABASE_URL, el sistema NO arranca (en vez de crear una base vacía y temporal dentro del contenedor).
      EXIGIR_DATABASE: "1",
      // En producción no se cargan los alumnos y familias de ejemplo.
      SIN_DEMO: "1",
      NODE_OPTIONS: "--max-old-space-size=700",
    };
    for (const k of PASAR) if (env[k]) vars[k] = env[k]!;
    this.envVars = vars;
  }
}

export default {
  async fetch(request: Request, env: Entorno): Promise<Response> {
    // El sistema necesita la IP real del visitante (freno de intentos de ingreso) y saber que la conexión es https.
    const headers = new Headers(request.headers);
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);
    headers.set("x-forwarded-proto", "https");
    return env.TRINIDAD.getByName("principal").fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Entorno>;
