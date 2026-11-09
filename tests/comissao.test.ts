import { describe, expect, it } from "vitest";
import {
  COMISSAO_GEIZE_ALTA,
  COMISSAO_GEIZE_BAIXA,
  calcularComissao,
} from "@/lib/domain/comissao";

describe("calcularComissao", () => {
  it("geize com valor emprestado acima de R$ 1.000,00 → R$ 100,00", () => {
    expect(calcularComissao(1000.01, "geize")).toBe(100);
    expect(calcularComissao(1500, "geize")).toBe(100);
    expect(calcularComissao(25000, "geize")).toBe(100);
    expect(COMISSAO_GEIZE_ALTA).toBe(100);
  });

  it("geize com valor emprestado até R$ 1.000,00 → R$ 50,00 (limite inclusive)", () => {
    expect(calcularComissao(1000, "geize")).toBe(50);
    expect(calcularComissao(1000.0, "geize")).toBe(50);
    expect(calcularComissao(999.99, "geize")).toBe(50);
    expect(calcularComissao(100, "geize")).toBe(50);
    expect(COMISSAO_GEIZE_BAIXA).toBe(50);
  });

  it("rosangela não tem comissão (0)", () => {
    expect(calcularComissao(500, "rosangela")).toBe(0);
    expect(calcularComissao(5000, "rosangela")).toBe(0);
  });

  it("sem indicação não tem comissão", () => {
    expect(calcularComissao(5000, null)).toBe(0);
    expect(calcularComissao(5000, undefined)).toBe(0);
  });

  it("é calculada sobre o valor emprestado, não sobre o total a pagar", () => {
    // emprestou 900 (comissão 50) mesmo que o total com juros passe de 1.000
    const valorEmprestado = 900;
    const totalComJuros = 1350;
    expect(totalComJuros).toBeGreaterThan(1000);
    expect(calcularComissao(valorEmprestado, "geize")).toBe(50);
  });
});
