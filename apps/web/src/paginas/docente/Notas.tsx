import type { ReporteNotas } from "@lv/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Aviso, Boton, Cargando, NotaChip } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";
import { Selector, tarjeta } from "./comunes";

interface Grado {
  id: number;
  nombre: string;
}
interface Grupo {
  id: number;
  nombre: string;
  gradoId: number;
}

const PERIODOS = [
  { valor: "" as const, texto: "Todos" },
  { valor: 1, texto: "Primer periodo" },
  { valor: 2, texto: "Segundo periodo" },
  { valor: 3, texto: "Tercer periodo" },
];

export function NotasDocente() {
  const [gradoId, setGradoId] = useState<number | "">("");
  const [periodoId, setPeriodoId] = useState<number | "">("");
  const [grupoId, setGrupoId] = useState<number | "">("");
  const [celda, setCelda] = useState<{ estudianteId: number; estudiante: string; subtemaId: number; subtema: string } | null>(null);
  const qc = useQueryClient();

  const grados = useQuery({ queryKey: ["docente", "grados"], queryFn: () => api.get<Grado[]>("/docente/grados") });
  const gradoActual = gradoId || grados.data?.[0]?.id || "";
  const grupos = useQuery({
    queryKey: ["docente", "grupos", gradoActual],
    queryFn: () => api.get<Grupo[]>(`/docente/grupos?gradoId=${gradoActual}`),
    enabled: !!gradoActual,
  });

  const filtro = new URLSearchParams({
    gradoId: String(gradoActual),
    ...(periodoId ? { periodoId: String(periodoId) } : {}),
    ...(grupoId ? { grupoId: String(grupoId) } : {}),
  }).toString();

  const notas = useQuery({
    queryKey: ["docente", "notas", filtro],
    queryFn: () => api.get<ReporteNotas>(`/docente/notas?${filtro}`),
    enabled: !!gradoActual,
  });

  const reabrir = useMutation({
    mutationFn: (tipo: "quiz" | "taller") => api.post("/docente/intentos/reabrir", { ...celda!, tipo }),
    onSuccess: () => {
      setCelda(null);
      qc.invalidateQueries({ queryKey: ["docente", "notas"] });
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Notas</h1>
          <p className="mt-1 text-tinta-suave">Promedio de quiz y taller por subtema. Toca una nota para permitir repetirla.</p>
        </div>
        <a href={`/api/docente/notas/exportar?${filtro}`} className="no-underline">
          <Boton variante="secundario" tabIndex={-1}>
            Descargar Excel
          </Boton>
        </a>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Selector
          etiqueta="Grado"
          valor={gradoActual}
          opciones={(grados.data ?? []).map((g) => ({ valor: g.id, texto: g.nombre }))}
          onCambio={(v) => {
            setGradoId(Number(v));
            setGrupoId("");
          }}
        />
        <Selector etiqueta="Periodo" valor={periodoId} opciones={PERIODOS} onCambio={(v) => setPeriodoId(v ? Number(v) : "")} />
        <Selector
          etiqueta="Grupo"
          valor={grupoId}
          opciones={[{ valor: "" as const, texto: "Todos" }, ...(grupos.data ?? []).map((g) => ({ valor: g.id, texto: g.nombre }))]}
          onCambio={(v) => setGrupoId(v ? Number(v) : "")}
        />
      </div>

      {celda && (
        <div className="mt-5">
          <Aviso tono="atencion">
            <p>
              <b>{celda.estudiante}</b> en <b>{celda.subtema}</b>: ¿qué puede volver a presentar? La nota actual se borra.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => reabrir.mutate("quiz")} cargando={reabrir.isPending}>
                Repetir quiz
              </Boton>
              <Boton variante="secundario" onClick={() => reabrir.mutate("taller")} cargando={reabrir.isPending}>
                Repetir taller
              </Boton>
              <Boton variante="fantasma" onClick={() => setCelda(null)}>
                Cancelar
              </Boton>
            </div>
          </Aviso>
        </div>
      )}

      <div className="mt-5">
        {notas.isPending && <Cargando />}
        {notas.error && <Aviso tono="error">{mensajeDeError(notas.error)}</Aviso>}
        {notas.data && notas.data.filas.length === 0 && <Aviso>No hay estudiantes con estos filtros.</Aviso>}
        {notas.data && notas.data.filas.length > 0 && (
          <div className={`${tarjeta} overflow-auto`} style={{ maxHeight: "70vh" }}>
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="sticky left-0 z-20 bg-white px-3 py-3 text-left">Estudiante</th>
                  {notas.data.columnas.map((c) => (
                    <th key={c.subtemaId} className="max-w-32 px-2 py-3 text-left align-bottom font-normal" title={c.tema}>
                      <span className="block text-xs text-tinta-suave">{c.tema}</span>
                      <span className="block font-bold leading-tight">{c.subtema}</span>
                    </th>
                  ))}
                  <th className="px-3 py-3">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {notas.data.filas.map((f) => (
                  <tr key={f.estudianteId} className="border-t border-[#eef2f8] hover:bg-azul-claro/40">
                    <td className="sticky left-0 bg-white px-3 py-2">
                      <span className="block font-bold">{f.estudiante}</span>
                      <span className="text-xs text-tinta-suave">{f.grupo}</span>
                    </td>
                    {notas.data.columnas.map((c) => {
                      const n = f.notas[c.subtemaId];
                      const hay = n && (n.quiz != null || n.taller != null);
                      return (
                        <td key={c.subtemaId} className="px-2 py-2">
                          {hay ? (
                            <button
                              onClick={() =>
                                setCelda({ estudianteId: f.estudianteId, estudiante: f.estudiante, subtemaId: c.subtemaId, subtema: c.subtema })
                              }
                              title={`Quiz ${n.quiz ?? "—"} | Taller ${n.taller ?? "—"}`}
                            >
                              <NotaChip valor={n.promedio} />
                            </button>
                          ) : (
                            <span className="text-tinta-suave">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <NotaChip valor={f.promedio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
