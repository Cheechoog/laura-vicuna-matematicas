import { Link } from "react-router";

export function NoEncontrada() {
  return (
    <main className="fondo-cuaderno grid min-h-dvh place-items-center p-6">
      <div className="hoja max-w-md text-center">
        <h1 className="text-3xl">Esta página no existe</h1>
        <p className="mt-3 text-tinta-suave">Puede que el enlace esté mal escrito.</p>
        <Link to="/" className="mt-6 inline-block font-titulo text-azul underline underline-offset-4">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
