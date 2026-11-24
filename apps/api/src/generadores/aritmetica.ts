import { entero } from "../shared/aleatorio.js";
import { type Generador, num, subindice } from "./tipos.js";

export const aritmetica: Generador = (config) => {
  const op = String(config.op ?? "add");
  const min = num(config, "min", 1);
  const max = num(config, "max", 10);
  let a = entero(min, max);
  let b = entero(min, max);

  switch (op) {
    case "sub":
      if (config.noNegativos && b > a) [a, b] = [b, a];
      return { tipo: "abierta", enunciado: `¿Cuánto es ${a} − ${b}?`, respuesta: String(a - b) };
    case "mul":
      return { tipo: "abierta", enunciado: `¿Cuánto es ${a} × ${b}?`, respuesta: String(a * b) };
    case "div": {
      const divisor = entero(Math.max(2, min), Math.max(2, max));
      const cociente = entero(min, max);
      return {
        tipo: "abierta",
        enunciado: `¿Cuánto es ${divisor * cociente} ÷ ${divisor}?`,
        respuesta: String(cociente),
        explicacion: `${divisor} × ${cociente} = ${divisor * cociente}`,
      };
    }
    default:
      return { tipo: "abierta", enunciado: `¿Cuánto es ${a} + ${b}?`, respuesta: String(a + b) };
  }
};

export const potencia: Generador = (config) => {
  const base = entero(num(config, "baseMin", 2), num(config, "baseMax", 10));
  const exp = entero(num(config, "expMin", 2), num(config, "expMax", 4));
  const factores = Array.from({ length: exp }, () => base).join(" × ");
  return {
    tipo: "abierta",
    enunciado: `Calcula ${base}^${exp}`,
    respuesta: String(base ** exp),
    explicacion: `${base}^${exp} = ${factores} = ${base ** exp}`,
  };
};

export const raiz: Generador = (config) => {
  const n = entero(num(config, "nMin", 2), num(config, "nMax", 15));
  return {
    tipo: "abierta",
    enunciado: `Calcula √${n * n}`,
    respuesta: String(n),
    explicacion: `${n} × ${n} = ${n * n}, por eso √${n * n} = ${n}`,
  };
};

export const logaritmo: Generador = (config) => {
  const base = num(config, "base", 10);
  const exp = entero(num(config, "expMin", 1), num(config, "expMax", 4));
  return {
    tipo: "abierta",
    enunciado: `Calcula log${subindice(base)}(${base ** exp})`,
    respuesta: String(exp),
    explicacion: `${base}^${exp} = ${base ** exp}, por eso el logaritmo es ${exp}`,
  };
};
