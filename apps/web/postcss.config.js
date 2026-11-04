import { fileURLToPath } from "node:url";

// dev.mjs arranca Vite desde la raíz del monorepo: se indica la ruta de la config para no depender del directorio actual.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL("./tailwind.config.js", import.meta.url)) },
    autoprefixer: {},
  },
};
