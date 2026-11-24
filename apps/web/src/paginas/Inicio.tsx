import { Link, Navigate } from "react-router";
import { Cargando } from "../components/ui";
import { useSesion } from "../lib/sesion";

export function Inicio() {
  const { data: sesion, isPending } = useSesion();
  if (isPending) return <Cargando />;
  if (sesion) return <Navigate to={sesion.rol === "docente" ? "/docente" : "/aprender"} replace />;

  return (
    <main className="fondo-cuaderno min-h-dvh px-4 py-10 md:py-16">
      <div className="hoja mx-auto max-w-3xl">
        <img src="/logo.png" alt="Institución Educativa Laura Vicuña" className="h-20 w-auto md:h-24" />

        <h1 className="mt-8 text-4xl text-tinta md:text-5xl">Matemáticas</h1>
        <p className="mt-3 max-w-[52ch] text-lg text-tinta-suave">
          Explicaciones, ejercicios para practicar, talleres y quices de cada tema del periodo.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            to="/ingresar"
            className="group rounded-2xl border-2 border-azul bg-azul p-6 text-white shadow-[0_4px_0_#1d4a87] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#1d4a87]"
          >
            <span className="block font-titulo text-2xl">Soy estudiante</span>
            <span className="mt-1 block text-white/85">Entra con tu grupo, tu nombre y tu PIN</span>
          </Link>
          <Link
            to="/docente/ingresar"
            className="rounded-2xl border-2 border-verde/40 bg-white p-6 transition-colors hover:border-verde hover:bg-verde-claro"
          >
            <span className="block font-titulo text-2xl text-verde">Soy docente</span>
            <span className="mt-1 block text-tinta-suave">Temas, notas y estudiantes</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
