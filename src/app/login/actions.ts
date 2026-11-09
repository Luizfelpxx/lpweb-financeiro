"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor, supabaseConfigurado } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro?: string;
  /** devolvido para o campo não ser apagado quando o React reinicia o formulário */
  email?: string;
}

export async function entrar(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  if (!supabaseConfigurado()) {
    return { email, erro: "O sistema ainda não foi configurado (variáveis do Supabase ausentes)." };
  }
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { email, erro: "Informe e-mail e senha." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { email, erro: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
