"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { calcularComissao, validarComissaoManual } from "@/lib/domain/comissao";
import { hojeSP } from "@/lib/domain/datas";
import {
  calcularEmprestimo,
  validarEmprestimo,
} from "@/lib/domain/emprestimo";
import { lerValorBR } from "@/lib/domain/dinheiro";
import { lerData } from "@/lib/domain/datas";
import { lerIndicadoPor, validarCliente } from "@/lib/validacao";

export interface EstadoForm {
  erro?: string;
  /** valores digitados, devolvidos quando há erro (o React limpa campos não controlados após o envio) */
  valores?: Record<string, string>;
}
export interface ResultadoAcao {
  erro?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRO_GENERICO = "Não foi possível concluir a operação. Tente novamente.";

function textos(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

/* ------------------------------- Clientes ------------------------------- */

export async function salvarCliente(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirUsuario();
  const id = String(formData.get("id") ?? "");
  const { dados, erros } = validarCliente(Object.fromEntries(formData));
  const valores = textos(formData);
  if (erros.length) return { erro: erros.join(" "), valores };

  if (id) {
    if (!UUID.test(id)) return { erro: "Cliente inválido.", valores };
    const { data: atual } = await supabase
      .from("clientes")
      .select("indicado_por")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase.from("clientes").update(dados).eq("id", id);
    if (error) {
      console.error("[salvarCliente]", error.message);
      return { erro: ERRO_GENERICO, valores };
    }
    // A comissão depende de quem indicou: se mudou, recalcula os empréstimos do cliente.
    if (atual && lerIndicadoPor(atual.indicado_por) !== dados.indicado_por) {
      const { data: emprestimos } = await supabase
        .from("emprestimos")
        .select("id, valor_emprestado")
        .eq("cliente_id", id);
      for (const e of emprestimos ?? []) {
        await supabase
          .from("emprestimos")
          .update({ comissao: calcularComissao(Number(e.valor_emprestado), dados.indicado_por) })
          .eq("id", e.id);
      }
    }
    revalidatePath("/", "layout");
    redirect(`/clientes/${id}`);
  }

  const { data, error } = await supabase.from("clientes").insert(dados).select("id").single();
  if (error || !data) {
    console.error("[salvarCliente]", error?.message);
    return { erro: ERRO_GENERICO, valores };
  }
  revalidatePath("/", "layout");
  redirect(`/clientes/${data.id}`);
}

export async function arquivarCliente(id: string, arquivar: boolean): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(id)) return { erro: "Cliente inválido." };
  const { error } = await supabase.from("clientes").update({ arquivado: arquivar }).eq("id", id);
  if (error) {
    console.error("[arquivarCliente]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function excluirCliente(id: string): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(id)) return { erro: "Cliente inválido." };

  const { data: emprestimos, error: erroBusca } = await supabase
    .from("emprestimos")
    .select("id")
    .eq("cliente_id", id);
  if (erroBusca) return { erro: ERRO_GENERICO };
  if ((emprestimos ?? []).length > 0) {
    return {
      erro: "Este cliente possui empréstimos e não pode ser excluído. Use “Arquivar”.",
    };
  }
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) {
    console.error("[excluirCliente]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  redirect("/clientes");
}

/* ------------------------------ Empréstimos ------------------------------ */

export async function criarEmprestimo(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirUsuario();
  const clienteId = String(formData.get("cliente_id") ?? "");
  if (!UUID.test(clienteId)) return { erro: "Cliente inválido." };

  const valorEmprestado = lerValorBR(String(formData.get("valor_emprestado") ?? ""));
  const valorParcela = lerValorBR(String(formData.get("valor_parcela") ?? ""));
  const numeroParcelas = Number(formData.get("numero_parcelas"));
  const primeiroVencimento = lerData(String(formData.get("primeiro_vencimento") ?? ""));
  const dataEmprestimo = lerData(String(formData.get("data_emprestimo") ?? "")) ?? hojeSP();

  const erros = validarEmprestimo({
    valorEmprestado,
    numeroParcelas: Number.isFinite(numeroParcelas) ? numeroParcelas : null,
    valorParcela,
    primeiroVencimento,
  });
  if (erros.length) return { erro: erros.join(" ") };

  const { data: cliente, error: erroCliente } = await supabase
    .from("clientes")
    .select("id, indicado_por")
    .eq("id", clienteId)
    .maybeSingle();
  if (erroCliente || !cliente) return { erro: "Cliente não encontrado." };

  // Todos os cálculos (total, taxa, comissão, parcelas) são feitos aqui no servidor.
  const calc = calcularEmprestimo({
    valorEmprestado: valorEmprestado!,
    numeroParcelas,
    valorParcela: valorParcela!,
    primeiroVencimento: primeiroVencimento!,
    indicadoPor: lerIndicadoPor(cliente.indicado_por),
  });

  const { error } = await supabase.rpc("criar_emprestimo", {
    p_emprestimo: {
      cliente_id: clienteId,
      valor_emprestado: calc.valorEmprestado,
      numero_parcelas: calc.numeroParcelas,
      valor_parcela: calc.valorParcela,
      total_a_pagar: calc.totalAPagar,
      primeiro_vencimento: primeiroVencimento,
      taxa_juros_percentual: calc.taxaJurosPercentual,
      comissao: calc.comissao,
      data_emprestimo: dataEmprestimo,
    },
    p_parcelas: calc.parcelas,
  });
  if (error) {
    console.error("[criarEmprestimo]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}`);
}

export async function excluirEmprestimo(id: string): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(id)) return { erro: "Empréstimo inválido." };
  const { count, error: erroCount } = await supabase
    .from("parcelas")
    .select("id", { count: "exact", head: true })
    .eq("emprestimo_id", id)
    .eq("status_pagamento", "paga");
  if (erroCount) return { erro: ERRO_GENERICO };
  if ((count ?? 0) > 0) {
    return { erro: "Este empréstimo tem parcelas pagas e não pode ser excluído." };
  }
  const { error } = await supabase.from("emprestimos").delete().eq("id", id);
  if (error) {
    console.error("[excluirEmprestimo]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  return {};
}

/* -------------------------------- Parcelas -------------------------------- */

/** Marca/desmarca uma parcela. Ao marcar, grava a data de hoje (Brasília). */
export async function alternarPagamento(
  parcelaId: string,
  paga: boolean,
): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(parcelaId)) return { erro: "Parcela inválida." };
  const { error } = await supabase
    .from("parcelas")
    .update({
      status_pagamento: paga ? "paga" : "aberta",
      data_pagamento: paga ? hojeSP() : null,
    })
    // só altera se estiver no estado oposto (clique duplo não duplica o histórico)
    .eq("id", parcelaId)
    .eq("status_pagamento", paga ? "aberta" : "paga");
  if (error) {
    console.error("[alternarPagamento]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  return {};
}

/** Data de pagamento válida: formato certo, não no futuro e não absurda. */
function validarDataPagamento(data: string): string | null {
  const iso = lerData(data);
  if (!iso) return "Data de pagamento inválida.";
  if (iso > hojeSP()) return "A data de pagamento não pode ser no futuro.";
  if (iso < "2000-01-01") return "Data de pagamento inválida.";
  return null;
}

/** Marca a parcela como paga na data informada (o dia em que a pessoa pagou de verdade). */
export async function marcarPagaEm(parcelaId: string, data: string): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(parcelaId)) return { erro: "Parcela inválida." };
  const erro = validarDataPagamento(data);
  if (erro) return { erro };
  const { error } = await supabase
    .from("parcelas")
    .update({ status_pagamento: "paga", data_pagamento: lerData(data) })
    .eq("id", parcelaId)
    .eq("status_pagamento", "aberta");
  if (error) {
    console.error("[marcarPagaEm]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  return {};
}

/** Corrige a data de pagamento de uma parcela que já está paga. */
export async function alterarDataPagamento(parcelaId: string, data: string): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(parcelaId)) return { erro: "Parcela inválida." };
  const erro = validarDataPagamento(data);
  if (erro) return { erro };
  const { error } = await supabase
    .from("parcelas")
    .update({ data_pagamento: lerData(data) })
    .eq("id", parcelaId)
    .eq("status_pagamento", "paga");
  if (error) {
    console.error("[alterarDataPagamento]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  return {};
}

/* ------------------------------- Comissões ------------------------------- */

/**
 * Define a comissão de um empréstimo de cliente da Geize.
 * `valor` = texto digitado (ex.: "50,00"); `null` = voltar ao cálculo automático.
 * Só altera o campo `comissao` do empréstimo (fica registrado no Histórico).
 */
export async function definirComissao(emprestimoId: string, valor: string | null): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  if (!UUID.test(emprestimoId)) return { erro: "Empréstimo inválido." };

  const { data: emp, error: erroBusca } = await supabase
    .from("emprestimos")
    .select("id, valor_emprestado, cliente_id")
    .eq("id", emprestimoId)
    .maybeSingle();
  if (erroBusca || !emp) return { erro: "Empréstimo não encontrado." };

  const { data: cliente } = await supabase
    .from("clientes")
    .select("indicado_por")
    .eq("id", emp.cliente_id)
    .maybeSingle();
  const indicadoPor = lerIndicadoPor(cliente?.indicado_por);
  if (indicadoPor !== "geize") return { erro: "Só clientes indicados pela Geize têm comissão." };

  const valorEmprestado = Number(emp.valor_emprestado);
  let comissao: number;
  if (valor === null) {
    comissao = calcularComissao(valorEmprestado, indicadoPor);
  } else {
    const r = validarComissaoManual(lerValorBR(valor), valorEmprestado);
    if (!r.ok) return { erro: r.erro };
    comissao = r.valor;
  }

  const { error } = await supabase.from("emprestimos").update({ comissao }).eq("id", emprestimoId);
  if (error) {
    console.error("[definirComissao]", error.message);
    return { erro: ERRO_GENERICO };
  }
  revalidatePath("/", "layout");
  return {};
}
