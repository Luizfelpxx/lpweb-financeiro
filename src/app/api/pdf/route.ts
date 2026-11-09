import { carregarBase } from "@/lib/dados";
import { lerFiltro } from "@/lib/domain/cobrancas";
import { eDataISO, eMesISO, hojeSP } from "@/lib/domain/datas";
import { nomeArquivoPdf, relatorioDoDia, relatorioDoMes } from "@/lib/domain/relatorio";
import { gerarPdfRelatorio } from "@/lib/pdf/gerar";
import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/pdf?visao=dia&data=2026-11-06&filtro=dividas  |  ?visao=mes&mes=2026-11 */
export async function GET(request: Request) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const hoje = hojeSP();
  const filtro = lerFiltro(params.get("filtro"));
  const visao = params.get("visao") === "mes" ? "mes" : "dia";

  const data = params.get("data") ?? hoje;
  const mes = params.get("mes") ?? hoje.slice(0, 7);
  if (visao === "dia" && !eDataISO(data))
    return Response.json({ erro: "Data inválida" }, { status: 400 });
  if (visao === "mes" && !eMesISO(mes))
    return Response.json({ erro: "Mês inválido" }, { status: 400 });

  try {
    const base = await carregarBase(supabase);
    const dados =
      visao === "dia"
        ? relatorioDoDia(base, data, filtro, hoje)
        : relatorioDoMes(base, mes, hoje, filtro);
    const pdf = await gerarPdfRelatorio(dados);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoPdf(dados)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[pdf] falha:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível gerar o PDF" }, { status: 500 });
  }
}
