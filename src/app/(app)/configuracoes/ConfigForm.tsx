"use client";

import { useActionState, useState, useTransition } from "react";
import { botaoPrimario, botaoSecundario, campo, rotulo } from "@/components/estilos";
import { Alerta } from "@/components/Ui";
import {
  enviarRelatorioTeste,
  salvarConfiguracoes,
  type EstadoConfig,
} from "./actions";

export default function ConfigForm({
  chatId,
  hora,
  chatIdPadraoDefinido,
  tokenDefinido,
}: {
  chatId: string;
  hora: string;
  chatIdPadraoDefinido: boolean;
  tokenDefinido: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoConfig, FormData>(salvarConfiguracoes, {});
  const [teste, setTeste] = useState<EstadoConfig | null>(null);
  const [enviando, iniciar] = useTransition();

  return (
    <div className="space-y-6">
      <form action={acao} className="grid max-w-xl gap-4">
        <div>
          <label htmlFor="telegram_chat_id" className={rotulo}>
            Telegram chat id
          </label>
          <input
            id="telegram_chat_id"
            name="telegram_chat_id"
            defaultValue={estado.valores?.telegram_chat_id ?? chatId}
            inputMode="text"
            className={campo}
            placeholder={chatIdPadraoDefinido ? "(usando TELEGRAM_CHAT_ID do servidor)" : "123456789"}
          />
          <p className="mt-1 text-xs text-suave">
            Fale com o seu bot no Telegram e descubra o seu id com o @userinfobot. Para grupos, o id
            começa com “-”.
          </p>
        </div>
        <div>
          <label htmlFor="hora_relatorio" className={rotulo}>
            Hora do relatório (Brasília)
          </label>
          <input
            id="hora_relatorio"
            name="hora_relatorio"
            type="time"
            defaultValue={estado.valores?.hora_relatorio ?? hora}
            required
            className={`${campo} max-w-40`}
          />
          <p className="mt-1 text-xs text-suave">
            No plano gratuito da Vercel o cron roda uma vez por dia e o horário real é definido no{" "}
            <code>vercel.json</code> (<code>0 11 * * *</code> = 08:00 de Brasília, com possível atraso de
            alguns minutos). Este campo fica registrado como referência.
          </p>
        </div>
        {estado.erro && <Alerta>{estado.erro}</Alerta>}
        {estado.ok && <Alerta tipo="ok">{estado.ok}</Alerta>}
        <div>
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>

      <section className="max-w-xl space-y-3 border-t border-borda pt-6" aria-label="Teste do relatório">
        <h2 className="font-bold">Relatório de teste</h2>
        <p className="text-sm text-suave">
          Envia agora, para o chat acima, o mesmo relatório do cron das 08:00 (mensagem + PDF do dia).
          Salve o chat id antes de testar.
        </p>
        {!tokenDefinido && (
          <Alerta tipo="info">
            Defina <code>TELEGRAM_BOT_TOKEN</code> nas variáveis de ambiente para habilitar o envio.
          </Alerta>
        )}
        <button
          type="button"
          disabled={enviando || !tokenDefinido}
          className={botaoSecundario}
          onClick={() => {
            setTeste(null);
            iniciar(async () => setTeste(await enviarRelatorioTeste()));
          }}
        >
          {enviando ? "Enviando…" : "Enviar relatório de teste agora"}
        </button>
        {teste?.erro && <Alerta>{teste.erro}</Alerta>}
        {teste?.ok && <Alerta tipo="ok">{teste.ok}</Alerta>}
      </section>
    </div>
  );
}
