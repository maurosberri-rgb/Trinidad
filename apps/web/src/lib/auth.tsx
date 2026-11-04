import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, guardarSesion, leerSesion, type SesionGuardada } from "./api";

interface Ctx {
  sesion: SesionGuardada | null;
  ingresarFamilia: (dni: string, clave: string) => Promise<SesionGuardada>;
  ingresarColegio: (usuario: string, clave: string) => Promise<SesionGuardada>;
  claveCambiada: () => void;
  salir: () => void;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionGuardada | null>(leerSesion);

  const fijar = useCallback((s: SesionGuardada | null) => { guardarSesion(s); setSesion(s); return s; }, []);

  const valor = useMemo<Ctx>(() => ({
    sesion,
    ingresarFamilia: async (dni, clave) => {
      const r = await api<{ token: string; nombre: string; debeCambiarClave: boolean }>("/auth/familia", { cuerpo: { dni, clave } });
      return fijar({ rol: "familia", token: r.token, nombre: r.nombre, debeCambiarClave: r.debeCambiarClave })!;
    },
    ingresarColegio: async (usuario, clave) => {
      const r = await api<{ token: string; nombre: string }>("/auth/admin", { cuerpo: { usuario, clave } });
      return fijar({ rol: "admin", token: r.token, nombre: r.nombre })!;
    },
    claveCambiada: () => { const s = leerSesion(); if (s) fijar({ ...s, debeCambiarClave: false }); },
    salir: () => { fijar(null); },
  }), [sesion, fijar]);

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth fuera de AuthProvider");
  return c;
}
