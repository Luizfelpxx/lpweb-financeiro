import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role key: IGNORA o RLS. Use somente no servidor, em
 * rotas protegidas por segredo (ex.: cron). Nunca importe em componentes de cliente.
 */
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para usar a rota do cron.",
    );
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
