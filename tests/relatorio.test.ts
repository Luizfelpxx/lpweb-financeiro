import { describe, expect, it } from "vitest";
import { relatorioDoDia, relatorioDoMes, calcularIndicadores } from "@/lib/domain/relatorio";
import { somar } from "@/lib/domain/dinheiro";
import { cenario, HOJE } from "./cenario";

describe("relatório (linhas e indicadores)", () => {
  const r = relatorioDoDia(cenario(), HOJE, "todas", HOJE);

  it("uma linha por empréstimo, com os campos do PDF", () => {
    expect(r.linhas.map((l) => l.cliente)).toEqual([
      "Gisele Lima",
      "Humberto Lemos de Moraes",
      "Leticia Feiro",
      "Lucio Marcelo Lima",
    ]);
    const gisele = r.linhas[0];
    expect(gisele).toMatchObject({
      pegou: 1500,
      rotuloParcelas: "3x",
      valorParcela: 600,
      quitacao: "parcial",
      parcelasPagas: 1,
      parcelasTotal: 3,
      totalAPagar: 1800,
      saldoDevedor: 1200,
      totalPago: 600,
      proximoVencimento: "2026-10-10",
      comissao: 100,
      observacao: "cliente geize",
    });
    const humberto = r.linhas[1];
    expect(humberto).toMatchObject({ rotuloParcelas: "30 dias", quitacao: "nao_pago", comissao: 0, observacao: "" });
    expect(r.linhas[2]).toMatchObject({ comissao: 0, observacao: "cliente rosangela" });
  });

  it("na visão do dia, os indicadores somam só as parcelas listadas no dia", () => {
    const i = r.indicadores;
    expect(i.clientes).toBe(4);
    expect(i.valorTotalRegistrado).toBe(2800);
    expect(i.valorAPagar + i.valorPagoRegistrado).toBe(i.valorTotalRegistrado);
    expect(i.totalAPagarEmprestimos).toBe(i.valorTotalRegistrado);
    expect(i.comissoes).toBe(somar(r.linhas.map((l) => l.comissao)));
  });

  it("a coluna 'VALOR A PAGAR' (total) = saldo devedor + valor pago", () => {
    expect(r.indicadores.totalAPagarEmprestimos).toBe(
      somar([r.indicadores.valorAPagar, r.indicadores.valorPagoRegistrado]),
    );
  });

  it("com filtro, os totais do dia acompanham apenas as linhas exibidas", () => {
    const dividas = relatorioDoDia(cenario(), HOJE, "dividas", HOJE);
    expect(dividas.linhas.map((l) => l.cliente)).toEqual(["Humberto Lemos de Moraes"]);
    expect(dividas.indicadores).toMatchObject({
      clientes: 1,
      valorTotalRegistrado: 600,
      valorAPagar: 600,
      valorPagoRegistrado: 0,
      comissoes: 0,
    });
  });

  it("cliente com 2 empréstimos conta uma vez em CLIENTES mas soma os dois valores do dia", () => {
    const base = cenario();
    const clone = structuredClone(base);
    const e2 = clone.emprestimos.find((e) => e.id === "e2")!;
    clone.emprestimos.push({ ...e2, id: "e2b", valor_emprestado: 200 });
    const p = clone.parcelas.find((x) => x.id === "e2-p1")!;
    clone.parcelas.push({ ...p, id: "e2b-p1", emprestimo_id: "e2b" });
    const rel = relatorioDoDia(clone, HOJE, "todas", HOJE);
    expect(rel.linhas.filter((l) => l.clienteId === "c2")).toHaveLength(2);
    expect(rel.indicadores.clientes).toBe(4);
    expect(rel.indicadores.valorTotalRegistrado).toBe(2800 + p.valor);
  });

  it("relatório do mês inclui as parcelas do mês e as atrasadas/dívidas anteriores", () => {
    const m = relatorioDoMes(cenario(), "2026-11", HOJE, "todas");
    expect(m.periodo).toBe("novembro de 2026");
    expect(m.linhas.map((l) => l.cliente)).toEqual([
      "Gisele Lima",
      "Humberto Lemos de Moraes",
      "Leticia Feiro",
      "Lucio Marcelo Lima",
    ]);
    expect(m.indicadores).toEqual(calcularIndicadores(m.linhas));
  });
});