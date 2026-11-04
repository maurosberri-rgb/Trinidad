import { useState, type FormEvent } from "react";
import { api, archivoUrl, mensajeError } from "../../lib/api";
import { fecha, hoyISO, pesos, sumar } from "../../lib/format";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Pestanas, Vacio, useCarga } from "../../components/ui";

interface Cp {
  id: string; responsable: string; creado: string; fechaPago: string; importe: number; nota: string; estado: "pendiente" | "aprobado" | "rechazado"; motivo: string;
  archivo: { nombre: string; tipo: string }; cargos: { id: string; descripcion: string; alumno: string; pendiente: number }[];
}
const ESTADO = { pendiente: ["En revisión", "bg-aviso-claro text-aviso"], aprobado: ["Aprobado", "bg-ok-claro text-ok"], rechazado: ["Rechazado", "bg-peligro-claro text-peligro"] } as const;

export default function Comprobantes() {
  const [filtro, setFiltro] = useState<"pendiente" | "todos">("pendiente");
  const { data, error, recargar } = useCarga(() => api<Cp[]>(`/admin/comprobantes${filtro === "pendiente" ? "?estado=pendiente" : ""}`), [filtro]);
  const [resolviendo, setResolviendo] = useState<{ cp: Cp; accion: "aprobar" | "rechazar" } | null>(null);
  const [err, setErr] = useState("");

  const ver = async (cp: Cp) => {
    setErr("");
    try { const { url } = await archivoUrl(`/admin/comprobantes/${cp.id}/archivo`); window.open(url, "_blank", "noopener"); } catch (e) { setErr(mensajeError(e)); }
  };

  return (
    <>
      <Cabecera titulo="Comprobantes" subtitulo="Transferencias informadas por las familias desde el portal." />
      <Pestanas valor={filtro} onChange={setFiltro} opciones={[{ id: "pendiente", texto: "Por revisar" }, { id: "todos", texto: "Todos" }]} />
      <ErrorBox error={error || err} />
      {!data ? <Cargando /> : data.length === 0 ? (
        <div className="card"><Vacio icono="ok" texto={filtro === "pendiente" ? "No hay comprobantes por revisar." : "Todavía no se informó ningún comprobante."} /></div>
      ) : (
        <div className="space-y-3">
          {data.map((cp) => (
            <article key={cp.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{cp.responsable}</p>
                  <p className="mt-0.5 text-xs text-tenue">Transferencia del {fecha(cp.fechaPago)} · informada el {fecha(cp.creado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold tabular-nums">{pesos(cp.importe)}</p>
                  <Chip clase={ESTADO[cp.estado][1]}>{ESTADO[cp.estado][0]}</Chip>
                </div>
              </div>
              <ul className="mt-3 space-y-1 rounded-xl bg-fondo/70 px-4 py-3 text-sm">
                {cp.cargos.map((c) => <li key={c.id} className="flex justify-between gap-3"><span className="truncate">{c.alumno.split(", ")[1]} · {c.descripcion}</span><span className="tabular-nums text-suave">{pesos(c.pendiente)}</span></li>)}
                <li className="flex justify-between border-t border-borde pt-1.5 font-medium"><span>Pendiente de esas cuotas</span><span className="tabular-nums">{pesos(sumar(cp.cargos.map((c) => c.pendiente)))}</span></li>
              </ul>
              {cp.nota && <p className="mt-2 text-sm text-suave">«{cp.nota}»</p>}
              {cp.estado === "rechazado" && <p className="mt-2 text-sm text-peligro">Motivo: {cp.motivo}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="btn-sec btn-sm" onClick={() => ver(cp)}><Icon name="archivo" size={15} />Ver comprobante</button>
                {cp.estado === "pendiente" && (
                  <>
                    <button className="btn-primary btn-sm ml-auto" onClick={() => setResolviendo({ cp, accion: "aprobar" })}><Icon name="ok" size={15} />Aprobar y aplicar</button>
                    <button className="btn-sec btn-sm text-peligro" onClick={() => setResolviendo({ cp, accion: "rechazar" })}>Rechazar</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {resolviendo && <Resolver {...resolviendo} onClose={() => setResolviendo(null)} onListo={() => { setResolviendo(null); void recargar(); }} />}
    </>
  );
}

function Resolver({ cp, accion, onClose, onListo }: { cp: Cp; accion: "aprobar" | "rechazar"; onClose: () => void; onListo: () => void }) {
  const [importe, setImporte] = useState(String(cp.importe));
  const [fechaPago, setFechaPago] = useState(cp.fechaPago || hoyISO());
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setEnviando(true);
    try {
      if (accion === "aprobar") await api(`/admin/comprobantes/${cp.id}/aprobar`, { cuerpo: { importe: Number(importe), fecha: fechaPago } });
      else await api(`/admin/comprobantes/${cp.id}/rechazar`, { cuerpo: { motivo } });
      onListo();
    } catch (err) { setError(mensajeError(err)); } finally { setEnviando(false); }
  }

  return (
    <Modal titulo={accion === "aprobar" ? "Aprobar comprobante" : "Rechazar comprobante"} onClose={onClose} ancho="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        {accion === "aprobar" ? (
          <>
            <p className="text-sm text-suave">Se emite un recibo a nombre de <strong>{cp.responsable}</strong> y se aplica a las cuotas indicadas, empezando por la más antigua. Verificá que el dinero haya llegado a la cuenta.</p>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Importe acreditado" ayuda="Corregilo si difiere de lo informado."><input className="input" type="number" min="0.01" step="0.01" required value={importe} onChange={(e) => setImporte(e.target.value)} /></Campo>
              <Campo label="Fecha de acreditación"><input className="input" type="date" required value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} /></Campo>
            </div>
          </>
        ) : (
          <Campo label="Motivo (lo verá la familia)"><textarea className="input min-h-[96px]" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: El importe no coincide con lo acreditado en la cuenta." /></Campo>
        )}
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={accion === "aprobar" ? "btn-primary" : "btn-danger"} disabled={enviando}>{enviando ? "Procesando…" : accion === "aprobar" ? "Aprobar y aplicar" : "Rechazar"}</button>
        </div>
      </form>
    </Modal>
  );
}
