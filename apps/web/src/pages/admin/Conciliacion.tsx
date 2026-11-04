import { useRef, useState } from "react";
import { api, mensajeError } from "../../lib/api";
import { dni as fmtDni, fecha, nombreMedio, pesos } from "../../lib/format";
import { Cabecera, Cargando, Chip, ErrorBox, Icon, Kpi, Modal, Pestanas, Vacio, useCarga } from "../../components/ui";
import type { PagoAdm } from "../../components/RegistrarPago";
import type { RespAdm } from "./Familias";

interface ResumenExtracto { id: string; nombre: string; creado: string; desde: string; hasta: string; movimientos: number; ingresos: number; pendientes: number; conciliadas: number; conciliado: number }
interface Candidato { tipo: "pago" | "comprobante"; id: string; fecha: string; importe: number; responsable: string; detalle: string; puntaje: number }
interface Linea {
  id: string; fecha: string; descripcion: string; referencia: string; importe: number; saldo: number | null; estado: "pendiente" | "conciliada" | "ignorada";
  candidatos: Candidato[]; sugerida: string | null; cobro: { id: string; numero: string; responsable: string } | null;
}

export default function Conciliacion() {
  const [tab, setTab] = useState<"extractos" | "sin">("extractos");
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <>
      <Cabecera titulo="Conciliación bancaria" subtitulo="Subí el extracto del banco (Excel, CSV o PDF) y cruzalo con los cobros registrados en el sistema." />
      {abierto ? <Detalle id={abierto} onVolver={() => setAbierto(null)} /> : (
        <>
          <Pestanas valor={tab} onChange={setTab} opciones={[{ id: "extractos", texto: "Extractos importados" }, { id: "sin", texto: "Cobros sin conciliar" }]} />
          {tab === "extractos" ? <Extractos onAbrir={setAbierto} /> : <SinConciliar />}
        </>
      )}
    </>
  );
}

const aBase64 = (f: File) => new Promise<string>((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] ?? "");
  r.onerror = () => mal(new Error("No se pudo leer el archivo"));
  r.readAsDataURL(f);
});

function Extractos({ onAbrir }: { onAbrir: (id: string) => void }) {
  const { data, error, recargar } = useCarga(() => api<ResumenExtracto[]>("/admin/conciliacion/extractos"));
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState<{ avisos: string[]; omitidas: number; id: string } | null>(null);

  async function subir(f: File | undefined) {
    if (!f) return;
    setErr(""); setAviso(null); setSubiendo(true);
    try {
      const r = await api<ResumenExtracto & { omitidas: number; avisos: string[] }>("/admin/conciliacion/extractos", { cuerpo: { nombre: f.name.replace(/\.\w+$/, ""), archivo: { nombre: f.name, tipo: f.type, base64: await aBase64(f) } } });
      setAviso({ avisos: r.avisos, omitidas: r.omitidas, id: r.id });
      await recargar();
    } catch (e) { setErr(mensajeError(e)); } finally { setSubiendo(false); if (input.current) input.current.value = ""; }
  }

  return (
    <>
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Importar un extracto</p>
          <p className="mt-0.5 text-sm text-suave">Descargalo del home banking. En Excel o CSV tiene que tener las columnas Fecha, Descripción e Importe (o Débito y Crédito). El PDF se lee automáticamente.</p>
        </div>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf" className="hidden" onChange={(e) => void subir(e.target.files?.[0])} />
        <button className="btn-primary" disabled={subiendo} onClick={() => input.current?.click()}><Icon name="subir" />{subiendo ? "Leyendo…" : "Elegir archivo"}</button>
      </div>
      <ErrorBox error={err || error} />
      {aviso && (
        <div className="mb-5 rounded-2xl border border-ok/25 bg-ok-claro p-4 text-sm text-ok" role="status">
          <p>Extracto importado.{aviso.omitidas > 0 && ` Se omitieron ${aviso.omitidas} movimientos que ya estaban cargados.`}</p>
          {aviso.avisos.map((a) => <p key={a} className="mt-1">{a}</p>)}
          <button className="mt-2 font-medium underline" onClick={() => onAbrir(aviso.id)}>Conciliar ahora</button>
        </div>
      )}
      {!data ? <Cargando /> : data.length === 0 ? (
        <div className="card"><Vacio icono="banco" texto="Todavía no importaste ningún extracto." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((e) => {
            const total = e.pendientes + e.conciliadas;
            const avance = total ? Math.round((e.conciliadas / total) * 100) : 100;
            return (
              <button key={e.id} onClick={() => onAbrir(e.id)} className="card border-t-4 border-t-celeste p-5 text-left transition hover:shadow-flota">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate text-base">{e.nombre}</h2><p className="mt-0.5 text-xs text-tenue">{fecha(e.desde)} al {fecha(e.hasta)} · {e.movimientos} movimientos</p></div>
                  {e.pendientes === 0 ? <Chip clase="bg-ok-claro text-ok">Conciliado</Chip> : <Chip clase="bg-aviso-claro text-aviso">{e.pendientes} por revisar</Chip>}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-fondo"><div className="h-full rounded-full bg-gradient-to-r from-celeste to-ok" style={{ width: `${avance}%` }} /></div>
                <p className="mt-3 text-sm text-suave">Ingresos {pesos(e.ingresos)} · conciliado <strong className="text-ok">{pesos(e.conciliado)}</strong></p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function SinConciliar() {
  const { data, error } = useCarga(() => api<PagoAdm[]>("/admin/conciliacion/sin-conciliar"));
  return (
    <div className="card">
      <p className="border-b border-borde p-4 text-sm text-suave">Cobros por transferencia, depósito, cheque o tarjeta que todavía no encontraste en ningún extracto. Si pasó tiempo y no aparecen, conviene revisarlos con el banco.</p>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : data.length === 0 ? <Vacio icono="ok" texto="Todos los cobros bancarios están conciliados." /> : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Recibo</th><th>Fecha</th><th>Familia</th><th>Medio</th><th className="num">Importe</th></tr></thead>
            <tbody>{data.map((p) => (
              <tr key={p.id}><td className="font-medium">{p.numero}</td><td>{fecha(p.fecha)}</td><td>{p.responsable}</td>
                <td>{nombreMedio(p.medio)}{p.referencia ? <span className="block text-xs text-tenue">{p.referencia}</span> : null}</td><td className="num font-medium">{pesos(p.importe)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detalle({ id, onVolver }: { id: string; onVolver: () => void }) {
  const { data, error, recargar } = useCarga(() => api<{ extracto: ResumenExtracto; lineas: Linea[] }>(`/admin/conciliacion/extractos/${id}`));
  const [filtro, setFiltro] = useState<"pendiente" | "conciliada" | "ignorada" | "todas">("pendiente");
  const [err, setErr] = useState("");
  const [cobrando, setCobrando] = useState<Linea | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const base = `/admin/conciliacion/extractos/${id}`;
  async function accion(f: () => Promise<unknown>) {
    setErr(""); setOcupado(true);
    try { await f(); await recargar(); } catch (e) { setErr(mensajeError(e)); } finally { setOcupado(false); }
  }
  const seguras = data?.lineas.filter((l) => l.sugerida).length ?? 0;
  const lineas = (data?.lineas ?? []).filter((l) => filtro === "todas" || l.estado === filtro);

  async function eliminar() {
    if (!window.confirm("¿Eliminar este extracto importado? Los cobros no se modifican.")) return;
    setErr("");
    try { await api(`${base}/eliminar`, { cuerpo: {} }); onVolver(); } catch (e) { setErr(mensajeError(e)); }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button className="btn-ghost btn-sm" onClick={onVolver}>← Volver a los extractos</button>
        <button className="text-sm text-peligro hover:underline" onClick={eliminar}>Eliminar extracto</button>
      </div>
      <ErrorBox error={err || error} />
      {!data ? <Cargando /> : (
        <>
          <h2 className="mb-1 text-lg">{data.extracto.nombre}</h2>
          <p className="mb-4 text-sm text-suave">{fecha(data.extracto.desde)} al {fecha(data.extracto.hasta)}</p>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Kpi acento="celeste" icono="cobranza" titulo="Ingresos del extracto" valor={pesos(data.extracto.ingresos)} />
            <Kpi acento="ok" icono="ok" titulo="Conciliado" valor={pesos(data.extracto.conciliado)} tono="bien" nota={`${data.extracto.conciliadas} movimientos`} />
            <Kpi acento="oro" icono="alerta" titulo="Por revisar" valor={String(data.extracto.pendientes)} nota="ingresos sin cruzar" />
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center gap-3 border-b border-borde p-4">
              <select className="input w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Mostrar">
                <option value="pendiente">Por revisar</option><option value="conciliada">Conciliados</option><option value="ignorada">Ignorados (egresos y otros)</option><option value="todas">Todos</option>
              </select>
              {seguras > 0 && (
                <button className="btn-primary btn-sm ml-auto" disabled={ocupado}
                  onClick={() => window.confirm(`Se conciliarán ${seguras} movimientos que tienen una única coincidencia clara (mismo importe y fecha cercana). ¿Continuar?`) && void accion(() => api(`${base}/confirmar-sugeridas`, { cuerpo: {} }))}>
                  <Icon name="ok" size={15} />Confirmar {seguras} coincidencias claras
                </button>
              )}
            </div>
            {lineas.length === 0 ? <Vacio icono="ok" texto="No hay movimientos en esta vista." /> : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th>Descripción</th><th className="num">Importe</th><th>Cruce</th></tr></thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l.id} className="align-top">
                        <td className="whitespace-nowrap">{fecha(l.fecha)}</td>
                        <td className="max-w-xs"><span className="block truncate" title={l.descripcion}>{l.descripcion || "—"}</span>{l.referencia && <span className="text-xs text-tenue">Ref. {l.referencia}</span>}</td>
                        <td className={`num whitespace-nowrap font-medium ${l.importe < 0 ? "text-peligro" : ""}`}>{pesos(l.importe)}</td>
                        <td>
                          {l.estado === "conciliada" && (
                            <span className="flex flex-wrap items-center gap-2"><Chip clase="bg-ok-claro text-ok">Conciliado</Chip><span className="text-xs text-suave">{l.cobro?.numero} · {l.cobro?.responsable}</span>
                              <button className="text-xs text-peligro hover:underline" disabled={ocupado} onClick={() => void accion(() => api(`${base}/lineas/${l.id}/deshacer`, { cuerpo: {} }))}>Deshacer</button></span>
                          )}
                          {l.estado === "ignorada" && (
                            <span className="flex items-center gap-2"><Chip clase="bg-fondo text-tenue">{l.importe < 0 ? "Egreso" : "Ignorado"}</Chip>
                              {l.importe > 0 && <button className="text-xs text-marca hover:underline" onClick={() => void accion(() => api(`${base}/lineas/${l.id}/ignorar`, { cuerpo: { ignorar: false } }))}>Volver a revisar</button>}</span>
                          )}
                          {l.estado === "pendiente" && (
                            <div className="space-y-1.5">
                              {l.candidatos.map((c) => (
                                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-fondo px-3 py-2 text-xs">
                                  <span className="min-w-0 flex-1"><strong className="font-semibold">{c.responsable}</strong> · {fecha(c.fecha)}<span className="block text-tenue">{c.detalle}</span></span>
                                  <button className={l.sugerida === c.id ? "btn-primary btn-sm" : "btn-sec btn-sm"} disabled={ocupado}
                                    onClick={() => void accion(() => api(`${base}/lineas/${l.id}/conciliar`, { cuerpo: c.tipo === "pago" ? { pagoId: c.id } : { comprobanteId: c.id } }))}>
                                    {c.tipo === "comprobante" ? "Aprobar y conciliar" : "Conciliar"}
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-3 text-xs">
                                <button className="font-medium text-marca hover:underline" onClick={() => setCobrando(l)}>Registrar cobro</button>
                                <button className="text-tenue hover:underline" onClick={() => void accion(() => api(`${base}/lineas/${l.id}/ignorar`, { cuerpo: {} }))}>Ignorar</button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {cobrando && <CobrarDesdeLinea linea={cobrando} base={base} onClose={() => setCobrando(null)} onListo={() => { setCobrando(null); void recargar(); }} />}
    </>
  );
}

/** El ingreso del banco no tenía cobro cargado: se elige la familia y se registra la transferencia con su imputación automática. */
function CobrarDesdeLinea({ linea, base, onClose, onListo }: { linea: Linea; base: string; onClose: () => void; onListo: () => void }) {
  const { data, error } = useCarga(() => api<RespAdm[]>("/admin/responsables"));
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const lista = (data ?? []).filter((r) => r.activo && `${r.apellido} ${r.nombre} ${r.dni} ${r.alumnos.join(" ")}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  async function elegir(r: RespAdm) {
    if (!window.confirm(`Registrar ${pesos(linea.importe)} como transferencia de ${r.apellido}, ${r.nombre}? Se aplica a sus cuotas más antiguas.`)) return;
    setErr(""); setEnviando(true);
    try { await api(`${base}/lineas/${linea.id}/cobrar`, { cuerpo: { responsableId: r.id } }); onListo(); } catch (e) { setErr(mensajeError(e)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo={`Registrar cobro de ${pesos(linea.importe)}`} onClose={onClose} ancho="max-w-xl">
      <p className="mb-3 text-sm text-suave">{fecha(linea.fecha)} · {linea.descripcion || "Movimiento sin descripción"}</p>
      <input className="input" autoFocus placeholder="Buscar familia por apellido, DNI o alumno" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox error={err || error} />
      {!data ? <Cargando /> : (
        <ul className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-borde">
          {lista.map((r) => (
            <li key={r.id} className="border-b border-borde/70 last:border-0">
              <button disabled={enviando} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-fondo/60" onClick={() => void elegir(r)}>
                <span className="min-w-0"><span className="block font-medium">{r.apellido}, {r.nombre} <span className="font-normal text-tenue">· {fmtDni(r.dni)}</span></span><span className="block truncate text-xs text-tenue">{r.alumnos.join(" · ")}</span></span>
                <span className="tabular-nums text-suave">{r.deuda > 0 ? pesos(r.deuda) : "Al día"}</span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-6 text-center text-sm text-tenue">No se encontraron familias.</li>}
        </ul>
      )}
    </Modal>
  );
}
