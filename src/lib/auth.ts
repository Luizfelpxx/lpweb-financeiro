import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Garante usuário autenticado (valida o token no Supabase Auth). Use em TODA
 * página/Server Action: o proxy sozinho não basta (Server Actions são POSTs na própria rota).
 */
export async function exigirUsuario() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
