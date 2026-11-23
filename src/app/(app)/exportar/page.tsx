import type { Metadata } from "next";
import BotaoPdf from "@/components/BotaoPdf";
import { Titulo } from "@/components/Ui";
import { cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { hojeSP } from "@/lib/domain/datas";

export const metadata: Metadata = { title: "Exportar planilha" };

export default async function PaginaExportar() {
  await exigirUsuario();
  return (
    <>
      <Titulo sub="Uma cópia de tudo o que está no sistema, para abrir no Excel ou no Google Planilhas">
        Exportar planilha
      </Titulo>
      <div className={`${cartao} max-w-2xl space-y-4 p-5`}>
        <p className="text-sm text-texto">A planilha tem três abas:</p>
        <ul className="space-y-2 text-sm text-texto">
          <li>
            <strong>Parcelas</strong>: todas as parcelas, com vencimento, situação, dias de atraso e o dia em que foram
            pagas.
          </li>
          <li>
            <strong>Empréstimos</strong>: quanto cada pessoa pegou, o total a pagar, quanto já pagou e quanto falta.
          </li>
          <li>
            <strong>Clientes</strong>: os dados de cada cliente e quanto deve no total.
          </li>
        </ul>
        <p className="text-sm text-suave">
          Vale baixar de tempos em tempos e guardar como cópia de segurança.
        </p>
        <BotaoPdf url="/api/exportar" arquivo="planilha" nomePadrao={`lpweb-financeiro-${hojeSP()}.xlsx`} />
      </div>
    </>
  );
}
