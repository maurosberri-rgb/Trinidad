import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { mensajeError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Campo, ErrorBox, Escudo, Icon } from "../components/ui";

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
      <aside className="relative hidden overflow-hidden bg-[#eef4fd] lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#eef4fd] to-[#d6e5fb]" aria-hidden />
        {/* Círculos suaves con los colores del escudo */}
        <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#00a0f0]/10" aria-hidden />
        <div className="absolute -bottom-32 -right-20 h-[520px] w-[520px] rounded-full bg-marca/[0.07]" aria-hidden />
        <div className="absolute right-40 top-[58%] h-20 w-20 rounded-full bg-oro/25" aria-hidden />
        <div className="absolute right-24 top-20 h-10 w-10 rounded-full bg-peligro/15" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center pb-40">
          <Escudo className="h-[46vh] max-h-[460px]" />
        </div>
        <div className="absolute inset-x-14 bottom-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-peligro">Portal de familias</p>
          <p className="mt-3 max-w-md text-4xl font-semibold leading-tight text-marca">Tus cuotas, claras y al alcance de un clic.</p>
          <p className="mt-3 max-w-sm text-sm text-suave">Consultá lo que tenés pendiente, informá tu transferencia y seguí el estado de cada pago.</p>
        </div>
      </aside>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* En pantallas angostas no hay panel de arte: el escudo se muestra acá */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden"><Escudo className="h-28" /></div>
          <p className="mb-6 hidden text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-tenue lg:block">Instituto La Sma. Trinidad · Hernando</p>
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
