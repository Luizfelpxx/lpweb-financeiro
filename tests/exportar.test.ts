import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { gerarPlanilha } from "@/lib/planilha/exportar";
import { cenario, HOJE } from "./cenario";

describe("exportar planilha", () => {
  it("gera as abas Parcelas, Empréstimos e Clientes com os valores certos", async () => {
    const buf = await gerarPlanilha(cenario(), HOJE);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(buf).buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Parcelas", "Empréstimos", "Clientes"]);

    const parcelas = wb.getWorksheet("Parcelas")!;
    // 3 + 1 + 1 + 4 + 1 parcelas no cenário
    expect(parcelas.rowCount - 1).toBe(10);

    const emp = wb.getWorksheet("Empréstimos")!;
    const gisele = emp.getRows(2, emp.rowCount - 1)!.find((r) => r.getCell(1).value === "Gisele Lima")!;
    expect(gisele.getCell(7).value).toBe(600); // já pago
    expect(gisele.getCell(8).value).toBe(1200); // falta pagar
    expect(gisele.getCell(9).value).toBe(2); // parcelas que faltam

    const clientes = wb.getWorksheet("Clientes")!;
    expect(clientes.rowCount - 1).toBe(5);
  });
});
