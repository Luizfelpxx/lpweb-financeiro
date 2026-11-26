import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validarComissaoManual } from "@/lib/domain/comissao";
import { relatorioComissoes } from "@/lib/domain/comissoes";
import { lerValorBR } from "@/lib/domain/dinheiro";
import { gerarPdfComissao } from "@/lib/pdf/gerar";
import { montarBase } from "./fixtures";

describe("Comissão manual da Geize", () => {
  const base = () =>
    montarBase([
      { id: "a", nome: "Ana Souza", indicadoPor: "geize", emprestimos: [{ id: "ea", valorEmprestado: 1000, numeroParcelas: 2, valorParcela: 650, primeiroVencimento: "2026-12-05", dataEmprestimo: "2026-11-05" }] },
      { id: "b", nome: "Bruno Lima", indicadoPor: "geize", emprestimos: [{ id: "eb", valorEmprestado: 1500, numeroParcelas: 3, valorParcela: 650, primeiroVencimento: "2026-12-10", dataEmprestimo: "2026-11-10" }] },
    ]);

  it("continua automático: R$ 50 até R$ 1.000 e R$ 100 acima, sem marca de manual", () => {
    const r = relatorioComissoes(base(), "2026-11").geize;
    expect(r.linhas.map((l) => [l.comissao, l.comissaoAutomatica, l.manual])).toEqual([
      [50, 50, false],
      [100, 100, false],
    ]);
  });

  it("valor colocado à mão entra no total e fica marcado como manual", async () => {
    const b = base();
    b.emprestimos.find((e) => e.id === "eb")!.comissao = 50; // acima de R$ 1.000, mas combinou R$ 50
    const r = relatorioComissoes(b, "2026-11").geize;
    const bruno = r.linhas.find((l) => l.emprestimoId === "eb")!;
    expect(bruno).toMatchObject({ comissao: 50, comissaoAutomatica: 100, manual: true });
    expect(r.totalComissao).toBe(100);

    const pdf = await gerarPdfComissao(r, "2026-11-26");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    mkdirSync("tmp", { recursive: true });
    writeFileSync("tmp/comissoes-manual.pdf", pdf);
  });

  it("valida o valor digitado", () => {
    expect(validarComissaoManual(lerValorBR("50,00"), 1500)).toEqual({ ok: true, valor: 50 });
    expect(validarComissaoManual(lerValorBR("R$ 75,50"), 1500)).toEqual({ ok: true, valor: 75.5 });
    expect(validarComissaoManual(lerValorBR("0"), 1500)).toEqual({ ok: true, valor: 0 });
    expect(validarComissaoManual(lerValorBR("-10"), 1500).ok).toBe(false);
    expect(validarComissaoManual(lerValorBR("abc"), 1500).ok).toBe(false);
    expect(validarComissaoManual(lerValorBR("2000"), 1500).ok).toBe(false);
  });
});
