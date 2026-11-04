import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, mensajeError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { CambiarTema, Campo, Cargando, ErrorBox, Icon, Logo, Modal, useCarga } from "../../components/ui";

export interface CargoF {
  id: string; numero: string; descripcion: string; periodo: string; vencimiento: string; importe: number; descuento: number; bruto: number;
  pagado: number; pendiente: number; estado: "pendiente" | "parcial" | "vencido" | "pagado"; alumno: string; alumnoId: string; enRevision: boolean;
  evento: { id: string; nombre: string; fechaEvento: string; descripcion: string } | null;
}
export interface PagoF { id: string; numero: string; fecha: string; medio: string; importe: number; aFavor: number; detalle: { monto: number; descripcion: string; alumno: string }[] }
export interface ComprobanteF {
  id: string; creado: string; fechaPago: string; importe: number; nota: string; estado: "pendiente" | "aprobado" | "rechazado"; motivo: string;
  archivo: { nombre: string; tipo: string }; cargos: { descripcion: string; alumno: string }[];
}
export interface DatosFamilia {
  responsable: { id: string; dni: string; apellido: string; nombre: string; saldoAFavor: number; debeCambiarClave: boolean };
  alumnos: { id: string; nombre: string; nivel: string; curso: string }[];
  cargos: CargoF[]; pagos: PagoF[]; comprobantes: ComprobanteF[];
  banco: { colegio: string; banco: string; titular: string; cbu: string; alias: string; cuit: string };
}
export interface CtxFamilia { datos: DatosFamilia; recargar: () => Promise<void> }

export default function PortalLayout() {
  const { salir, sesion, claveCambiada } = useAuth();
  const nav = useNavigate();
  const { data, error, recargar } = useCarga(() => api<DatosFamilia>("/familia/me"));
  const [avisoClave, setAvisoClave] = useState(true);

  const link = ({ isActive }: { isActive: boolean }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-marca text-white" : "text-suave hover:bg-marca-claro hover:text-marca"}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-borde bg-sup/95 backdrop-blur"><span className="franja block h-1" aria-hidden />
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1">
            <NavLink to="/familia" end className={link}>Mis cuotas</NavLink>
            <NavLink to="/familia/historial" className={link}>Historial</NavLink>
            <CambiarTema className="ml-1" />
            <button className="rounded-lg p-2 text-tenue hover:bg-fondo hover:text-tinta" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { salir(); nav("/"); }}><Icon name="salir" /></button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {error && <ErrorBox error={error} />}
        {!data && !error && <Cargando />}
        {data && <Outlet context={{ datos: data, recargar: async () => { await recargar(); } } satisfies CtxFamilia} />}
      </main>
      {data && (sesion?.debeCambiarClave ?? data.responsable.debeCambiarClave) && avisoClave && (
        <CambiarClave onClose={() => setAvisoClave(false)} onListo={() => { claveCambiada(); setAvisoClave(false); }} />
      )}
    </div>
  );
}

function CambiarClave({ onClose, onListo }: { onClose: () => void; onListo: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setCargando(true);
    try { await api("/familia/clave", { cuerpo: { actual, nueva } }); onListo(); }
    catch (err) { setError(mensajeError(err)); } finally { setCargando(false); }
  }
  return (
    <Modal titulo="Elegí tu propia contraseña" onClose={onClose} ancho="max-w-md">
      <p className="mb-4 text-sm text-suave">Por seguridad, reemplazá la contraseña inicial (tu DNI) por una que solo vos conozcas.</p>
      <form onSubmit={enviar} className="space-y-4">
        <Campo label="Contraseña actual"><input className="input" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} /></Campo>
        <Campo label="Nueva contraseña" ayuda="Mínimo 6 caracteres y distinta de tu DNI."><input className="input" type="password" autoComplete="new-password" required minLength={6} value={nueva} onChange={(e) => setNueva(e.target.value)} /></Campo>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Más tarde</button>
          <button className="btn-primary" disabled={cargando}>{cargando ? "Guardando…" : "Guardar contraseña"}</button>
        </div>
      </form>
    </Modal>
  );
}
