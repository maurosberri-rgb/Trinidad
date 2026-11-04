import { useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { dni as fmtDni, ESTADO_CARGO, fecha, pesos } from "../../lib/format";
import RegistrarPago, { type CuentaFamilia } from "../../components/RegistrarPago";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Vacio, useCarga } from "../../components/ui";

export interface RespAdm {
  id: string; dni: string; apellido: string; nombre: string; telefono: string; email: string; saldoAFavor: number; activo: boolean;
  alumnos: string[]; deuda: number; vencido: number;
}

export function FormResponsable({ inicial, onClose, onListo }: { inicial?: Partial<RespAdm>; onClose: () => void; onListo: (id: string) => void }) {
  const [f, setF] = useState({ dni: inicial?.dni ?? "", apellido: inicial?.apellido ?? "", nombre: inicial?.nombre ?? "", telefono: inicial?.telefono ?? "", email: inicial?.email ?? "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setGuardando(true);
    try {
      const r = inicial?.id ? await api<{ id: string }>(`/admin/responsables/${inicial.id}`, { metodo: "PUT", cuerpo: f }) : await api<{ id: string }>("/admin/responsables", { cuerpo: f });
      onListo(r.id);
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  }
  return (
    <Modal titulo={inicial?.id ? "Editar padre, madre o tutor" : "Nuevo padre, madre o tutor"} onClose={onClose} ancho="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Apellido"><input className="input" required value={f.apellido} onChange={set("apellido")} /></Campo>
          <Campo label="Nombre"><input className="input" required value={f.nombre} onChange={set("nombre")} /></Campo>
        </div>
        <Campo label="DNI" ayuda={inicial?.id ? undefined : "Será su usuario. La contraseña inicial es el mismo DNI."}>
          <input className="input" inputMode="numeric" required value={f.dni} onChange={(e) => setF((x) => ({ ...x, dni: e.target.value.replace(/\D/g, "") }))} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Teléfono"><input className="input" type="tel" value={f.telefono} onChange={set("telefono")} /></Campo>
          <Campo label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Campo>
        </div>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Familias() {
  const { data, error, recargar } = useCarga(() => api<RespAdm[]>("/admin/responsables"));
  const [q, setQ] = useState("");
  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const lista = (data ?? []).filter((r) => `${r.apellido} ${r.nombre} ${r.dni} ${r.alumnos.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Cabecera titulo="Familias" subtitulo="Padres, madres y tutores: con su DNI ingresan al portal.">
        <button className="btn-primary" onClick={() => setNueva(true)}><Icon name="mas" />Nueva persona</button>
      </Cabecera>
      <div className="card">
        <div className="border-b border-borde p-4">
          <div className="relative max-w-sm">
            <Icon name="buscar" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue" />
            <input className="input pl-10" placeholder="Buscar por nombre, DNI o alumno" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <ErrorBox error={error} />
        {!data ? <Cargando /> : lista.length === 0 ? <Vacio texto="No hay personas que coincidan." icono="familias" /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Nombre</th><th>DNI</th><th>Alumnos</th><th className="num">Vencido</th><th className="num">Deuda total</th></tr></thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="clic" onClick={() => setAbierta(r.id)}>
                    <td className="font-medium">{r.apellido}, {r.nombre}{!r.activo && <Chip clase="ml-2 bg-fondo text-tenue">Inactivo</Chip>}</td>
                    <td className="tabular-nums text-suave">{fmtDni(r.dni)}</td>
                    <td className="text-suave">{r.alumnos.join(" · ") || "—"}</td>
                    <td className={`num ${r.vencido > 0 ? "font-medium text-peligro" : "text-tenue"}`}>{r.vencido > 0 ? pesos(r.vencido) : "—"}</td>
                    <td className="num font-medium">{r.deuda > 0 ? pesos(r.deuda) : <span className="text-ok">Al día</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {nueva && <FormResponsable onClose={() => setNueva(false)} onListo={() => { setNueva(false); void recargar(); }} />}
      {abierta && <FichaFamilia id={abierta} resp={data?.find((r) => r.id === abierta)} onClose={() => setAbierta(null)} onCambio={() => void recargar()} />}
    </>
  );
}

function FichaFamilia({ id, resp, onClose, onCambio }: { id: string; resp?: RespAdm; onClose: () => void; onCambio: () => void }) {
  const { data, recargar, error } = useCarga(() => api<CuentaFamilia>(`/admin/responsables/${id}/cuenta`), [id]);
  const [cobrando, setCobrando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [err, setErr] = useState("");

  const accion = async (ruta: string, ok: string, confirmacion?: string) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setErr(""); setAviso("");
    try { await api(ruta, { metodo: "POST", cuerpo: {} }); setAviso(ok); await recargar(); onCambio(); } catch (e) { setErr(mensajeError(e)); }
  };
  const pend = (data?.cargos ?? []).filter((c) => c.pendiente > 0);

  return (
    <Modal titulo={data ? `${data.responsable.apellido}, ${data.responsable.nombre}` : "Familia"} onClose={onClose} ancho="max-w-3xl">
      <ErrorBox error={error || err} />
      {aviso && <p className="mb-3 rounded-xl bg-ok-claro px-4 py-2.5 text-sm text-ok" role="status">{aviso}</p>}
      {!data ? <Cargando /> : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm text-suave">
              <p>DNI {fmtDni(data.responsable.dni)}{data.responsable.telefono && ` · ${data.responsable.telefono}`}{data.responsable.email && ` · ${data.responsable.email}`}</p>
              {resp && resp.alumnos.length > 0 && <p className="mt-0.5">Alumnos: {resp.alumnos.join(" · ")}</p>}
              {data.responsable.saldoAFavor > 0 && <p className="mt-1 font-medium text-ok">Saldo a favor: {pesos(data.responsable.saldoAFavor)}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-sec btn-sm" onClick={() => setEditando(true)}>Editar</button>
              <button className="btn-sec btn-sm" onClick={() => accion(`/admin/responsables/${id}/reiniciar-clave`, "Contraseña reiniciada: ahora es el DNI.", "¿Reiniciar la contraseña? Volverá a ser el DNI de la persona.")}>Reiniciar clave</button>
              {data.responsable.saldoAFavor > 0 && pend.length > 0 && <button className="btn-sec btn-sm" onClick={() => accion(`/admin/responsables/${id}/aplicar-saldo`, "Saldo a favor aplicado a las cuotas pendientes.")}>Aplicar saldo a favor</button>}
              <button className="btn-primary btn-sm" onClick={() => setCobrando(true)}>Registrar cobro</button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm">Cuotas y actividades</h3>
            {data.cargos.length === 0 ? <p className="text-sm text-tenue">Sin cargos todavía.</p> : (
              <div className="overflow-x-auto rounded-xl border border-borde">
                <table className="tabla">
                  <thead><tr><th>Alumno</th><th>Concepto</th><th>Vence</th><th className="num">Importe</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {data.cargos.map((c) => (
                      <tr key={c.id}>
                        <td>{c.alumno.split(", ")[1]}</td><td>{c.descripcion}</td><td>{fecha(c.vencimiento)}</td>
                        <td className="num">{pesos(c.importe)}</td><td className="num font-medium">{pesos(c.pendiente)}</td>
                        <td><Chip clase={ESTADO_CARGO[c.estado].clase}>{ESTADO_CARGO[c.estado].texto}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm">Recibos</h3>
            {data.pagos.length === 0 ? <p className="text-sm text-tenue">Sin pagos registrados.</p> : (
              <ul className="rounded-xl border border-borde text-sm">
                {data.pagos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-borde/70 px-4 py-2.5 last:border-0">
                    <span className={p.anulado ? "text-tenue line-through" : ""}>{p.numero} · {fecha(p.fecha)} · {p.medio}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">{pesos(p.importe)}</span>
                      {!p.anulado && <button className="text-xs text-peligro hover:underline" onClick={() => accion(`/admin/pagos/${p.id}/anular`, `Recibo ${p.numero} anulado.`, `¿Anular el recibo ${p.numero}? Las cuotas vuelven a quedar pendientes.`)}>Anular</button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {cobrando && <RegistrarPago responsableId={id} onClose={() => setCobrando(false)} onListo={() => { setCobrando(false); setAviso("Cobro registrado."); void recargar(); onCambio(); }} />}
      {editando && data && <FormResponsable inicial={{ ...data.responsable, activo: true } as Partial<RespAdm>} onClose={() => setEditando(false)} onListo={() => { setEditando(false); void recargar(); onCambio(); }} />}
    </Modal>
  );
}
