import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarBancoDeTeste } from "./bootstrap-db";

let db: PGlite;
const seed = readFileSync("supabase/seed.sql", "utf8");

beforeAll(async () => {
  db = await criarBancoDeTeste();
  await db.exec(seed);
});
afterAll(() => db.close());

describe("supabase/seed.sql (clientes do PDF)", () => {
  it("cria os 9 clientes do PDF", async () => {
    const r = await db.query<{ nome: string }>("select nome from clientes order by nome");
    expect(r.rows.map((x) => x.nome)).toEqual([
      "Acassio",
      "Gabriela Lima Rodrigues",
      "Gean",
      "Gisele Lima",
      "Humberto Lemos de Moraes",
      "Leticia Feiro",
      "Lucio Marcelo Lima",
      "Sebastiao",
      "Taty Ortis",
    ]);
  });

  it("é idempotente (rodar de novo não duplica nada)", async () => {
    const contar = async () =>
      (await db.query<{ c: number; e: number; p: number }>(
        "select (select count(*) from clientes)::int c, (select count(*) from emprestimos)::int e, (select count(*) from parcelas)::int p",
      )).rows[0];
    const antes = await contar();
    await db.exec(seed);
    expect(await contar()).toEqual(antes);
  });

  it("comissões: geize ≤ R$ 1.000 → 50, > R$ 1.000 → 100; rosangela e sem indicação → 0", async () => {
    const r = await db.query<{ nome: string; indicado_por: string | null; valor_emprestado: string; comissao: string }>(
      `select c.nome, c.indicado_por, e.valor_emprestado::text, e.comissao::text
         from emprestimos e join clientes c on c.id = e.cliente_id order by c.nome`,
    );
    const por = Object.fromEntries(r.rows.map((x) => [x.nome, Number(x.comissao)]));
    expect(por["Gisele Lima"]).toBe(100); // geize, 1.500
    expect(por["Gean"]).toBe(100); // geize, 2.000
    expect(por["Gabriela Lima Rodrigues"]).toBe(100); // geize, 1.200
    expect(por["Leticia Feiro"]).toBe(50); // geize, exatamente 1.000
    expect(por["Humberto Lemos de Moraes"]).toBe(0); // rosangela
    expect(por["Acassio"]).toBe(0); // rosangela
    expect(por["Lucio Marcelo Lima"]).toBe(0); // sem indicação
  });

  it("total a pagar de cada empréstimo = soma das parcelas", async () => {
    const r = await db.query<{ diferentes: number }>(
      `select count(*)::int as diferentes from emprestimos e
        where e.total_a_pagar <> (select sum(valor) from parcelas p where p.emprestimo_id = e.id)`,
    );
    expect(r.rows[0].diferentes).toBe(0);
  });

  it("tem parcelas pagas e em aberto (Gisele 1 paga; Taty quitada)", async () => {
    const r = await db.query<{ nome: string; pagas: number; abertas: number }>(
      `select c.nome,
              count(*) filter (where p.status_pagamento = 'paga')::int pagas,
              count(*) filter (where p.status_pagamento = 'aberta')::int abertas
         from parcelas p join emprestimos e on e.id = p.emprestimo_id join clientes c on c.id = e.cliente_id
        group by c.nome`,
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.nome, x]));
    expect(m["Gisele Lima"]).toMatchObject({ pagas: 1, abertas: 2 });
    expect(m["Taty Ortis"]).toMatchObject({ pagas: 2, abertas: 0 });
  });
});
