"use client";

import { useState, useTransition } from "react";
import { definirComissao } from "@/app/(app)/actions";
import { botao, botaoPequeno, campo } from "@/components/estilos";
import { formatarBRL } from "@/lib/domain/dinheiro";

const ok = `${botao} ${botaoPequeno} bg-emerald-600 text-white hover:bg-emerald-700`;
const link = "text-xs font-semibold text-suave underline-offset-2 hover:text-texto hover:underline";

/** Valor da comissão de um empréstimo, com opção de colocar à mão ou voltar ao automático. */
export default function ComissaoManual({
  emprestimoId,
  comissao,
  comissaoAutomatica,
  manual,
}: {
  emprestimoId: string;
  comissao: number;
  comissaoAutomatica: number;
  manual: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(comissao.toFixed(2).replace(".", ","));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function executar(novo: string | null) {
    setErro(null);
    iniciar(async () => {
      const r = await definirComissao(emprestimoId, novo);
      if (r.erro) setErro(r.erro);
      else setEditando(false);
    });
  }

  if (editando) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <span className="flex flex-wrap items-center justify-end gap-2">
          <label className="sr-only" htmlFor={`comissao-${emprestimoId}`}>
            Valor da comissão
          </label>
          <span className="text-xs text-suave">R$</span>
          <input
            id={`comissao-${emprestimoId}`}
            inputMode="decimal"
            value={valor}
            autoFocus
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && executar(valor)}
            className={`${campo} w-24 py-1 text-right text-sm`}
          />
          <button type="button" className={ok} disabled={pendente || !valor.trim()} onClick={() => executar(valor)}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </span>
        <span className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs text-suave">Pela regra: {formatarBRL(comissaoAutomatica)}</span>
          <button type="button" className={link} disabled={pendente} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </span>
        {erro && (
          <span role="alert" className="text-xs text-red-600 dark:text-red-300">
            {erro}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="font-semibold whitespace-nowrap">{formatarBRL(comissao)}</span>
      {manual && (
        <span className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          manual (regra {formatarBRL(comissaoAutomatica)})
        </span>
      )}
      <span className="flex flex-wrap items-center justify-end gap-x-3">
        <button type="button" className={link} disabled={pendente} onClick={() => setEditando(true)}>
          Alterar
        </button>
        {manual && (
          <button type="button" className={link} disabled={pendente} onClick={() => executar(null)}>
            {pendente ? "Salvando…" : "Usar regra"}
          </button>
        )}
      </span>
      {erro && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-300">
          {erro}
        </span>
      )}
    </span>
  );
}
