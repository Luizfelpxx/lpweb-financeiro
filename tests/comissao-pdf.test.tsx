import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { relatorioComissoes } from "@/lib/domain/comissoes";
import { gerarPdfComissao } from "@/lib/pdf/gerar";
import { montarBase } from "./fixtures";

describe("PDF de comissões da Geize", () => {
  it("soma R$ 50 até R$ 1.000 e R$ 100 acima, e gera o PDF", async () => {
    const base = montarBase([
      { id: "a", nome: "Ana Souza", indicadoPor: "geize", emprestimos: [{ id: "ea", valorEmprestado: 1000, numeroParcelas: 2, valorParcela: 650, primeiroVencimento: "2026-12-05", dataEmprestimo: "2026-11-05" }] },
      { id: "b", nome: "Bruno Lima", indicadoPor: "geize", emprestimos: [{ id: "eb", valorEmprestado: 1500, numeroParcelas: 3, valorParcela: 650, primeiroVencimento: "2026-12-10", dataEmprestimo: "2026-11-10" }] },
      { id: "c", nome: "Carla Dias", indicadoPor: "rosangela", emprestimos: [{ id: "ec", valorEmprestado: 2000, numeroParcelas: 4, valorParcela: 650, primeiroVencimento: "2026-12-12", dataEmprestimo: "2026-11-12" }] },
    ]);
    const r = relatorioComissoes(base, "2026-11").geize;
    expect(r.linhas.map((l) => l.comissao)).toEqual([50, 100]);
    expect(r.totalComissao).toBe(150);

    const pdf = await gerarPdfComissao(r, "2026-11-23");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    mkdirSync("tmp", { recursive: true });
    writeFileSync("tmp/comissoes.pdf", pdf);

    const vazio = await gerarPdfComissao(relatorioComissoes(base, "2026-10").geize, "2026-11-23");
    expect(vazio.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
