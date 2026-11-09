import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DadosRelatorio } from "@/lib/domain/relatorio";
import { RelatorioPdf } from "./RelatorioPdf";

/** Logo para o cabeçalho escuro (#0F1B2D). Se o arquivo não existir, o PDF usa um texto. */
async function carregarLogo(): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), "public", "logo", "logo-pdf.png"));
  } catch {
    return null;
  }
}

export async function gerarPdfRelatorio(dados: DadosRelatorio): Promise<Buffer> {
  const logo = await carregarLogo();
  return renderToBuffer(<RelatorioPdf dados={dados} logo={logo} />);
}
