import { carregarBase } from "@/lib/dados";
import { hojeSP } from "@/lib/domain/datas";
import { gerarPlanilha } from "@/lib/planilha/exportar";
import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/exportar → planilha Excel com parcelas, empréstimos e clientes. */
export async function GET() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  try {
    const hoje = hojeSP();
    const planilha = await gerarPlanilha(await carregarBase(supabase), hoje);
    const nome = `lpweb-financeiro-${hoje}.xlsx`;
    return new Response(new Uint8Array(planilha), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "X-Nome-Arquivo": nome,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[exportar] falha:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível gerar a planilha" }, { status: 500 });
  }
}
