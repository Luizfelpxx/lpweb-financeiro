import { diasEntre } from "./datas";
import { somar } from "./dinheiro";
import type { Parcela, StatusCobranca } from "./tipos";

/** Dias de atraso a partir de 1; acima disso a parcela vira dívida. */
export const LIMITE_ATRASADA_DIAS = 30;

export function diasDeAtraso(dataVencimento: string, hoje: string): number {
  return Math.max(0, diasEntre(dataVencimento, hoje));
}

/**
 * Status de cobrança (calculado, nunca gravado):
 * - paga:      status_pagamento = 'paga'
 * - em_aberto: vence hoje ou ainda não venceu
 * - atrasada:  venceu há 1 a 30 dias e não foi paga
 * - divida:    venceu há mais de 30 dias e não foi paga
 */
export function statusCobranca(
  parcela: Pick<Parcela, "status_pagamento" | "data_vencimento">,
  hoje: string,
): StatusCobranca {
  if (parcela.status_pagamento === "paga") return "paga";
  const atraso = diasDeAtraso(parcela.data_vencimento, hoje);
  if (atraso === 0) return "em_aberto";
  return atraso <= LIMITE_ATRASADA_DIAS ? "atrasada" : "divida";
}

export const ROTULO_STATUS: Record<StatusCobranca, string> = {
  em_aberto: "Em aberto",
  atrasada: "Atrasada",
  divida: "Dívida",
  paga: "Paga",
};

/** Saldo devedor = soma das parcelas ainda abertas. */
export function saldoDevedor(
  parcelas: readonly Pick<Parcela, "status_pagamento" | "valor">[],
): number {
  return somar(
    parcelas.filter((p) => p.status_pagamento === "aberta").map((p) => p.valor),
  );
}

/** Total já pago = soma das parcelas pagas. */
export function totalPago(
  parcelas: readonly Pick<Parcela, "status_pagamento" | "valor">[],
): number {
  return somar(
    parcelas.filter((p) => p.status_pagamento === "paga").map((p) => p.valor),
  );
}
