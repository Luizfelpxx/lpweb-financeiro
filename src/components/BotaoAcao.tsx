"use client";

import { useState, useTransition } from "react";
import { botao, botaoPequeno } from "./estilos";

export interface ResultadoAcao {
  erro?: string;
}

const VARIANTES = {
  primario: "bg-primario text-primario-texto hover:opacity-90",
  secundario: "border border-borda bg-cartao text-texto hover:bg-destaque",
  perigo:
    "border border-red-300 bg-cartao text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  ok: "bg-emerald-600 text-white hover:bg-emerald-700",
} as const;

/**
 * Botão que dispara uma Server Action (já "bindada" com seus argumentos), com
 * confirmação opcional, estado de carregamento e mensagem de erro.
 */
export default function BotaoAcao({
  acao,
  children,
  confirmar,
  variante = "secundario",
  pequeno = false,
}: {
  acao: () => Promise<ResultadoAcao | void>;
  children: React.ReactNode;
  confirmar?: string;
  variante?: keyof typeof VARIANTES;
  pequeno?: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pendente}
        className={`${botao} ${VARIANTES[variante]} ${pequeno ? botaoPequeno : ""}`}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return;
          setErro(null);
          iniciar(async () => {
            const r = await acao();
            if (r && r.erro) setErro(r.erro);
          });
        }}
      >
        {pendente ? "Aguarde…" : children}
      </button>
      {erro && (
        <span role="alert" className="max-w-64 text-xs text-red-600 dark:text-red-300">
          {erro}
        </span>
      )}
    </span>
  );
}
