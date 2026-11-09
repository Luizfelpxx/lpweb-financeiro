/** Classes reutilizáveis (Tailwind) para manter a identidade visual consistente. */
export const botao =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const botaoPrimario = `${botao} bg-primario text-primario-texto hover:opacity-90`;
export const botaoSecundario = `${botao} border border-borda bg-cartao text-texto hover:bg-destaque`;
export const botaoPerigo = `${botao} border border-red-300 bg-cartao text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950`;
export const botaoPequeno = "min-h-8 px-3 py-1 text-xs";

export const campo =
  "w-full rounded-lg border border-borda bg-cartao px-3 py-2 text-texto placeholder:text-suave/70 focus:border-agua";
export const rotulo = "mb-1 block text-sm font-medium text-texto";
export const cartao = "rounded-xl border border-borda bg-cartao shadow-sm";
