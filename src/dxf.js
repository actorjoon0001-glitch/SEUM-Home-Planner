// 세움 홈플래너 - DXF (CAD 교환 포맷) 파서
// 텍스트 DXF 의 LINE / LWPOLYLINE / POLYLINE+VERTEX / CIRCLE / ARC 를 읽어
// 밑그림용 이미지(dataURL)로 변환합니다. (.dwg 는 바이너리라 미지원)
//
// 단위(mm/m)는 알 수 없으므로 도형 실제 좌표 크기를 그대로 underlay 크기로 쓰고,
// 너무 작으면(미터로 보이면) ×1000 보정. 그래도 안 맞으면 '축척 맞추기'로 보정.

// DXF 텍스트 → 그릴 도형 목록
function parse(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs = [];
  for (let k = 0; k + 1 < lines.length; k += 2) {
    const code = parseInt(lines[k], 10);
    if (Number.isNaN(code)) { k -= 1; continue; } // 줄 어긋남 재정렬
    pairs.push([code, (lines[k + 1] || '').trim()]);
  }

  const draws = [];
  let cur = null, type = null, openPoly = null, pendingX;

  const flush = () => {
    if (!cur) return;
    const c = cur.codes;
    if (type === 'LINE' && c[10] != null && c[11] != null) {
      draws.push({ kind: 'line', x1: c[10], y1: c[20], x2: c[11], y2: c[21] });
    } else if (type === 'LWPOLYLINE' && cur.verts.length > 1) {
      draws.push({ kind: 'poly', pts: cur.verts, closed: !!((c[70] || 0) & 1) });
    } else if (type === 'CIRCLE' && c[40] > 0) {
      draws.push({ kind: 'circle', cx: c[10], cy: c[20], r: c[40] });
    } else if (type === 'ARC' && c[40] > 0) {
      draws.push({ kind: 'arc', cx: c[10], cy: c[20], r: c[40], a0: c[50] || 0, a1: c[51] || 0 });
    }
    cur = null; type = null;
  };

  for (const [code, val] of pairs) {
    if (code === 0) {
      flush();
      if (val === 'POLYLINE') { openPoly = { kind: 'poly', pts: [], closed: false }; cur = { codes: {}, verts: [] }; type = 'POLYLINE'; pendingX = undefined; continue; }
      if (val === 'VERTEX') { cur = { codes: {}, verts: [] }; type = 'VERTEX'; pendingX = undefined; continue; }
      if (val === 'SEQEND') { if (openPoly && openPoly.pts.length > 1) draws.push(openPoly); openPoly = null; cur = null; type = null; continue; }
      cur = { codes: {}, verts: [] }; type = val; pendingX = undefined;
      continue;
    }
    if (!cur) continue;
    const num = parseFloat(val);
    if (code === 10) { pendingX = num; cur.codes[10] = num; }
    else if (code === 20) {
      cur.codes[20] = num;
      if (pendingX !== undefined) {
        if (type === 'VERTEX') { if (openPoly) openPoly.pts.push([pendingX, num]); }
        else cur.verts.push([pendingX, num]);
        pendingX = undefined;
      }
    } else {
      cur.codes[code] = num;
      if (code === 70 && type === 'POLYLINE' && openPoly) openPoly.closed = !!(num & 1);
    }
  }
  flush();
  if (openPoly && openPoly.pts.length > 1) draws.push(openPoly);
  return draws;
}

// 도형 목록 → { dataURL, w, h }  (w,h = 실제 좌표 크기, mm 가정)
export function dxfToUnderlay(text, maxPx = 2200) {
  const draws = parse(text);
  if (!draws.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ext = (x, y) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
  for (const d of draws) {
    if (d.kind === 'line') { ext(d.x1, d.y1); ext(d.x2, d.y2); }
    else if (d.kind === 'poly') { for (const p of d.pts) ext(p[0], p[1]); }
    else { ext(d.cx - d.r, d.cy - d.r); ext(d.cx + d.r, d.cy + d.r); }
  }
  if (!isFinite(minX)) return null;
  const w = maxX - minX, h = maxY - minY;
  if (w <= 0 || h <= 0) return null;

  const pad = 24;
  const scale = Math.min(maxPx / w, maxPx / h, 6);
  const pxW = Math.round(w * scale) + pad * 2, pxH = Math.round(h * scale) + pad * 2;
  const c = document.createElement('canvas');
  c.width = pxW; c.height = pxH;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, pxW, pxH);
  x.strokeStyle = '#1f2530'; x.lineWidth = 1.2; x.lineJoin = 'round'; x.lineCap = 'round';
  const TX = (X) => (X - minX) * scale + pad;
  const TY = (Y) => pxH - ((Y - minY) * scale + pad); // DXF는 Y가 위 → 뒤집기

  x.beginPath();
  for (const d of draws) {
    if (d.kind === 'line') { x.moveTo(TX(d.x1), TY(d.y1)); x.lineTo(TX(d.x2), TY(d.y2)); }
    else if (d.kind === 'poly') {
      d.pts.forEach((p, i) => (i ? x.lineTo(TX(p[0]), TY(p[1])) : x.moveTo(TX(p[0]), TY(p[1]))));
      if (d.closed && d.pts.length > 2) x.lineTo(TX(d.pts[0][0]), TY(d.pts[0][1]));
    } else if (d.kind === 'circle') {
      x.moveTo(TX(d.cx) + d.r * scale, TY(d.cy));
      x.arc(TX(d.cx), TY(d.cy), d.r * scale, 0, Math.PI * 2);
    } else if (d.kind === 'arc') {
      const a0 = d.a0 * Math.PI / 180, a1 = d.a1 * Math.PI / 180;
      x.moveTo(TX(d.cx) + Math.cos(-a0) * d.r * scale, TY(d.cy) + Math.sin(-a0) * d.r * scale);
      x.arc(TX(d.cx), TY(d.cy), d.r * scale, -a0, -a1, true);
    }
  }
  x.stroke();

  let uw = w, uh = h;
  if (Math.max(w, h) < 1000) { uw *= 1000; uh *= 1000; } // 미터로 보이면 mm 로
  return { dataURL: c.toDataURL('image/png'), w: uw, h: uh, count: draws.length };
}
