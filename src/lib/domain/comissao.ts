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

/**
 * Valida a comissão digitada à mão para um empréstimo (ex.: "50", "50,00", "R$ 75,50").
 * Pode ser zero, mas nunca negativa nem maior que o valor emprestado.
 */
export function validarComissaoManual(
  valor: number | null,
  valorEmprestado: number,
): { ok: true; valor: number } | { ok: false; erro: string } {
  if (valor == null || !Number.isFinite(valor)) return { ok: false, erro: "Digite um valor válido, ex.: 50,00." };
  if (valor < 0) return { ok: false, erro: "A comissão não pode ser negativa." };
  if (emCentavos(valor) > emCentavos(valorEmprestado)) {
    return { ok: false, erro: "A comissão não pode ser maior que o valor emprestado." };
  }
  return { ok: true, valor: emCentavos(valor) / 100 };
}
