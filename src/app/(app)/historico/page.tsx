import type { Metadata } from "next";
import Link from "next/link";
import { Etiqueta, Titulo, Vazio } from "@/components/Ui";
import { botaoSecundario, campo, cartao, rotulo } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarHistorico } from "@/lib/dados";
import { eDataISO } from "@/lib/domain/datas";
import {
  ROTULO_ACAO,
  ROTULO_TABELA,
  descreverHistorico,
  formatarDataHora,
} from "@/lib/domain/historico";
import type { AcaoHistorico } from "@/lib/domain/tipos";

export const metadata: Metadata = { title: "Histórico" };

const ACOES = Object.keys(ROTULO_ACAO) as AcaoHistorico[];
const LIMITE = 300;

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; tipo?: string; registro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await exigirUsuario();
  const de = sp.de && eDataISO(sp.de) ? sp.de : undefined;
  const ate = sp.ate && eDataISO(sp.ate) ? sp.ate : undefined;
  const tipo = ACOES.includes(sp.tipo as AcaoHistorico) ? (sp.tipo as string) : undefined;
  const registro = sp.registro && sp.registro in ROTULO_TABELA ? sp.registro : undefined;

  let lista = await carregarHistorico(supabase, { de, ate, acao: tipo, limite: LIMITE });
  if (registro) lista = lista.filter((h) => h.tabela === registro);

  // nomes dos clientes para exibir ao lado de cada registro
  const ids = [...new Set(lista.map((h) => h.cliente_id).filter(Boolean))] as string[];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("clientes").select("id, nome").in("id", ids);
    for (const c of data ?? []) nomes.set(c.id, c.nome);
  }

  return (
    <>
      <Titulo sub={`Últimas ${LIMITE} alterações no máximo`}>Histórico</Titulo>

      <form method="get" className={`${cartao} mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end`}>
        <div>
          <label htmlFor="de" className={rotulo}>
            De
          </label>
          <input id="de" name="de" type="date" defaultValue={de} className={campo} />
        </div>
        <div>
          <label htmlFor="ate" className={rotulo}>
            Até
          </label>
          <input id="ate" name="ate" type="date" defaultValue={ate} className={campo} />
        </div>
        <div>
          <label htmlFor="tipo" className={rotulo}>
            Tipo de alteração
          </label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className={campo}>
            <option value="">Todas</option>
            {ACOES.map((a) => (
              <option key={a} value={a}>
                {ROTULO_ACAO[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="registro" className={rotulo}>
            Registro
          </label>
          <select id="registro" name="registro" defaultValue={registro ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_TABELA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={botaoSecundario}>
          Filtrar
        </button>
      </form>

      {lista.length === 0 ? (
        <Vazio>Nenhum registro encontrado.</Vazio>
      ) : (
        <ul className={`${cartao} divide-y divide-borda`}>
          {lista.map((h) => {
            const nome = h.cliente_id ? nomes.get(h.cliente_id) : undefined;
            return (
              <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>{descreverHistorico(h)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-suave">
                    <Etiqueta>{ROTULO_TABELA[h.tabela]}</Etiqueta>
                    <Etiqueta tom={h.acao === "excluir" ? "aviso" : "agua"}>{ROTULO_ACAO[h.acao]}</Etiqueta>
                    {nome && h.cliente_id && (
                      <Link href={`/clientes/${h.cliente_id}`} className="underline-offset-2 hover:underline">
                        {nome}
                      </Link>
                    )}
                  </p>
                </div>
                <time dateTime={h.criado_em} className="whitespace-nowrap text-xs text-suave">
                  {formatarDataHora(h.criado_em)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
