import { useEffect, useState, type FormEvent } from "react";
import { api, mensajeError } from "../lib/api";
import { ESTADO_CARGO, MEDIOS, fecha, hoyISO, pesos, sumar } from "../lib/format";
import { Campo, Chip, ErrorBox, Modal, useCarga } from "./ui";

export interface CargoAdm {
  id: string; numero: string; descripcion: string; periodo: string; emision: string; vencimiento: string; bruto: number; descuento: number; importe: number;
  pagado: number; pendiente: number; estado: string; alumno: string; alumnoId: string; responsableId: string;
}
export interface PagoAdm {
  id: string; numero: string; fecha: string; medio: string; referencia?: string; conciliado?: boolean; importe: number; aFavor: number; observacion: string; anulado: boolean; responsable: string; responsableId: string;
  detalle: { monto: number; descripcion: string; alumno: string }[];
}
export interface CuentaFamilia {
  responsable: { id: string; dni: string; apellido: string; nombre: string; telefono: string; email: string; saldoAFavor: number };
  cargos: CargoAdm[]; pagos: PagoAdm[];
}

/** Registro de un cobro en ventanilla: se eligen las cuotas a cancelar (por defecto todas las pendientes) y el importe recibido. */
export default function RegistrarPago({ responsableId, onClose, onListo }: { responsableId: string; onClose: () => void; onListo: () => void }) {
  const { data, error: errCarga } = useCarga(() => api<CuentaFamilia>(`/admin/responsables/${responsableId}/cuenta`), [responsableId]);
  const pendientes = (data?.cargos ?? []).filter((c) => c.pendiente > 0);
  const [elegidas, setElegidas] = useState<Set<string> | null>(null);
  const [importe, setImporte] = useState("");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [medio, setMedio] = useState("efectivo");
  const [obs, setObs] = useState("");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (data && elegidas === null) {
      const todas = new Set(data.cargos.filter((c) => c.pendiente > 0).map((c) => c.id));
      setElegidas(todas);
      setImporte(String(sumar(data.cargos.filter((c) => c.pendiente > 0).map((c) => c.pendiente))));
    }
  }, [data, elegidas]);

  const sel = pendientes.filter((c) => elegidas?.has(c.id));
  const totalSel = sumar(sel.map((c) => c.pendiente));
  const alternar = (id: string) => {
    const n = new Set(elegidas);
    if (n.has(id)) n.delete(id); else n.add(id);
    setElegidas(n);
    setImporte(String(sumar(pendientes.filter((c) => n.has(c.id)).map((c) => c.pendiente))));
  };
  const excedente = Math.max(0, Number(importe) - totalSel);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setGuardando(true);
    try {
      await api("/admin/pagos", { cuerpo: { responsableId, fecha: fechaPago, medio, referencia, importe: Number(importe), cargoIds: sel.map((c) => c.id), observacion: obs } });
      onListo();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  }

  return (
    <Modal titulo={data ? `Registrar cobro · ${data.responsable.apellido}, ${data.responsable.nombre}` : "Registrar cobro"} onClose={onClose} ancho="max-w-2xl">
      <ErrorBox error={errCarga} />
      {data && pendientes.length === 0 && <p className="text-sm text-suave">Esta familia no tiene cuotas pendientes. Si el pago es adelantado, registrá el importe y quedará como saldo a favor.</p>}
      {data && (
        <form onSubmit={enviar} className="space-y-4">
          {pendientes.length > 0 && (
            <ul className="max-h-60 overflow-y-auto rounded-xl border border-borde">
              {pendientes.map((c) => (
                <li key={c.id} className="border-b border-borde/70 last:border-0">
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-fondo/60">
                    <input type="checkbox" className="h-4 w-4 accent-marca" checked={elegidas?.has(c.id) ?? false} onChange={() => alternar(c.id)} />
                    <span className="min-w-0 flex-1 truncate">{c.alumno.split(", ")[1]} · {c.descripcion} <span className="text-tenue">· vence {fecha(c.vencimiento)}</span></span>
                    <Chip clase={ESTADO_CARGO[c.estado]?.clase ?? ""}>{ESTADO_CARGO[c.estado]?.texto}</Chip>
                    <span className="w-24 text-right font-medium tabular-nums">{pesos(c.pendiente)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Importe recibido"><input className="input" type="number" min="0.01" step="0.01" required value={importe} onChange={(e) => setImporte(e.target.value)} /></Campo>
            <Campo label="Fecha"><input className="input" type="date" required value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} /></Campo>
            <Campo label="Medio">
              <select className="input" value={medio} onChange={(e) => { setMedio(e.target.value); setReferencia(""); }}>
                {Object.entries(MEDIOS).map(([k, m]) => <option key={k} value={k}>{m.texto}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {MEDIOS[medio]?.ayuda && <Campo label={MEDIOS[medio].ayuda}><input className="input" maxLength={80} value={referencia} onChange={(e) => setReferencia(e.target.value)} /></Campo>}
            <Campo label="Observación (opcional)" className={MEDIOS[medio]?.ayuda ? "" : "sm:col-span-2"}><input className="input" maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
          </div>
          {(medio === "cheque" || medio === "tarjeta_debito" || medio === "tarjeta_credito") && (
            <p className="rounded-xl bg-marca-claro px-4 py-2.5 text-sm text-marca">Queda en «Valores a depositar» hasta que se acredite en el banco; al conciliar el extracto pasa a la cuenta bancaria.</p>
          )}
          {excedente > 0 && <p className="rounded-xl bg-oro-claro px-4 py-2.5 text-sm text-aviso">El importe supera las cuotas elegidas en {pesos(excedente)}: ese excedente queda como saldo a favor de la familia.</p>}
          {sel.length > 0 && Number(importe) > 0 && Number(importe) < totalSel && <p className="rounded-xl bg-marca-claro px-4 py-2.5 text-sm text-marca">El pago es menor al total elegido: se aplica desde la cuota más antigua y la última queda con pago parcial.</p>}
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={guardando}>{guardando ? "Registrando…" : "Registrar cobro"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
