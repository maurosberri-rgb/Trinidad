import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getDB } from "./store.js";

export type Rol = "admin" | "familia";
export interface Sesion { rol: Rol; id: string }

const DURACION_MS = 1000 * 60 * 60 * 12;

const firmar = (cuerpo: string) => crypto.createHmac("sha256", getDB().secreto).update(cuerpo).digest("base64url");

export function crearToken(s: Sesion): string {
  const cuerpo = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + DURACION_MS })).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function leerToken(token: string | undefined): Sesion | null {
  if (!token) return null;
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;
  const esperada = firmar(cuerpo);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  try {
    const p = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as Sesion & { exp: number };
    if (p.exp < Date.now()) return null;
    return { rol: p.rol, id: p.id };
  } catch {
    return null;
  }
}

declare module "express-serve-static-core" {
  interface Request { sesion?: Sesion }
}

export const requiere = (rol: Rol) => (req: Request, res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  const s = leerToken(h?.startsWith("Bearer ") ? h.slice(7) : (req.query.t as string | undefined));
  if (!s || s.rol !== rol) return res.status(401).json({ error: "Sesión vencida o sin permiso. Volvé a ingresar." });
  req.sesion = s;
  next();
};

// Freno a intentos repetidos: 6 fallos seguidos bloquean esa clave de acceso por 10 minutos.
const intentos = new Map<string, { n: number; hasta: number }>();
export function bloqueado(clave: string): number {
  const i = intentos.get(clave);
  return i && i.n >= 6 && i.hasta > Date.now() ? Math.ceil((i.hasta - Date.now()) / 60000) : 0;
}
export function falla(clave: string) {
  const i = intentos.get(clave);
  const ahora = Date.now();
  if (!i || i.hasta < ahora) intentos.set(clave, { n: 1, hasta: ahora + 10 * 60000 });
  else { i.n += 1; i.hasta = ahora + 10 * 60000; }
}
export const exito = (clave: string) => intentos.delete(clave);
