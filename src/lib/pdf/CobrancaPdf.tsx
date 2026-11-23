import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ROTULO_INDICACAO, type DadosCobranca, type GrupoCobranca } from "@/lib/domain/cobrancaPdf";
import { ROTULO_FILTRO } from "@/lib/domain/cobrancas";
import { formatarData, formatarDataPDF } from "@/lib/domain/datas";
import { formatarBRL } from "@/lib/domain/dinheiro";
import type { StatusCobranca } from "@/lib/domain/tipos";

const ESCURO = "#0F1B2D";
const MARINHO = "#1E3A5F";
const AGUA = "#5FB8A8";
const SUAVE = "#5B6B7F";
const BORDA = "#D5E3E0";

const COR: Record<StatusCobranca, { forte: string; fundo: string }> = {
  divida: { forte: "#B42318", fundo: "#FDECEA" },
  atrasada: { forte: "#B54708", fundo: "#FEF4E6" },
  em_aberto: { forte: "#1D5D9B", fundo: "#EAF2FB" },
  paga: { forte: "#1B7F5C", fundo: "#E7F5EF" },
};

/** A4 retrato com margens de 28pt → 539pt úteis. */
const COLUNAS = [
  { titulo: "CLIENTE", largura: 140, alinhar: "left" },
  { titulo: "PARCELA", largura: 44, alinhar: "center" },
  { titulo: "VALOR", largura: 68, alinhar: "right" },
  { titulo: "VENCIMENTO", largura: 62, alinhar: "center" },
  { titulo: "SITUAÇÃO", largura: 103, alinhar: "left" },
  { titulo: "DEVE NO TOTAL", largura: 72, alinhar: "right" },
  { titulo: "INDICAÇÃO", largura: 50, alinhar: "left" },
] as const;

const s = StyleSheet.create({
  pagina: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: ESCURO,
    paddingBottom: 40,
    backgroundColor: "#FFFFFF",
  },
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
  cards: { flexDirection: "row", marginTop: 12, gap: 8 },
  card: { flex: 1, borderRadius: 4, borderLeftWidth: 3, paddingHorizontal: 8, paddingVertical: 7 },
  cardRotulo: { fontFamily: "Helvetica-Bold", fontSize: 6.5, letterSpacing: 0.4 },
  cardValor: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 3, color: ESCURO },
  cardDetalhe: { fontSize: 6.8, color: SUAVE, marginTop: 2 },
  grupoTitulo: {
    marginTop: 14,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 3,
  },
  grupoTexto: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#FFFFFF", letterSpacing: 0.5 },
  tabelaCab: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: MARINHO,
    paddingVertical: 4,
  },
  tabelaCabTexto: { fontFamily: "Helvetica-Bold", fontSize: 6.8, color: MARINHO, paddingHorizontal: 4 },
  linha: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDA,
    alignItems: "center",
  },
  celula: { paddingHorizontal: 4 },
  negrito: { fontFamily: "Helvetica-Bold" },
  totalGrupo: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  vazio: { marginTop: 20, padding: 16, backgroundColor: "#F4F8F9", alignItems: "center" },
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

function Cabecalho({ dados, logo }: { dados: DadosCobranca; logo: Buffer | null }) {
  const visao =
    dados.tipo === "dia"
      ? `Cobranças do dia ${dados.periodo}`
      : dados.tipo === "semana"
        ? `Cobranças da semana ${dados.periodo}`
        : `Cobranças de ${dados.periodo}`;
  const filtros = [
    dados.indicacao !== "todos" ? ROTULO_INDICACAO[dados.indicacao] : null,
    dados.filtro !== "todas" ? ROTULO_FILTRO[dados.filtro] : null,
  ].filter(Boolean);
  return (
    <View>
      <View style={s.cabecalho}>
        {logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={{ data: logo, format: "png" }} style={s.logo} />
        ) : (
          <Text style={s.logoTexto}>LPweb.dev</Text>
        )}
        <View>
          <Text style={s.titulo}>LISTA DE COBRANÇA</Text>
          <Text style={s.subtitulo}>{visao.toUpperCase()}</Text>
          {filtros.length > 0 && <Text style={s.subtitulo}>{filtros.join(" • ").toUpperCase()}</Text>}
        </View>
        <View style={s.direita}>
          <Text style={s.dataGeracao}>{formatarDataPDF(dados.geradoEm)}</Text>
          <Text style={s.direitaTexto}>LPweb.dev | Assessoria Financeira</Text>
        </View>
      </View>
      <View style={s.linhaAgua} />
    </View>
  );
}

function Resumo({ dados }: { dados: DadosCobranca }) {
  const r = dados.resumo;
  const cards: { rotulo: string; valor: string; detalhe: string; status: StatusCobranca }[] = [
    {
      rotulo: "DEVENDO (ATRASADOS + DÍVIDAS)",
      valor: formatarBRL(r.devendo),
      detalhe: `${r.pessoasDevendo} ${r.pessoasDevendo === 1 ? "pessoa devendo" : "pessoas devendo"}`,
      status: "divida",
    },
    { rotulo: "A VENCER", valor: formatarBRL(r.aVencer), detalhe: "ainda no prazo", status: "em_aberto" },
    {
      rotulo: "JÁ RECEBIDO",
      valor: formatarBRL(r.recebido),
      detalhe: `${r.pessoasEmDia} ${r.pessoasEmDia === 1 ? "pessoa em dia" : "pessoas em dia"}`,
      status: "paga",
    },
  ];
  return (
    <View style={s.cards}>
      {cards.map((c) => (
        <View
          key={c.rotulo}
          style={[s.card, { backgroundColor: COR[c.status].fundo, borderLeftColor: COR[c.status].forte }]}
        >
          <Text style={[s.cardRotulo, { color: COR[c.status].forte }]}>{c.rotulo}</Text>
          <Text style={s.cardValor}>{c.valor}</Text>
          <Text style={s.cardDetalhe}>{c.detalhe}</Text>
        </View>
      ))}
    </View>
  );
}

function Grupo({ grupo }: { grupo: GrupoCobranca }) {
  const cor = COR[grupo.status];
  const n = grupo.linhas.length;
  return (
    <View>
      {/* título + cabeçalho + 1ª linha juntos (nunca fica título sozinho no fim da página) */}
      <View wrap={false}>
        <View style={[s.grupoTitulo, { backgroundColor: cor.forte }]}>
          <Text style={s.grupoTexto}>{grupo.titulo}</Text>
          <Text style={s.grupoTexto}>
            {n} {n === 1 ? "parcela" : "parcelas"} • {formatarBRL(grupo.total)}
          </Text>
        </View>
        <View style={s.tabelaCab}>
          {COLUNAS.map((c) => (
            <Text key={c.titulo} style={[s.tabelaCabTexto, { width: c.largura, textAlign: c.alinhar }]}>
              {c.titulo}
            </Text>
          ))}
        </View>
        <LinhaGrupo grupo={grupo} indice={0} />
      </View>
      {grupo.linhas.slice(1).map((_, k) => (
        <LinhaGrupo key={k + 1} grupo={grupo} indice={k + 1} />
      ))}
      <View style={s.totalGrupo} wrap={false}>
        <Text style={[s.negrito, { color: cor.forte }]}>Total: {formatarBRL(grupo.total)}</Text>
      </View>
    </View>
  );
}

function LinhaGrupo({ grupo, indice }: { grupo: GrupoCobranca; indice: number }) {
  const l = grupo.linhas[indice];
  const cor = COR[grupo.status];
  const valores = [
    l.cliente,
    l.parcela,
    formatarBRL(l.valor),
    formatarData(l.vencimento),
    l.situacao,
    l.saldoCliente > 0 ? formatarBRL(l.saldoCliente) : "Quitado",
    l.indicacao,
  ];
  return (
    <View style={[s.linha, indice % 2 === 1 ? { backgroundColor: "#F8FAFB" } : {}]} wrap={false}>
      {valores.map((v, k) => (
        <Text
          key={k}
          style={[
            s.celula,
            { width: COLUNAS[k].largura, textAlign: COLUNAS[k].alinhar },
            k === 0 || k === 4 ? s.negrito : {},
            k === 4 ? { color: cor.forte } : {},
          ]}
        >
          {v}
        </Text>
      ))}
    </View>
  );
}

export function CobrancaPdf({ dados, logo }: { dados: DadosCobranca; logo: Buffer | null }) {
  return (
    <Document
      title={`Lista de cobrança — ${dados.periodo}`}
      author="LPweb.dev | Assessoria Financeira"
    >
      <Page size="A4" style={s.pagina} wrap>
        <Cabecalho dados={dados} logo={logo} />
        <View style={s.corpo}>
          <Resumo dados={dados} />
          {dados.grupos.length === 0 ? (
            <View style={s.vazio}>
              <Text style={{ color: SUAVE }}>Nenhuma cobrança encontrada para o período e filtros escolhidos.</Text>
            </View>
          ) : (
            dados.grupos.map((g) => <Grupo key={g.status} grupo={g} />)
          )}
        </View>
        <View style={s.rodape} fixed>
          <Text>LPweb.dev • Lista de cobrança • {dados.periodo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
