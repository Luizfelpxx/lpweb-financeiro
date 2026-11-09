"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { hojeSP } from "@/lib/domain/datas";
import { calcularEmprestimo } from "@/lib/domain/emprestimo";
import type { IndicadoPor } from "@/lib/domain/tipos";
import { linhaTemErro, validarImportacao } from "@/lib/importacao";
import { chaveCliente } from "@/lib/validacao";

export interface ResultadoImportacao {
  erro?: string;
  importados: number;
  clientesNovos: number;
  comErro: number;
  ignorados: { linha: number; motivo: string }[];
  falhas: { linha: number; motivo: string }[];
}

const vazio = (erro?: string): ResultadoImportacao => ({
  erro,
  importados: 0,
  clientesNovos: 0,
  comErro: 0,
  ignorados: [],
  falhas: [],
});

const TAMANHO_MAXIMO = 1_000_000; // ~1 MB de texto

/**
 * Importa o CSV (validado de novo no servidor — nunca confiamos na prévia do navegador).
 * - Reaproveita o cliente se já existir (mesmo nome + telefone); senão cria.
 * - Pula empréstimos que já existem (mesmo cliente, valor, 1º vencimento e nº de parcelas),
 *   para que reenviar o mesmo arquivo não duplique nada.
 * - valor_pago vazio = "não pago": nunca assumimos quitação.
 */
export async function importarCSV(texto: string): Promise<ResultadoImportacao> {
  const { supabase } = await exigirUsuario();
  if (typeof texto !== "string" || texto.length > TAMANHO_MAXIMO) {
    return vazio("Arquivo inválido ou grande demais (máximo ~1 MB).");
  }
  const { linhas, erroGeral } = validarImportacao(texto);
  if (erroGeral) return vazio(erroGeral);

  const validas = linhas.filter((l) => !linhaTemErro(l));
  const resultado = vazio();
  resultado.comErro = linhas.length - validas.length;
  if (validas.length === 0) return { ...resultado, erro: "Nenhuma linha válida para importar." };

  const base = await carregarBase(supabase);
  const clientes = new Map<string, { id: string; indicado_por: IndicadoPor | null }>(
    base.clientes.map((c) => [chaveCliente(c.nome, c.telefone), { id: c.id, indicado_por: c.indicado_por }]),
  );
  const existentes = new Set(
    base.emprestimos.map(
      (e) => `${e.cliente_id}|${e.valor_emprestado}|${e.primeiro_vencimento}|${e.numero_parcelas}`,
    ),
  );
  const hoje = hojeSP();

  for (const l of validas) {
    const chave = chaveCliente(l.nome, l.telefone);
    let cliente = clientes.get(chave);
    if (!cliente) {
      const { data, error } = await supabase
        .from("clientes")
        .insert({ nome: l.nome, telefone: l.telefone, indicado_por: l.indicadoPor })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[importarCSV] cliente:", error?.message);
        resultado.falhas.push({ linha: l.linha, motivo: "Não foi possível criar o cliente." });
        continue;
      }
      cliente = { id: data.id, indicado_por: l.indicadoPor };
      clientes.set(chave, cliente);
      resultado.clientesNovos++;
    }

    const calc = calcularEmprestimo({
      valorEmprestado: l.valorEmprestado!,
      numeroParcelas: l.numeroParcelas!,
      valorParcela: l.valorParcela!,
      primeiroVencimento: l.primeiroVencimento!,
      indicadoPor: cliente.indicado_por, // o cadastro do cliente é a referência
    });
    const dup = `${cliente.id}|${calc.valorEmprestado}|${l.primeiroVencimento}|${calc.numeroParcelas}`;
    if (existentes.has(dup)) {
      resultado.ignorados.push({ linha: l.linha, motivo: "Empréstimo já cadastrado (mesmo valor e vencimento)." });
      continue;
    }

    const parcelas = calc.parcelas.map((p, i) =>
      i < l.parcelasPagas ? { ...p, status_pagamento: "paga", data_pagamento: hoje } : p,
    );
    const { error } = await supabase.rpc("criar_emprestimo", {
      p_emprestimo: {
        cliente_id: cliente.id,
        valor_emprestado: calc.valorEmprestado,
        numero_parcelas: calc.numeroParcelas,
        valor_parcela: calc.valorParcela,
        total_a_pagar: calc.totalAPagar,
        primeiro_vencimento: l.primeiroVencimento,
        taxa_juros_percentual: calc.taxaJurosPercentual,
        comissao: calc.comissao,
        data_emprestimo: l.dataEmprestimo ?? hoje,
      },
      p_parcelas: parcelas,
    });
    if (error) {
      console.error("[importarCSV] empréstimo:", error.message);
      resultado.falhas.push({ linha: l.linha, motivo: "Não foi possível salvar o empréstimo." });
      continue;
    }
    existentes.add(dup);
    resultado.importados++;
  }

  revalidatePath("/", "layout");
  return resultado;
}
