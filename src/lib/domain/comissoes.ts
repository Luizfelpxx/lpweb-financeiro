import { calcularComissao } from "./comissao";
import { limitesDoMes } from "./datas";
import { emCentavos, somar } from "./dinheiro";
import type { Base, IndicadoPor } from "./tipos";

export const FUNCIONARIAS: IndicadoPor[] = ["geize", "rosangela"];

export interface LinhaComissao {
  clienteId: string;
  cliente: string;
  emprestimoId: string;
  dataEmprestimo: string;
  valorEmprestado: number;
  comissao: number;
  /** quanto daria pela regra (R$ 50 até R$ 1.000 e R$ 100 acima) */
  comissaoAutomatica: number;
  /** true quando a comissão foi definida à mão e é diferente da regra */
  manual: boolean;
}

export interface RelatorioComissao {
  funcionaria: IndicadoPor;
  mes: string;
  linhas: LinhaComissao[];
  clientes: number;
  totalEmprestado: number;
  totalComissao: number;
}

/** Empréstimos concedidos no mês (data_emprestimo) para clientes indicados por cada funcionária. */
export function relatorioComissoes(
  base: Base,
  mes: string,
): Record<IndicadoPor, RelatorioComissao> {
  const { inicio, fim } = limitesDoMes(mes);
  const clientePorId = new Map(base.clientes.map((c) => [c.id, c]));

  const montar = (funcionaria: IndicadoPor): RelatorioComissao => {
    const linhas: LinhaComissao[] = [];
    for (const e of base.emprestimos) {
      const cliente = clientePorId.get(e.cliente_id);
      if (!cliente || cliente.indicado_por !== funcionaria) continue;
      if (e.data_emprestimo < inicio || e.data_emprestimo > fim) continue;
      linhas.push({
        clienteId: cliente.id,
        cliente: cliente.nome,
        emprestimoId: e.id,
        dataEmprestimo: e.data_emprestimo,
        valorEmprestado: e.valor_emprestado,
        comissao: e.comissao,
        comissaoAutomatica: calcularComissao(e.valor_emprestado, funcionaria),
        manual: emCentavos(e.comissao) !== emCentavos(calcularComissao(e.valor_emprestado, funcionaria)),
      });
    }
    linhas.sort(
      (a, b) =>
        a.dataEmprestimo.localeCompare(b.dataEmprestimo) ||
        a.cliente.localeCompare(b.cliente, "pt-BR"),
    );
    return {
      funcionaria,
      mes,
      linhas,
      clientes: new Set(linhas.map((l) => l.clienteId)).size,
      totalEmprestado: somar(linhas.map((l) => l.valorEmprestado)),
      totalComissao: somar(linhas.map((l) => l.comissao)),
    };
  };

  return { geize: montar("geize"), rosangela: montar("rosangela") };
}
