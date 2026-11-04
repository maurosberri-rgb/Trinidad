import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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
  /** Si el cargo pertenece a un evento (viaje, campamento…). */
  eventoId?: string;
}
/** Cobro eventual: un viaje de estudio, campamento, salida, etc. Genera cargos (en una o varias cuotas) para los alumnos que participan. */
export interface Evento {
  id: string; nombre: string; descripcion: string; fechaEvento: string; importe: number; cuotas: number; primerVencimiento: string;
  cuenta: string; alumnoIds: string[]; creado: string; cerrado: boolean;
}
export type MedioPago = "efectivo" | "transferencia" | "cheque" | "tarjeta_debito" | "tarjeta_credito" | "deposito" | "mercadopago" | "otro";
/** Movimiento de un extracto bancario; el importe es positivo si es un ingreso al banco. */
export interface LineaBanco { id: string; fecha: string; descripcion: string; referencia: string; importe: number; saldo: number | null; estado: "pendiente" | "conciliada" | "ignorada"; pagoId?: string }
export interface Extracto { id: string; nombre: string; creado: string; desde: string; hasta: string; lineas: LineaBanco[] }
export interface Imputacion { cargoId: string; monto: number }
export interface Pago {
  id: string; numero: string; fecha: string; responsableId: string; medio: MedioPago;
  cuentaCaja: string; importe: number; imputaciones: Imputacion[]; aFavor: number; comprobanteId?: string;
  /** N° de cheque, cupón de tarjeta, operación bancaria, etc. */
  referencia?: string;
  /** Si el cobro ya se cruzó con un movimiento del extracto bancario. */
  conciliado?: { extractoId: string; lineaId: string; asientoId?: string };
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
  eventos: Evento[];
  extractos: Extracto[];
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
// Con DATABASE_URL (Supabase/Postgres) los datos y los comprobantes viven en la base; sin ella, en archivos dentro de DATA_DIR.
// En ambos casos el sistema trabaja con la base en memoria y persiste cada cambio.
const DATABASE_URL = process.env.DATABASE_URL;
let db: DB | null = null;
let pendiente: NodeJS.Timeout | null = null;
let pool: pg.Pool | null = null;
let cola: Promise<void> = Promise.resolve();

export const usaPostgres = () => Boolean(DATABASE_URL);

export function getDB(): DB {
  if (!db) throw new Error("Base no iniciada");
  return db;
}

async function conectar() {
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 3,
    // Supabase exige TLS. DATABASE_SSL=0 lo desactiva (solo para una base local).
    ssl: process.env.DATABASE_SSL === "0" ? false : { rejectUnauthorized: false },
  });
  await pool.query(`
    create table if not exists estado (id text primary key, datos jsonb not null, actualizado timestamptz not null default now());
    create table if not exists archivos (nombre text primary key, tipo text not null, datos bytea not null, creado timestamptz not null default now());
    alter table estado enable row level security;
    alter table archivos enable row level security;
  `);
}

export async function iniciarDB(inicial: () => DB): Promise<boolean> {
  if (process.env.EXIGIR_DATABASE === "1" && !DATABASE_URL) {
    throw new Error("Falta DATABASE_URL: en este entorno los datos tienen que estar en Supabase. No se inicia para no crear una base vacía y temporal.");
  }
  let nueva = false;
  if (DATABASE_URL) {
    await conectar();
    const r = await pool!.query("select datos from estado where id = 'principal'");
    if (r.rows.length) db = r.rows[0].datos as DB;
    else { db = inicial(); nueva = true; }
  } else {
    fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
    else { db = inicial(); nueva = true; }
  }
  // Bases creadas antes de existir los eventos
  db!.eventos ??= [];
  db!.extractos ??= [];
  return nueva;
}

async function escribir() {
  if (!db) return;
  pendiente = null;
  const texto = JSON.stringify(db);
  if (pool) {
    await pool.query("insert into estado (id, datos) values ('principal', $1::jsonb) on conflict (id) do update set datos = excluded.datos, actualizado = now()", [texto]);
  } else {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, texto);
    fs.renameSync(tmp, DB_FILE);
  }
}

/** Las escrituras van en fila para que nunca se pisen entre sí. */
function guardarYa(): Promise<void> {
  cola = cola.then(escribir).catch((e) => console.error("No se pudo guardar:", e));
  return cola;
}

/** Guarda con una pequeña demora para agrupar escrituras seguidas. */
export function guardar() {
  if (pendiente) return;
  pendiente = setTimeout(() => void guardarYa(), 150);
}
export async function guardarAhora() {
  if (pendiente) clearTimeout(pendiente);
  await guardarYa();
}

// ---------- Archivos (comprobantes) ----------
export async function guardarArchivo(nombre: string, buf: Buffer, tipo: string) {
  if (pool) await pool.query("insert into archivos (nombre, tipo, datos) values ($1, $2, $3) on conflict (nombre) do update set datos = excluded.datos, tipo = excluded.tipo", [nombre, tipo, buf]);
  else fs.writeFileSync(path.join(ARCHIVOS_DIR, nombre), buf);
}
export async function leerArchivo(nombre: string): Promise<Buffer | null> {
  if (pool) {
    const r = await pool.query("select datos from archivos where nombre = $1", [nombre]);
    return r.rows[0]?.datos ?? null;
  }
  const f = path.join(ARCHIVOS_DIR, nombre);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}
export async function borrarArchivos() {
  if (pool) await pool.query("delete from archivos");
  else for (const f of fs.readdirSync(ARCHIVOS_DIR)) fs.rmSync(path.join(ARCHIVOS_DIR, f), { force: true });
}

/** Numeración correlativa por tipo: RC (recibos), CG (cargos), GT (gastos), AS (asientos). */
export function siguiente(clave: string): number {
  const d = getDB();
  d.contadores[clave] = (d.contadores[clave] ?? 0) + 1;
  return d.contadores[clave];
}
export const numeroFormateado = (pref: string, n: number) => `${pref}-${String(n).padStart(6, "0")}`;
