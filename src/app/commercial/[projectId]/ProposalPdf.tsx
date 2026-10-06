// Proposal PDF (react-pdf). Loaded only when the user exports, so it never runs on the server.
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export type ProposalPdfData = {
  pageSize: 'A4' | 'LETTER'
  language: string
  labels: Record<string, string>
  company: { name: string; legalName: string | null; taxId: string | null; contact: string; logoUrl: string | null }
  title: string
  bidNumber: string
  revision: string
  date: string
  validUntil: string | null
  client: string
  job: string
  scope: string
  inclusions: string[]
  exclusions: string[]
  paymentTerms: string
  notes: string
  items: { description: string; qty: string; unit: string; unitPrice: string; total: string }[] | null
  buildUp: { label: string; rate: string; amount: string }[] | null
  /** In the price, listed apart (USA allowances / verbas). */
  allowances: { description: string; amount: string }[]
  /** Priced options outside the price. */
  alternates: { description: string; amount: string }[]
  direct: string
  markup: string | null
  price: string
}

const ink = '#173441', teal = '#0b7f75', line = '#d9e3e6', muted = '#4f6670'

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingHorizontal: 36, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9, color: ink },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: teal, paddingBottom: 12, marginBottom: 16 },
  logo: { height: 40, maxWidth: 160, objectFit: 'contain', marginBottom: 6 },
  company: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 8, color: muted, marginTop: 2 },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: teal, textAlign: 'right' },
  meta: { fontSize: 8.5, textAlign: 'right', marginTop: 2 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  box: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: line, borderRadius: 4, padding: 8 },
  label: { fontSize: 7.5, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  value: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 12 },
  h2: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: teal, marginBottom: 5 },
  para: { lineHeight: 1.45 },
  bullet: { flexDirection: 'row', marginBottom: 2 },
  table: { borderWidth: 1, borderColor: line, borderRadius: 4 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: line },
  th: { flexDirection: 'row', backgroundColor: '#f2f7f8' },
  cell: { paddingVertical: 4, paddingHorizontal: 5 },
  right: { textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  totals: { marginTop: 8, alignSelf: 'flex-end', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: teal, paddingTop: 5, marginTop: 4 },
  price: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: teal },
  sign: { flexDirection: 'row', gap: 36, marginTop: 36 },
  signLine: { flexGrow: 1, flexBasis: 0, borderTopWidth: 1, borderTopColor: ink, paddingTop: 4, fontSize: 8, color: muted },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: muted },
})

const W = { d: '46%', q: '11%', u: '9%', p: '16%', t: '18%' }

function Bullets({ items }: { items: string[] }) {
  return <View>{items.map((x, i) => <View key={i} style={s.bullet}><Text>•  </Text><Text style={{ flex: 1 }}>{x}</Text></View>)}</View>
}

export default function ProposalPdf({ d }: { d: ProposalPdfData }) {
  const L = d.labels
  return (
    <Document title={`${d.bidNumber} · ${d.job} · ${d.title}`} author={d.company.name} language={d.language}>
      <Page size={d.pageSize} style={s.page}>
        <View style={s.head}>
          <View>
            {d.company.logoUrl ? <Image src={d.company.logoUrl} style={s.logo} /> : null}
            <Text style={s.company}>{d.company.legalName || d.company.name}</Text>
            {d.company.taxId ? <Text style={s.small}>{d.company.taxId}</Text> : null}
            {d.company.contact ? <Text style={s.small}>{d.company.contact}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>{d.title}</Text>
            <Text style={s.meta}>{d.bidNumber} · {d.revision}</Text>
            <Text style={s.meta}>{L.date}: {d.date}</Text>
            {d.validUntil ? <Text style={s.meta}>{L.validUntil}: {d.validUntil}</Text> : null}
          </View>
        </View>

        <View style={s.grid}>
          <View style={s.box}><Text style={s.label}>{L.client}</Text><Text style={s.value}>{d.client || '—'}</Text></View>
          <View style={s.box}><Text style={s.label}>{L.job}</Text><Text style={s.value}>{d.job}</Text></View>
          <View style={s.box}><Text style={s.label}>{L.price}</Text><Text style={[s.value, { color: teal }]}>{d.price}</Text></View>
        </View>

        {d.scope ? <View style={s.section}><Text style={s.h2}>{L.scope}</Text><Text style={s.para}>{d.scope}</Text></View> : null}

        {d.items ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.items}</Text>
            <View style={s.table}>
              <View style={s.th} fixed>
                <Text style={[s.cell, s.bold, { width: W.d }]}>{L.colItem}</Text>
                <Text style={[s.cell, s.bold, s.right, { width: W.q }]}>{L.colQty}</Text>
                <Text style={[s.cell, s.bold, { width: W.u }]}>{L.colUnit}</Text>
                <Text style={[s.cell, s.bold, s.right, { width: W.p }]}>{L.colUnitPrice}</Text>
                <Text style={[s.cell, s.bold, s.right, { width: W.t }]}>{L.colTotal}</Text>
              </View>
              {d.items.map((it, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.cell, { width: W.d }]}>{it.description}</Text>
                  <Text style={[s.cell, s.right, { width: W.q }]}>{it.qty}</Text>
                  <Text style={[s.cell, { width: W.u }]}>{it.unit}</Text>
                  <Text style={[s.cell, s.right, { width: W.p }]}>{it.unitPrice}</Text>
                  <Text style={[s.cell, s.right, { width: W.t }]}>{it.total}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.small, { marginTop: 4 }]}>{L.unitPriceNote}</Text>
          </View>
        ) : null}

        <View style={s.totals} wrap={false}>
          {d.buildUp ? <>
            <View style={s.totalRow}><Text>{L.direct}</Text><Text>{d.direct}</Text></View>
            {d.buildUp.map((b, i) => <View key={i} style={s.totalRow}><Text>{b.label} ({b.rate})</Text><Text>{b.amount}</Text></View>)}
            {d.markup ? <View style={s.totalRow}><Text>{L.markup}</Text><Text>{d.markup}</Text></View> : null}
          </> : null}
          <View style={s.priceRow}><Text style={s.bold}>{L.total}</Text><Text style={s.price}>{d.price}</Text></View>
        </View>

        {d.allowances.length ? (
          <View style={[s.section, { marginTop: 12 }]} wrap={false}>
            <Text style={s.h2}>{L.allowances}</Text>
            {d.allowances.map((a, i) => <View key={i} style={s.totalRow}><Text style={{ flex: 1 }}>{a.description}</Text><Text>{a.amount}</Text></View>)}
            <Text style={[s.small, { marginTop: 3 }]}>{L.allowancesNote}</Text>
          </View>
        ) : null}

        {d.alternates.length ? (
          <View style={[s.section, { marginTop: 12 }]} wrap={false}>
            <Text style={s.h2}>{L.alternates}</Text>
            {d.alternates.map((a, i) => <View key={i} style={s.totalRow}><Text style={{ flex: 1 }}>{L.alternate} {i + 1} · {a.description}</Text><Text>+ {a.amount}</Text></View>)}
            <Text style={[s.small, { marginTop: 3 }]}>{L.alternatesNote}</Text>
          </View>
        ) : null}

        <View style={[s.grid, { marginTop: 14 }]} wrap={false}>
          {d.inclusions.length ? <View style={s.box}><Text style={s.h2}>{L.inclusions}</Text><Bullets items={d.inclusions} /></View> : null}
          {d.exclusions.length ? <View style={s.box}><Text style={s.h2}>{L.exclusions}</Text><Bullets items={d.exclusions} /></View> : null}
        </View>

        {d.paymentTerms ? <View style={s.section}><Text style={s.h2}>{L.paymentTerms}</Text><Text style={s.para}>{d.paymentTerms}</Text></View> : null}
        {d.notes ? <View style={s.section}><Text style={s.h2}>{L.notes}</Text><Text style={s.para}>{d.notes}</Text></View> : null}

        <View style={s.sign} wrap={false}>
          <Text style={s.signLine}>{d.company.legalName || d.company.name}</Text>
          <Text style={s.signLine}>{L.accepted}{d.client ? ` · ${d.client}` : ''}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>{d.bidNumber} · {d.job}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
