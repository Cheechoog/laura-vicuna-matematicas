// =====================================================================
// REGISTRO DE GENERADORES
// Para agregar un tipo nuevo: crea la función y regístrala aquí.
// La fila en la tabla `generadores` solo indica tipo + config + peso.
// =====================================================================
import { barajar, elegirPonderado, entero } from "../shared/aleatorio.js";
import { aritmetica, logaritmo, potencia, raiz } from "./aritmetica.js";
import { operacionesContexto } from "./contexto.js";
import * as e from "./enteros.js";
import * as est from "./estadistica.js";
import type { Config, Ejercicio, Generador } from "./tipos.js";

export type { Ejercicio } from "./tipos.js";

export const REGISTRO: Record<string, Generador> = {
  aritmetica,
  potencia,
  raiz,
  log: logaritmo,
  operaciones_contexto: operacionesContexto,
  enteros_identificar_signo: e.enterosIdentificarSigno,
  enteros_contexto: e.enterosContexto,
  enteros_comparar: e.enterosComparar,
  enteros_ordenar: e.enterosOrdenar,
  enteros_suma: e.enterosSuma,
  enteros_suma_contexto: e.enterosSumaContexto,
  enteros_resta: e.enterosResta,
  enteros_resta_contexto: e.enterosRestaContexto,
  enteros_multiplicacion: e.enterosMultiplicacion,
  enteros_regla_signos: e.enterosReglaSignos,
  enteros_division: e.enterosDivision,
  enteros_verificar_division: e.enterosVerificarDivision,
  estadistica_base: est.estadisticaBase,
  estadistica_recoleccion: est.estadisticaRecoleccion,
  estadistica_tabla_frecuencia: est.estadisticaTablaFrecuencia,
  estadistica_frecuencia_relativa: est.estadisticaFrecuenciaRelativa,
  estadistica_grafico_barras: est.estadisticaGraficoBarras,
};

export interface FilaGenerador {
  tipo: string;
  config: Config;
  peso: number;
}

export function existeGenerador(tipo: string): boolean {
  return tipo in REGISTRO;
}

/** Genera un ejercicio a partir de las filas configuradas para un subtema. */
export function generarEjercicio(filas: FilaGenerador[]): Ejercicio | null {
  const validas = filas.filter((f) => existeGenerador(f.tipo));
  if (validas.length === 0) return null;
  const fila = elegirPonderado(validas);
  return (REGISTRO[fila.tipo] as Generador)(fila.config ?? {});
}

/** Genera `cantidad` ejercicios evitando enunciados repetidos. */
export function generarVarios(filas: FilaGenerador[], cantidad: number): Ejercicio[] {
  const salida: Ejercicio[] = [];
  const vistos = new Set<string>();
  for (let intentos = 0; salida.length < cantidad && intentos < cantidad * 10; intentos++) {
    const ej = generarEjercicio(filas);
    if (!ej) break;
    if (vistos.has(ej.enunciado)) continue;
    vistos.add(ej.enunciado);
    salida.push(ej);
  }
  return salida;
}

/**
 * Convierte un ejercicio abierto numérico en selección múltiple (para el quiz),
 * con distractores cercanos al resultado.
 */
export function aSeleccionMultiple(ej: Ejercicio): Ejercicio {
  if (ej.tipo !== "abierta") return ej;
  const correcto = Number(ej.respuesta);
  if (!Number.isInteger(correcto)) return ej;
  const opciones = new Set<number>([correcto]);
  const saltos = [1, 2, 10, -1, -2, -10, 5, -5];
  while (opciones.size < 4) {
    opciones.add(correcto + (saltos[entero(0, saltos.length - 1)] as number));
  }
  return { ...ej, tipo: "mcq", opciones: barajar([...opciones].map(String)) };
}
