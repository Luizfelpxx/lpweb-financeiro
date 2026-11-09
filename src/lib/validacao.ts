import type { IndicadoPor } from "./domain/tipos";

export interface DadosCliente {
  nome: string;
  telefone: string;
  cpf: string | null;
  endereco: string | null;
  observacoes: string | null;
  indicado_por: IndicadoPor | null;
}

/** CPF válido (11 dígitos + dígitos verificadores). Aceita pontuação. */
export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digito(d.slice(0, 9), 10) === Number(d[9]) &&
    digito(d.slice(0, 10), 11) === Number(d[10])
  );
}

export function lerIndicadoPor(valor: unknown): IndicadoPor | null {
  const v = String(valor ?? "").trim().toLowerCase();
  return v === "geize" || v === "rosangela" ? v : null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function opcional(valor: unknown): string | null {
  const t = texto(valor);
  return t === "" ? null : t;
}

export function validarCliente(entrada: Record<string, unknown>): {
  dados: DadosCliente;
  erros: string[];
} {
  const erros: string[] = [];
  const nome = texto(entrada.nome);
  const telefone = texto(entrada.telefone);
  const cpf = opcional(entrada.cpf);
  const bruto = texto(entrada.indicado_por);
  const indicado_por = lerIndicadoPor(bruto);

  if (nome.length < 2) erros.push("Informe o nome do cliente.");
  if (telefone.replace(/\D/g, "").length < 8)
    erros.push("Informe um telefone válido (com DDD).");
  if (cpf && !cpfValido(cpf)) erros.push("CPF inválido.");
  if (bruto !== "" && bruto !== "nenhum" && !indicado_por)
    erros.push("Indicação inválida.");

  return {
    dados: {
      nome,
      telefone,
      cpf,
      endereco: opcional(entrada.endereco),
      observacoes: opcional(entrada.observacoes),
      indicado_por,
    },
    erros,
  };
}

/** Chave para reconhecer o mesmo cliente na importação (nome sem acento/caixa + dígitos do telefone). */
export function chaveCliente(nome: string, telefone: string): string {
  const n = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `${n}|${telefone.replace(/\D/g, "")}`;
}
