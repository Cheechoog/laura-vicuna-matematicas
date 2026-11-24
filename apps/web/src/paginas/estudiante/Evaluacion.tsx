import type { IntentoAbierto, NotaEstado, ResultadoEvaluacion, TipoEvaluacion } from "@lv/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pregunta } from "../../components/Pregunta";
import { Aviso, Boton } from "../../components/ui";
import { api, ApiError, mensajeDeError } from "../../lib/api";
import { nota } from "../../lib/formato";

const TEXTOS: Record<TipoEvaluacion, { nombre: string; preguntas: number }> = {
  quiz: { nombre: "quiz", preguntas: 5 },
  taller: { nombre: "taller", preguntas: 10 },
};

/**
 * Quiz o taller calificado. Una sola oportunidad: el servidor guarda las
 * preguntas al empezar y califica al entregar.
 */
export function Evaluacion({ subtemaId, tipo, estado }: { subtemaId: number; tipo: TipoEvaluacion; estado: NotaEstado }) {
  const qc = useQueryClient();
  const [intento, setIntento] = useState<IntentoAbierto | null>(null);
  const [respuestas, setRespuestas] = useState<string[]>([]);
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const t = TEXTOS[tipo];

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["subtema", subtemaId] });
    qc.invalidateQueries({ queryKey: ["panel"] });
  };

  const abrir = useMutation({
    mutationFn: () => api.post<IntentoAbierto>(`/subtemas/${subtemaId}/evaluaciones`, { tipo }),
    onSuccess: (i) => {
      setIntento(i);
      setRespuestas(i.preguntas.map(() => ""));
    },
    onError: (e) => e instanceof ApiError && e.codigo === "YA_ENTREGADO" && refrescar(),
  });

  const entregar = useMutation({
    mutationFn: () => api.post<ResultadoEvaluacion>(`/evaluaciones/${intento!.intentoId}/entregar`, { respuestas }),
    onSuccess: (r) => {
      setResultado(r);
      setConfirmando(false);
      refrescar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  // ---------- Ya entregado (y no es la entrega de este momento) ----------
  if (estado.entregado && !resultado) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-verde/30 bg-verde-claro/60 p-5">
        <div className="font-titulo text-5xl tabular-nums text-tinta">{nota(estado.nota)}</div>
        <div>
          <p className="font-titulo text-xl">Ya entregaste el {t.nombre}</p>
          <p className="text-tinta-suave">
            Acertaste {estado.correctas} de {estado.total}. Si necesitas repetirlo, habla con tu profe.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Resultado recién entregado ----------
  if (resultado && intento) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-5 rounded-2xl border-2 border-azul/20 bg-azul-claro/60 p-5">
          <div className="font-titulo text-6xl tabular-nums">{nota(resultado.nota)}</div>
          <div>
            <p className="font-titulo text-2xl">{resultado.nota >= 3 ? "¡Aprobaste!" : "Sigue practicando"}</p>
            <p className="text-tinta-suave">
              Acertaste {resultado.correctas} de {resultado.total} ({resultado.porcentaje}%).
            </p>
          </div>
        </div>
        <h2 className="text-2xl">Revisa tus respuestas</h2>
        <ol className="space-y-8">
          {intento.preguntas.map((p, i) => {
            const d = resultado.detalle[i]!;
            return (
              <li key={i} className="space-y-3">
                <Pregunta
                  pregunta={p}
                  numero={i + 1}
                  valor={d.respuestaDada}
                  onCambio={() => {}}
                  bloqueada
                  revision={{ correcta: d.correcta, respuestaCorrecta: d.respuestaCorrecta }}
                />
                {!d.correcta && (
                  <p className="text-[#1f6e2f]">
                    Respuesta correcta: <b>{d.respuestaCorrecta}</b>
                    {d.explicacion && <span className="block text-tinta-suave">{d.explicacion}</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // ---------- Antes de empezar ----------
  if (!intento) {
    return (
      <div className="max-w-xl space-y-4">
        <h2 className="text-2xl">{tipo === "quiz" ? "Quiz" : "Taller"} con nota</h2>
        <p className="text-lg">
          Son unas {t.preguntas} preguntas y tienes <b>una sola oportunidad</b>. Cuando termines, verás tu nota y las respuestas
          correctas.
        </p>
        {tipo === "quiz" && <p className="text-tinta-suave">Te recomendamos practicar antes de empezar.</p>}
        {abrir.isError && <Aviso tono="error">{mensajeDeError(abrir.error)}</Aviso>}
        <Boton grande onClick={() => abrir.mutate()} cargando={abrir.isPending}>
          Empezar el {t.nombre}
        </Boton>
      </div>
    );
  }

  // ---------- Respondiendo ----------
  const respondidas = respuestas.filter((r) => r.trim()).length;
  const total = intento.preguntas.length;

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-2 flex items-center gap-4 rounded-xl bg-white/95 px-2 py-2 backdrop-blur">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-tinta/10" aria-hidden>
          <div className="h-full rounded-full bg-verde transition-[width]" style={{ width: `${(respondidas / total) * 100}%` }} />
        </div>
        <span className="font-titulo tabular-nums" aria-live="polite">
          {respondidas} de {total}
        </span>
      </div>

      <ol className="space-y-10">
        {intento.preguntas.map((p, i) => (
          <li key={i}>
            <Pregunta
              pregunta={p}
              numero={i + 1}
              valor={respuestas[i] ?? ""}
              onCambio={(v) => setRespuestas((rs) => rs.map((x, j) => (j === i ? v : x)))}
            />
          </li>
        ))}
      </ol>

      {entregar.isError && <Aviso tono="error">{mensajeDeError(entregar.error)}</Aviso>}

      {confirmando ? (
        <Aviso tono="atencion">
          <p className="font-bold">Te faltan {total - respondidas} pregunta(s) por responder. ¿Entregar así?</p>
          <div className="mt-3 flex gap-3">
            <Boton onClick={() => entregar.mutate()} cargando={entregar.isPending}>
              Sí, entregar
            </Boton>
            <Boton variante="secundario" onClick={() => setConfirmando(false)}>
              Seguir respondiendo
            </Boton>
          </div>
        </Aviso>
      ) : (
        <Boton
          grande
          cargando={entregar.isPending}
          onClick={() => (respondidas < total ? setConfirmando(true) : entregar.mutate())}
        >
          Entregar {t.nombre}
        </Boton>
      )}
    </div>
  );
}
