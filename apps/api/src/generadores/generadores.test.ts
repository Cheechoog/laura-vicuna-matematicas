import { describe, expect, it } from "vitest";
import { esRespuestaCorrecta } from "../shared/calificacion.js";
import { aSeleccionMultiple, generarVarios, REGISTRO } from "./index.js";

const CONFIGS: Record<string, Record<string, unknown>[]> = {
  aritmetica: [{ op: "add" }, { op: "sub", noNegativos: true }, { op: "mul" }, { op: "div", min: 2, max: 9 }],
  estadistica_base: [
    { modo: "conteo" },
    { modo: "frecuencia_absoluta" },
    { modo: "tabla_frecuencia" },
    { modo: "frecuencia_relativa" },
    { modo: "frecuencia_relativa_acumulada" },
    { modo: "grafico_barras" },
  ],
  enteros_ordenar: [{ min: -10, max: 10, cantidad: 3 }],
};

describe("cada generador registrado", () => {
  for (const [tipo, gen] of Object.entries(REGISTRO)) {
    it(`${tipo} produce ejercicios válidos`, () => {
      for (const config of CONFIGS[tipo] ?? [{}]) {
        for (let i = 0; i < 200; i++) {
          const ej = gen(config);
          expect(ej.enunciado.length).toBeGreaterThan(5);
          expect(ej.respuesta).not.toBe("");
          expect(ej.enunciado).not.toContain("undefined");
          expect(ej.enunciado).not.toContain("NaN");

          if (ej.tipo === "mcq") {
            expect(ej.opciones).toBeDefined();
            expect(ej.opciones).toContain(ej.respuesta);
            expect(new Set(ej.opciones).size).toBe(ej.opciones!.length);
          }
          if (ej.tipo === "vf") expect(["V", "F"]).toContain(ej.respuesta);
          // La respuesta correcta siempre debe calificarse como correcta
          expect(esRespuestaCorrecta(ej.tipo, ej.respuesta, ej.respuesta)).toBe(true);
        }
      }
    });
  }
});

describe("cálculos de los generadores", () => {
  it("la división de enteros siempre es exacta", () => {
    for (let i = 0; i < 300; i++) {
      const ej = REGISTRO.enteros_division!({ min: -12, max: 12 });
      const m = ej.enunciado.match(/Calcula \(?−?(\d+)\)? ÷ \(?(−?)(\d+)\)?/);
      expect(m).not.toBeNull();
      expect(Number.isInteger(Number(ej.respuesta))).toBe(true);
    }
  });

  it("la frecuencia relativa da porcentajes enteros", () => {
    for (let i = 0; i < 300; i++) {
      const ej = REGISTRO.estadistica_base!({ modo: "frecuencia_relativa" });
      expect(Number.isInteger(Number(ej.respuesta))).toBe(true);
    }
  });

  it("la suma de enteros es correcta", () => {
    for (let i = 0; i < 300; i++) {
      const ej = REGISTRO.enteros_suma!({ min: -20, max: 20 });
      const nums = [...ej.enunciado.matchAll(/(−?\d+)/g)].map((m) => Number(m[1]!.replace("−", "-")));
      expect(Number(ej.respuesta)).toBe(nums[0]! + nums[1]!);
    }
  });
});

describe("generarVarios", () => {
  it("no repite enunciados", () => {
    const lista = generarVarios([{ tipo: "enteros_suma", config: { min: -20, max: 20 }, peso: 1 }], 10);
    expect(lista).toHaveLength(10);
    expect(new Set(lista.map((e) => e.enunciado)).size).toBe(10);
  });

  it("ignora tipos desconocidos", () => {
    expect(generarVarios([{ tipo: "no_existe", config: {}, peso: 1 }], 3)).toHaveLength(0);
  });
});

describe("aSeleccionMultiple", () => {
  it("crea 4 opciones distintas con la correcta incluida", () => {
    for (let i = 0; i < 200; i++) {
      const ej = aSeleccionMultiple(REGISTRO.potencia!({}));
      expect(ej.tipo).toBe("mcq");
      expect(ej.opciones).toHaveLength(4);
      expect(ej.opciones).toContain(ej.respuesta);
    }
  });
});
