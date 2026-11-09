import type { ItemCobranca, VisaoDia } from "./domain/cobrancas";
import { formatarBRL } from "./domain/dinheiro";
import { formatarData } from "./domain/datas";
import { rotuloParcelas } from "./domain/emprestimo";

/** Permite apontar para um proxy/servidor de teste; o padrão é a API oficial. */
const apiBase = () => process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
/** O Telegram aceita até 4096 caracteres por mensagem; deixamos folga. */
const LIMITE_MENSAGEM = 3800;

export class TelegramErro extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "TelegramErro";
  }
}

type FetchLike = typeof fetch;

async function chamar(
  token: string,
  metodo: string,
  corpo: BodyInit,
  fetchImpl: FetchLike,
  headers?: Record<string, string>,
): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetchImpl(`${apiBase()}/bot${token}/${metodo}`, {
      method: "POST",
      body: corpo,
      headers,
    });
  } catch {
    // Não repassamos o erro original: ele pode conter a URL (e, nela, o token).
    throw new TelegramErro("Não foi possível conectar à API do Telegram.");
  }
  let json: { ok?: boolean; description?: string } = {};
  try {
    json = await resposta.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!resposta.ok || !json.ok) {
    throw new TelegramErro(
      `Telegram recusou a requisição (${resposta.status}): ${json.description ?? "sem detalhes"}`,
    );
  }
}

export async function enviarMensagem(args: {
  token: string;
  chatId: string;
  texto: string;
  fetchImpl?: FetchLike;
}): Promise<void> {
  await chamar(
    args.token,
    "sendMessage",
    JSON.stringify({
      chat_id: args.chatId,
      text: args.texto,
      disable_web_page_preview: true,
    }),
    args.fetchImpl ?? fetch,
    { "Content-Type": "application/json" },
  );
}

export async function enviarDocumento(args: {
  token: string;
  chatId: string;
  arquivo: Uint8Array;
  nomeArquivo: string;
  legenda?: string;
  fetchImpl?: FetchLike;
}): Promise<void> {
  const form = new FormData();
  form.append("chat_id", args.chatId);
  if (args.legenda) form.append("caption", args.legenda);
  form.append(
    "document",
    new Blob([new Uint8Array(args.arquivo)], { type: "application/pdf" }),
    args.nomeArquivo,
  );
  await chamar(args.token, "sendDocument", form, args.fetchImpl ?? fetch);
}

/** Quebra o texto em mensagens de até `limite` caracteres, sempre entre linhas. */
export function dividirMensagem(linhas: string[], limite = LIMITE_MENSAGEM): string[] {
  const partes: string[] = [];
  let atual = "";
  for (const linha of linhas) {
    const candidato = atual === "" ? linha : `${atual}\n${linha}`;
    if (candidato.length > limite && atual !== "") {
      partes.push(atual);
      atual = linha;
    } else {
      atual = candidato;
    }
  }
  if (atual !== "") partes.push(atual);
  return partes;
}

function linhaDoItem(item: ItemCobranca, indice: number, comAtraso: boolean): string {
  const telefone = item.cliente.telefone || "sem telefone";
  const parcela = `parcela ${item.parcela.numero_parcela}/${
    item.emprestimo.numero_parcelas === 30 ? 1 : item.emprestimo.numero_parcelas
  } (${rotuloParcelas(item.emprestimo.numero_parcelas)})`;
  const base = `${indice + 1}. ${item.cliente.nome} — ${telefone} — ${formatarBRL(item.parcela.valor)} — ${parcela}`;
  return comAtraso
    ? `${base} — ${item.diasAtraso} ${item.diasAtraso === 1 ? "dia" : "dias"} de atraso`
    : base;
}

/** Mensagem do relatório diário (já dividida em partes que cabem no Telegram). */
export function montarMensagemDiaria(visao: VisaoDia): string[] {
  const { resumo } = visao;
  const abertas = (status: ItemCobranca["status"]) =>
    visao.itens.filter((i) => i.status === status);
  const vencendo = abertas("em_aberto");
  const atrasadas = abertas("atrasada");
  const dividas = abertas("divida");

  const linhas: string[] = [
    `📋 Cobranças de ${formatarData(visao.data)}`,
    "LPweb.dev | Assessoria Financeira",
    "",
    "RESUMO",
    `• Vencendo hoje: ${resumo.vencendo.qtd} — ${formatarBRL(resumo.vencendo.valor)}`,
    `• Atrasadas: ${resumo.atrasadas.qtd} — ${formatarBRL(resumo.atrasadas.valor)}`,
    `• Dívidas: ${resumo.dividas.qtd} — ${formatarBRL(resumo.dividas.valor)}`,
  ];

  const secao = (titulo: string, itens: ItemCobranca[], comAtraso: boolean) => {
    if (itens.length === 0) return;
    linhas.push("", `${titulo} (${itens.length})`);
    itens.forEach((item, i) => linhas.push(linhaDoItem(item, i, comAtraso)));
  };
  secao("VENCENDO HOJE", vencendo, false);
  secao("ATRASADAS", atrasadas, true);
  secao("🔴 DÍVIDAS", dividas, true);

  linhas.push("", `💰 TOTAL A COBRAR NO DIA: ${formatarBRL(resumo.totalACobrar)}`);
  return dividirMensagem(linhas);
}

export function mensagemSemCobrancas(data: string): string {
  return `Nenhuma cobrança hoje (${formatarData(data)})`;
}
