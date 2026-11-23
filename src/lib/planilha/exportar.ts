import ExcelJS from "exceljs";
import { telefoneValido } from "@/lib/domain/cobrancaPdf";
import { indexarBase } from "@/lib/domain/cobrancas";
import { NOME_INDICADOR } from "@/lib/domain/comissao";
import { quantidadeDeParcelas } from "@/lib/domain/emprestimo";
import { ROTULO_STATUS, saldoDevedor, statusCobranca, diasDeAtraso } from "@/lib/domain/status";
import type { Base } from "@/lib/domain/tipos";

/** "2026-11-06" → Date em UTC ao meio-dia (o Excel mostra o dia certo em qualquer fuso). */
function data(iso: string | null | undefined): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null;
}

const MOEDA = '"R$" #,##0.00';
const DATA = "dd/mm/yyyy";

function estilizar(aba: ExcelJS.Worksheet) {
  const cab = aba.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  cab.alignment = { vertical: "middle" };
  cab.height = 20;
  aba.views = [{ state: "frozen", ySplit: 1 }];
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.columnCount } };
}

/** Planilha com tudo do sistema: parcelas, empréstimos e clientes (backup / conferência). */
export async function gerarPlanilha(base: Base, hoje: string): Promise<Buffer> {
  const { clientePorId, emprestimoPorId, saldoPorCliente } = indexarBase(base);
  const wb = new ExcelJS.Workbook();
  wb.creator = "LPweb.dev";
  wb.created = new Date();

  /* ------------------------------- Parcelas ------------------------------- */
  const p = wb.addWorksheet("Parcelas");
  p.columns = [
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "Parcela", key: "parcela", width: 9 },
    { header: "Valor da parcela", key: "valor", width: 16, style: { numFmt: MOEDA } },
    { header: "Vencimento", key: "vencimento", width: 13, style: { numFmt: DATA } },
    { header: "Situação", key: "situacao", width: 12 },
    { header: "Dias de atraso", key: "atraso", width: 14 },
    { header: "Pago em", key: "pagoEm", width: 13, style: { numFmt: DATA } },
    { header: "Valor emprestado", key: "emprestado", width: 16, style: { numFmt: MOEDA } },
    { header: "Data do empréstimo", key: "dataEmprestimo", width: 18, style: { numFmt: DATA } },
    { header: "Indicação", key: "indicacao", width: 12 },
  ];
  const parcelas = base.parcelas
    .map((parcela) => {
      const e = emprestimoPorId.get(parcela.emprestimo_id);
      const c = e && clientePorId.get(e.cliente_id);
      return e && c ? { parcela, e, c } : null;
    })
    .filter((x) => x !== null)
    .sort(
      (a, b) =>
        a.c.nome.localeCompare(b.c.nome, "pt-BR") ||
        a.e.data_emprestimo.localeCompare(b.e.data_emprestimo) ||
        a.parcela.numero_parcela - b.parcela.numero_parcela,
    );
  for (const { parcela, e, c } of parcelas) {
    const status = statusCobranca(parcela, hoje);
    const linha = p.addRow({
      cliente: c.nome,
      parcela: `${parcela.numero_parcela}/${quantidadeDeParcelas(e.numero_parcelas)}`,
      valor: parcela.valor,
      vencimento: data(parcela.data_vencimento),
      situacao: ROTULO_STATUS[status],
      atraso: status === "atrasada" || status === "divida" ? diasDeAtraso(parcela.data_vencimento, hoje) : null,
      pagoEm: data(parcela.data_pagamento),
      emprestado: e.valor_emprestado,
      dataEmprestimo: data(e.data_emprestimo),
      indicacao: c.indicado_por ? NOME_INDICADOR[c.indicado_por] : "",
    });
    const cor =
      status === "divida" ? "FFB42318" : status === "atrasada" ? "FFB54708" : status === "paga" ? "FF1B7F5C" : null;
    if (cor) linha.getCell("situacao").font = { bold: true, color: { argb: cor } };
  }
  estilizar(p);

  /* ------------------------------ Empréstimos ------------------------------ */
  const em = wb.addWorksheet("Empréstimos");
  em.columns = [
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "Data do empréstimo", key: "data", width: 18, style: { numFmt: DATA } },
    { header: "Valor emprestado", key: "emprestado", width: 16, style: { numFmt: MOEDA } },
    { header: "Parcelas", key: "parcelas", width: 10 },
    { header: "Valor da parcela", key: "valorParcela", width: 16, style: { numFmt: MOEDA } },
    { header: "Total a pagar", key: "total", width: 15, style: { numFmt: MOEDA } },
    { header: "Já pago", key: "pago", width: 14, style: { numFmt: MOEDA } },
    { header: "Falta pagar", key: "falta", width: 14, style: { numFmt: MOEDA } },
    { header: "Parcelas que faltam", key: "faltam", width: 18 },
    { header: "Comissão (Geize)", key: "comissao", width: 16, style: { numFmt: MOEDA } },
  ];
  const parcelasPorEmp = new Map<string, Base["parcelas"]>();
  for (const x of base.parcelas) parcelasPorEmp.set(x.emprestimo_id, [...(parcelasPorEmp.get(x.emprestimo_id) ?? []), x]);
  const emprestimos = base.emprestimos
    .map((e) => ({ e, c: clientePorId.get(e.cliente_id) }))
    .filter((x) => x.c)
    .sort((a, b) => a.c!.nome.localeCompare(b.c!.nome, "pt-BR") || a.e.data_emprestimo.localeCompare(b.e.data_emprestimo));
  for (const { e, c } of emprestimos) {
    const ps = parcelasPorEmp.get(e.id) ?? [];
    const falta = saldoDevedor(ps);
    em.addRow({
      cliente: c!.nome,
      data: data(e.data_emprestimo),
      emprestado: e.valor_emprestado,
      parcelas: quantidadeDeParcelas(e.numero_parcelas),
      valorParcela: e.valor_parcela,
      total: e.total_a_pagar,
      pago: Math.round((e.total_a_pagar - falta) * 100) / 100,
      falta,
      faltam: ps.filter((x) => x.status_pagamento === "aberta").length,
      comissao: e.comissao || null,
    });
  }
  estilizar(em);

  /* -------------------------------- Clientes -------------------------------- */
  const cl = wb.addWorksheet("Clientes");
  cl.columns = [
    { header: "Nome", key: "nome", width: 30 },
    { header: "Telefone", key: "telefone", width: 18 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Endereço", key: "endereco", width: 35 },
    { header: "Indicado por", key: "indicacao", width: 13 },
    { header: "Deve no total", key: "saldo", width: 15, style: { numFmt: MOEDA } },
    { header: "Arquivado", key: "arquivado", width: 11 },
    { header: "Observações", key: "obs", width: 40 },
  ];
  for (const c of [...base.clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    cl.addRow({
      nome: c.nome,
      telefone: telefoneValido(c.telefone) ? c.telefone : "",
      cpf: c.cpf ?? "",
      endereco: c.endereco ?? "",
      indicacao: c.indicado_por ? NOME_INDICADOR[c.indicado_por] : "",
      saldo: saldoPorCliente.get(c.id) ?? 0,
      arquivado: c.arquivado ? "Sim" : "",
      obs: c.observacoes ?? "",
    });
  }
  estilizar(cl);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
