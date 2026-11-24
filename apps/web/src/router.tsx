import type { Rol } from "@lv/shared";
import { Navigate, Outlet, createBrowserRouter } from "react-router";
import { Cargando } from "./components/ui";
import { useSesion } from "./lib/sesion";
import { Inicio } from "./paginas/Inicio";
import { IngresoDocente } from "./paginas/IngresoDocente";
import { IngresoEstudiante } from "./paginas/IngresoEstudiante";
import { NoEncontrada } from "./paginas/NoEncontrada";
import { ContenidoDocente } from "./paginas/docente/Contenido";
import { EstudiantesDocente } from "./paginas/docente/Estudiantes";
import { LayoutDocente } from "./paginas/docente/Layout";
import { NotasDocente } from "./paginas/docente/Notas";
import { LayoutEstudiante } from "./paginas/estudiante/Layout";
import { PanelEstudiante } from "./paginas/estudiante/Panel";
import { SubtemaPagina } from "./paginas/estudiante/Subtema";

/** Deja pasar solo a quien tiene sesión con el rol indicado. */
function RequiereRol({ rol }: { rol: Rol }) {
  const { data: sesion, isPending } = useSesion();
  if (isPending) return <Cargando />;
  if (!sesion) return <Navigate to={rol === "docente" ? "/docente/ingresar" : "/ingresar"} replace />;
  if (sesion.rol !== rol) return <Navigate to={sesion.rol === "docente" ? "/docente" : "/aprender"} replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: "/", element: <Inicio /> },
  { path: "/ingresar", element: <IngresoEstudiante /> },
  { path: "/docente/ingresar", element: <IngresoDocente /> },
  {
    element: <RequiereRol rol="estudiante" />,
    children: [
      {
        element: <LayoutEstudiante />,
        children: [
          { path: "/aprender", element: <PanelEstudiante /> },
          { path: "/aprender/subtema/:id", element: <SubtemaPagina /> },
        ],
      },
    ],
  },
  {
    element: <RequiereRol rol="docente" />,
    children: [
      {
        path: "/docente",
        element: <LayoutDocente />,
        children: [
          { index: true, element: <ContenidoDocente /> },
          { path: "notas", element: <NotasDocente /> },
          { path: "estudiantes", element: <EstudiantesDocente /> },
          { path: "subtema/:id", element: <SubtemaPagina modoDocente /> },
        ],
      },
    ],
  },
  { path: "*", element: <NoEncontrada /> },
]);
