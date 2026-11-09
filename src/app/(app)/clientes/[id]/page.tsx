import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BotaoAcao from "@/components/BotaoAcao";
import { Etiqueta, StatusBadge, Stat, Titulo } from "@/components/Ui";
import { botaoPrimario, botaoSecundario, cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarHistorico } from "@/lib/dados";
import { NOME_INDICADOR } from "@/lib/domain/comissao";
import { formatarData, hojeSP } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import { rotuloParcelas } from "@/lib/domain/emprestimo";
import { descreverHistorico, formatarDataHora, ROTULO_ACAO } from "@/lib/domain/historico";
import { diasDeAtraso, saldoDevedor, statusCobranca, totalPago } from "@/lib/domain/status";
import type { Cliente, Emprestimo, Parcela } from "@/lib/domain/tipos";
import {
  alternarPagamento,
  arquivarCliente,
  excluirCliente,
  excluirEmprestimo,
} from "../../actions";

export const metadata: Metadata = { title: "Ficha do cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const num = (v: unknown) => Number(v);

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigirUsuario();

  const { data: clienteBruto } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!clienteBruto) notFound();
  const cliente = clienteBruto as Cliente;

  const { data: emprestimosBrutos } = await supabase
    .from("emprestimos")
    .select("*")
    .eq("cliente_id", id)
    .order("data_emprestimo", { ascending: false })
    .order("criado_em", { ascending: false });
  const emprestimos = ((emprestimosBrutos ?? []) as Emprestimo[]).map((e) => ({
    ...e,
    valor_emprestado: num(e.valor_emprestado),
    valor_parcela: num(e.valor_parcela),
    total_a_pagar: num(e.total_a_pagar),
    taxa_juros_percentual: num(e.taxa_juros_percentual),
    comissao: num(e.comissao),
  }));

  let parcelas: Parcela[] = [];
  if (emprestimos.length > 0) {
    const { data } = await supabase
      .from("parcelas")
      .select("*")
      .in("emprestimo_id", emprestimos.map((e) => e.id))
      .order("numero_parcela");
    parcelas = ((data ?? []) as Parcela[]).map((p) => ({ ...p, valor: num(p.valor) }));
  }
  const historico = await carregarHistorico(supabase, { clienteId: id, limite: 40 });

  const hoje = hojeSP();
  const saldo = saldoDevedor(parcelas);
  const pago = totalPago(parcelas);
  const temDivida = parcelas.some((p) => statusCobranca(p, hoje) === "divida");
  const temAtraso = parcelas.some((p) => statusCobranca(p, hoje) === "atrasada");

  return (
    <>
      <Titulo
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {cliente.telefone}
            {cliente.indicado_por && <Etiqueta tom="agua">Indicado por {NOME_INDICADOR[cliente.indicado_por]}</Etiqueta>}
            {cliente.arquivado && <Etiqueta tom="aviso">Arquivado</Etiqueta>}
          </span>
        }
        acao={
          <>
            <Link href={`/clientes/${id}/emprestimos/novo`} className={botaoPrimario}>
              + Novo empréstimo
            </Link>
            <Link href={`/clientes/${id}/editar`} className={botaoSecundario}>
              Editar
            </Link>
          </>
        }
      >
        {cliente.nome}
      </Titulo>

      {/* Saldo devedor em destaque */}
      <section aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Stat
            rotulo="Saldo devedor"
            valor={formatarBRL(saldo)}
            grande
            tom={temDivida ? "perigo" : temAtraso ? "alerta" : saldo > 0 ? "destaque" : "ok"}
            detalhe={
              saldo === 0
                ? "Nenhuma parcela em aberto"
                : temDivida
                  ? "Há parcelas em dívida (mais de 30 dias)"
                  : temAtraso
                    ? "Há parcelas atrasadas"
                    : "Em dia"
            }
          />
        </div>
        <Stat rotulo="Total já pago" valor={formatarBRL(pago)} tom="ok" />
      </section>

      <section aria-label="Dados cadastrados" className={`${cartao} mt-4 grid gap-3 p-4 text-sm sm:grid-cols-2`}>
        <Dado rotulo="CPF" valor={cliente.cpf} />
        <Dado rotulo="Endereço" valor={cliente.endereco} />
        <div className="sm:col-span-2">
          <Dado rotulo="Observações" valor={cliente.observacoes} />
        </div>
      </section>

      {/* Empréstimos e parcelas */}
      <section aria-label="Empréstimos" className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Empréstimos e parcelas</h2>
        {emprestimos.length === 0 && (
          <div className={`${cartao} p-6 text-center text-sm text-suave`}>Nenhum empréstimo cadastrado.</div>
        )}
        <div className="space-y-4">
          {emprestimos.map((e) => {
            const ps = parcelas.filter((p) => p.emprestimo_id === e.id);
            const temPagas = ps.some((p) => p.status_pagamento === "paga");
            return (
              <article key={e.id} className={`${cartao} overflow-hidden`}>
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borda bg-destaque px-4 py-3">
                  <div>
                    <p className="font-semibold">
                      Pegou {formatarBRL(e.valor_emprestado)} • {rotuloParcelas(e.numero_parcelas)} de{" "}
                      {formatarBRL(e.valor_parcela)}
                    </p>
                    <p className="text-xs text-suave">
                      Total a pagar {formatarBRL(e.total_a_pagar)} • juros de referência{" "}
                      {e.taxa_juros_percentual.toLocaleString("pt-BR")}% • concedido em{" "}
                      {formatarData(e.data_emprestimo)}
                      {cliente.indicado_por === "geize" && <> • comissão {formatarBRL(e.comissao)}</>}
                      {cliente.indicado_por === "rosangela" && <> • comissão —</>}
                    </p>
                  </div>
                  {!temPagas && (
                    <BotaoAcao
                      acao={excluirEmprestimo.bind(null, e.id)}
                      confirmar="Excluir este empréstimo e todas as suas parcelas?"
                      variante="perigo"
                      pequeno
                    >
                      Excluir empréstimo
                    </BotaoAcao>
                  )}
                </header>
                <ul className="divide-y divide-borda">
                  {ps.map((p) => {
                    const status = statusCobranca(p, hoje);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="w-8 font-semibold text-suave">#{p.numero_parcela}</span>
                          <span>{formatarData(p.data_vencimento)}</span>
                          <span className="font-semibold">{formatarBRL(p.valor)}</span>
                          <StatusBadge status={status} dias={diasDeAtraso(p.data_vencimento, hoje)} />
                          {p.data_pagamento && (
                            <span className="text-xs text-suave">pago em {formatarData(p.data_pagamento)}</span>
                          )}
                        </div>
                        {p.status_pagamento === "aberta" ? (
                          <BotaoAcao acao={alternarPagamento.bind(null, p.id, true)} variante="ok" pequeno>
                            Marcar como paga
                          </BotaoAcao>
                        ) : (
                          <BotaoAcao acao={alternarPagamento.bind(null, p.id, false)} pequeno>
                            Desmarcar
                          </BotaoAcao>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* Histórico do cliente */}
      <section aria-label="Histórico do cliente" className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Histórico do cliente</h2>
        {historico.length === 0 ? (
          <div className={`${cartao} p-6 text-center text-sm text-suave`}>Sem registros.</div>
        ) : (
          <ul className={`${cartao} divide-y divide-borda`}>
            {historico.map((h) => (
              <li key={h.id} className="px-4 py-2.5 text-sm">
                <p>{descreverHistorico(h)}</p>
                <p className="text-xs text-suave">
                  {formatarDataHora(h.criado_em)} • {ROTULO_ACAO[h.acao]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ações do cadastro */}
      <section aria-label="Ações do cadastro" className="mt-8 flex flex-wrap gap-2">
        <BotaoAcao
          acao={arquivarCliente.bind(null, id, !cliente.arquivado)}
          confirmar={cliente.arquivado ? undefined : "Arquivar este cliente? Ele sai da lista, mas as cobranças continuam."}
        >
          {cliente.arquivado ? "Reativar cadastro" : "Arquivar cliente"}
        </BotaoAcao>
        {emprestimos.length === 0 && (
          <BotaoAcao
            acao={excluirCliente.bind(null, id)}
            confirmar="Excluir definitivamente este cliente?"
            variante="perigo"
          >
            Excluir cliente
          </BotaoAcao>
        )}
        {emprestimos.length > 0 && (
          <p className="self-center text-xs text-suave">
            Clientes com empréstimos não podem ser excluídos — apenas arquivados.
          </p>
        )}
      </section>
    </>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-suave">{rotulo}</p>
      <p className="whitespace-pre-line">{valor || "—"}</p>
    </div>
  );
}
