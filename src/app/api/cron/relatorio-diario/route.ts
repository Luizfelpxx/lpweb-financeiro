import { cronAutorizado } from "@/lib/cron-auth";
import { executarRelatorioDiario, resolverChatId } from "@/lib/relatorio-diario";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { TelegramErro } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vercel.json: "0 11 * * *" = 08:00 de Brasília). Protegida por CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    if (!process.env.CRON_SECRET) console.error("[cron] CRON_SECRET não configurado.");
    return Response.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ erro: "TELEGRAM_BOT_TOKEN não configurado" }, { status: 500 });
  }

  try {
    const supabase = criarClienteAdmin();
    const chatId = await resolverChatId(supabase);
    if (!chatId) {
      return Response.json(
        { erro: "Chat id do Telegram não configurado (Configurações ou TELEGRAM_CHAT_ID)" },
        { status: 500 },
      );
    }
    const resultado = await executarRelatorioDiario({ supabase, token, chatId });
    return Response.json({ ok: true, ...resultado });
  } catch (erro) {
    const mensagem = erro instanceof TelegramErro ? erro.message : "Falha ao gerar/enviar o relatório";
    console.error("[cron] relatório diário falhou:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: mensagem }, { status: 500 });
  }
}
