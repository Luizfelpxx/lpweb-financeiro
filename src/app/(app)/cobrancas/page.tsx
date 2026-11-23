import type { Metadata } from "next";
import Link from "next/link";
import BotaoPdf from "@/components/BotaoPdf";
import { Stat, Vazio } from "@/components/Ui";
import { botaoSecundario, campo, cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import {
  type FiltroCobranca,
  type VisaoPeriodo,
  ROTULO_FILTRO,
  lerFiltro,
  visaoDia,
  visaoMes,
  visaoSemana,
} from "@/lib/domain/cobrancas";
import {
  diaDaSemana,
  eDataISO,
  eMesISO,
  formatarData,
  formatarMes,
  formatarSemana,
  hojeSP,
  limitesDaSemana,
  somarDias,
  somarMeses,
} from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import ListaCobrancas from "./ListaCobrancas";

export const metadata: Metadata = { title: "Cobranças" };

type Visao = "dia" | "semana" | "mes";
type Base = Awaited<ReturnType<typeof carregarBase>>;

/** "segunda-feira" → "Segunda-feira" (só a primeira letra). */
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ROTULO_PDF: Record<Visao, string> = { dia: "do dia", semana: "da semana", mes: "do mês" };

export default async function PaginaCobrancas({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; data?: string; semana?: string; mes?: string; filtro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await exigirUsuario();
  const hoje = hojeSP();
  const visao: Visao = sp.visao === "mes" || sp.visao === "semana" ? sp.visao : "dia";
  const filtro = lerFiltro(sp.filtro);
  const data = sp.data && eDataISO(sp.data) ? sp.data : hoje;
  const semana = limitesDaSemana(sp.semana && eDataISO(sp.semana) ? sp.semana : hoje).inicio;
  const mes = sp.mes && eMesISO(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const base = await carregarBase(supabase);

  /** Monta o link da própria página trocando só o que for passado. */
  const link = (mudar: { visao?: Visao; data?: string; semana?: string; mes?: string; filtro?: FiltroCobranca }) => {
    const v = mudar.visao ?? visao;
    const p = new URLSearchParams({ visao: v });
    if (v === "dia") p.set("data", mudar.data ?? data);
    if (v === "semana") p.set("semana", mudar.semana ?? semana);
    if (v === "mes") p.set("mes", mudar.mes ?? mes);
    const f = mudar.filtro ?? filtro;
    if (f !== "todas") p.set("filtro", f);
    return p.toString();
  };

  const semanaAtual = limitesDaSemana(hoje).inicio;
  const nav =
    visao === "dia"
      ? {
          titulo: data === hoje ? "Hoje" : formatarData(data),
          detalhe: diaDaSemana(data),
          anterior: link({ data: somarDias(data, -1) }),
          proximo: link({ data: somarDias(data, 1) }),
          atual: data === hoje ? null : link({ data: hoje }),
          rotuloAtual: "Ir para hoje",
        }
      : visao === "semana"
        ? {
            titulo: semana === semanaAtual ? "Esta semana" : formatarSemana(semana, somarDias(semana, 6)),
            detalhe: semana === semanaAtual ? formatarSemana(semana, somarDias(semana, 6)) : "segunda a domingo",
            anterior: link({ semana: somarDias(semana, -7) }),
            proximo: link({ semana: somarDias(semana, 7) }),
            atual: semana === semanaAtual ? null : link({ semana: semanaAtual }),
            rotuloAtual: "Ir para esta semana",
          }
        : {
            titulo: formatarMes(mes),
            detalhe: mes === hoje.slice(0, 7) ? "mês atual" : "",
            anterior: link({ mes: somarMeses(`${mes}-01`, -1).slice(0, 7) }),
            proximo: link({ mes: somarMeses(`${mes}-01`, 1).slice(0, 7) }),
            atual: mes === hoje.slice(0, 7) ? null : link({ mes: hoje.slice(0, 7) }),
            rotuloAtual: "Ir para este mês",
          };

  const urlPdf = `/api/pdf?${link({})}`;
  const referencia = visao === "dia" ? data : visao === "semana" ? semana : mes;

  const aba = (ativa: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${
      ativa ? "bg-primario text-primario-texto shadow-sm" : "text-suave hover:bg-destaque hover:text-texto"
    }`;
  const chip = (ativo: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      ativo ? "border-primario bg-primario text-primario-texto" : "border-borda bg-cartao text-texto hover:bg-destaque"
    }`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-texto md:text-2xl">Cobranças</h1>
        <BotaoPdf url={urlPdf} rotulo={ROTULO_PDF[visao]} nomePadrao={`cobranca-${visao}-${referencia}.pdf`} />
      </div>

      {/* Dia / Semana / Mês */}
      <nav aria-label="Período" className={`${cartao} mb-3 flex gap-1 p-1`}>
        {(["dia", "semana", "mes"] as const).map((v) => (
          <Link key={v} href={`/cobrancas?${link({ visao: v })}`} aria-current={visao === v ? "page" : undefined} className={aba(visao === v)}>
            {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
          </Link>
        ))}
      </nav>

      {/* Navegação entre períodos */}
      <div className={`${cartao} mb-3 flex items-center gap-2 p-2`}>
        <Link href={`/cobrancas?${nav.anterior}`} className={`${botaoSecundario} px-3`} aria-label="Período anterior">
          ‹
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-bold text-texto">{maiuscula(nav.titulo)}</p>
          {nav.detalhe && <p className="truncate text-xs text-suave">{maiuscula(nav.detalhe)}</p>}
        </div>
        <Link href={`/cobrancas?${nav.proximo}`} className={`${botaoSecundario} px-3`} aria-label="Próximo período">
          ›
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {nav.atual && (
          <Link href={`/cobrancas?${nav.atual}`} className="text-sm font-semibold text-marinho underline-offset-2 hover:underline dark:text-agua">
            {nav.rotuloAtual}
          </Link>
        )}
        <details className="relative">
          <summary className="cursor-pointer list-none text-sm font-semibold text-suave hover:text-texto">
            📅 Escolher {visao === "mes" ? "mês" : "data"}
          </summary>
          <form method="get" className={`${cartao} absolute left-0 z-10 mt-2 flex gap-2 p-3`}>
            <input type="hidden" name="visao" value={visao} />
            {filtro !== "todas" && <input type="hidden" name="filtro" value={filtro} />}
            {visao === "mes" ? (
              <input name="mes" type="month" defaultValue={mes} className={campo} aria-label="Mês" />
            ) : (
              <input
                name={visao === "dia" ? "data" : "semana"}
                type="date"
                defaultValue={visao === "dia" ? data : semana}
                className={campo}
                aria-label="Data"
              />
            )}
            <button type="submit" className={botaoSecundario}>
              Ver
            </button>
          </form>
        </details>
      </div>

      {/* Filtros (valem para a tela e para o PDF) */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label="Filtro">
        {(Object.keys(ROTULO_FILTRO) as FiltroCobranca[]).map((f) => (
          <Link key={f} href={`/cobrancas?${link({ filtro: f })}`} aria-current={filtro === f ? "true" : undefined} className={chip(filtro === f)}>
            {ROTULO_FILTRO[f]}
          </Link>
        ))}
      </div>

      {visao === "dia" ? (
        <VisaoDoDia base={base} data={data} filtro={filtro} />
      ) : (
        <VisaoAgrupada
          v={visao === "semana" ? visaoSemana(base, semana, hoje, filtro) : visaoMes(base, mes, hoje, filtro)}
          nome={visao === "semana" ? "semana" : "mês"}
          vazio={visao === "semana" ? `Nenhuma parcela nesta semana com este filtro.` : `Nenhuma parcela em ${formatarMes(mes)} com este filtro.`}
        />
      )}
    </>
  );
}

function VisaoDoDia({ base, data, filtro }: { base: Base; data: string; filtro: FiltroCobranca }) {
  const v = visaoDia(base, data, filtro);
  const r = v.resumo;
  return (
    <>
      <section aria-label="Resumo do dia" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Total a cobrar" valor={formatarBRL(r.totalACobrar)} tom="destaque" />
        <Stat rotulo="Vencendo no dia" valor={formatarBRL(r.vencendo.valor)} detalhe={`${r.vencendo.qtd} parcela(s)`} />
        <Stat
          rotulo="Atrasadas"
          valor={formatarBRL(r.atrasadas.valor)}
          detalhe={`${r.atrasadas.qtd} parcela(s)`}
          tom={r.atrasadas.qtd ? "alerta" : "neutro"}
        />
        <Stat
          rotulo="Dívidas"
          valor={formatarBRL(r.dividas.valor)}
          detalhe={`${r.dividas.qtd} parcela(s)`}
          tom={r.dividas.qtd ? "perigo" : "neutro"}
        />
      </section>
      {v.itens.length === 0 ? (
        <Vazio>Nenhuma cobrança em {formatarData(data)} com este filtro.</Vazio>
      ) : (
        <ListaCobrancas itens={v.itens} />
      )}
    </>
  );
}

function VisaoAgrupada({ v, nome, vazio }: { v: VisaoPeriodo; nome: string; vazio: string }) {
  const t = v.totais;
  return (
    <>
      <section aria-label={`Resumo da ${nome}`} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat rotulo={nome === "mês" ? "Previsto no mês" : "Previsto na semana"} valor={formatarBRL(t.previsto)} tom="destaque" />
        <Stat rotulo="Recebido" valor={formatarBRL(t.recebido)} tom="ok" />
        <Stat rotulo="Falta receber" valor={formatarBRL(t.aReceber)} />
        <Stat
          rotulo="Atrasadas"
          valor={formatarBRL(t.atrasadas.valor)}
          detalhe={`${t.atrasadas.qtd} parcela(s)`}
          tom={t.atrasadas.qtd ? "alerta" : "neutro"}
        />
        <Stat
          rotulo="Dívidas"
          valor={formatarBRL(t.dividas.valor)}
          detalhe={`${t.dividas.qtd} parcela(s)`}
          tom={t.dividas.qtd ? "perigo" : "neutro"}
        />
      </section>

      {v.anteriores.length > 0 && (
        <section className="mb-6" aria-label="Atrasados de antes">
          <h2 className="mb-2 text-base font-bold text-red-700 dark:text-red-300">
            Ainda devendo de antes ({v.anteriores.length})
          </h2>
          <ListaCobrancas itens={v.anteriores} />
        </section>
      )}

      {v.dias.length === 0 && v.anteriores.length === 0 ? (
        <Vazio>{vazio}</Vazio>
      ) : (
        <div className="space-y-6">
          {v.dias.map((d) => (
            <section key={d.data} aria-label={`Dia ${formatarData(d.data)}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-borda pb-1">
                <h2 className="text-base font-bold">
                  {maiuscula(diaDaSemana(d.data))}, {formatarData(d.data).slice(0, 5)}
                </h2>
                <p className="text-sm text-suave">
                  Previsto <strong className="text-texto">{formatarBRL(d.previsto)}</strong> • Recebido{" "}
                  <strong className="text-emerald-700 dark:text-emerald-300">{formatarBRL(d.recebido)}</strong>
                </p>
              </div>
              <ListaCobrancas itens={d.itens} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
