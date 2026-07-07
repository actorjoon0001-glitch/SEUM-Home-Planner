// 세움 홈플래너 - 런타임 설정
// 로그인/인증은 세움OS Supabase 프로젝트에 연동합니다. (직원 계정 = auth.users)
//   - supabaseUrl     : Supabase 프로젝트 URL  (예: https://xxxx.supabase.co)
//   - supabaseAnonKey : Supabase anon/publishable public key (공개되어도 안전한 값)
// service_role / secret 키는 절대 넣지 마세요 (프론트엔드 노출 금지).
window.SEUM_CONFIG = {
  // 세움OS 프로젝트 (직원 이메일/비밀번호로 로그인)
  supabaseUrl: 'https://uqsswlunnpdhledmoarj.supabase.co',
  supabaseAnonKey: 'sb_publishable_ed5WIi3RAGydRgA-85kXzw_zB0xwjtE',
};
