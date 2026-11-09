/** Minúsculas e sem acentos — para buscas e comparações de nomes. */
export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}