import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bloqueado, crearToken, exito, falla, requiere } from "./auth.js";
import { CTA, anularAsiento, asientoGasto, estadoResultados, mayor, nuevoAsiento, sumasYSaldos } from "./contab.js";
import { cargarDemo, iniciar, vacia } from "./seed.js";
import {
  anularCargo, anularPago, aplicarSaldoAFavor, crearCargo, estadoCargo, pendienteDe, registrarPago,
} from "./servicios.js";
import {
  ARCHIVOS_DIR, claveValida, getDB, guardar, guardarAhora, hashClave, hoy, numeroFormateado, redondear, siguiente, uid,
  type Alumno, type Cargo, type Comprobante, type Gasto, type Nivel, type Responsable,
} from "./store.js";

iniciar();
const app = express();
app.use(express.json({ limit: "12mb" }));

/** Cualquier cambio exitoso (POST/PUT/DELETE) se persiste al terminar la respuesta. */
app.use((req, res, next) => {
  if (req.method !== "GET") res.on("finish", () => { if (res.statusCode < 400) guardar(); });
  next();
});

class Rechazo extends Error {}
const rechazar = (m: string): never => { throw new Rechazo(m); };
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => redondear(Number(v) || 0);
const soloDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const fechaOk = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : rechazar("Fecha inválida"));

// ---------- Presentación ----------
const nombreAlumno = (a?: Alumno) => (a ? `${a.apellido}, ${a.nombre}` : "—");
const nombreResp = (r?: Responsable) => (r ? `${r.apellido}, ${r.nombre}` : "—");
const vistaResp = (r: Responsable) => ({ id: r.id, dni: r.dni, apellido: r.apellido, nombre: r.nombre, telefono: r.telefono, email: r.email, saldoAFavor: r.saldoAFavor, activo: r.activo, debeCambiarClave: r.debeCambiarClave });
function vistaCargo(c: Cargo) {
  const d = getDB();
  return {
    id: c.id, numero: c.numero, descripcion: c.descripcion, periodo: c.periodo, emision: c.emision, vencimiento: c.vencimiento,
    bruto: c.bruto, descuento: c.descuento, importe: c.importe, pagado: c.pagado, pendiente: pendienteDe(c),
    estado: estadoCargo(c, hoy()), alumnoId: c.alumnoId, alumno: nombreAlumno(d.alumnos.find((a) => a.id === c.alumnoId)),
    responsableId: c.responsableId, conceptoId: c.conceptoId,
  };
}
function vistaComprobante(cp: Comprobante) {
  const d = getDB();
  return {
    id: cp.id, responsableId: cp.responsableId, responsable: nombreResp(d.responsables.find((r) => r.id === cp.responsableId)),
    creado: cp.creado, fechaPago: cp.fechaPago, importe: cp.importe, nota: cp.nota, estado: cp.estado, motivo: cp.motivo, pagoId: cp.pagoId ?? null,
    archivo: { nombre: cp.archivo.nombre, tipo: cp.archivo.tipo },
    cargos: cp.cargoIds.map((id) => d.cargos.find((c) => c.id === id)).filter(Boolean).map((c) => vistaCargo(c!)),
  };
}
const vistaPago = (p: ReturnType<typeof getDB>["pagos"][number]) => {
  const d = getDB();
  return {
    id: p.id, numero: p.numero, fecha: p.fecha, medio: p.medio, importe: p.importe, aFavor: p.aFavor, observacion: p.observacion, anulado: p.anulado,
    responsableId: p.responsableId, responsable: nombreResp(d.responsables.find((r) => r.id === p.responsableId)),
    detalle: p.imputaciones.map((i) => ({ monto: i.monto, descripcion: d.cargos.find((c) => c.id === i.cargoId)?.descripcion ?? "", alumno: nombreAlumno(d.alumnos.find((a) => a.id === d.cargos.find((c) => c.id === i.cargoId)?.alumnoId)) })),
  };
};

// ---------- Acceso ----------
const api = express.Router();

api.get("/publico", (_req, res) => {
  const a = getDB().ajustes;
  res.json({ colegio: a.colegio, ciclo: a.cicloLectivo });
});

api.post("/auth/familia", (req, res) => {
  const dni = soloDigitos(req.body.dni);
  const clave = String(req.body.clave ?? "");
  const llave = `f:${dni}:${req.ip}`;
  const espera = bloqueado(llave);
  if (espera) return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${espera} min.` });
  const r = getDB().responsables.find((x) => x.dni === dni && x.activo);
  if (!r || !claveValida(clave, r.claveHash)) {
    falla(llave);
    return res.status(401).json({ error: "DNI o contraseña incorrectos. Si es tu primer ingreso, tu contraseña es tu DNI." });
  }
  exito(llave);
  res.json({ token: crearToken({ rol: "familia", id: r.id }), nombre: r.nombre, debeCambiarClave: r.debeCambiarClave });
});

api.post("/auth/admin", (req, res) => {
  const usuario = str(req.body.usuario).toLowerCase();
  const llave = `a:${usuario}:${req.ip}`;
  const espera = bloqueado(llave);
  if (espera) return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${espera} min.` });
  const a = getDB().admins.find((x) => x.usuario === usuario);
  if (!a || !claveValida(String(req.body.clave ?? ""), a.claveHash)) {
    falla(llave);
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  exito(llave);
  res.json({ token: crearToken({ rol: "admin", id: a.id }), nombre: a.nombre });
});

// ---------- Portal de familias ----------
const fam = express.Router();
fam.use(requiere("familia"));

fam.get("/me", (req, res) => {
  const d = getDB();
  const r = d.responsables.find((x) => x.id === req.sesion!.id)!;
  const cargos = d.cargos.filter((c) => c.responsableId === r.id && !c.anulado).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const enRevision = new Set(d.comprobantes.filter((c) => c.responsableId === r.id && c.estado === "pendiente").flatMap((c) => c.cargoIds));
  res.json({
    responsable: vistaResp(r),
    alumnos: d.alumnos.filter((a) => a.responsableIds.includes(r.id) && a.activo).map((a) => ({ id: a.id, nombre: nombreAlumno(a), nivel: a.nivel, curso: a.curso })),
    cargos: cargos.map((c) => ({ ...vistaCargo(c), enRevision: enRevision.has(c.id) })),
    pagos: d.pagos.filter((p) => p.responsableId === r.id && !p.anulado).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(vistaPago),
    comprobantes: d.comprobantes.filter((c) => c.responsableId === r.id).sort((a, b) => b.creado.localeCompare(a.creado)).map(vistaComprobante),
    banco: { colegio: d.ajustes.colegio, banco: d.ajustes.banco, titular: d.ajustes.titular, cbu: d.ajustes.cbu, alias: d.ajustes.alias, cuit: d.ajustes.cuit },
  });
});

fam.post("/clave", (req, res) => {
  const r = getDB().responsables.find((x) => x.id === req.sesion!.id)!;
  const actual = String(req.body.actual ?? "");
  const nueva = String(req.body.nueva ?? "");
  if (!claveValida(actual, r.claveHash)) return rechazar("La contraseña actual no es correcta");
  if (nueva.length < 6) return rechazar("La nueva contraseña debe tener al menos 6 caracteres");
  if (nueva === r.dni) return rechazar("Elegí una contraseña distinta de tu DNI");
  r.claveHash = hashClave(nueva);
  r.debeCambiarClave = false;
  res.json({ ok: true });
});

const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

fam.post("/comprobantes", (req, res) => {
  const d = getDB();
  const r = d.responsables.find((x) => x.id === req.sesion!.id)!;
  const cargoIds: string[] = Array.isArray(req.body.cargoIds) ? req.body.cargoIds.map(String) : [];
  const cargos = cargoIds.map((id) => d.cargos.find((c) => c.id === id && c.responsableId === r.id && !c.anulado && pendienteDe(c) > 0));
  if (!cargos.length || cargos.some((c) => !c)) rechazar("Elegí al menos una cuota pendiente");
  const yaInformadas = d.comprobantes.some((c) => c.estado === "pendiente" && c.cargoIds.some((id) => cargoIds.includes(id)));
  if (yaInformadas) rechazar("Alguna de esas cuotas ya tiene un comprobante en revisión");
  const importe = num(req.body.importe);
  if (!(importe > 0)) rechazar("Indicá el importe transferido");
  const fechaPago = fechaOk(req.body.fechaPago);
  if (fechaPago > hoy()) rechazar("La fecha de la transferencia no puede ser futura");
  const arch = req.body.archivo ?? {};
  const tipo = str(arch.tipo, 60);
  const ext = TIPOS[tipo];
  if (!ext) rechazar("El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF");
  const buf = Buffer.from(String(arch.base64 ?? ""), "base64");
  if (buf.length < 100) rechazar("El archivo está vacío o dañado");
  if (buf.length > 6 * 1024 * 1024) rechazar("El archivo supera los 6 MB");
  const id = uid();
  const ruta = `${id}.${ext}`;
  fs.writeFileSync(path.join(ARCHIVOS_DIR, ruta), buf);
  const cp: Comprobante = {
    id, responsableId: r.id, creado: new Date().toISOString(), fechaPago, importe, cargoIds,
    archivo: { nombre: str(arch.nombre, 120) || `comprobante.${ext}`, tipo, ruta }, nota: str(req.body.nota, 500), estado: "pendiente", motivo: "",
  };
  d.comprobantes.push(cp);
  res.json(vistaComprobante(cp));
});

fam.get("/comprobantes/:id/archivo", (req, res) => {
  const cp = getDB().comprobantes.find((x) => x.id === req.params.id && x.responsableId === req.sesion!.id);
  if (!cp) return res.status(404).end();
  res.type(cp.archivo.tipo).sendFile(path.join(ARCHIVOS_DIR, cp.archivo.ruta));
});

// ---------- Administración ----------
const adm = express.Router();
adm.use(requiere("admin"));

adm.get("/resumen", (_req, res) => {
  const d = getDB();
  const h = hoy();
  const cargos = d.cargos.filter((c) => !c.anulado);
  const pend = cargos.filter((c) => pendienteDe(c) > 0);
  const vencidas = pend.filter((c) => c.vencimiento < h);
  const mes = h.slice(0, 7);
  const anio = d.ajustes.cicloLectivo;
  const res1 = estadoResultados(`${anio}-01-01`, `${anio}-12-31`);
  const mesRes = estadoResultados(`${mes}-01`, `${mes}-31`);
  const deudaPorFamilia = new Map<string, number>();
  for (const c of vencidas) deudaPorFamilia.set(c.responsableId, (deudaPorFamilia.get(c.responsableId) ?? 0) + pendienteDe(c));
  const morosos = [...deudaPorFamilia.entries()]
    .map(([id, monto]) => ({ id, familia: nombreResp(d.responsables.find((r) => r.id === id)), monto: redondear(monto) }))
    .sort((a, b) => b.monto - a.monto).slice(0, 5);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    const e = estadoResultados(`${anio}-${m}-01`, `${anio}-${m}-31`);
    return { mes: i + 1, ingresos: e.totalIngresos, egresos: e.totalEgresos, cobrado: e.cobrado };
  });
  res.json({
    alumnos: d.alumnos.filter((a) => a.activo).length,
    familias: d.responsables.filter((r) => r.activo).length,
    porCobrar: redondear(pend.reduce((s, c) => s + pendienteDe(c), 0)),
    vencido: redondear(vencidas.reduce((s, c) => s + pendienteDe(c), 0)),
    comprobantesPendientes: d.comprobantes.filter((c) => c.estado === "pendiente").length,
    cobradoMes: mesRes.cobrado, resultadoAnio: res1.resultado, ingresosAnio: res1.totalIngresos, egresosAnio: res1.totalEgresos,
    morosos, meses, ciclo: anio,
  });
});

// Alumnos y familias
adm.get("/alumnos", (_req, res) => {
  const d = getDB();
  res.json(d.alumnos.map((a) => ({
    ...a, nombreCompleto: nombreAlumno(a),
    responsables: a.responsableIds.map((id) => d.responsables.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r!.id, nombre: nombreResp(r), dni: r!.dni })),
    pagador: nombreResp(d.responsables.find((r) => r.id === a.pagadorId)),
  })));
});

function datosAlumno(b: Record<string, unknown>, actual?: Alumno): Alumno {
  const d = getDB();
  const nivel = str(b.nivel) as Nivel;
  if (!["Inicial", "Primario", "Secundario"].includes(nivel)) rechazar("Elegí el nivel");
  const apellido = str(b.apellido, 80), nombre = str(b.nombre, 80);
  if (!apellido || !nombre) rechazar("Completá apellido y nombre del alumno");
  const responsableIds = (Array.isArray(b.responsableIds) ? b.responsableIds : []).map(String).filter((id) => d.responsables.some((r) => r.id === id));
  if (!responsableIds.length) rechazar("El alumno necesita al menos un padre, madre o tutor");
  const pagadorId = responsableIds.includes(String(b.pagadorId)) ? String(b.pagadorId) : responsableIds[0];
  const beca = Math.min(100, Math.max(0, num(b.becaPct)));
  return { id: actual?.id ?? uid(), dni: soloDigitos(b.dni), apellido, nombre, nivel, curso: str(b.curso, 30), responsableIds, pagadorId, becaPct: beca, activo: b.activo === undefined ? actual?.activo ?? true : Boolean(b.activo) };
}
adm.post("/alumnos", (req, res) => { const a = datosAlumno(req.body); getDB().alumnos.push(a); res.json(a); });
adm.put("/alumnos/:id", (req, res) => {
  const d = getDB();
  const i = d.alumnos.findIndex((a) => a.id === req.params.id);
  if (i < 0) return rechazar("Alumno inexistente");
  d.alumnos[i] = datosAlumno(req.body, d.alumnos[i]);
  res.json(d.alumnos[i]);
});

adm.get("/responsables", (_req, res) => {
  const d = getDB();
  res.json(d.responsables.map((r) => {
    const cs = d.cargos.filter((c) => c.responsableId === r.id && !c.anulado && pendienteDe(c) > 0);
    return {
      ...vistaResp(r),
      alumnos: d.alumnos.filter((a) => a.responsableIds.includes(r.id)).map(nombreAlumno),
      deuda: redondear(cs.reduce((s, c) => s + pendienteDe(c), 0)),
      vencido: redondear(cs.filter((c) => c.vencimiento < hoy()).reduce((s, c) => s + pendienteDe(c), 0)),
    };
  }));
});
adm.post("/responsables", (req, res) => {
  const d = getDB();
  const dni = soloDigitos(req.body.dni);
  if (dni.length < 7 || dni.length > 9) rechazar("El DNI debe tener entre 7 y 9 dígitos");
  if (d.responsables.some((r) => r.dni === dni)) rechazar("Ya existe una persona con ese DNI");
  const apellido = str(req.body.apellido, 80), nombre = str(req.body.nombre, 80);
  if (!apellido || !nombre) rechazar("Completá apellido y nombre");
  const r: Responsable = { id: uid(), dni, apellido, nombre, telefono: str(req.body.telefono, 40), email: str(req.body.email, 120), claveHash: hashClave(dni), debeCambiarClave: true, saldoAFavor: 0, activo: true, creado: hoy() };
  d.responsables.push(r);
  res.json(vistaResp(r));
});
adm.put("/responsables/:id", (req, res) => {
  const d = getDB();
  const r = d.responsables.find((x) => x.id === req.params.id);
  if (!r) return rechazar("Persona inexistente");
  const dni = soloDigitos(req.body.dni);
  if (dni.length < 7 || dni.length > 9) rechazar("El DNI debe tener entre 7 y 9 dígitos");
  if (d.responsables.some((x) => x.dni === dni && x.id !== r.id)) rechazar("Ya existe otra persona con ese DNI");
  r.dni = dni; r.apellido = str(req.body.apellido, 80) || r.apellido; r.nombre = str(req.body.nombre, 80) || r.nombre;
  r.telefono = str(req.body.telefono, 40); r.email = str(req.body.email, 120);
  if (req.body.activo !== undefined) r.activo = Boolean(req.body.activo);
  res.json(vistaResp(r));
});
adm.post("/responsables/:id/reiniciar-clave", (req, res) => {
  const r = getDB().responsables.find((x) => x.id === req.params.id);
  if (!r) return rechazar("Persona inexistente");
  r.claveHash = hashClave(r.dni);
  r.debeCambiarClave = true;
  res.json({ ok: true });
});
adm.get("/responsables/:id/cuenta", (req, res) => {
  const d = getDB();
  const r = d.responsables.find((x) => x.id === req.params.id);
  if (!r) return rechazar("Persona inexistente");
  res.json({
    responsable: vistaResp(r),
    cargos: d.cargos.filter((c) => c.responsableId === r.id && !c.anulado).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento)).map(vistaCargo),
    pagos: d.pagos.filter((p) => p.responsableId === r.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(vistaPago),
  });
});
adm.post("/responsables/:id/aplicar-saldo", (req, res) => {
  res.json(vistaPago(aplicarSaldoAFavor(req.params.id, hoy())));
});

// Conceptos y cargos
adm.get("/conceptos", (_req, res) => res.json(getDB().conceptos));
function datosConcepto(b: Record<string, unknown>, id?: string) {
  const d = getDB();
  const nombre = str(b.nombre, 80);
  if (!nombre) rechazar("Poné un nombre al concepto");
  const tipo = str(b.tipo) as "cuota" | "matricula" | "actividad" | "otro";
  if (!["cuota", "matricula", "actividad", "otro"].includes(tipo)) rechazar("Tipo inválido");
  const cuenta = str(b.cuenta);
  if (!d.cuentas.some((c) => c.codigo === cuenta && c.tipo === "Ingreso" && c.imputable)) rechazar("Elegí una cuenta de ingresos válida");
  return { id: id ?? uid(), nombre, tipo, importe: num(b.importe), cuenta, activo: b.activo === undefined ? true : Boolean(b.activo) };
}
adm.post("/conceptos", (req, res) => { const c = datosConcepto(req.body); getDB().conceptos.push(c); res.json(c); });
adm.put("/conceptos/:id", (req, res) => {
  const d = getDB();
  const i = d.conceptos.findIndex((c) => c.id === req.params.id);
  if (i < 0) return rechazar("Concepto inexistente");
  d.conceptos[i] = datosConcepto(req.body, d.conceptos[i].id);
  res.json(d.conceptos[i]);
});

adm.get("/cargos", (req, res) => {
  const d = getDB();
  const estado = str(req.query.estado);
  let l = d.cargos.filter((c) => !c.anulado);
  if (req.query.responsableId) l = l.filter((c) => c.responsableId === req.query.responsableId);
  if (req.query.alumnoId) l = l.filter((c) => c.alumnoId === req.query.alumnoId);
  const out = l.map(vistaCargo).filter((c) => !estado || (estado === "deuda" ? c.pendiente > 0 : c.estado === estado));
  out.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  res.json(out);
});

/** Genera cargos masivos (cuota del mes, matrícula, campamento…) para un conjunto de alumnos. */
adm.post("/cargos/generar", (req, res) => {
  const d = getDB();
  const concepto = d.conceptos.find((c) => c.id === req.body.conceptoId && c.activo);
  if (!concepto) return rechazar("Elegí un concepto");
  const vencimiento = fechaOk(req.body.vencimiento);
  const emision = req.body.emision ? fechaOk(req.body.emision) : hoy();
  const periodo = /^\d{4}-\d{2}$/.test(str(req.body.periodo)) ? str(req.body.periodo) : vencimiento.slice(0, 7);
  const importe = req.body.importe === "" || req.body.importe == null ? undefined : num(req.body.importe);
  if (importe !== undefined && importe < 0) rechazar("El importe no puede ser negativo");
  const ids: string[] | null = Array.isArray(req.body.alumnoIds) ? req.body.alumnoIds.map(String) : null;
  const niveles: string[] = Array.isArray(req.body.niveles) ? req.body.niveles.map(String) : [];
  const alumnos = d.alumnos.filter((a) => a.activo && (ids ? ids.includes(a.id) : !niveles.length || niveles.includes(a.nivel)));
  if (!alumnos.length) rechazar("No hay alumnos que cumplan la selección");
  let creados = 0, omitidos = 0, total = 0;
  for (const a of alumnos) {
    const c = crearCargo({ alumno: a, concepto, periodo, emision, vencimiento, importe, descripcion: str(req.body.descripcion, 120) || undefined });
    if (c) { creados++; total += c.importe; } else omitidos++;
  }
  res.json({ creados, omitidos, total: redondear(total) });
});
adm.post("/cargos/:id/anular", (req, res) => { anularCargo(req.params.id); res.json({ ok: true }); });

// Cobranzas
adm.get("/pagos", (_req, res) => res.json(getDB().pagos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero)).map(vistaPago)));
adm.post("/pagos", (req, res) => {
  const medio = ["efectivo", "transferencia", "otro"].includes(str(req.body.medio)) ? (str(req.body.medio) as "efectivo") : rechazar("Elegí el medio de pago");
  const p = registrarPago({
    responsableId: str(req.body.responsableId), fecha: fechaOk(req.body.fecha), medio, importe: num(req.body.importe),
    cargoIds: Array.isArray(req.body.cargoIds) ? req.body.cargoIds.map(String) : [], observacion: str(req.body.observacion, 300),
  });
  res.json(vistaPago(p));
});
adm.post("/pagos/:id/anular", (req, res) => { anularPago(req.params.id); res.json({ ok: true }); });

adm.get("/comprobantes", (req, res) => {
  const estado = str(req.query.estado);
  res.json(getDB().comprobantes.filter((c) => !estado || c.estado === estado).sort((a, b) => b.creado.localeCompare(a.creado)).map(vistaComprobante));
});
adm.get("/comprobantes/:id/archivo", (req, res) => {
  const cp = getDB().comprobantes.find((x) => x.id === req.params.id);
  if (!cp) return res.status(404).end();
  res.type(cp.archivo.tipo).sendFile(path.join(ARCHIVOS_DIR, cp.archivo.ruta));
});
adm.post("/comprobantes/:id/aprobar", (req, res) => {
  const d = getDB();
  const cp = d.comprobantes.find((x) => x.id === req.params.id);
  if (!cp) return rechazar("Comprobante inexistente");
  if (cp.estado !== "pendiente") rechazar("Ese comprobante ya fue resuelto");
  const importe = req.body.importe != null && req.body.importe !== "" ? num(req.body.importe) : cp.importe;
  const cargoIds = Array.isArray(req.body.cargoIds) && req.body.cargoIds.length ? req.body.cargoIds.map(String) : cp.cargoIds;
  const p = registrarPago({
    responsableId: cp.responsableId, fecha: req.body.fecha ? fechaOk(req.body.fecha) : cp.fechaPago, medio: "transferencia",
    importe, cargoIds, observacion: `Transferencia informada online${cp.nota ? ` · ${cp.nota}` : ""}`, comprobanteId: cp.id,
  });
  cp.estado = "aprobado"; cp.pagoId = p.id; cp.resuelto = new Date().toISOString(); cp.motivo = "";
  res.json({ comprobante: vistaComprobante(cp), pago: vistaPago(p) });
});
adm.post("/comprobantes/:id/rechazar", (req, res) => {
  const cp = getDB().comprobantes.find((x) => x.id === req.params.id);
  if (!cp) return rechazar("Comprobante inexistente");
  if (cp.estado !== "pendiente") rechazar("Ese comprobante ya fue resuelto");
  const motivo = str(req.body.motivo, 300);
  if (!motivo) rechazar("Escribí el motivo para que la familia lo vea");
  cp.estado = "rechazado"; cp.motivo = motivo; cp.resuelto = new Date().toISOString();
  res.json(vistaComprobante(cp));
});

// Gastos
adm.get("/gastos", (_req, res) => {
  const d = getDB();
  res.json(d.gastos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero)).map((g) => ({ ...g, cuentaNombre: d.cuentas.find((c) => c.codigo === g.cuenta)?.nombre ?? g.cuenta })));
});
adm.post("/gastos", (req, res) => {
  const d = getDB();
  const cuenta = str(req.body.cuenta);
  if (!d.cuentas.some((c) => c.codigo === cuenta && c.tipo === "Egreso" && c.imputable)) rechazar("Elegí una cuenta de gasto");
  const medio = str(req.body.medio) as Gasto["medio"];
  if (!["caja", "banco", "apagar"].includes(medio)) rechazar("Elegí cómo se paga");
  const importe = num(req.body.importe);
  if (!(importe > 0)) rechazar("El importe debe ser mayor a cero");
  const g: Gasto = {
    id: uid(), numero: numeroFormateado("GT", siguiente("gasto")), fecha: fechaOk(req.body.fecha), proveedor: str(req.body.proveedor, 100) || rechazar("Indicá el proveedor"),
    cuenta, detalle: str(req.body.detalle, 200), importe, medio, nroComprobante: str(req.body.nroComprobante, 40), anulado: false, asientoId: "",
  };
  d.gastos.push(g);
  g.asientoId = asientoGasto(g).id;
  res.json(g);
});
adm.post("/gastos/:id/anular", (req, res) => {
  const g = getDB().gastos.find((x) => x.id === req.params.id);
  if (!g) return rechazar("Gasto inexistente");
  if (g.anulado) rechazar("Ya está anulado");
  g.anulado = true;
  anularAsiento(g.asientoId);
  res.json({ ok: true });
});
/** Cancela un gasto que estaba "a pagar": debe Proveedores, haber Caja o Banco. */
adm.post("/gastos/:id/pagar", (req, res) => {
  const d = getDB();
  const g = d.gastos.find((x) => x.id === req.params.id);
  if (!g || g.anulado) return rechazar("Gasto inexistente");
  if (g.medio !== "apagar" || g.pagadoEn) rechazar("Este gasto no tiene deuda pendiente con el proveedor");
  const contra = str(req.body.medio) === "caja" ? CTA.caja : CTA.banco;
  const fecha = fechaOk(req.body.fecha);
  nuevoAsiento(fecha, `Pago a proveedor ${g.proveedor} · ${g.numero}`, { tipo: "manual", id: g.id }, [
    { cuenta: CTA.proveedores, debe: g.importe, haber: 0 },
    { cuenta: contra, debe: 0, haber: g.importe },
  ]);
  g.pagadoEn = fecha;
  res.json(g);
});

// Contabilidad
adm.get("/cuentas", (_req, res) => res.json(getDB().cuentas));
adm.post("/cuentas", (req, res) => {
  const d = getDB();
  const codigo = str(req.body.codigo, 20);
  if (!/^\d+(\.\d+)*$/.test(codigo)) rechazar("El código debe ser numérico con puntos, por ejemplo 5.2.10");
  if (d.cuentas.some((c) => c.codigo === codigo)) rechazar("Ya existe una cuenta con ese código");
  const tipo = str(req.body.tipo);
  if (!["Activo", "Pasivo", "Patrimonio", "Ingreso", "Egreso"].includes(tipo)) rechazar("Tipo de cuenta inválido");
  const nombre = str(req.body.nombre, 100) || rechazar("Poné un nombre a la cuenta");
  const cuenta = { codigo, nombre, tipo: tipo as "Activo", imputable: req.body.imputable !== false };
  d.cuentas.push(cuenta);
  d.cuentas.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  res.json(cuenta);
});
adm.get("/asientos", (req, res) => {
  const desde = str(req.query.desde) || "0000-01-01", hasta = str(req.query.hasta) || "9999-12-31";
  res.json(getDB().asientos.filter((a) => a.fecha >= desde && a.fecha <= hasta).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero));
});
adm.post("/asientos", (req, res) => {
  const d = getDB();
  const lineas = (Array.isArray(req.body.lineas) ? req.body.lineas : []).map((l: Record<string, unknown>) => ({ cuenta: str(l.cuenta), debe: num(l.debe), haber: num(l.haber) }));
  for (const l of lineas) if (!d.cuentas.some((c) => c.codigo === l.cuenta && c.imputable)) rechazar(`La cuenta ${l.cuenta || "(vacía)"} no es válida`);
  const a = nuevoAsiento(fechaOk(req.body.fecha), str(req.body.descripcion, 200) || rechazar("Poné una descripción"), { tipo: "manual", id: "manual" }, lineas);
  res.json(a);
});
adm.post("/asientos/:id/anular", (req, res) => {
  const a = getDB().asientos.find((x) => x.id === req.params.id);
  if (!a) return rechazar("Asiento inexistente");
  if (a.origen.tipo !== "manual") rechazar("Este asiento nace de un cargo, recibo o gasto: anulalo desde su pantalla");
  a.anulado = true;
  res.json({ ok: true });
});
adm.get("/reportes/resultados", (req, res) => res.json(estadoResultados(fechaOk(req.query.desde), fechaOk(req.query.hasta))));
adm.get("/reportes/balance", (req, res) => res.json(sumasYSaldos(fechaOk(req.query.hasta))));
adm.get("/reportes/mayor", (req, res) => res.json(mayor(str(req.query.cuenta), fechaOk(req.query.desde), fechaOk(req.query.hasta))));

// Ajustes
adm.get("/ajustes", (_req, res) => res.json({ ...getDB().ajustes, demo: getDB().demo }));
adm.put("/ajustes", (req, res) => {
  const a = getDB().ajustes;
  for (const k of ["colegio", "cuit", "direccion", "telefono", "email", "banco", "titular", "cbu", "alias"] as const) if (req.body[k] !== undefined) a[k] = str(req.body[k], 150);
  if (req.body.diaVencimiento !== undefined) a.diaVencimiento = Math.min(28, Math.max(1, Math.round(num(req.body.diaVencimiento))));
  if (req.body.cicloLectivo !== undefined) a.cicloLectivo = Math.min(2100, Math.max(2000, Math.round(num(req.body.cicloLectivo))));
  res.json(a);
});
adm.post("/ajustes/clave", (req, res) => {
  const a = getDB().admins.find((x) => x.id === req.sesion!.id)!;
  if (!claveValida(String(req.body.actual ?? ""), a.claveHash)) rechazar("La contraseña actual no es correcta");
  const nueva = String(req.body.nueva ?? "");
  if (nueva.length < 6) rechazar("La nueva contraseña debe tener al menos 6 caracteres");
  a.claveHash = hashClave(nueva);
  res.json({ ok: true });
});
/** Borra alumnos, familias, cargos, recibos, gastos y asientos; conserva el plan de cuentas, los conceptos y los ajustes. */
adm.post("/ajustes/limpiar-datos", (req, res) => {
  if (str(req.body.confirmar) !== "BORRAR") rechazar('Escribí BORRAR para confirmar');
  const d = getDB();
  Object.assign(d, { responsables: [], alumnos: [], cargos: [], pagos: [], comprobantes: [], gastos: [], asientos: [], contadores: {}, demo: false });
  for (const f of fs.readdirSync(ARCHIVOS_DIR)) fs.rmSync(path.join(ARCHIVOS_DIR, f), { force: true });
  res.json({ ok: true });
});
adm.post("/ajustes/cargar-ejemplo", (_req, res) => {
  const d = getDB();
  if (d.responsables.length || d.asientos.length) rechazar("Solo se pueden cargar datos de ejemplo en una base vacía");
  cargarDemo();
  res.json({ ok: true });
});

app.use("/api/familia", fam);
app.use("/api/admin", adm);
app.use("/api", api);

// ---------- Web compilada (producción) ----------
const aqui = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(aqui, "..", "..", "web", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// ---------- Errores ----------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Rechazo) return res.status(400).json({ error: err.message });
  if (err.message?.startsWith("El asiento") || err.message?.startsWith("Un asiento")) return res.status(400).json({ error: err.message });
  if ((err as { type?: string }).type === "entity.too.large") return res.status(413).json({ error: "El archivo es demasiado grande" });
  if (/^(Responsable|Cargo|Recibo|El cargo|El recibo|No hay saldo|El saldo|El importe)/.test(err.message)) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado en el servidor" });
});

const PORT = Number(process.env.PORT || 4500);
app.listen(PORT, () => console.log(`API Instituto Santísima Trinidad en http://localhost:${PORT}`));
process.on("SIGINT", () => { guardarAhora(); process.exit(0); });
process.on("SIGTERM", () => { guardarAhora(); process.exit(0); });
void vacia;
