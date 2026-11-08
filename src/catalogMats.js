// 🧱 실제 취급 외장재 — 온라인 카탈로그(catalog_materials) '외장재' 사진을 3D 벽에 그대로 입힘
//   · 카탈로그 관리자에서 자재를 추가/교체하면 홈플래너에도 자동 반영
//   · 사진은 실제 크기(mm)로 반복 — 벽 방향에 맞춰 월드 좌표로 투영하므로
//     블렌더 실물 모델(구운 UV)이든 도면 자동 모델이든 같은 크기 무늬로 보임
import * as THREE from 'three';
import { catalogGet } from './catalog.js';

// 외장 사진이 아닌 항목(제품 사진·색상표)은 벽 마감 목록에서 뺌
const NOT_TEXTURE = /합성데크|하이클레딩|데크/;
const isChart = (it) => /색상표/.test(it.code || '') || String(it.spec || '').trim() === '0';

// 사진 한 장이 덮는 실제 가로 길이(mm) — 제품 계열별 대략치 (화면에서 '무늬 크기'로 조절 가능)
function tileWidthOf(it) {
  const n = it.name || '';
  if (/세라믹/.test(n)) return 1400;
  if (/브릭|아이엠/.test(n)) return 700;
  return 800;
}

let _mats = null, _loading = null;
export function loadCatalogMaterials(force) {
  if (_mats && !force) return Promise.resolve(_mats);
  if (_loading && !force) return _loading;
  _loading = catalogGet('catalog_materials?select=sections&id=eq.1')
    .then((rows) => {
      const secs = (rows && rows[0] && Array.isArray(rows[0].sections)) ? rows[0].sections : [];
      const ext = secs.find((s) => /외장/.test(s.title || '')) || { items: [] };
      _mats = (ext.items || [])
        .filter((it) => it && it.image && !isChart(it) && !NOT_TEXTURE.test(it.name || ''))
        .map((it) => ({
          id: `${(it.code || '').trim()}|${(it.spec || '').trim()}`,
          code: (it.code || '').trim(), name: (it.name || '').trim(), spec: (it.spec || '').trim(),
          image: it.image, tileW: tileWidthOf(it),
        }));
      return _mats;
    })
    .catch(() => (_mats = _mats || []))
    .finally(() => { _loading = null; });
  return _loading;
}
export function catalogMaterials() { return _mats || []; }
// 선택 저장용 최소 정보 (도면에 함께 저장)
export function catalogPick(it, scale = 1) {
  return { id: it.id, code: it.code, name: it.name, spec: it.spec, image: it.image, tileW: it.tileW, scale };
}
export function catalogLabel(c) {
  if (!c) return '';
  return `${c.name}${c.code ? ' ' + c.code : ''}${/세로/.test(c.spec || '') ? ' · 세로시공' : ''}`;
}

// 사진이 다 받아지면 3D 다시 그리기 (viewer 가 등록)
let _onTex = null;
export function setCatalogTexHook(fn) { _onTex = fn; }

const _tex = new Map();     // 사진 → 질감 (같은 사진은 한 번만 받음)
const _wait = new Map();    // 사진 → 받아지면 할 일(무늬 비율 갱신)
function texOf(url) {
  if (_tex.has(url)) return _tex.get(url);
  const ld = new THREE.TextureLoader(); ld.setCrossOrigin('anonymous');
  const t = ld.load(url, () => {
    for (const fn of _wait.get(url) || []) fn();
    _wait.delete(url);
    if (_onTex) _onTex();
  });
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;   // 사진 가장자리 이음매가 덜 보이게 거울 반복
  t.anisotropy = 8;
  _tex.set(url, t);
  return t;
}

const _matCache = new Map();
// 카탈로그 외장재 재질 — c: catalogPick 결과. 무늬는 벽면 방향 기준 월드 좌표(mm)로 반복
export function catalogWallMaterial(c, side = THREE.DoubleSide) {
  const scale = Math.max(0.3, Math.min(3, +c.scale || 1));
  const key = `${c.image}|${scale}|${side}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const map = texOf(c.image);
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0.0, side, envMapIntensity: 0.7 });
  const tile = new THREE.Vector2(1, 1);
  const setTile = () => {   // 사진 비율대로 세로 길이
    const img = map.image, tw = (c.tileW || 800) * scale;
    tile.set(tw, img && img.width ? tw * img.height / img.width : tw);
  };
  setTile();
  m.onBeforeCompile = (sh) => {
    setTile();   // 컴파일 시점엔 대개 사진이 이미 받아져 있음
    sh.uniforms.uCatTile = { value: tile };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uCatTile;\nvarying vec2 vCatUV;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 cwp = modelMatrix * vec4(transformed, 1.0);
          vec3 cwn = normalize(mat3(modelMatrix) * objectNormal);
          vec3 an = abs(cwn);
          vec2 uvw;
          if (an.y > max(an.x, an.z)) uvw = cwp.xz;                                   // 윗면·밑면
          else if (an.x > an.z) uvw = vec2(cwn.x > 0.0 ? -cwp.z : cwp.z, cwp.y);      // 동·서 벽
          else uvw = vec2(cwn.z > 0.0 ? cwp.x : -cwp.x, cwp.y);                       // 남·북 벽
          vCatUV = uvw / uCatTile;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCatUV;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= texture2D( map, vCatUV );\n#endif');
  };
  m.customProgramCacheKey = () => 'seum-catalog-wproj';
  m.userData.catalog = c.id;
  if (!map.image) { if (!_wait.has(c.image)) _wait.set(c.image, []); _wait.get(c.image).push(setTile); }   // 사진 받으면 비율 갱신
  _matCache.set(key, m);
  return m;
}
