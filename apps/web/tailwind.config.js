import { fileURLToPath } from "node:url";

const aqui = fileURLToPath(new URL(".", import.meta.url)).replace(/\\/g, "/");
const t = (n) => `rgb(var(--c-${n}) / <alpha-value>)`;

// Paleta sobria: azul tinta como color de marca, dorado suave como acento y grises neutros.
export default {
  content: [`${aqui}index.html`, `${aqui}src/**/*.{ts,tsx}`],
  theme: {
    extend: {
      colors: {
        fondo: t("fondo"), sup: t("sup"), borde: t("borde"), tinta: t("tinta"), suave: t("suave"), tenue: t("tenue"),
        marca: { DEFAULT: t("marca"), oscuro: t("marca-oscuro"), claro: t("marca-claro") },
        oro: { DEFAULT: t("oro"), claro: t("oro-claro") },
        ok: { DEFAULT: t("ok"), claro: t("ok-claro") },
        aviso: { DEFAULT: t("aviso"), claro: t("aviso-claro") },
        peligro: { DEFAULT: t("peligro"), claro: t("peligro-claro") },
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"] },
      boxShadow: { suave: "0 1px 2px rgb(16 24 40 / .05)", flota: "0 18px 40px -16px rgb(31 58 104 / .28)" },
    },
  },
  plugins: [],
};
