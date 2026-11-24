import { cx } from "../../components/ui";

export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  deshabilitado,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => onCambio(!activo)}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
        activo ? "bg-verde" : "bg-[#c9d6e8]"
      )}
    >
      <span className={cx("absolute top-1 size-5 rounded-full bg-white shadow transition-[left]", activo ? "left-6" : "left-1")} />
    </button>
  );
}

export function Selector<T extends string | number>({
  etiqueta,
  valor,
  opciones,
  onCambio,
}: {
  etiqueta: string;
  valor: T | "";
  opciones: { valor: T | ""; texto: string }[];
  onCambio: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-tinta-suave">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="min-w-36 rounded-lg border-2 border-[#c9d6e8] bg-white px-3 py-2 text-base focus:border-azul focus:outline-none"
      >
        {opciones.map((o) => (
          <option key={String(o.valor)} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export const tarjeta = "rounded-2xl border border-[#d6e0ee] bg-white";
