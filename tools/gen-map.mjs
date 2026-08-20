// one-shot: geojson -> src/regions.ts (projected SVG paths). Not part of the build.
import fs from 'node:fs'
// usage: curl the KOSTAT 2018 sido geojson, then
//   npx mapshaper prov.json -simplify 0.6% keep-shapes -o precision=0.0001 out.json
//   node tools/gen-map.mjs out.json
const gj = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const W = 800, PAD = 10
const lat0 = 36 * Math.PI / 180
const pts = []
const rings = f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
for (const f of gj.features) for (const p of rings(f)) for (const r of p) for (const [x, y] of r) pts.push([x * Math.cos(lat0), y])
const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
const s = (W - 2 * PAD) / (maxX - minX)
const H = Math.round((maxY - minY) * s + 2 * PAD)
const proj = ([lon, lat]) => [
  ((lon * Math.cos(lat0) - minX) * s + PAD).toFixed(1),
  ((maxY - lat) * s + PAD).toFixed(1),
]
const alias = {
  서울특별시: ['서울', '서울시'], 부산광역시: ['부산'], 대구광역시: ['대구'], 인천광역시: ['인천'],
  광주광역시: ['광주'], 대전광역시: ['대전'], 울산광역시: ['울산'], 세종특별자치시: ['세종', '세종시'],
  경기도: ['경기'], 강원도: ['강원', '강원특별자치도'], 충청북도: ['충북', '충청북'],
  충청남도: ['충남', '충청남'], 전라북도: ['전북', '전라북', '전북특별자치도'], 전라남도: ['전남', '전라남'],
  경상북도: ['경북', '경상북'], 경상남도: ['경남', '경상남'], 제주특별자치도: ['제주', '제주도', '제주시'],
}
const out = gj.features.map(f => {
  const d = rings(f).flat().map(r => 'M' + r.map(c => proj(c).join(' ')).join('L') + 'Z').join('')
  const name = f.properties.name
  return { id: f.properties.code, name, aliases: [name, ...alias[name]], d }
})
fs.writeFileSync('src/regions.ts',
  `// generated from KOSTAT 2018 sido boundaries, simplified with mapshaper\n` +
  `export type Region = { id: string; name: string; aliases: string[]; d: string }\n` +
  `export const VIEWBOX = '0 0 ${W} ${H}'\n` +
  `export const REGIONS: Region[] = ${JSON.stringify(out, null, 0)}\n`)
console.log('regions.ts', (fs.statSync('src/regions.ts').size / 1024).toFixed(0) + 'KB', out.length)
