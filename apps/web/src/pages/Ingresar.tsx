import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { mensajeError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ErrorBox, Icon, Logo, Campo } from "../components/ui";

type Modo = "familia" | "colegio";

/** Pantalla única de acceso, con el formato partido de Derma Paz: arte de la marca a la izquierda y tarjeta a la derecha. */
export default function Ingresar() {
  const { sesion, ingresarFamilia, ingresarColegio } = useAuth();
  const nav = useNavigate();
  const [modo, setModo] = useState<Modo>("familia");
  const [dni, setDni] = useState("");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  if (sesion) return <Navigate to={sesion.rol === "admin" ? "/admin" : "/familia"} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (modo === "familia") {
        await ingresarFamilia(dni.replace(/\D/g, ""), clave);
        nav("/familia", { replace: true });
      } else {
        await ingresarColegio(usuario, clave);
        nav("/admin", { replace: true });
      }
    } catch (err) {
      setError(mensajeError(err));
      setClave("");
    } finally {
      setCargando(false);
    }
  }

  const cambiar = (m: Modo) => { setModo(m); setError(""); setClave(""); setVer(false); };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.9fr_1fr]">
      {/* Arte de la marca (solo en pantallas anchas) */}
      <aside className="relative hidden overflow-hidden bg-marca lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a4d8a] via-marca to-[#14274a]" aria-hidden />
        <svg className="absolute -right-32 top-1/2 h-[135%] -translate-y-1/2 opacity-[0.16]" viewBox="0 0 400 400" fill="none" stroke="#e7c873" strokeWidth="1.6" aria-hidden>
          <circle cx="200" cy="140" r="110" /><circle cx="140" cy="240" r="110" /><circle cx="260" cy="240" r="110" />
          <circle cx="200" cy="140" r="150" strokeDasharray="2 7" /><circle cx="140" cy="240" r="150" strokeDasharray="2 7" /><circle cx="260" cy="240" r="150" strokeDasharray="2 7" />
        </svg>
        <div className="absolute inset-x-14 bottom-14 text-white">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-oro-claro/80">Portal de familias</p>
          <p className="mt-3 max-w-md text-4xl font-semibold leading-tight">Tus cuotas, claras y al alcance de un clic.</p>
          <p className="mt-4 max-w-sm text-sm text-white/70">Consultá lo que tenés pendiente, informá tu transferencia y seguí el estado de cada pago.</p>
        </div>
      </aside>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center"><Logo centrado /></div>
          <div className="card p-6 shadow-flota sm:p-8">
            <div className="mb-6 flex rounded-xl bg-fondo p-1" role="tablist">
              {([["familia", "Familias"], ["colegio", "Colegio"]] as const).map(([m, t]) => (
                <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => cambiar(m)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${modo === m ? "bg-sup text-tinta shadow-suave" : "text-tenue hover:text-suave"}`}>
                  {t}
                </button>
              ))}
            </div>
            <h1 className="text-2xl">{modo === "familia" ? "Te damos la bienvenida" : "Acceso del colegio"}</h1>
            <p className="mt-1 text-sm text-suave">
              {modo === "familia" ? "Ingresá con el DNI del padre, madre o tutor." : "Ingresá con tu usuario de administración."}
            </p>

            <form onSubmit={enviar} className="mt-6 space-y-4" key={modo}>
              {modo === "familia" ? (
                <Campo label="DNI">
                  <input className="input" inputMode="numeric" autoComplete="username" autoFocus required placeholder="Sin puntos ni espacios"
                    value={dni} onChange={(e) => setDni(e.target.value.replace(/[^\d.]/g, ""))} />
                </Campo>
              ) : (
                <Campo label="Usuario">
                  <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
                </Campo>
              )}
              <Campo label="Contraseña" ayuda={modo === "familia" ? "Si es tu primer ingreso, tu contraseña es tu DNI." : undefined}>
                <span className="relative block">
                  <input className="input pr-11" type={ver ? "text" : "password"} required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
                  <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={ver}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-tenue hover:text-tinta">
                    <Icon name={ver ? "ojoNo" : "ojo"} />
                  </button>
                </span>
              </Campo>
              <ErrorBox error={error} />
              <button className="btn-primary w-full" disabled={cargando}>{cargando ? "Un momento…" : "Ingresar"}</button>
            </form>
          </div>
          <p className="mt-6 text-center text-xs text-tenue">
            {modo === "familia" ? "¿Problemas para ingresar? Comunicate con la administración del colegio." : "Acceso exclusivo para el personal autorizado."}
          </p>
        </div>
      </div>
    </div>
  );
}
