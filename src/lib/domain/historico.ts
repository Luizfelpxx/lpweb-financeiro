import { formatarData, FUSO } from "./datas";
import { formatarBRL } from "./dinheiro";
import { rotuloParcelas } from "./emprestimo";
import type { AcaoHistorico, Historico } from "./tipos";

export const ROTULO_ACAO: Record<AcaoHistorico, string> = {
  criar: "Criação",
  editar: "Edição",
  excluir: "Exclusão",
  marcar_paga: "Marcada como paga",
  desmarcar_paga: "Desmarcada",
  arquivar: "Arquivamento",
  desarquivar: "Desarquivamento",
};

export const ROTULO_TABELA: Record<Historico["tabela"], string> = {
  clientes: "Cliente",
  emprestimos: "Empréstimo",
  parcelas: "Parcela",
};

const CAMPOS_CLIENTE: Record<string, string> = {
  nome: "nome",
  telefone: "telefone",
  cpf: "CPF",
  endereco: "endereço",
  observacoes: "observações",
  indicado_por: "indicação",
};

const IGNORAR = new Set(["atualizado_em", "criado_em"]);

function camposAlterados(h: Historico): string[] {
  const antes = h.dados_antes ?? {};
  const depois = h.dados_depois ?? {};
  return Object.keys({ ...antes, ...depois }).filter(
    (k) => !IGNORAR.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]),
  );
}

const str = (v: unknown) => (v == null ? "" : String(v));

/** Texto legível para uma linha do histórico. */
export function descreverHistorico(h: Historico): string {
  const d = (h.dados_depois ?? h.dados_antes ?? {}) as Record<string, unknown>;

  if (h.tabela === "clientes") {
    const nome = str(d.nome);
    switch (h.acao) {
      case "criar":
        return `Cliente ${nome} cadastrado`;
      case "excluir":
        return `Cliente ${nome} excluído`;
      case "arquivar":
        return `Cliente ${nome} arquivado`;
      case "desarquivar":
        return `Cliente ${nome} reativado (desarquivado)`;
      default: {
        const campos = camposAlterados(h).map((c) => CAMPOS_CLIENTE[c] ?? c);
        return `Dados de ${nome} alterados${campos.length ? ` (${campos.join(", ")})` : ""}`;
      }
    }
  }

  if (h.tabela === "emprestimos") {
    const base = `Empréstimo de ${formatarBRL(Number(d.valor_emprestado))} em ${rotuloParcelas(Number(d.numero_parcelas))}`;
    const verbo = { criar: "criado", excluir: "excluído" }[h.acao as string] ?? "alterado";
    return `${base} ${verbo}`;
  }

  const parcela = `Parcela ${str(d.numero_parcela)} (venc. ${formatarData(str(d.data_vencimento))}, ${formatarBRL(Number(d.valor))})`;
  switch (h.acao) {
    case "criar":
      return `${parcela} gerada`;
    case "marcar_paga":
      return `${parcela} marcada como paga`;
    case "desmarcar_paga":
      return `${parcela} desmarcada — o valor voltou a ser devido`;
    case "excluir":
      return `${parcela} excluída`;
    default:
      return `${parcela} alterada`;
  }
}

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatarDataHora(iso: string): string {
  return fmtHora.format(new Date(iso)).replace(",", "");
}
