import { carregarBase } from "@/lib/dados";
import {
  cobrancaDaSemana,
  cobrancaDoDia,
  cobrancaDoMes,
  lerFiltroIndicacao,
  nomeArquivoCobranca,
} from "@/lib/domain/cobrancaPdf";
import { lerFiltro } from "@/lib/domain/cobrancas";
import { eDataISO, eMesISO, hojeSP } from "@/lib/domain/datas";
import { nomeArquivoPdf, relatorioDoDia, relatorioDoMes } from "@/lib/domain/relatorio";
import { gerarPdfCobranca, gerarPdfRelatorio } from "@/lib/pdf/gerar";
import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/pdf?visao=dia&data=2026-11-06&filtro=dividas&indicado=geize
 * GET /api/pdf?visao=semana&semana=2026-11-16 (qualquer dia da semana)
 * GET /api/pdf?visao=mes&mes=2026-11
 * modelo=cobranca (padrão): lista de cobrança agrupada por situação, sem telefone/comissão.
 * modelo=completo: relatório executivo antigo (uma linha por empréstimo, com comissão).
 */
export async function GET(request: Request) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const hoje = hojeSP();
  const filtro = lerFiltro(params.get("filtro"));
  const indicacao = lerFiltroIndicacao(params.get("indicado"));
  const v = params.get("visao");
  const visao = v === "mes" || v === "semana" ? v : "dia";
  // o relatório completo (antigo) só existe para dia e mês
  const modelo = params.get("modelo") === "completo" && visao !== "semana" ? "completo" : "cobranca";

  const data = params.get("data") ?? hoje;
  const mes = params.get("mes") ?? hoje.slice(0, 7);
  const semana = params.get("semana") ?? hoje;
  if (visao === "semana" && !eDataISO(semana))
    return Response.json({ erro: "Semana inválida" }, { status: 400 });
  if (visao === "dia" && !eDataISO(data))
    return Response.json({ erro: "Data inválida" }, { status: 400 });
  if (visao === "mes" && !eMesISO(mes))
    return Response.json({ erro: "Mês inválido" }, { status: 400 });

  try {
    const base = await carregarBase(supabase);
    let pdf: Buffer;
    let nome: string;
    if (modelo === "cobranca") {
      const dados =
        visao === "dia"
          ? cobrancaDoDia(base, data, filtro, indicacao, hoje)
          : visao === "semana"
            ? cobrancaDaSemana(base, semana, hoje, filtro, indicacao)
            : cobrancaDoMes(base, mes, hoje, filtro, indicacao);
      pdf = await gerarPdfCobranca(dados);
      nome = nomeArquivoCobranca(dados);
    } else {
      const dados =
        visao === "dia"
          ? relatorioDoDia(base, data, filtro, hoje)
          : relatorioDoMes(base, mes, hoje, filtro);
      pdf = await gerarPdfRelatorio(dados);
      nome = nomeArquivoPdf(dados);
    }
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "X-Nome-Arquivo": nome,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[pdf] falha:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível gerar o PDF" }, { status: 500 });
  }
}
