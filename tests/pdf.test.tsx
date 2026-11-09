import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { relatorioDoDia, relatorioDoMes, nomeArquivoPdf } from "@/lib/domain/relatorio";
import { gerarPdfRelatorio } from "@/lib/pdf/gerar";
import { LINHAS_DEMAIS_PAGINAS, LINHAS_PRIMEIRA_PAGINA, paginar } from "@/lib/pdf/RelatorioPdf";
import { cenario, HOJE } from "./cenario";
import { montarBase } from "./fixtures";

function paginasDoPdf(pdf: Buffer): number {
  const m = /\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)|\/Count\s+(\d+)[\s\S]{0,200}?\/Type\s*\/Pages/.exec(
    pdf.toString("latin1"),
  );
  return Number(m?.[1] ?? m?.[2] ?? 0);
}

describe("geração do PDF", () => {
  it("gera um PDF válido para a visão do dia", async () => {
    const pdf = await gerarPdfRelatorio(relatorioDoDia(cenario(), HOJE, "todas", HOJE));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(paginasDoPdf(pdf)).toBe(1);
    // saída para inspeção visual (ignorada pelo git)
    mkdirSync("tmp", { recursive: true });
    writeFileSync("tmp/relatorio-dia.pdf", pdf);
  });

  it("gera para o mês e para os filtros 'somente dívidas' / 'somente atrasadas'", async () => {
    const base = cenario();
    for (const filtro of ["todas", "dividas", "atrasadas"] as const) {
      const dados = relatorioDoMes(base, "2026-11", HOJE, filtro);
      const pdf = await gerarPdfRelatorio(dados);
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      if (filtro === "dividas") writeFileSync("tmp/relatorio-mes-dividas.pdf", pdf);
    }
  });

  it("relatório vazio também gera PDF (zeros e aviso)", async () => {
    const vazio = relatorioDoDia(cenario(), "2030-01-01", "dividas", HOJE);
    // em 2030 todas as parcelas abertas viram dívida; usa base sem parcelas abertas
    const semAbertas = relatorioDoDia(montarBase([]), HOJE, "todas", HOJE);
    expect(semAbertas.linhas).toHaveLength(0);
    expect(semAbertas.indicadores.clientes).toBe(0);
    const pdf = await gerarPdfRelatorio(semAbertas);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(vazio.linhas.length).toBeGreaterThan(0);
  });

  it("pagina muitas linhas (cabeçalho só na 1ª página; totais na última)", async () => {
    const defs = Array.from({ length: 60 }, (_, i) => ({
      id: `c${i}`,
      nome: `Cliente Número ${String(i).padStart(2, "0")} com nome bem comprido para testar quebra`,
      indicadoPor: (i % 2 === 0 ? "geize" : "rosangela") as "geize" | "rosangela",
      emprestimos: [
        { id: `e${i}`, valorEmprestado: 900 + i * 10, numeroParcelas: 3, valorParcela: 400, primeiroVencimento: "2026-11-06", pagas: i % 4 === 0 ? 1 : 0 },
      ],
    }));
    const dados = relatorioDoDia(montarBase(defs), HOJE, "todas", HOJE);
    expect(dados.linhas).toHaveLength(60);

    const paginas = paginar(dados.linhas);
    expect(paginas[0]).toHaveLength(LINHAS_PRIMEIRA_PAGINA);
    expect(paginas.slice(1, -1).every((p) => p.length === LINHAS_DEMAIS_PAGINAS)).toBe(true);
    expect(paginas.at(-1)!.at(-1)!.tipo).toBe("total");
    expect(paginas.flat().filter((i) => i.tipo === "total")).toHaveLength(1);
    expect(paginas.flat().filter((i) => i.tipo === "linha")).toHaveLength(60);

    const pdf = await gerarPdfRelatorio(dados);
    expect(paginasDoPdf(pdf)).toBe(paginas.length);
    writeFileSync("tmp/relatorio-60-linhas.pdf", pdf);
  });

  it("nome do arquivo reflete tipo, referência e filtro", () => {
    expect(nomeArquivoPdf(relatorioDoDia(cenario(), HOJE, "todas", HOJE))).toBe("relatorio-dia-2026-11-06.pdf");
    expect(nomeArquivoPdf(relatorioDoMes(cenario(), "2026-11", HOJE, "dividas"))).toBe(
      "relatorio-mes-2026-11-somente-dividas.pdf",
    );
  });
});
