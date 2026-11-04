import { useEffect, useState } from "react";

const CLAVE = "trinidad.tema";
export type Tema = "claro" | "oscuro";

const guardado = (): Tema | null => {
  try { const v = localStorage.getItem(CLAVE); return v === "claro" || v === "oscuro" ? v : null; } catch { return null; }
};
const delSistema = (): Tema => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");

export const temaActual = (): Tema => (document.documentElement.dataset.tema as Tema) || guardado() || delSistema();

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.tema = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "oscuro" ? "#0b0f19" : "#082f85");
}

/** Arranque: la elección guardada, o la del sistema operativo la primera vez. */
export function iniciarTema() { aplicarTema(guardado() ?? delSistema()); }

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaActual);
  useEffect(() => { aplicarTema(tema); }, [tema]);
  const alternar = () => setTema((t) => {
    const n: Tema = t === "oscuro" ? "claro" : "oscuro";
    try { localStorage.setItem(CLAVE, n); } catch { /* sin almacenamiento */ }
    return n;
  });
  return { tema, alternar };
}
