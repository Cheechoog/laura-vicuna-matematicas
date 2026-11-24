// Problemas de la vida escolar con números naturales (grado sexto).
import { elegir, entero } from "../shared/aleatorio.js";
import type { Ejercicio, Generador } from "./tipos.js";

const modelos: (() => Ejercicio)[] = [
  () => {
    const a = entero(120, 980);
    const b = entero(130, 920);
    return {
      tipo: "abierta",
      enunciado: `La biblioteca del colegio recibió ${a} libros la primera semana y ${b} la segunda. ¿Cuántos libros llegaron en total?`,
      respuesta: String(a + b),
      explicacion: `${a} + ${b} = ${a + b}`,
    };
  },
  () => {
    const a = entero(650, 1500);
    const b = entero(120, a - 50);
    return {
      tipo: "abierta",
      enunciado: `La tienda escolar tenía ${a} jugos y vendió ${b} en el descanso. ¿Cuántos jugos quedaron?`,
      respuesta: String(a - b),
      explicacion: `${a} − ${b} = ${a - b}`,
    };
  },
  () => {
    const a = entero(14, 48);
    const b = entero(12, 36);
    return {
      tipo: "abierta",
      enunciado: `Para un acto cívico se organizaron ${a} filas con ${b} estudiantes en cada una. ¿Cuántos estudiantes hay en total?`,
      respuesta: String(a * b),
      explicacion: `${a} × ${b} = ${a * b}`,
    };
  },
  () => {
    const b = entero(4, 12);
    const m = entero(18, 42);
    return {
      tipo: "abierta",
      enunciado: `Se reparten ${b * m} lápices en ${b} cajas por partes iguales. ¿Cuántos lápices van en cada caja?`,
      respuesta: String(m),
      explicacion: `${b * m} ÷ ${b} = ${m}`,
    };
  },
  () => {
    const a = entero(350, 850);
    const b = entero(200, 700);
    const c = entero(100, 500);
    return {
      tipo: "abierta",
      enunciado: `Una biblioteca recibió ${a} cuentos, ${b} novelas y ${c} libros de ciencias. ¿Cuántos libros recibió en total?`,
      respuesta: String(a + b + c),
      explicacion: `${a} + ${b} + ${c} = ${a + b + c}`,
    };
  },
  () => {
    const precio = entero(2, 9) * 500;
    const cantidad = entero(3, 12);
    return {
      tipo: "abierta",
      enunciado: `Un cuaderno cuesta $${precio}. ¿Cuánto pagas por ${cantidad} cuadernos?`,
      respuesta: String(precio * cantidad),
      explicacion: `${precio} × ${cantidad} = ${precio * cantidad}`,
    };
  },
];

export const operacionesContexto: Generador = () => elegir(modelos)();
