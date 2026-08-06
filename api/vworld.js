// VWorld 프록시 (Vercel · 서울리전 icn1)
// VWorld 는 해외(미국) IP 를 차단하므로, 서울 리전 함수에서 대신 호출해 CORS 없이 돌려준다.
// Netlify(미국)에서는 막히지만 이 함수는 서울에서 실행돼 정상 동작한다.

const KEY = process.env.VWORLD_KEY || 'CCC06DB0-13C5-372F-8803-682171C0EB91';
const REFERER = 'https://seum-home-planner.netlify.app/';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const q = req.query || {};
  try {
    if (q.type === 'diag') {
      const out = {};
      try { const r = await fetch('https://api.ipify.org?format=json'); out.ip = await r.json(); } catch (e) { out.ipError = String(e.message || e); }
      try {
        const r = await fetch(`https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=EPSG:4326&format=json&type=ROAD&key=${KEY}&address=${encodeURIComponent('서울특별시 중구 세종대로 110')}`, { headers: { Referer: REFERER } });
        out.vworldStatus = r.status; out.vworldBody = (await r.text()).slice(0, 200);
      } catch (e) { out.vworldError = String(e.message || e); out.vworldCause = e.cause ? String(e.cause.code || e.cause.message || e.cause) : null; }
      res.status(200).json(out); return;
    }
    if (q.type === 'geocode') {
      const addr = q.address || '';
      const base = (type) => `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=EPSG:4326&format=json&type=${type}&key=${KEY}&address=${encodeURIComponent(addr)}`;
      let r = await fetch(base('PARCEL'), { headers: { Referer: REFERER } });
      let j = await r.json();
      if (!j.response || j.response.status !== 'OK') { r = await fetch(base('ROAD'), { headers: { Referer: REFERER } }); j = await r.json(); }
      res.status(200).json(j); return;
    }
    if (q.type === 'image') {
      const { lng, lat, zoom = '18', size = '1024' } = q;
      const url = `https://api.vworld.kr/req/image?service=image&request=getmap&format=png&basemap=SATELLITE&crs=EPSG:4326&center=${lng},${lat}&zoom=${zoom}&size=${size},${size}&key=${KEY}`;
      const r = await fetch(url, { headers: { Referer: REFERER } });
      if (!r.ok) { res.status(502).json({ error: 'image ' + r.status }); return; }
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(buf); return;
    }
    res.status(400).json({ error: 'type 파라미터 필요' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e), cause: e.cause ? String(e.cause.code || e.cause.message || e.cause) : null });
  }
};
