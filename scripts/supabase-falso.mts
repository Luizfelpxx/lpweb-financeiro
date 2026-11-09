/**
 * Backend LOCAL DE TESTE — imita o Supabase (PostgREST + login) e o Telegram.
 *
 * Roda a migração real (supabase/migrations/0001_init.sql) e o seed num Postgres
 * embarcado (PGlite), então RLS, gatilhos de histórico e a função criar_emprestimo
 * funcionam de verdade. NÃO é o Supabase: serve só para experimentar o app sem
 * criar um projeto (e para os testes ponta a ponta).
 *
 *   npm run dev:falso      → sobe em http://127.0.0.1:54321
 *
 * Depois aponte o app para ele (veja "npm run dev:falso" no README):
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=chave-anon-falsa
 *   SUPABASE_SERVICE_ROLE_KEY=chave-service-falsa
 *   TELEGRAM_API_BASE=http://127.0.0.1:54321   (o "Telegram" falso)
 *   login: dono@lpweb.dev / senha-de-teste
 */
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PGlite } from "@electric-sql/pglite";

const PORTA = Number(process.env.PORT ?? 54321);
const EMAIL = process.env.FAKE_EMAIL ?? "dono@lpweb.dev";
const SENHA = process.env.FAKE_SENHA ?? "senha-de-teste";
const SERVICE = process.env.FAKE_SERVICE_KEY ?? "chave-service-falsa";
const USER_ID = "11111111-1111-4111-8111-111111111111";

type Papel = "anon" | "authenticated" | "service";

/* ------------------------------- Banco ------------------------------- */

const db = new PGlite();
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
if (process.env.SEM_SEED !== "1") await db.exec(readFileSync("supabase/seed.sql", "utf8"));

// uma conexão só: serializa as requisições para o SET ROLE não se misturar
let fila: Promise<unknown> = Promise.resolve();
function comPapel<T>(papel: Papel, fn: () => Promise<T>): Promise<T> {
  const tarefa = fila.then(async () => {
    const sub = papel === "authenticated" ? USER_ID : "";
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false);`);
    await db.exec(papel === "service" ? "reset role" : `set role ${papel}`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  });
  fila = tarefa.catch(() => undefined);
  return tarefa;
}

/* ---------------------------- Utilidades HTTP ---------------------------- */

function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    req.on("data", (p) => partes.push(p));
    req.on("end", () => ok(Buffer.concat(partes)));
    req.on("error", falha);
  });
}

function enviar(res: ServerResponse, status: number, corpo?: unknown, extra: Record<string, string> = {}) {
  const json = corpo === undefined ? undefined : JSON.stringify(corpo);
  res.writeHead(status, { "Content-Type": "application/json", ...extra });
  res.end(json);
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function criarJwt(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, role: "authenticated", aud: "authenticated", exp, email: EMAIL })}.assinatura-falsa`;
}
const usuario = () => ({
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: EMAIL,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
});
function sessao() {
  return {
    access_token: criarJwt(),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh-falso",
    user: usuario(),
  };
}

function papelDaRequisicao(req: IncomingMessage): Papel {
  const bearer = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (bearer === SERVICE) return "service";
  if (bearer.split(".").length === 3) {
    try {
      const p = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString());
      if (p.sub === USER_ID && p.exp > Date.now() / 1000) return "authenticated";
    } catch {
      /* token inválido → anon */
    }
  }
  return "anon";
}

/* ------------------------------ Auth (GoTrue) ------------------------------ */

async function auth(req: IncomingMessage, res: ServerResponse, url: URL, corpo: Buffer) {
  const rota = url.pathname.replace("/auth/v1", "");
  if (rota === "/token") {
    const dados = corpo.length ? JSON.parse(corpo.toString()) : {};
    const tipo = url.searchParams.get("grant_type");
    if (tipo === "password" && dados.email === EMAIL && dados.password === SENHA) return enviar(res, 200, sessao());
    if (tipo === "refresh_token" && dados.refresh_token === "refresh-falso") return enviar(res, 200, sessao());
    return enviar(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
  }
  if (rota === "/user") {
    if (papelDaRequisicao(req) !== "authenticated") {
      return enviar(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    return enviar(res, 200, usuario());
  }
  if (rota === "/logout") return enviar(res, 204);
  return enviar(res, 404, { msg: "não implementado no backend falso" });
}

/* ------------------------------ REST (PostgREST) ------------------------------ */

const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABELAS = new Set(["clientes", "emprestimos", "parcelas", "historico", "configuracoes"]);
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`identificador inválido: ${s}`);
  return `"${s}"`;
};

function colunas(select: string | null): string {
  if (!select || select === "*") return "*";
  return select.split(",").map((c) => ident(c.trim())).join(", ");
}

function filtros(params: URLSearchParams, valores: unknown[], prefixo = ""): string {
  const reservados = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);
  const partes: string[] = [];
  for (const [chave, valor] of params) {
    if (reservados.has(chave)) continue;
    const m = /^(eq|neq|gt|gte|lt|lte|ilike|like|in|is)\.([\s\S]*)$/.exec(valor);
    if (!m) throw new Error(`filtro não suportado: ${chave}=${valor}`);
    const [, op, resto] = m;
    const col = `${prefixo}${ident(chave)}`;
    if (op === "in") {
      const itens = resto.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      const marcadores = itens.map((v) => {
        valores.push(v);
        return `$${valores.length}`;
      });
      partes.push(`${col} in (${marcadores.join(", ")})`);
    } else if (op === "is") {
      partes.push(`${col} is ${resto === "null" ? "null" : resto === "true" ? "true" : "false"}`);
    } else {
      valores.push(resto);
      const sql = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", ilike: "ilike", like: "like" }[op]!;
      partes.push(`${col} ${sql} $${valores.length}`);
    }
  }
  return partes.length ? `where ${partes.join(" and ")}` : "";
}

function ordem(params: URLSearchParams): string {
  const o = params.get("order");
  if (!o) return "";
  return (
    "order by " +
    o
      .split(",")
      .map((p) => {
        const [col, dir] = p.split(".");
        return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}`;
      })
      .join(", ")
  );
}

function erroPostgres(res: ServerResponse, e: unknown) {
  const err = e as { message?: string; code?: string; detail?: string };
  const codigo = err.code ?? "";
  const status = codigo === "42501" ? 403 : codigo.startsWith("23") ? 409 : 400;
  console.error(`[falso] erro SQL (${codigo}): ${err.message}`);
  enviar(res, status, { code: codigo, message: err.message, details: err.detail ?? null, hint: null });
}

async function rest(req: IncomingMessage, res: ServerResponse, url: URL, corpo: Buffer) {
  const papel = papelDaRequisicao(req);
  const caminho = url.pathname.replace("/rest/v1/", "");
  const metodo = req.method ?? "GET";
  const prefer = String(req.headers.prefer ?? "");
  const querObjeto = String(req.headers.accept ?? "").includes("application/vnd.pgrst.object+json");
  const querRepresentacao = prefer.includes("return=representation");
  const json = corpo.length ? JSON.parse(corpo.toString()) : null;

  const responder = (linhas: unknown[], statusOk = 200) => {
    if (querObjeto) {
      if (linhas.length !== 1) {
        return enviar(res, 406, {
          code: "PGRST116",
          details: `The result contains ${linhas.length} rows`,
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        });
      }
      return enviar(res, statusOk, linhas[0]);
    }
    return enviar(res, statusOk, linhas);
  };

  try {
    // RPC
    if (caminho.startsWith("rpc/")) {
      const fn = caminho.slice(4);
      if (fn !== "criar_emprestimo") return enviar(res, 404, { message: "função não suportada" });
      const r = await comPapel(papel, () =>
        db.query<{ r: string }>("select public.criar_emprestimo($1::jsonb, $2::jsonb) as r", [
          JSON.stringify(json.p_emprestimo),
          JSON.stringify(json.p_parcelas),
        ]),
      );
      return enviar(res, 200, r.rows[0].r);
    }

    if (!TABELAS.has(caminho)) return enviar(res, 404, { message: "tabela não encontrada" });
    const tabela = `public.${ident(caminho)}`;
    const valores: unknown[] = [];
    const cols = colunas(url.searchParams.get("select"));

    if (metodo === "GET" || metodo === "HEAD") {
      const where = filtros(url.searchParams, valores);
      if (metodo === "HEAD") {
        const r = await comPapel(papel, () => db.query<{ n: number }>(`select count(*)::int as n from ${tabela} ${where}`, valores));
        const n = r.rows[0].n;
        res.writeHead(200, { "Content-Range": `0-${Math.max(n - 1, 0)}/${n}` });
        return res.end();
      }
      const limite = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      const sql =
        `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as r from (` +
        `select ${cols} from ${tabela} ${where} ${ordem(url.searchParams)} ` +
        `${limite ? `limit ${Number.parseInt(limite, 10)}` : ""} ${offset ? `offset ${Number.parseInt(offset, 10)}` : ""}) x`;
      const r = await comPapel(papel, () => db.query<{ r: unknown[] }>(sql, valores));
      return responder(r.rows[0].r);
    }

    if (metodo === "POST") {
      const objetos: Record<string, unknown>[] = Array.isArray(json) ? json : [json];
      const resultado: unknown[] = [];
      for (const obj of objetos) {
        const chaves = Object.keys(obj);
        const lista = chaves.map(ident).join(", ");
        const sql =
          `with ins as (insert into ${tabela} (${lista}) select ${lista} from jsonb_populate_record(null::${tabela}, $1::jsonb) returning *) ` +
          `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as r from (select ${cols} from ins) x`;
        const r = await comPapel(papel, () => db.query<{ r: unknown[] }>(sql, [JSON.stringify(obj)]));
        resultado.push(...r.rows[0].r);
      }
      return querRepresentacao ? responder(resultado, 201) : enviar(res, 201);
    }

    if (metodo === "PATCH") {
      const chaves = Object.keys(json);
      const set = chaves.map((k) => `${ident(k)} = r.${ident(k)}`).join(", ");
      valores.push(JSON.stringify(json));
      const pRec = `$${valores.length}`;
      const where = filtros(url.searchParams, valores, "t.");
      const sql =
        `with upd as (update ${tabela} as t set ${set} from jsonb_populate_record(null::${tabela}, ${pRec}::jsonb) r ${where} returning t.*) ` +
        `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as r from (select ${cols} from upd) x`;
      const r = await comPapel(papel, () => db.query<{ r: unknown[] }>(sql, valores));
      return querRepresentacao ? responder(r.rows[0].r) : enviar(res, 204);
    }

    if (metodo === "DELETE") {
      const where = filtros(url.searchParams, valores);
      const sql =
        `with del as (delete from ${tabela} ${where} returning *) ` +
        `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as r from (select ${cols} from del) x`;
      const r = await comPapel(papel, () => db.query<{ r: unknown[] }>(sql, valores));
      return querRepresentacao ? responder(r.rows[0].r) : enviar(res, 204);
    }

    return enviar(res, 405, { message: "método não suportado" });
  } catch (e) {
    return erroPostgres(res, e);
  }
}

/* ------------------------------ Telegram falso ------------------------------ */

const telegramRecebido: { metodo: string; chat_id?: string; texto?: string; arquivo?: string; pdf?: boolean; bytes?: number; legenda?: string }[] = [];

async function telegram(req: IncomingMessage, res: ServerResponse, url: URL, corpo: Buffer) {
  const metodo = url.pathname.split("/").pop()!;
  if (metodo === "sendMessage") {
    const d = JSON.parse(corpo.toString());
    telegramRecebido.push({ metodo, chat_id: String(d.chat_id), texto: d.text });
    console.log(`[telegram falso] sendMessage → ${d.chat_id}\n${d.text}\n`);
  } else if (metodo === "sendDocument") {
    const bruto = corpo.toString("latin1");
    const nome = /filename="([^"]+)"/.exec(bruto)?.[1];
    const chat = /name="chat_id"\r\n\r\n([^\r]+)/.exec(bruto)?.[1];
    const legenda = /name="caption"\r\n\r\n([^\r]+)/.exec(bruto)?.[1];
    telegramRecebido.push({ metodo, chat_id: chat, arquivo: nome, pdf: bruto.includes("%PDF-"), bytes: corpo.length, legenda });
    console.log(`[telegram falso] sendDocument → ${chat} (${nome}, ${corpo.length} bytes)`);
  } else {
    return enviar(res, 404, { ok: false, description: "método não suportado" });
  }
  return enviar(res, 200, { ok: true, result: { message_id: telegramRecebido.length } });
}

/* ---------------------------------- Servidor ---------------------------------- */

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const corpo = await lerCorpo(req);
  try {
    if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, url, corpo);
    if (url.pathname.startsWith("/rest/v1/")) return await rest(req, res, url, corpo);
    if (url.pathname.startsWith("/bot")) return await telegram(req, res, url, corpo);
    if (url.pathname === "/__telegram") return enviar(res, 200, telegramRecebido);
    if (url.pathname === "/__saude") return enviar(res, 200, { ok: true });
    return enviar(res, 404, { message: "rota desconhecida no backend falso" });
  } catch (e) {
    console.error("[falso] erro:", e);
    return enviar(res, 500, { message: String(e) });
  }
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`Backend falso (Supabase + Telegram) em http://127.0.0.1:${PORTA}`);
  console.log(`Login: ${EMAIL} / ${SENHA}`);
});
