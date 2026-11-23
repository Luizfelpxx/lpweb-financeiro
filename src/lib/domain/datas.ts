/** Todas as datas do sistema são "YYYY-MM-DD" (sem fuso), calculadas no fuso de Brasília. */
export const FUSO = "America/Sao_Paulo";

const MS_DIA = 86_400_000;

const fmtISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de "hoje" em America/Sao_Paulo (o servidor da Vercel roda em UTC). */
export function hojeSP(agora: Date = new Date()): string {
  return fmtISO.format(agora);
}

export function eDataISO(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= ultimoDiaDoMes(ano, mes);
}

export function eMesISO(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function partes(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { ano, mes, dia };
}

function paraUTC(iso: string): number {
  const { ano, mes, dia } = partes(iso);
  return Date.UTC(ano, mes - 1, dia);
}

function deUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Dias entre duas datas (ate - de). Positivo quando `ate` é posterior. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / MS_DIA);
}

export function somarDias(iso: string, dias: number): string {
  return deUTC(paraUTC(iso) + dias * MS_DIA);
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Soma `meses` mantendo o dia da data-base. Se o mês não tiver o dia,
 * usa o último dia do mês (31/01 → 28/02 → 31/03). Sempre parte da data-base,
 * por isso o dia não "escorrega" ao longo das parcelas.
 */
export function somarMeses(iso: string, meses: number): string {
  const { ano, mes, dia } = partes(iso);
  const total = mes - 1 + meses;
  const novoAno = ano + Math.floor(total / 12);
  const novoMes = (((total % 12) + 12) % 12) + 1;
  const novoDia = Math.min(dia, ultimoDiaDoMes(novoAno, novoMes));
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`;
}

export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimoDiaDoMes(ano, m)).padStart(2, "0")}`,
  };
}

/** "2026-11-06" → "06/11/2026" */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { ano, mes, dia } = partes(iso);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

/** "2026-11-06" → "sexta-feira" */
export function diaDaSemana(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  });
}

const MESES_ABREV = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

/** "2026-11-06" → "06 NOV 2026" (cabeçalho do PDF) */
export function formatarDataPDF(iso: string): string {
  const { ano, mes, dia } = partes(iso);
  return `${String(dia).padStart(2, "0")} ${MESES_ABREV[mes - 1]} ${ano}`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-11" → "novembro de 2026" */
export function formatarMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${ano}`;
}

/**
 * Lê datas digitadas/importadas: "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY" e
 * "DD/MM/YY" (ano de 2 dígitos = 20YY). Retorna null se inválida.
 */
export function lerData(texto: string | null | undefined): string | null {
  if (texto == null) return null;
  const s = String(texto).trim();
  if (s === "") return null;
  let ano: number, mes: number, dia: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    dia = Number(m[1]);
    mes = Number(m[2]);
    ano = Number(m[3]);
    if (m[3].length === 2) ano += 2000;
  } else {
    return null;
  }
  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return eDataISO(iso) ? iso : null;
}

/** Segunda-feira (início) e domingo (fim) da semana que contém `iso`. */
export function limitesDaSemana(iso: string): { inicio: string; fim: string } {
  const { ano, mes, dia } = partes(iso);
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(); // 0 = domingo
  const inicio = somarDias(iso, -((diaSemana + 6) % 7));
  return { inicio, fim: somarDias(inicio, 6) };
}

/** "16/11 a 22/11/2026" */
export function formatarSemana(inicio: string, fim: string): string {
  const a = formatarData(inicio);
  return `${a.slice(0, 5)} a ${formatarData(fim)}`;
}
