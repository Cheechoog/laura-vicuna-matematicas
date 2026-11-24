import type { EstudianteDocente } from "@lv/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Aviso, Boton, Cargando, cx } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";
import { Interruptor, Selector, tarjeta } from "./comunes";

interface Grupo {
  id: number;
  nombre: string;
  grado: string;
}

export function EstudiantesDocente() {
  const [grupoId, setGrupoId] = useState<number | "">("");
  const [pinNuevo, setPinNuevo] = useState<{ nombre: string; pin: string } | null>(null);
  const qc = useQueryClient();

  const grupos = useQuery({ queryKey: ["docente", "grupos", "todos"], queryFn: () => api.get<Grupo[]>("/docente/grupos") });
  const actual = grupoId || grupos.data?.[0]?.id || "";

  const lista = useQuery({
    queryKey: ["docente", "estudiantes", actual],
    queryFn: () => api.get<EstudianteDocente[]>(`/docente/grupos/${actual}/estudiantes`),
    enabled: !!actual,
  });

  const nuevoPin = useMutation({
    mutationFn: (e: EstudianteDocente) => api.post<{ pin: string }>(`/docente/estudiantes/${e.id}/pin`).then((r) => ({ ...r, nombre: e.nombre })),
    onSuccess: (r) => setPinNuevo({ nombre: r.nombre, pin: r.pin }),
  });

  const activar = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => api.patch(`/docente/estudiantes/${id}`, { activo }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["docente", "estudiantes"] }),
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Estudiantes</h1>
          <p className="mt-1 text-tinta-suave">Si alguien olvidó su PIN, genérale uno nuevo.</p>
        </div>
        <Selector
          etiqueta="Grupo"
          valor={actual}
          opciones={(grupos.data ?? []).map((g) => ({ valor: g.id, texto: `${g.nombre} (${g.grado})` }))}
          onCambio={(v) => setGrupoId(Number(v))}
        />
      </div>

      {pinNuevo && (
        <div className="mt-5">
          <Aviso tono="exito">
            <p>
              Nuevo PIN de <b>{pinNuevo.nombre}</b>:
            </p>
            <p className="my-2 font-titulo text-4xl tracking-[0.3em]">{pinNuevo.pin}</p>
            <p className="text-sm">Anótalo y entrégaselo: por seguridad no se vuelve a mostrar.</p>
            <Boton variante="fantasma" className="mt-2" onClick={() => setPinNuevo(null)}>
              Listo, ya lo anoté
            </Boton>
          </Aviso>
        </div>
      )}
      {(nuevoPin.isError || activar.isError) && (
        <div className="mt-5">
          <Aviso tono="error">{mensajeDeError(nuevoPin.error ?? activar.error)}</Aviso>
        </div>
      )}

      <div className={cx(tarjeta, "mt-5")}>
        {lista.isPending && <div className="px-4"><Cargando /></div>}
        {lista.error && <div className="p-4"><Aviso tono="error">{mensajeDeError(lista.error)}</Aviso></div>}
        <ul className="divide-y divide-[#eef2f8]">
          {lista.data?.map((e, i) => (
            <li key={e.id} className={cx("flex flex-wrap items-center gap-4 px-4 py-3", !e.activo && "opacity-60")}>
              <span className="w-7 text-right text-sm tabular-nums text-tinta-suave">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{e.nombre}</p>
                <p className="text-sm text-tinta-suave">{e.usuario}</p>
              </div>
              <Boton variante="secundario" onClick={() => nuevoPin.mutate(e)} disabled={!e.activo || nuevoPin.isPending}>
                Nuevo PIN
              </Boton>
              <label className="flex items-center gap-2 text-sm text-tinta-suave">
                {e.activo ? "Activo" : "Inactivo"}
                <Interruptor
                  activo={e.activo}
                  etiqueta={`Activar a ${e.nombre}`}
                  onCambio={(v) => activar.mutate({ id: e.id, activo: v })}
                />
              </label>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
