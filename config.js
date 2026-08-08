// 세움 홈플래너 - 런타임 설정
// 로그인/인증·도면 저장은 홈플래너 전용 Supabase 프로젝트(seum-home-planner)에 연동합니다.
//   - supabaseUrl     : Supabase 프로젝트 URL  (예: https://xxxx.supabase.co)
//   - supabaseAnonKey : Supabase anon/publishable public key (공개되어도 안전한 값)
// service_role / secret 키는 절대 넣지 마세요 (프론트엔드 노출 금지).
window.SEUM_CONFIG = {
  // 홈플래너 전용 프로젝트 (계정 로그인 + designs 도면 저장/공유)
  supabaseUrl: 'https://yjfpwgxwcuvfecssmvdj.supabase.co',
  supabaseAnonKey: 'sb_publishable_hApl76RBqdo4OmrM15qSkw_oHrUfdpX',

  // 부지(땅) 검색 — VWorld(브이월드) 오픈API 인증키. 발급: https://www.vworld.kr
  //   활용 도메인에 배포 주소(예: https://seum-home-planner.netlify.app)를 등록해야 작동.
  //   비어 있으면 '부지' 창에서 직접 이미지 업로드만 가능(주소 자동검색은 비활성).
  vworldKey: 'CCC06DB0-13C5-372F-8803-682171C0EB91',

  // 주소 자동검색용 프록시 base URL — VWorld 가 해외(미국) IP 를 막아서,
  //   서울 리전(Vercel icn1)에 배포한 프록시를 통해 호출한다.
  //   예: 'https://seum-vworld.vercel.app' (끝에 / 없이). 비우면 Netlify 함수(미국)로 폴백.
  vworldProxy: '',

  // 주소 자동검색(Mapbox) — 위성사진을 브라우저에서 바로 불러옴(서버·프록시 불필요).
  //   발급: https://account.mapbox.com (무료·카드 불필요). public 토큰(pk....) 붙여넣기.
  //   설정하면 '부지(땅)' 창에서 지번/도로명 주소검색 → 위성사진 자동 로드.
  mapboxToken: '',
};
