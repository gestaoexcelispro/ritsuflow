import { ImageResponse } from 'next/og'

// Link preview image (LinkedIn, WhatsApp, X…) for ritsuflow.com, built at deploy time.
export const alt = 'RitsuFlow™ — From takeoff to the field. One continuous flow.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SITE = 'https://ritsuflow.com'

/** Manrope from Google Fonts as TTF (Satori needs TTF/OTF); null when it can't be fetched. */
async function manrope(weight) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1' },
    })).text()
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OpenGraphImage() {
  const [bold, semi] = await Promise.all([manrope(800), manrope(600)])
  const fonts = [
    bold && { name: 'Manrope', data: bold, weight: 800, style: 'normal' },
    semi && { name: 'Manrope', data: semi, weight: 600, style: 'normal' },
  ].filter(Boolean)
  const chip = { display: 'flex', padding: '7px 14px', borderRadius: 999, border: '1px solid #2c5470', fontSize: 18, fontWeight: 600 }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#061f35', color: '#ffffff', fontFamily: 'Manrope' }}>
        <div style={{ width: 610, padding: '56px 0 56px 64px', display: 'flex', flexDirection: 'column' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${SITE}/logo-white.png`} width={128} height={64} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, fontSize: 54, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            <span>From takeoff to the field.</span>
            <span style={{ color: '#5fd4c3' }}>One continuous flow.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 23, lineHeight: 1.4, color: '#c5d6dd', fontWeight: 600 }}>
            Takeoff, estimating, Lean planning and field control for construction teams.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto' }}>
            <span style={chip}>RitsuScope</span><span style={chip}>Commercial</span><span style={chip}>Projects</span><span style={chip}>PreCon</span><span style={chip}>FieldOp</span>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 650, top: 70, width: 720, display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden', background: '#ffffff' }}>
          <div style={{ display: 'flex', gap: 6, padding: '10px 12px', background: '#eef3f5' }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#c9d6da' }} />
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#c9d6da' }} />
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#c9d6da' }} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${SITE}/masterplan.png`} width={720} height={349} alt="" />
        </div>
        <div style={{ position: 'absolute', left: 700, top: 380, width: 430, display: 'flex', borderRadius: 12, overflow: 'hidden', background: '#ffffff', border: '1px solid #c9d6da' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${SITE}/constraint.png`} width={430} height={200} alt="" />
        </div>
        <span style={{ position: 'absolute', left: 64, bottom: 22, fontSize: 17, color: '#9fb8c2' }}>ritsuflow.com</span>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  )
}
