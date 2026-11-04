import { useState } from "react";
import { api, mensajeError } from "../../lib/api";
import { dni as fmtDni, fecha, nombreMedio, pesos } from "../../lib/format";
import RegistrarPago, { type PagoAdm } from "../../components/RegistrarPago";
import { Cabecera, Cargando, Chip, ErrorBox, Icon, Modal, Pestanas, Vacio, useCarga } from "../../components/ui";
import type { RespAdm } from "./Familias";


export default function Cobranza() {
  const [tab, setTab] = useState<"deuda" | "recibos">("deuda");
  const [nuevo, setNuevo] = useState(false);
  return (
    <>
      <Cabecera titulo="Cobranza" subtitulo="Registrá cobros en ventanilla (efectivo, cheque, tarjeta, transferencia…) y controlá la deuda de cada familia.">
        <button className="btn-primary" onClick={() => setNuevo(true)}><Icon name="mas" size={16} />Nuevo cobro</button>
      </Cabecera>
      {nuevo && <ElegirFamilia onClose={() => setNuevo(false)} />}
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: "deuda", texto: "Deuda por familia" }, { id: "recibos", texto: "Recibos emitidos" }]} />
      {tab === "deuda" ? <Deuda /> : <Recibos />}
    </>
  );
}

/** Cobro presencial: se busca la familia por apellido, DNI o alumno y se abre el formulario de cobro. */
function ElegirFamilia({ onClose }: { onClose: () => void }) {
  const { data, error } = useCarga(() => api<RespAdm[]>("/admin/responsables"));
  const [q, setQ] = useState("");
  const [familia, setFamilia] = useState<string | null>(null);
  if (familia) return <RegistrarPago responsableId={familia} onClose={onClose} onListo={() => { onClose(); window.location.reload(); }} />;
  const lista = (data ?? []).filter((r) => r.activo && `${r.apellido} ${r.nombre} ${r.dni} ${r.alumnos.join(" ")}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  return (
    <Modal titulo="Nuevo cobro · ¿de qué familia?" onClose={onClose} ancho="max-w-xl">
      <input className="input" autoFocus placeholder="Buscar por apellido, DNI o alumno" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox error={error} />
      {!data ? <Cargando /> : (
        <ul className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-borde">
          {lista.map((r) => (
            <li key={r.id} className="border-b border-borde/70 last:border-0">
              <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-fondo/60" onClick={() => setFamilia(r.id)}>
                <span className="min-w-0"><span className="block font-medium">{r.apellido}, {r.nombre} <span className="font-normal text-tenue">· {fmtDni(r.dni)}</span></span><span className="block truncate text-xs text-tenue">{r.alumnos.join(" · ")}</span></span>
                <span className={`tabular-nums ${r.deuda > 0 ? "font-semibold" : "text-tenue"}`}>{r.deuda > 0 ? pesos(r.deuda) : "Al día"}</span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-6 text-center text-sm text-tenue">No se encontraron familias.</li>}
        </ul>
      )}
    </Modal>
  );
}

function Deuda() {
  const { data, error, recargar } = useCarga(() => api<RespAdm[]>("/admin/responsables"));
  const [q, setQ] = useState("");
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const lista = (data ?? [])
    .filter((r) => r.deuda > 0 && (!soloVencidas || r.vencido > 0) && `${r.apellido} ${r.nombre} ${r.dni} ${r.alumnos.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.vencido - a.vencido || b.deuda - a.deuda);
  const total = lista.reduce((s, r) => s + r.deuda, 0);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-borde p-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Icon name="buscar" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue" />
          <input className="input pl-10" placeholder="Buscar familia, DNI o alumno" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-suave"><input type="checkbox" className="accent-marca" checked={soloVencidas} onChange={(e) => setSoloVencidas(e.target.checked)} />Solo con deuda vencida</label>
        <p className="ml-auto text-sm text-suave">Total: <strong className="text-tinta">{pesos(total)}</strong></p>
      </div>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : lista.length === 0 ? <Vacio icono="ok" texto="No hay familias con deuda para este filtro." /> : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Familia</th><th>DNI</th><th>Alumnos</th><th className="num">Vencido</th><th className="num">Deuda total</th><th /></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.apellido}, {r.nombre}</td>
                  <td className="tabular-nums text-suave">{fmtDni(r.dni)}</td>
                  <td className="text-suave">{r.alumnos.join(" · ")}</td>
                  <td className={`num ${r.vencido > 0 ? "font-medium text-peligro" : "text-tenue"}`}>{r.vencido > 0 ? pesos(r.vencido) : "—"}</td>
                  <td className="num font-medium">{pesos(r.deuda)}</td>
                  <td className="num"><button className="btn-primary btn-sm" onClick={() => setCobrando(r.id)}>Cobrar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cobrando && <RegistrarPago responsableId={cobrando} onClose={() => setCobrando(null)} onListo={() => { setCobrando(null); void recargar(); }} />}
    </div>
  );
}

function Recibos() {
  const { data, error, recargar } = useCarga(() => api<PagoAdm[]>("/admin/pagos"));
  const [err, setErr] = useState("");
  const anular = async (p: PagoAdm) => {
    if (!window.confirm(`¿Anular el recibo ${p.numero}? Las cuotas vuelven a quedar pendientes y se revierte el asiento.`)) return;
    setErr("");
    try { await api(`/admin/pagos/${p.id}/anular`, { cuerpo: {} }); await recargar(); } catch (e) { setErr(mensajeError(e)); }
  };
  return (
    <div className="card">
      <ErrorBox error={error || err} />
      {!data ? <Cargando /> : data.length === 0 ? <Vacio texto="Todavía no se emitieron recibos." icono="cobranza" /> : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Recibo</th><th>Fecha</th><th>Familia</th><th>Medio</th><th>Aplicado a</th><th className="num">Importe</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className={p.anulado ? "text-tenue" : ""}>
                  <td className={`font-medium ${p.anulado ? "line-through" : ""}`}>{p.numero}</td>
                  <td>{fecha(p.fecha)}</td><td>{p.responsable}</td><td>{nombreMedio(p.medio)}{p.referencia ? <span className="block text-xs text-tenue">{p.referencia}</span> : null}{p.conciliado && <Chip clase="mt-1 bg-ok-claro text-ok">Conciliado</Chip>}</td>
                  <td className="max-w-xs truncate text-suave" title={p.detalle.map((d) => d.descripcion).join(", ")}>{p.detalle.map((d) => d.descripcion).join(", ") || "Saldo a favor"}</td>
                  <td className="num font-medium">{pesos(p.importe)}</td>
                  <td className="num">{p.anulado ? <span className="text-xs">Anulado</span> : <button className="text-xs text-peligro hover:underline" onClick={() => anular(p)}>Anular</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
