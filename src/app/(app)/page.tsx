import type { Metadata } from "next";
import Link from "next/link";
import { Stat, Titulo, Vazio } from "@/components/Ui";
import { cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { formatarData, hojeSP } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import { resumoPainel } from "@/lib/domain/painel";
import { visaoDia, visaoMes, visaoSemana } from "@/lib/domain/cobrancas";
import { somar } from "@/lib/domain/dinheiro";
import { telefoneValido } from "@/lib/domain/cobrancaPdf";

export const metadata: Metadata = { title: "Painel" };

export default async function Painel() {
  const { supabase } = await exigirUsuario();
  const base = await carregarBase(supabase);
  const hoje = hojeSP();
  const r = resumoPainel(base, hoje);
  const dia = visaoDia(base, hoje).resumo;
  const semana = visaoSemana(base, hoje, hoje).totais;
  const mes = visaoMes(base, hoje.slice(0, 7), hoje).totais;
  const atalhos = [
    { href: "/cobrancas?visao=dia", rotulo: "Cobrar hoje", valor: dia.totalACobrar, detalhe: `${dia.vencendo.qtd} vencendo hoje` },
    {
      href: "/cobrancas?visao=semana",
      rotulo: "Falta receber na semana",
      valor: semana.aReceber,
      detalhe: `recebido ${formatarBRL(semana.recebido)}`,
    },
    {
      href: "/cobrancas?visao=mes",
      rotulo: "Falta receber no mês",
      valor: mes.aReceber,
      detalhe: `recebido ${formatarBRL(mes.recebido)}`,
    },
  ];
  const emAtraso = somar([r.atrasadas.valor, r.dividas.valor]);

  return (
    <>
      <Titulo sub={`Posição em ${formatarData(hoje)} (horário de Brasília)`}>Painel</Titulo>

      <section aria-label="Cobranças" className="mb-6 grid gap-3 sm:grid-cols-3">
        {atalhos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`${cartao} group block p-4 transition-colors hover:border-agua`}
          >
            <p className="text-sm font-semibold text-suave">{a.rotulo}</p>
            <p className="mt-1 text-2xl font-bold text-texto">{formatarBRL(a.valor)}</p>
            <p className="mt-1 flex justify-between text-xs text-suave">
              <span>{a.detalhe}</span>
              <span className="font-semibold text-marinho group-hover:underline dark:text-agua">Ver lista</span>
            </p>
          </Link>
        ))}
        {emAtraso > 0 && (
          <Link
            href="/clientes?situacao=devendo&ordem=atraso"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800 sm:col-span-3 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {formatarBRL(emAtraso)} em atraso ({r.atrasadas.qtd + r.dividas.qtd} parcelas). Toque para ver quem está devendo.
          </Link>
        )}
      </section>

      <h2 className="mb-3 text-lg font-bold">Visão geral</h2>
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
                    {telefoneValido(c.cliente.telefone) ? `${c.cliente.telefone} • ` : ""}{c.qtd} {c.qtd === 1 ? "parcela" : "parcelas"} em dívida •
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
