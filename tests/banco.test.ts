import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calcularEmprestimo } from "@/lib/domain/emprestimo";

/**
 * Executa a migração real (supabase/migrations/0001_init.sql) num Postgres
 * embarcado, simulando as roles e o auth.uid() do Supabase.
 */
const DONO = "11111111-1111-1111-1111-111111111111";
let db: PGlite;

async function comoDono<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${DONO}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function comoAnonimo<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("select set_config('request.jwt.claim.sub', '', false); set role anon;");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function novoCliente(nome: string, indicado: string | null = null): Promise<string> {
  const r = await comoDono(() =>
    db.query<{ id: string }>(
      "insert into clientes (nome, telefone, indicado_por) values ($1, '(11) 90000-0000', $2) returning id",
      [nome, indicado],
    ),
  );
  return r.rows[0].id;
}

async function novoEmprestimo(clienteId: string, valor: number, n: number, parcela: number, primeiro: string, indicado: "geize" | "rosangela" | null = null) {
  const calc = calcularEmprestimo({
    valorEmprestado: valor,
    numeroParcelas: n,
    valorParcela: parcela,
    primeiroVencimento: primeiro,
    indicadoPor: indicado,
  });
  const r = await comoDono(() =>
    db.query<{ criar_emprestimo: string }>("select criar_emprestimo($1::jsonb, $2::jsonb)", [
      JSON.stringify({
        cliente_id: clienteId,
        valor_emprestado: calc.valorEmprestado,
        numero_parcelas: calc.numeroParcelas,
        valor_parcela: calc.valorParcela,
        total_a_pagar: calc.totalAPagar,
        primeiro_vencimento: primeiro,
        taxa_juros_percentual: calc.taxaJurosPercentual,
        comissao: calc.comissao,
      }),
      JSON.stringify(calc.parcelas),
    ]),
  );
  return r.rows[0].criar_emprestimo;
}

beforeAll(async () => {
  db = new PGlite();
  // Pré-requisitos que o Supabase já fornece
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
});

afterAll(async () => {
  await db.close();
});

describe("migração SQL (Postgres embarcado)", () => {
  it("cria as 5 tabelas com RLS ativado", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and relkind = 'r' order by relname`,
    );
    expect(r.rows.map((x) => x.relname)).toEqual(["clientes", "configuracoes", "emprestimos", "historico", "parcelas"]);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });

  it("anônimo não lê nem escreve nada", async () => {
    await expect(comoAnonimo(() => db.query("select * from clientes"))).rejects.toThrow(/permission denied/i);
    await expect(
      comoAnonimo(() => db.query("insert into clientes (nome, telefone) values ('x', '1')")),
    ).rejects.toThrow(/permission denied/i);
    await expect(comoAnonimo(() => db.query("select * from historico"))).rejects.toThrow(/permission denied/i);
  });

  it("usuário autenticado acessa os dados; configuracoes tem a linha padrão (08:00)", async () => {
    const r = await comoDono(() => db.query<{ hora_relatorio: string }>("select hora_relatorio::text from configuracoes"));
    expect(r.rows).toEqual([{ hora_relatorio: "08:00:00" }]);
  });

  it("cria empréstimo + parcelas atomicamente e grava no histórico com o usuário", async () => {
    const cliente = await novoCliente("Gisele Lima", "geize");
    const emp = await novoEmprestimo(cliente, 1500, 3, 600, "2026-12-10", "geize");

    const parcelas = await comoDono(() =>
      db.query<{ numero_parcela: number; data_vencimento: string; status_pagamento: string }>(
        "select numero_parcela, data_vencimento::text, status_pagamento from parcelas where emprestimo_id = $1 order by 1",
        [emp],
      ),
    );
    expect(parcelas.rows.map((p) => p.data_vencimento)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
    expect(parcelas.rows.every((p) => p.status_pagamento === "aberta")).toBe(true);

    const e = await comoDono(() =>
      db.query<{ comissao: string; total_a_pagar: string; taxa_juros_percentual: string }>(
        "select comissao::text, total_a_pagar::text, taxa_juros_percentual::text from emprestimos where id = $1",
        [emp],
      ),
    );
    expect(e.rows[0]).toEqual({ comissao: "100.00", total_a_pagar: "1800.00", taxa_juros_percentual: "20.00" });

    const h = await comoDono(() =>
      db.query<{ tabela: string; acao: string; usuario_id: string; cliente_id: string }>(
        "select tabela, acao, usuario_id, cliente_id from historico where cliente_id = $1 order by criado_em, tabela",
        [cliente],
      ),
    );
    expect(h.rows.filter((x) => x.tabela === "clientes")).toHaveLength(1);
    expect(h.rows.filter((x) => x.tabela === "emprestimos")).toHaveLength(1);
    expect(h.rows.filter((x) => x.tabela === "parcelas")).toHaveLength(3);
    expect(h.rows.every((x) => x.acao === "criar" && x.usuario_id === DONO)).toBe(true);
  });

  it("falha na criação das parcelas desfaz o empréstimo inteiro", async () => {
    const cliente = await novoCliente("Rollback");
    await expect(
      comoDono(() =>
        db.query("select criar_emprestimo($1::jsonb, $2::jsonb)", [
          JSON.stringify({
            cliente_id: cliente, valor_emprestado: 100, numero_parcelas: 2, valor_parcela: 60,
            total_a_pagar: 120, primeiro_vencimento: "2026-12-10", taxa_juros_percentual: 20, comissao: 0,
          }),
          // número de parcela duplicado → viola unique (emprestimo_id, numero_parcela)
          JSON.stringify([
            { numero_parcela: 1, valor: 60, data_vencimento: "2026-12-10" },
            { numero_parcela: 1, valor: 60, data_vencimento: "2027-01-10" },
          ]),
        ]),
      ),
    ).rejects.toThrow();
    const r = await db.query("select 1 from emprestimos where cliente_id = $1", [cliente]);
    expect(r.rows).toHaveLength(0);
  });

  it("marcar paga / desmarcar paga: grava data, histórico com antes/depois", async () => {
    const cliente = await novoCliente("Pagamento");
    const emp = await novoEmprestimo(cliente, 500, 2, 300, "2026-12-10");
    const p = await db.query<{ id: string }>("select id from parcelas where emprestimo_id = $1 and numero_parcela = 1", [emp]);
    const id = p.rows[0].id;

    await comoDono(() => db.query("update parcelas set status_pagamento = 'paga', data_pagamento = '2026-12-09' where id = $1", [id]));
    let h = await db.query<{ acao: string; dados_antes: { status_pagamento: string }; dados_depois: { status_pagamento: string; data_pagamento: string } }>(
      "select acao, dados_antes, dados_depois from historico where registro_id = $1 and acao <> 'criar'", [id],
    );
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].acao).toBe("marcar_paga");
    expect(h.rows[0].dados_antes.status_pagamento).toBe("aberta");
    expect(h.rows[0].dados_depois).toMatchObject({ status_pagamento: "paga", data_pagamento: "2026-12-09" });

    await comoDono(() => db.query("update parcelas set status_pagamento = 'aberta', data_pagamento = null where id = $1", [id]));
    h = await db.query("select acao, dados_antes, dados_depois from historico where registro_id = $1 and acao <> 'criar' order by criado_em, id", [id]);
    expect(h.rows.map((x) => x.acao).sort()).toEqual(["desmarcar_paga", "marcar_paga"]);
  });

  it("não aceita parcela 'paga' sem data de pagamento (nem 'aberta' com data)", async () => {
    const cliente = await novoCliente("Constraint");
    const emp = await novoEmprestimo(cliente, 500, 1, 600, "2026-12-10");
    await expect(
      comoDono(() => db.query("update parcelas set status_pagamento = 'paga' where emprestimo_id = $1", [emp])),
    ).rejects.toThrow(/check/i);
    await expect(
      comoDono(() => db.query("update parcelas set data_pagamento = '2026-12-01' where emprestimo_id = $1", [emp])),
    ).rejects.toThrow(/check/i);
  });

  it("não permite excluir cliente com empréstimo ativo; arquivar vai para o histórico", async () => {
    const cliente = await novoCliente("Ativo");
    await novoEmprestimo(cliente, 500, 2, 300, "2026-12-10");
    await expect(comoDono(() => db.query("delete from clientes where id = $1", [cliente]))).rejects.toThrow(
      /empréstimos ativos/i,
    );
    await comoDono(() => db.query("update clientes set arquivado = true where id = $1", [cliente]));
    const h = await db.query<{ acao: string }>(
      "select acao from historico where registro_id = $1 and tabela = 'clientes' and acao <> 'criar'", [cliente],
    );
    expect(h.rows.map((x) => x.acao)).toEqual(["arquivar"]);
  });

  it("cliente com empréstimos (mesmo quitados) não é excluído: histórico financeiro preservado", async () => {
    const cliente = await novoCliente("Quitado");
    const emp = await novoEmprestimo(cliente, 500, 1, 600, "2026-12-10");
    await comoDono(() =>
      db.query("update parcelas set status_pagamento = 'paga', data_pagamento = '2026-12-10' where emprestimo_id = $1", [emp]),
    );
    await expect(comoDono(() => db.query("delete from clientes where id = $1", [cliente]))).rejects.toThrow(/foreign key|violates/i);
  });

  it("cliente sem empréstimos pode ser excluído e a exclusão fica no histórico", async () => {
    const cliente = await novoCliente("Sem empréstimo");
    await comoDono(() => db.query("delete from clientes where id = $1", [cliente]));
    const h = await db.query<{ acao: string; dados_antes: { nome: string } }>(
      "select acao, dados_antes from historico where registro_id = $1 and acao = 'excluir'", [cliente],
    );
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].dados_antes.nome).toBe("Sem empréstimo");
  });

  it("o usuário não consegue alterar nem apagar o histórico", async () => {
    await expect(comoDono(() => db.query("delete from historico"))).rejects.toThrow(/permission denied/i);
    await expect(comoDono(() => db.query("update historico set acao = 'editar'"))).rejects.toThrow(/permission denied/i);
    await expect(
      comoDono(() => db.query("insert into historico (tabela, registro_id, acao) values ('clientes', gen_random_uuid(), 'criar')")),
    ).rejects.toThrow(/permission denied/i);
  });

  it("atualização sem mudança real não gera histórico; atualizado_em avança", async () => {
    const cliente = await novoCliente("Sem mudança");
    const antes = await db.query<{ atualizado_em: string }>("select atualizado_em::text from clientes where id = $1", [cliente]);
    await comoDono(() => db.query("update clientes set nome = nome where id = $1", [cliente]));
    const h = await db.query("select 1 from historico where registro_id = $1 and acao = 'editar'", [cliente]);
    expect(h.rows).toHaveLength(0);
    await comoDono(() => db.query("update clientes set telefone = '(11) 91111-1111' where id = $1", [cliente]));
    const depois = await db.query<{ atualizado_em: string }>("select atualizado_em::text from clientes where id = $1", [cliente]);
    expect(depois.rows[0].atualizado_em >= antes.rows[0].atualizado_em).toBe(true);
    const h2 = await db.query("select 1 from historico where registro_id = $1 and acao = 'editar'", [cliente]);
    expect(h2.rows).toHaveLength(1);
  });

  it("excluir empréstimo apaga as parcelas e registra no histórico", async () => {
    const cliente = await novoCliente("Excluir empréstimo");
    const emp = await novoEmprestimo(cliente, 500, 2, 300, "2026-12-10");
    await comoDono(() => db.query("delete from emprestimos where id = $1", [emp]));
    const parc = await db.query("select 1 from parcelas where emprestimo_id = $1", [emp]);
    expect(parc.rows).toHaveLength(0);
    const h = await db.query<{ tabela: string }>("select tabela from historico where acao = 'excluir' and (registro_id = $1 or dados_antes ->> 'emprestimo_id' = $1::text)", [emp]);
    expect(h.rows.filter((x) => x.tabela === "emprestimos")).toHaveLength(1);
    expect(h.rows.filter((x) => x.tabela === "parcelas")).toHaveLength(2);
  });
});
