"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { formatarBRL } from "@/lib/domain/dinheiro";
import { executarRelatorioDiario, resolverChatId } from "@/lib/relatorio-diario";
import { TelegramErro } from "@/lib/telegram";

export interface EstadoConfig {
  erro?: string;
  ok?: string;
  /** valores digitados, devolvidos em caso de erro (o React limpa campos não controlados) */
  valores?: { telegram_chat_id: string; hora_relatorio: string };
}

const CHAT_ID = /^(-?\d{3,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function salvarConfiguracoes(_: EstadoConfig, formData: FormData): Promise<EstadoConfig> {
  const { supabase } = await exigirUsuario();
  const chat = String(formData.get("telegram_chat_id") ?? "").trim();
  const hora = String(formData.get("hora_relatorio") ?? "").trim();
  const valores = { telegram_chat_id: chat, hora_relatorio: hora };

  if (chat && !CHAT_ID.test(chat)) {
    return {
      erro: "Chat id inválido. Use o número do chat (ex.: 123456789 ou -1001234567890).",
      valores,
    };
  }
  if (!HORA.test(hora)) return { erro: "Informe a hora no formato HH:MM.", valores };

  const { error } = await supabase
    .from("configuracoes")
    .update({ telegram_chat_id: chat || null, hora_relatorio: `${hora}:00` })
    .eq("id", 1);
  if (error) {
    console.error("[salvarConfiguracoes]", error.message);
    return { erro: "Não foi possível salvar as configurações.", valores };
  }
  revalidatePath("/configuracoes");
  return { ok: "Configurações salvas.", valores };
}

/** Botão "Enviar relatório de teste agora": mesmo fluxo do cron, para o chat configurado. */
export async function enviarRelatorioTeste(): Promise<EstadoConfig> {
  const { supabase } = await exigirUsuario();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { erro: "TELEGRAM_BOT_TOKEN não está configurado no servidor." };
  const chatId = await resolverChatId(supabase);
  if (!chatId) {
    return { erro: "Informe o chat id do Telegram (acima) ou defina TELEGRAM_CHAT_ID." };
  }
  try {
    const r = await executarRelatorioDiario({ supabase, token, chatId });
    return {
      ok:
        r.status === "sem_cobrancas"
          ? "Enviado: “Nenhuma cobrança hoje”. O robô está funcionando."
          : `Enviado: ${r.mensagens} mensagem(ns) + PDF. Total a cobrar hoje: ${formatarBRL(r.totalACobrar)}.`,
    };
  } catch (erro) {
    console.error("[enviarRelatorioTeste]", erro instanceof Error ? erro.message : erro);
    return { erro: erro instanceof TelegramErro ? erro.message : "Falha ao gerar ou enviar o relatório." };
  }
}
