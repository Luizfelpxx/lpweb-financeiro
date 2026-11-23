import type { Metadata } from "next";
import Link from "next/link";
import { Etiqueta, Stat, StatusBadge, Titulo, Vazio } from "@/components/Ui";
import { botaoPrimario, botaoSecundario, campo, cartao, rotulo } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import { telefoneValido } from "@/lib/domain/cobrancaPdf";
import { indexarBase, visaoDia } from "@/lib/domain/cobrancas";
import { formatarData, hojeSP } from "@/lib/domain/datas";
import { formatarBRL, somar } from "@/lib/domain/dinheiro";
import { NOME_INDICADOR } from "@/lib/domain/comissao";
import type { StatusCobranca } from "@/lib/domain/tipos";
import { semAcento } from "@/lib/texto";

export const metadata: Metadata = { title: "Clientes" };

type Situacao = "todos" | "devendo" | "em_dia" | "quitados";
type Ordem = "nome" | "atraso" | "saldo";

const ROTULO_SITUACAO: Record<Situacao, string> = {
  todos: "Todos",
  devendo: "Devendo (atrasados)",
  em_dia: "Em dia",
  quitados: "Quitados",
};

const BORDA_STATUS: Partial<Record<StatusCobranca, string>> = {
  divida: "border-l-4 border-l-red-500",
  atrasada: "border-l-4 border-l-amber-500",
};

interface Resumo {
  pior: StatusCobranca | null;
  diasAtraso: number;
  valorAtrasado: number;
  proximoVencimento: string | null;
  saldo: number;
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; indicado?: string; arquivados?: string; situacao?: string; ordem?: string }>;
}) {
  const sp = await searchParams;
  const { q = "", indicado = "", arquivados } = sp;
  const situacao: Situacao =
    sp.situacao === "devendo" || sp.situacao === "em_dia" || sp.situacao === "quitados" ? sp.situacao : "todos";
  const ordem: Ordem = sp.ordem === "atraso" || sp.ordem === "saldo" ? sp.ordem : "nome";

  const { supabase } = await exigirUsuario();
  const base = await carregarBase(supabase);
  const hoje = hojeSP();
  const { saldoPorCliente, emprestimoPorId } = indexarBase(base);

  // situação de cobrança de cada cliente (hoje)
  const resumo = new Map<string, Resumo>();
  const pegar = (id: string): Resumo => {
    let r = resumo.get(id);
    if (!r) {
      r = { pior: null, diasAtraso: 0, valorAtrasado: 0, proximoVencimento: null, saldo: saldoPorCliente.get(id) ?? 0 };
      resumo.set(id, r);
    }
    return r;
  };
  for (const item of visaoDia(base, hoje).itens) {
    if (item.status !== "divida" && item.status !== "atrasada") continue;
    const r = pegar(item.cliente.id);
    if (item.status === "divida" || r.pior !== "divida") r.pior = item.status;
    r.diasAtraso = Math.max(r.diasAtraso, item.diasAtraso);
    r.valorAtrasado = somar([r.valorAtrasado, item.parcela.valor]);
  }
  for (const p of base.parcelas) {
    if (p.status_pagamento !== "aberta" || p.data_vencimento < hoje) continue;
    const e = emprestimoPorId.get(p.emprestimo_id);
    if (!e) continue;
    const r = pegar(e.cliente_id);
    if (!r.proximoVencimento || p.data_vencimento < r.proximoVencimento) r.proximoVencimento = p.data_vencimento;
  }
  const info = (id: string) => resumo.get(id) ?? pegar(id);
  const situacaoDe = (id: string): Exclude<Situacao, "todos"> => {
    const r = info(id);
    if (r.pior) return "devendo";
    return r.saldo > 0 ? "em_dia" : "quitados";
  };

  const ativos = base.clientes.filter((c) => (arquivados === "1" ? true : !c.arquivado));
  const devedores = ativos.filter((c) => situacaoDe(c.id) === "devendo");
  const totalAtrasado = somar(devedores.map((c) => info(c.id).valorAtrasado));
  const totalAReceber = somar(ativos.map((c) => info(c.id).saldo));
  const emDia = ativos.filter((c) => situacaoDe(c.id) === "em_dia").length;

  const termo = semAcento(q.trim());
  const clientes = ativos
    .filter((c) => (termo ? semAcento(c.nome).includes(termo) : true))
    .filter((c) => {
      if (indicado === "geize" || indicado === "rosangela") return c.indicado_por === indicado;
      if (indicado === "nenhum") return c.indicado_por === null;
      return true;
    })
    .filter((c) => situacao === "todos" || situacaoDe(c.id) === situacao)
    .sort((a, b) => {
      if (ordem === "atraso") {
        const d = info(b.id).diasAtraso - info(a.id).diasAtraso;
        if (d) return d;
      }
      if (ordem === "saldo") {
        const d = info(b.id).saldo - info(a.id).saldo;
        if (d) return d;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

  const linkSituacao = (s: Situacao) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(indicado ? { indicado } : {}), situacao: s, ordem: s === "devendo" ? "atraso" : ordem });
    if (arquivados === "1") p.set("arquivados", "1");
    return `/clientes?${p}`;
  };

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

      <section aria-label="Resumo dos clientes" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Link href={linkSituacao("devendo")} className="block">
          <Stat
            rotulo="Devendo agora"
            valor={formatarBRL(totalAtrasado)}
            detalhe={`${devedores.length} ${devedores.length === 1 ? "cliente atrasado" : "clientes atrasados"} • toque para ver`}
            tom={devedores.length ? "perigo" : "neutro"}
          />
        </Link>
        <Link href={linkSituacao("em_dia")} className="block">
          <Stat rotulo="Em dia" valor={String(emDia)} detalhe="com parcelas a vencer" tom="ok" />
        </Link>
        <div className="col-span-2 lg:col-span-1">
          <Stat rotulo="Total a receber" valor={formatarBRL(totalAReceber)} detalhe="soma dos saldos" tom="destaque" />
        </div>
      </section>

      <form method="get" className={`${cartao} mb-4 grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-[1fr_170px_170px_170px_auto]`}>
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="q" className={rotulo}>
            Buscar por nome
          </label>
          <input id="q" name="q" defaultValue={q} className={campo} placeholder="Digite o nome…" />
        </div>
        <div>
          <label htmlFor="situacao" className={rotulo}>
            Situação
          </label>
          <select id="situacao" name="situacao" defaultValue={situacao} className={campo}>
            {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => (
              <option key={s} value={s}>
                {ROTULO_SITUACAO[s]}
              </option>
            ))}
          </select>
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
        <div>
          <label htmlFor="ordem" className={rotulo}>
            Ordenar por
          </label>
          <select id="ordem" name="ordem" defaultValue={ordem} className={campo}>
            <option value="nome">Nome (A–Z)</option>
            <option value="atraso">Mais atrasado</option>
            <option value="saldo">Maior saldo</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="arquivados" value="1" defaultChecked={arquivados === "1"} />
            Arquivados
          </label>
          <button type="submit" className={botaoSecundario}>
            Filtrar
          </button>
        </div>
      </form>

      {clientes.length === 0 ? (
        <Vazio>Nenhum cliente encontrado.</Vazio>
      ) : (
        <ul className={`${cartao} divide-y divide-borda overflow-hidden`}>
          {clientes.map((c) => {
            const r = info(c.id);
            const sit = situacaoDe(c.id);
            return (
              <li key={c.id} className={r.pior ? BORDA_STATUS[r.pior] : ""}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-destaque"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {c.nome}
                      {c.indicado_por && <Etiqueta tom="agua">{NOME_INDICADOR[c.indicado_por]}</Etiqueta>}
                      {c.arquivado && <Etiqueta tom="aviso">Arquivado</Etiqueta>}
                    </p>
                    <p className="mt-0.5 text-xs text-suave">
                      {sit === "devendo" && (
                        <span className="font-semibold text-red-700 dark:text-red-300">
                          {formatarBRL(r.valorAtrasado)} em atraso há {r.diasAtraso} {r.diasAtraso === 1 ? "dia" : "dias"}
                        </span>
                      )}
                      {sit === "em_dia" && r.proximoVencimento && <>Próximo vencimento: {formatarData(r.proximoVencimento)}</>}
                      {sit === "quitados" && <>Sem parcelas em aberto</>}
                      {sit === "devendo" && r.proximoVencimento && <> • próximo venc. {formatarData(r.proximoVencimento)}</>}
                      {telefoneValido(c.telefone) && <> • {c.telefone}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {r.pior ? (
                      <StatusBadge status={r.pior} dias={r.diasAtraso} />
                    ) : sit === "em_dia" ? (
                      <StatusBadge status="em_aberto" />
                    ) : (
                      <StatusBadge status="paga" />
                    )}
                    <div>
                      <p className="text-xs text-suave">Saldo devedor</p>
                      <p className={`font-bold ${r.saldo > 0 ? "" : "text-suave"}`}>{formatarBRL(r.saldo)}</p>
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
