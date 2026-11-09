import { describe, expect, it } from "vitest";
import { linhaTemErro, validarImportacao } from "@/lib/importacao";
import { cpfValido } from "@/lib/validacao";

const CAB = "nome;telefone;valor_emprestado;numero_parcelas;valor_parcela;primeiro_vencimento;indicado_por;valor_pago";

describe("importação CSV", () => {
  it("lê linhas válidas (separador ';', valores e datas no padrão brasileiro)", () => {
    const { linhas, erroGeral } = validarImportacao(
      `${CAB}\nGisele Lima;(11) 90000-0001;1.500,00;3;600,00;10/12/2026;geize;\n`,
    );
    expect(erroGeral).toBeNull();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      linha: 2,
      nome: "Gisele Lima",
      valorEmprestado: 1500,
      numeroParcelas: 3,
      valorParcela: 600,
      primeiroVencimento: "2026-12-10",
      indicadoPor: "geize",
      valorPago: 0,
      parcelasPagas: 0,
    });
    expect(linhaTemErro(linhas[0])).toBe(false);
  });

  it("aceita vírgula como separador, BOM e aspas", () => {
    const csv = `\uFEFFnome,telefone,valor_emprestado,numero_parcelas,valor_parcela,primeiro_vencimento\n"Souza, João",11999990000,"1000,00",2,"650,00",2026-12-10\n`;
    const { linhas } = validarImportacao(csv);
    expect(linhas[0].nome).toBe("Souza, João");
    expect(linhas[0].valorEmprestado).toBe(1000);
    expect(linhaTemErro(linhas[0])).toBe(false);
  });

  it("destaca campos vazios e datas inválidas por coluna", () => {
    const { linhas } = validarImportacao(
      `${CAB}\n;(11) 9;100;2;60;31/02/2026;;\nFulano;;abc;0;;10/10/2026;amigo;\n`,
    );
    expect(linhas[0].erros).toMatchObject({
      nome: "Nome vazio",
      primeiro_vencimento: "Data inválida",
    });
    expect(linhas[1].erros).toMatchObject({
      telefone: "Telefone vazio",
      valor_emprestado: "Valor inválido",
      valor_parcela: "Campo vazio",
      indicado_por: expect.any(String),
    });
    expect(linhas[1].erros.numero_parcelas).toBeDefined();
  });

  it("registros sem valor_pago ficam como 'não pago' (não assume quitação)", () => {
    const { linhas } = validarImportacao(`${CAB}\nA;1;500;2;300;10/12/2026;;\nB;2;500;2;300;10/12/2026;;0\n`);
    expect(linhas.map((l) => [l.valorPago, l.parcelasPagas])).toEqual([[0, 0], [0, 0]]);
  });

  it("valor_pago marca parcelas inteiras em ordem; avisa sobre o resto", () => {
    const { linhas } = validarImportacao(`${CAB}\nA;1;900;3;400;10/12/2026;;800\nB;2;900;3;400;10/12/2026;;500\n`);
    expect(linhas[0]).toMatchObject({ parcelasPagas: 2, avisos: [] });
    expect(linhas[1].parcelasPagas).toBe(1);
    expect(linhas[1].avisos[0]).toMatch(/resto/);
  });

  it("valor_pago maior que o total é erro", () => {
    const { linhas } = validarImportacao(`${CAB}\nA;1;900;3;400;10/12/2026;;5000\n`);
    expect(linhas[0].erros.valor_pago).toMatch(/Maior/);
  });

  it("'30' em numero_parcelas = 30 dias (uma parcela); total = valor_parcela", () => {
    const { linhas } = validarImportacao(`${CAB}\nA;1;500;30;600;10/12/2026;;600\n`);
    expect(linhas[0].numeroParcelas).toBe(30);
    expect(linhas[0].parcelasPagas).toBe(1);
    expect(linhas[0].erros).toEqual({});
  });

  it("erros gerais: arquivo vazio e cabeçalho incompleto", () => {
    expect(validarImportacao("").erroGeral).toMatch(/vazio/);
    expect(validarImportacao("nome;telefone\nA;1").erroGeral).toMatch(/valor_emprestado/);
    expect(validarImportacao(`${CAB}\n`).erroGeral).toMatch(/nenhuma linha/);
  });
});

describe("cpfValido", () => {
  it("valida dígitos verificadores", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });
});
