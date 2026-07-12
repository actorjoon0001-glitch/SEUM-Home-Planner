// 세움 홈플래너 - 런타임 설정
// 로그인/인증·도면 저장은 홈플래너 전용 Supabase 프로젝트(seum-home-planner)에 연동합니다.
//   - supabaseUrl     : Supabase 프로젝트 URL  (예: https://xxxx.supabase.co)
//   - supabaseAnonKey : Supabase anon/publishable public key (공개되어도 안전한 값)
// service_role / secret 키는 절대 넣지 마세요 (프론트엔드 노출 금지).
window.SEUM_CONFIG = {
  // 홈플래너 전용 프로젝트 (계정 로그인 + designs 도면 저장/공유)
  supabaseUrl: 'https://yjfpwgxwcuvfecssmvdj.supabase.co',
  supabaseAnonKey: 'sb_publishable_hApl76RBqdo4OmrM15qSkw_oHrUfdpX',
};
