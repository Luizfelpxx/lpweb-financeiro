import type { Metadata } from "next";
import Link from "next/link";
import { Etiqueta, StatusBadge, Titulo, Vazio } from "@/components/Ui";
import { botaoPrimario, botaoSecundario, campo, cartao, rotulo } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { indexarBase, visaoDia } from "@/lib/domain/cobrancas";
import { hojeSP } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import { NOME_INDICADOR } from "@/lib/domain/comissao";
import type { StatusCobranca } from "@/lib/domain/tipos";
import { semAcento } from "@/lib/texto";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; indicado?: string; arquivados?: string }>;
}) {
  const { q = "", indicado = "", arquivados } = await searchParams;
  const { supabase } = await exigirUsuario();
  const base = await carregarBase(supabase);
  const { saldoPorCliente } = indexarBase(base);

  // pior situação de cobrança de cada cliente (hoje)
  const pior = new Map<string, StatusCobranca>();
  for (const item of visaoDia(base, hojeSP()).itens) {
    if (item.status === "divida") pior.set(item.cliente.id, "divida");
    else if (item.status === "atrasada" && pior.get(item.cliente.id) !== "divida")
      pior.set(item.cliente.id, "atrasada");
  }

  const termo = semAcento(q.trim());
  const clientes = base.clientes
    .filter((c) => (arquivados === "1" ? true : !c.arquivado))
    .filter((c) => (termo ? semAcento(c.nome).includes(termo) : true))
    .filter((c) => {
      if (indicado === "geize" || indicado === "rosangela") return c.indicado_por === indicado;
      if (indicado === "nenhum") return c.indicado_por === null;
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <Titulo
        sub={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
        acao={
          <Link href="/clientes/novo" className={botaoPrimario}>
            + Novo cliente
          </Link>
        }
      >
        Clientes
      </Titulo>

      <form method="get" className={`${cartao} mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_auto_auto] sm:items-end`}>
        <div>
          <label htmlFor="q" className={rotulo}>
            Buscar por nome
          </label>
          <input id="q" name="q" defaultValue={q} className={campo} placeholder="Digite o nome…" />
        </div>
        <div>
          <label htmlFor="indicado" className={rotulo}>
            Indicado por
          </label>
          <select id="indicado" name="indicado" defaultValue={indicado} className={campo}>
            <option value="">Todos</option>
            <option value="geize">Geize</option>
            <option value="rosangela">Rosangela</option>
            <option value="nenhum">Sem indicação</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="arquivados" value="1" defaultChecked={arquivados === "1"} />
          Mostrar arquivados
        </label>
        <button type="submit" className={botaoSecundario}>
          Filtrar
        </button>
      </form>

      {clientes.length === 0 ? (
        <Vazio>Nenhum cliente encontrado.</Vazio>
      ) : (
        <ul className={`${cartao} divide-y divide-borda overflow-hidden`}>
          {clientes.map((c) => {
            const saldo = saldoPorCliente.get(c.id) ?? 0;
            const status = pior.get(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-destaque"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {c.nome}
                      {c.indicado_por && <Etiqueta tom="agua">{NOME_INDICADOR[c.indicado_por]}</Etiqueta>}
                      {c.arquivado && <Etiqueta tom="aviso">Arquivado</Etiqueta>}
                    </p>
                    <p className="text-xs text-suave">{c.telefone}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {status && <StatusBadge status={status} />}
                    <div>
                      <p className="text-xs text-suave">Saldo devedor</p>
                      <p className={`font-bold ${saldo > 0 ? "" : "text-suave"}`}>{formatarBRL(saldo)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
