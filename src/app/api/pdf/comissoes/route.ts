import { carregarBase } from "@/lib/dados";
import { relatorioComissoes } from "@/lib/domain/comissoes";
import { eMesISO, hojeSP } from "@/lib/domain/datas";
import { gerarPdfComissao } from "@/lib/pdf/gerar";
import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/pdf/comissoes?mes=2026-11 → PDF das comissões da Geize no mês. */
export async function GET(request: Request) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  const hoje = hojeSP();
  const mes = new URL(request.url).searchParams.get("mes") ?? hoje.slice(0, 7);
  if (!eMesISO(mes)) return Response.json({ erro: "Mês inválido" }, { status: 400 });

  try {
    const r = relatorioComissoes(await carregarBase(supabase), mes).geize;
    const pdf = await gerarPdfComissao(r, hoje);
    const nome = `comissoes-geize-${mes}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "X-Nome-Arquivo": nome,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[pdf comissoes] falha:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível gerar o PDF" }, { status: 500 });
  }
}
