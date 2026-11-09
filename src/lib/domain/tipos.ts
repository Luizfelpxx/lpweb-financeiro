export type IndicadoPor = "geize" | "rosangela";
export type StatusPagamento = "aberta" | "paga";
export type StatusCobranca = "em_aberto" | "atrasada" | "divida" | "paga";
export type AcaoHistorico =
  | "criar"
  | "editar"
  | "excluir"
  | "marcar_paga"
  | "desmarcar_paga"
  | "arquivar"
  | "desarquivar";

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  endereco: string | null;
  observacoes: string | null;
  indicado_por: IndicadoPor | null;
  arquivado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Emprestimo {
  id: string;
  cliente_id: string;
  valor_emprestado: number;
  /** 30 = "30 dias" (pagamento único); demais valores = nº de parcelas mensais. */
  numero_parcelas: number;
  valor_parcela: number;
  total_a_pagar: number;
  primeiro_vencimento: string;
  taxa_juros_percentual: number;
  comissao: number;
  data_emprestimo: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Parcela {
  id: string;
  emprestimo_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status_pagamento: StatusPagamento;
  data_pagamento: string | null;
}

export interface Historico {
  id: string;
  tabela: "clientes" | "emprestimos" | "parcelas";
  registro_id: string;
  cliente_id: string | null;
  acao: AcaoHistorico;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  usuario_id: string | null;
  criado_em: string;
}

export interface Configuracoes {
  telegram_chat_id: string | null;
  /** "HH:MM" (horário de Brasília). */
  hora_relatorio: string;
}

/** Conjunto de dados carregado do banco e usado por todos os cálculos/relatórios. */
export interface Base {
  clientes: Cliente[];
  emprestimos: Emprestimo[];
  parcelas: Parcela[];
}
