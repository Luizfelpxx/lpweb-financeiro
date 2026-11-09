"use client";

import Link from "next/link";
import { useActionState } from "react";
import { botaoPrimario, botaoSecundario, campo, rotulo } from "@/components/estilos";
import { Alerta } from "@/components/Ui";
import type { Cliente } from "@/lib/domain/tipos";
import { salvarCliente, type EstadoForm } from "@/app/(app)/actions";

export default function ClienteForm({ cliente }: { cliente?: Cliente }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(salvarCliente, {});
  // Em caso de erro o servidor devolve o que foi digitado (o React limpa os campos após o envio).
  const v = (campoNome: string, original: string | null | undefined) =>
    estado.valores?.[campoNome] ?? original ?? "";

  return (
    <form action={acao} className="grid gap-4 sm:grid-cols-2">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <div className="sm:col-span-2">
        <label htmlFor="nome" className={rotulo}>
          Nome *
        </label>
        <input id="nome" name="nome" required defaultValue={v("nome", cliente?.nome)} className={campo} />
      </div>
      <div>
        <label htmlFor="telefone" className={rotulo}>
          Telefone *
        </label>
        <input
          id="telefone"
          name="telefone"
          type="tel"
          inputMode="tel"
          required
          defaultValue={v("telefone", cliente?.telefone)}
          className={campo}
          placeholder="(11) 90000-0000"
        />
      </div>
      <div>
        <label htmlFor="cpf" className={rotulo}>
          CPF (opcional)
        </label>
        <input
          id="cpf"
          name="cpf"
          inputMode="numeric"
          defaultValue={v("cpf", cliente?.cpf)}
          className={campo}
          placeholder="000.000.000-00"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="endereco" className={rotulo}>
          Endereço (opcional)
        </label>
        <input id="endereco" name="endereco" defaultValue={v("endereco", cliente?.endereco)} className={campo} />
      </div>
      <div>
        <label htmlFor="indicado_por" className={rotulo}>
          Indicado por
        </label>
        <select
          id="indicado_por"
          name="indicado_por"
          defaultValue={v("indicado_por", cliente?.indicado_por)}
          className={campo}
        >
          <option value="">Nenhum</option>
          <option value="geize">Geize</option>
          <option value="rosangela">Rosangela</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="observacoes" className={rotulo}>
          Observações
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          defaultValue={v("observacoes", cliente?.observacoes)}
          className={campo}
        />
      </div>

      {estado.erro && (
        <div className="sm:col-span-2">
          <Alerta>{estado.erro}</Alerta>
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pendente} className={botaoPrimario}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <Link href={cliente ? `/clientes/${cliente.id}` : "/clientes"} className={botaoSecundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
