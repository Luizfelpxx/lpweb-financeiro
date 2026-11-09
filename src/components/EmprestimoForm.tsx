"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { criarEmprestimo, type EstadoForm } from "@/app/(app)/actions";
import { botaoPrimario, botaoSecundario, campo, cartao, rotulo } from "@/components/estilos";
import { Alerta } from "@/components/Ui";
import { calcularComissao, NOME_INDICADOR } from "@/lib/domain/comissao";
import { formatarData } from "@/lib/domain/datas";
import { formatarBRL, lerValorBR } from "@/lib/domain/dinheiro";
import {
  MAX_PARCELAS,
  PERCENTUAIS_SUGERIDOS,
  PRAZO_30_DIAS,
  gerarParcelas,
  quantidadeDeParcelas,
  sugerirJuros,
  taxaDeJuros,
} from "@/lib/domain/emprestimo";
import type { IndicadoPor } from "@/lib/domain/tipos";

const OPCOES_PARCELAS = [
  ...Array.from({ length: MAX_PARCELAS }, (_, i) => ({ valor: i + 1, texto: `${i + 1}x` })),
  { valor: PRAZO_30_DIAS, texto: "30 dias (pagamento único)" },
];

export default function EmprestimoForm({
  clienteId,
  nomeCliente,
  indicadoPor,
  hoje,
}: {
  clienteId: string;
  nomeCliente: string;
  indicadoPor: IndicadoPor | null;
  hoje: string;
}) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(criarEmprestimo, {});
  const [valorTexto, setValorTexto] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [parcelaTexto, setParcelaTexto] = useState("");
  const [vencimento, setVencimento] = useState("");
  // campos controlados: o React limpa os não controlados após o envio do formulário
  const [dataEmprestimo, setDataEmprestimo] = useState(hoje);
  const [percentualLivre, setPercentualLivre] = useState("");
  const [percentualEscolhido, setPercentualEscolhido] = useState<number | null>(null);

  const valor = lerValorBR(valorTexto);
  const valorParcela = lerValorBR(parcelaTexto);
  const qtd = quantidadeDeParcelas(parcelas);

  const resumo = useMemo(() => {
    if (!valor || !valorParcela) return null;
    const total = Math.round(valorParcela * qtd * 100) / 100;
    return {
      total,
      taxa: taxaDeJuros(valor, total),
      comissao: calcularComissao(valor, indicadoPor),
      datas: vencimento
        ? gerarParcelas({ numeroParcelas: parcelas, valorParcela, primeiroVencimento: vencimento })
        : [],
    };
  }, [valor, valorParcela, qtd, parcelas, vencimento, indicadoPor]);

  /** Escolher um percentual só sugere o valor da parcela; o campo continua editável. */
  function aplicarPercentual(p: number) {
    if (!valor) return;
    setPercentualEscolhido(p);
    const { valorParcela: sugerida } = sugerirJuros(valor, p, parcelas);
    setParcelaTexto(sugerida.toFixed(2).replace(".", ","));
  }

  const percentualLivreNumero = lerValorBR(percentualLivre);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form action={acao} className={`${cartao} space-y-4 p-5`}>
        <input type="hidden" name="cliente_id" value={clienteId} />
        <p className="text-sm text-suave">
          Cliente: <strong className="text-texto">{nomeCliente}</strong>
          {indicadoPor && <> • indicado por {NOME_INDICADOR[indicadoPor]}</>}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="valor_emprestado" className={rotulo}>
              Valor emprestado (R$) *
            </label>
            <input
              id="valor_emprestado"
              name="valor_emprestado"
              inputMode="decimal"
              required
              value={valorTexto}
              onChange={(e) => {
                setValorTexto(e.target.value);
                setPercentualEscolhido(null);
              }}
              className={campo}
              placeholder="1.000,00"
            />
          </div>
          <div>
            <label htmlFor="numero_parcelas" className={rotulo}>
              Número de parcelas *
            </label>
            <select
              id="numero_parcelas"
              name="numero_parcelas"
              value={parcelas}
              onChange={(e) => {
                const n = Number(e.target.value);
                setParcelas(n);
                // mantém a sugestão coerente com o novo nº de parcelas
                if (valor && percentualEscolhido != null) {
                  setParcelaTexto(
                    sugerirJuros(valor, percentualEscolhido, n).valorParcela.toFixed(2).replace(".", ","),
                  );
                }
              }}
              className={campo}
            >
              {OPCOES_PARCELAS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="valor_parcela" className={rotulo}>
              Valor de cada parcela (R$) *
            </label>
            <input
              id="valor_parcela"
              name="valor_parcela"
              inputMode="decimal"
              required
              value={parcelaTexto}
              onChange={(e) => {
                setParcelaTexto(e.target.value);
                setPercentualEscolhido(null);
              }}
              className={campo}
              placeholder="650,00"
            />
            <p className="mt-1 text-xs text-suave">O valor acordado com o cliente prevalece sobre a sugestão.</p>
          </div>
          <div>
            <label htmlFor="primeiro_vencimento" className={rotulo}>
              Data da primeira parcela *
            </label>
            <input
              id="primeiro_vencimento"
              name="primeiro_vencimento"
              type="date"
              required
              min="2000-01-01"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="data_emprestimo" className={rotulo}>
              Data do empréstimo
            </label>
            <input
              id="data_emprestimo"
              name="data_emprestimo"
              type="date"
              value={dataEmprestimo}
              onChange={(e) => setDataEmprestimo(e.target.value)}
              className={campo}
            />
            <p className="mt-1 text-xs text-suave">Usada no relatório mensal de comissões.</p>
          </div>
        </div>

        {/* Conferência antes de salvar */}
        {resumo && (
          <div className="rounded-lg border border-agua bg-destaque p-3 text-sm">
            <p>
              <strong>Total a pagar:</strong> {formatarBRL(resumo.total)} •{" "}
              <strong>juros de referência:</strong> {resumo.taxa.toLocaleString("pt-BR")}%
              {indicadoPor === "geize" && (
                <>
                  {" "}
                  • <strong>comissão:</strong> {formatarBRL(resumo.comissao)}
                </>
              )}
              {indicadoPor === "rosangela" && (
                <>
                  {" "}
                  • <strong>comissão:</strong> —
                </>
              )}
            </p>
            {resumo.datas.length > 0 && (
              <p className="mt-1 text-xs text-suave">
                Vencimentos:{" "}
                {resumo.datas.map((p) => `${p.numero_parcela}) ${formatarData(p.data_vencimento)}`).join(" • ")}
              </p>
            )}
          </div>
        )}

        {estado.erro && <Alerta>{estado.erro}</Alerta>}
        <div className="flex gap-2">
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? "Salvando…" : "Salvar empréstimo"}
          </button>
          <Link href={`/clientes/${clienteId}`} className={botaoSecundario}>
            Cancelar
          </Link>
        </div>
      </form>

      {/* Painel lateral de sugestão de juros (somente referência) */}
      <aside className={`${cartao} h-fit space-y-3 p-5`} aria-label="Sugestão de juros">
        <h2 className="font-bold">Sugestão de juros</h2>
        <p className="text-xs text-suave">
          Apenas referência. Escolha um percentual para sugerir o valor de cada parcela (total ÷ nº de
          parcelas) e ajuste manualmente se quiser.
        </p>
        {!valor && <p className="text-sm text-suave">Informe o valor emprestado para ver os totais.</p>}
        {valor && (
          <ul className="space-y-1.5">
            {PERCENTUAIS_SUGERIDOS.map((p) => {
              const s = sugerirJuros(valor, p, parcelas);
              const ativo = percentualEscolhido === p;
              return (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => aplicarPercentual(p)}
                    aria-pressed={ativo}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      ativo ? "border-agua bg-destaque" : "border-borda hover:bg-destaque"
                    }`}
                  >
                    <span className="font-semibold">{p}%</span>
                    <span className="text-right">
                      <span className="block font-medium">{formatarBRL(s.total)}</span>
                      <span className="block text-xs text-suave">
                        {qtd}× {formatarBRL(s.valorParcela)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div>
          <label htmlFor="percentual_livre" className={rotulo}>
            Outro percentual
          </label>
          <div className="flex gap-2">
            <input
              id="percentual_livre"
              inputMode="decimal"
              value={percentualLivre}
              onChange={(e) => setPercentualLivre(e.target.value)}
              className={campo}
              placeholder="12,5"
            />
            <button
              type="button"
              disabled={!valor || percentualLivreNumero == null || percentualLivreNumero < 0}
              onClick={() => percentualLivreNumero != null && aplicarPercentual(percentualLivreNumero)}
              className={botaoSecundario}
            >
              Usar
            </button>
          </div>
          {valor && percentualLivreNumero != null && percentualLivreNumero >= 0 && (
            <p className="mt-1 text-xs text-suave">
              Total com {percentualLivreNumero.toLocaleString("pt-BR")}%:{" "}
              {formatarBRL(sugerirJuros(valor, percentualLivreNumero, parcelas).total)}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
