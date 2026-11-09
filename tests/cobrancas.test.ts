import { describe, expect, it } from "vitest";
import { visaoDia, visaoMes } from "@/lib/domain/cobrancas";
import { cenario, HOJE } from "./cenario";

describe("visão do DIA", () => {
  it("lista o que vence na data + atrasadas e dívidas até a data", () => {
    const v = visaoDia(cenario(), HOJE);
    expect(v.itens.map((i) => `${i.cliente.nome}:${i.status}`)).toEqual([
      "Humberto Lemos de Moraes:divida",
      "Gisele Lima:atrasada",
      "Leticia Feiro:em_aberto",
      "Lucio Marcelo Lima:em_aberto",
    ]);
  });

  it("resumo e total a cobrar", () => {
    const { resumo } = visaoDia(cenario(), HOJE);
    expect(resumo.vencendo).toEqual({ qtd: 2, valor: 1600 });
    expect(resumo.atrasadas).toEqual({ qtd: 1, valor: 600 });
    expect(resumo.dividas).toEqual({ qtd: 1, valor: 600 });
    expect(resumo.totalACobrar).toBe(2800);
  });

  it("traz dias de atraso e o total devido pelo cliente", () => {
    const v = visaoDia(cenario(), HOJE);
    const gisele = v.itens.find((i) => i.cliente.id === "c1")!;
    expect(gisele.diasAtraso).toBe(27);
    expect(gisele.totalDevidoCliente).toBe(1200); // 10/10 + 10/11 em aberto
    const humberto = v.itens.find((i) => i.cliente.id === "c3")!;
    expect(humberto.diasAtraso).toBe(52);
  });

  it("filtros 'somente dívidas' e 'somente atrasadas'", () => {
    const dividas = visaoDia(cenario(), HOJE, "dividas");
    expect(dividas.itens.map((i) => i.cliente.nome)).toEqual(["Humberto Lemos de Moraes"]);
    expect(dividas.resumo.totalACobrar).toBe(600);
    const atrasadas = visaoDia(cenario(), HOJE, "atrasadas");
    expect(atrasadas.itens.map((i) => i.cliente.nome)).toEqual(["Gisele Lima"]);
  });

  it("data futura: o status é calculado em relação à data escolhida", () => {
    const v = visaoDia(cenario(), "2026-11-10");
    const gisele = v.itens.filter((i) => i.cliente.id === "c1");
    // 10/10 (31 dias antes de 10/11 → dívida) e 10/11 (vence na data)
    expect(gisele.map((i) => i.status).sort()).toEqual(["divida", "em_aberto"]);
  });

  it("parcela paga que vencia na data aparece como paga e sai do 'a cobrar'", () => {
    const base = cenario();
    base.parcelas.find((p) => p.id === "e2-p1")!.status_pagamento = "paga";
    const v = visaoDia(base, HOJE);
    expect(v.itens.find((i) => i.cliente.id === "c2")!.status).toBe("paga");
    expect(v.resumo.vencendo).toEqual({ qtd: 1, valor: 600 });
    expect(v.resumo.recebido).toEqual({ qtd: 1, valor: 1000 });
    expect(v.resumo.totalACobrar).toBe(1800);
  });
});

describe("visão do MÊS", () => {
  it("agrupa por dia com total previsto e recebido", () => {
    const v = visaoMes(cenario(), "2026-11", HOJE);
    expect(v.dias.map((d) => [d.data, d.previsto, d.recebido])).toEqual([
      ["2026-11-06", 1600, 0],
      ["2026-11-10", 600, 0],
    ]);
    expect(v.totais.previsto).toBe(2200);
    expect(v.totais.recebido).toBe(0);
    expect(v.totais.aReceber).toBe(2200);
  });

  it("mostra atrasadas e dívidas de meses anteriores", () => {
    const v = visaoMes(cenario(), "2026-11", HOJE);
    expect(v.anteriores.map((i) => `${i.cliente.nome}:${i.status}`)).toEqual([
      "Humberto Lemos de Moraes:divida",
      "Gisele Lima:atrasada",
    ]);
    expect(v.totais.atrasadas).toEqual({ qtd: 1, valor: 600 });
    expect(v.totais.dividas).toEqual({ qtd: 1, valor: 600 });
  });

  it("marcar como paga atualiza recebido do dia e do mês", () => {
    const base = cenario();
    base.parcelas.find((p) => p.id === "e2-p1")!.status_pagamento = "paga";
    const v = visaoMes(base, "2026-11", HOJE);
    expect(v.dias[0].recebido).toBe(1000);
    expect(v.totais.recebido).toBe(1000);
    expect(v.totais.aReceber).toBe(1200);
  });

  it("mês futuro não lista parcelas ainda não vencidas como anteriores", () => {
    const v = visaoMes(cenario(), "2027-01", HOJE);
    expect(v.dias.map((d) => d.data)).toEqual(["2027-01-06"]);
    expect(v.anteriores.map((i) => i.status).sort()).toEqual(["atrasada", "divida"]);
  });

  it("filtro 'dividas' vale para o mês inteiro", () => {
    const v = visaoMes(cenario(), "2026-09", HOJE, "dividas");
    expect(v.dias.flatMap((d) => d.itens).map((i) => i.cliente.nome)).toEqual([
      "Humberto Lemos de Moraes",
    ]);
  });
});
