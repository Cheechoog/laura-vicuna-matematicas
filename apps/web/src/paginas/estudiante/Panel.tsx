import { tieneContenido, type PanelEstudiante as Panel, type PeriodoResumen, type SubtemaResumen } from "@lv/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Aviso, Cargando, NotaChip, cx } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";

const abiertos = (p: PeriodoResumen) =>
  p.temas.flatMap((t) => t.subtemas).filter((s) => s.disponible && tieneContenido(s.capacidades)).length;

export function PanelEstudiante() {
  const { data, isPending, error } = useQuery({ queryKey: ["panel"], queryFn: () => api.get<Panel>("/panel") });
  const [elegido, setElegido] = useState<number | null>(null);

  if (isPending) return <Cargando texto="Abriendo tu cuaderno…" />;
  if (error) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  // Por defecto, el último periodo que tenga algo abierto
  const porDefecto = [...data.periodos].reverse().find((p) => abiertos(p) > 0) ?? data.periodos[0];
  const periodo = data.periodos.find((p) => p.id === elegido) ?? porDefecto;

  return (
    <>
      <h1 className="text-3xl md:text-4xl">{data.area.nombre}</h1>
      <p className="mt-1 text-lg text-tinta-suave">Grado {data.grado.nombre.toLowerCase()}</p>

      {/* Pestañas tipo separador de cuaderno */}
      <div role="tablist" aria-label="Periodos" className="mt-6 flex gap-1.5 overflow-x-auto px-2">
        {data.periodos.map((p, i) => {
          const activo = p.id === periodo?.id;
          const color = ["bg-azul", "bg-verde", "bg-ambar"][i % 3];
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={activo}
              onClick={() => setElegido(p.id)}
              className={cx(
                "relative shrink-0 rounded-t-xl border-2 border-b-0 px-5 pb-2.5 pt-2 font-titulo transition-colors",
                activo ? "z-10 -mb-[2px] border-[#d6e0ee] bg-white" : "border-transparent bg-white/60 text-tinta-suave hover:bg-white"
              )}
            >
              <span className={cx("absolute inset-x-3 top-0 h-1 rounded-b", color, !activo && "opacity-40")} />
              {p.nombre}
              {abiertos(p) === 0 && <span className="sr-only"> (sin temas abiertos)</span>}
            </button>
          );
        })}
      </div>

      <section role="tabpanel" className="hoja !rounded-tl-none">
        {periodo && periodo.temas.length === 0 && (
          <p className="py-6 text-lg text-tinta-suave">Este periodo todavía no tiene temas.</p>
        )}
        {periodo && periodo.temas.length > 0 && abiertos(periodo) === 0 && (
          <div className="mb-6">
            <Aviso tono="atencion">Tu profe todavía no ha abierto los temas de este periodo.</Aviso>
          </div>
        )}
        <div className="space-y-9">
          {periodo?.temas.map((t) => (
            <div key={t.id}>
              <h2 className="text-2xl text-azul">{t.nombre}</h2>
              <ul className="mt-2">
                {t.subtemas.map((s) => (
                  <FilaSubtema key={s.id} s={s} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function FilaSubtema({ s }: { s: SubtemaResumen }) {
  const abrible = s.disponible && tieneContenido(s.capacidades);
  const terminado = s.progreso?.quiz != null && s.progreso?.taller != null;
  const contenido = (
    <>
      <span
        aria-hidden
        className={cx(
          "grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm",
          !abrible && "border-[#d6e0ee] text-tinta-suave",
          abrible && terminado && "border-verde bg-verde text-white",
          abrible && !terminado && "border-azul/40"
        )}
      >
        {!s.disponible ? "🔒" : terminado ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-[1.08rem]", !abrible && "text-tinta-suave")}>{s.nombre}</span>
        {!s.disponible && <span className="block text-sm text-tinta-suave">Aún cerrado</span>}
        {s.disponible && !abrible && <span className="block text-sm text-tinta-suave">Próximamente</span>}
      </span>
      {abrible && (s.progreso?.quiz != null || s.progreso?.taller != null) && (
        <span className="flex shrink-0 gap-1.5">
          {s.progreso?.taller != null && <NotaChip etiqueta="Taller" valor={s.progreso.taller} />}
          {s.progreso?.quiz != null && <NotaChip etiqueta="Quiz" valor={s.progreso.quiz} />}
        </span>
      )}
    </>
  );

  // Renglones del cuaderno: cada subtema ocupa una línea con borde inferior
  const clase = "flex items-center gap-3 border-b-2 border-cuadricula py-3.5";
  return (
    <li>
      {abrible ? (
        <Link to={`/aprender/subtema/${s.id}`} className={cx(clase, "-mx-2 rounded-lg px-2 hover:bg-azul-claro/60")}>
          {contenido}
        </Link>
      ) : (
        <div className={clase} aria-disabled>
          {contenido}
        </div>
      )}
    </li>
  );
}
