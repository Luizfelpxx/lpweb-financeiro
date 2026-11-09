import { describe, expect, it, vi } from "vitest";
import { visaoDia } from "@/lib/domain/cobrancas";
import {
  TelegramErro,
  dividirMensagem,
  enviarDocumento,
  enviarMensagem,
  mensagemSemCobrancas,
  montarMensagemDiaria,
} from "@/lib/telegram";
import { cenario, HOJE } from "./cenario";

describe("mensagem diária do Telegram", () => {
  const partes = montarMensagemDiaria(visaoDia(cenario(), HOJE));
  const texto = partes.join("\n");

  it("traz o resumo com quantidade e valor", () => {
    expect(texto).toContain("📋 Cobranças de 06/11/2026");
    expect(texto).toContain("• Vencendo hoje: 2 — R$ 1.600,00");
    expect(texto).toContain("• Atrasadas: 1 — R$ 600,00");
    expect(texto).toContain("• Dívidas: 1 — R$ 600,00");
  });

  it("lista cada categoria com nome, telefone, valor e dias de atraso", () => {
    expect(texto).toContain("VENCENDO HOJE (2)");
    expect(texto).toContain("Lucio Marcelo Lima — (11) 90000-0002 — R$ 1.000,00");
    expect(texto).toContain("ATRASADAS (1)");
    expect(texto).toContain("Gisele Lima — (11) 90000-0001 — R$ 600,00");
    expect(texto).toContain("27 dias de atraso");
    expect(texto).toContain("DÍVIDAS (1)");
    expect(texto).toContain("Humberto Lemos de Moraes");
    expect(texto).toContain("52 dias de atraso");
  });

  it("termina com o total a cobrar no dia", () => {
    expect(texto.trimEnd().endsWith("💰 TOTAL A COBRAR NO DIA: R$ 2.800,00")).toBe(true);
  });

  it("mensagem de 'sem cobranças'", () => {
    expect(mensagemSemCobrancas("2026-11-06")).toBe("Nenhuma cobrança hoje (06/11/2026)");
  });

  it("divide mensagens longas em partes de até 3800 caracteres, sempre entre linhas", () => {
    const linhas = Array.from({ length: 300 }, (_, i) => `${i + 1}. Cliente com nome comprido número ${i} — (11) 90000-0000 — R$ 1.000,00`);
    const p = dividirMensagem(linhas);
    expect(p.length).toBeGreaterThan(1);
    expect(p.every((x) => x.length <= 3800)).toBe(true);
    expect(p.join("\n")).toBe(linhas.join("\n"));
  });
});

describe("cliente HTTP do Telegram", () => {
  const TOKEN = "123456:SEGREDO-DO-BOT";

  it("sendMessage: URL do bot, chat_id e texto no corpo JSON", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await enviarMensagem({ token: TOKEN, chatId: "999", texto: "olá", fetchImpl: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ chat_id: "999", text: "olá" });
  });

  it("sendDocument: multipart com o PDF anexado e a legenda", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await enviarDocumento({
      token: TOKEN,
      chatId: "999",
      arquivo: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      nomeArquivo: "relatorio.pdf",
      legenda: "Relatório do dia",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendDocument`);
    const form = init.body as FormData;
    expect(form.get("chat_id")).toBe("999");
    expect(form.get("caption")).toBe("Relatório do dia");
    const doc = form.get("document") as File;
    expect(doc.name).toBe("relatorio.pdf");
    expect(doc.type).toBe("application/pdf");
    expect(doc.size).toBe(4);
  });

  it("erro da API vira TelegramErro com a descrição, sem vazar o token", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 }),
    );
    const erro = await enviarMensagem({ token: TOKEN, chatId: "0", texto: "x", fetchImpl: fetchMock as unknown as typeof fetch }).catch((e) => e);
    expect(erro).toBeInstanceOf(TelegramErro);
    expect(erro.message).toContain("chat not found");
    expect(erro.message).not.toContain("SEGREDO");
  });

  it("falha de rede não vaza o token", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const erro = await enviarMensagem({ token: TOKEN, chatId: "1", texto: "x", fetchImpl: fetchMock as unknown as typeof fetch }).catch((e) => e);
    expect(erro).toBeInstanceOf(TelegramErro);
    expect(erro.message).not.toContain("SEGREDO");
  });
});
