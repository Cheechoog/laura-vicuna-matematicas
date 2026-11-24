import type { EstudianteOpcion, GrupoOpcion, Sesion } from "@lv/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Aviso, Cargando, cx } from "../components/ui";
import { api, mensajeDeError } from "../lib/api";
import { nombreAmigable } from "../lib/formato";
import { CLAVE_SESION } from "../lib/sesion";

const LARGO_PIN = 4;

export function IngresoEstudiante() {
  const [grupo, setGrupo] = useState<GrupoOpcion | null>(null);
  const [estudiante, setEstudiante] = useState<EstudianteOpcion | null>(null);
  const paso = !grupo ? 1 : !estudiante ? 2 : 3;

  return (
    <main className="fondo-cuaderno min-h-dvh px-4 py-8 md:py-12">
      <div className="hoja mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0 text-sm text-tinta-suave hover:text-tinta">
            ← Inicio
          </Link>
          <ol className="flex gap-1.5 text-sm" aria-label="Pasos">
            {["Grupo", "Nombre", "PIN"].map((p, i) => (
              <li
                key={p}
                aria-current={paso === i + 1 ? "step" : undefined}
                className={cx(
                  "whitespace-nowrap rounded-full px-2.5 py-1",
                  paso === i + 1 ? "bg-azul text-white" : paso > i + 1 ? "bg-verde-claro text-[#1f6e2f]" : "bg-tinta/5 text-tinta-suave"
                )}
              >
                {i + 1}. {p}
              </li>
            ))}
          </ol>
        </div>

        {paso === 1 && <PasoGrupo onElegir={setGrupo} />}
        {paso === 2 && grupo && <PasoNombre grupo={grupo} onElegir={setEstudiante} onVolver={() => setGrupo(null)} />}
        {paso === 3 && estudiante && <PasoPin estudiante={estudiante} onVolver={() => setEstudiante(null)} />}
      </div>
    </main>
  );
}

function PasoGrupo({ onElegir }: { onElegir: (g: GrupoOpcion) => void }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["ingreso", "grupos"],
    queryFn: () => api.get<GrupoOpcion[]>("/auth/grupos"),
  });

  const porGrado = useMemo(() => {
    const m = new Map<string, GrupoOpcion[]>();
    for (const g of data ?? []) m.set(g.grado, [...(m.get(g.grado) ?? []), g]);
    return [...m.entries()];
  }, [data]);

  return (
    <section className="mt-8">
      <h1 className="text-3xl md:text-4xl">¿En qué grupo estás?</h1>
      {isPending && <Cargando />}
      {error && <div className="mt-6"><Aviso tono="error">{mensajeDeError(error)}</Aviso></div>}
      <div className="mt-6 space-y-6">
        {porGrado.map(([grado, grupos]) => (
          <div key={grado}>
            <h2 className="mb-2 text-lg text-tinta-suave">{grado}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {grupos.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onElegir(g)}
                  className="rounded-2xl border-2 border-[#d6e0ee] bg-white px-4 py-5 font-titulo text-2xl transition-colors hover:border-azul hover:bg-azul-claro"
                >
                  {g.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PasoNombre({
  grupo,
  onElegir,
  onVolver,
}: {
  grupo: GrupoOpcion;
  onElegir: (e: EstudianteOpcion) => void;
  onVolver: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const { data, isPending, error } = useQuery({
    queryKey: ["ingreso", "estudiantes", grupo.id],
    queryFn: () => api.get<EstudianteOpcion[]>(`/auth/grupos/${grupo.id}/estudiantes`),
  });

  const lista = useMemo(() => {
    const f = filtro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (!f) return data ?? [];
    return (data ?? []).filter((e) => e.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(f));
  }, [data, filtro]);

  return (
    <section className="mt-8">
      <button onClick={onVolver} className="text-sm text-azul underline underline-offset-4">
        Cambiar de grupo ({grupo.nombre})
      </button>
      <h1 className="mt-2 text-3xl md:text-4xl">Busca tu nombre</h1>
      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Escribe tu apellido"
        aria-label="Buscar por apellido o nombre"
        className="mt-5 w-full rounded-xl border-2 border-[#c9d6e8] bg-white px-4 py-3 text-lg focus:border-azul focus:outline-none"
      />
      {isPending && <Cargando />}
      {error && <div className="mt-4"><Aviso tono="error">{mensajeDeError(error)}</Aviso></div>}
      <ul className="mt-4 max-h-[55vh] divide-y divide-cuadricula overflow-y-auto rounded-xl border-2 border-[#d6e0ee] bg-white">
        {lista.map((e) => (
          <li key={e.id}>
            <button onClick={() => onElegir(e)} className="w-full px-4 py-3.5 text-left text-[1.05rem] hover:bg-azul-claro">
              {e.nombre}
            </button>
          </li>
        ))}
        {data && lista.length === 0 && <li className="px-4 py-6 text-tinta-suave">Ningún nombre coincide con “{filtro}”.</li>}
      </ul>
    </section>
  );
}

function PasoPin({ estudiante, onVolver }: { estudiante: EstudianteOpcion; onVolver: () => void }) {
  const [pin, setPin] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const ingresar = useMutation({
    mutationFn: (p: string) => api.post<Sesion>("/auth/estudiante", { estudianteId: estudiante.id, pin: p }),
    onSuccess: (s) => {
      qc.setQueryData(CLAVE_SESION, s);
      navigate("/aprender", { replace: true });
    },
    onError: () => setPin(""),
  });

  const pulsar = (d: string) => {
    if (ingresar.isPending) return;
    ingresar.reset();
    setPin((p) => (p.length < LARGO_PIN ? p + d : p));
  };
  const borrar = () => setPin((p) => p.slice(0, -1));

  // Entra solo al completar los 4 dígitos
  useEffect(() => {
    if (pin.length === LARGO_PIN) ingresar.mutate(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // También funciona con el teclado del computador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) pulsar(e.key);
      else if (e.key === "Backspace") borrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="mt-8">
      <button onClick={onVolver} className="text-sm text-azul underline underline-offset-4">
        No soy yo
      </button>
      <h1 className="mt-2 text-3xl md:text-4xl">Hola, {nombreAmigable(estudiante.nombre)}</h1>
      <p className="mt-1 text-tinta-suave">Escribe tu PIN de 4 números.</p>

      <div className="mt-6 flex justify-center gap-3" aria-live="polite" aria-label={`${pin.length} de ${LARGO_PIN} números`}>
        {Array.from({ length: LARGO_PIN }, (_, i) => (
          <span
            key={i}
            className={cx(
              "grid size-14 place-items-center rounded-2xl border-2 text-3xl",
              i < pin.length ? "border-azul bg-azul-claro" : "border-[#c9d6e8] bg-white"
            )}
          >
            {i < pin.length ? "●" : ""}
          </span>
        ))}
      </div>

      {ingresar.isError && (
        <div className="mx-auto mt-5 max-w-sm">
          <Aviso tono="error">{mensajeDeError(ingresar.error)}</Aviso>
        </div>
      )}

      <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <TeclaPin key={d} onClick={() => pulsar(d)}>
            {d}
          </TeclaPin>
        ))}
        <span />
        <TeclaPin onClick={() => pulsar("0")}>0</TeclaPin>
        <TeclaPin onClick={borrar} etiqueta="Borrar">
          ⌫
        </TeclaPin>
      </div>
      {ingresar.isPending && <p className="mt-4 text-center text-tinta-suave">Entrando…</p>}
    </section>
  );
}

function TeclaPin({ children, onClick, etiqueta }: { children: ReactNode; onClick: () => void; etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="h-16 rounded-2xl border-2 border-[#d6e0ee] bg-white font-titulo text-2xl shadow-[0_3px_0_#d6e0ee] transition-transform active:translate-y-[2px] active:shadow-none"
    >
      {children}
    </button>
  );
}
