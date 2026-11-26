import type { Metadata } from "next";
import Link from "next/link";
import BotaoPdf from "@/components/BotaoPdf";
import { Stat, Titulo, Vazio } from "@/components/Ui";
import { botaoSecundario, campo, cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { NOME_INDICADOR } from "@/lib/domain/comissao";
import { FUNCIONARIAS, relatorioComissoes } from "@/lib/domain/comissoes";
import { eMesISO, formatarData, formatarMes, hojeSP, somarMeses } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";

export const metadata: Metadata = { title: "Comissões" };

export default async function PaginaComissoes({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await exigirUsuario();
  const mes = sp.mes && eMesISO(sp.mes) ? sp.mes : hojeSP().slice(0, 7);
  const base = await carregarBase(supabase);
  const relatorios = relatorioComissoes(base, mes);

  return (
    <>
      <Titulo sub="Comissões pelos empréstimos feitos no mês">Comissões</Titulo>

      <div className={`${cartao} mb-3 flex items-center gap-2 p-2`}>
        <Link
          href={`/comissoes?mes=${somarMeses(`${mes}-01`, -1).slice(0, 7)}`}
          className={`${botaoSecundario} px-3`}
          aria-label="Mês anterior"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-bold text-texto">
            {formatarMes(mes).charAt(0).toUpperCase() + formatarMes(mes).slice(1)}
          </p>
          {mes === hojeSP().slice(0, 7) && <p className="text-xs text-suave">Mês atual</p>}
        </div>
        <Link
          href={`/comissoes?mes=${somarMeses(`${mes}-01`, 1).slice(0, 7)}`}
          className={`${botaoSecundario} px-3`}
          aria-label="Próximo mês"
        >
          ›
        </Link>
      </div>

      <details className="mb-6">
        <summary className="cursor-pointer list-none text-sm font-semibold text-suave hover:text-texto">
          📅 Escolher mês
        </summary>
        <form method="get" className="mt-2 flex flex-wrap items-end gap-3">
          <label htmlFor="mes" className="sr-only">
            Mês
          </label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className={`${campo} w-auto`} />
          <button type="submit" className={botaoSecundario}>
            Ver
          </button>
        </form>
      </details>

      <div className="space-y-8">
        {FUNCIONARIAS.map((f) => {
          const r = relatorios[f];
          return (
            <section key={f} aria-label={`Comissões de ${NOME_INDICADOR[f]}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">
                  {f === "geize" ? "Geize" : "Clientes trazidos pela Rosangela"}
                  {f === "rosangela" && <span className="ml-2 text-sm font-normal text-suave">(sem comissão)</span>}
                </h2>
                {f === "geize" && (
                  <BotaoPdf
                    url={`/api/pdf/comissoes?mes=${mes}`}
                    rotulo="das comissões"
                    nomePadrao={`comissoes-geize-${mes}.pdf`}
                  />
                )}
              </div>
              {f === "geize" && (
                <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Rosangela paga para a Geize em {formatarMes(mes)}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {formatarBRL(r.totalComissao)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                    {r.linhas.length} {r.linhas.length === 1 ? "empréstimo indicado" : "empréstimos indicados"} • R$ 50,00
                    até R$ 1.000,00 e R$ 100,00 acima disso
                  </p>
                </div>
              )}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <Stat rotulo={f === "geize" ? "Clientes indicados" : "Clientes"} valor={r.clientes} />
                <Stat rotulo="Valor emprestado" valor={formatarBRL(r.totalEmprestado)} />
              </div>
              {r.linhas.length === 0 ? (
                <Vazio>Nenhum empréstimo indicado por {NOME_INDICADOR[f]} neste mês.</Vazio>
              ) : (
                <div className={`${cartao} overflow-x-auto`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-suave">
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2 text-right">Valor emprestado</th>
                        <th className="px-3 py-2 text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borda">
                      {r.linhas.map((l) => (
                        <tr key={l.emprestimoId}>
                          <td className="px-3 py-2 font-semibold">
                            <Link href={`/clientes/${l.clienteId}`} className="underline-offset-2 hover:underline">
                              {l.cliente}
                            </Link>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.dataEmprestimo)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{formatarBRL(l.valorEmprestado)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {l.comissao > 0 ? formatarBRL(l.comissao) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-agua bg-destaque font-bold">
                        <td className="px-3 py-2" colSpan={2}>
                          Total do mês
                        </td>
                        <td className="px-3 py-2 text-right">{formatarBRL(r.totalEmprestado)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.totalComissao > 0 ? formatarBRL(r.totalComissao) : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
