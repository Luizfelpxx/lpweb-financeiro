import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularEmprestimo } from "@/lib/domain/emprestimo";
import type { Base, Cliente, Emprestimo, IndicadoPor, Parcela } from "@/lib/domain/tipos";

/** Supabase falso: responde ao que carregarBase/carregarConfiguracoes consultam. */
export function supabaseFalso(
  base: Base,
  config: { telegram_chat_id: string | null; hora_relatorio: string } = {
    telegram_chat_id: null,
    hora_relatorio: "08:00:00",
  },
): SupabaseClient {
  const tabelas: Record<string, unknown[]> = {
    clientes: base.clientes,
    emprestimos: base.emprestimos,
    parcelas: base.parcelas,
  };
  return {
    from(nome: string) {
      const q = {
        select: () => q,
        order: () => q,
        eq: () => q,
        range: (de: number, ate: number) =>
          Promise.resolve({ data: (tabelas[nome] ?? []).slice(de, ate + 1), error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: nome === "configuracoes" ? config : null, error: null }),
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

interface DefEmprestimo {
  id: string;
  valorEmprestado: number;
  numeroParcelas: number;
  valorParcela: number;
  primeiroVencimento: string;
  /** quantas parcelas (em ordem) já estão pagas */
  pagas?: number;
  dataEmprestimo?: string;
}

interface DefCliente {
  id: string;
  nome: string;
  telefone?: string;
  indicadoPor?: IndicadoPor | null;
  emprestimos: DefEmprestimo[];
}

/** Monta uma Base em memória usando as mesmas regras de cálculo do sistema. */
export function montarBase(defs: DefCliente[]): Base {
  const base: Base = { clientes: [], emprestimos: [], parcelas: [] };
  for (const d of defs) {
    const cliente: Cliente = {
      id: d.id,
      nome: d.nome,
      telefone: d.telefone ?? "(11) 90000-0000",
      cpf: null,
      endereco: null,
      observacoes: null,
      indicado_por: d.indicadoPor ?? null,
      arquivado: false,
      criado_em: "2026-01-01T00:00:00Z",
      atualizado_em: "2026-01-01T00:00:00Z",
    };
    base.clientes.push(cliente);
    for (const e of d.emprestimos) {
      const calc = calcularEmprestimo({
        valorEmprestado: e.valorEmprestado,
        numeroParcelas: e.numeroParcelas,
        valorParcela: e.valorParcela,
        primeiroVencimento: e.primeiroVencimento,
        indicadoPor: cliente.indicado_por,
      });
      const emprestimo: Emprestimo = {
        id: e.id,
        cliente_id: cliente.id,
        valor_emprestado: calc.valorEmprestado,
        numero_parcelas: calc.numeroParcelas,
        valor_parcela: calc.valorParcela,
        total_a_pagar: calc.totalAPagar,
        primeiro_vencimento: e.primeiroVencimento,
        taxa_juros_percentual: calc.taxaJurosPercentual,
        comissao: calc.comissao,
        data_emprestimo: e.dataEmprestimo ?? "2026-10-01",
        criado_em: "2026-10-01T00:00:00Z",
        atualizado_em: "2026-10-01T00:00:00Z",
      };
      base.emprestimos.push(emprestimo);
      calc.parcelas.forEach((p, i) => {
        const paga = i < (e.pagas ?? 0);
        const parcela: Parcela = {
          id: `${e.id}-p${p.numero_parcela}`,
          emprestimo_id: e.id,
          numero_parcela: p.numero_parcela,
          valor: p.valor,
          data_vencimento: p.data_vencimento,
          status_pagamento: paga ? "paga" : "aberta",
          data_pagamento: paga ? p.data_vencimento : null,
        };
        base.parcelas.push(parcela);
      });
    }
  }
  return base;
}
