import DOMPurify from "dompurify";
import { Fragment, useMemo, type ReactNode } from "react";
import { WidgetFrecuencias, WidgetTablaAcumulada } from "./widgets";

const WIDGETS: Record<string, (inicial: string) => ReactNode> = {
  frecuencias: (v) => <WidgetFrecuencias inicial={v} />,
  recoleccion: (v) => <WidgetFrecuencias inicial={v} />,
  "grafico-barras": (v) => <WidgetFrecuencias inicial={v} />,
  "tabla-acumulada": (v) => <WidgetTablaAcumulada inicial={v} />,
  "frecuencias-relativas": (v) => <WidgetTablaAcumulada inicial={v} />,
};

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Trozo = { tipo: "html"; html: string } | { tipo: "widget"; nombre: string; inicial: string };

/**
 * Muestra HTML que viene de la base de datos:
 *  1. lo sanitiza con DOMPurify (sin scripts ni eventos)
 *  2. reemplaza cada <div data-widget> por su componente React interactivo
 */
export function HtmlSeguro({ html, className }: { html: string; className?: string }) {
  const trozos = useMemo<Trozo[]>(() => {
    const limpio = DOMPurify.sanitize(html, { ADD_ATTR: ["data-widget", "data-default", "target"] });
    const doc = new DOMParser().parseFromString(`<body>${limpio}</body>`, "text/html");
    const salida: Trozo[] = [];
    let buffer = "";
    for (const nodo of Array.from(doc.body.childNodes)) {
      const el = nodo as HTMLElement;
      const nombre = el.nodeType === 1 ? el.getAttribute("data-widget") : null;
      if (nombre && WIDGETS[nombre]) {
        if (buffer) salida.push({ tipo: "html", html: buffer });
        buffer = "";
        salida.push({ tipo: "widget", nombre, inicial: el.getAttribute("data-default") ?? "" });
      } else {
        buffer += el.nodeType === 1 ? el.outerHTML : escapar(nodo.textContent ?? "");
      }
    }
    if (buffer) salida.push({ tipo: "html", html: buffer });
    return salida;
  }, [html]);

  return (
    <div className={className}>
      {trozos.map((t, i) =>
        t.tipo === "html" ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: t.html }} />
        ) : (
          <Fragment key={i}>{WIDGETS[t.nombre]!(t.inicial)}</Fragment>
        )
      )}
    </div>
  );
}
