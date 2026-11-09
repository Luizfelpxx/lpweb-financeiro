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

  it("os indicadores são exatamente a soma das linhas da tabela", () => {
    const i = r.indicadores;
    expect(i.clientes).toBe(r.linhas.length);
    expect(i.valorTotalRegistrado).toBe(somar(r.linhas.map((l) => l.pegou)));
    expect(i.valorAPagar).toBe(somar(r.linhas.map((l) => l.saldoDevedor)));
    expect(i.valorPagoRegistrado).toBe(somar(r.linhas.map((l) => l.totalPago)));
    expect(i.comissoes).toBe(somar(r.linhas.map((l) => l.comissao)));
    // valores esperados do cenário
    expect(i).toMatchObject({
      clientes: 4,
      valorTotalRegistrado: 4800,
      valorAPagar: 5200,
      valorPagoRegistrado: 600,
      comissoes: 100,
      totalAPagarEmprestimos: 5800,
    });
  });

  it("a coluna 'VALOR A PAGAR' (total) = saldo devedor + valor pago", () => {
    expect(r.indicadores.totalAPagarEmprestimos).toBe(
      somar([r.indicadores.valorAPagar, r.indicadores.valorPagoRegistrado]),
    );
  });

  it("com filtro, os totais acompanham apenas as linhas exibidas", () => {
    const dividas = relatorioDoDia(cenario(), HOJE, "dividas", HOJE);
    expect(dividas.linhas.map((l) => l.cliente)).toEqual(["Humberto Lemos de Moraes"]);
    expect(dividas.indicadores).toMatchObject({
      clientes: 1,
      valorTotalRegistrado: 500,
      valorAPagar: 600,
      valorPagoRegistrado: 0,
      comissoes: 0,
    });
    expect(dividas.indicadores).toEqual(calcularIndicadores(dividas.linhas));
  });

  it("cliente com 2 empréstimos conta uma vez em CLIENTES mas soma os dois valores", () => {
    const base = cenario();
    // segundo empréstimo para Lucio, também vencendo hoje
    const clone = structuredClone(base);
    const e2 = clone.emprestimos.find((e) => e.id === "e2")!;
    clone.emprestimos.push({ ...e2, id: "e2b", valor_emprestado: 200 });
    const p = clone.parcelas.find((x) => x.id === "e2-p1")!;
    clone.parcelas.push({ ...p, id: "e2b-p1", emprestimo_id: "e2b" });
    const rel = relatorioDoDia(clone, HOJE, "todas", HOJE);
    expect(rel.linhas.filter((l) => l.clienteId === "c2")).toHaveLength(2);
    expect(rel.indicadores.clientes).toBe(4);
    expect(rel.indicadores.valorTotalRegistrado).toBe(5000);
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
