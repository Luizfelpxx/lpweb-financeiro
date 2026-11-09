import { limitesDoMes } from "./datas";
import { emCentavos, somar } from "./dinheiro";
import { diasDeAtraso, statusCobranca } from "./status";
import type { Base, Cliente, Emprestimo, Parcela, StatusCobranca } from "./tipos";

export type FiltroCobranca = "todas" | "atrasadas" | "dividas";

export const ROTULO_FILTRO: Record<FiltroCobranca, string> = {
  todas: "Todas as cobranças",
  atrasadas: "Somente atrasadas",
  dividas: "Somente dívidas",
};

export function lerFiltro(valor: string | null | undefined): FiltroCobranca {
  return valor === "atrasadas" || valor === "dividas" ? valor : "todas";
}

export interface ItemCobranca {
  parcela: Parcela;
  emprestimo: Emprestimo;
  cliente: Cliente;
  status: StatusCobranca;
  diasAtraso: number;
  /** Saldo devedor total do cliente (todas as parcelas abertas de todos os empréstimos). */
  totalDevidoCliente: number;
}

export interface Contagem {
  qtd: number;
  valor: number;
}

export interface IndicesDaBase {
  clientePorId: Map<string, Cliente>;
  emprestimoPorId: Map<string, Emprestimo>;
  saldoPorCliente: Map<string, number>;
}

export function indexarBase(base: Base): IndicesDaBase {
  const clientePorId = new Map(base.clientes.map((c) => [c.id, c]));
  const emprestimoPorId = new Map(base.emprestimos.map((e) => [e.id, e]));
  const centavos = new Map<string, number>();
  for (const p of base.parcelas) {
    if (p.status_pagamento !== "aberta") continue;
    const e = emprestimoPorId.get(p.emprestimo_id);
    if (!e) continue;
    centavos.set(e.cliente_id, (centavos.get(e.cliente_id) ?? 0) + emCentavos(p.valor));
  }
  const saldoPorCliente = new Map(
    [...centavos].map(([id, c]) => [id, c / 100] as const),
  );
  return { clientePorId, emprestimoPorId, saldoPorCliente };
}

function passaFiltro(status: StatusCobranca, filtro: FiltroCobranca): boolean {
  if (filtro === "atrasadas") return status === "atrasada";
  if (filtro === "dividas") return status === "divida";
  return true;
}

const PESO_STATUS: Record<StatusCobranca, number> = {
  divida: 0,
  atrasada: 1,
  em_aberto: 2,
  paga: 3,
};

function ordenar(a: ItemCobranca, b: ItemCobranca): number {
  return (
    PESO_STATUS[a.status] - PESO_STATUS[b.status] ||
    b.diasAtraso - a.diasAtraso ||
    a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR") ||
    a.parcela.data_vencimento.localeCompare(b.parcela.data_vencimento)
  );
}

function montarItens(
  base: Base,
  ref: string,
  selecionar: (p: Parcela) => boolean,
): ItemCobranca[] {
  const { clientePorId, emprestimoPorId, saldoPorCliente } = indexarBase(base);
  const itens: ItemCobranca[] = [];
  for (const parcela of base.parcelas) {
    if (!selecionar(parcela)) continue;
    const emprestimo = emprestimoPorId.get(parcela.emprestimo_id);
    const cliente = emprestimo && clientePorId.get(emprestimo.cliente_id);
    if (!emprestimo || !cliente) continue;
    itens.push({
      parcela,
      emprestimo,
      cliente,
      status: statusCobranca(parcela, ref),
      diasAtraso: diasDeAtraso(parcela.data_vencimento, ref),
      totalDevidoCliente: saldoPorCliente.get(cliente.id) ?? 0,
    });
  }
  return itens;
}

export function contar(itens: readonly ItemCobranca[], status: StatusCobranca): Contagem {
  const sel = itens.filter((i) => i.status === status);
  return { qtd: sel.length, valor: somar(sel.map((i) => i.parcela.valor)) };
}

/* ------------------------------ Visão do DIA ------------------------------ */

export interface VisaoDia {
  data: string;
  filtro: FiltroCobranca;
  itens: ItemCobranca[];
  resumo: {
    vencendo: Contagem;
    atrasadas: Contagem;
    dividas: Contagem;
    recebido: Contagem;
    /** vencendo + atrasadas + dívidas (somente parcelas abertas). */
    totalACobrar: number;
  };
}

/**
 * Parcelas que vencem em `data` (pagas ou não) + as abertas que venceram antes
 * (atrasadas e dívidas até a data). O status é calculado em relação a `data`
 * (por padrão, hoje).
 */
export function visaoDia(
  base: Base,
  data: string,
  filtro: FiltroCobranca = "todas",
): VisaoDia {
  const itens = montarItens(
    base,
    data,
    (p) =>
      p.data_vencimento === data ||
      (p.status_pagamento === "aberta" && p.data_vencimento < data),
  )
    .filter((i) => passaFiltro(i.status, filtro))
    .sort(ordenar);

  const vencendo = contar(itens, "em_aberto");
  const atrasadas = contar(itens, "atrasada");
  const dividas = contar(itens, "divida");
  return {
    data,
    filtro,
    itens,
    resumo: {
      vencendo,
      atrasadas,
      dividas,
      recebido: contar(itens, "paga"),
      totalACobrar: somar([vencendo.valor, atrasadas.valor, dividas.valor]),
    },
  };
}

/* ------------------------------ Visão do MÊS ------------------------------ */

export interface DiaDoMes {
  data: string;
  itens: ItemCobranca[];
  previsto: number;
  recebido: number;
}

export interface VisaoMes {
  mes: string;
  filtro: FiltroCobranca;
  dias: DiaDoMes[];
  /** Abertas de meses anteriores que seguem atrasadas ou em dívida. */
  anteriores: ItemCobranca[];
  totais: {
    previsto: number;
    recebido: number;
    aReceber: number;
    atrasadas: Contagem;
    dividas: Contagem;
  };
}

/** Status calculado em relação a `hoje`; agrupa por dia de vencimento. */
export function visaoMes(
  base: Base,
  mes: string,
  hoje: string,
  filtro: FiltroCobranca = "todas",
): VisaoMes {
  const { inicio, fim } = limitesDoMes(mes);
  const doMes = montarItens(
    base,
    hoje,
    (p) => p.data_vencimento >= inicio && p.data_vencimento <= fim,
  ).filter((i) => passaFiltro(i.status, filtro));
  const anteriores = montarItens(
    base,
    hoje,
    (p) => p.status_pagamento === "aberta" && p.data_vencimento < inicio,
  )
    .filter((i) => i.status === "atrasada" || i.status === "divida")
    .filter((i) => passaFiltro(i.status, filtro))
    .sort(ordenar);

  const porDia = new Map<string, ItemCobranca[]>();
  for (const item of doMes) {
    const lista = porDia.get(item.parcela.data_vencimento) ?? [];
    lista.push(item);
    porDia.set(item.parcela.data_vencimento, lista);
  }
  const dias: DiaDoMes[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, itens]) => ({
      data,
      itens: itens.sort(ordenar),
      previsto: somar(itens.map((i) => i.parcela.valor)),
      recebido: somar(
        itens.filter((i) => i.status === "paga").map((i) => i.parcela.valor),
      ),
    }));

  const previsto = somar(dias.map((d) => d.previsto));
  const recebido = somar(dias.map((d) => d.recebido));
  const todos = [...doMes, ...anteriores];
  return {
    mes,
    filtro,
    dias,
    anteriores,
    totais: {
      previsto,
      recebido,
      aReceber: somar([previsto, -recebido]),
      atrasadas: contar(todos, "atrasada"),
      dividas: contar(todos, "divida"),
    },
  };
}
