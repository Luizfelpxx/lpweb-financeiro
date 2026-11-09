import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClienteForm from "@/components/ClienteForm";
import { Titulo } from "@/components/Ui";
import { cartao } from "@/components/estilos";
import { exigirUsuario } from "@/lib/auth";
import type { Cliente } from "@/lib/domain/tipos";

export const metadata: Metadata = { title: "Editar cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigirUsuario();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <>
      <Titulo>Editar cliente</Titulo>
      <div className={`${cartao} max-w-2xl p-5`}>
        <ClienteForm cliente={data as Cliente} />
      </div>
    </>
  );
}
