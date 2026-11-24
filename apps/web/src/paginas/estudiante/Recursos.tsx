import type { Recurso } from "@lv/shared";
import { useMemo, useState } from "react";
import { cx } from "../../components/ui";
import { barajar } from "../../lib/azar";

export function Recursos({ recursos }: { recursos: Recurso[] }) {
  return (
    <div className="space-y-10">
      {recursos.map((r) => (
        <article key={r.id}>
          <h2 className="text-2xl">{r.titulo}</h2>
          {r.descripcion && <p className="mt-1 text-tinta-suave">{r.descripcion}</p>}
          <div className="mt-4">
            {r.tipo === "video" && r.url && (
              <video controls preload="metadata" className="w-full max-w-2xl rounded-xl border-2 border-cuadricula bg-black">
                <source src={encodeURI(r.url)} />
                Tu navegador no puede reproducir este video.
              </video>
            )}
            {r.tipo === "juego" && <JuegoParejas datos={r.datos} />}
            {(r.tipo === "enlace" || r.tipo === "documento") && r.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="font-titulo text-azul underline underline-offset-4">
                Abrir {r.tipo === "documento" ? "documento" : "enlace"}
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

interface DatosParejas {
  items?: { a: string; b: string }[];
}

/** Une cada operación con su resultado. */
function JuegoParejas({ datos }: { datos: unknown }) {
  const items = (datos as DatosParejas)?.items ?? [];
  const [ronda, setRonda] = useState(0);
  const derecha = useMemo(() => barajar(items.map((it, i) => ({ ...it, i }))), [items, ronda]);
  const [elegida, setElegida] = useState<number | null>(null);
  const [unidas, setUnidas] = useState<Set<number>>(new Set());
  const [fallo, setFallo] = useState<number | null>(null);

  if (items.length === 0) return null;

  const elegirDerecha = (i: number) => {
    if (elegida === null) return;
    if (i === elegida) {
      setUnidas((u) => new Set(u).add(i));
      setElegida(null);
    } else {
      setFallo(i);
      setTimeout(() => setFallo(null), 600);
    }
  };

  const reiniciar = () => {
    setUnidas(new Set());
    setElegida(null);
    setRonda((r) => r + 1);
  };

  const completo = unidas.size === items.length;

  return (
    <div className="space-y-4">
      <p className="text-tinta-suave">Toca una operación y luego su resultado.</p>
      <div className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-2">
        <div className="space-y-2">
          {items.map((it, i) => (
            <button
              key={i}
              disabled={unidas.has(i)}
              onClick={() => setElegida(i)}
              className={cx(
                "w-full rounded-xl border-2 px-4 py-3 font-titulo text-lg transition-colors",
                unidas.has(i) && "border-verde bg-verde-claro text-[#1f6e2f]",
                !unidas.has(i) && elegida === i && "border-azul bg-azul-claro",
                !unidas.has(i) && elegida !== i && "border-[#d6e0ee] bg-white hover:border-azul/50"
              )}
            >
              {it.a}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {derecha.map((it) => (
            <button
              key={it.i}
              disabled={unidas.has(it.i)}
              onClick={() => elegirDerecha(it.i)}
              className={cx(
                "w-full rounded-xl border-2 px-4 py-3 font-titulo text-lg tabular-nums transition-colors",
                unidas.has(it.i) && "border-verde bg-verde-claro text-[#1f6e2f]",
                fallo === it.i && "border-rojo bg-rojo-claro",
                !unidas.has(it.i) && fallo !== it.i && "border-[#d6e0ee] bg-white hover:border-azul/50"
              )}
            >
              {it.b}
            </button>
          ))}
        </div>
      </div>
      {completo && (
        <p className="font-titulo text-xl text-verde">
          ¡Completaste todas las parejas!{" "}
          <button onClick={reiniciar} className="text-azul underline underline-offset-4">
            Jugar otra vez
          </button>
        </p>
      )}
    </div>
  );
}
