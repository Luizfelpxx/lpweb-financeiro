import { describe, expect, it } from "vitest";
import {
  calcularEmprestimo,
  gerarParcelas,
  parcelasCobertasPorPagamento,
  rotuloParcelas,
  sugerirJuros,
  validarEmprestimo,
} from "@/lib/domain/emprestimo";
import { lerData } from "@/lib/domain/datas";
import { formatarBRL, lerValorBR } from "@/lib/domain/dinheiro";

describe("gerarParcelas", () => {
  it("gera parcelas mensais no mesmo dia", () => {
    const p = gerarParcelas({ numeroParcelas: 3, valorParcela: 400, primeiroVencimento: "2026-11-10" });
    expect(p.map((x) => x.data_vencimento)).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
    expect(p.map((x) => x.numero_parcela)).toEqual([1, 2, 3]);
  });

  it("primeira parcela no dia 31: meses curtos usam o último dia", () => {
    const p = gerarParcelas({ numeroParcelas: 4, valorParcela: 100, primeiroVencimento: "2026-12-31" });
    expect(p.map((x) => x.data_vencimento)).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("'30 dias' gera uma única parcela", () => {
    const p = gerarParcelas({ numeroParcelas: 30, valorParcela: 650, primeiroVencimento: "2026-12-05" });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ numero_parcela: 1, valor: 650, data_vencimento: "2026-12-05" });
    expect(rotuloParcelas(30)).toBe("30 dias");
    expect(rotuloParcelas(2)).toBe("2x");
  });
});

describe("calcularEmprestimo", () => {
  it("total = soma das parcelas; taxa de juros e comissão calculadas", () => {
    const e = calcularEmprestimo({
      valorEmprestado: 1000,
      numeroParcelas: 2,
      valorParcela: 650,
      primeiroVencimento: "2026-12-10",
      indicadoPor: "geize",
    });
    expect(e.totalAPagar).toBe(1300);
    expect(e.taxaJurosPercentual).toBe(30);
    expect(e.comissao).toBe(50); // 1000,00 não é > 1000,00
    expect(e.parcelas).toHaveLength(2);
  });

  it("os valores acordados prevalecem sobre a sugestão", () => {
    const sugestao = sugerirJuros(1100, 20, 3); // 1320 / 3 = 440
    expect(sugestao).toEqual({ total: 1320, valorParcela: 440 });
    const e = calcularEmprestimo({
      valorEmprestado: 1100,
      numeroParcelas: 3,
      valorParcela: 450, // acordado diferente
      primeiroVencimento: "2026-12-10",
      indicadoPor: "geize",
    });
    expect(e.totalAPagar).toBe(1350);
    expect(e.comissao).toBe(100);
  });

  it("evita erro de ponto flutuante (3 x 0,10)", () => {
    const e = calcularEmprestimo({
      valorEmprestado: 0.25,
      numeroParcelas: 3,
      valorParcela: 0.1,
      primeiroVencimento: "2026-12-10",
      indicadoPor: null,
    });
    expect(e.totalAPagar).toBe(0.3);
  });
});

describe("sugerirJuros", () => {
  it("mostra o total para 10/15/20/25/30% e divide pelo nº de parcelas", () => {
    const totais = [10, 15, 20, 25, 30].map((p) => sugerirJuros(1000, p, 4).total);
    expect(totais).toEqual([1100, 1150, 1200, 1250, 1300]);
    expect(sugerirJuros(1000, 25, 4).valorParcela).toBe(312.5);
  });
  it("'30 dias' usa uma parcela só", () => {
    expect(sugerirJuros(500, 20, 30)).toEqual({ total: 600, valorParcela: 600 });
  });
  it("aceita percentual livre", () => {
    expect(sugerirJuros(1000, 12.5, 5)).toEqual({ total: 1125, valorParcela: 225 });
  });
});

describe("validarEmprestimo", () => {
  const ok = { valorEmprestado: 500, numeroParcelas: 2, valorParcela: 300, primeiroVencimento: "2026-12-01" };
  it("aceita dados válidos", () => expect(validarEmprestimo(ok)).toEqual([]));
  it("rejeita valores e datas inválidos", () => {
    expect(validarEmprestimo({ ...ok, valorEmprestado: 0 })).toHaveLength(1);
    expect(validarEmprestimo({ ...ok, numeroParcelas: 29 })).toHaveLength(1);
    expect(validarEmprestimo({ ...ok, numeroParcelas: 0 })).toHaveLength(1);
    expect(validarEmprestimo({ ...ok, valorParcela: -1 })).toHaveLength(1);
    expect(validarEmprestimo({ ...ok, primeiroVencimento: "2026-02-30" })).toHaveLength(1);
    expect(validarEmprestimo({ ...ok, numeroParcelas: 30 })).toEqual([]);
  });
});

describe("parcelasCobertasPorPagamento", () => {
  it("só conta parcelas inteiras", () => {
    expect(parcelasCobertasPorPagamento(0, 100, 3)).toEqual({ quitadas: 0, resto: 0 });
    expect(parcelasCobertasPorPagamento(200, 100, 3)).toEqual({ quitadas: 2, resto: 0 });
    expect(parcelasCobertasPorPagamento(250, 100, 3)).toEqual({ quitadas: 2, resto: 50 });
    expect(parcelasCobertasPorPagamento(999, 100, 3)).toEqual({ quitadas: 3, resto: 699 });
  });
});

describe("formatação e leitura de valores/datas (pt-BR)", () => {
  it("formatarBRL", () => {
    expect(formatarBRL(1234.5)).toBe("R$ 1.234,50");
    expect(formatarBRL(0)).toBe("R$ 0,00");
  });
  it("lerValorBR", () => {
    expect(lerValorBR("1.234,56")).toBe(1234.56);
    expect(lerValorBR("1234,56")).toBe(1234.56);
    expect(lerValorBR("1234.56")).toBe(1234.56);
    expect(lerValorBR("R$ 650,00")).toBe(650);
    expect(lerValorBR("1.250")).toBe(1250);
    expect(lerValorBR("")).toBeNull();
    expect(lerValorBR("abc")).toBeNull();
  });
  it("lerData", () => {
    expect(lerData("06/11/2026")).toBe("2026-11-06");
    expect(lerData("6/1/26")).toBe("2026-01-06");
    expect(lerData("2026-11-06")).toBe("2026-11-06");
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerData("2026-13-01")).toBeNull();
    expect(lerData("ontem")).toBeNull();
  });
});
