// Arranca la API (puerto 4500) y la web (puerto 5500) con el mismo Node que ejecuta este archivo.
// Equivale a `npm run dev`, pero sin pasar por npm ni por .cmd (algunas políticas de Windows los bloquean).
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));

if (!fs.existsSync(path.join(raiz, "node_modules"))) {
  console.error("Faltan las dependencias. Ejecutá una vez:  npm install   (en la carpeta trinidad)");
  process.exit(1);
}

/** Si el puerto ya está ocupado (por ejemplo, otra ventana del sistema abierta), se avisa en vez de fallar en silencio. */
const libre = (puerto) =>
  new Promise((ok) => {
    const s = net.createServer().once("error", () => ok(false)).once("listening", () => s.close(() => ok(true)));
    s.listen(puerto);
  });

for (const [puerto, quien] of [[4500, "la API"], [5500, "la web"]]) {
  if (!(await libre(puerto))) {
    console.error(`El puerto ${puerto} (${quien}) ya está en uso: probablemente el sistema ya está abierto en otra ventana.`);
    console.error(`Abrilo en http://localhost:5500 o cerrá esa ventana y volvé a iniciar.`);
    process.exit(1);
  }
}

const lanzar = (nombre, args, extra = {}) => {
  const p = spawn(process.execPath, args, { cwd: raiz, stdio: ["pipe", "inherit", "inherit"], env: { ...process.env, ...extra } });
  p.on("exit", (codigo) => console.log(`[${nombre}] terminó (código ${codigo})`));
  return p;
};

// Acceso inicial: usuario "admin" y clave "admin" (se cambia desde Ajustes → Seguridad). Si ya existe apps/api/data, la clave guardada no cambia.
const hijos = [
  lanzar("api", ["node_modules/tsx/dist/cli.mjs", "watch", "apps/api/src/index.ts"], { PORT: "4500", ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin" }),
  lanzar("web", ["node_modules/vite/bin/vite.js", "apps/web"]),
];

console.log("\nInstituto Santísima Trinidad listo en  http://localhost:5500\n");

const cerrar = () => hijos.forEach((h) => h.kill());
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
process.on("exit", cerrar);
