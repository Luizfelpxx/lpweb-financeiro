import type { Metadata } from "next";
import { Titulo } from "@/components/Ui";
import { cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import { carregarConfiguracoes } from "@/lib/dados";
import ConfigForm from "./ConfigForm";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  const { supabase } = await exigirUsuario();
  const config = await carregarConfiguracoes(supabase);
  return (
    <>
      <Titulo sub="Relatório diário no Telegram">Configurações</Titulo>
      <div className={`${cartao} p-5`}>
        <ConfigForm
          chatId={config.telegram_chat_id ?? ""}
          hora={config.hora_relatorio}
          chatIdPadraoDefinido={Boolean(process.env.TELEGRAM_CHAT_ID)}
          tokenDefinido={Boolean(process.env.TELEGRAM_BOT_TOKEN)}
        />
      </div>
    </>
  );
}
