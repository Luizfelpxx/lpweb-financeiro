"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel", icone: "▦" },
  { href: "/cobrancas", rotulo: "Cobranças", icone: "$" },
  { href: "/clientes", rotulo: "Clientes", icone: "☺" },
  { href: "/comissoes", rotulo: "Comissões", icone: "%" },
  { href: "/historico", rotulo: "Histórico", icone: "↺" },
  { href: "/importar", rotulo: "Importar", icone: "⇪" },
  { href: "/exportar", rotulo: "Exportar", icone: "⇩" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "⚙" },
];

function ativo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Menu lateral (md+) e barra rolável (celular). */
export default function Navegacao({ orientacao }: { orientacao: "lateral" | "topo" }) {
  const pathname = usePathname();
  const lateral = orientacao === "lateral";
  return (
    <nav
      aria-label="Principal"
      className={
        lateral
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]"
      }
    >
      {ITENS.map((item) => {
        const on = ativo(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              on
                ? "bg-agua/20 text-white ring-1 ring-agua/60"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span aria-hidden className="w-4 text-center text-agua">
              {item.icone}
            </span>
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
