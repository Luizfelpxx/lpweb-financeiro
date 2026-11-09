import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Base,
  Cliente,
  Configuracoes,
  Emprestimo,
  Historico,
  Parcela,
} from "@/lib/domain/tipos";

const TAMANHO_PAGINA = 1000; // limite padrão de linhas por requisição do PostgREST

/** Busca todas as linhas de uma consulta paginando de 1000 em 1000. */
async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return todas;
}

const num = (v: unknown) => Number(v);

function normalizarEmprestimo(e: Emprestimo): Emprestimo {
  return {
    ...e,
    valor_emprestado: num(e.valor_emprestado),
    valor_parcela: num(e.valor_parcela),
    total_a_pagar: num(e.total_a_pagar),
    taxa_juros_percentual: num(e.taxa_juros_percentual),
    comissao: num(e.comissao),
    numero_parcelas: num(e.numero_parcelas),
  };
}

function normalizarParcela(p: Parcela): Parcela {
  return { ...p, valor: num(p.valor), numero_parcela: num(p.numero_parcela) };
}

/** Carrega clientes, empréstimos e parcelas (base de todos os cálculos e relatórios). */
export async function carregarBase(supabase: SupabaseClient): Promise<Base> {
  const [clientes, emprestimos, parcelas] = await Promise.all([
    buscarTodas<Cliente>((de, ate) =>
      supabase.from("clientes").select("*").order("id").range(de, ate),
    ),
    buscarTodas<Emprestimo>((de, ate) =>
      supabase.from("emprestimos").select("*").order("id").range(de, ate),
    ),
    buscarTodas<Parcela>((de, ate) =>
      supabase.from("parcelas").select("*").order("id").range(de, ate),
    ),
  ]);
  return {
    clientes,
    emprestimos: emprestimos.map(normalizarEmprestimo),
    parcelas: parcelas.map(normalizarParcela),
  };
}

export async function carregarConfiguracoes(
  supabase: SupabaseClient,
): Promise<Configuracoes> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("telegram_chat_id, hora_relatorio")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    telegram_chat_id: data?.telegram_chat_id ?? null,
    hora_relatorio: String(data?.hora_relatorio ?? "08:00:00").slice(0, 5),
  };
}

export async function carregarHistorico(
  supabase: SupabaseClient,
  filtros: { de?: string; ate?: string; acao?: string; clienteId?: string; limite?: number },
): Promise<Historico[]> {
  let consulta = supabase
    .from("historico")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(filtros.limite ?? 200);
  if (filtros.clienteId) consulta = consulta.eq("cliente_id", filtros.clienteId);
  if (filtros.acao) consulta = consulta.eq("acao", filtros.acao);
  // datas no fuso de Brasília (UTC-3, sem horário de verão desde 2019)
  if (filtros.de) consulta = consulta.gte("criado_em", `${filtros.de}T00:00:00-03:00`);
  if (filtros.ate) consulta = consulta.lte("criado_em", `${filtros.ate}T23:59:59.999-03:00`);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return (data ?? []) as Historico[];
}
