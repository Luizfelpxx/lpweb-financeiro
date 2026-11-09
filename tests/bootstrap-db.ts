import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/** Postgres embarcado com as roles/auth.uid() do Supabase e a migração real aplicada. */
export async function criarBancoDeTeste(): Promise<PGlite> {
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
  return db;
}
