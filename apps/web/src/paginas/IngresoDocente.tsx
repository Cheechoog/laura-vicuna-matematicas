import type { Sesion } from "@lv/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Aviso, Boton } from "../components/ui";
import { api, mensajeDeError } from "../lib/api";
import { CLAVE_SESION } from "../lib/sesion";

export function IngresoDocente() {
  const [usuario, setUsuario] = useState("");
  const [pin, setPin] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const ingresar = useMutation({
    mutationFn: () => api.post<Sesion>("/auth/docente", { usuario, pin }),
    onSuccess: (s) => {
      qc.setQueryData(CLAVE_SESION, s);
      navigate("/docente", { replace: true });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    ingresar.mutate();
  };

  return (
    <main className="fondo-cuaderno grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={enviar} className="hoja w-full max-w-md space-y-5">
        <Link to="/" className="text-sm text-tinta-suave hover:text-tinta">
          ← Inicio
        </Link>
        <h1 className="text-3xl">Ingreso docente</h1>

        <label className="block">
          <span className="mb-1 block font-bold">Usuario</span>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            className="w-full rounded-xl border-2 border-[#c9d6e8] bg-white px-4 py-3 focus:border-azul focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-bold">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="current-password"
            required
            minLength={4}
            className="w-full rounded-xl border-2 border-[#c9d6e8] bg-white px-4 py-3 tracking-[0.3em] focus:border-azul focus:outline-none"
          />
        </label>

        {ingresar.isError && <Aviso tono="error">{mensajeDeError(ingresar.error)}</Aviso>}

        <Boton type="submit" grande className="w-full" cargando={ingresar.isPending}>
          Entrar
        </Boton>
      </form>
    </main>
  );
}
