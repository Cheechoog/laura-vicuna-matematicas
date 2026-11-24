import type { Apoyo as ApoyoTipo, TipoEvaluacion, TipoPregunta } from "@lv/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Apoyo } from "../../components/Apoyo";
import { Aviso, Boton, Cargando } from "../../components/ui";
import { api, mensajeDeError } from "../../lib/api";

interface PreguntaConRespuesta {
  tipo: TipoPregunta;
  enunciado: string;
  opciones?: string[];
  apoyo?: ApoyoTipo;
  respuesta: string;
  explicacion?: string | null;
}

/** Solo docente: muestra un ejemplo de lo que recibiría un estudiante, con respuestas. */
export function VistaPrevia({ subtemaId, tipo }: { subtemaId: number; tipo: TipoEvaluacion }) {
  const [ronda, setRonda] = useState(0);
  const { data, isFetching, error } = useQuery({
    queryKey: ["vista-previa", subtemaId, tipo, ronda],
    queryFn: () => api.get<PreguntaConRespuesta[]>(`/docente/subtemas/${subtemaId}/vista-previa?tipo=${tipo}`),
  });

  return (
    <div className="space-y-5">
      <Aviso tono="info">
        Vista previa del {tipo}: así lo vería un estudiante, pero con las respuestas. Cada estudiante recibe preguntas
        distintas.
      </Aviso>
      <Boton variante="secundario" onClick={() => setRonda((r) => r + 1)} cargando={isFetching}>
        Ver otro ejemplo
      </Boton>
      {isFetching && !data && <Cargando />}
      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <ol className="space-y-6">
        {data?.map((p, i) => (
          <li key={i} className="rounded-xl border-2 border-cuadricula p-4">
            <p className="font-bold">
              {i + 1}. {p.enunciado}
            </p>
            {p.apoyo && <Apoyo apoyo={p.apoyo} />}
            {p.opciones && <p className="mt-2 text-tinta-suave">Opciones: {p.opciones.join(" / ")}</p>}
            <p className="mt-2 text-[#1f6e2f]">
              Respuesta: <b>{p.tipo === "vf" ? (p.respuesta === "V" ? "Verdadero" : "Falso") : p.respuesta}</b>
            </p>
            {p.explicacion && <p className="text-sm text-tinta-suave">{p.explicacion}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
