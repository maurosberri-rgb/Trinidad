import { useEffect, useState, type FormEvent } from "react";
import { api, mensajeError } from "../../lib/api";
import { Cabecera, Campo, Cargando, ErrorBox, useCarga } from "../../components/ui";

interface Aj { colegio: string; cuit: string; direccion: string; telefono: string; email: string; banco: string; titular: string; cbu: string; alias: string; diaVencimiento: number; cicloLectivo: number; demo: boolean }

export default function Ajustes() {
  const { data, error } = useCarga(() => api<Aj>("/admin/ajustes"));
  const [f, setF] = useState<Aj | null>(null);
  const [aviso, setAviso] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (data) setF(data); }, [data]);
  if (error) return <ErrorBox error={error} />;
  if (!f) return <Cargando />;
  const set = (k: keyof Aj) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(""); setAviso("");
    try { await api("/admin/ajustes", { metodo: "PUT", cuerpo: f }); setAviso("Cambios guardados."); } catch (x) { setErr(mensajeError(x)); }
  }

  return (
    <>
      <Cabecera titulo="Ajustes" subtitulo="Datos del colegio, cuenta para transferencias y seguridad." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={guardar} className="card space-y-6 p-6">
          <section className="space-y-4">
            <h2 className="text-base">Datos del colegio</h2>
            <Campo label="Nombre"><input className="input" value={f.colegio} onChange={set("colegio")} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="CUIT"><input className="input" value={f.cuit} onChange={set("cuit")} /></Campo>
              <Campo label="Teléfono"><input className="input" value={f.telefono} onChange={set("telefono")} /></Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Dirección"><input className="input" value={f.direccion} onChange={set("direccion")} /></Campo>
              <Campo label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Campo>
            </div>
          </section>
          <section className="space-y-4 border-t border-borde pt-6">
            <div>
              <h2 className="text-base">Cuenta para transferencias</h2>
              <p className="mt-1 text-xs text-tenue">Es lo que ven las familias cuando informan un pago.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Banco"><input className="input" value={f.banco} onChange={set("banco")} /></Campo>
              <Campo label="Titular"><input className="input" value={f.titular} onChange={set("titular")} /></Campo>
              <Campo label="CBU / CVU"><input className="input" inputMode="numeric" value={f.cbu} onChange={set("cbu")} /></Campo>
              <Campo label="Alias"><input className="input" value={f.alias} onChange={set("alias")} /></Campo>
            </div>
          </section>
          <section className="space-y-4 border-t border-borde pt-6">
            <h2 className="text-base">Ciclo lectivo</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Año del ciclo"><input className="input" type="number" min="2000" max="2100" value={f.cicloLectivo} onChange={set("cicloLectivo")} /></Campo>
              <Campo label="Día de vencimiento de cuotas" ayuda="Del 1 al 28; se propone al generar cuotas."><input className="input" type="number" min="1" max="28" value={f.diaVencimiento} onChange={set("diaVencimiento")} /></Campo>
            </div>
          </section>
          <ErrorBox error={err} />
          {aviso && <p className="rounded-xl bg-ok-claro px-4 py-2.5 text-sm text-ok" role="status">{aviso}</p>}
          <div className="flex justify-end"><button className="btn-primary">Guardar cambios</button></div>
        </form>

        <div className="space-y-6">
          <Seguridad />
          <Datos demo={f.demo} />
        </div>
      </div>
    </>
  );
}

function Seguridad() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setOk(false);
    try { await api("/admin/ajustes/clave", { cuerpo: { actual, nueva } }); setOk(true); setActual(""); setNueva(""); } catch (x) { setError(mensajeError(x)); }
  }
  return (
    <form onSubmit={enviar} className="card space-y-4 p-6">
      <h2 className="text-base">Mi contraseña</h2>
      <Campo label="Contraseña actual"><input className="input" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} /></Campo>
      <Campo label="Nueva contraseña" ayuda="Mínimo 6 caracteres."><input className="input" type="password" autoComplete="new-password" required minLength={6} value={nueva} onChange={(e) => setNueva(e.target.value)} /></Campo>
      <ErrorBox error={error} />
      {ok && <p className="rounded-xl bg-ok-claro px-4 py-2.5 text-sm text-ok" role="status">Contraseña actualizada.</p>}
      <button className="btn-sec w-full">Cambiar contraseña</button>
    </form>
  );
}

function Datos({ demo }: { demo: boolean }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  async function limpiar(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await api("/admin/ajustes/limpiar-datos", { cuerpo: { confirmar: texto } }); window.location.reload(); } catch (x) { setError(mensajeError(x)); }
  }
  return (
    <form onSubmit={limpiar} className="card space-y-3 p-6">
      <h2 className="text-base">Datos cargados</h2>
      <p className="text-sm text-suave">{demo ? "El sistema tiene datos de ejemplo para que lo pruebes. Antes de empezar a usarlo de verdad, borralos." : "Borra alumnos, familias, cargos, recibos, gastos y asientos. Se conservan el plan de cuentas, los conceptos y los ajustes."}</p>
      <Campo label="Escribí BORRAR para confirmar"><input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
      <ErrorBox error={error} />
      <button className="btn-danger w-full" disabled={texto !== "BORRAR"}>Borrar todos los datos</button>
    </form>
  );
}
