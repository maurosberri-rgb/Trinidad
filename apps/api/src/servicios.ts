import { CTA, anularAsiento, asientoCargo, asientoPago } from "./contab.js";
import {
  getDB, numeroFormateado, redondear, siguiente, uid,
  type Alumno, type Cargo, type Concepto, type Pago,
} from "./store.js";

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const pendienteDe = (c: Cargo) => redondear(c.importe - c.pagado);

export function nombrePeriodo(periodo: string): string {
  const [a, m] = periodo.split("-");
  return `${MESES[Number(m) - 1] ?? periodo} ${a}`;
}

export function descripcionPorDefecto(concepto: Concepto, periodo: string): string {
  return concepto.tipo === "cuota" ? `${concepto.nombre} ${nombrePeriodo(periodo)}` : concepto.nombre;
}

export interface NuevoCargo {
  alumno: Alumno; concepto: Concepto; periodo: string; emision: string; vencimiento: string;
  importe?: number; descripcion?: string;
}

/** Crea el cargo con su beca y el asiento de devengamiento. Devuelve null si ya existía el mismo. */
export function crearCargo(n: NuevoCargo): Cargo | null {
  const d = getDB();
  const descripcion = n.descripcion?.trim() || descripcionPorDefecto(n.concepto, n.periodo);
  const repetido = d.cargos.some((c) => !c.anulado && c.alumnoId === n.alumno.id && c.conceptoId === n.concepto.id && c.periodo === n.periodo && c.descripcion === descripcion);
  if (repetido) return null;
  const bruto = redondear(n.importe ?? n.concepto.importe);
  // La beca se aplica a cuotas y matrículas; las actividades extra se cobran completas.
  const aplicaBeca = n.concepto.tipo === "cuota" || n.concepto.tipo === "matricula";
  const descuento = aplicaBeca ? redondear((bruto * n.alumno.becaPct) / 100) : 0;
  const c: Cargo = {
    id: uid(), numero: numeroFormateado("CG", siguiente("cargo")), alumnoId: n.alumno.id,
    responsableId: n.alumno.pagadorId, conceptoId: n.concepto.id, descripcion, periodo: n.periodo,
    emision: n.emision, vencimiento: n.vencimiento, bruto, descuento, importe: redondear(bruto - descuento),
    pagado: 0, anulado: false, cuenta: n.concepto.cuenta, asientoId: "",
  };
  d.cargos.push(c);
  const a = asientoCargo(c, `${c.numero} · ${descripcion} · ${n.alumno.apellido}, ${n.alumno.nombre}`);
  c.asientoId = a.id;
  return c;
}

export function anularCargo(id: string) {
  const c = getDB().cargos.find((x) => x.id === id);
  if (!c) throw new Error("Cargo inexistente");
  if (c.anulado) throw new Error("El cargo ya está anulado");
  if (c.pagado > 0) throw new Error("El cargo tiene pagos aplicados: anulá primero el recibo correspondiente");
  c.anulado = true;
  anularAsiento(c.asientoId);
}

export interface NuevoPago {
  responsableId: string; fecha: string; medio: Pago["medio"]; importe: number; cargoIds?: string[];
  observacion?: string; comprobanteId?: string;
}

/** Aplica el importe a los cargos indicados (o a todos los pendientes) empezando por los más viejos; el sobrante queda a favor. */
export function registrarPago(n: NuevoPago): Pago {
  const d = getDB();
  const r = d.responsables.find((x) => x.id === n.responsableId);
  if (!r) throw new Error("Responsable inexistente");
  const importe = redondear(n.importe);
  if (!(importe > 0)) throw new Error("El importe debe ser mayor a cero");
  const candidatos = d.cargos
    .filter((c) => !c.anulado && c.responsableId === r.id && pendienteDe(c) > 0 && (!n.cargoIds?.length || n.cargoIds.includes(c.id)))
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.emision.localeCompare(b.emision));
  let resto = importe;
  const imputaciones: Pago["imputaciones"] = [];
  for (const c of candidatos) {
    if (resto <= 0) break;
    const monto = redondear(Math.min(resto, pendienteDe(c)));
    imputaciones.push({ cargoId: c.id, monto });
    resto = redondear(resto - monto);
  }
  const p: Pago = {
    id: uid(), numero: numeroFormateado("RC", siguiente("pago")), fecha: n.fecha, responsableId: r.id, medio: n.medio,
    cuentaCaja: n.medio === "efectivo" ? CTA.caja : CTA.banco, importe, imputaciones, aFavor: resto,
    comprobanteId: n.comprobanteId, observacion: n.observacion ?? "", anulado: false, asientoId: "",
  };
  for (const i of imputaciones) d.cargos.find((c) => c.id === i.cargoId)!.pagado = redondear(d.cargos.find((c) => c.id === i.cargoId)!.pagado + i.monto);
  r.saldoAFavor = redondear(r.saldoAFavor + resto);
  d.pagos.push(p);
  p.asientoId = asientoPago(p, `Recibo ${p.numero} · ${r.apellido}, ${r.nombre}`).id;
  return p;
}

/** Usa el saldo a favor de la familia para cancelar cargos pendientes. */
export function aplicarSaldoAFavor(responsableId: string, fecha: string): Pago {
  const d = getDB();
  const r = d.responsables.find((x) => x.id === responsableId);
  if (!r) throw new Error("Responsable inexistente");
  const pendientes = d.cargos
    .filter((c) => !c.anulado && c.responsableId === r.id && pendienteDe(c) > 0)
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const deuda = redondear(pendientes.reduce((s, c) => s + pendienteDe(c), 0));
  const usar = redondear(Math.min(r.saldoAFavor, deuda));
  if (!(usar > 0)) throw new Error("No hay saldo a favor aplicable a cuotas pendientes");
  let resto = usar;
  const imputaciones: Pago["imputaciones"] = [];
  for (const c of pendientes) {
    if (resto <= 0) break;
    const monto = redondear(Math.min(resto, pendienteDe(c)));
    imputaciones.push({ cargoId: c.id, monto });
    c.pagado = redondear(c.pagado + monto);
    resto = redondear(resto - monto);
  }
  r.saldoAFavor = redondear(r.saldoAFavor - usar);
  const p: Pago = {
    id: uid(), numero: numeroFormateado("RC", siguiente("pago")), fecha, responsableId: r.id, medio: "otro",
    cuentaCaja: CTA.anticipos, importe: usar, imputaciones, aFavor: 0, observacion: "Aplicación de saldo a favor", anulado: false, asientoId: "",
  };
  d.pagos.push(p);
  p.asientoId = asientoPago(p, `Aplicación de saldo a favor ${p.numero} · ${r.apellido}, ${r.nombre}`).id;
  return p;
}

export function anularPago(id: string) {
  const d = getDB();
  const p = d.pagos.find((x) => x.id === id);
  if (!p) throw new Error("Recibo inexistente");
  if (p.anulado) throw new Error("El recibo ya está anulado");
  const r = d.responsables.find((x) => x.id === p.responsableId)!;
  const esAplicacion = p.cuentaCaja === CTA.anticipos;
  if (!esAplicacion && r.saldoAFavor + 0.001 < p.aFavor) throw new Error("El saldo a favor de este recibo ya fue utilizado; anulá primero esa aplicación");
  for (const i of p.imputaciones) {
    const c = d.cargos.find((x) => x.id === i.cargoId);
    if (c) c.pagado = redondear(c.pagado - i.monto);
  }
  r.saldoAFavor = redondear(esAplicacion ? r.saldoAFavor + p.importe : r.saldoAFavor - p.aFavor);
  p.anulado = true;
  anularAsiento(p.asientoId);
  // Si venía de un comprobante online, vuelve a quedar pendiente de revisión.
  if (p.comprobanteId) {
    const cp = d.comprobantes.find((x) => x.id === p.comprobanteId);
    if (cp) { cp.estado = "pendiente"; cp.pagoId = undefined; cp.resuelto = undefined; }
  }
}

export function estadoCargo(c: Cargo, hoy: string): "anulado" | "pagado" | "parcial" | "vencido" | "pendiente" {
  if (c.anulado) return "anulado";
  if (pendienteDe(c) <= 0) return "pagado";
  if (c.vencimiento < hoy) return "vencido";
  return c.pagado > 0 ? "parcial" : "pendiente";
}
