import { useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { fecha, hoyISO, MESES, pesos, pesosFijos } from "../../lib/format";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Pestanas, Vacio, useCarga } from "../../components/ui";

interface Cuenta { codigo: string; nombre: string; tipo: string; imputable: boolean }
interface Asiento { id: string; numero: number; fecha: string; descripcion: string; origen: { tipo: string }; lineas: { cuenta: string; debe: number; haber: number }[]; anulado: boolean }

type Tab = "resultados" | "diario" | "mayor" | "balance" | "plan";

export default function Contabilidad() {
  const [tab, setTab] = useState<Tab>("resultados");
  const anio = hoyISO().slice(0, 4);
  const [desde, setDesde] = useState(`${anio}-01-01`);
  const [hasta, setHasta] = useState(hoyISO());

  const preset = (k: "mes" | "trim" | "anio" | "ant") => {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth();
    const iso = (a: number, mm: number, dd: number) => `${a}-${String(mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const ultimo = (a: number, mm: number) => new Date(a, mm + 1, 0).getDate();
    if (k === "mes") { setDesde(iso(y, m, 1)); setHasta(iso(y, m, ultimo(y, m))); }
    if (k === "trim") { const q = Math.floor(m / 3) * 3; setDesde(iso(y, q, 1)); setHasta(iso(y, q + 2, ultimo(y, q + 2))); }
    if (k === "anio") { setDesde(iso(y, 0, 1)); setHasta(iso(y, 11, 31)); }
    if (k === "ant") { setDesde(iso(y - 1, 0, 1)); setHasta(iso(y - 1, 11, 31)); }
  };

  const conRango = tab !== "plan";
  return (
    <>
      <Cabecera titulo="Contabilidad" subtitulo="Partida doble automática: cada cargo, recibo y gasto genera su asiento." />
      <Pestanas valor={tab} onChange={setTab} opciones={[
        { id: "resultados", texto: "Estado de resultados" }, { id: "diario", texto: "Libro diario" }, { id: "mayor", texto: "Mayor" },
        { id: "balance", texto: "Sumas y saldos" }, { id: "plan", texto: "Plan de cuentas" },
      ]} />
      {conRango && (
        <div className="card no-imprimir mb-5 flex flex-wrap items-end gap-3 p-4">
          {tab === "balance" ? (
            <Campo label="Al día"><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
          ) : (
            <>
              <Campo label="Desde"><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
              <Campo label="Hasta"><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            </>
          )}
          {tab !== "balance" && (
            <div className="flex flex-wrap gap-1 pb-0.5">
              {([["mes", "Este mes"], ["trim", "Trimestre"], ["anio", "Este año"], ["ant", "Año anterior"]] as const).map(([k, t]) => <button key={k} type="button" className="btn-ghost btn-sm" onClick={() => preset(k)}>{t}</button>)}
            </div>
          )}
          <button className="btn-sec ml-auto" onClick={() => window.print()}><Icon name="imprimir" size={16} />Imprimir</button>
        </div>
      )}
      {tab === "resultados" && <Resultados desde={desde} hasta={hasta} />}
      {tab === "diario" && <Diario desde={desde} hasta={hasta} />}
      {tab === "mayor" && <Mayor desde={desde} hasta={hasta} />}
      {tab === "balance" && <Balance hasta={hasta} />}
      {tab === "plan" && <Plan />}
    </>
  );
}

// ---------- Estado de resultados ----------
interface Res { desde: string; hasta: string; ingresos: { codigo: string; nombre: string; monto: number }[]; egresos: { codigo: string; nombre: string; monto: number }[]; totalIngresos: number; totalEgresos: number; resultado: number; cobrado: number; gastosPagados: number }

function Resultados({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, error } = useCarga(() => api<Res>(`/admin/reportes/resultados?desde=${desde}&hasta=${hasta}`), [desde, hasta]);
  const aj = useCarga(() => api<{ colegio: string }>("/admin/ajustes"));
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Cargando />;
  const Bloque = ({ titulo, filas, total, etiqueta }: { titulo: string; filas: Res["ingresos"]; total: number; etiqueta: string }) => (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tenue">{titulo}</h3>
      {filas.length === 0 ? <p className="py-3 text-sm text-tenue">Sin movimientos en el período.</p> : (
        <table className="tabla"><tbody>
          {filas.map((f) => (
            <tr key={f.codigo}><td className="w-24 text-tenue">{f.codigo}</td><td>{f.nombre}</td><td className={`num ${f.monto < 0 ? "text-peligro" : ""}`}>{pesosFijos(f.monto)}</td></tr>
          ))}
        </tbody></table>
      )}
      <div className="flex justify-between border-t-2 border-tinta/80 px-4 py-2.5 text-sm font-semibold"><span>{etiqueta}</span><span className="tabular-nums">{pesosFijos(total)}</span></div>
    </section>
  );
  return (
    <article className="card mx-auto max-w-3xl p-6 sm:p-8">
      <header className="mb-6 border-b border-borde pb-4 text-center">
        <p className="text-sm text-suave">{aj.data?.colegio}</p>
        <h2 className="mt-1 text-xl">Estado de resultados</h2>
        <p className="mt-1 text-sm text-suave">Del {fecha(data.desde)} al {fecha(data.hasta)} · base devengado</p>
      </header>
      <Bloque titulo="Ingresos" filas={data.ingresos} total={data.totalIngresos} etiqueta="Total de ingresos" />
      <Bloque titulo="Egresos" filas={data.egresos} total={data.totalEgresos} etiqueta="Total de egresos" />
      <div className={`flex justify-between rounded-xl px-4 py-3.5 text-base font-semibold ${data.resultado >= 0 ? "bg-ok-claro text-ok" : "bg-peligro-claro text-peligro"}`}>
        <span>{data.resultado >= 0 ? "Resultado del período (superávit)" : "Resultado del período (déficit)"}</span><span className="tabular-nums">{pesosFijos(data.resultado)}</span>
      </div>
      <div className="mt-6 grid gap-3 rounded-xl bg-fondo/70 p-4 text-sm sm:grid-cols-2">
        <p className="flex justify-between gap-3"><span className="text-suave">Cobranzas del período (caja)</span><strong className="tabular-nums">{pesos(data.cobrado)}</strong></p>
        <p className="flex justify-between gap-3"><span className="text-suave">Gastos pagados (caja)</span><strong className="tabular-nums">{pesos(data.gastosPagados)}</strong></p>
      </div>
      <p className="mt-3 text-xs text-tenue">Los ingresos se reconocen al emitir cada cuota (devengado), neto de becas; las cobranzas se informan aparte como referencia financiera.</p>
    </article>
  );
}

// ---------- Libro diario ----------
function Diario({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, error, recargar } = useCarga(() => api<Asiento[]>(`/admin/asientos?desde=${desde}&hasta=${hasta}`), [desde, hasta]);
  const cuentas = useCarga(() => api<Cuenta[]>("/admin/cuentas"));
  const [nuevo, setNuevo] = useState(false);
  const [err, setErr] = useState("");
  const nombre = (c: string) => cuentas.data?.find((x) => x.codigo === c)?.nombre ?? c;
  const anular = async (a: Asiento) => {
    if (!window.confirm(`¿Anular el asiento N° ${a.numero}?`)) return;
    try { await api(`/admin/asientos/${a.id}/anular`, { cuerpo: {} }); await recargar(); } catch (e) { setErr(mensajeError(e)); }
  };
  return (
    <div className="card">
      <div className="no-imprimir flex items-center justify-between border-b border-borde p-4">
        <p className="text-sm text-suave">{data ? `${data.length} asientos` : ""}</p>
        <button className="btn-primary btn-sm" onClick={() => setNuevo(true)}><Icon name="mas" size={15} />Asiento manual</button>
      </div>
      <ErrorBox error={error || err} />
      {!data ? <Cargando /> : data.length === 0 ? <Vacio texto="No hay asientos en este período." icono="contabilidad" /> : (
        <div className="divide-y divide-borde/70">
          {data.map((a) => (
            <div key={a.id} className={`px-5 py-4 ${a.anulado ? "opacity-50" : ""}`}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <p className="font-medium"><span className="mr-2 text-tenue">N° {a.numero}</span>{fecha(a.fecha)} <span className="font-normal text-suave">· {a.descripcion}</span></p>
                <span className="flex items-center gap-2">
                  {a.anulado && <Chip clase="bg-fondo text-tenue">Anulado</Chip>}
                  {!a.anulado && a.origen.tipo === "manual" && <button className="no-imprimir text-xs text-peligro hover:underline" onClick={() => anular(a)}>Anular</button>}
                </span>
              </div>
              <table className="tabla"><tbody>
                {a.lineas.map((l, i) => (
                  <tr key={i}><td className={`w-28 !py-1.5 text-tenue ${l.haber > 0 ? "pl-10" : ""}`}>{l.cuenta}</td><td className={`!py-1.5 ${l.haber > 0 ? "pl-8" : ""}`}>{nombre(l.cuenta)}</td><td className="num !py-1.5 w-32">{l.debe ? pesosFijos(l.debe) : ""}</td><td className="num !py-1.5 w-32">{l.haber ? pesosFijos(l.haber) : ""}</td></tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      )}
      {nuevo && cuentas.data && <FormAsiento cuentas={cuentas.data.filter((c) => c.imputable)} onClose={() => setNuevo(false)} onListo={() => { setNuevo(false); void recargar(); }} />}
    </div>
  );
}

function FormAsiento({ cuentas, onClose, onListo }: { cuentas: Cuenta[]; onClose: () => void; onListo: () => void }) {
  const [f, setF] = useState(hoyISO());
  const [desc, setDesc] = useState("");
  const [lineas, setLineas] = useState([{ cuenta: "", debe: "", haber: "" }, { cuenta: "", debe: "", haber: "" }]);
  const [error, setError] = useState("");
  const debe = lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
  const haber = lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);
  const cuadra = Math.abs(debe - haber) < 0.005 && debe > 0;
  const cambiar = (i: number, k: "cuenta" | "debe" | "haber", v: string) => setLineas((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/asientos", { cuerpo: { fecha: f, descripcion: desc, lineas: lineas.filter((l) => l.cuenta).map((l) => ({ cuenta: l.cuenta, debe: Number(l.debe) || 0, haber: Number(l.haber) || 0 })) } });
      onListo();
    } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo="Asiento manual" onClose={onClose} ancho="max-w-2xl">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Campo label="Fecha"><input className="input" type="date" required value={f} onChange={(e) => setF(e.target.value)} /></Campo>
          <Campo label="Descripción"><input className="input" required value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
        </div>
        <div className="space-y-2">
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_110px] gap-2">
              <select className="input" aria-label="Cuenta" value={l.cuenta} onChange={(e) => cambiar(i, "cuenta", e.target.value)}>
                <option value="">Cuenta…</option>{cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
              </select>
              <input className="input" type="number" min="0" step="0.01" placeholder="Debe" aria-label="Debe" value={l.debe} onChange={(e) => cambiar(i, "debe", e.target.value)} />
              <input className="input" type="number" min="0" step="0.01" placeholder="Haber" aria-label="Haber" value={l.haber} onChange={(e) => cambiar(i, "haber", e.target.value)} />
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-marca hover:underline" onClick={() => setLineas((l) => [...l, { cuenta: "", debe: "", haber: "" }])}>+ Agregar línea</button>
        </div>
        <div className={`flex justify-between rounded-xl px-4 py-2.5 text-sm ${cuadra ? "bg-ok-claro text-ok" : "bg-fondo text-suave"}`}>
          <span>{cuadra ? "El asiento balancea" : "Debe y haber tienen que ser iguales"}</span><span className="tabular-nums">{pesosFijos(debe)} / {pesosFijos(haber)}</span>
        </div>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!cuadra}>Registrar asiento</button></div>
      </form>
    </Modal>
  );
}

// ---------- Mayor ----------
function Mayor({ desde, hasta }: { desde: string; hasta: string }) {
  const cuentas = useCarga(() => api<Cuenta[]>("/admin/cuentas"));
  const [cuenta, setCuenta] = useState("1.1.03");
  const { data, error } = useCarga(() => api<{ cuenta?: Cuenta; saldoInicial: number; lineas: { fecha: string; numero: number; descripcion: string; debe: number; haber: number; saldo: number }[] }>(`/admin/reportes/mayor?cuenta=${cuenta}&desde=${desde}&hasta=${hasta}`), [cuenta, desde, hasta]);
  return (
    <div className="card">
      <div className="no-imprimir border-b border-borde p-4">
        <select className="input max-w-md" value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Cuenta">
          {(cuentas.data ?? []).filter((c) => c.imputable).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
        </select>
      </div>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : (
        <div className="overflow-x-auto">
          <p className="px-4 pt-4 text-sm font-semibold">{data.cuenta?.codigo} · {data.cuenta?.nombre}</p>
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Asiento</th><th>Descripción</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              <tr className="text-tenue"><td colSpan={5}>Saldo inicial</td><td className="num">{pesosFijos(data.saldoInicial)}</td></tr>
              {data.lineas.map((l, i) => (
                <tr key={i}><td>{fecha(l.fecha)}</td><td className="text-tenue">{l.numero}</td><td>{l.descripcion}</td><td className="num">{l.debe ? pesosFijos(l.debe) : ""}</td><td className="num">{l.haber ? pesosFijos(l.haber) : ""}</td><td className="num font-medium">{pesosFijos(l.saldo)}</td></tr>
              ))}
              {data.lineas.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-tenue">Sin movimientos en el período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Sumas y saldos ----------
function Balance({ hasta }: { hasta: string }) {
  const { data, error } = useCarga(() => api<{ filas: { codigo: string; nombre: string; debe: number; haber: number; deudor: number; acreedor: number }[]; totales: { debe: number; haber: number; deudor: number; acreedor: number } }>(`/admin/reportes/balance?hasta=${hasta}`), [hasta]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Cargando />;
  return (
    <div className="card overflow-x-auto">
      <p className="px-4 pt-4 text-sm font-semibold">Balance de sumas y saldos al {fecha(hasta)}</p>
      <table className="tabla">
        <thead><tr><th>Código</th><th>Cuenta</th><th className="num">Suma debe</th><th className="num">Suma haber</th><th className="num">Saldo deudor</th><th className="num">Saldo acreedor</th></tr></thead>
        <tbody>
          {data.filas.map((f) => <tr key={f.codigo}><td className="text-tenue">{f.codigo}</td><td>{f.nombre}</td><td className="num">{pesosFijos(f.debe)}</td><td className="num">{pesosFijos(f.haber)}</td><td className="num">{f.deudor ? pesosFijos(f.deudor) : ""}</td><td className="num">{f.acreedor ? pesosFijos(f.acreedor) : ""}</td></tr>)}
          <tr className="font-semibold"><td /><td>Totales</td><td className="num">{pesosFijos(data.totales.debe)}</td><td className="num">{pesosFijos(data.totales.haber)}</td><td className="num">{pesosFijos(data.totales.deudor)}</td><td className="num">{pesosFijos(data.totales.acreedor)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------- Plan de cuentas ----------
function Plan() {
  const { data, error, recargar } = useCarga(() => api<Cuenta[]>("/admin/cuentas"));
  const [nuevo, setNuevo] = useState(false);
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-borde p-4">
        <p className="text-sm text-suave">Las cuentas con título (en gris) agrupan; las demás reciben movimientos.</p>
        <button className="btn-primary btn-sm" onClick={() => setNuevo(true)}><Icon name="mas" size={15} />Nueva cuenta</button>
      </div>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : (
        <table className="tabla"><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th></tr></thead><tbody>
          {data.map((c) => (
            <tr key={c.codigo} className={c.imputable ? "" : "bg-fondo/60 font-semibold"}>
              <td className="tabular-nums text-tenue">{c.codigo}</td><td style={{ paddingLeft: `${1 + (c.codigo.split(".").length - 1) * 1.2}rem` }}>{c.nombre}</td><td className="text-suave">{c.tipo}</td>
            </tr>
          ))}
        </tbody></table>
      )}
      {nuevo && <FormCuenta onClose={() => setNuevo(false)} onListo={() => { setNuevo(false); void recargar(); }} />}
    </div>
  );
}

function FormCuenta({ onClose, onListo }: { onClose: () => void; onListo: () => void }) {
  const [f, setF] = useState({ codigo: "", nombre: "", tipo: "Egreso" });
  const [error, setError] = useState("");
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try { await api("/admin/cuentas", { cuerpo: f }); onListo(); } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo="Nueva cuenta" onClose={onClose} ancho="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Código" ayuda="Ej.: 5.2.10"><input className="input" required value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></Campo>
          <Campo label="Tipo"><select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{["Activo", "Pasivo", "Patrimonio", "Ingreso", "Egreso"].map((t) => <option key={t}>{t}</option>)}</select></Campo>
        </div>
        <Campo label="Nombre"><input className="input" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary">Crear cuenta</button></div>
      </form>
    </Modal>
  );
}

void MESES;
