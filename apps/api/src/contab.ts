import { getDB, redondear, siguiente, uid, type Asiento, type Cargo, type Gasto, type LineaAsiento, type Pago } from "./store.js";

// Cuentas con función especial dentro del circuito de cobranzas.
export const CTA = {
  caja: "1.1.01",
  banco: "1.1.02",
  deudores: "1.1.03",
  valores: "1.1.04",
  proveedores: "2.1.01",
  anticipos: "2.1.03",
  becas: "4.1.05",
};

export function nuevoAsiento(fecha: string, descripcion: string, origen: Asiento["origen"], lineas: LineaAsiento[]): Asiento {
  const l = lineas.map((x) => ({ cuenta: x.cuenta, debe: redondear(x.debe), haber: redondear(x.haber) })).filter((x) => x.debe !== 0 || x.haber !== 0);
  const debe = redondear(l.reduce((s, x) => s + x.debe, 0));
  const haber = redondear(l.reduce((s, x) => s + x.haber, 0));
  if (debe !== haber) throw new Error(`El asiento no balancea (debe ${debe} ≠ haber ${haber})`);
  if (l.length < 2) throw new Error("Un asiento necesita al menos dos líneas");
  const d = getDB();
  const a: Asiento = { id: uid(), numero: siguiente("asiento"), fecha, descripcion, origen, lineas: l, anulado: false };
  d.asientos.push(a);
  return a;
}

/** Devengamiento de un cargo: debe Deudores (neto) y Becas (descuento); haber el ingreso por el bruto. */
export function asientoCargo(c: Cargo, descripcion: string): Asiento {
  return nuevoAsiento(c.emision, descripcion, { tipo: "cargo", id: c.id }, [
    { cuenta: CTA.deudores, debe: c.importe, haber: 0 },
    { cuenta: CTA.becas, debe: c.descuento, haber: 0 },
    { cuenta: c.cuenta, debe: 0, haber: c.bruto },
  ]);
}

export function asientoPago(p: Pago, descripcion: string): Asiento {
  const aplicado = redondear(p.imputaciones.reduce((s, i) => s + i.monto, 0));
  return nuevoAsiento(p.fecha, descripcion, { tipo: "pago", id: p.id }, [
    { cuenta: p.cuentaCaja, debe: p.importe, haber: 0 },
    { cuenta: CTA.deudores, debe: 0, haber: aplicado },
    { cuenta: CTA.anticipos, debe: 0, haber: p.aFavor },
  ]);
}

export function asientoGasto(g: Gasto): Asiento {
  const contra = g.medio === "caja" ? CTA.caja : g.medio === "banco" ? CTA.banco : CTA.proveedores;
  return nuevoAsiento(g.fecha, `Gasto ${g.numero} · ${g.proveedor}${g.detalle ? " · " + g.detalle : ""}`, { tipo: "gasto", id: g.id }, [
    { cuenta: g.cuenta, debe: g.importe, haber: 0 },
    { cuenta: contra, debe: 0, haber: g.importe },
  ]);
}

export function anularAsiento(id: string) {
  const a = getDB().asientos.find((x) => x.id === id);
  if (a) a.anulado = true;
}

const vigentes = () => getDB().asientos.filter((a) => !a.anulado);

// ---------- Informes ----------
export interface FilaResultado { codigo: string; nombre: string; monto: number }

/** Estado de resultados por devengado entre dos fechas (inclusive). */
export function estadoResultados(desde: string, hasta: string) {
  const d = getDB();
  const mov = new Map<string, { debe: number; haber: number }>();
  for (const a of vigentes()) {
    if (a.fecha < desde || a.fecha > hasta) continue;
    for (const l of a.lineas) {
      const m = mov.get(l.cuenta) ?? { debe: 0, haber: 0 };
      m.debe += l.debe; m.haber += l.haber;
      mov.set(l.cuenta, m);
    }
  }
  const filas = (tipo: "Ingreso" | "Egreso"): FilaResultado[] =>
    d.cuentas
      .filter((c) => c.tipo === tipo && c.imputable && mov.has(c.codigo))
      .map((c) => {
        const m = mov.get(c.codigo)!;
        // Los ingresos acreditan (haber − debe); la cuenta de becas es regularizadora y resta.
        return { codigo: c.codigo, nombre: c.nombre, monto: redondear(tipo === "Ingreso" ? m.haber - m.debe : m.debe - m.haber) };
      })
      .filter((f) => f.monto !== 0);
  const ingresos = filas("Ingreso");
  const egresos = filas("Egreso");
  const totalIngresos = redondear(ingresos.reduce((s, f) => s + f.monto, 0));
  const totalEgresos = redondear(egresos.reduce((s, f) => s + f.monto, 0));
  const cobrado = redondear(
    d.pagos.filter((p) => !p.anulado && p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.importe, 0),
  );
  const gastosPagados = redondear(
    d.gastos.filter((g) => !g.anulado && g.medio !== "apagar" && g.fecha >= desde && g.fecha <= hasta).reduce((s, g) => s + g.importe, 0),
  );
  return { desde, hasta, ingresos, egresos, totalIngresos, totalEgresos, resultado: redondear(totalIngresos - totalEgresos), cobrado, gastosPagados };
}

export function sumasYSaldos(hasta: string) {
  const d = getDB();
  const mov = new Map<string, { debe: number; haber: number }>();
  for (const a of vigentes()) {
    if (a.fecha > hasta) continue;
    for (const l of a.lineas) {
      const m = mov.get(l.cuenta) ?? { debe: 0, haber: 0 };
      m.debe += l.debe; m.haber += l.haber;
      mov.set(l.cuenta, m);
    }
  }
  const filas = d.cuentas
    .filter((c) => c.imputable && mov.has(c.codigo))
    .map((c) => {
      const m = mov.get(c.codigo)!;
      const saldo = redondear(m.debe - m.haber);
      return { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, debe: redondear(m.debe), haber: redondear(m.haber), deudor: saldo > 0 ? saldo : 0, acreedor: saldo < 0 ? -saldo : 0 };
    });
  const tot = (k: "debe" | "haber" | "deudor" | "acreedor") => redondear(filas.reduce((s, f) => s + f[k], 0));
  return { hasta, filas, totales: { debe: tot("debe"), haber: tot("haber"), deudor: tot("deudor"), acreedor: tot("acreedor") } };
}

export function mayor(cuenta: string, desde: string, hasta: string) {
  const c = getDB().cuentas.find((x) => x.codigo === cuenta);
  let saldo = 0;
  const lineas: { fecha: string; numero: number; descripcion: string; debe: number; haber: number; saldo: number }[] = [];
  const ordenados = [...vigentes()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero);
  let inicial = 0;
  for (const a of ordenados) {
    for (const l of a.lineas) {
      if (l.cuenta !== cuenta) continue;
      if (a.fecha < desde) { inicial += l.debe - l.haber; continue; }
      if (a.fecha > hasta) continue;
      if (lineas.length === 0) saldo = inicial;
      saldo += l.debe - l.haber;
      lineas.push({ fecha: a.fecha, numero: a.numero, descripcion: a.descripcion, debe: l.debe, haber: l.haber, saldo: redondear(saldo) });
    }
  }
  return { cuenta: c, saldoInicial: redondear(inicial), lineas };
}
