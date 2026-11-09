/** Arredonda para 2 casas (centavos). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function emCentavos(n: number): number {
  return Math.round(n * 100);
}

/** Soma valores monetários sem acumular erro de ponto flutuante. */
export function somar(valores: readonly number[]): number {
  return valores.reduce((acc, v) => acc + emCentavos(v), 0) / 100;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** "R$ 1.234,56" (com espaço comum no lugar do espaço não-separável). */
export function formatarBRL(n: number): string {
  return brl.format(n).replace(/\u00a0/g, " ");
}

/**
 * Converte texto digitado em número. Aceita "1.234,56", "1234,56", "1234.56",
 * "R$ 1.234,56" e "1.250" (ponto seguido de 3 dígitos = milhar, padrão brasileiro).
 * Retorna null se não for um número válido.
 */
export function lerValorBR(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  let s = String(texto).replace(/R\$/gi, "").replace(/\s/g, "");
  if (s === "") return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}
