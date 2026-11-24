import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { nota as fmtNota, tonoNota } from "../lib/formato";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-azul text-white hover:bg-[#2459a3] shadow-[0_3px_0_#1d4a87] active:translate-y-[2px] active:shadow-[0_1px_0_#1d4a87]",
  secundario: "bg-white text-azul border-2 border-azul/30 hover:border-azul hover:bg-azul-claro",
  fantasma: "text-tinta-suave hover:text-tinta hover:bg-tinta/5",
  peligro: "bg-white text-rojo border-2 border-rojo/30 hover:border-rojo hover:bg-rojo-claro",
};

export function Boton({
  variante = "primario",
  grande,
  cargando,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean; cargando?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-titulo font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0",
        grande ? "px-6 py-3.5 text-lg" : "px-4 py-2.5",
        VARIANTES[variante],
        className
      )}
    >
      {cargando ? "Un momento…" : children}
    </button>
  );
}

export function Aviso({ tono = "info", children }: { tono?: "info" | "error" | "exito" | "atencion"; children: ReactNode }) {
  const t = {
    info: "bg-azul-claro text-tinta border-azul/25",
    error: "bg-rojo-claro text-rojo border-rojo/25",
    exito: "bg-verde-claro text-[#1f6e2f] border-verde/25",
    atencion: "bg-ambar-claro text-[#7a5212] border-ambar/30",
  }[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={cx("rounded-xl border-2 px-4 py-3", t)}>
      {children}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-tinta-suave" role="status">
      <span className="size-5 animate-spin rounded-full border-[3px] border-azul/20 border-t-azul" />
      {texto}
    </div>
  );
}

export function NotaChip({ valor, etiqueta }: { valor: number | null | undefined; etiqueta?: string }) {
  const tono = tonoNota(valor);
  const estilos = {
    sin: "bg-tinta/5 text-tinta-suave",
    baja: "bg-rojo-claro text-rojo",
    media: "bg-ambar-claro text-[#7a5212]",
    alta: "bg-verde-claro text-[#1f6e2f]",
  }[tono];
  return (
    <span className={cx("inline-flex items-baseline gap-1 rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums", estilos)}>
      {etiqueta && <span className="font-normal">{etiqueta}</span>}
      {fmtNota(valor)}
    </span>
  );
}

export function Logo({ compacto }: { compacto?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="Inicio">
      <img src="/logo.png" alt="I.E. Laura Vicuña" className={compacto ? "h-9 w-auto" : "h-14 w-auto"} />
    </Link>
  );
}
