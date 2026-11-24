import { NavLink, Outlet, useNavigate } from "react-router";
import { Logo, cx } from "../../components/ui";
import { useSalir, useSesion } from "../../lib/sesion";

const SECCIONES = [
  { a: "/docente", texto: "Contenido", fin: true },
  { a: "/docente/notas", texto: "Notas", fin: false },
  { a: "/docente/estudiantes", texto: "Estudiantes", fin: false },
];

export function LayoutDocente() {
  const { data: sesion } = useSesion();
  const salir = useSalir();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-[#f4f7fb]">
      <header className="border-b border-[#d6e0ee] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Logo compacto />
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Secciones">
            {SECCIONES.map((s) => (
              <NavLink
                key={s.a}
                to={s.a}
                end={s.fin}
                className={({ isActive }) =>
                  cx(
                    "rounded-lg px-3.5 py-2 font-titulo transition-colors",
                    isActive ? "bg-verde-claro text-[#1f6e2f]" : "text-tinta-suave hover:bg-tinta/5 hover:text-tinta"
                  )
                }
              >
                {s.texto}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden text-tinta-suave md:inline">{sesion?.nombre}</span>
            <button
              onClick={() => salir.mutate(undefined, { onSuccess: () => navigate("/", { replace: true }) })}
              className="rounded-lg px-3 py-2 text-tinta-suave hover:bg-tinta/5 hover:text-tinta"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
