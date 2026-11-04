import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
export const ARCHIVOS_DIR = path.join(DATA_DIR, "comprobantes");
const DB_FILE = path.join(DATA_DIR, "db.json");

// ---------- Tipos ----------
export type Nivel = "Inicial" | "Primario" | "Secundario";
export type TipoCuenta = "Activo" | "Pasivo" | "Patrimonio" | "Ingreso" | "Egreso";

export interface Cuenta { codigo: string; nombre: string; tipo: TipoCuenta; imputable: boolean }
export interface Responsable {
  id: string; dni: string; apellido: string; nombre: string; telefono: string; email: string;
  claveHash: string; debeCambiarClave: boolean; saldoAFavor: number; activo: boolean; creado: string;
}
export interface Alumno {
  id: string; dni: string; apellido: string; nombre: string; nivel: Nivel; curso: string;
  responsableIds: string[]; pagadorId: string; becaPct: number; activo: boolean;
}
export interface Concepto { id: string; nombre: string; tipo: "cuota" | "matricula" | "actividad" | "otro"; importe: number; cuenta: string; activo: boolean }
export interface Cargo {
  id: string; numero: string; alumnoId: string; responsableId: string; conceptoId: string; descripcion: string;
  periodo: string; emision: string; vencimiento: string; bruto: number; descuento: number; importe: number;
  pagado: number; anulado: boolean; cuenta: string; asientoId: string;
}
export interface Imputacion { cargoId: string; monto: number }
export interface Pago {
  id: string; numero: string; fecha: string; responsableId: string; medio: "efectivo" | "transferencia" | "otro";
  cuentaCaja: string; importe: number; imputaciones: Imputacion[]; aFavor: number; comprobanteId?: string;
  observacion: string; anulado: boolean; asientoId: string;
}
export interface Comprobante {
  id: string; responsableId: string; creado: string; fechaPago: string; importe: number; cargoIds: string[];
  archivo: { nombre: string; tipo: string; ruta: string }; nota: string;
  estado: "pendiente" | "aprobado" | "rechazado"; motivo: string; pagoId?: string; resuelto?: string;
}
export interface Gasto {
  id: string; numero: string; fecha: string; proveedor: string; cuenta: string; detalle: string; importe: number;
  medio: "caja" | "banco" | "apagar"; nroComprobante: string; anulado: boolean; asientoId: string; pagadoEn?: string;
}
export interface LineaAsiento { cuenta: string; debe: number; haber: number }
export interface Asiento {
  id: string; numero: number; fecha: string; descripcion: string;
  origen: { tipo: "cargo" | "pago" | "gasto" | "manual"; id: string }; lineas: LineaAsiento[]; anulado: boolean;
}
export interface Ajustes {
  colegio: string; cuit: string; direccion: string; telefono: string; email: string;
  banco: string; titular: string; cbu: string; alias: string; diaVencimiento: number; cicloLectivo: number;
}
export interface Admin { id: string; usuario: string; nombre: string; claveHash: string }

export interface DB {
  secreto: string;
  ajustes: Ajustes;
  admins: Admin[];
  cuentas: Cuenta[];
  conceptos: Concepto[];
  responsables: Responsable[];
  alumnos: Alumno[];
  cargos: Cargo[];
  pagos: Pago[];
  comprobantes: Comprobante[];
  gastos: Gasto[];
  asientos: Asiento[];
  contadores: Record<string, number>;
  demo: boolean;
}

// ---------- Utilidades ----------
export const uid = () => crypto.randomBytes(8).toString("hex");
export const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function hashClave(clave: string): string {
  const sal = crypto.randomBytes(16).toString("hex");
  return `${sal}:${crypto.scryptSync(clave, sal, 32).toString("hex")}`;
}
export function claveValida(clave: string, hash: string): boolean {
  const [sal, h] = hash.split(":");
  if (!sal || !h) return false;
  const calc = crypto.scryptSync(clave, sal, 32);
  const real = Buffer.from(h, "hex");
  return calc.length === real.length && crypto.timingSafeEqual(calc, real);
}

// ---------- Persistencia ----------
let db: DB | null = null;
let pendiente: NodeJS.Timeout | null = null;

export function getDB(): DB {
  if (!db) throw new Error("Base no iniciada");
  return db;
}

export function iniciarDB(inicial: () => DB) {
  fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
  } else {
    db = inicial();
    guardarYa();
  }
  return db;
}

function guardarYa() {
  if (!db) return;
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
  pendiente = null;
}

/** Guarda con una pequeña demora para agrupar escrituras seguidas. */
export function guardar() {
  if (pendiente) return;
  pendiente = setTimeout(guardarYa, 150);
}
export function guardarAhora() {
  if (pendiente) clearTimeout(pendiente);
  guardarYa();
}
process.on("exit", () => { try { guardarAhora(); } catch { /* nada */ } });

/** Numeración correlativa por tipo: RC (recibos), CG (cargos), GT (gastos), AS (asientos). */
export function siguiente(clave: string): number {
  const d = getDB();
  d.contadores[clave] = (d.contadores[clave] ?? 0) + 1;
  return d.contadores[clave];
}
export const numeroFormateado = (pref: string, n: number) => `${pref}-${String(n).padStart(6, "0")}`;
