import { describe, expect, it } from "vitest";
import { relatorioComissoes } from "@/lib/domain/comissoes";
import { descreverHistorico } from "@/lib/domain/historico";
import { resumoPainel } from "@/lib/domain/painel";
import type { Historico } from "@/lib/domain/tipos";
import { cenario, HOJE } from "./cenario";
import { montarBase } from "./fixtures";

describe("painel", () => {
  const r = resumoPainel(cenario(), HOJE);
  it("totais gerais", () => {
    expect(r.totalEmprestado).toBe(5100);
    expect(r.jurosPrevistos).toBe(1060); // 6160 a pagar − 5100 emprestados
    expect(r.totalRecebido).toBe(960);
    expect(r.totalAReceber).toBe(5200);
    expect(r.quantidadeClientes).toBe(5);
  });
  it("atrasadas e dívidas (quantidade e valor) e clientes com dívida", () => {
    expect(r.atrasadas).toEqual({ qtd: 1, valor: 600 });
    expect(r.dividas).toEqual({ qtd: 1, valor: 600 });
    expect(r.clientesEmDivida).toHaveLength(1);
    expect(r.clientesEmDivida[0]).toMatchObject({ qtd: 1, valor: 600, maiorAtraso: 52, totalDevido: 600 });
    expect(r.clientesEmDivida[0].cliente.nome).toBe("Humberto Lemos de Moraes");
  });
  it("clientes arquivados não entram na contagem", () => {
    const base = cenario();
    base.clientes[0].arquivado = true;
    expect(resumoPainel(base, HOJE).quantidadeClientes).toBe(4);
  });
});

describe("relatório de comissões por funcionária", () => {
  it("agrupa por mês do empréstimo e por funcionária", () => {
    const r = relatorioComissoes(cenario(), "2026-10");
    expect(r.geize).toMatchObject({ clientes: 1, totalEmprestado: 1500, totalComissao: 100 });
    expect(r.geize.linhas[0]).toMatchObject({ cliente: "Gisele Lima", valorEmprestado: 1500, comissao: 100 });
    expect(r.rosangela).toMatchObject({ clientes: 1, totalEmprestado: 2000, totalComissao: 0 });
    expect(relatorioComissoes(cenario(), "2026-11").geize.linhas).toHaveLength(0);
  });

  it("R$ 1.000,00 paga R$ 50,00; acima disso R$ 100,00; total do mês soma tudo", () => {
    const mk = (id: string, nome: string, valor: number, dia: string) => ({
      id: `c-${id}`,
      nome,
      indicadoPor: "geize" as const,
      emprestimos: [{ id: `e-${id}`, valorEmprestado: valor, numeroParcelas: 2, valorParcela: valor, primeiroVencimento: "2026-12-10", dataEmprestimo: dia }],
    });
    const base = montarBase([
      mk("a", "Ana", 1000, "2026-11-03"),
      mk("b", "Bia", 1000.01, "2026-11-20"),
      mk("c", "Cris", 300, "2026-11-30"),
      mk("d", "Dora", 5000, "2026-12-01"), // outro mês
    ]);
    const r = relatorioComissoes(base, "2026-11").geize;
    expect(r.linhas.map((l) => [l.cliente, l.comissao])).toEqual([["Ana", 50], ["Bia", 100], ["Cris", 50]]);
    expect(r.totalComissao).toBe(200);
    expect(r.totalEmprestado).toBe(2300.01);
    expect(r.clientes).toBe(3);
  });
});

describe("descrição do histórico", () => {
  const h = (p: Partial<Historico>): Historico => ({
    id: "1", tabela: "clientes", registro_id: "x", cliente_id: "x", acao: "criar",
    dados_antes: null, dados_depois: null, usuario_id: null, criado_em: "2026-11-06T12:00:00Z", ...p,
  });
  it("cliente: criar, editar (campos alterados), arquivar", () => {
    expect(descreverHistorico(h({ dados_depois: { nome: "Ana" } }))).toBe("Cliente Ana cadastrado");
    expect(
      descreverHistorico(h({ acao: "editar", dados_antes: { nome: "Ana", telefone: "1", atualizado_em: "a" }, dados_depois: { nome: "Ana", telefone: "2", atualizado_em: "b" } })),
    ).toBe("Dados de Ana alterados (telefone)");
    expect(descreverHistorico(h({ acao: "arquivar", dados_depois: { nome: "Ana" } }))).toBe("Cliente Ana arquivado");
  });
  it("parcela: marcada como paga e desmarcada", () => {
    const d = { numero_parcela: 2, data_vencimento: "2026-10-10", valor: 600 };
    expect(descreverHistorico(h({ tabela: "parcelas", acao: "marcar_paga", dados_depois: d }))).toBe(
      "Parcela 2 (venc. 10/10/2026, R$ 600,00) marcada como paga",
    );
    expect(descreverHistorico(h({ tabela: "parcelas", acao: "desmarcar_paga", dados_depois: d }))).toContain("voltou a ser devido");
  });
  it("empréstimo", () => {
    expect(
      descreverHistorico(h({ tabela: "emprestimos", dados_depois: { valor_emprestado: 500, numero_parcelas: 30 } })),
    ).toBe("Empréstimo de R$ 500,00 em 30 dias criado");
  });
});
