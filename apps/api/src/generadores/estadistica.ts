// Estadística (grado séptimo): recolección, tablas de frecuencia y gráficos.
import { barajar, elegir, entero } from "../shared/aleatorio.js";
import type { Ejercicio, Generador } from "./tipos.js";

interface Fila {
  categoria: string;
  frecuencia: number;
  acumulada: number;
  porcentaje: number;
}

interface Conjunto {
  contexto: string;
  etiquetaX: string;
  etiquetaY: string;
  total: number;
  datos: string[];
  filas: Fila[];
}

const BANCOS = [
  { contexto: "deporte favorito del salón", x: "Deporte", y: "Estudiantes", cats: ["Fútbol", "Baloncesto", "Natación", "Voleibol"] },
  { contexto: "fruta favorita del curso", x: "Fruta", y: "Estudiantes", cats: ["Manzana", "Banano", "Naranja", "Uva"] },
  { contexto: "medio de transporte para llegar al colegio", x: "Transporte", y: "Estudiantes", cats: ["Bus", "Bicicleta", "Caminando", "Moto"] },
  { contexto: "color favorito", x: "Color", y: "Estudiantes", cats: ["Azul", "Rojo", "Verde", "Amarillo"] },
  { contexto: "mascota que tienen en casa", x: "Mascota", y: "Estudiantes", cats: ["Perro", "Gato", "Pez", "Ninguna"] },
];

function completar(filas: Omit<Fila, "acumulada" | "porcentaje">[]): Fila[] {
  const total = filas.reduce((a, f) => a + f.frecuencia, 0);
  let acumulada = 0;
  return filas.map((f) => {
    acumulada += f.frecuencia;
    return { ...f, acumulada, porcentaje: Math.round((f.frecuencia / total) * 100) };
  });
}

/** Encuesta con categorías (frutas, deportes…). Cada categoría queda con frecuencia distinta. */
export function conjuntoCategorico(): Conjunto {
  const banco = elegir(BANCOS);
  // Frecuencias distintas entre sí para que "la mayor" sea una sola
  const frecuencias = barajar([entero(1, 2), entero(3, 4), entero(5, 6), entero(7, 8)]);
  const filas = completar(banco.cats.map((categoria, i) => ({ categoria, frecuencia: frecuencias[i] as number })));
  const datos = barajar(filas.flatMap((f) => Array<string>(f.frecuencia).fill(f.categoria)));
  return { contexto: banco.contexto, etiquetaX: banco.x, etiquetaY: banco.y, total: datos.length, datos, filas };
}

/** Datos numéricos ordenados (número de hermanos) con 20 o 25 datos para porcentajes exactos. */
export function conjuntoOrdenado(): Conjunto {
  const total = elegir([20, 25]);
  const valores = ["0", "1", "2", "3", "4"];
  const f = valores.map(() => 1);
  for (let i = valores.length; i < total; i++) {
    const k = entero(0, valores.length - 1);
    f[k] = (f[k] as number) + 1;
  }
  const filas = completar(valores.map((categoria, i) => ({ categoria, frecuencia: f[i] as number })));
  const datos = barajar(filas.flatMap((x) => Array<string>(x.frecuencia).fill(x.categoria)));
  return { contexto: "número de hermanos", etiquetaX: "Hermanos", etiquetaY: "Estudiantes", total, datos, filas };
}

const tablaSimple = (c: Conjunto) => ({
  tipo: "tabla" as const,
  titulo: `Encuesta: ${c.contexto}`,
  columnas: [c.etiquetaX, "Frecuencia (f)"],
  filas: c.filas.map((f) => [f.categoria, f.frecuencia]),
});

const listaDatos = (c: Conjunto) => ({
  tipo: "lista" as const,
  titulo: `Respuestas de la encuesta: ${c.contexto}`,
  items: c.datos,
});

// ---------------------------------------------------------------------
// Ejercicios por modo
// ---------------------------------------------------------------------
const porModo: Record<string, () => Ejercicio> = {
  conteo: () => {
    const c = conjuntoCategorico();
    const f = elegir(c.filas);
    return {
      tipo: "abierta",
      enunciado: `Cuenta en la lista: ¿cuántas personas respondieron "${f.categoria}"?`,
      apoyo: listaDatos(c),
      respuesta: String(f.frecuencia),
      explicacion: `"${f.categoria}" aparece ${f.frecuencia} veces.`,
    };
  },

  total: () => {
    const c = conjuntoCategorico();
    return {
      tipo: "abierta",
      enunciado: "¿Cuántas personas respondieron la encuesta en total?",
      apoyo: tablaSimple(c),
      respuesta: String(c.total),
      explicacion: `Se suman todas las frecuencias: ${c.filas.map((f) => f.frecuencia).join(" + ")} = ${c.total}`,
    };
  },

  frecuencia_absoluta: () => {
    const c = conjuntoCategorico();
    const f = elegir(c.filas);
    return {
      tipo: "abierta",
      enunciado: `¿Cuál es la frecuencia absoluta de "${f.categoria}"?`,
      apoyo: listaDatos(c),
      respuesta: String(f.frecuencia),
      explicacion: "La frecuencia absoluta es el número de veces que se repite un dato.",
    };
  },

  tabla_frecuencia: () => {
    const c = conjuntoCategorico();
    const f = elegir(c.filas);
    return {
      tipo: "abierta",
      enunciado: `Vas a construir la tabla de frecuencias. ¿Qué número escribes en la fila "${f.categoria}"?`,
      apoyo: listaDatos(c),
      respuesta: String(f.frecuencia),
    };
  },

  moda: () => {
    const c = conjuntoCategorico();
    const mayor = [...c.filas].sort((a, b) => b.frecuencia - a.frecuencia)[0] as Fila;
    return {
      tipo: "mcq",
      enunciado: "¿Cuál es la respuesta que más se repite (la moda)?",
      apoyo: tablaSimple(c),
      opciones: c.filas.map((f) => f.categoria),
      respuesta: mayor.categoria,
    };
  },

  frecuencia_relativa: () => {
    const c = conjuntoOrdenado();
    const f = elegir(c.filas);
    return {
      tipo: "abierta",
      enunciado: `En la tabla hay ${c.total} datos. ¿Qué porcentaje de estudiantes tiene ${f.categoria} hermano(s)? Escribe solo el número.`,
      apoyo: {
        tipo: "tabla",
        titulo: "Número de hermanos",
        columnas: ["Hermanos", "f"],
        filas: c.filas.map((x) => [x.categoria, x.frecuencia]),
      },
      respuesta: String(f.porcentaje),
      explicacion: `(${f.frecuencia} ÷ ${c.total}) × 100 = ${f.porcentaje}%`,
    };
  },

  frecuencia_relativa_acumulada: () => {
    const c = conjuntoOrdenado();
    const f = elegir(c.filas.slice(1));
    return {
      tipo: "abierta",
      enunciado: `¿Cuál es la frecuencia absoluta acumulada (F) del valor ${f.categoria}?`,
      apoyo: {
        tipo: "tabla",
        titulo: "Número de hermanos",
        columnas: ["Hermanos", "f"],
        filas: c.filas.map((x) => [x.categoria, x.frecuencia]),
      },
      respuesta: String(f.acumulada),
      explicacion: "Se suman las frecuencias desde la primera fila hasta esa fila.",
    };
  },

  grafico_barras: () => {
    const c = conjuntoCategorico();
    const mayor = [...c.filas].sort((a, b) => b.frecuencia - a.frecuencia)[0] as Fila;
    return {
      tipo: "mcq",
      enunciado: "Si haces el diagrama de barras con esta tabla, ¿qué categoría tiene la barra más alta?",
      apoyo: tablaSimple(c),
      opciones: c.filas.map((f) => f.categoria),
      respuesta: mayor.categoria,
    };
  },

  leer_barras: () => {
    const c = conjuntoCategorico();
    const f = elegir(c.filas);
    return {
      tipo: "abierta",
      enunciado: `Observa el gráfico. ¿Cuántos estudiantes eligieron "${f.categoria}"?`,
      apoyo: {
        tipo: "barras",
        titulo: c.contexto,
        etiquetaX: c.etiquetaX,
        etiquetaY: c.etiquetaY,
        barras: c.filas.map((x) => ({ etiqueta: x.categoria, valor: x.frecuencia })),
      },
      respuesta: String(f.frecuencia),
    };
  },
};

const desde = (modos: string[]): Generador => () => (porModo[elegir(modos)] as () => Ejercicio)();

/** Genérico: config.modo elige el tipo de ejercicio. */
export const estadisticaBase: Generador = (config) => {
  const fn = porModo[String(config.modo ?? "conteo")] ?? porModo.conteo!;
  return fn();
};

export const estadisticaRecoleccion = desde(["conteo", "total", "frecuencia_absoluta"]);
export const estadisticaTablaFrecuencia = desde(["tabla_frecuencia", "total", "moda"]);
export const estadisticaFrecuenciaRelativa = desde(["frecuencia_relativa", "frecuencia_relativa_acumulada"]);
export const estadisticaGraficoBarras = desde(["grafico_barras", "leer_barras", "moda"]);
