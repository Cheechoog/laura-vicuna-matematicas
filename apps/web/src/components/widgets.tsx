// Actividades interactivas que viven dentro del HTML de las lecciones:
//   <div data-widget="frecuencias" data-default="a, b, a"></div>
//   <div data-widget="tabla-acumulada" data-default="0,1,1,2"></div>
import { useMemo, useState } from "react";
import { GraficoBarras } from "./Apoyo";

function contar(texto: string, ordenar: "frecuencia" | "valor") {
  const mapa = new Map<string, { etiqueta: string; valor: number }>();
  for (const bruto of texto.split(",")) {
    const etiqueta = bruto.trim();
    if (!etiqueta) continue;
    const clave = etiqueta.toLowerCase();
    const actual = mapa.get(clave) ?? { etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1), valor: 0 };
    actual.valor++;
    mapa.set(clave, actual);
  }
  const filas = [...mapa.values()];
  return ordenar === "valor"
    ? filas.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }))
    : filas.sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

function Campo({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-tinta-suave">Escribe los datos separados por comas y mira cómo cambia la tabla:</span>
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        rows={2}
        className="w-full rounded-xl border-2 border-[#c9d6e8] bg-white px-3 py-2 focus:border-azul focus:outline-none"
      />
    </label>
  );
}

export function WidgetFrecuencias({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const filas = useMemo(() => contar(texto, "frecuencia"), [texto]);
  const total = filas.reduce((a, f) => a + f.valor, 0);

  return (
    <div className="not-prose my-4 space-y-4 rounded-2xl border-2 border-azul/20 bg-azul-claro/50 p-4">
      <Campo valor={texto} onCambio={setTexto} />
      {filas.length > 0 && (
        <div className="grid items-start gap-4 md:grid-cols-[auto_1fr]">
          <table className="border-collapse bg-white text-center">
            <thead>
              <tr>
                <th className="border-2 border-[#c9d6e8] px-4 py-1.5">Dato</th>
                <th className="border-2 border-[#c9d6e8] px-4 py-1.5">Frecuencia</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.etiqueta}>
                  <td className="border-2 border-[#c9d6e8] px-4 py-1.5">{f.etiqueta}</td>
                  <td className="border-2 border-[#c9d6e8] px-4 py-1.5 font-bold tabular-nums">{f.valor}</td>
                </tr>
              ))}
              <tr>
                <td className="border-2 border-[#c9d6e8] px-4 py-1.5 font-bold">Total</td>
                <td className="border-2 border-[#c9d6e8] px-4 py-1.5 font-bold tabular-nums">{total}</td>
              </tr>
            </tbody>
          </table>
          <GraficoBarras barras={filas} etiquetaX="Dato" etiquetaY="Frecuencia" />
        </div>
      )}
    </div>
  );
}

export function WidgetTablaAcumulada({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const filas = useMemo(() => contar(texto, "valor"), [texto]);
  const total = filas.reduce((a, f) => a + f.valor, 0);
  let acumulada = 0;

  return (
    <div className="my-4 space-y-4 rounded-2xl border-2 border-azul/20 bg-azul-claro/50 p-4">
      <Campo valor={texto} onCambio={setTexto} />
      {filas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-collapse bg-white text-center">
            <thead>
              <tr>
                {["Dato", "f", "F (acumulada)", "fr", "%"].map((c) => (
                  <th key={c} className="border-2 border-[#c9d6e8] px-4 py-1.5">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                acumulada += f.valor;
                const fr = f.valor / total;
                return (
                  <tr key={f.etiqueta} className="tabular-nums">
                    <td className="border-2 border-[#c9d6e8] px-4 py-1.5">{f.etiqueta}</td>
                    <td className="border-2 border-[#c9d6e8] px-4 py-1.5 font-bold">{f.valor}</td>
                    <td className="border-2 border-[#c9d6e8] px-4 py-1.5">{acumulada}</td>
                    <td className="border-2 border-[#c9d6e8] px-4 py-1.5">{fr.toFixed(2)}</td>
                    <td className="border-2 border-[#c9d6e8] px-4 py-1.5">{Math.round(fr * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
