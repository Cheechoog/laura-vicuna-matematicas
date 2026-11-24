import type { ArbolDocente, SubtemaDocente } from "@lv/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Aviso, Cargando, cx } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";
import { Interruptor, Selector, tarjeta } from "./comunes";

export function ContenidoDocente() {
  const [gradoId, setGradoId] = useState<number | "">("");
  const qc = useQueryClient();
  const clave = ["docente", "arbol", gradoId];

  const { data, isPending, error } = useQuery({
    queryKey: clave,
    queryFn: () => api.get<ArbolDocente>(`/docente/arbol${gradoId ? `?gradoId=${gradoId}` : ""}`),
  });

  const cambiarSubtema = useMutation({
    mutationFn: ({ id, habilitado }: { id: number; habilitado: boolean }) => api.patch(`/docente/subtemas/${id}`, { habilitado }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["docente", "arbol"] }),
  });
  const cambiarTema = useMutation({
    mutationFn: ({ id, habilitado }: { id: number; habilitado: boolean }) => api.patch(`/docente/temas/${id}`, { habilitado }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["docente", "arbol"] }),
  });

  if (isPending) return <Cargando />;
  if (error) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Contenido</h1>
          <p className="mt-1 text-tinta-suave">Abre o cierra los subtemas que ven tus estudiantes.</p>
        </div>
        <Selector
          etiqueta="Grado"
          valor={data.grado.id}
          opciones={data.grados.map((g) => ({ valor: g.id, texto: g.nombre }))}
          onCambio={(v) => setGradoId(Number(v))}
        />
      </div>

      {(cambiarSubtema.isError || cambiarTema.isError) && (
        <div className="mt-4">
          <Aviso tono="error">{mensajeDeError(cambiarSubtema.error ?? cambiarTema.error)}</Aviso>
        </div>
      )}

      <div className="mt-6 space-y-8">
        {data.periodos.map((p) => (
          <section key={p.id}>
            <h2 className="text-2xl">{p.nombre}</h2>
            {p.temas.length === 0 && <p className="mt-2 text-tinta-suave">Sin temas en este periodo.</p>}
            <div className="mt-3 space-y-4">
              {p.temas.map((t) => {
                const abiertos = t.subtemas.filter((s) => s.habilitado).length;
                const todos = abiertos === t.subtemas.length && t.subtemas.length > 0;
                return (
                  <div key={t.id} className={tarjeta}>
                    <div className="flex items-center justify-between gap-4 border-b border-[#e3ebf6] px-4 py-3">
                      <div>
                        <h3 className="font-titulo text-lg">{t.nombre}</h3>
                        <p className="text-sm text-tinta-suave">
                          {abiertos} de {t.subtemas.length} abiertos
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-tinta-suave">
                        Todo el tema
                        <Interruptor
                          activo={todos}
                          etiqueta={`Abrir todo el tema ${t.nombre}`}
                          onCambio={(v) => cambiarTema.mutate({ id: t.id, habilitado: v })}
                          deshabilitado={cambiarTema.isPending}
                        />
                      </label>
                    </div>
                    <ul className="divide-y divide-[#eef2f8]">
                      {t.subtemas.map((s) => (
                        <FilaSubtema
                          key={s.id}
                          s={s}
                          onCambio={(v) => cambiarSubtema.mutate({ id: s.id, habilitado: v })}
                          ocupado={cambiarSubtema.isPending && cambiarSubtema.variables?.id === s.id}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function FilaSubtema({ s, onCambio, ocupado }: { s: SubtemaDocente; onCambio: (v: boolean) => void; ocupado: boolean }) {
  const c = s.conteos;
  const vacio = c.lecciones + c.guias + c.preguntas + c.generadores + c.recursos === 0;
  const piezas = [
    c.lecciones && `${c.lecciones} explicación${c.lecciones > 1 ? "es" : ""}`,
    c.generadores && "práctica",
    c.preguntas && `${c.preguntas} preguntas`,
    c.guias && `${c.guias} guía${c.guias > 1 ? "s" : ""}`,
    c.recursos && `${c.recursos} recurso${c.recursos > 1 ? "s" : ""}`,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <Interruptor activo={s.habilitado} etiqueta={`Abrir ${s.nombre}`} onCambio={onCambio} deshabilitado={ocupado} />
      <div className="min-w-0 flex-1">
        <Link to={`/docente/subtema/${s.id}`} className="font-bold hover:text-azul hover:underline">
          {s.nombre}
        </Link>
        <p className={cx("text-sm", vacio ? "text-ambar" : "text-tinta-suave")}>
          {vacio ? "Sin contenido todavía" : piezas.join(", ")}
        </p>
      </div>
      {s.habilitado && s.disponibleDesde && !s.disponible && (
        <span className="text-sm text-ambar">Abre el {new Date(s.disponibleDesde).toLocaleDateString("es-CO")}</span>
      )}
    </li>
  );
}
