"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const PRINCIPAIS = [
  { href: "/", rotulo: "Painel", icone: "▦" },
  { href: "/cobrancas", rotulo: "Cobranças", icone: "$" },
  { href: "/clientes", rotulo: "Clientes", icone: "☺" },
  { href: "/comissoes", rotulo: "Comissões", icone: "%" },
];

const MAIS = [
  { href: "/historico", rotulo: "Histórico", icone: "↺" },
  { href: "/importar", rotulo: "Importar planilha", icone: "⇪" },
  { href: "/exportar", rotulo: "Exportar planilha (Excel)", icone: "⇩" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "⚙" },
];

function ativo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Barra de navegação fixa no rodapé (celular), com menu "Mais". */
export default function BarraInferior({ rodapeMenu }: { rodapeMenu?: ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const maisAtivo = MAIS.some((i) => ativo(pathname, i.href));

  const item = (on: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
      on ? "text-agua" : "text-slate-300"
    }`;

  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setAberto(false)} aria-hidden />
      )}
      {aberto && (
        <div
          role="menu"
          className="fixed inset-x-3 z-40 rounded-2xl bg-marinho-escuro p-2 shadow-xl ring-1 ring-white/10 md:hidden"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
        >
          {MAIS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                ativo(pathname, i.href) ? "bg-agua/20 text-white" : "text-slate-200 hover:bg-white/10"
              }`}
            >
              <span aria-hidden className="w-5 text-center text-agua">
                {i.icone}
              </span>
              {i.rotulo}
            </Link>
          ))}
          {rodapeMenu && <div className="mt-1 border-t border-white/10 pt-1">{rodapeMenu}</div>}
        </div>
      )}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-marinho-escuro pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {PRINCIPAIS.map((i) => {
          const on = ativo(pathname, i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={item(on)} onClick={() => setAberto(false)}>
              <span aria-hidden className={`grid size-7 place-items-center rounded-full text-base ${on ? "bg-agua/20" : ""}`}>
                {i.icone}
              </span>
              {i.rotulo}
            </Link>
          );
        })}
        <button type="button" className={item(maisAtivo || aberto)} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          <span aria-hidden className={`grid size-7 place-items-center rounded-full text-base ${maisAtivo || aberto ? "bg-agua/20" : ""}`}>
            ⋯
          </span>
          Mais
        </button>
      </nav>
    </>
  );
}
