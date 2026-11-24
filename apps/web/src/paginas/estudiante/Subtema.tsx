import type { SubtemaDetalle } from "@lv/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { HtmlSeguro } from "../../components/HtmlSeguro";
import { Aviso, Cargando, cx } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";
import { Evaluacion } from "./Evaluacion";
import { Practica } from "./Practica";
import { Recursos } from "./Recursos";
import { VistaPrevia } from "./VistaPrevia";

type Pestana = "aprende" | "practica" | "taller" | "quiz" | "recursos";

export function SubtemaPagina({ modoDocente = false }: { modoDocente?: boolean }) {
  const id = Number(useParams().id);
  const { data, isPending, error } = useQuery({
    queryKey: ["subtema", id],
    queryFn: () => api.get<SubtemaDetalle>(`/subtemas/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });
  const [elegida, setElegida] = useState<Pestana | null>(null);

  const volver = modoDocente ? "/docente" : "/aprender";

  if (isPending) return <Cargando />;
  if (error)
    return (
      <div className="space-y-4">
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
        <Link to={volver} className="font-titulo text-azul underline underline-offset-4">
          Volver a los temas
        </Link>
      </div>
    );

  const c = data.capacidades;
  const pestanas = (
    [
      ["aprende", "Aprende", c.leccion],
      ["practica", "Practica", c.practica],
      ["taller", "Taller", c.taller || c.guias],
      ["quiz", "Quiz", c.quiz],
      ["recursos", "Recursos", c.recursos],
    ] as const
  ).filter(([, , visible]) => visible);

  const activa: Pestana | undefined = pestanas.find(([p]) => p === elegida)?.[0] ?? pestanas[0]?.[0];

  return (
    <>
      <Link to={volver} className="text-sm text-tinta-suave hover:text-tinta">
        ← {modoDocente ? "Contenido" : "Mis temas"}
      </Link>
      <p className="mt-4 text-tinta-suave">
        {data.tema.nombre} | {data.periodo.nombre}
      </p>
      <h1 className="mt-1 text-3xl md:text-4xl">{data.nombre}</h1>
      {modoDocente && !data.disponible && (
        <div className="mt-4">
          <Aviso tono="atencion">Los estudiantes todavía no ven este subtema: está cerrado.</Aviso>
        </div>
      )}

      {pestanas.length === 0 ? (
        <div className="hoja mt-6">
          <p className="text-lg text-tinta-suave">Este subtema todavía no tiene contenido.</p>
        </div>
      ) : (
        <>
          <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b-2 border-[#d6e0ee]">
            {pestanas.map(([clave, etiqueta]) => (
              <button
                key={clave}
                role="tab"
                aria-selected={activa === clave}
                onClick={() => setElegida(clave)}
                className={cx(
                  "-mb-[2px] shrink-0 border-b-[3px] px-4 py-2.5 font-titulo text-lg transition-colors",
                  activa === clave ? "border-azul text-azul" : "border-transparent text-tinta-suave hover:text-tinta"
                )}
              >
                {etiqueta}
                {clave === "quiz" && data.estado.quiz.entregado && " ✓"}
                {clave === "taller" && data.estado.taller.entregado && " ✓"}
              </button>
            ))}
          </div>

          <section role="tabpanel" className="hoja mt-5">
            {activa === "aprende" && (
              <div className="space-y-10">
                {data.lecciones.map((l) => (
                  <article key={l.id}>
                    <h2 className="mb-4 text-2xl">{l.titulo}</h2>
                    <HtmlSeguro html={l.html} className="contenido-leccion" />
                  </article>
                ))}
              </div>
            )}

            {activa === "practica" && <Practica subtemaId={data.id} />}

            {activa === "taller" && (
              <div className="space-y-10">
                {c.taller &&
                  (modoDocente ? (
                    <VistaPrevia subtemaId={data.id} tipo="taller" />
                  ) : (
                    <Evaluacion subtemaId={data.id} tipo="taller" estado={data.estado.taller} />
                  ))}
                {data.guias.length > 0 && (
                  <div>
                    <h2 className="text-2xl">Guías para resolver en el cuaderno</h2>
                    <div className="mt-4 space-y-6">
                      {data.guias.map((g) => (
                        <article key={g.id} className="rounded-xl border-2 border-cuadricula p-4">
                          <h3 className="font-titulo text-xl text-azul">{g.titulo}</h3>
                          <HtmlSeguro html={g.enunciadoHtml} className="contenido-leccion mt-2" />
                          {modoDocente && g.solucionHtml && (
                            <details className="mt-3 rounded-lg bg-verde-claro px-3 py-2">
                              <summary className="cursor-pointer font-bold text-[#1f6e2f]">Ver solución</summary>
                              <HtmlSeguro html={g.solucionHtml} className="contenido-leccion mt-2" />
                            </details>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activa === "quiz" &&
              (modoDocente ? (
                <VistaPrevia subtemaId={data.id} tipo="quiz" />
              ) : (
                <Evaluacion subtemaId={data.id} tipo="quiz" estado={data.estado.quiz} />
              ))}

            {activa === "recursos" && <Recursos recursos={data.recursos} />}
          </section>
        </>
      )}
    </>
  );
}
