import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ROTULO_FILTRO } from "@/lib/domain/cobrancas";
import { formatarData, formatarDataPDF } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import type { DadosRelatorio, LinhaRelatorio } from "@/lib/domain/relatorio";

const ESCURO = "#0F1B2D";
const MARINHO = "#1E3A5F";
const AGUA = "#5FB8A8";
const AGUA_CLARO = "#E6F4F1";
const TEXTO = "#0F1B2D";
const SUAVE = "#5B6B7F";

/** Larguras (pt) das 10 colunas — somam 786pt (A4 paisagem com margens de 28pt). */
const COLUNAS = [
  { titulo: "CLIENTE", largura: 118 },
  { titulo: "INFORMAÇÃO", largura: 78 },
  { titulo: "PARC.", largura: 46 },
  { titulo: "VALOR", largura: 68 },
  { titulo: "PAGO", largura: 62 },
  { titulo: "TELEFONE", largura: 86 },
  { titulo: "VALOR A PAGAR", largura: 80 },
  { titulo: "VENCIMENTO", largura: 62 },
  { titulo: "COMISSÃO", largura: 56 },
  { titulo: "OBSERVAÇÃO", largura: 130 },
] as const;

/** Linhas por página (altura fixa de 24pt cada), contando a linha de totais. */
export const LINHAS_PRIMEIRA_PAGINA = 11;
export const LINHAS_DEMAIS_PAGINAS = 17;

const s = StyleSheet.create({
  pagina: { fontFamily: "Helvetica", fontSize: 8, color: TEXTO, backgroundColor: "#FFFFFF" },
  cabecalho: {
    backgroundColor: ESCURO,
    height: 98,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
  },
  linhaAgua: { height: 3, backgroundColor: AGUA },
  logoBox: { width: 104, justifyContent: "center" },
  logo: { width: 80, height: 80, borderRadius: 10 },
  logoTexto: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 18 },
  centro: { flex: 1, paddingHorizontal: 12 },
  titulo: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 20 },
  subtitulo: { color: AGUA, fontFamily: "Helvetica-Bold", fontSize: 8.5, marginTop: 4, letterSpacing: 0.6 },
  direita: { width: 150, alignItems: "flex-end" },
  dataGeracao: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 12 },
  direitaTexto: { color: AGUA, fontSize: 7.5, marginTop: 3, letterSpacing: 0.5 },
  corpo: { paddingHorizontal: 28 },
  secaoTitulo: {
    marginTop: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  secaoTexto: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: MARINHO, letterSpacing: 0.8 },
  secaoInfo: { fontSize: 7.5, color: SUAVE },
  cards: { flexDirection: "row", justifyContent: "space-between" },
  card: {
    width: 150,
    height: 52,
    backgroundColor: AGUA_CLARO,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: AGUA,
    paddingHorizontal: 9,
    paddingVertical: 8,
    justifyContent: "space-between",
  },
  cardRotulo: { fontFamily: "Helvetica-Bold", fontSize: 6.5, color: MARINHO, letterSpacing: 0.5 },
  cardValor: { fontFamily: "Helvetica-Bold", fontSize: 13, color: ESCURO },
  tabelaCab: { flexDirection: "row", backgroundColor: MARINHO, height: 20, alignItems: "center" },
  tabelaCabTexto: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 6.8, paddingHorizontal: 4 },
  linha: {
    flexDirection: "row",
    height: 24,
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D5E3E0",
  },
  linhaZebra: { backgroundColor: "#F4F8F9" },
  linhaTotal: {
    flexDirection: "row",
    height: 24,
    alignItems: "center",
    backgroundColor: AGUA_CLARO,
    borderTopWidth: 1,
    borderTopColor: AGUA,
  },
  celula: { paddingHorizontal: 4, fontSize: 8 },
  negrito: { fontFamily: "Helvetica-Bold" },
  vazio: { height: 40, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F8F9" },
  rodape: { position: "absolute", left: 28, right: 28, bottom: 14 },
  rodapeNota: { fontSize: 6.3, color: SUAVE, lineHeight: 1.35 },
  rodapeLinha: {
    marginTop: 5,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: AGUA,
    fontSize: 7,
    color: MARINHO,
    textAlign: "center",
  },
});

const NOTA =
  "Nota: os indicadores são calculados pela soma das linhas da tabela (uma linha por empréstimo). " +
  "VALOR A PAGAR nos indicadores = saldo das parcelas em aberto; na tabela, VALOR A PAGAR = total do empréstimo com juros " +
  "(a linha TOTAIS mostra também o valor já pago: total = saldo + pago). " +
  "PAGO: “Pago” quando todas as parcelas foram quitadas. VENCIMENTO = próxima parcela em aberto. " +
  "COMISSÃO calculada sobre o valor emprestado (— quando não há).";

type Item = { tipo: "linha"; linha: LinhaRelatorio; indice: number } | { tipo: "total" };

/** Divide as linhas (+ linha de totais) em páginas de tamanho fixo. */
export function paginar(linhas: readonly LinhaRelatorio[]): Item[][] {
  const itens: Item[] = [
    ...linhas.map((linha, indice) => ({ tipo: "linha" as const, linha, indice })),
    { tipo: "total" as const },
  ];
  const paginas: Item[][] = [];
  let i = 0;
  let limite = LINHAS_PRIMEIRA_PAGINA;
  while (i < itens.length) {
    paginas.push(itens.slice(i, i + limite));
    i += limite;
    limite = LINHAS_DEMAIS_PAGINAS;
  }
  return paginas;
}

function Cabecalho({ dados, logo }: { dados: DadosRelatorio; logo: Buffer | null }) {
  return (
    <View>
      <View style={s.cabecalho}>
        <View style={s.logoBox}>
          {logo ? (
            // <Image> do @react-pdf/renderer (não é <img> HTML; não existe prop alt)
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={{ data: logo, format: "png" }} style={s.logo} />
          ) : (
            <Text style={s.logoTexto}>LPweb.dev</Text>
          )}
        </View>
        <View style={s.centro}>
          <Text style={s.titulo}>RELATÓRIO FINANCEIRO</Text>
          <Text style={s.subtitulo}>EMPRÉSTIMO DE CLIENTES | ACOMPANHAMENTO FINANCEIRO</Text>
        </View>
        <View style={s.direita}>
          <Text style={s.dataGeracao}>{formatarDataPDF(dados.geradoEm)}</Text>
          <Text style={s.direitaTexto}>RELATÓRIO EXECUTIVO</Text>
          <Text style={s.direitaTexto}>ASSESSORIA LPweb.dev</Text>
        </View>
      </View>
      <View style={s.linhaAgua} />
    </View>
  );
}

function Indicadores({ dados }: { dados: DadosRelatorio }) {
  const i = dados.indicadores;
  const cards: [string, string][] = [
    ["CLIENTES", String(i.clientes)],
    ["VALOR TOTAL REGISTRADO", formatarBRL(i.valorTotalRegistrado)],
    ["VALOR A PAGAR", formatarBRL(i.valorAPagar)],
    ["VALOR PAGO REGISTRADO", formatarBRL(i.valorPagoRegistrado)],
    ["COMISSÕES", formatarBRL(i.comissoes)],
  ];
  const visao = dados.tipo === "dia" ? "Visão do dia" : "Visão do mês";
  return (
    <View>
      <View style={s.secaoTitulo}>
        <Text style={s.secaoTexto}>INDICADORES FINANCEIROS</Text>
        <Text style={s.secaoInfo}>
          {visao}: {dados.periodo} • {ROTULO_FILTRO[dados.filtro]}
        </Text>
      </View>
      <View style={s.cards}>
        {cards.map(([rotulo, valor]) => (
          <View key={rotulo} style={s.card}>
            <Text style={s.cardRotulo}>{rotulo}</Text>
            <Text style={s.cardValor}>{valor}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TituloTabela({ continuacao }: { continuacao: boolean }) {
  return (
    <View style={s.secaoTitulo}>
      <Text style={s.secaoTexto}>
        DETALHAMENTO DOS CLIENTES{continuacao ? " (continuação)" : ""}
      </Text>
    </View>
  );
}

function CabecalhoTabela() {
  return (
    <View style={s.tabelaCab}>
      {COLUNAS.map((c) => (
        <Text key={c.titulo} style={[s.tabelaCabTexto, { width: c.largura }]}>
          {c.titulo}
        </Text>
      ))}
    </View>
  );
}

function textoPago(l: LinhaRelatorio): { texto: string; cor: string } {
  if (l.quitacao === "pago") return { texto: "Pago", cor: "#1B7F5C" };
  if (l.quitacao === "parcial")
    return { texto: `Parcial ${l.parcelasPagas}/${l.parcelasTotal}`, cor: "#B54708" };
  return { texto: "Não pago", cor: "#B42318" };
}

function LinhaTabela({ linha, indice }: { linha: LinhaRelatorio; indice: number }) {
  const pago = textoPago(linha);
  const valores: (string | { texto: string; cor: string; negrito?: boolean })[] = [
    linha.cliente,
    `pegou ${formatarBRL(linha.pegou)}`,
    linha.rotuloParcelas,
    formatarBRL(linha.valorParcela),
    { texto: pago.texto, cor: pago.cor, negrito: true },
    linha.telefone || "—",
    formatarBRL(linha.totalAPagar),
    formatarData(linha.proximoVencimento),
    linha.comissao > 0 ? formatarBRL(linha.comissao) : "—",
    linha.observacao,
  ];
  return (
    <View style={indice % 2 === 1 ? [s.linha, s.linhaZebra] : s.linha} wrap={false}>
      {valores.map((v, k) => {
        const largura = COLUNAS[k].largura;
        if (typeof v === "string") {
          return (
            <Text
              key={k}
              style={[s.celula, { width: largura, maxLines: 2, textOverflow: "ellipsis" }]}
            >
              {v}
            </Text>
          );
        }
        return (
          <Text
            key={k}
            style={[s.celula, { width: largura, color: v.cor }, v.negrito ? s.negrito : {}]}
          >
            {v.texto}
          </Text>
        );
      })}
    </View>
  );
}

function LinhaTotais({ dados }: { dados: DadosRelatorio }) {
  const i = dados.indicadores;
  const n = dados.linhas.length;
  const valores = [
    `TOTAIS (${n} ${n === 1 ? "empréstimo" : "empréstimos"})`,
    formatarBRL(i.valorTotalRegistrado),
    "",
    "",
    formatarBRL(i.valorPagoRegistrado),
    "",
    formatarBRL(i.totalAPagarEmprestimos),
    "",
    i.comissoes > 0 ? formatarBRL(i.comissoes) : "—",
    "",
  ];
  return (
    <View style={s.linhaTotal} wrap={false}>
      {valores.map((v, k) => (
        <Text key={k} style={[s.celula, s.negrito, { width: COLUNAS[k].largura }]}>
          {v}
        </Text>
      ))}
    </View>
  );
}

function Rodape({ pagina }: { pagina: number }) {
  return (
    <View style={s.rodape}>
      <Text style={s.rodapeNota}>{NOTA}</Text>
      <Text style={s.rodapeLinha}>
        LPweb.dev • Relatório gerado a partir dos dados do sistema • Confidencial • Página {pagina}
      </Text>
    </View>
  );
}

export function RelatorioPdf({
  dados,
  logo,
}: {
  dados: DadosRelatorio;
  logo: Buffer | null;
}) {
  const paginas = paginar(dados.linhas);
  return (
    <Document
      title={`Relatório financeiro — ${dados.periodo}`}
      author="LPweb.dev | Assessoria Financeira"
      subject="Empréstimo de clientes | Acompanhamento financeiro"
    >
      {paginas.map((itens, p) => (
        <Page key={p} size="A4" orientation="landscape" style={s.pagina}>
          {p === 0 ? (
            <>
              <Cabecalho dados={dados} logo={logo} />
              <View style={s.corpo}>
                <Indicadores dados={dados} />
                <TituloTabela continuacao={false} />
                <CabecalhoTabela />
                <Linhas itens={itens} dados={dados} />
              </View>
            </>
          ) : (
            <View style={[s.corpo, { paddingTop: 24 }]}>
              <TituloTabela continuacao />
              <CabecalhoTabela />
              <Linhas itens={itens} dados={dados} />
            </View>
          )}
          <Rodape pagina={p + 1} />
        </Page>
      ))}
    </Document>
  );
}

function Linhas({ itens, dados }: { itens: Item[]; dados: DadosRelatorio }) {
  return (
    <View>
      {dados.linhas.length === 0 && itens.some((i) => i.tipo === "total") && (
        <View style={s.vazio}>
          <Text style={{ color: SUAVE }}>Nenhuma cobrança encontrada para o período e filtro selecionados.</Text>
        </View>
      )}
      {itens.map((item, k) =>
        item.tipo === "linha" ? (
          <LinhaTabela key={k} linha={item.linha} indice={item.indice} />
        ) : (
          <LinhaTotais key={k} dados={dados} />
        ),
      )}
    </View>
  );
}
