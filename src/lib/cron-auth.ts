import { timingSafeEqual } from "node:crypto";

/**
 * Valida "Authorization: Bearer <CRON_SECRET>" (a Vercel envia esse header nas
 * chamadas do cron). Sem CRON_SECRET configurado, nega tudo (falha fechada).
 */
export function cronAutorizado(
  authorization: string | null,
  segredo: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!segredo) return false;
  const recebido = Buffer.from(authorization ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
