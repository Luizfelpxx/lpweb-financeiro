import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cronAutorizado } from "@/lib/cron-auth";
import { hojeSP } from "@/lib/domain/datas";
import { executarRelatorioDiario } from "@/lib/relatorio-diario";
import { cenario, HOJE } from "./cenario";
import { montarBase, supabaseFalso } from "./fixtures";

const TOKEN = "123:TOKEN-DE-TESTE";

/** fetch falso do Telegram: registra método chamado e conteúdo. */
function telegramFalso() {
  const chamadas: { metodo: string; corpo: unknown }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const metodo = String(url).split("/").pop()!;
    chamadas.push({ metodo, corpo: init?.body });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  });
  return { chamadas, impl: impl as unknown as typeof fetch };
}

describe("executarRelatorioDiario", () => {
  it("com cobranças: envia o texto e depois o PDF como documento", async () => {
    const { chamadas, impl } = telegramFalso();
    const r = await executarRelatorioDiario({
      supabase: supabaseFalso(cenario()),
      token: TOKEN,
      chatId: "555",
      hoje: HOJE,
      fetchImpl: impl,
    });
    expect(r).toMatchObject({ status: "enviado", pdfEnviado: true, totalACobrar: 2800, data: HOJE });
    expect(chamadas.map((c) => c.metodo)).toEqual(["sendMessage", "sendDocument"]);

    const texto = JSON.parse(chamadas[0].corpo as string);
    expect(texto.chat_id).toBe("555");
    expect(texto.text).toContain("TOTAL A COBRAR NO DIA: R$ 2.800,00");

    const form = chamadas[1].corpo as FormData;
    const doc = form.get("document") as File;
    expect(doc.name).toBe("relatorio-dia-2026-11-06.pdf");
    const bytes = Buffer.from(await doc.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(form.get("caption")).toContain("06/11/2026");
  });

  it("sem cobranças: envia somente 'Nenhuma cobrança hoje (DD/MM/AAAA)'", async () => {
    const { chamadas, impl } = telegramFalso();
    const base = montarBase([
      { id: "c1", nome: "Quitado", emprestimos: [{ id: "e1", valorEmprestado: 100, numeroParcelas: 1, valorParcela: 120, primeiroVencimento: "2026-10-01", pagas: 1 }] },
    ]);
    const r = await executarRelatorioDiario({ supabase: supabaseFalso(base), token: TOKEN, chatId: "555", hoje: HOJE, fetchImpl: impl });
    expect(r.status).toBe("sem_cobrancas");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].metodo).toBe("sendMessage");
    expect(JSON.parse(chamadas[0].corpo as string).text).toBe("Nenhuma cobrança hoje (06/11/2026)");
  });

  it("parcela que vence hoje mas já está paga não conta como cobrança", async () => {
    const { chamadas, impl } = telegramFalso();
    const base = montarBase([
      { id: "c1", nome: "Pago hoje", emprestimos: [{ id: "e1", valorEmprestado: 100, numeroParcelas: 1, valorParcela: 120, primeiroVencimento: HOJE, pagas: 1 }] },
    ]);
    const r = await executarRelatorioDiario({ supabase: supabaseFalso(base), token: TOKEN, chatId: "1", hoje: HOJE, fetchImpl: impl });
    expect(r.status).toBe("sem_cobrancas");
    expect(chamadas.map((c) => c.metodo)).toEqual(["sendMessage"]);
  });

  it("usa a data de hoje em Brasília por padrão", async () => {
    const { impl } = telegramFalso();
    const r = await executarRelatorioDiario({ supabase: supabaseFalso(montarBase([])), token: TOKEN, chatId: "1", fetchImpl: impl });
    expect(r.data).toBe(hojeSP());
  });
});

describe("cronAutorizado", () => {
  it("aceita apenas 'Bearer <CRON_SECRET>' exato", () => {
    expect(cronAutorizado("Bearer segredo", "segredo")).toBe(true);
    expect(cronAutorizado("Bearer outro", "segredo")).toBe(false);
    expect(cronAutorizado("segredo", "segredo")).toBe(false);
    expect(cronAutorizado(null, "segredo")).toBe(false);
    expect(cronAutorizado("", "segredo")).toBe(false);
  });
  it("sem CRON_SECRET configurado, nega tudo (falha fechada)", () => {
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado(null, undefined)).toBe(false);
  });
});

describe("rota /api/cron/relatorio-diario", () => {
  const ambienteOriginal = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "segredo-do-cron";
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_CHAT_ID = "777";
  });
  afterEach(() => {
    process.env = { ...ambienteOriginal };
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/supabase/admin");
  });

  const chamar = async (authorization?: string) => {
    const { GET } = await import("@/app/api/cron/relatorio-diario/route");
    return GET(new Request("http://localhost/api/cron/relatorio-diario", { headers: authorization ? { authorization } : {} }));
  };

  it("401 sem o header Authorization / com segredo errado", async () => {
    expect((await chamar()).status).toBe(401);
    expect((await chamar("Bearer errado")).status).toBe(401);
  });

  it("401 quando CRON_SECRET não está configurado", async () => {
    delete process.env.CRON_SECRET;
    expect((await chamar("Bearer undefined")).status).toBe(401);
  });

  it("com o segredo certo: executa o relatório e envia ao Telegram", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({ criarClienteAdmin: () => supabaseFalso(cenario()) }));
    const { chamadas, impl } = telegramFalso();
    vi.stubGlobal("fetch", impl);
    const resposta = await chamar("Bearer segredo-do-cron");
    expect(resposta.status).toBe(200);
    const json = await resposta.json();
    expect(json.ok).toBe(true);
    // a data real é "hoje" (o cenário de teste usa datas fixas de 2026): só verifica o envio
    expect(chamadas.length).toBeGreaterThanOrEqual(1);
    expect(chamadas[0].metodo).toBe("sendMessage");
    expect(JSON.parse(chamadas[0].corpo as string).chat_id).toBe("777");
  });

  it("500 quando o token do Telegram não está configurado", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await chamar("Bearer segredo-do-cron")).status).toBe(500);
  });
});
