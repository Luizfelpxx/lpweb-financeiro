import type { Metadata } from "next";
import { Stat, Titulo, Vazio } from "@/components/Ui";
import { botaoPrimario, botaoSecundario, campo, cartao, rotulo } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarBase } from "@/lib/dados";
import {
  ROTULO_FILTRO,
  lerFiltro,
  visaoDia,
  visaoMes,
} from "@/lib/domain/cobrancas";
import {
  diaDaSemana,
  eDataISO,
  eMesISO,
  formatarData,
  formatarMes,
  hojeSP,
} from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import ListaCobrancas from "./ListaCobrancas";
import Link from "next/link";

export const metadata: Metadata = { title: "Cobranças" };

export default async function PaginaCobrancas({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; data?: string; mes?: string; filtro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await exigirUsuario();
  const hoje = hojeSP();
  const visao = sp.visao === "mes" ? "mes" : "dia";
  const filtro = lerFiltro(sp.filtro);
  const data = sp.data && eDataISO(sp.data) ? sp.data : hoje;
  const mes = sp.mes && eMesISO(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const base = await carregarBase(supabase);

  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ filtro, ...extra }).toString();
  const urlPdf =
    visao === "dia"
      ? `/api/pdf?${qs({ visao: "dia", data })}`
      : `/api/pdf?${qs({ visao: "mes", mes })}`;

  const aba = (ativa: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${
      ativa ? "bg-primario text-primario-texto" : "border border-borda bg-cartao hover:bg-destaque"
    }`;

  return (
    <>
      <Titulo
        sub={
          visao === "dia"
            ? `${diaDaSemana(data)}, ${formatarData(data)}`
            : `${formatarMes(mes)}`
        }
        acao={
          <a href={urlPdf} className={botaoPrimario}>
            ⬇ Baixar PDF
          </a>
        }
      >
        Cobranças
      </Titulo>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Visão">
          <Link href={`/cobrancas?${qs({ visao: "dia", data })}`} role="tab" aria-selected={visao === "dia"} className={aba(visao === "dia")}>
            Dia
          </Link>
          <Link href={`/cobrancas?${qs({ visao: "mes", mes })}`} role="tab" aria-selected={visao === "mes"} className={aba(visao === "mes")}>
            Mês
          </Link>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="visao" value={visao} />
          <div>
            <label htmlFor={visao === "dia" ? "data" : "mes"} className={rotulo}>
              {visao === "dia" ? "Data" : "Mês"}
            </label>
            {visao === "dia" ? (
              <input id="data" name="data" type="date" defaultValue={data} className={campo} />
            ) : (
              <input id="mes" name="mes" type="month" defaultValue={mes} className={campo} />
            )}
          </div>
          <div>
            <label htmlFor="filtro" className={rotulo}>
              Filtro (tela e PDF)
            </label>
            <select id="filtro" name="filtro" defaultValue={filtro} className={campo}>
              {(Object.keys(ROTULO_FILTRO) as (keyof typeof ROTULO_FILTRO)[]).map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FILTRO[f]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={botaoSecundario}>
            Ver
          </button>
          {visao === "dia" && data !== hoje && (
            <Link href={`/cobrancas?${qs({ visao: "dia" })}`} className={botaoSecundario}>
              Hoje
            </Link>
          )}
        </form>
      </div>

      {visao === "dia" ? <VisaoDoDia base={base} data={data} filtro={filtro} /> : <VisaoDoMes base={base} mes={mes} hoje={hoje} filtro={filtro} />}
    </>
  );
}

function VisaoDoDia({
  base,
  data,
  filtro,
}: {
  base: Awaited<ReturnType<typeof carregarBase>>;
  data: string;
  filtro: ReturnType<typeof lerFiltro>;
}) {
  const v = visaoDia(base, data, filtro);
  const r = v.resumo;
  return (
    <>
      <section aria-label="Resumo do dia" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Vencendo na data" valor={formatarBRL(r.vencendo.valor)} detalhe={`${r.vencendo.qtd} parcela(s)`} />
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
        <Stat rotulo="Total a cobrar" valor={formatarBRL(r.totalACobrar)} tom="destaque" />
      </section>
      {v.itens.length === 0 ? (
        <Vazio>Nenhuma cobrança para {formatarData(data)} com este filtro.</Vazio>
      ) : (
        <ListaCobrancas itens={v.itens} />
      )}
    </>
  );
}

function VisaoDoMes({
  base,
  mes,
  hoje,
  filtro,
}: {
  base: Awaited<ReturnType<typeof carregarBase>>;
  mes: string;
  hoje: string;
  filtro: ReturnType<typeof lerFiltro>;
}) {
  const v = visaoMes(base, mes, hoje, filtro);
  const t = v.totais;
  return (
    <>
      <section aria-label="Resumo do mês" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat rotulo="Total previsto" valor={formatarBRL(t.previsto)} tom="destaque" />
        <Stat rotulo="Total recebido" valor={formatarBRL(t.recebido)} tom="ok" />
        <Stat rotulo="A receber no mês" valor={formatarBRL(t.aReceber)} />
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
        <section className="mb-6" aria-label="Atrasadas e dívidas de meses anteriores">
          <h2 className="mb-2 text-base font-bold">Atrasadas e dívidas de meses anteriores</h2>
          <ListaCobrancas itens={v.anteriores} />
        </section>
      )}

      {v.dias.length === 0 && v.anteriores.length === 0 ? (
        <Vazio>Nenhuma parcela em {formatarMes(mes)} com este filtro.</Vazio>
      ) : (
        <div className="space-y-6">
          {v.dias.map((d) => (
            <section key={d.data} aria-label={`Dia ${formatarData(d.data)}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold">
                  {formatarData(d.data)}{" "}
                  <span className="text-sm font-normal capitalize text-suave">{diaDaSemana(d.data)}</span>
                </h2>
                <p className="text-sm text-suave">
                  Previsto <strong className="text-texto">{formatarBRL(d.previsto)}</strong> • Recebido{" "}
                  <strong className="text-emerald-700 dark:text-emerald-300">{formatarBRL(d.recebido)}</strong>
                </p>
              </div>
              <ListaCobrancas itens={d.itens} />
            </section>
          ))}
          <div className={`${cartao} flex flex-wrap justify-between gap-2 p-4 text-sm font-semibold`}>
            <span>Total do mês</span>
            <span>
              Previsto {formatarBRL(t.previsto)} • Recebido {formatarBRL(t.recebido)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
