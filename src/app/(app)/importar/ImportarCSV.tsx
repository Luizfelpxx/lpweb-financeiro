"use client";

import { useMemo, useState, useTransition } from "react";
import { botaoPrimario, botaoSecundario, cartao } from "@/components/estilos";
import { Alerta } from "@/components/Ui";
import {
  MODELO_CSV,
  ORDEM_COLUNAS,
  linhaTemErro,
  validarImportacao,
  type Campo,
} from "@/lib/importacao";
import { importarCSV, type ResultadoImportacao } from "./actions";

/** CSVs exportados pelo Excel costumam vir em Windows-1252; tenta UTF-8 e, se falhar, usa 1252. */
async function lerArquivo(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const TITULOS: Record<Campo, string> = {
  nome: "nome",
  telefone: "telefone",
  valor_emprestado: "valor_emprestado",
  numero_parcelas: "parcelas",
  valor_parcela: "valor_parcela",
  primeiro_vencimento: "1º vencimento",
  indicado_por: "indicado_por",
  valor_pago: "valor_pago",
  data_emprestimo: "data_emprestimo",
};

export default function ImportarCSV() {
  const [texto, setTexto] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importando, iniciar] = useTransition();

  const validacao = useMemo(() => (texto == null ? null : validarImportacao(texto)), [texto]);
  const validas = validacao?.linhas.filter((l) => !linhaTemErro(l)).length ?? 0;
  const comErro = (validacao?.linhas.length ?? 0) - validas;

  function baixarModelo() {
    const blob = new Blob(["\uFEFF" + MODELO_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className={`${cartao} space-y-3 p-5`}>
        <p className="text-sm">
          Envie um arquivo CSV com as colunas:{" "}
          <code className="text-xs">
            nome, telefone, valor_emprestado, numero_parcelas, valor_parcela, primeiro_vencimento,
            indicado_por, valor_pago
          </code>
          . Use <strong>30</strong> em <code className="text-xs">numero_parcelas</code> para “30 dias”
          (pagamento único). Datas em <code className="text-xs">DD/MM/AAAA</code> e valores como{" "}
          <code className="text-xs">1.250,00</code>. Registros sem <code className="text-xs">valor_pago</code>{" "}
          ficam como <strong>não pago</strong>.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            aria-label="Arquivo CSV"
            className="text-sm file:mr-3 file:rounded-lg file:border file:border-borda file:bg-cartao file:px-3 file:py-2 file:text-sm file:font-semibold"
            onChange={async (e) => {
              const arquivo = e.target.files?.[0];
              setResultado(null);
              if (!arquivo) return setTexto(null);
              setNomeArquivo(arquivo.name);
              setTexto(await lerArquivo(arquivo));
            }}
          />
          <button type="button" onClick={baixarModelo} className={botaoSecundario}>
            Baixar modelo
          </button>
        </div>
      </div>

      {validacao?.erroGeral && <Alerta>{validacao.erroGeral}</Alerta>}

      {validacao && !validacao.erroGeral && (
        <section className="space-y-3" aria-label="Prévia da importação">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{nomeArquivo}</strong> — {validacao.linhas.length} linha(s):{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{validas} válida(s)</span>
              {comErro > 0 && (
                <>
                  , <span className="font-semibold text-red-700 dark:text-red-300">{comErro} com erro</span>
                </>
              )}
            </p>
            <button
              type="button"
              disabled={validas === 0 || importando || resultado != null}
              onClick={() => {
                if (texto == null) return;
                iniciar(async () => setResultado(await importarCSV(texto)));
              }}
              className={botaoPrimario}
            >
              {importando ? "Importando…" : `Importar ${validas} linha(s) válida(s)`}
            </button>
          </div>
          {comErro > 0 && (
            <Alerta tipo="info">
              Linhas com erro (em vermelho) <strong>não serão importadas</strong>. Corrija o arquivo e
              envie novamente, se necessário.
            </Alerta>
          )}

          <div className={`${cartao} overflow-x-auto`}>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-suave">
                  <th className="px-2 py-2">Linha</th>
                  {ORDEM_COLUNAS.map((c) => (
                    <th key={c} className="px-2 py-2">
                      {TITULOS[c]}
                    </th>
                  ))}
                  <th className="px-2 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {validacao.linhas.map((l) => {
                  const erro = linhaTemErro(l);
                  return (
                    <tr key={l.linha} className={erro ? "bg-red-50/60 dark:bg-red-950/20" : ""}>
                      <td className="px-2 py-1.5 text-suave">{l.linha}</td>
                      {ORDEM_COLUNAS.map((c) => {
                        const msg = l.erros[c];
                        return (
                          <td
                            key={c}
                            title={msg}
                            className={`px-2 py-1.5 ${
                              msg
                                ? "bg-red-100 font-semibold text-red-800 ring-1 ring-red-400 ring-inset dark:bg-red-900/50 dark:text-red-200"
                                : ""
                            }`}
                          >
                            {l.brutos[c] || (msg ? "∅" : "")}
                            {msg && <span className="block text-xs font-normal">{msg}</span>}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-xs">
                        {erro ? (
                          <span className="font-semibold text-red-700 dark:text-red-300">Com erro</span>
                        ) : (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                            OK
                            {l.parcelasPagas > 0 ? ` • ${l.parcelasPagas} parcela(s) paga(s)` : " • não pago"}
                          </span>
                        )}
                        {l.avisos.map((a) => (
                          <span key={a} className="mt-0.5 block text-amber-700 dark:text-amber-300">
                            ⚠ {a}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {resultado && (
        <section aria-label="Resultado da importação" className="space-y-2">
          {resultado.erro ? (
            <Alerta>{resultado.erro}</Alerta>
          ) : (
            <Alerta tipo="ok">
              Importação concluída: <strong>{resultado.importados}</strong> empréstimo(s) importado(s),{" "}
              {resultado.clientesNovos} cliente(s) novo(s)
              {resultado.ignorados.length > 0 && <>, {resultado.ignorados.length} já existente(s) ignorado(s)</>}
              {resultado.comErro > 0 && <>, {resultado.comErro} linha(s) com erro não importada(s)</>}.
            </Alerta>
          )}
          {[...resultado.ignorados, ...resultado.falhas].map((x) => (
            <p key={`${x.linha}-${x.motivo}`} className="text-xs text-suave">
              Linha {x.linha}: {x.motivo}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
