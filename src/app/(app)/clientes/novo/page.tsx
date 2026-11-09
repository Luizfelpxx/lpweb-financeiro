import type { Metadata } from "next";
import ClienteForm from "@/components/ClienteForm";
import { Titulo } from "@/components/Ui";
import { cartao } from "@/components/estilos";

export const metadata: Metadata = { title: "Novo cliente" };

export default function NovoCliente() {
  return (
    <>
      <Titulo>Novo cliente</Titulo>
      <div className={`${cartao} max-w-2xl p-5`}>
        <ClienteForm />
      </div>
    </>
  );
}
