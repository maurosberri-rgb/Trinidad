import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Icon, Logo, useCarga } from "../../components/ui";

const MENU = [
  { a: "/admin", t: "Panel", i: "panel", fin: true },
  { a: "/admin/alumnos", t: "Alumnos", i: "alumnos" },
  { a: "/admin/familias", t: "Familias", i: "familias" },
  { a: "/admin/cobranza", t: "Cobranza", i: "cobranza" },
  { a: "/admin/comprobantes", t: "Comprobantes", i: "comprobantes", insignia: true },
  { a: "/admin/cargos", t: "Cuotas y actividades", i: "cargos" },
  { a: "/admin/gastos", t: "Gastos", i: "gastos" },
  { a: "/admin/contabilidad", t: "Contabilidad", i: "contabilidad" },
  { a: "/admin/ajustes", t: "Ajustes", i: "ajustes" },
];

export default function AdminLayout() {
  const { salir, sesion } = useAuth();
  const nav = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  // Se vuelve a consultar al cambiar de pantalla para que la insignia de comprobantes esté al día.
  const pend = useCarga(() => api<{ comprobantesPendientes: number }>("/admin/resumen"), [pathname]);
  const cuantos = pend.data?.comprobantesPendientes ?? 0;

  const menu = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {MENU.map((m) => (
        <NavLink key={m.a} to={m.a} end={m.fin} onClick={() => setAbierto(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-marca-claro text-marca" : "text-suave hover:bg-fondo hover:text-tinta"}`}>
          <Icon name={m.i} />
          <span className="flex-1">{m.t}</span>
          {m.insignia && cuantos > 0 && <span className="rounded-full bg-oro px-2 py-0.5 text-[11px] font-semibold text-white">{cuantos}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="no-imprimir sticky top-0 hidden h-screen flex-col border-r border-borde bg-sup py-5 lg:flex">
        <div className="mb-6 px-5"><Logo /></div>
        {menu}
        <div className="mt-4 border-t border-borde px-5 pt-4">
          <p className="truncate text-xs text-tenue">{sesion?.nombre}</p>
          <button className="mt-2 flex items-center gap-2 text-sm text-suave hover:text-tinta" onClick={() => { salir(); nav("/"); }}><Icon name="salir" size={16} />Cerrar sesión</button>
        </div>
      </aside>

      <div className="no-imprimir sticky top-0 z-30 flex items-center justify-between border-b border-borde bg-sup/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button className="rounded-lg p-2 text-suave hover:bg-fondo" onClick={() => setAbierto(true)} aria-label="Abrir menú"><Icon name="menu" size={22} /></button>
      </div>
      {abierto && (
        <div className="no-imprimir fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-tinta/40" onClick={() => setAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sup py-5 shadow-flota">
            <div className="mb-6 flex items-center justify-between px-5"><Logo /><button onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-tenue"><Icon name="cerrar" /></button></div>
            {menu}
            <div className="mt-4 border-t border-borde px-5 pt-4">
              <button className="flex items-center gap-2 text-sm text-suave" onClick={() => { salir(); nav("/"); }}><Icon name="salir" size={16} />Cerrar sesión</button>
            </div>
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}
