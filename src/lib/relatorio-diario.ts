import type { SupabaseClient } from "@supabase/supabase-js";
import { visaoDia } from "@/lib/domain/cobrancas";
import { formatarData, hojeSP } from "@/lib/domain/datas";
import { nomeArquivoPdf, relatorioDoDia } from "@/lib/domain/relatorio";
import { carregarBase, carregarConfiguracoes } from "@/lib/dados";
import { gerarPdfRelatorio } from "@/lib/pdf/gerar";
import {
  enviarDocumento,
  enviarMensagem,
  mensagemSemCobrancas,
  montarMensagemDiaria,
} from "@/lib/telegram";

export interface ResultadoRelatorioDiario {
  status: "sem_cobrancas" | "enviado";
  data: string;
  mensagens: number;
  pdfEnviado: boolean;
  totalACobrar: number;
}

/** O chat id das Configurações tem prioridade; a variável TELEGRAM_CHAT_ID é o padrão. */
export async function resolverChatId(supabase: SupabaseClient): Promise<string | null> {
  const config = await carregarConfiguracoes(supabase).catch(() => null);
  return config?.telegram_chat_id?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || null;
}

/**
 * Relatório diário: calcula vencendo hoje + atrasadas + dívidas, envia o texto e o
 * PDF da visão do dia pelo Telegram. Sem cobranças: envia só a confirmação.
 * Usado pelo cron (/api/cron/relatorio-diario) e pelo botão de teste das Configurações.
 */
export async function executarRelatorioDiario(args: {
  supabase: SupabaseClient;
  token: string;
  chatId: string;
  hoje?: string;
  fetchImpl?: typeof fetch;
}): Promise<ResultadoRelatorioDiario> {
  const { supabase, token, chatId, fetchImpl } = args;
  const hoje = args.hoje ?? hojeSP();
  const base = await carregarBase(supabase);
  const visao = visaoDia(base, hoje, "todas");
  const { vencendo, atrasadas, dividas, totalACobrar } = visao.resumo;

  if (vencendo.qtd + atrasadas.qtd + dividas.qtd === 0) {
    await enviarMensagem({ token, chatId, texto: mensagemSemCobrancas(hoje), fetchImpl });
    return { status: "sem_cobrancas", data: hoje, mensagens: 1, pdfEnviado: false, totalACobrar: 0 };
  }

  const partes = montarMensagemDiaria(visao);
  for (const texto of partes) await enviarMensagem({ token, chatId, texto, fetchImpl });

  const dados = relatorioDoDia(base, hoje, "todas", hoje);
  const pdf = await gerarPdfRelatorio(dados);
  await enviarDocumento({
    token,
    chatId,
    arquivo: pdf,
    nomeArquivo: nomeArquivoPdf(dados),
    legenda: `Relatório de cobranças — ${formatarData(hoje)}`,
    fetchImpl,
  });
  return {
    status: "enviado",
    data: hoje,
    mensagens: partes.length,
    pdfEnviado: true,
    totalACobrar,
  };
}
