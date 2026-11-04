import crypto from "node:crypto";
import { asientoGasto, nuevoAsiento } from "./contab.js";
import { crearCargo, registrarPago } from "./servicios.js";
import {
  getDB, guardarAhora, hashClave, hoy, iniciarDB, numeroFormateado, siguiente, uid,
  type Alumno, type Concepto, type Cuenta, type DB, type Gasto, type Nivel, type Responsable,
} from "./store.js";

const c = (codigo: string, nombre: string, tipo: Cuenta["tipo"], imputable = true): Cuenta => ({ codigo, nombre, tipo, imputable });

/** Plan de cuentas base para un colegio privado; se puede ampliar desde Contabilidad → Plan de cuentas. */
export const PLAN_BASE: Cuenta[] = [
  c("1", "ACTIVO", "Activo", false),
  c("1.1", "Activo corriente", "Activo", false),
  c("1.1.01", "Caja", "Activo"),
  c("1.1.02", "Banco cuenta corriente", "Activo"),
  c("1.1.03", "Cuotas y servicios a cobrar", "Activo"),
  c("2", "PASIVO", "Pasivo", false),
  c("2.1", "Pasivo corriente", "Pasivo", false),
  c("2.1.01", "Proveedores", "Pasivo"),
  c("2.1.02", "Sueldos y cargas sociales a pagar", "Pasivo"),
  c("2.1.03", "Cobros anticipados de familias", "Pasivo"),
  c("3", "PATRIMONIO NETO", "Patrimonio", false),
  c("3.1.01", "Capital", "Patrimonio"),
  c("3.1.02", "Resultados acumulados", "Patrimonio"),
  c("4", "INGRESOS", "Ingreso", false),
  c("4.1", "Ingresos por enseñanza", "Ingreso", false),
  c("4.1.01", "Cuotas de enseñanza", "Ingreso"),
  c("4.1.02", "Matrículas e inscripciones", "Ingreso"),
  c("4.1.03", "Actividades extra (campamentos, salidas)", "Ingreso"),
  c("4.1.04", "Otros ingresos", "Ingreso"),
  c("4.1.05", "Becas y descuentos otorgados", "Ingreso"),
  c("5", "EGRESOS", "Egreso", false),
  c("5.1", "Gastos de personal", "Egreso", false),
  c("5.1.01", "Sueldos y jornales", "Egreso"),
  c("5.1.02", "Cargas sociales", "Egreso"),
  c("5.1.03", "Honorarios profesionales", "Egreso"),
  c("5.2", "Gastos de funcionamiento", "Egreso", false),
  c("5.2.01", "Servicios (luz, gas, agua, internet)", "Egreso"),
  c("5.2.02", "Mantenimiento y reparaciones", "Egreso"),
  c("5.2.03", "Material didáctico y librería", "Egreso"),
  c("5.2.04", "Limpieza", "Egreso"),
  c("5.2.05", "Impuestos y tasas", "Egreso"),
  c("5.2.06", "Gastos de actividades extra", "Egreso"),
  c("5.2.07", "Gastos bancarios", "Egreso"),
  c("5.2.08", "Seguros", "Egreso"),
  c("5.2.09", "Otros gastos", "Egreso"),
];

const CONCEPTOS_BASE: Omit<Concepto, "id">[] = [
  { nombre: "Cuota mensual", tipo: "cuota", importe: 85000, cuenta: "4.1.01", activo: true },
  { nombre: "Matrícula", tipo: "matricula", importe: 120000, cuenta: "4.1.02", activo: true },
  { nombre: "Campamento", tipo: "actividad", importe: 65000, cuenta: "4.1.03", activo: true },
  { nombre: "Salida educativa", tipo: "actividad", importe: 12000, cuenta: "4.1.03", activo: true },
];

export function vacia(): DB {
  const anio = new Date().getFullYear();
  return {
    secreto: crypto.randomBytes(32).toString("hex"),
    ajustes: {
      colegio: "Instituto Santísima Trinidad", cuit: "", direccion: "", telefono: "", email: "",
      banco: "", titular: "Instituto Santísima Trinidad", cbu: "", alias: "", diaVencimiento: 10, cicloLectivo: anio,
    },
    admins: [{ id: uid(), usuario: "admin", nombre: "Administración", claveHash: hashClave(process.env.ADMIN_PASSWORD || "admin") }],
    cuentas: PLAN_BASE.map((x) => ({ ...x })),
    conceptos: CONCEPTOS_BASE.map((x) => ({ ...x, id: uid() })),
    responsables: [], alumnos: [], cargos: [], pagos: [], comprobantes: [], gastos: [], asientos: [],
    contadores: {}, demo: false,
  };
}

const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Datos de ejemplo para probar el sistema; se borran desde Ajustes sin tocar el plan de cuentas ni los conceptos. */
export function cargarDemo() {
  const d = getDB();
  const anio = d.ajustes.cicloLectivo;
  const hasta = Math.max(3, new Date().getMonth() + 1); // cuotas devengadas hasta el mes en curso
  const clave = hashClave("demo");
  const resp = (dni: string, apellido: string, nombre: string, tel: string): Responsable => {
    const r: Responsable = { id: uid(), dni, apellido, nombre, telefono: tel, email: "", claveHash: hashClave(dni), debeCambiarClave: true, saldoAFavor: 0, activo: true, creado: hoy() };
    d.responsables.push(r);
    return r;
  };
  void clave;
  const gomez = resp("20111222", "Gómez", "Laura", "351 555 0101");
  const perez = resp("27333444", "Pérez", "Martín", "351 555 0102");
  const rios = resp("30555666", "Ríos", "Carolina", "351 555 0103");
  const al = (apellido: string, nombre: string, nivel: Nivel, curso: string, r: Responsable, beca = 0): Alumno => {
    const a: Alumno = { id: uid(), dni: "", apellido, nombre, nivel, curso, responsableIds: [r.id], pagadorId: r.id, becaPct: beca, activo: true };
    d.alumnos.push(a);
    return a;
  };
  const alumnos = [
    al("Gómez", "Sofía", "Primario", "4° A", gomez),
    al("Gómez", "Tomás", "Inicial", "Sala de 5", gomez, 10),
    al("Pérez", "Valentina", "Secundario", "2° B", perez),
    al("Ríos", "Joaquín", "Primario", "6° A", rios, 25),
  ];
  const cuota = d.conceptos.find((x) => x.tipo === "cuota")!;
  const mat = d.conceptos.find((x) => x.tipo === "matricula")!;
  for (const a of alumnos) {
    crearCargo({ alumno: a, concepto: mat, periodo: iso(anio, 3, 1).slice(0, 7), emision: iso(anio, 3, 1), vencimiento: iso(anio, 3, 10) });
    for (let m = 3; m <= hasta; m++) {
      crearCargo({ alumno: a, concepto: cuota, periodo: iso(anio, m, 1).slice(0, 7), emision: iso(anio, m, 1), vencimiento: iso(anio, m, d.ajustes.diaVencimiento) });
    }
  }
  // La familia Gómez está al día hasta febrero... y Pérez pagó todo; Ríos queda con deuda.
  const pagarTodo = (r: Responsable, fecha: string, medio: "efectivo" | "transferencia") => {
    const deuda = d.cargos.filter((x) => x.responsableId === r.id && !x.anulado).reduce((s, x) => s + (x.importe - x.pagado), 0);
    if (deuda > 0) registrarPago({ responsableId: r.id, fecha, medio, importe: deuda, observacion: "Pago de ejemplo" });
  };
  pagarTodo(perez, iso(anio, 3, 8), "transferencia");
  const ult = d.cargos.filter((x) => x.responsableId === gomez.id).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const hastaPagar = ult.slice(0, Math.max(0, ult.length - 2)).reduce((s, x) => s + x.importe, 0);
  if (hastaPagar > 0) registrarPago({ responsableId: gomez.id, fecha: iso(anio, 3, 9), medio: "efectivo", importe: hastaPagar, observacion: "Pago de ejemplo" });

  const gasto = (fecha: string, proveedor: string, cuenta: string, detalle: string, importe: number, medio: Gasto["medio"]) => {
    const g: Gasto = { id: uid(), numero: numeroFormateado("GT", siguiente("gasto")), fecha, proveedor, cuenta, detalle, importe, medio, nroComprobante: "", anulado: false, asientoId: "" };
    d.gastos.push(g);
    g.asientoId = asientoGasto(g).id;
  };
  gasto(iso(anio, 3, 5), "Cooperativa Eléctrica", "5.2.01", "Luz marzo", 185000, "banco");
  gasto(iso(anio, 3, 15), "Librería Escolar SRL", "5.2.03", "Resmas y marcadores", 96000, "caja");
  gasto(iso(anio, 3, 28), "Personal docente", "5.1.01", "Sueldos marzo", 280000, "banco");
  nuevoAsiento(iso(anio, 3, 1), "Aporte inicial de capital", { tipo: "manual", id: "inicio" }, [
    { cuenta: "1.1.02", debe: 1500000, haber: 0 },
    { cuenta: "3.1.01", debe: 0, haber: 1500000 },
  ]);
  d.demo = true;
}

export async function iniciar(): Promise<DB> {
  const nueva = await iniciarDB(vacia);
  // Los datos de ejemplo se cargan solo la primera vez (base recién creada) y nunca en producción (SIN_DEMO=1).
  if (nueva && process.env.SIN_DEMO !== "1") cargarDemo();
  if (nueva) await guardarAhora();
  return getDB();
}
