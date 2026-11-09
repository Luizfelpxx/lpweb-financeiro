import type { Metadata } from "next";
import Logo from "@/components/Logo";
import { Alerta } from "@/components/Ui";
import { supabaseConfigurado } from "@/lib/supabase/server";
import FormularioLogin from "./FormularioLogin";

export const metadata: Metadata = { title: "Entrar" };
// Lê variáveis de ambiente em tempo de execução: não pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <Logo className="h-44" />
        </div>
        <div className="rounded-2xl border border-borda bg-cartao p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-bold">Acesso restrito</h1>
          <p className="mb-5 text-sm text-suave">Entre com seu e-mail e senha.</p>
          {!supabaseConfigurado() && (
            <div className="mb-4">
              <Alerta tipo="info">
                Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (veja o <code>.env.example</code>).
              </Alerta>
            </div>
          )}
          <FormularioLogin />
        </div>
        <p className="mt-6 text-center text-xs text-suave">
          LPweb.dev | Assessoria Financeira
        </p>
      </div>
    </main>
  );
}
