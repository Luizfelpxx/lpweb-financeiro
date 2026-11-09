import { type Contagem, visaoDia } from "./cobrancas";
import { somar } from "./dinheiro";
import { saldoDevedor, totalPago } from "./status";
import type { Base, Cliente } from "./tipos";

export interface ClienteEmDivida {
  cliente: Cliente;
  /** parcelas em dívida */
  qtd: number;
  valor: number;
  maiorAtraso: number;
  /** saldo devedor total do cliente */
  totalDevido: number;
}

export interface ResumoPainel {
  totalEmprestado: number;
  /** Σ total a pagar − Σ valor emprestado (juros previstos / lucro) */
  jurosPrevistos: number;
  totalRecebido: number;
  totalAReceber: number;
  quantidadeClientes: number;
  atrasadas: Contagem;
  dividas: Contagem;
  clientesEmDivida: ClienteEmDivida[];
}

export function resumoPainel(base: Base, hoje: string): ResumoPainel {
  const totalEmprestado = somar(base.emprestimos.map((e) => e.valor_emprestado));
  const totalContratado = somar(base.emprestimos.map((e) => e.total_a_pagar));
  const visao = visaoDia(base, hoje, "todas");

  const porCliente = new Map<string, ClienteEmDivida>();
  for (const item of visao.itens) {
    if (item.status !== "divida") continue;
    const atual = porCliente.get(item.cliente.id) ?? {
      cliente: item.cliente,
      qtd: 0,
      valor: 0,
      maiorAtraso: 0,
      totalDevido: item.totalDevidoCliente,
    };
    atual.qtd += 1;
    atual.valor = somar([atual.valor, item.parcela.valor]);
    atual.maiorAtraso = Math.max(atual.maiorAtraso, item.diasAtraso);
    porCliente.set(item.cliente.id, atual);
  }

  return {
    totalEmprestado,
    jurosPrevistos: somar([totalContratado, -totalEmprestado]),
    totalRecebido: totalPago(base.parcelas),
    totalAReceber: saldoDevedor(base.parcelas),
    quantidadeClientes: base.clientes.filter((c) => !c.arquivado).length,
    atrasadas: visao.resumo.atrasadas,
    dividas: visao.resumo.dividas,
    clientesEmDivida: [...porCliente.values()].sort(
      (a, b) => b.maiorAtraso - a.maiorAtraso || b.valor - a.valor,
    ),
  };
}
