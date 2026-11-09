import type { Metadata } from "next";
import Link from "next/link";
import { Stat, Titulo, Vazio } from "@/components/Ui";
import { cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { formatarData, hojeSP } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import { resumoPainel } from "@/lib/domain/painel";

export const metadata: Metadata = { title: "Painel" };

export default async function Painel() {
  const { supabase } = await exigirUsuario();
  const base = await carregarBase(supabase);
  const hoje = hojeSP();
  const r = resumoPainel(base, hoje);

  return (
    <>
      <Titulo sub={`Posição em ${formatarData(hoje)} (horário de Brasília)`}>Painel</Titulo>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat rotulo="Total emprestado" valor={formatarBRL(r.totalEmprestado)} />
        <Stat
          rotulo="Juros previstos (lucro)"
          valor={formatarBRL(r.jurosPrevistos)}
          tom="destaque"
          detalhe="Total a pagar − emprestado"
        />
        <Stat rotulo="Total já recebido" valor={formatarBRL(r.totalRecebido)} tom="ok" />
        <Stat rotulo="Total a receber" valor={formatarBRL(r.totalAReceber)} />
        <div className="col-span-2 lg:col-span-1">
          <Stat rotulo="Clientes" valor={r.quantidadeClientes} detalhe="cadastros ativos" />
        </div>
      </section>

      <section aria-label="Atrasos" className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat
          rotulo="Atrasadas (1 a 30 dias)"
          valor={formatarBRL(r.atrasadas.valor)}
          detalhe={`${r.atrasadas.qtd} ${r.atrasadas.qtd === 1 ? "parcela" : "parcelas"}`}
          tom={r.atrasadas.qtd > 0 ? "alerta" : "neutro"}
        />
        <Stat
          rotulo="Dívidas (mais de 30 dias)"
          valor={formatarBRL(r.dividas.valor)}
          detalhe={`${r.dividas.qtd} ${r.dividas.qtd === 1 ? "parcela" : "parcelas"}`}
          tom={r.dividas.qtd > 0 ? "perigo" : "neutro"}
          grande
        />
      </section>

      <section aria-label="Clientes com dívida" className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Clientes com dívida</h2>
        {r.clientesEmDivida.length === 0 ? (
          <Vazio>Nenhum cliente com dívida. 🎉</Vazio>
        ) : (
          <div className={`${cartao} divide-y divide-borda overflow-hidden`}>
            {r.clientesEmDivida.map((c) => (
              <div
                key={c.cliente.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/clientes/${c.cliente.id}`}
                    className="font-semibold text-texto underline-offset-2 hover:underline"
                  >
                    {c.cliente.nome}
                  </Link>
                  <p className="text-xs text-suave">
                    {c.cliente.telefone} • {c.qtd} {c.qtd === 1 ? "parcela" : "parcelas"} em dívida •
                    até {c.maiorAtraso} dias de atraso
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-700 dark:text-red-300">{formatarBRL(c.valor)}</p>
                  <p className="text-xs text-suave">saldo total {formatarBRL(c.totalDevido)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
