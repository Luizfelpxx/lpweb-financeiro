import { describe, expect, it } from "vitest";
import { diasEntre, hojeSP, somarMeses } from "@/lib/domain/datas";
import { diasDeAtraso, saldoDevedor, statusCobranca, totalPago } from "@/lib/domain/status";

const HOJE = "2026-11-06";
const aberta = (venc: string) => ({ status_pagamento: "aberta" as const, data_vencimento: venc });

describe("statusCobranca (por data)", () => {
  it("vence hoje ou no futuro → em_aberto", () => {
    expect(statusCobranca(aberta("2026-11-06"), HOJE)).toBe("em_aberto");
    expect(statusCobranca(aberta("2026-11-07"), HOJE)).toBe("em_aberto");
    expect(statusCobranca(aberta("2027-05-01"), HOJE)).toBe("em_aberto");
  });

  it("venceu há 1 a 30 dias → atrasada", () => {
    expect(statusCobranca(aberta("2026-11-05"), HOJE)).toBe("atrasada"); // 1 dia
    expect(statusCobranca(aberta("2026-10-07"), HOJE)).toBe("atrasada"); // 30 dias
  });

  it("venceu há mais de 30 dias → divida", () => {
    expect(diasEntre("2026-10-06", HOJE)).toBe(31);
    expect(statusCobranca(aberta("2026-10-06"), HOJE)).toBe("divida"); // 31 dias
    expect(statusCobranca(aberta("2026-01-01"), HOJE)).toBe("divida");
  });

  it("parcela paga é sempre 'paga', mesmo vencida", () => {
    expect(
      statusCobranca({ status_pagamento: "paga", data_vencimento: "2025-01-01" }, HOJE),
    ).toBe("paga");
  });

  it("dias de atraso nunca é negativo", () => {
    expect(diasDeAtraso("2026-11-20", HOJE)).toBe(0);
    expect(diasDeAtraso("2026-11-01", HOJE)).toBe(5);
  });

  it("atravessa virada de mês/ano e ano bissexto", () => {
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2); // 2028 é bissexto
    expect(diasEntre("2027-02-28", "2027-03-01")).toBe(1);
  });
});

describe("hojeSP (fuso America/Sao_Paulo)", () => {
  it("00:30 UTC ainda é o dia anterior em Brasília", () => {
    expect(hojeSP(new Date("2026-11-06T00:30:00Z"))).toBe("2026-11-05");
  });
  it("11:00 UTC (08:00 de Brasília) é o mesmo dia", () => {
    expect(hojeSP(new Date("2026-11-06T11:00:00Z"))).toBe("2026-11-06");
  });
  it("02:59 UTC é 23:59 do dia anterior; 03:00 UTC já é o novo dia", () => {
    expect(hojeSP(new Date("2026-11-06T02:59:59Z"))).toBe("2026-11-05");
    expect(hojeSP(new Date("2026-11-06T03:00:00Z"))).toBe("2026-11-06");
  });
});

describe("saldo devedor e total pago", () => {
  const parcelas = [
    { status_pagamento: "paga" as const, valor: 400 },
    { status_pagamento: "aberta" as const, valor: 400.1 },
    { status_pagamento: "aberta" as const, valor: 0.2 },
  ];
  it("saldo = soma das abertas; total pago = soma das pagas", () => {
    expect(saldoDevedor(parcelas)).toBe(400.3);
    expect(totalPago(parcelas)).toBe(400);
  });
  it("marcar paga abate o saldo; desmarcar devolve o valor", () => {
    const antes = saldoDevedor(parcelas);
    const marcada = parcelas.map((p, i) =>
      i === 1 ? { ...p, status_pagamento: "paga" as const } : p,
    );
    expect(saldoDevedor(marcada)).toBe(0.2);
    expect(totalPago(marcada)).toBe(800.1);
    const desmarcada = marcada.map((p, i) =>
      i === 1 ? { ...p, status_pagamento: "aberta" as const } : p,
    );
    expect(saldoDevedor(desmarcada)).toBe(antes);
  });
});

describe("somarMeses", () => {
  it("usa o último dia do mês quando o dia não existe", () => {
    expect(somarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-11-30", 3)).toBe("2027-02-28");
  });
  it("não deixa o dia 'escorregar' nas parcelas seguintes", () => {
    expect(somarMeses("2027-01-31", 2)).toBe("2027-03-31");
    expect(somarMeses("2027-01-31", 3)).toBe("2027-04-30");
  });
  it("vira o ano", () => {
    expect(somarMeses("2026-11-15", 2)).toBe("2027-01-15");
    expect(somarMeses("2026-12-10", 13)).toBe("2028-01-10");
  });
});
