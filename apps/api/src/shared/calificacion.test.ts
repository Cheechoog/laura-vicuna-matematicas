import { describe, expect, it } from "vitest";
import { calcularNota, esRespuestaCorrecta, promedio } from "./calificacion.js";

describe("esRespuestaCorrecta", () => {
  it("acepta números escritos de distintas formas", () => {
    expect(esRespuestaCorrecta("abierta", " 45 ", "45")).toBe(true);
    expect(esRespuestaCorrecta("abierta", "3,5", "3.5")).toBe(true);
    expect(esRespuestaCorrecta("abierta", "−4", "-4")).toBe(true);
    expect(esRespuestaCorrecta("abierta", "+7", "7")).toBe(true);
    expect(esRespuestaCorrecta("abierta", "25%", "25")).toBe(true);
    expect(esRespuestaCorrecta("abierta", "1/2", "0.5")).toBe(true);
  });

  it("rechaza números distintos y respuestas vacías", () => {
    expect(esRespuestaCorrecta("abierta", "44", "45")).toBe(false);
    expect(esRespuestaCorrecta("abierta", "", "0")).toBe(false);
    expect(esRespuestaCorrecta("abierta", "4", "-4")).toBe(false);
  });

  it("ignora tildes y mayúsculas en texto", () => {
    expect(esRespuestaCorrecta("mcq", "natacion", "Natación")).toBe(true);
    expect(esRespuestaCorrecta("mcq", "FÚTBOL", "Fútbol")).toBe(true);
  });

  it("entiende verdadero/falso", () => {
    expect(esRespuestaCorrecta("vf", "Verdadero", "V")).toBe(true);
    expect(esRespuestaCorrecta("vf", "falso", "F")).toBe(true);
    expect(esRespuestaCorrecta("vf", "V", "F")).toBe(false);
  });
});

describe("calcularNota", () => {
  it("usa la escala de 1.0 a 5.0", () => {
    expect(calcularNota(0, 5)).toBe(1);
    expect(calcularNota(5, 5)).toBe(5);
    expect(calcularNota(3, 5)).toBe(3.4);
    expect(calcularNota(7, 10)).toBe(3.8);
  });
});

describe("promedio", () => {
  it("ignora valores vacíos", () => {
    expect(promedio([4, null, 3])).toBe(3.5);
    expect(promedio([null, undefined])).toBeNull();
  });
});
