import { useMemo, useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { fecha, hoyISO, pesos } from "../../lib/format";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Vacio, useCarga } from "../../components/ui";

interface Evento {
  id: string; nombre: string; descripcion: string; fechaEvento: string; importe: number; cuotas: number; primerVencimiento: string;
  cuenta: string; cerrado: boolean; participantes: number; alDia: number; total: number; cobrado: number; pendiente: number;
}
interface Cuenta { codigo: string; nombre: string; tipo: string; imputable: boolean }
interface AlumnoMin { id: string; nombreCompleto: string; nivel: string; curso: string; activo: boolean }
interface Detalle { evento: Evento; participantes: { alumnoId: string; alumno: string; total: number; pagado: number; pendiente: number; vencido: number }[] }

export default function Eventos() {
  const { data, error, recargar } = useCarga(() => api<Evento[]>("/admin/eventos"));
  const [nuevo, setNuevo] = useState(false);
  const [ver, setVer] = useState<string | null>(null);

  return (
    <>
      <Cabecera titulo="Eventos y viajes" subtitulo="Cobros eventuales como un viaje de estudio o un campamento: aparecen en el portal de cada familia para que paguen e informen la transferencia.">
        <button className="btn-primary" onClick={() => setNuevo(true)}><Icon name="mas" size={16} />Nuevo evento</button>
      </Cabecera>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : data.length === 0 ? (
        <div className="card"><Vacio icono="eventos" texto="Todavía no hay eventos. Creá el primero con «Nuevo evento»." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((e) => {
            const avance = e.total > 0 ? Math.round((e.cobrado / e.total) * 100) : 0;
            return (
              <button key={e.id} onClick={() => setVer(e.id)} className="card border-t-4 border-t-celeste p-5 text-left transition hover:shadow-flota">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base">{e.nombre}</h2>
                    <p className="mt-0.5 text-xs text-tenue">{e.fechaEvento ? `Fecha: ${fecha(e.fechaEvento)} · ` : ""}{e.cuotas > 1 ? `${e.cuotas} cuotas de ${pesos(e.importe / e.cuotas)}` : "Pago único"}</p>
                  </div>
                  {e.cerrado ? <Chip clase="bg-fondo text-tenue">Cerrado</Chip> : <Chip clase="bg-ok-claro text-ok">Abierto</Chip>}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-fondo" role="img" aria-label={`Cobrado ${avance}%`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-celeste to-marca" style={{ width: `${avance}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-tenue">Participantes</dt><dd className="font-semibold">{e.participantes}</dd></div>
                  <div><dt className="text-xs text-tenue">Cobrado</dt><dd className="font-semibold tabular-nums text-ok">{pesos(e.cobrado)}</dd></div>
                  <div><dt className="text-xs text-tenue">Pendiente</dt><dd className="font-semibold tabular-nums">{pesos(e.pendiente)}</dd></div>
                </dl>
              </button>
            );
          })}
        </div>
      )}
      {nuevo && <NuevoEvento onClose={() => setNuevo(false)} onListo={() => { setNuevo(false); void recargar(); }} />}
      {ver && <DetalleEvento id={ver} onClose={() => setVer(null)} onCambio={() => void recargar()} />}
    </>
  );
}

/** Selector de alumnos con buscador, reutilizado al crear el evento y al sumar participantes. */
function ElegirAlumnos({ alumnos, elegidos, onChange }: { alumnos: AlumnoMin[]; elegidos: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const lista = alumnos.filter((a) => a.nombreCompleto.toLowerCase().includes(q.toLowerCase()));
  const alternar = (id: string) => onChange(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  return (
    <div className="rounded-xl border border-borde">
      <input className="input rounded-b-none border-0 border-b" placeholder="Buscar alumno…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-52 overflow-y-auto">
        {lista.map((a) => (
          <li key={a.id}><label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-fondo/60"><input type="checkbox" className="accent-marca" checked={elegidos.includes(a.id)} onChange={() => alternar(a.id)} />{a.nombreCompleto}<span className="text-tenue">· {a.curso || a.nivel}</span></label></li>
        ))}
        {lista.length === 0 && <li className="px-4 py-3 text-sm text-tenue">Sin resultados.</li>}
      </ul>
    </div>
  );
}

function NuevoEvento({ onClose, onListo }: { onClose: () => void; onListo: () => void }) {
  const alumnos = useCarga(() => api<AlumnoMin[]>("/admin/alumnos"));
  const cuentas = useCarga(() => api<Cuenta[]>("/admin/cuentas"));
  const [f, setF] = useState({ nombre: "", descripcion: "", fechaEvento: "", importe: "", cuotas: "1", primerVencimiento: hoyISO(), cuenta: "4.1.03" });
  const [destino, setDestino] = useState<"todos" | "cursos" | "elegir">("todos");
  const [cursos, setCursos] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const activos = useMemo(() => (alumnos.data ?? []).filter((a) => a.activo), [alumnos.data]);
  const todosLosCursos = useMemo(() => [...new Set(activos.map((a) => a.curso || a.nivel).filter(Boolean))].sort(), [activos]);
  const destinatarios = destino === "todos" ? activos : destino === "cursos" ? activos.filter((a) => cursos.includes(a.curso || a.nivel)) : activos.filter((a) => elegidos.includes(a.id));
  const importe = Number(f.importe) || 0;
  const cuotas = Math.max(1, Math.round(Number(f.cuotas) || 1));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Se creará «${f.nombre}» y se generarán ${destinatarios.length * cuotas} cuotas para ${destinatarios.length} alumnos. ¿Continuar?`)) return;
    setError(""); setEnviando(true);
    try {
      await api("/admin/eventos", { cuerpo: { ...f, importe, cuotas, alumnoIds: destinatarios.map((a) => a.id) } });
      onListo();
    } catch (err) { setError(mensajeError(err)); } finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Nuevo evento" onClose={onClose} ancho="max-w-2xl">
      {!alumnos.data || !cuentas.data ? <Cargando /> : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo label="Nombre del evento"><input className="input" required maxLength={100} autoFocus placeholder="Ej.: Viaje de estudio a Bariloche 2026" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
          <Campo label="Detalle para las familias (opcional)" ayuda="Se muestra en el portal: destino, qué incluye, fechas, etc.">
            <textarea className="input min-h-[70px]" maxLength={400} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Importe por alumno"><input className="input" type="number" min="1" step="0.01" required value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} /></Campo>
            <Campo label="Cantidad de cuotas" ayuda="1 = pago único. Las cuotas vencen una por mes."><input className="input" type="number" min="1" max="24" required value={f.cuotas} onChange={(e) => setF({ ...f, cuotas: e.target.value })} /></Campo>
            <Campo label="Vencimiento de la primera cuota"><input className="input" type="date" required value={f.primerVencimiento} onChange={(e) => setF({ ...f, primerVencimiento: e.target.value })} /></Campo>
            <Campo label="Fecha del evento (opcional)"><input className="input" type="date" value={f.fechaEvento} onChange={(e) => setF({ ...f, fechaEvento: e.target.value })} /></Campo>
          </div>
          <Campo label="Cuenta de ingreso">
            <select className="input" value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value })}>
              {cuentas.data.filter((c) => c.tipo === "Ingreso" && c.imputable).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </Campo>

          <div>
            <span className="label">¿Quiénes participan?</span>
            <div className="flex flex-wrap gap-2">
              {([["todos", "Todos los alumnos"], ["cursos", "Por curso"], ["elegir", "Elegir alumnos"]] as const).map(([k, t]) => (
                <button key={k} type="button" onClick={() => setDestino(k)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${destino === k ? "border-marca bg-marca-claro text-marca" : "border-borde text-suave hover:bg-fondo"}`}>{t}</button>
              ))}
            </div>
            {destino === "cursos" && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {todosLosCursos.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-marca" checked={cursos.includes(c)} onChange={() => setCursos((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))} />{c}</label>
                ))}
              </div>
            )}
            {destino === "elegir" && <div className="mt-3"><ElegirAlumnos alumnos={activos} elegidos={elegidos} onChange={setElegidos} /></div>}
          </div>

          <p className="rounded-xl bg-fondo px-4 py-3 text-sm text-suave">
            <strong className="text-tinta">{destinatarios.length}</strong> {destinatarios.length === 1 ? "alumno" : "alumnos"} · {cuotas > 1 ? `${cuotas} cuotas de ${pesos(importe / cuotas)}` : "pago único"} · total a cobrar <strong className="text-tinta">{pesos(importe * destinatarios.length)}</strong>.
            Las cuotas aparecen enseguida en el portal de cada familia. Las becas no se aplican a los eventos.
          </p>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={enviando || destinatarios.length === 0}>{enviando ? "Creando…" : "Crear y generar cuotas"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DetalleEvento({ id, onClose, onCambio }: { id: string; onClose: () => void; onCambio: () => void }) {
  const { data, error, recargar } = useCarga(() => api<Detalle>(`/admin/eventos/${id}`));
  const alumnos = useCarga(() => api<AlumnoMin[]>("/admin/alumnos"));
  const [sumando, setSumando] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [err, setErr] = useState("");

  const disponibles = useMemo(() => {
    const ya = new Set(data?.participantes.map((p) => p.alumnoId));
    return (alumnos.data ?? []).filter((a) => a.activo && !ya.has(a.id));
  }, [alumnos.data, data]);

  async function sumar() {
    setErr("");
    try { await api(`/admin/eventos/${id}/participantes`, { cuerpo: { alumnoIds: elegidos } }); setElegidos([]); setSumando(false); await recargar(); onCambio(); } catch (e) { setErr(mensajeError(e)); }
  }
  async function cerrar() {
    if (!data || !window.confirm(`¿Cerrar «${data.evento.nombre}»? Se anulan las cuotas que todavía nadie pagó; las ya cobradas quedan registradas.`)) return;
    setErr("");
    try { await api(`/admin/eventos/${id}/cerrar`, { cuerpo: {} }); await recargar(); onCambio(); } catch (e) { setErr(mensajeError(e)); }
  }

  return (
    <Modal titulo={data?.evento.nombre ?? "Evento"} onClose={onClose} ancho="max-w-3xl">
      <ErrorBox error={error || err} />
      {!data ? <Cargando /> : (
        <>
          {data.evento.descripcion && <p className="mb-4 text-sm text-suave">{data.evento.descripcion}</p>}
          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["A cobrar", pesos(data.evento.total), ""], ["Cobrado", pesos(data.evento.cobrado), "text-ok"], ["Pendiente", pesos(data.evento.pendiente), ""], ["Al día", `${data.evento.alDia} de ${data.evento.participantes}`, ""]].map(([t, v, c]) => (
              <div key={t} className="rounded-xl bg-fondo px-4 py-3"><dt className="text-xs text-tenue">{t}</dt><dd className={`mt-0.5 font-semibold tabular-nums ${c}`}>{v}</dd></div>
            ))}
          </dl>
          <div className="overflow-x-auto rounded-xl border border-borde">
            <table className="tabla">
              <thead><tr><th>Alumno</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Pendiente</th><th /></tr></thead>
              <tbody>
                {data.participantes.map((p) => (
                  <tr key={p.alumnoId}>
                    <td className="font-medium">{p.alumno}</td><td className="num">{pesos(p.total)}</td><td className="num text-ok">{pesos(p.pagado)}</td><td className="num font-medium">{pesos(p.pendiente)}</td>
                    <td className="num">{p.pendiente <= 0 ? <Chip clase="bg-ok-claro text-ok">Pagó todo</Chip> : p.vencido > 0 ? <Chip clase="bg-peligro-claro text-peligro">Vencido</Chip> : <Chip clase="bg-aviso-claro text-aviso">Pendiente</Chip>}</td>
                  </tr>
                ))}
                {data.participantes.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-tenue">Sin participantes.</td></tr>}
              </tbody>
            </table>
          </div>

          {!data.evento.cerrado && (
            <div className="mt-5">
              {sumando ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Sumar alumnos al evento</p>
                  <ElegirAlumnos alumnos={disponibles} elegidos={elegidos} onChange={setElegidos} />
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost" onClick={() => { setSumando(false); setElegidos([]); }}>Cancelar</button>
                    <button className="btn-primary" disabled={elegidos.length === 0} onClick={sumar}>Sumar {elegidos.length || ""} y generar cuotas</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-between gap-2">
                  <button className="btn-ghost" onClick={() => setSumando(true)}><Icon name="mas" size={16} />Sumar alumnos</button>
                  <button className="text-sm text-peligro hover:underline" onClick={cerrar}>Cerrar evento</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
