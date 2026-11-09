import type { Metadata } from "next";
import { Titulo } from "@/components/Ui";
import ImportarCSV from "./ImportarCSV";

export const metadata: Metadata = { title: "Importar" };

export default function PaginaImportar() {
  return (
    <>
      <Titulo sub="Traga os dados antigos de uma planilha (CSV)">Importar</Titulo>
      <ImportarCSV />
    </>
  );
}
