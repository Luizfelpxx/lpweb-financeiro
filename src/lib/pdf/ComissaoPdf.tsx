import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  COMISSAO_GEIZE_ALTA,
  COMISSAO_GEIZE_BAIXA,
  LIMITE_COMISSAO_GEIZE,
  NOME_INDICADOR,
} from "@/lib/domain/comissao";
import type { RelatorioComissao } from "@/lib/domain/comissoes";
import { formatarData, formatarDataPDF, formatarMes } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";

const ESCURO = "#0F1B2D";
const MARINHO = "#1E3A5F";
const AGUA = "#5FB8A8";
const SUAVE = "#5B6B7F";
const BORDA = "#D5E3E0";
const VERDE = "#1B7F5C";

/** A4 retrato, margens de 28pt → 539pt úteis. */
const COLUNAS = [
  { titulo: "Nº", largura: 30, alinhar: "center" },
  { titulo: "CLIENTE INDICADO", largura: 209, alinhar: "left" },
  { titulo: "DATA DO EMPRÉSTIMO", largura: 100, alinhar: "center" },
  { titulo: "VALOR EMPRESTADO", largura: 100, alinhar: "right" },
  { titulo: "COMISSÃO", largura: 100, alinhar: "right" },
] as const;

const s = StyleSheet.create({
  pagina: { fontFamily: "Helvetica", fontSize: 9, color: ESCURO, paddingBottom: 40 },
  cabecalho: {
    backgroundColor: ESCURO,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
  logoTexto: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 14, marginRight: 12 },
  titulo: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 17 },
  subtitulo: { color: AGUA, fontFamily: "Helvetica-Bold", fontSize: 8, marginTop: 3, letterSpacing: 0.5 },
  direita: { marginLeft: "auto", alignItems: "flex-end" },
  dataGeracao: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10 },
  direitaTexto: { color: AGUA, fontSize: 7, marginTop: 2 },
  linhaAgua: { height: 3, backgroundColor: AGUA },
  corpo: { paddingHorizontal: 28 },
  destaque: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  cartao: { flex: 1, borderRadius: 4, borderLeftWidth: 3, paddingHorizontal: 10, paddingVertical: 8 },
  cartaoRotulo: { fontFamily: "Helvetica-Bold", fontSize: 7, letterSpacing: 0.4 },
  cartaoValor: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 3 },
  cartaoDetalhe: { fontSize: 7, color: SUAVE, marginTop: 2 },
  regra: { marginTop: 10, fontSize: 7.5, color: SUAVE },
  tabelaCab: {
    flexDirection: "row",
    marginTop: 14,
    backgroundColor: MARINHO,
    paddingVertical: 5,
    borderRadius: 2,
  },
  tabelaCabTexto: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#FFFFFF", paddingHorizontal: 5 },
  linha: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: BORDA },
  celula: { paddingHorizontal: 5 },
  negrito: { fontFamily: "Helvetica-Bold" },
  totalLinha: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: 1.5,
    borderTopColor: AGUA,
    backgroundColor: "#EAF5F2",
  },
  vazio: { marginTop: 20, padding: 16, backgroundColor: "#F4F8F9", alignItems: "center" },
  recibo: {
    marginTop: 26,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
  },
  reciboTitulo: { fontFamily: "Helvetica-Bold", fontSize: 9, color: MARINHO, marginBottom: 6 },
  reciboTexto: { fontSize: 8.5, lineHeight: 1.5 },
  assinaturas: { flexDirection: "row", gap: 30, marginTop: 30 },
  assinatura: { flex: 1, borderTopWidth: 0.8, borderTopColor: ESCURO, paddingTop: 4, alignItems: "center" },
  rodape: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: AGUA,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: SUAVE,
  },
});

export function ComissaoPdf({
  r,
  geradoEm,
  logo,
}: {
  r: RelatorioComissao;
  geradoEm: string;
  logo: Buffer | null;
}) {
  const nome = NOME_INDICADOR[r.funcionaria];
  const mes = formatarMes(r.mes);
  const valores = (l: RelatorioComissao["linhas"][number], k: number) => [
    String(k + 1),
    l.cliente,
    formatarData(l.dataEmprestimo),
    formatarBRL(l.valorEmprestado),
    formatarBRL(l.comissao),
  ];

  return (
    <Document title={`Comissões de ${nome} — ${mes}`} author="LPweb.dev | Assessoria Financeira">
      <Page size="A4" style={s.pagina} wrap>
        <View>
          <View style={s.cabecalho}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={{ data: logo, format: "png" }} style={s.logo} />
            ) : (
              <Text style={s.logoTexto}>LPweb.dev</Text>
            )}
            <View>
              <Text style={s.titulo}>COMISSÕES — {nome.toUpperCase()}</Text>
              <Text style={s.subtitulo}>EMPRÉSTIMOS FEITOS EM {mes.toUpperCase()}</Text>
            </View>
            <View style={s.direita}>
              <Text style={s.dataGeracao}>{formatarDataPDF(geradoEm)}</Text>
              <Text style={s.direitaTexto}>LPweb.dev | Assessoria Financeira</Text>
            </View>
          </View>
          <View style={s.linhaAgua} />
        </View>

        <View style={s.corpo}>
          <View style={s.destaque}>
            <View style={[s.cartao, { backgroundColor: "#E7F5EF", borderLeftColor: VERDE, flex: 1.4 }]}>
              <Text style={[s.cartaoRotulo, { color: VERDE }]}>TOTAL A PAGAR PARA {nome.toUpperCase()}</Text>
              <Text style={[s.cartaoValor, { fontSize: 18, color: VERDE }]}>{formatarBRL(r.totalComissao)}</Text>
              <Text style={s.cartaoDetalhe}>comissões de {mes}</Text>
            </View>
            <View style={[s.cartao, { backgroundColor: "#EAF2FB", borderLeftColor: MARINHO }]}>
              <Text style={[s.cartaoRotulo, { color: MARINHO }]}>EMPRÉSTIMOS INDICADOS</Text>
              <Text style={s.cartaoValor}>{r.linhas.length}</Text>
              <Text style={s.cartaoDetalhe}>
                {r.clientes} {r.clientes === 1 ? "cliente" : "clientes"}
              </Text>
            </View>
            <View style={[s.cartao, { backgroundColor: "#F4F8F9", borderLeftColor: AGUA }]}>
              <Text style={[s.cartaoRotulo, { color: MARINHO }]}>VALOR EMPRESTADO</Text>
              <Text style={s.cartaoValor}>{formatarBRL(r.totalEmprestado)}</Text>
              <Text style={s.cartaoDetalhe}>soma dos empréstimos</Text>
            </View>
          </View>

          <Text style={s.regra}>
            Regra da comissão: {formatarBRL(COMISSAO_GEIZE_BAIXA)} por empréstimo de até{" "}
            {formatarBRL(LIMITE_COMISSAO_GEIZE)} e {formatarBRL(COMISSAO_GEIZE_ALTA)} por empréstimo acima de{" "}
            {formatarBRL(LIMITE_COMISSAO_GEIZE)}.
          </Text>

          {r.linhas.length === 0 ? (
            <View style={s.vazio}>
              <Text style={{ color: SUAVE }}>Nenhum empréstimo indicado por {nome} em {mes}.</Text>
            </View>
          ) : (
            <View>
              <View style={s.tabelaCab} fixed>
                {COLUNAS.map((c) => (
                  <Text key={c.titulo} style={[s.tabelaCabTexto, { width: c.largura, textAlign: c.alinhar }]}>
                    {c.titulo}
                  </Text>
                ))}
              </View>
              {r.linhas.map((l, k) => (
                <View
                  key={l.emprestimoId}
                  style={[s.linha, k % 2 === 1 ? { backgroundColor: "#F8FAFB" } : {}]}
                  wrap={false}
                >
                  {valores(l, k).map((v, c) => (
                    <Text
                      key={c}
                      style={[
                        s.celula,
                        { width: COLUNAS[c].largura, textAlign: COLUNAS[c].alinhar },
                        c === 1 || c === 4 ? s.negrito : {},
                        c === 4 ? { color: VERDE } : {},
                      ]}
                    >
                      {v}
                    </Text>
                  ))}
                </View>
              ))}
              <View style={s.totalLinha} wrap={false}>
                <Text style={[s.celula, s.negrito, { width: 339 }]}>TOTAL</Text>
                <Text style={[s.celula, s.negrito, { width: 100, textAlign: "right" }]}>
                  {formatarBRL(r.totalEmprestado)}
                </Text>
                <Text style={[s.celula, s.negrito, { width: 100, textAlign: "right", color: VERDE }]}>
                  {formatarBRL(r.totalComissao)}
                </Text>
              </View>
            </View>
          )}

          {r.totalComissao > 0 && (
            <View style={s.recibo} wrap={false}>
              <Text style={s.reciboTitulo}>COMPROVANTE DE PAGAMENTO DA COMISSÃO</Text>
              <Text style={s.reciboTexto}>
                Eu, {nome}, recebi de Rosangela o valor de {formatarBRL(r.totalComissao)} referente às comissões
                dos empréstimos indicados em {mes}, conforme a lista acima.
              </Text>
              <Text style={[s.reciboTexto, { marginTop: 8 }]}>Data do pagamento: ____/____/________</Text>
              <View style={s.assinaturas}>
                <View style={s.assinatura}>
                  <Text>{nome}</Text>
                </View>
                <View style={s.assinatura}>
                  <Text>Rosangela</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={s.rodape} fixed>
          <Text>
            LPweb.dev • Comissões de {nome} • {mes}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
