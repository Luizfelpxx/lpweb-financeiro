import {
  type FiltroCobranca,
  type ItemCobranca,
  visaoDia,
  visaoMes,
} from "./cobrancas";
import { formatarData, formatarMes } from "./datas";
import { somar } from "./dinheiro";
import { rotuloParcelas } from "./emprestimo";
import { saldoDevedor, totalPago } from "./status";
import type { Base, IndicadoPor } from "./tipos";

export type Quitacao = "pago" | "parcial" | "nao_pago";

/** Uma linha da tabela "DETALHAMENTO DOS CLIENTES" (uma por empréstimo). */
export interface LinhaRelatorio {
  clienteId: string;
  cliente: string;
  emprestimoId: string;
  /** valor emprestado ("pegou X") */
  pegou: number;
  numeroParcelas: number;
  rotuloParcelas: string;
  valorParcela: number;
  quitacao: Quitacao;
  parcelasPagas: number;
  parcelasTotal: number;
  telefone: string;
  /** total do empréstimo com juros (soma das parcelas) */
  totalAPagar: number;
  saldoDevedor: number;
  totalPago: number;
  /** vencimento da próxima parcela em aberto */
  proximoVencimento: string | null;
  comissao: number;
  indicadoPor: IndicadoPor | null;
  observacao: string;
}

export interface Indicadores {
  clientes: number;
  valorTotalRegistrado: number;
  valorAPagar: number;
  valorPagoRegistrado: number;
  comissoes: number;
  /** Σ da coluna "VALOR A PAGAR" da tabela (= valorAPagar + valorPagoRegistrado). */
  totalAPagarEmprestimos: number;
}

export interface DadosRelatorio {
  tipo: "dia" | "mes";
  /** "2026-11-06" ou "2026-11" (usado no nome do arquivo) */
  referencia: string;
  /** "06/11/2026" ou "novembro de 2026" */
  periodo: string;
  geradoEm: string;
  filtro: FiltroCobranca;
  linhas: LinhaRelatorio[];
  indicadores: Indicadores;
}

export function linhasPorEmprestimo(
  base: Base,
  itens: readonly ItemCobranca[],
): LinhaRelatorio[] {
  const emprestimos = new Map(itens.map((i) => [i.emprestimo.id, i]));
  const parcelasDoEmprestimo = new Map<string, Base["parcelas"]>();
  for (const p of base.parcelas) {
    if (!emprestimos.has(p.emprestimo_id)) continue;
    const lista = parcelasDoEmprestimo.get(p.emprestimo_id) ?? [];
    lista.push(p);
    parcelasDoEmprestimo.set(p.emprestimo_id, lista);
  }

  const linhas = [...emprestimos.values()].map(({ emprestimo, cliente }) => {
    const parcelas = parcelasDoEmprestimo.get(emprestimo.id) ?? [];
    const abertas = parcelas.filter((p) => p.status_pagamento === "aberta");
    const pagas = parcelas.length - abertas.length;
    const proximo = abertas.map((p) => p.data_vencimento).sort()[0] ?? null;
    const quitacao: Quitacao =
      pagas === 0 ? "nao_pago" : abertas.length === 0 ? "pago" : "parcial";
    return {
      clienteId: cliente.id,
      cliente: cliente.nome,
      emprestimoId: emprestimo.id,
      pegou: emprestimo.valor_emprestado,
      numeroParcelas: emprestimo.numero_parcelas,
      rotuloParcelas: rotuloParcelas(emprestimo.numero_parcelas),
      valorParcela: emprestimo.valor_parcela,
      quitacao,
      parcelasPagas: pagas,
      parcelasTotal: parcelas.length,
      telefone: cliente.telefone,
      totalAPagar: emprestimo.total_a_pagar,
      saldoDevedor: saldoDevedor(parcelas),
      totalPago: totalPago(parcelas),
      proximoVencimento: proximo,
      comissao: emprestimo.comissao,
      indicadoPor: cliente.indicado_por,
      observacao: cliente.indicado_por ? `cliente ${cliente.indicado_por}` : "",
    } satisfies LinhaRelatorio;
  });

  return linhas.sort(
    (a, b) =>
      a.cliente.localeCompare(b.cliente, "pt-BR") ||
      (a.proximoVencimento ?? "").localeCompare(b.proximoVencimento ?? ""),
  );
}

/**
 * Indicadores SEMPRE calculados pela soma das linhas da tabela — é a correção
 * do erro do modelo antigo (totais do cabeçalho divergindo da tabela).
 */
export function calcularIndicadores(linhas: readonly LinhaRelatorio[]): Indicadores {
  return {
    clientes: new Set(linhas.map((l) => l.clienteId)).size,
    valorTotalRegistrado: somar(linhas.map((l) => l.pegou)),
    valorAPagar: somar(linhas.map((l) => l.saldoDevedor)),
    valorPagoRegistrado: somar(linhas.map((l) => l.totalPago)),
    comissoes: somar(linhas.map((l) => l.comissao)),
    totalAPagarEmprestimos: somar(linhas.map((l) => l.totalAPagar)),
  };
}

function montar(
  tipo: "dia" | "mes",
  referencia: string,
  periodo: string,
  geradoEm: string,
  filtro: FiltroCobranca,
  base: Base,
  itens: readonly ItemCobranca[],
): DadosRelatorio {
  const linhas = linhasPorEmprestimo(base, itens);
  return {
    tipo,
    referencia,
    periodo,
    geradoEm,
    filtro,
    linhas,
    indicadores: calcularIndicadores(linhas),
  };
}

export function relatorioDoDia(
  base: Base,
  data: string,
  filtro: FiltroCobranca,
  geradoEm: string,
): DadosRelatorio {
  const visao = visaoDia(base, data, filtro);
  return montar("dia", data, formatarData(data), geradoEm, filtro, base, visao.itens);
}

export function relatorioDoMes(
  base: Base,
  mes: string,
  hoje: string,
  filtro: FiltroCobranca,
): DadosRelatorio {
  const visao = visaoMes(base, mes, hoje, filtro);
  const itens = [...visao.dias.flatMap((d) => d.itens), ...visao.anteriores];
  return montar("mes", mes, formatarMes(mes), hoje, filtro, base, itens);
}

export function nomeArquivoPdf(dados: DadosRelatorio): string {
  const sufixo = dados.filtro === "todas" ? "" : `-somente-${dados.filtro}`;
  return `relatorio-${dados.tipo}-${dados.referencia}${sufixo}.pdf`;
}
