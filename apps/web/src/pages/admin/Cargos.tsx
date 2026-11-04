import { useMemo, useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { ESTADO_CARGO, fecha, hoyISO, pesos } from "../../lib/format";
import type { CargoAdm } from "../../components/RegistrarPago";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Pestanas, Vacio, useCarga } from "../../components/ui";

interface Concepto { id: string; nombre: string; tipo: "cuota" | "matricula" | "actividad" | "otro"; importe: number; cuenta: string; activo: boolean }
interface Cuenta { codigo: string; nombre: string; tipo: string; imputable: boolean }
interface AlumnoMin { id: string; nombreCompleto: string; nivel: string; curso: string; activo: boolean; becaPct: number }

const TIPOS = { cuota: "Cuota mensual", matricula: "Matrícula", actividad: "Actividad extra", otro: "Otro" };

export default function Cargos() {
  const [tab, setTab] = useState<"generar" | "conceptos" | "emitidos">("generar");
  return (
    <>
      <Cabecera titulo="Cuotas y actividades" subtitulo="Generá las cuotas del mes, la matrícula o actividades como campamentos y salidas." />
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: "generar", texto: "Generar cargos" }, { id: "conceptos", texto: "Conceptos e importes" }, { id: "emitidos", texto: "Cargos emitidos" }]} />
      {tab === "generar" && <Generar />}
      {tab === "conceptos" && <Conceptos />}
      {tab === "emitidos" && <Emitidos />}
    </>
  );
}

function Generar() {
  const conceptos = useCarga(() => api<Concepto[]>("/admin/conceptos"));
  const alumnos = useCarga(() => api<AlumnoMin[]>("/admin/alumnos"));
  const ajustes = useCarga(() => api<{ diaVencimiento: number }>("/admin/ajustes"));
  const hoy = hoyISO();
  const [conceptoId, setConceptoId] = useState("");
  const [periodo, setPeriodo] = useState(hoy.slice(0, 7));
  const [venc, setVenc] = useState("");
  const [importe, setImporte] = useState("");
  const [desc, setDesc] = useState("");
  const [destino, setDestino] = useState<"todos" | "niveles" | "elegir">("todos");
  const [niveles, setNiveles] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number; total: number } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const lista = (conceptos.data ?? []).filter((c) => c.activo);
  const concepto = lista.find((c) => c.id === (conceptoId || lista[0]?.id));
  const activos = (alumnos.data ?? []).filter((a) => a.activo);
  const destinatarios = destino === "todos" ? activos : destino === "niveles" ? activos.filter((a) => niveles.includes(a.nivel)) : activos.filter((a) => elegidos.includes(a.id));
  const vencimiento = venc || `${periodo}-${String(ajustes.data?.diaVencimiento ?? 10).padStart(2, "0")}`;
  const unitario = importe !== "" ? Number(importe) : concepto?.importe ?? 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!concepto) return;
    if (!window.confirm(`Se generarán cargos de "${concepto.nombre}" para ${destinatarios.length} alumnos. ¿Continuar?`)) return;
    setError(""); setResultado(null); setEnviando(true);
    try {
      const r = await api<{ creados: number; omitidos: number; total: number }>("/admin/cargos/generar", {
        cuerpo: {
          conceptoId: concepto.id, periodo, vencimiento, importe: importe === "" ? null : Number(importe), descripcion: desc,
          ...(destino === "elegir" ? { alumnoIds: elegidos } : destino === "niveles" ? { niveles } : {}),
        },
      });
      setResultado(r);
    } catch (err) { setError(mensajeError(err)); } finally { setEnviando(false); }
  }

  const filtrados = activos.filter((a) => a.nombreCompleto.toLowerCase().includes(buscar.toLowerCase()));
  const alternar = (id: string) => setElegidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  if (!conceptos.data || !alumnos.data) return <Cargando />;
  return (
    <form onSubmit={enviar} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Concepto">
            <select className="input" value={concepto?.id ?? ""} onChange={(e) => setConceptoId(e.target.value)}>
              {lista.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {pesos(c.importe)}</option>)}
            </select>
          </Campo>
          <Campo label="Período" ayuda="Mes al que corresponde."><input className="input" type="month" required value={periodo} onChange={(e) => { setPeriodo(e.target.value); setVenc(""); }} /></Campo>
          <Campo label="Vencimiento"><input className="input" type="date" required value={vencimiento} onChange={(e) => setVenc(e.target.value)} /></Campo>
          <Campo label="Importe por alumno" ayuda="Dejalo vacío para usar el importe del concepto."><input className="input" type="number" min="0" step="0.01" placeholder={String(concepto?.importe ?? "")} value={importe} onChange={(e) => setImporte(e.target.value)} /></Campo>
        </div>
        {concepto && concepto.tipo !== "cuota" && (
          <Campo label="Descripción" ayuda="Ej.: Campamento Villa Giardino 2026. Si la dejás vacía se usa el nombre del concepto."><input className="input" maxLength={120} value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
        )}

        <div>
          <span className="label">¿A quiénes?</span>
          <div className="flex flex-wrap gap-2">
            {([["todos", "Todos los alumnos"], ["niveles", "Por nivel"], ["elegir", "Elegir alumnos"]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setDestino(k)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${destino === k ? "border-marca bg-marca-claro text-marca" : "border-borde text-suave hover:bg-fondo"}`}>{t}</button>
            ))}
          </div>
          {destino === "niveles" && (
            <div className="mt-3 flex flex-wrap gap-4">
              {["Inicial", "Primario", "Secundario"].map((n) => (
                <label key={n} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-marca" checked={niveles.includes(n)} onChange={() => setNiveles((l) => (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]))} />{n}</label>
              ))}
            </div>
          )}
          {destino === "elegir" && (
            <div className="mt-3 rounded-xl border border-borde">
              <input className="input rounded-b-none border-0 border-b" placeholder="Buscar alumno…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <ul className="max-h-52 overflow-y-auto">
                {filtrados.map((a) => (
                  <li key={a.id}><label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-fondo/60"><input type="checkbox" className="accent-marca" checked={elegidos.includes(a.id)} onChange={() => alternar(a.id)} />{a.nombreCompleto}<span className="text-tenue">· {a.curso || a.nivel}</span></label></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <ErrorBox error={error} />
        {resultado && (
          <p className="rounded-xl bg-ok-claro px-4 py-3 text-sm text-ok" role="status">
            Se generaron <strong>{resultado.creados}</strong> cargos por {pesos(resultado.total)}.{resultado.omitidos > 0 && ` ${resultado.omitidos} ya existían y se omitieron.`}
          </p>
        )}
      </div>

      <aside className="card h-fit space-y-3 p-6">
        <h2 className="text-base">Resumen</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-suave">Alumnos alcanzados</dt><dd className="font-medium">{destinatarios.length}</dd></div>
          <div className="flex justify-between"><dt className="text-suave">Importe base</dt><dd className="font-medium tabular-nums">{pesos(unitario)}</dd></div>
          <div className="flex justify-between"><dt className="text-suave">Con becas</dt><dd className="font-medium">{destinatarios.filter((a) => a.becaPct > 0).length} alumnos</dd></div>
          <div className="flex justify-between border-t border-borde pt-2"><dt className="text-suave">A facturar (aprox.)</dt>
            <dd className="font-semibold tabular-nums">{pesos(destinatarios.reduce((s, a) => s + (concepto && (concepto.tipo === "cuota" || concepto.tipo === "matricula") ? unitario * (1 - a.becaPct / 100) : unitario), 0))}</dd></div>
        </dl>
        <p className="text-xs text-tenue">Cada cargo genera su asiento contable (deudores contra ingresos) y aparece en el portal de la familia. Si ya existe el mismo cargo para un alumno, se omite.</p>
        <button className="btn-primary w-full" disabled={enviando || destinatarios.length === 0}>{enviando ? "Generando…" : `Generar ${destinatarios.length} cargos`}</button>
      </aside>
    </form>
  );
}

function Conceptos() {
  const { data, error, recargar } = useCarga(() => api<Concepto[]>("/admin/conceptos"));
  const cuentas = useCarga(() => api<Cuenta[]>("/admin/cuentas"));
  const [edit, setEdit] = useState<Concepto | "nuevo" | null>(null);
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-borde p-4">
        <p className="text-sm text-suave">Importes vigentes y cuenta contable donde se registra cada ingreso.</p>
        <button className="btn-primary btn-sm" onClick={() => setEdit("nuevo")}><Icon name="mas" size={15} />Nuevo concepto</button>
      </div>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Concepto</th><th>Tipo</th><th>Cuenta de ingreso</th><th className="num">Importe</th><th /></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className={c.activo ? "" : "text-tenue"}>
                  <td className="font-medium">{c.nombre}{!c.activo && <Chip clase="ml-2 bg-fondo text-tenue">Inactivo</Chip>}</td>
                  <td>{TIPOS[c.tipo]}</td>
                  <td className="text-suave">{c.cuenta} · {cuentas.data?.find((x) => x.codigo === c.cuenta)?.nombre}</td>
                  <td className="num font-medium">{pesos(c.importe)}</td>
                  <td className="num"><button className="btn-ghost btn-sm" onClick={() => setEdit(c)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && cuentas.data && <FormConcepto concepto={edit === "nuevo" ? null : edit} cuentas={cuentas.data.filter((c) => c.tipo === "Ingreso" && c.imputable)} onClose={() => setEdit(null)} onListo={() => { setEdit(null); void recargar(); }} />}
    </div>
  );
}

function FormConcepto({ concepto, cuentas, onClose, onListo }: { concepto: Concepto | null; cuentas: Cuenta[]; onClose: () => void; onListo: () => void }) {
  const [f, setF] = useState({ nombre: concepto?.nombre ?? "", tipo: concepto?.tipo ?? "actividad", importe: String(concepto?.importe ?? ""), cuenta: concepto?.cuenta ?? "4.1.03", activo: concepto?.activo ?? true });
  const [error, setError] = useState("");
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const cuerpo = { ...f, importe: Number(f.importe) };
      if (concepto) await api(`/admin/conceptos/${concepto.id}`, { metodo: "PUT", cuerpo }); else await api("/admin/conceptos", { cuerpo });
      onListo();
    } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo={concepto ? "Editar concepto" : "Nuevo concepto"} onClose={onClose} ancho="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <Campo label="Nombre"><input className="input" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej.: Campamento 2026" /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo"><select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Concepto["tipo"] })}>{Object.entries(TIPOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
          <Campo label="Importe"><input className="input" type="number" min="0" step="0.01" required value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} /></Campo>
        </div>
        <Campo label="Cuenta de ingreso"><select className="input" value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value })}>{cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}</select></Campo>
        {concepto && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-marca" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} />Concepto activo</label>}
        <p className="text-xs text-tenue">Cambiar el importe no modifica cargos ya generados, solo los próximos.</p>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary">Guardar</button></div>
      </form>
    </Modal>
  );
}

function Emitidos() {
  const [estado, setEstado] = useState("");
  const [q, setQ] = useState("");
  const { data, error, recargar } = useCarga(() => api<CargoAdm[]>(`/admin/cargos${estado ? `?estado=${estado}` : ""}`), [estado]);
  const [err, setErr] = useState("");
  const lista = useMemo(() => (data ?? []).filter((c) => `${c.alumno} ${c.descripcion} ${c.numero}`.toLowerCase().includes(q.toLowerCase())).slice().reverse(), [data, q]);
  const anular = async (c: CargoAdm) => {
    if (!window.confirm(`¿Anular el cargo ${c.numero} (${c.descripcion})?`)) return;
    setErr("");
    try { await api(`/admin/cargos/${c.id}/anular`, { cuerpo: {} }); await recargar(); } catch (e) { setErr(mensajeError(e)); }
  };
  return (
    <div className="card">
      <div className="flex flex-wrap gap-3 border-b border-borde p-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Icon name="buscar" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue" />
          <input className="input pl-10" placeholder="Buscar alumno o concepto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option><option value="deuda">Con saldo</option><option value="vencido">Vencidas</option><option value="pagado">Pagadas</option>
        </select>
      </div>
      <ErrorBox error={error || err} />
      {!data ? <Cargando /> : lista.length === 0 ? <Vacio texto="No hay cargos para mostrar." icono="cargos" /> : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>N°</th><th>Alumno</th><th>Concepto</th><th>Vence</th><th className="num">Importe</th><th className="num">Saldo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.slice(0, 300).map((c) => (
                <tr key={c.id}>
                  <td className="text-tenue">{c.numero}</td><td className="font-medium">{c.alumno}</td><td>{c.descripcion}</td><td>{fecha(c.vencimiento)}</td>
                  <td className="num">{pesos(c.importe)}</td><td className="num font-medium">{pesos(c.pendiente)}</td>
                  <td><Chip clase={ESTADO_CARGO[c.estado].clase}>{ESTADO_CARGO[c.estado].texto}</Chip></td>
                  <td className="num">{c.pagado === 0 && <button className="text-xs text-peligro hover:underline" onClick={() => anular(c)}>Anular</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
