import { useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { fecha, hoyISO, pesos } from "../../lib/format";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Vacio, useCarga } from "../../components/ui";

interface Gasto { id: string; numero: string; fecha: string; proveedor: string; cuenta: string; cuentaNombre: string; detalle: string; importe: number; medio: "caja" | "banco" | "apagar"; nroComprobante: string; anulado: boolean; pagadoEn?: string }
interface Cuenta { codigo: string; nombre: string; tipo: string; imputable: boolean }

const MEDIO = { caja: "Caja (efectivo)", banco: "Banco", apagar: "A pagar (proveedor)" };

export default function Gastos() {
  const { data, error, recargar } = useCarga(() => api<Gasto[]>("/admin/gastos"));
  const cuentas = useCarga(() => api<Cuenta[]>("/admin/cuentas"));
  const [nuevo, setNuevo] = useState(false);
  const [pagando, setPagando] = useState<Gasto | null>(null);
  const [err, setErr] = useState("");
  const [desde, setDesde] = useState(`${hoyISO().slice(0, 4)}-01-01`);
  const [hasta, setHasta] = useState(hoyISO());

  const lista = (data ?? []).filter((g) => g.fecha >= desde && g.fecha <= hasta);
  const total = lista.filter((g) => !g.anulado).reduce((s, g) => s + g.importe, 0);

  const anular = async (g: Gasto) => {
    if (!window.confirm(`¿Anular el gasto ${g.numero}?`)) return;
    setErr("");
    try { await api(`/admin/gastos/${g.id}/anular`, { cuerpo: {} }); await recargar(); } catch (e) { setErr(mensajeError(e)); }
  };

  return (
    <>
      <Cabecera titulo="Gastos" subtitulo="Cada gasto se imputa a una cuenta del plan y genera su asiento.">
        <button className="btn-primary" onClick={() => setNuevo(true)}><Icon name="mas" />Registrar gasto</button>
      </Cabecera>
      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-borde p-4">
          <Campo label="Desde"><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
          <Campo label="Hasta"><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
          <p className="ml-auto pb-2.5 text-sm text-suave">Total del período: <strong className="text-tinta">{pesos(total)}</strong></p>
        </div>
        <ErrorBox error={error || err} />
        {!data ? <Cargando /> : lista.length === 0 ? <Vacio texto="No hay gastos en este período." icono="gastos" /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Cuenta</th><th>Pago</th><th className="num">Importe</th><th /></tr></thead>
              <tbody>
                {lista.map((g) => (
                  <tr key={g.id} className={g.anulado ? "text-tenue" : ""}>
                    <td>{fecha(g.fecha)}</td>
                    <td><span className={`font-medium ${g.anulado ? "line-through" : ""}`}>{g.proveedor}</span>{g.detalle && <span className="block text-xs text-tenue">{g.detalle}</span>}</td>
                    <td className="text-suave">{g.cuentaNombre}</td>
                    <td>{g.medio === "apagar" ? (g.pagadoEn ? <Chip clase="bg-ok-claro text-ok">Pagado {fecha(g.pagadoEn)}</Chip> : <Chip clase="bg-aviso-claro text-aviso">A pagar</Chip>) : MEDIO[g.medio]}</td>
                    <td className="num font-medium">{pesos(g.importe)}</td>
                    <td className="num whitespace-nowrap">
                      {g.anulado ? <span className="text-xs">Anulado</span> : (
                        <>
                          {g.medio === "apagar" && !g.pagadoEn && <button className="btn-sec btn-sm mr-2" onClick={() => setPagando(g)}>Registrar pago</button>}
                          <button className="text-xs text-peligro hover:underline" onClick={() => anular(g)}>Anular</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {nuevo && cuentas.data && <FormGasto cuentas={cuentas.data.filter((c) => c.tipo === "Egreso" && c.imputable)} onClose={() => setNuevo(false)} onListo={() => { setNuevo(false); void recargar(); }} />}
      {pagando && <PagarGasto gasto={pagando} onClose={() => setPagando(null)} onListo={() => { setPagando(null); void recargar(); }} />}
    </>
  );
}

function FormGasto({ cuentas, onClose, onListo }: { cuentas: Cuenta[]; onClose: () => void; onListo: () => void }) {
  const [f, setF] = useState({ fecha: hoyISO(), proveedor: "", cuenta: cuentas[0]?.codigo ?? "", detalle: "", importe: "", medio: "banco", nroComprobante: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setGuardando(true);
    try { await api("/admin/gastos", { cuerpo: { ...f, importe: Number(f.importe) } }); onListo(); } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  }
  return (
    <Modal titulo="Registrar gasto" onClose={onClose} ancho="max-w-lg">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Fecha"><input className="input" type="date" required value={f.fecha} onChange={set("fecha")} /></Campo>
          <Campo label="Importe"><input className="input" type="number" min="0.01" step="0.01" required value={f.importe} onChange={set("importe")} /></Campo>
        </div>
        <Campo label="Proveedor"><input className="input" required value={f.proveedor} onChange={set("proveedor")} /></Campo>
        <Campo label="Cuenta de gasto"><select className="input" value={f.cuenta} onChange={set("cuenta")}>{cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}</select></Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Cómo se paga"><select className="input" value={f.medio} onChange={set("medio")}>{Object.entries(MEDIO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
          <Campo label="N° de comprobante"><input className="input" value={f.nroComprobante} onChange={set("nroComprobante")} /></Campo>
        </div>
        <Campo label="Detalle"><input className="input" maxLength={200} value={f.detalle} onChange={set("detalle")} placeholder="Ej.: Factura de luz — marzo" /></Campo>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Registrar"}</button></div>
      </form>
    </Modal>
  );
}

function PagarGasto({ gasto, onClose, onListo }: { gasto: Gasto; onClose: () => void; onListo: () => void }) {
  const [medio, setMedio] = useState("banco");
  const [f, setF] = useState(hoyISO());
  const [error, setError] = useState("");
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try { await api(`/admin/gastos/${gasto.id}/pagar`, { cuerpo: { medio, fecha: f } }); onListo(); } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo={`Pagar a ${gasto.proveedor}`} onClose={onClose} ancho="max-w-sm">
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-suave">Cancela la deuda de {pesos(gasto.importe)} con el proveedor.</p>
        <Campo label="Fecha de pago"><input className="input" type="date" required value={f} onChange={(e) => setF(e.target.value)} /></Campo>
        <Campo label="Sale de"><select className="input" value={medio} onChange={(e) => setMedio(e.target.value)}><option value="banco">Banco</option><option value="caja">Caja (efectivo)</option></select></Campo>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary">Registrar pago</button></div>
      </form>
    </Modal>
  );
}
