"use client";

import { useState, useTransition } from "react";
import { alterarDataPagamento, alternarPagamento, marcarPagaEm } from "@/app/(app)/actions";
import { botao, botaoPequeno, campo } from "@/components/estilos";
import { formatarData } from "@/lib/domain/datas";

const ok = `${botao} ${botaoPequeno} bg-emerald-600 text-white hover:bg-emerald-700`;
const sec = `${botao} ${botaoPequeno} border border-borda bg-cartao text-texto hover:bg-destaque`;
const link = "text-xs font-semibold text-suave underline-offset-2 hover:text-texto hover:underline";

/**
 * Marcar como paga escolhendo o dia do pagamento (hoje já vem preenchido),
 * corrigir a data de um pagamento ou desmarcar.
 */
export default function PagamentoParcela({
  parcelaId,
  paga,
  dataPagamento,
  hoje,
}: {
  parcelaId: string;
  paga: boolean;
  dataPagamento: string | null;
  hoje: string;
}) {
  const [editando, setEditando] = useState(false);
  const [data, setData] = useState(dataPagamento ?? hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function executar(acao: () => Promise<{ erro?: string } | void>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (r && r.erro) setErro(r.erro);
      else setEditando(false);
    });
  }

  const formulario = (confirmar: () => void, rotulo: string) => (
    <span className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`data-${parcelaId}`}>
        Dia do pagamento
      </label>
      <input
        id={`data-${parcelaId}`}
        type="date"
        value={data}
        max={hoje}
        onChange={(e) => setData(e.target.value)}
        className={`${campo} w-auto py-1 text-sm`}
      />
      <button type="button" className={ok} disabled={pendente || !data} onClick={confirmar}>
        {pendente ? "Salvando…" : rotulo}
      </button>
      <button type="button" className={link} disabled={pendente} onClick={() => setEditando(false)}>
        Cancelar
      </button>
    </span>
  );

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {!paga &&
        (editando ? (
          formulario(() => executar(() => marcarPagaEm(parcelaId, data)), "Confirmar")
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={ok}
              disabled={pendente}
              onClick={() => executar(() => marcarPagaEm(parcelaId, hoje))}
            >
              {pendente ? "Salvando…" : "Pagou hoje"}
            </button>
            <button type="button" className={sec} disabled={pendente} onClick={() => setEditando(true)}>
              Pagou em outro dia
            </button>
          </span>
        ))}

      {paga &&
        (editando ? (
          formulario(() => executar(() => alterarDataPagamento(parcelaId, data)), "Salvar data")
        ) : (
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Pago em {formatarData(dataPagamento)}
            </span>
            <button type="button" className={link} disabled={pendente} onClick={() => setEditando(true)}>
              Corrigir data
            </button>
            <button
              type="button"
              className={link}
              disabled={pendente}
              onClick={() => {
                if (window.confirm("Desmarcar este pagamento? A parcela volta a ficar em aberto.")) {
                  executar(() => alternarPagamento(parcelaId, false));
                }
              }}
            >
              Desmarcar
            </button>
          </span>
        ))}

      {erro && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-300">
          {erro}
        </span>
      )}
    </span>
  );
}
