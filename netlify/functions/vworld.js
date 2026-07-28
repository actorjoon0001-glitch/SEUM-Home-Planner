// VWorld 프록시 — 브라우저 CORS 우회용 Netlify 함수.
// 브라우저는 같은 출처의 /.netlify/functions/vworld 를 호출하고,
// 이 함수가 서버에서 VWorld API 를 대신 불러 결과를 돌려준다.
// (VWorld 는 브라우저 직접 fetch 를 CORS 로 막지만, 서버-서버 호출 + Referer 헤더는 허용)

const KEY = process.env.VWORLD_KEY || 'CCC06DB0-13C5-372F-8803-682171C0EB91';
const REFERER = 'https://seum-home-planner.netlify.app/';

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const cors = { 'Access-Control-Allow-Origin': '*' };
  try {
    if (q.type === 'geocode') {
      const addr = q.address || '';
      const base = (type) => `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=EPSG:4326&format=json&type=${type}&key=${KEY}&address=${encodeURIComponent(addr)}`;
      let r = await fetch(base('PARCEL'), { headers: { Referer: REFERER } });
      let j = await r.json();
      if (!j.response || j.response.status !== 'OK') {   // 지번 실패 → 도로명 재시도
        r = await fetch(base('ROAD'), { headers: { Referer: REFERER } });
        j = await r.json();
      }
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(j) };
    }
    if (q.type === 'image') {
      const lng = q.lng, lat = q.lat, zoom = q.zoom || '18', size = q.size || '1024';
      const url = `https://api.vworld.kr/req/image?service=image&request=getmap&format=png&basemap=SATELLITE&crs=EPSG:4326&center=${lng},${lat}&zoom=${zoom}&size=${size},${size}&key=${KEY}`;
      const r = await fetch(url, { headers: { Referer: REFERER } });
      if (!r.ok) return { statusCode: 502, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'image ' + r.status }) };
      const buf = Buffer.from(await r.arrayBuffer());
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'image/png' }, body: buf.toString('base64'), isBase64Encoded: true };
    }
    return { statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'type 파라미터 필요' }) };
  } catch (e) {
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
