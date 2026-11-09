import { calcularComissao } from "./comissao";
import { eDataISO, somarMeses } from "./datas";
import { emCentavos, round2 } from "./dinheiro";
import type { IndicadoPor } from "./tipos";

/** Valor reservado de numero_parcelas que significa "30 dias" (pagamento único). */
export const PRAZO_30_DIAS = 30;
export const MAX_PARCELAS = 24;
export const PERCENTUAIS_SUGERIDOS = [10, 15, 20, 25, 30] as const;

export function ePrazo30Dias(numeroParcelas: number): boolean {
  return numeroParcelas === PRAZO_30_DIAS;
}

/** Quantas linhas de parcela existem de fato: "30 dias" gera uma única parcela. */
export function quantidadeDeParcelas(numeroParcelas: number): number {
  return ePrazo30Dias(numeroParcelas) ? 1 : numeroParcelas;
}

/** "2x", "30 dias" */
export function rotuloParcelas(numeroParcelas: number): string {
  return ePrazo30Dias(numeroParcelas) ? "30 dias" : `${numeroParcelas}x`;
}

export interface ParcelaGerada {
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
}

/** Parcelas com vencimento mensal no mesmo dia (último dia do mês se não existir). */
export function gerarParcelas(entrada: {
  numeroParcelas: number;
  valorParcela: number;
  primeiroVencimento: string;
}): ParcelaGerada[] {
  const qtd = quantidadeDeParcelas(entrada.numeroParcelas);
  return Array.from({ length: qtd }, (_, i) => ({
    numero_parcela: i + 1,
    valor: round2(entrada.valorParcela),
    data_vencimento: somarMeses(entrada.primeiroVencimento, i),
  }));
}

export interface EntradaEmprestimo {
  valorEmprestado: number;
  numeroParcelas: number;
  valorParcela: number;
  primeiroVencimento: string;
  indicadoPor: IndicadoPor | null;
}

export interface EmprestimoCalculado {
  valorEmprestado: number;
  numeroParcelas: number;
  valorParcela: number;
  /** Soma real das parcelas geradas. */
  totalAPagar: number;
  /** (total - emprestado) / emprestado * 100, só para referência. */
  taxaJurosPercentual: number;
  comissao: number;
  parcelas: ParcelaGerada[];
}

export function validarEmprestimo(e: {
  valorEmprestado: number | null;
  numeroParcelas: number | null;
  valorParcela: number | null;
  primeiroVencimento: string | null;
}): string[] {
  const erros: string[] = [];
  if (e.valorEmprestado == null || !(e.valorEmprestado > 0))
    erros.push("Informe o valor emprestado (maior que zero).");
  const n = e.numeroParcelas;
  if (
    n == null ||
    !Number.isInteger(n) ||
    !((n >= 1 && n <= MAX_PARCELAS) || n === PRAZO_30_DIAS)
  )
    erros.push(`Número de parcelas inválido (1 a ${MAX_PARCELAS} ou 30 dias).`);
  if (e.valorParcela == null || !(e.valorParcela > 0))
    erros.push("Informe o valor de cada parcela (maior que zero).");
  if (!e.primeiroVencimento || !eDataISO(e.primeiroVencimento))
    erros.push("Informe uma data válida para a primeira parcela.");
  return erros;
}

export function calcularEmprestimo(e: EntradaEmprestimo): EmprestimoCalculado {
  const parcelas = gerarParcelas(e);
  const totalCentavos = parcelas.reduce((a, p) => a + emCentavos(p.valor), 0);
  const totalAPagar = totalCentavos / 100;
  const emprestado = round2(e.valorEmprestado);
  return {
    valorEmprestado: emprestado,
    numeroParcelas: e.numeroParcelas,
    valorParcela: round2(e.valorParcela),
    totalAPagar,
    taxaJurosPercentual: taxaDeJuros(emprestado, totalAPagar),
    comissao: calcularComissao(emprestado, e.indicadoPor),
    parcelas,
  };
}

export function taxaDeJuros(valorEmprestado: number, totalAPagar: number): number {
  if (!(valorEmprestado > 0)) return 0;
  return round2(((totalAPagar - valorEmprestado) / valorEmprestado) * 100);
}

/** Sugestão de juros (referência): total com o percentual e valor de cada parcela. */
export function sugerirJuros(
  valorEmprestado: number,
  percentual: number,
  numeroParcelas: number,
): { total: number; valorParcela: number } {
  const total = round2(valorEmprestado * (1 + percentual / 100));
  const qtd = quantidadeDeParcelas(numeroParcelas) || 1;
  return { total, valorParcela: round2(total / qtd) };
}

/**
 * Importação: quantas parcelas (em ordem) ficam como pagas dado o valor já pago.
 * Só conta parcelas inteiras; o resto é devolvido para aviso.
 */
export function parcelasCobertasPorPagamento(
  valorPago: number,
  valorParcela: number,
  qtdParcelas: number,
): { quitadas: number; resto: number } {
  if (!(valorPago > 0) || !(valorParcela > 0)) return { quitadas: 0, resto: 0 };
  const pagoC = emCentavos(valorPago);
  const parcC = emCentavos(valorParcela);
  const quitadas = Math.min(qtdParcelas, Math.floor(pagoC / parcC));
  return { quitadas, resto: (pagoC - quitadas * parcC) / 100 };
}
