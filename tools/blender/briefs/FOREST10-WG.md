# FOREST10-WG (10평 체류형 쉼터) — 블렌더 디테일 모델 작업 지시서

카탈로그 실사 사진을 보고 기존 디테일 모델(models/seum-shelter-10.glb, twin-10.glb, seum-15.glb 수준)처럼
외부·내부를 실물과 비슷하게 만든다. **블렌더 MCP(포트 9876)로 사용자가 켜둔 블렌더 화면에서 직접 작업**해서
사용자가 진행 과정을 볼 수 있게 한다. 단계마다 뷰포트 스크린샷으로 확인하고 짧게 보고.

## 시작 파일
- `models/src/FOREST10-WG-base.blend` — 도면 치수 그대로 자동 생성된 기본 모델 (tools/blender/plan_to_blend.py 결과)
  - 블렌더에서 열기: `bpy.ops.wm.open_mainfile(filepath=r"C:\seum-home-planner\models\src\FOREST10-WG-base.blend")`
  - 열고 나서 `bpy.ops.wm.save_as_mainfile(filepath=r"C:\seum-home-planner\models\src\FOREST10-WG.blend")` 로 작업본 저장
- 도면 데이터: `tools/blender/briefs/FOREST10-WG.plan.json` (홈플래너 도면, mm)

## 좌표 (절대 바꾸지 말 것 — 홈플래너 도면과 겹치는 기준)
- 블렌더 X = 도면 x/1000, 블렌더 Y = −도면 y/1000, 땅 Z = 0. 원점 = 집 북서쪽 바깥 모서리
- 집 바깥 치수: X 0~10.0, Y −3.5~0 (남쪽 = −Y 쪽이 정면: 큰 창·현관)
- 바닥 윗면 Z 0.30 (기초 300), 천장 Z 2.70 (천장고 2400), 외벽 두께 0.15, 칸막이 0.10
- 방 (도면 mm → 블렌더 m):
  - 방(침실): x 0~2.41, y 0~−3.5
  - 주방/거실: x 2.41~8.26, y 0~−2.14 (남·동쪽 트임) / 거실: x 2.41~6.92, y −2.14~−3.5 / 현관: x 6.92~8.26, y −2.14~−3.5
  - 화장실(양변기): x 8.26~10, y 0~−1.29 / 세면대(트인 알코브): x 8.26~10, y −1.29~−2.21 / 샤워실: x 8.26~10, y −2.21~−3.5
- 창·문 (이미 기본 모델에 있음, 위치 유지):
  - 침실 서쪽 고정창 1500×1000 (H900) 중심 y −2.17 / 침실 남쪽 고정창 1000×800 (H1100) 중심 x 1.30
  - 침실 문 (칸막이 x 2.41) 900×2100 중심 y −0.73
  - 주방 북쪽 이중창 1400×600 (H1100) 중심 x 6.70 (싱크 위)
  - 거실 남쪽 큰 미닫이창 2000×2100 (H100) 중심 x 4.30
  - 현관문 (남쪽) 900×2100 중심 x 7.40
  - 화장실 북쪽 작은창 600×500 (H1600) 중심 x 9.02 / 화장실·샤워실 문 700×1900

## 카탈로그 사진 (참고해서 최대한 비슷하게)
- 대표(렌더): https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575974752_dt4l92.png
- 외부 정면: https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575669148_n5juje.jpg
- 외부 측면(동쪽): https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575675425_k6cgpq.jpg
- 내부 거실·주방(동→서): https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_grz04r.jpg
- 내부 서쪽 슬랫벽·바테이블: https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_zzk77y.jpg
- 내부 거실(서→동): https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_3fn8lk.jpg
- 침실: https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_xth5xk.jpg
- 샤워실: https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_85uf7g.jpg
- 화장실: https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_83052z.jpg
- 세면 알코브·신발장·현관: https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/object/public/model-images/forest10w/1783575685725_ukhqzz.jpg

## 외부 (사진 판독)
- **외벽 2가지 마감**
  - 남쪽 정면 x 0~2.41(침실 구간) + 서쪽 벽 + 동쪽 벽(남쪽 끝 1.0m 제외) : **화이트 세로 골강판** (#e8e7e2, 골 간격 약 76mm)
  - 남쪽 정면 x 2.41~10 + 동쪽 벽 남쪽 끝 1.0m : **다크그레이 벽돌무늬(스톤 엠보) 강판 패널** (#5f6268, 작은 벽돌 패턴 + 미세 요철)
  - 북쪽 벽: 남쪽과 같은 나눔으로 (침실 구간 화이트, 나머지 그레이)
  - 두 마감이 만나는 곳, 모든 바깥 모서리, 미닫이창 둘레(좌우·위 100mm 폭 박스 프레임)에 **그레이 트림** (#6a6d72, 60~100mm 폭, 15mm 돌출)
- **장식 세로 바** 2개 (블랙 #2a2b2e, 30×30mm, 길이 0.95m, 위끝이 벽 상단 0.25m 아래): 남쪽 x 0.32 / 남쪽 x 9.60
- **창호**: 바깥 프레임 차콜(#2f3237), 안쪽은 흰색 PVC(#f2f2ef). 큰 미닫이창은 바깥 실버그레이(#9a9ea3) 2짝
- **현관문**: 차콜 문틀 + 우드톤 패널(#8a6a4c) 가로 5칸(칸 사이 검은 홈 10mm), 실버/블랙 디지털 도어락, 문 왼쪽 위(x 6.68, 바닥+1.9m) 흰색 소형 큐브 벽등
- **지붕**: 완만한 박공(용마루 동서 방향, rise 약 0.3m), 차콜 징크 스탠딩심, 처마 0.45m, **두꺼운 그레이 후레싱(높이 약 0.25m)**, 처마밑은 베이지 골판(#d8c9a3)
- **하부**: 하단 차콜 스커트 띠(약 0.12m) + 그 아래 콘크리트 블록 받침(0.2×0.4m, 회백색) 약 2m 간격으로 보이게 (전체를 막은 하부 벽 대신)
- **데크**: 현관 앞 합성목 데크 x 5.6~9.2, y −3.5~−4.4 (깊이 0.9m), 윗면 Z 약 0.25, 짙은 브라운 판재(#6b5444) + 차콜 테두리, 모서리 블록 받침

## 내부 (사진 판독)
- **바닥**: 밝은 그레이 오크 장판(#c8c0b4, 판 방향 X축) — 침실·거실·주방. 현관·욕실 바닥은 다크 슬레이트 타일(#55595d, 300각)
- **벽**: 기본 흰색(#efeeea). 거실 남쪽 벽 안쪽·침실 벽은 연한 그레이(#b9bab5)
- **천장**: 흰색. 거실·침실에 매입 다운라이트(지름 0.1m, 발광), 욕실 천장은 소나무 루버(#d9b98a)
- **간접조명**: 거실 남쪽 벽 천장 쪽 몰딩 박스(깊이 0.15, 높이 0.12, x 2.46~8.2) 안 따뜻한 LED 띠 / 침실 동쪽 벽 위 같은 몰딩
- **실링팬**: 거실 중앙 천장(x 5.0, y −1.6) 흰색 3날개
- **서쪽 슬랫 벽**: 칸막이 x 2.41 의 거실 쪽 면 전체(문 제외)에 오크 세로 슬랫(폭 20, 깊이 15, 간격 15mm) + 블랙 큐브 벽등 2개(바닥+1.9m, y −1.6 / −2.9 부근)
- **바테이블**: 슬랫 벽 앞 x 2.48~2.88, y −1.35~−3.15, 높이 0.9, 오크 상판 + 흰 철제 다리, 연그레이 바스툴 2개
- **주방**: 북쪽 벽 x 5.2~8.15, 하부장 세이지그린(#b7c2ae) 높이 0.85 깊이 0.6, 흰 인조대리석 상판, 스텐 싱크(창 아래 x 6.4~7.2), 수전, 2구 인덕션(x 5.5~6.1), 상부장 흰색 무광(창 구간은 창 위로만), 흰 서브웨이 타일 백스플래시, 슬림 후드, 창 아래 식기건조대
- **거실**: 북쪽 벽 앞 베이지 패브릭 3인 소파(x 2.7~4.7, 검은 철제 프레임 + 우드 팔걸이), 흰 러그, 원형 유리 트롤리 테이블
- **침실**: 퀸 침대(1.5×2.0) 머리를 남쪽 벽에, 흰 침구 + 다크그레이 베개 2개 + 체크 러너
- **현관**: 동쪽 칸막이(x 8.26) 앞 흰 신발장(폭 1.0, 깊이 0.35, 높이 1.2, 위쪽 오크 오픈 선반)
- **세면 알코브**: 뒷벽(동쪽) 오크 슬랫 + 달걀형 LED 거울(뒤에서 빛), 흰 하부장 위 사각 볼 세면대 + 수전
- **화장실**: 벽 베이지 대형 타일(600×300, #d8d2c6), 양변기(북동쪽), 휴지걸이
- **샤워실**: 같은 타일 벽, 샤워 수전 레일 + 해바라기 헤드
- 실내 문: 흰색 문짝·문틀 (현관문만 우드톤)

## 이름 규칙 (변환·제품 옵션용)
- 재질 이름 = 웹 부품 이름. 기본 모델 재질 이름(외장_사이딩_X/Y, 창틀, 유리, 문짝, 문틀, 데크, 바닥_마루, 바닥_타일, 천장, 징크, 후레싱, 처마밑 ...)은 유지하고,
  새 재질은 한글로 명확하게 (예: 외장_골강판_화이트, 외장_패널_그레이, 외장_트림, 주방_하부장, 슬랫_오크)
- 천장 위에 있는 부품(지붕·후레싱·박공벽 등)은 오브젝트 커스텀 속성 `roof=1` 을 유지/추가
- 조명은 실제 블렌더 라이트로: 다운라이트 = SPOT(이름 `LT_DL..`), 간접등 = AREA(`LT_COVE..`), 벽등 = POINT(`LT_WALL..`)
- 렌더용 잔디·배경은 `Backdrop` 컬렉션에 (변환 때 제외)

## 끝나면
1. `models/src/FOREST10-WG.blend` 저장
2. 변환: `python tools/blender/blend_to_planner_glb.py -- models/src/FOREST10-WG.blend models --exclude-collection Backdrop --roof-z 2.68`
   (pip 의 bpy 모듈 또는 `blender -b --python ...`) → `models/FOREST10-WG.glb` + `.lights.json`
3. 커밋·푸시 후 클라우드 세션(또는 이 세션)에서 홈플래너 카드 연결 (src/templates.js 실물 템플릿 + model3d)
