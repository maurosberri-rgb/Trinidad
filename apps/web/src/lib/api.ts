const CLAVE = "trinidad.sesion";

export interface SesionGuardada { rol: "admin" | "familia"; token: string; nombre: string; debeCambiarClave?: boolean }

export const leerSesion = (): SesionGuardada | null => {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch { return null; }
};
export const guardarSesion = (s: SesionGuardada | null) => {
  try { if (s) localStorage.setItem(CLAVE, JSON.stringify(s)); else localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
};

export class ErrorApi extends Error {
  constructor(mensaje: string, public estado: number) { super(mensaje); }
}
export const mensajeError = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");

/** Llama a la API; si responde 401 fuera del login, la sesión venció y se vuelve al inicio. */
export async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const s = leerSesion();
  const r = await fetch(`/api${ruta}`, {
    method: opciones.metodo ?? (opciones.cuerpo !== undefined ? "POST" : "GET"),
    headers: { ...(opciones.cuerpo !== undefined ? { "Content-Type": "application/json" } : {}), ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && !ruta.startsWith("/auth/")) { guardarSesion(null); window.location.href = "/"; }
    throw new ErrorApi(datos.error || "No se pudo completar la operación", r.status);
  }
  return datos as T;
}

/** Descarga un archivo protegido (comprobante) y devuelve una URL temporal para mostrarlo. */
export async function archivoUrl(ruta: string): Promise<{ url: string; tipo: string }> {
  const s = leerSesion();
  const r = await fetch(`/api${ruta}`, { headers: s ? { Authorization: `Bearer ${s.token}` } : {} });
  if (!r.ok) throw new Error("No se pudo abrir el archivo");
  const b = await r.blob();
  return { url: URL.createObjectURL(b), tipo: b.type };
}
