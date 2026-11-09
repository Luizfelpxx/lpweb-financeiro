import type { Base } from "@/lib/domain/tipos";
import { montarBase } from "./fixtures";

export const HOJE = "2026-11-06";

/** Cenário de referência (hoje = 06/11/2026). */
export function cenario(): Base {
  return montarBase([
    {
      id: "c1",
      nome: "Gisele Lima",
      telefone: "(11) 90000-0001",
      indicadoPor: "geize",
      emprestimos: [
        // parcelas: 10/09 (paga), 10/10 (atrasada, 27 dias), 10/11 (em aberto)
        { id: "e1", valorEmprestado: 1500, numeroParcelas: 3, valorParcela: 600, primeiroVencimento: "2026-09-10", pagas: 1 },
      ],
    },
    {
      id: "c2",
      nome: "Lucio Marcelo Lima",
      telefone: "(11) 90000-0002",
      emprestimos: [
        { id: "e2", valorEmprestado: 800, numeroParcelas: 1, valorParcela: 1000, primeiroVencimento: "2026-11-06" },
      ],
    },
    {
      id: "c3",
      nome: "Humberto Lemos de Moraes",
      telefone: "(11) 90000-0003",
      emprestimos: [
        // "30 dias", venceu em 15/09 → 52 dias de atraso = dívida
        { id: "e3", valorEmprestado: 500, numeroParcelas: 30, valorParcela: 600, primeiroVencimento: "2026-09-15" },
      ],
    },
    {
      id: "c4",
      nome: "Leticia Feiro",
      telefone: "(11) 90000-0004",
      indicadoPor: "rosangela",
      emprestimos: [
        { id: "e4", valorEmprestado: 2000, numeroParcelas: 4, valorParcela: 600, primeiroVencimento: "2026-11-06" },
      ],
    },
    {
      id: "c5",
      nome: "Sebastiao",
      telefone: "(11) 90000-0005",
      emprestimos: [
        // quitado
        { id: "e5", valorEmprestado: 300, numeroParcelas: 1, valorParcela: 360, primeiroVencimento: "2026-10-01", pagas: 1 },
      ],
    },
  ]);
}
