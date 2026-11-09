import Image from "next/image";
import Navegacao from "@/components/Navegacao";
import { exigirUsuario } from "@/lib/auth";
import { sair } from "../login/actions";

function BotaoSair({ className }: { className?: string }) {
  return (
    <form action={sair}>
      <button
        type="submit"
        className={`rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white ${className ?? ""}`}
      >
        Sair
      </button>
    </form>
  );
}

export default async function LayoutDoSistema({ children }: { children: React.ReactNode }) {
  const { user } = await exigirUsuario();

  return (
    <div className="min-h-dvh md:flex">
      {/* Menu lateral (desktop/tablet) */}
      <aside className="hidden bg-marinho-escuro md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col md:p-4">
        <div className="mb-5 flex justify-center pt-1">
          <Image
            src="/logo/logo-escuro.png"
            alt="LPweb.dev | Assessoria Financeira"
            width={768}
            height={768}
            sizes="144px"
            priority
            className="size-36 rounded-2xl ring-1 ring-white/10"
          />
        </div>
        <Navegacao orientacao="lateral" />
        <div className="mt-auto border-t border-white/10 pt-3">
          <p className="truncate px-3 text-xs text-slate-400" title={user.email ?? ""}>
            {user.email}
          </p>
          <BotaoSair className="mt-1 w-full text-left" />
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:ml-60">
        {/* Barra superior (celular): emblema + nome */}
        <header className="sticky top-0 z-20 bg-marinho-escuro pt-[env(safe-area-inset-top)] md:hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo/emblema.png"
                alt=""
                width={192}
                height={192}
                sizes="40px"
                priority
                className="size-10 rounded-xl ring-1 ring-white/10"
              />
              <div className="leading-tight">
                <p className="text-base font-bold text-white">
                  LPweb<span className="text-agua">.dev</span>
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Assessoria Financeira
                </p>
              </div>
            </div>
            <BotaoSair />
          </div>
          <Navegacao orientacao="topo" />
        </header>

        <main className="mx-auto w-full max-w-6xl p-4 pb-16 md:p-8">{children}</main>
      </div>
    </div>
  );
}
