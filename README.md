# Instituto Santísima Trinidad

Cobro de cuotas y actividades, gastos, plan de cuentas con estados de resultados y portal web para las familias
(ingreso con el DNI del padre, madre o tutor, informe de transferencias con comprobante).

Monorepo: `apps/api` (Express) y `apps/web` (React + Vite + Tailwind). Proyecto independiente.

## En la PC

```bash
npm install
node dev.mjs        # API en :4500, web en http://localhost:5500
```

Sin `DATABASE_URL`, los datos van a `apps/api/data/db.json` y los comprobantes a `apps/api/data/comprobantes/`.
Acceso del colegio: `admin` / `admin` (cambiar en Ajustes). Un DNI de familia entra con el mismo DNI como clave inicial.
La primera vez se cargan alumnos y familias de ejemplo; se borran en Ajustes → «Datos cargados».

## Publicación: Cloudflare + Supabase

Datos y comprobantes viven en **Supabase** (Postgres); el sistema corre en **Cloudflare Containers** (`cloudflare/`).
Todo es propio de este proyecto: Supabase, Worker y repositorio nuevos.

### 1. Supabase (una vez)
1. Crear un proyecto nuevo en supabase.com (por ejemplo «trinidad»), región São Paulo.
2. **Connect → Session pooler** y copiar la cadena (`postgresql://postgres.xxxx:CLAVE@...pooler.supabase.com:5432/postgres`).
   Es un secreto. Las tablas (`estado` y `archivos`) las crea el sistema solo al primer arranque.

### 2. Cloudflare y GitHub (una vez)
1. Cloudflare → *My Profile → API Tokens → Create Token* con la plantilla **Edit Cloudflare Workers** (agregar permiso
   *Containers: Edit* si la plantilla no lo trae). Anotar también el **Account ID** (Workers & Pages → panel derecho).
2. GitHub → repositorio → *Settings → Secrets and variables → Actions* → crear `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

### 3. Publicar
GitHub → *Actions → Publicar en Cloudflare → Run workflow*. Al terminar, Cloudflare → *Workers & Pages → trinidad →
Settings → Variables y secretos*: agregar como **secretos** `DATABASE_URL` y `ADMIN_PASSWORD` (la clave inicial del
usuario `admin`, se aplica solo al crear la base vacía), y volver a publicar si hace falta.

La dirección queda en `https://trinidad.<tu-subdominio>.workers.dev`. Para un dominio propio, ver el comentario en
`cloudflare/wrangler.jsonc`.

Importante: después del primer ingreso, cargar en **Ajustes** los datos bancarios (alias y CBU) y cambiar la clave.
