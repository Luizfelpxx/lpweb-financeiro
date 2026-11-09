import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EmprestimoForm from "@/components/EmprestimoForm";
import { Titulo } from "@/components/Ui";
import { exigirUsuario } from "@/lib/auth";
import { hojeSP } from "@/lib/domain/datas";
import { lerIndicadoPor } from "@/lib/validacao";

export const metadata: Metadata = { title: "Novo empréstimo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NovoEmprestimo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigirUsuario();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome, indicado_por")
    .eq("id", id)
    .maybeSingle();
  if (!cliente) notFound();

  return (
    <>
      <Titulo>Novo empréstimo</Titulo>
      <EmprestimoForm
        clienteId={cliente.id}
        nomeCliente={cliente.nome}
        indicadoPor={lerIndicadoPor(cliente.indicado_por)}
        hoje={hojeSP()}
      />
    </>
  );
}
