import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Ingresar from "./pages/Ingresar";
import AdminLayout from "./pages/admin/AdminLayout";
import Panel from "./pages/admin/Panel";
import Alumnos from "./pages/admin/Alumnos";
import Familias from "./pages/admin/Familias";
import Cobranza from "./pages/admin/Cobranza";
import Comprobantes from "./pages/admin/Comprobantes";
import Cargos from "./pages/admin/Cargos";
import Conciliacion from "./pages/admin/Conciliacion";
import Eventos from "./pages/admin/Eventos";
import Gastos from "./pages/admin/Gastos";
import Contabilidad from "./pages/admin/Contabilidad";
import Ajustes from "./pages/admin/Ajustes";
import PortalLayout from "./pages/portal/PortalLayout";
import Inicio from "./pages/portal/Inicio";
import Historial from "./pages/portal/Historial";

function Protegida({ rol, children }: { rol: "admin" | "familia"; children: JSX.Element }) {
  const { sesion } = useAuth();
  if (!sesion || sesion.rol !== rol) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Ingresar />} />
      <Route path="/admin" element={<Protegida rol="admin"><AdminLayout /></Protegida>}>
        <Route index element={<Panel />} />
        <Route path="alumnos" element={<Alumnos />} />
        <Route path="familias" element={<Familias />} />
        <Route path="cobranza" element={<Cobranza />} />
        <Route path="comprobantes" element={<Comprobantes />} />
        <Route path="cargos" element={<Cargos />} />
        <Route path="conciliacion" element={<Conciliacion />} />
        <Route path="eventos" element={<Eventos />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="contabilidad" element={<Contabilidad />} />
        <Route path="ajustes" element={<Ajustes />} />
      </Route>
      <Route path="/familia" element={<Protegida rol="familia"><PortalLayout /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="historial" element={<Historial />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
