// Números enteros (grado séptimo): signo, recta, comparación y operaciones.
import { barajar, elegir, entero, enteroDistinto } from "../shared/aleatorio.js";
import { type Generador, ent, num, signo } from "./tipos.js";

const rango = (c: Record<string, unknown>, min: number, max: number) =>
  [num(c, "min", min), num(c, "max", max)] as const;

const noCero = (min: number, max: number) => enteroDistinto(min, max, [0]);

export const enterosIdentificarSigno: Generador = (c) => {
  const [min, max] = rango(c, -20, 20);
  const n = noCero(min, max);
  return {
    tipo: "mcq",
    enunciado: `El número ${signo(n)} es…`,
    opciones: ["Positivo", "Negativo"],
    respuesta: n > 0 ? "Positivo" : "Negativo",
    explicacion: n > 0 ? "Está a la derecha del cero." : "Lleva el signo menos: está a la izquierda del cero.",
  };
};

export const enterosContexto: Generador = (c) => {
  const [, max] = rango(c, -15, 15);
  const k = entero(2, Math.max(3, Math.abs(max)));
  const casos = [
    { t: `Un buzo está ${k} metros bajo el nivel del mar. ¿Qué número entero representa su posición?`, r: -k },
    { t: `La temperatura en un páramo bajó a ${k} grados bajo cero. Escribe ese número entero.`, r: -k },
    { t: `Un ascensor sube al piso ${k}. ¿Qué número entero representa ese piso?`, r: k },
    { t: `Laura le debe $${k} mil a su hermano. Escribe la deuda como número entero (en miles).`, r: -k },
    { t: `Un avión vuela a ${k} kilómetros sobre el nivel del mar. ¿Qué número entero lo representa?`, r: k },
    { t: `El carro está estacionado en el sótano ${k}. ¿Qué número entero representa ese piso?`, r: -k },
  ];
  const caso = elegir(casos);
  return { tipo: "abierta", enunciado: caso.t, respuesta: String(caso.r) };
};

export const enterosComparar: Generador = (c) => {
  const [min, max] = rango(c, -20, 20);
  const a = entero(min, max);
  const b = enteroDistinto(min, max, [a]);
  const mayor = Math.max(a, b);
  return {
    tipo: "mcq",
    enunciado: `¿Cuál número es mayor: ${signo(a)} o ${signo(b)}?`,
    opciones: barajar([signo(a), signo(b)]),
    respuesta: signo(mayor),
    explicacion: `En la recta numérica, ${signo(mayor)} está más a la derecha.`,
  };
};

export const enterosOrdenar: Generador = (c) => {
  const [min, max] = rango(c, -10, 10);
  const cantidad = num(c, "cantidad", 3);
  const nums: number[] = [];
  while (nums.length < cantidad) {
    const n = entero(min, max);
    if (!nums.includes(n)) nums.push(n);
  }
  const ordenados = [...nums].sort((x, y) => x - y);
  const correcta = ordenados.map(signo).join(", ");
  const opciones = new Set([correcta, [...ordenados].reverse().map(signo).join(", ")]);
  // Distractor típico: ordenar por valor absoluto
  opciones.add([...nums].sort((x, y) => Math.abs(x) - Math.abs(y)).map(signo).join(", "));
  while (opciones.size < 3) opciones.add(barajar(nums).map(signo).join(", "));
  return {
    tipo: "mcq",
    enunciado: `Ordena de menor a mayor: ${nums.map(signo).join(", ")}`,
    opciones: barajar([...opciones]),
    respuesta: correcta,
    explicacion: "El menor es el que está más a la izquierda en la recta numérica.",
  };
};

export const enterosSuma: Generador = (c) => {
  const [min, max] = rango(c, -20, 20);
  const a = noCero(min, max);
  const b = noCero(min, max);
  return {
    tipo: "abierta",
    enunciado: `Calcula ${ent(a)} + ${ent(b)}`,
    respuesta: String(a + b),
    explicacion:
      Math.sign(a) === Math.sign(b)
        ? "Mismo signo: se suman los valores y se deja el signo."
        : "Signos distintos: se restan los valores y queda el signo del de mayor valor absoluto.",
  };
};

export const enterosSumaContexto: Generador = (c) => {
  const [, max] = rango(c, -15, 15);
  const inicio = entero(-Math.abs(max), Math.abs(max));
  const cambio = noCero(-Math.abs(max), Math.abs(max));
  const fin = inicio + cambio;
  const verbo = cambio > 0 ? `subió ${cambio}` : `bajó ${Math.abs(cambio)}`;
  return {
    tipo: "abierta",
    enunciado: `En la mañana la temperatura era ${signo(inicio)} °C y en la tarde ${verbo} grados. ¿Cuál es la temperatura en la tarde?`,
    respuesta: String(fin),
    explicacion: `${ent(inicio)} + ${ent(cambio)} = ${signo(fin)}`,
  };
};

export const enterosResta: Generador = (c) => {
  const [min, max] = rango(c, -20, 20);
  const a = noCero(min, max);
  const b = noCero(min, max);
  return {
    tipo: "abierta",
    enunciado: `Calcula ${ent(a)} − ${ent(b)}`,
    respuesta: String(a - b),
    explicacion: `Restar es sumar el opuesto: ${ent(a)} + ${ent(-b)} = ${signo(a - b)}`,
  };
};

export const enterosRestaContexto: Generador = (c) => {
  const [, max] = rango(c, -15, 15);
  const arriba = entero(2, Math.abs(max));
  const abajo = -entero(2, Math.abs(max));
  return {
    tipo: "abierta",
    enunciado: `Un pájaro vuela a ${arriba} m de altura y un pez nada a ${Math.abs(abajo)} m de profundidad. ¿Cuántos metros los separan?`,
    respuesta: String(arriba - abajo),
    explicacion: `${arriba} − ${ent(abajo)} = ${arriba} + ${Math.abs(abajo)} = ${arriba - abajo}`,
  };
};

export const enterosMultiplicacion: Generador = (c) => {
  const [min, max] = rango(c, -12, 12);
  const a = noCero(min, max);
  const b = noCero(min, max);
  return {
    tipo: "abierta",
    enunciado: `Calcula ${ent(a)} × ${ent(b)}`,
    respuesta: String(a * b),
    explicacion: Math.sign(a) === Math.sign(b) ? "Signos iguales dan positivo." : "Signos distintos dan negativo.",
  };
};

export const enterosReglaSignos: Generador = () => {
  const casos = [
    { t: "(+) × (+)", r: "Positivo" },
    { t: "(−) × (−)", r: "Positivo" },
    { t: "(+) × (−)", r: "Negativo" },
    { t: "(−) × (+)", r: "Negativo" },
    { t: "(−) ÷ (−)", r: "Positivo" },
    { t: "(+) ÷ (−)", r: "Negativo" },
  ];
  const caso = elegir(casos);
  return {
    tipo: "mcq",
    enunciado: `Según la ley de los signos, ${caso.t} da como resultado un número…`,
    opciones: ["Positivo", "Negativo"],
    respuesta: caso.r,
    explicacion: "Signos iguales: positivo. Signos distintos: negativo.",
  };
};

export const enterosDivision: Generador = (c) => {
  const [min, max] = rango(c, -12, 12);
  const divisor = noCero(min, max);
  const cociente = noCero(min, max);
  return {
    tipo: "abierta",
    enunciado: `Calcula ${ent(divisor * cociente)} ÷ ${ent(divisor)}`,
    respuesta: String(cociente),
    explicacion: `Porque ${ent(divisor)} × ${ent(cociente)} = ${signo(divisor * cociente)}`,
  };
};

export const enterosVerificarDivision: Generador = (c) => {
  const [min, max] = rango(c, -12, 12);
  const divisor = noCero(min, max);
  const cociente = noCero(min, max);
  const dividendo = divisor * cociente;
  const esCorrecta = entero(0, 1) === 1;
  const propuesto = esCorrecta ? cociente : -cociente;
  return {
    tipo: "vf",
    enunciado: `${ent(dividendo)} ÷ ${ent(divisor)} = ${signo(propuesto)}`,
    respuesta: esCorrecta ? "V" : "F",
    explicacion: `Comprueba multiplicando: ${ent(divisor)} × ${ent(cociente)} = ${signo(dividendo)}, así que el resultado es ${signo(cociente)}.`,
  };
};
