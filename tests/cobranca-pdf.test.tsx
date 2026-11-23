import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cobrancaDoDia,
  cobrancaDoMes,
  filtrarBasePorIndicacao,
  lerFiltroIndicacao,
  nomeArquivoCobranca,
  telefoneValido,
} from "@/lib/domain/cobrancaPdf";
import { gerarPdfCobranca } from "@/lib/pdf/gerar";
import { cenario, HOJE } from "./cenario";
import { montarBase } from "./fixtures";

describe("PDF de cobrança", () => {
  it("agrupa por situação: dívidas, atrasados, a vencer e pagos", () => {
    const d = cobrancaDoMes(cenario(), "2026-11", HOJE, "todas", "todos");
    expect(d.grupos.map((g) => g.status)).toEqual(["divida", "atrasada", "em_aberto"]);
    const divida = d.grupos[0].linhas[0];
    expect(divida.cliente).toBe("Humberto Lemos de Moraes");
    expect(divida.situacao).toBe("Atrasada há 52 dias");
    expect(divida.vencimento).toBe("2026-09-15");
    expect(d.resumo.pessoasDevendo).toBe(2);
  });

  it("mostra quem já pagou, com a data do pagamento", () => {
    const d = cobrancaDoMes(cenario(), "2026-10", HOJE, "todas", "todos");
    const pagos = d.grupos.find((g) => g.status === "paga");
    expect(pagos?.linhas.map((l) => l.cliente)).toContain("Sebastiao");
    expect(pagos?.linhas[0].situacao).toMatch(/^Pago/);
    expect(d.resumo.recebido).toBeGreaterThan(0);
  });

  it("filtra pela indicação (lista só dos clientes da Geize)", () => {
    const d = cobrancaDoDia(cenario(), HOJE, "todas", "geize", HOJE);
    const nomes = new Set(d.grupos.flatMap((g) => g.linhas.map((l) => l.cliente)));
    expect([...nomes]).toEqual(["Gisele Lima"]);
    expect(nomeArquivoCobranca(d)).toBe(`cobranca-dia-${HOJE}-geize.pdf`);
    expect(lerFiltroIndicacao("xyz")).toBe("todos");
    const base = filtrarBasePorIndicacao(cenario(), "rosangela");
    expect(base.clientes.map((c) => c.nome)).toEqual(["Leticia Feiro"]);
  });

  it("telefone 00000000 não conta como telefone", () => {
    expect(telefoneValido("00000000")).toBe(false);
    expect(telefoneValido("(00) 0000-0000")).toBe(false);
    expect(telefoneValido("")).toBe(false);
    expect(telefoneValido("(21) 99999-1234")).toBe(true);
  });

  it("gera PDFs válidos (dia, mês, vazio e muitas linhas)", async () => {
    mkdirSync("tmp", { recursive: true });
    const dia = await gerarPdfCobranca(cobrancaDoDia(cenario(), HOJE, "todas", "todos", HOJE));
    expect(dia.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    writeFileSync("tmp/cobranca-dia.pdf", dia);

    const vazio = await gerarPdfCobranca(cobrancaDoDia(montarBase([]), HOJE, "todas", "todos", HOJE));
    expect(vazio.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const defs = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      nome: `Cliente ${String(i).padStart(2, "0")}`,
      telefone: "00000000",
      indicadoPor: (i % 2 === 0 ? "geize" : null) as "geize" | null,
      emprestimos: [
        { id: `e${i}`, valorEmprestado: 500 + i * 10, numeroParcelas: 3, valorParcela: 300, primeiroVencimento: i % 3 === 0 ? "2026-08-10" : "2026-10-20", pagas: i % 4 === 0 ? 1 : 0 },
      ],
    }));
    const muitas = await gerarPdfCobranca(cobrancaDoMes(montarBase(defs), "2026-11", HOJE, "todas", "todos"));
    expect(muitas.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    writeFileSync("tmp/cobranca-muitas.pdf", muitas);
  });
});

import { limitesDaSemana, formatarSemana } from "@/lib/domain/datas";
import { visaoDia, visaoSemana, visaoMes } from "@/lib/domain/cobrancas";
import { cobrancaDaSemana } from "@/lib/domain/cobrancaPdf";

describe("visão da semana e filtro 'só o período'", () => {
  it("semana vai de segunda a domingo", () => {
    expect(limitesDaSemana("2026-11-06")).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" }); // sexta
    expect(limitesDaSemana("2026-11-02")).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" }); // segunda
    expect(limitesDaSemana("2026-11-08")).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" }); // domingo
    expect(limitesDaSemana("2026-12-31")).toEqual({ inicio: "2026-12-28", fim: "2027-01-03" });
    expect(formatarSemana("2026-11-02", "2026-11-08")).toBe("02/11 a 08/11/2026");
  });

  it("lista as parcelas da semana e os atrasados de antes", () => {
    const v = visaoSemana(cenario(), HOJE, HOJE);
    expect(v.inicio).toBe("2026-11-02");
    const nomesSemana = v.dias.flatMap((d) => d.itens.map((i) => i.cliente.nome));
    expect(nomesSemana).toEqual(expect.arrayContaining(["Lucio Marcelo Lima", "Leticia Feiro"]));
    expect(nomesSemana).not.toContain("Gisele Lima"); // a dela vence dia 10 (semana seguinte)
    expect(v.anteriores.map((i) => i.cliente.nome)).toEqual(
      expect.arrayContaining(["Humberto Lemos de Moraes", "Gisele Lima"]),
    );
  });

  it("'só o período' tira os atrasados de antes (dia, semana e mês)", () => {
    const base = cenario();
    expect(visaoDia(base, HOJE, "periodo").itens.every((i) => i.parcela.data_vencimento === HOJE)).toBe(true);
    expect(visaoSemana(base, HOJE, HOJE, "periodo").anteriores).toHaveLength(0);
    expect(visaoMes(base, "2026-11", HOJE, "periodo").anteriores).toHaveLength(0);
  });

  it("gera o PDF da semana", async () => {
    const d = cobrancaDaSemana(cenario(), HOJE, HOJE, "todas", "todos");
    expect(d.tipo).toBe("semana");
    expect(d.periodo).toBe("02/11 a 08/11/2026");
    expect(nomeArquivoCobranca(d)).toBe("cobranca-semana-2026-11-02.pdf");
    const pdf = await gerarPdfCobranca(d);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    writeFileSync("tmp/cobranca-semana.pdf", pdf);
  });
});

describe("colunas do PDF para a Rosangela", () => {
  it("traz pago/não pago, data do pagamento, parcelas que faltam e quanto falta", () => {
    const d = cobrancaDoMes(cenario(), "2026-11", HOJE, "todas", "todos");
    const gisele = d.grupos.flatMap((g) => g.linhas).find((l) => l.cliente === "Gisele Lima")!;
    // empréstimo de 3 parcelas de 600, 1 paga
    expect(gisele.pago).toBe(false);
    expect(gisele.dataPagamento).toBeNull();
    expect(gisele.parcelasFaltam).toBe(2);
    expect(gisele.parcelasTotal).toBe(3);
    expect(gisele.faltaPagar).toBe(1200);

    const out = cobrancaDoMes(cenario(), "2026-10", HOJE, "todas", "todos");
    const seb = out.grupos.flatMap((g) => g.linhas).find((l) => l.cliente === "Sebastiao")!;
    expect(seb.pago).toBe(true);
    expect(seb.dataPagamento).not.toBeNull();
    expect(seb.parcelasFaltam).toBe(0);
    expect(seb.faltaPagar).toBe(0);
  });

  it("gera o PDF do mês com pagos e não pagos", async () => {
    const base = cenario();
    const d = cobrancaDoMes(base, "2026-10", HOJE, "todas", "todos");
    const pdf = await gerarPdfCobranca(d);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    writeFileSync("tmp/cobranca-mes-out.pdf", pdf);
  });
});

describe("resumo por devedor", () => {
  it("lista cada devedor uma vez, do mais atrasado para o menos", () => {
    const d = cobrancaDoMes(cenario(), "2026-11", HOJE, "todas", "todos");
    expect(d.devedores.map((x) => x.cliente)).toEqual(["Humberto Lemos de Moraes", "Gisele Lima"]);
    const gisele = d.devedores[1];
    expect(gisele.parcelasAtrasadas).toBe(1);
    expect(gisele.vencidaDesde).toBe("2026-10-10");
    expect(gisele.emAtraso).toBe(600);
    expect(gisele.deveNoTotal).toBe(1200);
  });
});
