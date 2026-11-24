import type { PreguntaPublica } from "@lv/shared";
import { Apoyo } from "./Apoyo";
import { cx } from "./ui";

interface Props {
  pregunta: PreguntaPublica;
  numero?: number;
  valor: string;
  onCambio: (v: string) => void;
  /** Tras calificar: resalta la correcta y la elegida. */
  revision?: { correcta: boolean; respuestaCorrecta: string };
  bloqueada?: boolean;
  onEnter?: () => void;
}

const LETRAS = ["A", "B", "C", "D", "E", "F"];

export function Pregunta({ pregunta, numero, valor, onCambio, revision, bloqueada, onEnter }: Props) {
  const opciones = pregunta.tipo === "vf" ? ["Verdadero", "Falso"] : pregunta.opciones;
  const idEnunciado = `enunciado-${pregunta.indice}-${numero ?? 0}`;

  return (
    <fieldset className="space-y-3" disabled={bloqueada}>
      <legend id={idEnunciado} className="flex gap-3 text-lg font-bold leading-snug">
        {numero !== undefined && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-azul text-base text-white font-titulo">
            {numero}
          </span>
        )}
        <span className="pt-0.5">{pregunta.enunciado}</span>
      </legend>

      {pregunta.apoyo && <Apoyo apoyo={pregunta.apoyo} />}

      {opciones ? (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={idEnunciado}>
          {opciones.map((op, i) => {
            const elegida = valor === op;
            const esCorrecta = revision && normal(op) === normal(revision.respuestaCorrecta);
            return (
              <button
                key={op}
                type="button"
                role="radio"
                aria-checked={elegida}
                onClick={() => onCambio(op)}
                className={cx(
                  "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  !revision && (elegida ? "border-azul bg-azul-claro" : "border-[#d6e0ee] bg-white hover:border-azul/50"),
                  revision && esCorrecta && "border-verde bg-verde-claro",
                  revision && elegida && !esCorrecta && "border-rojo bg-rojo-claro",
                  revision && !elegida && !esCorrecta && "border-[#d6e0ee] bg-white opacity-70"
                )}
              >
                <span
                  className={cx(
                    "grid size-7 shrink-0 place-items-center rounded-lg font-titulo text-sm",
                    elegida ? "bg-azul text-white" : "bg-tinta/5 text-tinta-suave"
                  )}
                >
                  {pregunta.tipo === "vf" ? (i === 0 ? "V" : "F") : LETRAS[i]}
                </span>
                <span className="text-[1.05rem]">{op}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          aria-labelledby={idEnunciado}
          placeholder="Escribe tu respuesta"
          className={cx(
            "w-full max-w-xs rounded-xl border-2 bg-white px-4 py-3 text-xl font-bold tabular-nums focus:outline-none",
            !revision && "border-[#c9d6e8] focus:border-azul",
            revision?.correcta && "border-verde bg-verde-claro",
            revision && !revision.correcta && "border-rojo bg-rojo-claro"
          )}
        />
      )}
    </fieldset>
  );
}

const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
