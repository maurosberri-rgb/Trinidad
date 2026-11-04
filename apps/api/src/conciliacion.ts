import XLSX from "xlsx";
// Se importa el archivo interno: el índice de pdf-parse intenta abrir un PDF de prueba al cargarse.
// @ts-expect-error sin tipos
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { CTA, nuevoAsiento } from "./contab.js";
import { getDB, redondear, uid, type Extracto, type LineaBanco, type Pago } from "./store.js";

// ---------- Lectura de extractos ----------
type Fila = Omit<LineaBanco, "id" | "estado">;
export interface Lectura { filas: Fila[]; avisos: string[] }

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pad = (n: number) => String(n).padStart(2, "0");

/** Convierte "1.234,56", "1,234.56", "$ 1234", "(500,00)" o "500,00-" en número. */
export function parseMonto(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ""); }
  if (/^-/.test(s)) { neg = true; s = s.replace(/^-/, ""); }
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const ultimaComa = s.lastIndexOf(","), ultimoPunto = s.lastIndexOf(".");
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    s = ultimaComa > ultimoPunto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (ultimaComa >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (ultimoPunto >= 0 && !/\.\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

function isoFecha(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const f = XLSX.SSF.parse_date_code(v);
    return f ? `${f.y}-${pad(f.m)}-${pad(f.d)}` : null;
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const mes = Number(m[2]), dia = Number(m[1]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${a}-${pad(mes)}-${pad(dia)}`;
  }
  return null;
}

const CLAVES = {
  fecha: ["fecha", "f. valor", "fecha valor", "f.valor"],
  descripcion: ["descripcion", "concepto", "detalle", "movimiento", "leyenda", "observaciones"],
  referencia: ["referencia", "comprobante", "nro", "numero", "n°", "operacion", "cod"],
  debito: ["debito", "debitos", "debe", "egreso", "egresos", "retiro", "salida"],
  credito: ["credito", "creditos", "haber", "ingreso", "ingresos", "deposito", "entrada"],
  importe: ["importe", "monto", "valor"],
  saldo: ["saldo"],
};

export function leerExcel(buf: Buffer): Lectura {
  const libro = XLSX.read(buf, { type: "buffer", cellDates: false, raw: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error("El archivo no tiene hojas");
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: "", blankrows: false });
  // Se busca la fila de títulos: la primera que nombra al menos una fecha y algún importe
  let cab = -1;
  let col: Partial<Record<keyof typeof CLAVES, number>> = {};
  for (let i = 0; i < Math.min(filas.length, 60) && cab < 0; i++) {
    const celdas = filas[i].map((c) => sinAcentos(String(c ?? "")).trim());
    const mapa: typeof col = {};
    (Object.keys(CLAVES) as (keyof typeof CLAVES)[]).forEach((k) => {
      const j = celdas.findIndex((c, idx) => c && !Object.values(mapa).includes(idx) && CLAVES[k].some((p) => c === p || c.startsWith(p)));
      if (j >= 0) mapa[k] = j;
    });
    if (mapa.fecha !== undefined && (mapa.importe !== undefined || mapa.credito !== undefined || mapa.debito !== undefined)) { cab = i; col = mapa; }
  }
  if (cab < 0) throw new Error("No encontré los títulos de las columnas. El Excel necesita al menos: Fecha, Descripción y Importe (o Débito/Crédito).");
  const avisos: string[] = [];
  const out: Fila[] = [];
  for (const r of filas.slice(cab + 1)) {
    const fecha = isoFecha(r[col.fecha!]);
    if (!fecha) continue;
    let importe: number | null = null;
    if (col.credito !== undefined || col.debito !== undefined) {
      const cr = col.credito !== undefined ? parseMonto(r[col.credito]) : null;
      const de = col.debito !== undefined ? parseMonto(r[col.debito]) : null;
      if (cr) importe = Math.abs(cr);
      else if (de) importe = -Math.abs(de);
      else if (col.importe !== undefined) importe = parseMonto(r[col.importe]);
    } else importe = parseMonto(r[col.importe!]);
    if (importe === null || importe === 0) continue;
    out.push({
      fecha, importe: redondear(importe),
      descripcion: String(col.descripcion !== undefined ? r[col.descripcion] : "").trim().slice(0, 200),
      referencia: String(col.referencia !== undefined ? r[col.referencia] : "").trim().slice(0, 60),
      saldo: col.saldo !== undefined ? parseMonto(r[col.saldo]) : null,
    });
  }
  if (!out.length) avisos.push("No se encontraron movimientos con fecha e importe.");
  return { filas: out, avisos };
}

const MONTO_PDF = /\(?-?\$?\s?\d[\d.,]*[.,]\d{2}\)?-?/g;
const PARECE_DEBITO = /(d[eé]bito|pago|compra|comisi[oó]n|impuesto|extracci[oó]n|retiro|iva|sircreb|percepci[oó]n|cargo|e-?cheq.*emit|transferencia enviada|echeq pagado)/i;

export async function leerPdf(buf: Buffer): Promise<Lectura> {
  const { text } = (await pdfParse(buf)) as { text: string };
  const avisos: string[] = [];
  const out: Fila[] = [];
  let saldoPrevio: number | null = null;
  for (const linea of text.split(/\r?\n/)) {
    const m = linea.match(/^\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\s+(.*)$/);
    if (!m) continue;
    const fecha = isoFecha(m[1]);
    if (!fecha) continue;
    const resto = m[2];
    const montos = [...resto.matchAll(MONTO_PDF)].map((x) => x[0]);
    if (!montos.length) continue;
    const descripcion = resto.replace(MONTO_PDF, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    const valores = montos.map((x) => parseMonto(x)).filter((x): x is number => x !== null);
    if (!valores.length) continue;
    let mov = valores.length >= 2 ? valores[valores.length - 2] : valores[0];
    const saldo = valores.length >= 2 ? valores[valores.length - 1] : null;
    let signo: 1 | -1;
    if (mov < 0) signo = -1;
    else if (saldo !== null && saldoPrevio !== null && Math.abs(Math.abs(saldo - saldoPrevio) - Math.abs(mov)) < 0.02) signo = saldo - saldoPrevio >= 0 ? 1 : -1;
    else signo = PARECE_DEBITO.test(descripcion) ? -1 : 1;
    mov = Math.abs(mov) * signo;
    if (saldo !== null) saldoPrevio = saldo;
    if (mov === 0) continue;
    const ref = descripcion.match(/\b\d{5,}\b/)?.[0] ?? "";
    out.push({ fecha, descripcion, referencia: ref, importe: redondear(mov), saldo });
  }
  if (!out.length) avisos.push("No pude reconocer movimientos en el PDF (suele pasar con PDF escaneados o con otro formato). Probá descargando el extracto en Excel o CSV desde el home banking.");
  else avisos.push("Los PDF se interpretan automáticamente: revisá que los signos (ingreso/egreso) y los importes sean correctos antes de conciliar.");
  return { filas: out, avisos };
}

// ---------- Cruce con los cobros ----------
const norm = (s: string) => sinAcentos(s).replace(/[^a-z0-9 ]/g, " ");
const dias = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000;

export interface Candidato { tipo: "pago" | "comprobante"; id: string; fecha: string; importe: number; responsable: string; detalle: string; puntaje: number }

/** Cobros (y comprobantes informados por las familias) que podrían corresponder a un ingreso del banco. */
export function candidatosPara(l: LineaBanco): Candidato[] {
  const d = getDB();
  if (l.importe <= 0) return [];
  const texto = norm(`${l.descripcion} ${l.referencia}`);
  const resp = (id: string) => d.responsables.find((r) => r.id === id);
  const puntuar = (fecha: string, responsableId: string, referencia?: string) => {
    const dd = dias(l.fecha, fecha);
    if (dd > 15) return -1;
    let p = dd <= 1 ? 3 : dd <= 3 ? 2 : dd <= 10 ? 1 : 0;
    const r = resp(responsableId);
    if (r) {
      if (r.dni && texto.replace(/ /g, "").includes(r.dni)) p += 5;
      const ap = norm(r.apellido).trim();
      if (ap.length >= 3 && texto.includes(ap)) p += 3;
    }
    if (referencia && referencia.length >= 4 && texto.includes(norm(referencia).trim())) p += 5;
    return p;
  };
  const nombre = (id: string) => { const r = resp(id); return r ? `${r.apellido}, ${r.nombre}` : "—"; };
  const out: Candidato[] = [];
  for (const p of d.pagos) {
    if (p.anulado || p.conciliado || p.medio === "efectivo" || p.cuentaCaja === CTA.anticipos) continue;
    if (Math.abs(p.importe - l.importe) > 0.009) continue;
    const pt = puntuar(p.fecha, p.responsableId, p.referencia);
    if (pt >= 0) out.push({ tipo: "pago", id: p.id, fecha: p.fecha, importe: p.importe, responsable: nombre(p.responsableId), detalle: `${p.numero} · ${p.medio}`, puntaje: pt });
  }
  for (const c of d.comprobantes) {
    if (c.estado !== "pendiente" || Math.abs(c.importe - l.importe) > 0.009) continue;
    const pt = puntuar(c.fechaPago, c.responsableId);
    if (pt >= 0) out.push({ tipo: "comprobante", id: c.id, fecha: c.fechaPago, importe: c.importe, responsable: nombre(c.responsableId), detalle: "Comprobante informado por la familia (sin aprobar)", puntaje: pt });
  }
  return out.sort((a, b) => b.puntaje - a.puntaje);
}

/** La sugerencia es «segura» cuando hay un único mejor candidato. */
export function sugerencia(c: Candidato[]): Candidato | null {
  if (!c.length) return null;
  if (c.length === 1 || c[0].puntaje > c[1].puntaje) return c[0];
  return null;
}

/** Vincula un movimiento del banco con un cobro. Los cheques y tarjetas pasan de «valores a depositar» al banco. */
export function vincular(ext: Extracto, l: LineaBanco, p: Pago) {
  if (l.estado === "conciliada") throw new Error("Ese movimiento ya está conciliado");
  if (l.importe <= 0) throw new Error("Solo se concilian ingresos al banco");
  if (p.anulado) throw new Error("El cobro está anulado");
  if (p.conciliado) throw new Error("Ese cobro ya fue conciliado con otro movimiento");
  if (Math.abs(p.importe - l.importe) > 0.009) throw new Error("El importe del cobro no coincide con el del movimiento");
  let asientoId: string | undefined;
  if (p.cuentaCaja === CTA.valores) {
    asientoId = nuevoAsiento(l.fecha, `Acreditación en banco de ${p.numero} (${p.medio})`, { tipo: "manual", id: p.id }, [
      { cuenta: CTA.banco, debe: l.importe, haber: 0 },
      { cuenta: CTA.valores, debe: 0, haber: l.importe },
    ]).id;
  }
  p.conciliado = { extractoId: ext.id, lineaId: l.id, ...(asientoId ? { asientoId } : {}) };
  l.estado = "conciliada"; l.pagoId = p.id;
}

export function deshacer(ext: Extracto, l: LineaBanco) {
  const d = getDB();
  const p = d.pagos.find((x) => x.id === l.pagoId);
  if (p?.conciliado) {
    if (p.conciliado.asientoId) { const a = d.asientos.find((x) => x.id === p.conciliado!.asientoId); if (a) a.anulado = true; }
    p.conciliado = undefined;
  }
  l.estado = "pendiente"; l.pagoId = undefined;
  void ext;
}

export const nuevaLinea = (f: Fila): LineaBanco => ({ id: uid(), estado: "pendiente", ...f });
