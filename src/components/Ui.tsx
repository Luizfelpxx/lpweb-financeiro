import type { ReactNode } from "react";
import type { StatusCobranca } from "@/lib/domain/tipos";
import { ROTULO_STATUS } from "@/lib/domain/status";
import { cartao } from "./estilos";

export function Titulo({
  children,
  acao,
  sub,
}: {
  children: ReactNode;
  acao?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-texto md:text-2xl">{children}</h1>
        {sub && <p className="mt-1 text-sm text-suave">{sub}</p>}
      </div>
      {acao && <div className="flex flex-wrap items-center gap-2">{acao}</div>}
    </div>
  );
}

const TONS = {
  neutro: "",
  alerta: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
  perigo: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
  ok: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
  destaque: "border-agua bg-destaque",
} as const;

export function Stat({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
  grande = false,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom?: keyof typeof TONS;
  grande?: boolean;
}) {
  return (
    <div className={`${cartao} p-4 ${TONS[tom]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-suave">{rotulo}</p>
      <p className={`mt-1 font-bold text-texto ${grande ? "text-3xl" : "text-xl"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-suave">{detalhe}</p>}
    </div>
  );
}

const CLASSE_STATUS: Record<StatusCobranca, string> = {
  em_aberto: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  atrasada: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  divida: "bg-red-100 font-bold text-red-800 dark:bg-red-900/50 dark:text-red-200",
  paga: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export function StatusBadge({
  status,
  dias,
}: {
  status: StatusCobranca;
  dias?: number;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASSE_STATUS[status]}`}
    >
      {ROTULO_STATUS[status]}
      {dias && dias > 0 && status !== "paga" ? ` • ${dias}d` : ""}
    </span>
  );
}

export function Etiqueta({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "agua" | "aviso" }) {
  const cores = {
    neutro: "bg-borda/60 text-suave",
    agua: "bg-destaque text-texto ring-1 ring-agua/50",
    aviso: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  } as const;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cores[tom]}`}>
      {children}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className={`${cartao} p-8 text-center text-sm text-suave`}>{children}</div>
  );
}

export function Alerta({
  children,
  tipo = "erro",
}: {
  children: ReactNode;
  tipo?: "erro" | "ok" | "info";
}) {
  const cores = {
    erro: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    info: "border-agua bg-destaque text-texto",
  } as const;
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${cores[tipo]}`}>
      {children}
    </div>
  );
}
