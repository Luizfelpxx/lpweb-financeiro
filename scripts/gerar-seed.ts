/**
 * Gera supabase/seed.sql com os 9 clientes do PDF e empréstimos de EXEMPLO
 * (valores inventados para testar). As datas são relativas a "hoje" para que
 * existam parcelas em aberto, vencendo hoje, atrasadas e em dívida.
 *
 *   npm run seed:sql                 # usa a data de hoje (Brasília)
 *   npm run seed:sql -- 2026-11-06   # fixa a data de referência
 *
 * Os cálculos (total, comissão, parcelas) usam as MESMAS funções do sistema.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hojeSP, somarDias } from "../src/lib/domain/datas";
import { calcularEmprestimo } from "../src/lib/domain/emprestimo";
import type { IndicadoPor } from "../src/lib/domain/tipos";

interface EmprestimoExemplo {
  valor: number;
  parcelas: number; // 30 = "30 dias"
  valorParcela: number;
  /** dia do 1º vencimento, em relação a hoje (negativo = no passado) */
  primeiroEmDias: number;
  /** há quantos dias o empréstimo foi concedido */
  concedidoHaDias: number;
  pagas?: number;
}

interface ClienteExemplo {
  nome: string;
  telefone: string;
  indicadoPor: IndicadoPor | null;
  observacoes?: string;
  emprestimos: EmprestimoExemplo[];
}

const CLIENTES: ClienteExemplo[] = [
  {
    nome: "Gisele Lima",
    telefone: "(11) 98800-0001",
    indicadoPor: "geize",
    emprestimos: [{ valor: 1500, parcelas: 3, valorParcela: 600, primeiroEmDias: -45, concedidoHaDias: 50, pagas: 1 }],
  },
  {
    nome: "Lucio Marcelo Lima",
    telefone: "(11) 98800-0002",
    indicadoPor: null,
    emprestimos: [{ valor: 800, parcelas: 1, valorParcela: 1000, primeiroEmDias: 0, concedidoHaDias: 30 }],
  },
  {
    nome: "Humberto Lemos de Moraes",
    telefone: "(11) 98800-0003",
    indicadoPor: "rosangela",
    observacoes: "Prometeu pagar no fim do mês.",
    emprestimos: [{ valor: 500, parcelas: 30, valorParcela: 600, primeiroEmDias: -52, concedidoHaDias: 82 }],
  },
  {
    nome: "Leticia Feiro",
    telefone: "(11) 98800-0004",
    indicadoPor: "geize",
    emprestimos: [{ valor: 1000, parcelas: 4, valorParcela: 350, primeiroEmDias: -2, concedidoHaDias: 4 }],
  },
  {
    nome: "Sebastiao",
    telefone: "(11) 98800-0005",
    indicadoPor: null,
    emprestimos: [{ valor: 300, parcelas: 30, valorParcela: 390, primeiroEmDias: 10, concedidoHaDias: 20 }],
  },
  {
    nome: "Gean",
    telefone: "(11) 98800-0006",
    indicadoPor: "geize",
    emprestimos: [{ valor: 2000, parcelas: 5, valorParcela: 520, primeiroEmDias: 0, concedidoHaDias: 30 }],
  },
  {
    nome: "Acassio",
    telefone: "(11) 98800-0007",
    indicadoPor: "rosangela",
    emprestimos: [{ valor: 700, parcelas: 2, valorParcela: 450, primeiroEmDias: -35, concedidoHaDias: 38 }],
  },
  {
    nome: "Taty Ortis",
    telefone: "(11) 98800-0008",
    indicadoPor: null,
    emprestimos: [{ valor: 400, parcelas: 2, valorParcela: 250, primeiroEmDias: -40, concedidoHaDias: 70, pagas: 2 }],
  },
  {
    nome: "Gabriela Lima Rodrigues",
    telefone: "(11) 98800-0009",
    indicadoPor: "geize",
    emprestimos: [{ valor: 1200, parcelas: 3, valorParcela: 480, primeiroEmDias: 5, concedidoHaDias: 2 }],
  },
];

const aspas = (s: string | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);
const uuid = (tipo: number, n: number, m = 0) =>
  `00000000-0000-4000-8000-${String(tipo).padStart(4, "0")}${String(n).padStart(4, "0")}${String(m).padStart(4, "0")}`;

function gerar(hoje: string): string {
  const out: string[] = [
    "-- =============================================================================",
    "-- LPweb.dev | Assessoria Financeira — DADOS DE EXEMPLO (para testes)",
    `-- Gerado por 'npm run seed:sql' com data de referência ${hoje}.`,
    "-- Os valores são inventados; apague os dados antes de usar em produção.",
    "-- Pode ser executado mais de uma vez (ON CONFLICT DO NOTHING).",
    "-- =============================================================================",
    "",
  ];
  CLIENTES.forEach((c, i) => {
    const cid = uuid(1, i + 1);
    out.push(
      `insert into public.clientes (id, nome, telefone, observacoes, indicado_por) values ` +
        `('${cid}', ${aspas(c.nome)}, ${aspas(c.telefone)}, ${aspas(c.observacoes ?? null)}, ${aspas(c.indicadoPor)}) on conflict (id) do nothing;`,
    );
    c.emprestimos.forEach((e, j) => {
      const eid = uuid(2, i + 1, j + 1);
      const primeiro = somarDias(hoje, e.primeiroEmDias);
      const calc = calcularEmprestimo({
        valorEmprestado: e.valor,
        numeroParcelas: e.parcelas,
        valorParcela: e.valorParcela,
        primeiroVencimento: primeiro,
        indicadoPor: c.indicadoPor,
      });
      out.push(
        `insert into public.emprestimos (id, cliente_id, valor_emprestado, numero_parcelas, valor_parcela, total_a_pagar, primeiro_vencimento, taxa_juros_percentual, comissao, data_emprestimo) values ` +
          `('${eid}', '${cid}', ${calc.valorEmprestado}, ${calc.numeroParcelas}, ${calc.valorParcela}, ${calc.totalAPagar}, '${primeiro}', ${calc.taxaJurosPercentual}, ${calc.comissao}, '${somarDias(hoje, -e.concedidoHaDias)}') on conflict (id) do nothing;`,
      );
      for (const p of calc.parcelas) {
        const paga = p.numero_parcela <= (e.pagas ?? 0);
        out.push(
          `insert into public.parcelas (id, emprestimo_id, numero_parcela, valor, data_vencimento, status_pagamento, data_pagamento) values ` +
            `('${uuid(3, i + 1, (j + 1) * 100 + p.numero_parcela)}', '${eid}', ${p.numero_parcela}, ${p.valor}, '${p.data_vencimento}', '${paga ? "paga" : "aberta"}', ${paga ? `'${p.data_vencimento}'` : "null"}) on conflict (emprestimo_id, numero_parcela) do nothing;`,
        );
      }
    });
    out.push("");
  });
  return out.join("\n");
}

const hoje = process.argv[2] ?? hojeSP();
const arquivo = join(process.cwd(), "supabase", "seed.sql");
writeFileSync(arquivo, gerar(hoje), "utf8");
console.log(`seed.sql gerado (referência ${hoje}) → ${arquivo}`);
