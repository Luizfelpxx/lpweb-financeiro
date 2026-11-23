"use client";

import { useState, useSyncExternalStore } from "react";
import { botaoPrimario, botaoSecundario } from "./estilos";

const semInscricao = () => () => {};

/** O aparelho consegue compartilhar arquivos PDF (WhatsApp, e-mail…)? */
function suportaCompartilharPdf(): boolean {
  try {
    const teste = new File([""], "teste.pdf", { type: "application/pdf" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [teste] });
  } catch {
    return false;
  }
}

/**
 * Baixa o PDF como arquivo (sem abrir em outra aba) e, no celular, permite
 * enviar direto pelo WhatsApp/e-mail usando o menu de compartilhar do aparelho.
 */
export default function BotaoPdf({
  url,
  nomePadrao,
  rotulo = "",
}: {
  url: string;
  nomePadrao: string;
  /** complemento do texto do botão, ex.: "do dia" → "Enviar PDF do dia" */
  rotulo?: string;
}) {
  const sufixo = rotulo ? ` ${rotulo}` : "";
  const podeCompartilhar = useSyncExternalStore(semInscricao, suportaCompartilharPdf, () => false);
  const [ocupado, setOcupado] = useState<null | "baixar" | "enviar">(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscarArquivo(): Promise<File> {
    const resp = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!resp.ok) {
      const corpo = await resp.json().catch(() => null);
      throw new Error(corpo?.erro ?? "Não foi possível gerar o PDF");
    }
    const nome = resp.headers.get("X-Nome-Arquivo") ?? nomePadrao;
    const blob = await resp.blob();
    return new File([blob], nome, { type: "application/pdf" });
  }

  async function baixar() {
    setErro(null);
    setOcupado("baixar");
    try {
      const arquivo = await buscarArquivo();
      const link = URL.createObjectURL(arquivo);
      const a = document.createElement("a");
      a.href = link;
      a.download = arquivo.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(link), 10_000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao baixar o PDF");
    } finally {
      setOcupado(null);
    }
  }

  async function enviar() {
    setErro(null);
    setOcupado("enviar");
    try {
      const arquivo = await buscarArquivo();
      await navigator.share({ files: [arquivo], title: arquivo.name });
    } catch (e) {
      // "AbortError" = a pessoa fechou o menu de compartilhar; não é erro.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setErro(e instanceof Error ? e.message : "Erro ao compartilhar o PDF");
      }
    } finally {
      setOcupado(null);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex flex-wrap gap-2">
        {podeCompartilhar && (
          <button type="button" onClick={enviar} disabled={ocupado !== null} className={botaoPrimario}>
            {ocupado === "enviar" ? "Gerando…" : `📤 Enviar PDF${sufixo}`}
          </button>
        )}
        <button
          type="button"
          onClick={baixar}
          disabled={ocupado !== null}
          className={podeCompartilhar ? botaoSecundario : botaoPrimario}
        >
          {ocupado === "baixar" ? "Gerando…" : podeCompartilhar ? "⬇ Baixar" : `⬇ Baixar PDF${sufixo}`}
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
