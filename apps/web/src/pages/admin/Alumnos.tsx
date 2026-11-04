import { useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { Cabecera, Campo, Cargando, Chip, ErrorBox, Icon, Modal, Vacio, useCarga } from "../../components/ui";
import { FormResponsable, type RespAdm } from "./Familias";

interface AlumnoAdm {
  id: string; nombreCompleto: string; apellido: string; nombre: string; dni: string; nivel: "Inicial" | "Primario" | "Secundario"; curso: string;
  becaPct: number; activo: boolean; responsableIds: string[]; pagadorId: string; pagador: string; responsables: { id: string; nombre: string; dni: string }[];
}

export default function Alumnos() {
  const { data, error, recargar } = useCarga(() => api<AlumnoAdm[]>("/admin/alumnos"));
  const [q, setQ] = useState("");
  const [nivel, setNivel] = useState("");
  const [editando, setEditando] = useState<AlumnoAdm | "nuevo" | null>(null);
  const lista = (data ?? []).filter((a) => (!nivel || a.nivel === nivel) && `${a.nombreCompleto} ${a.dni} ${a.curso} ${a.pagador}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Cabecera titulo="Alumnos" subtitulo={data ? `${data.filter((a) => a.activo).length} alumnos activos` : undefined}>
        <button className="btn-primary" onClick={() => setEditando("nuevo")}><Icon name="mas" />Nuevo alumno</button>
      </Cabecera>
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-borde p-4">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Icon name="buscar" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue" />
            <input className="input pl-10" placeholder="Buscar alumno, curso o responsable" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={nivel} onChange={(e) => setNivel(e.target.value)} aria-label="Filtrar por nivel">
            <option value="">Todos los niveles</option><option>Inicial</option><option>Primario</option><option>Secundario</option>
          </select>
        </div>
        <ErrorBox error={error} />
        {!data ? <Cargando /> : lista.length === 0 ? <Vacio texto="No hay alumnos que coincidan." icono="alumnos" /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Alumno</th><th>Nivel</th><th>Curso</th><th>Responsable de pago</th><th className="num">Beca</th></tr></thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="clic" onClick={() => setEditando(a)}>
                    <td className="font-medium">{a.nombreCompleto}{!a.activo && <Chip clase="ml-2 bg-fondo text-tenue">Inactivo</Chip>}</td>
                    <td className="text-suave">{a.nivel}</td><td className="text-suave">{a.curso || "—"}</td>
                    <td className="text-suave">{a.pagador}</td>
                    <td className="num">{a.becaPct > 0 ? <Chip clase="bg-oro-claro text-aviso">{a.becaPct}%</Chip> : <span className="text-tenue">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && <FormAlumno alumno={editando === "nuevo" ? null : editando} onClose={() => setEditando(null)} onListo={() => { setEditando(null); void recargar(); }} />}
    </>
  );
}

function FormAlumno({ alumno, onClose, onListo }: { alumno: AlumnoAdm | null; onClose: () => void; onListo: () => void }) {
  const resp = useCarga(() => api<RespAdm[]>("/admin/responsables"));
  const [f, setF] = useState({
    apellido: alumno?.apellido ?? "", nombre: alumno?.nombre ?? "", dni: alumno?.dni ?? "", nivel: alumno?.nivel ?? "Primario",
    curso: alumno?.curso ?? "", becaPct: String(alumno?.becaPct ?? 0), activo: alumno?.activo ?? true,
  });
  const [ids, setIds] = useState<string[]>(alumno?.responsableIds ?? []);
  const [pagador, setPagador] = useState(alumno?.pagadorId ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [busca, setBusca] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const todos = resp.data ?? [];
  const nombreDe = (id: string) => { const r = todos.find((x) => x.id === id); return r ? `${r.apellido}, ${r.nombre}` : "…"; };
  const candidatos = todos.filter((r) => !ids.includes(r.id) && `${r.apellido} ${r.nombre} ${r.dni}`.toLowerCase().includes(busca.toLowerCase())).slice(0, 6);
  const agregar = (id: string) => { setIds((l) => [...l, id]); if (!pagador) setPagador(id); setBusca(""); };
  const quitar = (id: string) => { setIds((l) => l.filter((x) => x !== id)); if (pagador === id) setPagador(""); };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setGuardando(true);
    const cuerpo = { ...f, becaPct: Number(f.becaPct), responsableIds: ids, pagadorId: pagador || ids[0] };
    try {
      if (alumno) await api(`/admin/alumnos/${alumno.id}`, { metodo: "PUT", cuerpo }); else await api("/admin/alumnos", { cuerpo });
      onListo();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  }

  return (
    <Modal titulo={alumno ? "Editar alumno" : "Nuevo alumno"} onClose={onClose} ancho="max-w-xl">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Apellido"><input className="input" required value={f.apellido} onChange={set("apellido")} /></Campo>
          <Campo label="Nombre"><input className="input" required value={f.nombre} onChange={set("nombre")} /></Campo>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Nivel"><select className="input" value={f.nivel} onChange={set("nivel")}><option>Inicial</option><option>Primario</option><option>Secundario</option></select></Campo>
          <Campo label="Curso / sala"><input className="input" placeholder="Ej.: 4° A" value={f.curso} onChange={set("curso")} /></Campo>
          <Campo label="DNI del alumno"><input className="input" inputMode="numeric" value={f.dni} onChange={(e) => setF((x) => ({ ...x, dni: e.target.value.replace(/\D/g, "") }))} /></Campo>
        </div>
        <Campo label="Beca o descuento (%)" ayuda="Se aplica a cuotas y matrícula. Las actividades extra se cobran completas.">
          <input className="input max-w-[140px]" type="number" min="0" max="100" step="1" value={f.becaPct} onChange={set("becaPct")} />
        </Campo>

        <div>
          <span className="label">Padre, madre o tutor</span>
          {ids.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {ids.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2 rounded-xl border border-borde px-3 py-2 text-sm">
                  <span className="truncate">{nombreDe(id)}</span>
                  <span className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-suave"><input type="radio" name="pagador" className="accent-marca" checked={(pagador || ids[0]) === id} onChange={() => setPagador(id)} />Paga las cuotas</label>
                    <button type="button" onClick={() => quitar(id)} className="text-tenue hover:text-peligro" aria-label="Quitar"><Icon name="cerrar" size={15} /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <input className="input" placeholder="Buscar por nombre o DNI para agregar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {busca && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-borde bg-sup shadow-flota">
                {candidatos.map((r) => <li key={r.id}><button type="button" className="w-full px-4 py-2.5 text-left text-sm hover:bg-fondo" onClick={() => agregar(r.id)}>{r.apellido}, {r.nombre} <span className="text-tenue">· DNI {r.dni}</span></button></li>)}
                {candidatos.length === 0 && <li className="px-4 py-2.5 text-sm text-tenue">Sin resultados.</li>}
              </ul>
            )}
          </div>
          <button type="button" className="mt-2 text-sm font-medium text-marca hover:underline" onClick={() => setCreando(true)}>+ Crear una persona nueva</button>
        </div>

        {alumno && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-marca" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} />Alumno activo (los inactivos no reciben nuevos cargos)</label>
        )}
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
      {creando && <FormResponsable onClose={() => setCreando(false)} onListo={async (id) => { setCreando(false); await resp.recargar(); agregar(id); }} />}
    </Modal>
  );
}
