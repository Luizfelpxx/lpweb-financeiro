"use client";

import { useActionState } from "react";
import { botaoPrimario, campo, rotulo } from "@/components/estilos";
import { Alerta } from "@/components/Ui";
import { entrar, type EstadoLogin } from "./actions";

export default function FormularioLogin() {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});
  return (
    <form action={acao} className="space-y-4">
      <div>
        <label htmlFor="email" className={rotulo}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={campo}
          placeholder="voce@exemplo.com"
          defaultValue={estado.email ?? ""}
        />
      </div>
      <div>
        <label htmlFor="senha" className={rotulo}>
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className={campo}
        />
      </div>
      {estado.erro && <Alerta>{estado.erro}</Alerta>}
      <button type="submit" disabled={pendente} className={`${botaoPrimario} w-full`}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
