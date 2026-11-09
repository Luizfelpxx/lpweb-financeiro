import { lerData } from "./domain/datas";
import { emCentavos, lerValorBR, round2 } from "./domain/dinheiro";
import {
  MAX_PARCELAS,
  PRAZO_30_DIAS,
  parcelasCobertasPorPagamento,
  quantidadeDeParcelas,
} from "./domain/emprestimo";
import type { IndicadoPor } from "./domain/tipos";
import { lerIndicadoPor } from "./validacao";

export const COLUNAS_OBRIGATORIAS = [
  "nome",
  "telefone",
  "valor_emprestado",
  "numero_parcelas",
  "valor_parcela",
  "primeiro_vencimento",
] as const;

export const COLUNAS_OPCIONAIS = ["indicado_por", "valor_pago", "data_emprestimo"] as const;

export type Campo =
  | (typeof COLUNAS_OBRIGATORIAS)[number]
  | (typeof COLUNAS_OPCIONAIS)[number];

export const ORDEM_COLUNAS: Campo[] = [
  ...COLUNAS_OBRIGATORIAS,
  "indicado_por",
  "valor_pago",
];

/** Divide uma linha CSV respeitando aspas ("a;b" e "" escapado). */
export function lerCSV(texto: string, separador: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const fecharCampo = () => {
    linha.push(campo);
    campo = "";
  };
  const fecharLinha = () => {
    fecharCampo();
    if (linha.some((c) => c.trim() !== "")) linhas.push(linha);
    linha = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      fecharCampo();
    } else if (c === "\n") {
      fecharLinha();
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) fecharLinha();
  return linhas;
}

export function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const contagem = (s: string) => primeira.split(s).length - 1;
  const candidatos: [string, number][] = [
    [";", contagem(";")],
    [",", contagem(",")],
    ["\t", contagem("\t")],
  ];
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : ";";
}

function normalizarCabecalho(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export interface LinhaImportacao {
  /** Número da linha no arquivo (o cabeçalho é a linha 1). */
  linha: number;
  brutos: Record<Campo, string>;
  nome: string;
  telefone: string;
  valorEmprestado: number | null;
  numeroParcelas: number | null;
  valorParcela: number | null;
  primeiroVencimento: string | null;
  indicadoPor: IndicadoPor | null;
  /** 0 = "não pago" (nunca assumimos quitação). */
  valorPago: number;
  dataEmprestimo: string | null;
  /** Parcelas (em ordem) que ficam como pagas, conforme valor_pago. */
  parcelasPagas: number;
  /** Erros por coluna — impedem a importação da linha. */
  erros: Partial<Record<Campo, string>>;
  avisos: string[];
}

export interface ResultadoValidacao {
  linhas: LinhaImportacao[];
  erroGeral: string | null;
}

export function linhaTemErro(l: LinhaImportacao): boolean {
  return Object.keys(l.erros).length > 0;
}

export function validarImportacao(texto: string): ResultadoValidacao {
  const limpo = texto.replace(/^\uFEFF/, "");
  if (limpo.trim() === "") return { linhas: [], erroGeral: "O arquivo está vazio." };

  const separador = detectarSeparador(limpo);
  const tabela = lerCSV(limpo, separador);
  const cabecalho = (tabela[0] ?? []).map(normalizarCabecalho);
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length > 0) {
    return {
      linhas: [],
      erroGeral: `Colunas obrigatórias ausentes no cabeçalho: ${faltando.join(", ")}.`,
    };
  }
  const indice = (campo: Campo) => cabecalho.indexOf(campo);

  const linhas = tabela.slice(1).map((celulas, i): LinhaImportacao => {
    const pegar = (campo: Campo) =>
      indice(campo) >= 0 ? (celulas[indice(campo)] ?? "").trim() : "";
    const brutos = Object.fromEntries(
      [...COLUNAS_OBRIGATORIAS, ...COLUNAS_OPCIONAIS].map((c) => [c, pegar(c)]),
    ) as Record<Campo, string>;
    const erros: Partial<Record<Campo, string>> = {};
    const avisos: string[] = [];

    if (brutos.nome === "") erros.nome = "Nome vazio";
    if (brutos.telefone === "") erros.telefone = "Telefone vazio";

    let valorEmprestado: number | null = null;
    if (brutos.valor_emprestado === "") erros.valor_emprestado = "Campo vazio";
    else {
      valorEmprestado = lerValorBR(brutos.valor_emprestado);
      if (valorEmprestado == null || valorEmprestado <= 0) {
        erros.valor_emprestado = "Valor inválido";
        valorEmprestado = null;
      }
    }

    let numeroParcelas: number | null = null;
    if (brutos.numero_parcelas === "") erros.numero_parcelas = "Campo vazio";
    else {
      const n = Number(brutos.numero_parcelas.replace(/\s*dias?\s*$/i, ""));
      const ok =
        Number.isInteger(n) && ((n >= 1 && n <= MAX_PARCELAS) || n === PRAZO_30_DIAS);
      if (ok) numeroParcelas = n;
      else erros.numero_parcelas = `Use 1 a ${MAX_PARCELAS} ou 30 (dias)`;
    }

    let valorParcela: number | null = null;
    if (brutos.valor_parcela === "") erros.valor_parcela = "Campo vazio";
    else {
      valorParcela = lerValorBR(brutos.valor_parcela);
      if (valorParcela == null || valorParcela <= 0) {
        erros.valor_parcela = "Valor inválido";
        valorParcela = null;
      }
    }

    let primeiroVencimento: string | null = null;
    if (brutos.primeiro_vencimento === "") erros.primeiro_vencimento = "Campo vazio";
    else {
      primeiroVencimento = lerData(brutos.primeiro_vencimento);
      if (!primeiroVencimento) erros.primeiro_vencimento = "Data inválida";
    }

    let indicadoPor: IndicadoPor | null = null;
    if (brutos.indicado_por !== "") {
      indicadoPor = lerIndicadoPor(brutos.indicado_por);
      if (!indicadoPor) erros.indicado_por = "Use geize, rosangela ou deixe vazio";
    }

    let dataEmprestimo: string | null = null;
    if (brutos.data_emprestimo !== "") {
      dataEmprestimo = lerData(brutos.data_emprestimo);
      if (!dataEmprestimo) erros.data_emprestimo = "Data inválida";
    }

    let valorPago = 0;
    let parcelasPagas = 0;
    if (brutos.valor_pago !== "") {
      const v = lerValorBR(brutos.valor_pago);
      if (v == null || v < 0) erros.valor_pago = "Valor inválido";
      else valorPago = v;
    }
    if (
      valorPago > 0 &&
      !erros.valor_pago &&
      valorParcela != null &&
      numeroParcelas != null
    ) {
      const qtd = quantidadeDeParcelas(numeroParcelas);
      const total = round2(valorParcela * qtd);
      if (emCentavos(valorPago) > emCentavos(total)) {
        erros.valor_pago = "Maior que o total a pagar";
      } else {
        const { quitadas, resto } = parcelasCobertasPorPagamento(valorPago, valorParcela, qtd);
        parcelasPagas = quitadas;
        if (resto > 0)
          avisos.push(
            `valor_pago não fecha parcelas inteiras: ${quitadas} parcela(s) serão marcadas como paga(s); o resto (R$ ${resto.toFixed(2).replace(".", ",")}) é ignorado.`,
          );
      }
    }

    return {
      linha: i + 2,
      brutos,
      nome: brutos.nome,
      telefone: brutos.telefone,
      valorEmprestado,
      numeroParcelas,
      valorParcela,
      primeiroVencimento,
      indicadoPor,
      valorPago,
      dataEmprestimo,
      parcelasPagas,
      erros,
      avisos,
    };
  });

  if (linhas.length === 0)
    return { linhas, erroGeral: "O arquivo tem cabeçalho, mas nenhuma linha de dados." };
  return { linhas, erroGeral: null };
}

export const MODELO_CSV =
  "nome;telefone;valor_emprestado;numero_parcelas;valor_parcela;primeiro_vencimento;indicado_por;valor_pago\n" +
  "Cliente Exemplo;(11) 90000-0000;1000,00;2;650,00;10/12/2026;geize;\n" +
  "Outro Exemplo;(11) 91111-1111;500,00;30;600,00;05/12/2026;;\n";
