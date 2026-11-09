import { emCentavos } from "./dinheiro";
import type { IndicadoPor } from "./tipos";

export const LIMITE_COMISSAO_GEIZE = 1000;
export const COMISSAO_GEIZE_ALTA = 100;
export const COMISSAO_GEIZE_BAIXA = 50;

/**
 * Comissão calculada sobre o valor EMPRESTADO (não sobre o total a pagar):
 * - geize: > R$ 1.000,00 → R$ 100,00; <= R$ 1.000,00 → R$ 50,00
 * - rosangela: 0 (os relatórios exibem "—")
 * - sem indicação: 0
 */
export function calcularComissao(
  valorEmprestado: number,
  indicadoPor: IndicadoPor | null | undefined,
): number {
  if (indicadoPor !== "geize") return 0;
  return emCentavos(valorEmprestado) > emCentavos(LIMITE_COMISSAO_GEIZE)
    ? COMISSAO_GEIZE_ALTA
    : COMISSAO_GEIZE_BAIXA;
}

export const NOME_INDICADOR: Record<IndicadoPor, string> = {
  geize: "Geize",
  rosangela: "Rosangela",
};
