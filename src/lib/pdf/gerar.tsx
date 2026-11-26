import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DadosRelatorio } from "@/lib/domain/relatorio";
import { RelatorioPdf } from "./RelatorioPdf";
import { CobrancaPdf } from "./CobrancaPdf";
import { ComissaoPdf } from "./ComissaoPdf";
import type { RelatorioComissao } from "@/lib/domain/comissoes";
import type { DadosCobranca } from "@/lib/domain/cobrancaPdf";

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

export async function gerarPdfCobranca(dados: DadosCobranca): Promise<Buffer> {
  const logo = await carregarLogo();
  return renderToBuffer(<CobrancaPdf dados={dados} logo={logo} />);
}

export async function gerarPdfComissao(r: RelatorioComissao, geradoEm: string): Promise<Buffer> {
  const logo = await carregarLogo();
  return renderToBuffer(<ComissaoPdf r={r} geradoEm={geradoEm} logo={logo} />);
}
