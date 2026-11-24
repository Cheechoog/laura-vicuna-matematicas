import type { Apoyo as ApoyoTipo } from "@lv/shared";

/** Material que acompaña una pregunta: lista de datos, tabla o gráfico de barras. */
export function Apoyo({ apoyo }: { apoyo: ApoyoTipo }) {
  return (
    <figure className="my-4 rounded-xl border-2 border-cuadricula bg-papel p-4">
      {apoyo.titulo && <figcaption className="mb-3 font-titulo text-tinta-suave">{apoyo.titulo}</figcaption>}
      {apoyo.tipo === "lista" && (
        <ul className="flex flex-wrap gap-2" aria-label="Datos">
          {apoyo.items.map((it, i) => (
            <li key={i} className="rounded-lg border border-azul/20 bg-white px-2.5 py-1 text-[0.95rem]">
              {it}
            </li>
          ))}
        </ul>
      )}
      {apoyo.tipo === "tabla" && (
        <div className="overflow-x-auto">
          <table className="border-collapse text-center">
            <thead>
              <tr>
                {apoyo.columnas.map((c) => (
                  <th key={c} className="border-2 border-[#c9d6e8] bg-azul-claro px-4 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apoyo.filas.map((f, i) => (
                <tr key={i}>
                  {f.map((v, j) => (
                    <td key={j} className="border-2 border-[#c9d6e8] bg-white px-4 py-2 tabular-nums">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {apoyo.tipo === "barras" && <GraficoBarras {...apoyo} />}
    </figure>
  );
}

export function GraficoBarras({
  barras,
  etiquetaX,
  etiquetaY,
}: {
  barras: { etiqueta: string; valor: number }[];
  etiquetaX: string;
  etiquetaY: string;
}) {
  const max = Math.max(1, ...barras.map((b) => b.valor));
  const alto = 180;
  const ancho = 64;
  const sep = 28;
  const izq = 40;
  const w = izq + barras.length * (ancho + sep);
  const marcas = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <svg
      viewBox={`0 0 ${w} ${alto + 60}`}
      className="w-full max-w-lg"
      role="img"
      aria-label={`Gráfico de barras: ${barras.map((b) => `${b.etiqueta} ${b.valor}`).join(", ")}`}
    >
      {marcas.map((m) => {
        const y = 10 + alto - (m / max) * alto;
        return (
          <g key={m}>
            <line x1={izq} x2={w} y1={y} y2={y} stroke="#e3ebf6" strokeWidth="1.5" />
            <text x={izq - 8} y={y + 5} textAnchor="end" fontSize="14" fill="#4a5f82">
              {m}
            </text>
          </g>
        );
      })}
      {barras.map((b, i) => {
        const h = (b.valor / max) * alto;
        const x = izq + sep / 2 + i * (ancho + sep);
        return (
          <g key={b.etiqueta}>
            <rect x={x} y={10 + alto - h} width={ancho} height={h} rx="6" fill={i % 2 ? "#2f9e44" : "#2c6bc2"} />
            <text x={x + ancho / 2} y={alto + 32} textAnchor="middle" fontSize="14" fill="#1b3a6b">
              {b.etiqueta}
            </text>
          </g>
        );
      })}
      <text x={w / 2} y={alto + 56} textAnchor="middle" fontSize="13" fill="#4a5f82">
        {etiquetaX}
      </text>
      <text x="12" y={alto / 2} fontSize="13" fill="#4a5f82" transform={`rotate(-90 12 ${alto / 2})`} textAnchor="middle">
        {etiquetaY}
      </text>
    </svg>
  );
}
