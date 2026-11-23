import { type FiltroCobranca, type ItemCobranca, visaoDia, visaoMes, visaoSemana } from "./cobrancas";
import { NOME_INDICADOR } from "./comissao";
import { formatarData, formatarMes, formatarSemana, limitesDaSemana } from "./datas";
import { somar } from "./dinheiro";
import { quantidadeDeParcelas } from "./emprestimo";
import type { Base, IndicadoPor, StatusCobranca } from "./tipos";

/** Filtro por quem indicou o cliente (para mandar a lista certa a cada parceira). */
export type FiltroIndicacao = "todos" | IndicadoPor | "nenhum";

export function lerFiltroIndicacao(valor: string | null | undefined): FiltroIndicacao {
  return valor === "geize" || valor === "rosangela" || valor === "nenhum" ? valor : "todos";
}

export const ROTULO_INDICACAO: Record<FiltroIndicacao, string> = {
  todos: "Todos os clientes",
  geize: "Clientes da Geize",
  rosangela: "Clientes da Rosangela",
  nenhum: "Clientes sem indicação",
};

function passaIndicacao(i: ItemCobranca, f: FiltroIndicacao): boolean {
  if (f === "todos") return true;
  if (f === "nenhum") return i.cliente.indicado_por === null;
  return i.cliente.indicado_por === f;
}

/** Uma linha do PDF de cobrança = uma parcela. */
export interface LinhaCobranca {
  parcelaId: string;
  cliente: string;
  /** "2/4" ou "única" */
  parcela: string;
  valor: number;
  vencimento: string;
  status: StatusCobranca;
  /** Texto pronto: "Atrasada há 12 dias", "Vence hoje", "Pago em 05/11/2026"… */
  situacao: string;
  /** Saldo total que o cliente ainda deve (todas as parcelas abertas). */
  saldoCliente: number;
  indicacao: string;
}

export interface GrupoCobranca {
  status: StatusCobranca;
  titulo: string;
  linhas: LinhaCobranca[];
  total: number;
}

export type TipoVisao = "dia" | "semana" | "mes";

export interface DadosCobranca {
  tipo: TipoVisao;
  referencia: string;
  periodo: string;
  geradoEm: string;
  filtro: FiltroCobranca;
  indicacao: FiltroIndicacao;
  grupos: GrupoCobranca[];
  resumo: {
    /** atrasadas + dívidas */
    devendo: number;
    aVencer: number;
    recebido: number;
    pessoasDevendo: number;
    pessoasEmDia: number;
  };
}

const TITULO_GRUPO: Record<StatusCobranca, string> = {
  divida: "DÍVIDAS — MAIS DE 30 DIAS DE ATRASO",
  atrasada: "ATRASADOS — ATÉ 30 DIAS",
  em_aberto: "A VENCER",
  paga: "JÁ PAGARAM",
};

const ORDEM: StatusCobranca[] = ["divida", "atrasada", "em_aberto", "paga"];

function textoSituacao(i: ItemCobranca, ref: string): string {
  const s = i.status;
  if (s === "paga") {
    return i.parcela.data_pagamento
      ? `Pago em ${formatarData(i.parcela.data_pagamento)}`
      : "Pago";
  }
  if (s === "em_aberto") {
    return i.parcela.data_vencimento === ref ? "Vence hoje" : "A vencer";
  }
  const d = i.diasAtraso;
  return `Atrasada há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function paraLinha(i: ItemCobranca, ref: string): LinhaCobranca {
  const total = quantidadeDeParcelas(i.emprestimo.numero_parcelas);
  return {
    parcelaId: i.parcela.id,
    cliente: i.cliente.nome,
    parcela: total === 1 ? "única" : `${i.parcela.numero_parcela}/${total}`,
    valor: i.parcela.valor,
    vencimento: i.parcela.data_vencimento,
    status: i.status,
    situacao: textoSituacao(i, ref),
    saldoCliente: i.totalDevidoCliente,
    indicacao: i.cliente.indicado_por ? NOME_INDICADOR[i.cliente.indicado_por] : "—",
  };
}

function montar(
  tipo: TipoVisao,
  referencia: string,
  periodo: string,
  geradoEm: string,
  ref: string,
  filtro: FiltroCobranca,
  indicacao: FiltroIndicacao,
  itensBrutos: readonly ItemCobranca[],
): DadosCobranca {
  const itens = itensBrutos.filter((i) => passaIndicacao(i, indicacao));

  const grupos: GrupoCobranca[] = ORDEM.map((status) => {
    const doGrupo = itens
      .filter((i) => i.status === status)
      .sort((a, b) =>
        status === "paga" || status === "em_aberto"
          ? a.parcela.data_vencimento.localeCompare(b.parcela.data_vencimento) ||
            a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR")
          : b.diasAtraso - a.diasAtraso ||
            a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"),
      );
    const linhas = doGrupo.map((i) => paraLinha(i, ref));
    return { status, titulo: TITULO_GRUPO[status], linhas, total: somar(linhas.map((l) => l.valor)) };
  }).filter((g) => g.linhas.length > 0);

  const total = (s: StatusCobranca) => grupos.find((g) => g.status === s)?.total ?? 0;
  const devedores = new Set(
    itens.filter((i) => i.status === "atrasada" || i.status === "divida").map((i) => i.cliente.id),
  );
  const todos = new Set(itens.map((i) => i.cliente.id));

  return {
    tipo,
    referencia,
    periodo,
    geradoEm,
    filtro,
    indicacao,
    grupos,
    resumo: {
      devendo: somar([total("divida"), total("atrasada")]),
      aVencer: total("em_aberto"),
      recebido: total("paga"),
      pessoasDevendo: devedores.size,
      pessoasEmDia: [...todos].filter((id) => !devedores.has(id)).length,
    },
  };
}

export function cobrancaDoDia(
  base: Base,
  data: string,
  filtro: FiltroCobranca,
  indicacao: FiltroIndicacao,
  geradoEm: string,
): DadosCobranca {
  const v = visaoDia(base, data, filtro);
  return montar("dia", data, formatarData(data), geradoEm, data, filtro, indicacao, v.itens);
}

export function cobrancaDoMes(
  base: Base,
  mes: string,
  hoje: string,
  filtro: FiltroCobranca,
  indicacao: FiltroIndicacao,
): DadosCobranca {
  const v = visaoMes(base, mes, hoje, filtro);
  const itens = [...v.anteriores, ...v.dias.flatMap((d) => d.itens)];
  return montar("mes", mes, formatarMes(mes), hoje, hoje, filtro, indicacao, itens);
}

export function cobrancaDaSemana(
  base: Base,
  data: string,
  hoje: string,
  filtro: FiltroCobranca,
  indicacao: FiltroIndicacao,
): DadosCobranca {
  const v = visaoSemana(base, data, hoje, filtro);
  const itens = [...v.anteriores, ...v.dias.flatMap((d) => d.itens)];
  const { inicio, fim } = limitesDaSemana(data);
  return montar("semana", inicio, formatarSemana(inicio, fim), hoje, hoje, filtro, indicacao, itens);
}

export function nomeArquivoCobranca(d: DadosCobranca): string {
  const partes = [`cobranca-${d.tipo}-${d.referencia}`];
  if (d.indicacao !== "todos") partes.push(d.indicacao === "nenhum" ? "sem-indicacao" : d.indicacao);
  if (d.filtro !== "todas") partes.push(`somente-${d.filtro}`);
  return `${partes.join("-")}.pdf`;
}

/** Telefone "de verdade": tem ao menos 8 dígitos e não é só zeros (ex.: 00000000). */
export function telefoneValido(telefone: string | null | undefined): boolean {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  return digitos.length >= 8 && !/^0+$/.test(digitos);
}

/** Mantém só os clientes (e seus empréstimos/parcelas) da indicação escolhida. */
export function filtrarBasePorIndicacao(base: Base, f: FiltroIndicacao): Base {
  if (f === "todos") return base;
  const clientes = base.clientes.filter((c) =>
    f === "nenhum" ? c.indicado_por === null : c.indicado_por === f,
  );
  const ids = new Set(clientes.map((c) => c.id));
  const emprestimos = base.emprestimos.filter((e) => ids.has(e.cliente_id));
  const idsEmp = new Set(emprestimos.map((e) => e.id));
  return { clientes, emprestimos, parcelas: base.parcelas.filter((p) => idsEmp.has(p.emprestimo_id)) };
}
