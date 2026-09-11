// Draait in GitHub Actions: haalt per wandelaar de LiveTrack-pagina op en schrijft positions.json.
// De LiveTrack-links komen uit de geheime variabele LIVETRACK_LINKS ({"Naam": "https://..."})
// en komen nooit in positions.json of in de logs terecht.
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36';
const MAX_TRACK = 40;
const FILE = path.join(__dirname, 'positions.json');

const links = JSON.parse(process.env.LIVETRACK_LINKS || '{}');
const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { people: [] };

const hhmm = (iso) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const round = (n) => Math.round(n * 1e5) / 1e5;

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const html = (await res.text()).replace(/\\"/g, '"');
  if (/LiveTrack sessie die je zoekt, is afgelopen|session you are looking for has ended/i.test(html)) {
    return { ended: true, points: [] };
  }
  const re = /"dateTime":"([^"]+)","reportedTime":"[^"]+","position":\{"lat":(-?\d+\.\d+),"lon":(-?\d+\.\d+)\}[^}]*?"altitude":("?\$?[\w.]+"?)/g;
  const pts = new Map();
  let m;
  while ((m = re.exec(html))) {
    const alt = parseFloat(m[4].replace(/"/g, ''));
    pts.set(m[1], { t: m[1], lat: +m[2], lon: +m[3], alt: Number.isFinite(alt) ? Math.round(alt) : null });
  }
  const end = html.match(/"end":"([^"]+)"/);
  return { ended: !!end, endTime: end && end[1], points: [...pts.values()].sort((a, b) => (a.t < b.t ? -1 : 1)) };
}

(async () => {
  const people = [];
  for (const [name, url] of Object.entries(links)) {
    const prev = old.people.find((p) => p.name === name) || { name, place: null, lat: null, lon: null, alt: null, time: null, track: [] };
    const p = { ...prev };
    try {
      const r = await fetchPage(url);
      if (r.points.length) {
        const last = r.points[r.points.length - 1];
        const step = Math.max(1, Math.ceil(r.points.length / MAX_TRACK));
        p.track = r.points.filter((_, i) => i % step === 0 || i === r.points.length - 1).map((q) => [round(q.lat), round(q.lon)]);
        p.lat = round(last.lat);
        p.lon = round(last.lon);
        if (last.alt != null) p.alt = last.alt;
        p.time = hhmm(last.t) + (r.ended ? ` (sessie gestopt ${hhmm(r.endTime)})` : '');
      } else if (r.ended && !/gestopt/.test(p.time || '')) {
        p.time = `${p.time || '–'} (sessie gestopt)`;
      }
      console.log(`${name}: ${p.time || 'nog geen positie'}`);
    } catch (e) {
      console.log(`${name}: fout bij ophalen (${e.name})`);
    }
    people.push(p);
  }

  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 16);
  const same = JSON.stringify(people) === JSON.stringify(old.people);
  fs.writeFileSync(FILE, JSON.stringify({ updated: same ? old.updated : now, people }));
  console.log(same ? 'geen wijzigingen' : 'bijgewerkt');
})();
