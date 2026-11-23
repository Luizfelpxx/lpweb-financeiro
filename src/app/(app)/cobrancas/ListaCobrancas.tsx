import Link from "next/link";
import { StatusBadge } from "@/components/Ui";
import { cartao } from "@/components/estilos";
import type { ItemCobranca } from "@/lib/domain/cobrancas";
import { formatarData, hojeSP } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import { quantidadeDeParcelas } from "@/lib/domain/emprestimo";
import { telefoneValido } from "@/lib/domain/cobrancaPdf";
import PagamentoParcela from "./PagamentoParcela";

function Acao({ item }: { item: ItemCobranca }) {
  return (
    <PagamentoParcela
      parcelaId={item.parcela.id}
      paga={item.parcela.status_pagamento === "paga"}
      dataPagamento={item.parcela.data_pagamento}
      hoje={hojeSP()}
    />
  );
}

const nParcela = (i: ItemCobranca) =>
  `${i.parcela.numero_parcela}/${quantidadeDeParcelas(i.emprestimo.numero_parcelas)}`;

/** Lista de parcelas: tabela no desktop, cartões no celular. */
export default function ListaCobrancas({ itens }: { itens: ItemCobranca[] }) {
  return (
    <>
      {/* Desktop */}
      <div className={`${cartao} hidden overflow-x-auto md:block`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-suave">
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2 text-right">Parcela</th>
              <th className="px-3 py-2">Vencimento</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Total devido</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {itens.map((i) => (
              <tr key={i.parcela.id} className={i.status === "divida" ? "bg-red-50/60 dark:bg-red-950/20" : ""}>
                <td className="px-3 py-2 font-semibold">
                  <Link href={`/clientes/${i.cliente.id}`} className="underline-offset-2 hover:underline">
                    {i.cliente.nome}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {telefoneValido(i.cliente.telefone) ? i.cliente.telefone : <span className="text-suave">—</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatarBRL(i.parcela.valor)}
                  <span className="block text-xs text-suave">parcela {nParcela(i)}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarData(i.parcela.data_vencimento)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={i.status} dias={i.diasAtraso} />
                </td>
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  {formatarBRL(i.totalDevidoCliente)}
                </td>
                <td className="px-3 py-2">
                  <Acao item={i} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular */}
      <ul className="space-y-2 md:hidden">
        {itens.map((i) => (
          <li
            key={i.parcela.id}
            className={`${cartao} p-3 ${i.status === "divida" ? "border-red-300 dark:border-red-800" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/clientes/${i.cliente.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {i.cliente.nome}
                </Link>
                {telefoneValido(i.cliente.telefone) && (
                  <p className="text-xs text-suave">
                    <a href={`tel:${i.cliente.telefone.replace(/[^\d+]/g, "")}`}>{i.cliente.telefone}</a>
                  </p>
                )}
              </div>
              <StatusBadge status={i.status} dias={i.diasAtraso} />
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-suave">Parcela {nParcela(i)}</dt>
                <dd className="text-sm font-semibold">{formatarBRL(i.parcela.valor)}</dd>
              </div>
              <div>
                <dt className="text-suave">Vencimento</dt>
                <dd className="text-sm font-semibold">{formatarData(i.parcela.data_vencimento)}</dd>
              </div>
              <div>
                <dt className="text-suave">Total devido</dt>
                <dd className="text-sm font-semibold">{formatarBRL(i.totalDevidoCliente)}</dd>
              </div>
            </dl>
            <div className="mt-3">
              <Acao item={i} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
