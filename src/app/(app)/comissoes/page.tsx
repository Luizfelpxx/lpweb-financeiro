import type { Metadata } from "next";
import Link from "next/link";
import { Stat, Titulo, Vazio } from "@/components/Ui";
import { botaoSecundario, campo, cartao, rotulo } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { NOME_INDICADOR } from "@/lib/domain/comissao";
import { FUNCIONARIAS, relatorioComissoes } from "@/lib/domain/comissoes";
import { eMesISO, formatarData, formatarMes, hojeSP } from "@/lib/domain/datas";
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
      <Titulo sub={`Empréstimos concedidos em ${formatarMes(mes)}`}>Comissões</Titulo>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="mes" className={rotulo}>
            Mês
          </label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className={campo} />
        </div>
        <button type="submit" className={botaoSecundario}>
          Ver
        </button>
      </form>

      <div className="space-y-8">
        {FUNCIONARIAS.map((f) => {
          const r = relatorios[f];
          return (
            <section key={f} aria-label={`Comissões de ${NOME_INDICADOR[f]}`}>
              <h2 className="mb-3 text-lg font-bold">{NOME_INDICADOR[f]}</h2>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <Stat rotulo="Clientes indicados" valor={r.clientes} />
                <Stat rotulo="Valor emprestado" valor={formatarBRL(r.totalEmprestado)} />
                <Stat
                  rotulo="Comissão do mês"
                  valor={f === "rosangela" ? "—" : formatarBRL(r.totalComissao)}
                  tom="destaque"
                />
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
