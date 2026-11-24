import type { PracticaPregunta, PracticaVerificacion } from "@lv/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pregunta } from "../../components/Pregunta";
import { Aviso, Boton, Cargando } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";

/** Ejercicios ilimitados: no cuentan para la nota, sirven para practicar. */
export function Practica({ subtemaId }: { subtemaId: number }) {
  const [ronda, setRonda] = useState(0);
  const [respuesta, setRespuesta] = useState("");
  const [cuenta, setCuenta] = useState({ bien: 0, total: 0 });

  const { data, isFetching, error } = useQuery({
    queryKey: ["practica", subtemaId, ronda],
    queryFn: () => api.get<PracticaPregunta>(`/subtemas/${subtemaId}/practica`),
    staleTime: Infinity,
    gcTime: 0,
  });

  const verificar = useMutation({
    mutationFn: () => api.post<PracticaVerificacion>("/practica/verificar", { token: data!.token, respuesta }),
    onSuccess: (r) => setCuenta((c) => ({ bien: c.bien + (r.correcta ? 1 : 0), total: c.total + 1 })),
  });

  const siguiente = () => {
    verificar.reset();
    setRespuesta("");
    setRonda((r) => r + 1);
  };

  const r = verificar.data;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-tinta-suave">Practica todas las veces que quieras. Esto no cuenta para la nota.</p>
        {cuenta.total > 0 && (
          <p className="font-titulo text-lg" aria-live="polite">
            <span className="text-verde">{cuenta.bien}</span> de {cuenta.total} bien
          </p>
        )}
      </div>

      {isFetching && !data && <Cargando texto="Preparando un ejercicio…" />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}

      {data && (
        <div className="space-y-5">
          <Pregunta
            pregunta={data.pregunta}
            valor={respuesta}
            onCambio={(v) => !r && setRespuesta(v)}
            revision={r ? { correcta: r.correcta, respuestaCorrecta: r.respuestaCorrecta } : undefined}
            onEnter={() => (r ? siguiente() : respuesta.trim() && verificar.mutate())}
          />

          {r && (
            <Aviso tono={r.correcta ? "exito" : "atencion"}>
              <p className="font-titulo text-xl">{r.correcta ? "¡Muy bien!" : `Casi. La respuesta era ${r.respuestaCorrecta}`}</p>
              {r.explicacion && <p className="mt-1">{r.explicacion}</p>}
            </Aviso>
          )}
          {verificar.isError && <Aviso tono="error">{mensajeDeError(verificar.error)}</Aviso>}

          <div className="flex gap-3">
            {!r ? (
              <Boton grande onClick={() => verificar.mutate()} disabled={!respuesta.trim()} cargando={verificar.isPending}>
                Revisar
              </Boton>
            ) : (
              <Boton grande onClick={siguiente} autoFocus>
                Otro ejercicio
              </Boton>
            )}
            {!r && (
              <Boton variante="fantasma" onClick={siguiente}>
                Saltar
              </Boton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
