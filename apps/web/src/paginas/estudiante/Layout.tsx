import { Outlet, useNavigate } from "react-router";
import { Logo } from "../../components/ui";
import { nombreAmigable } from "../../lib/formato";
import { useSalir, useSesion } from "../../lib/sesion";

export function LayoutEstudiante() {
  const { data: sesion } = useSesion();
  const salir = useSalir();
  const navigate = useNavigate();

  return (
    <div className="fondo-cuaderno min-h-dvh">
      <header className="border-b-2 border-cuadricula bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2.5">
          <Logo compacto />
          {sesion && (
            <div className="flex items-center gap-3 text-right">
              <div className="leading-tight">
                <div className="font-bold">{nombreAmigable(sesion.nombre)}</div>
                <div className="text-sm text-tinta-suave">
                  Grupo {sesion.grupo?.nombre}
                </div>
              </div>
              <button
                onClick={() => salir.mutate(undefined, { onSuccess: () => navigate("/", { replace: true }) })}
                className="rounded-lg px-3 py-2 text-sm text-tinta-suave hover:bg-tinta/5 hover:text-tinta"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
