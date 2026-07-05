---
name: ship
description: >-
  현재 작업 브랜치의 변경사항을 커밋 → 푸시 → 새 PR 생성 → main에 자동 스쿼시 머지 →
  작업 브랜치를 최신 main으로 재정렬하는 배포 워크플로. 사용자가 "새 PR로 메인에 자동 반영",
  "자동 머지", "배포", "ship", "반영해줘" 등을 요청하거나 한 단위의 작업이 끝나 main에 올려야 할 때 사용.
---

# ship — 새 PR로 main 자동 반영

SEUM Home Planner의 표준 배포 워크플로입니다. 세움 홈플래너는 한 번에 한 기능씩 작업하고,
각 변경을 새 PR로 만들어 `main`에 스쿼시 머지한 뒤 배포(Netlify 자동)합니다.

## 고정 값

- 저장소(GitHub MCP): owner `actorjoon0001-glitch`, repo `seum-home-planner`
- 작업 브랜치: `claude/stoic-wright-s0l2rn`
- 기본 브랜치: `main`
- 머지 방식: **squash**

## 실행 순서

1. **사전 점검**
   - 변경한 JS 파일은 커밋 전에 문법 검사한다. package.json이 CommonJS이므로
     `/tmp`에 `.mjs`로 복사 후 `node --check`로 확인:
     `cp src/파일.js /tmp/c.mjs && node --check /tmp/c.mjs`
   - `git status`로 의도한 변경만 스테이지되는지 확인한다.

2. **커밋** — 작업 브랜치에서 진행. 없으면 생성한다.
   - `git checkout claude/stoic-wright-s0l2rn 2>/dev/null || git checkout -b claude/stoic-wright-s0l2rn`
   - `git add -A && git commit`
   - 커밋 메시지: 한국어로 명확하게(제목 + 본문). 반드시 아래 두 줄로 끝낸다.
     ```
     Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
     Claude-Session: https://claude.ai/code/session_01Bxgd5zxfawC3gjQbMBUDuZ
     ```
   - 모델 식별자(claude-opus-4-8 등)는 커밋/PR/코드에 절대 넣지 않는다.

3. **푸시** (네트워크 실패 시 2s·4s·8s·16s 지수 백오프로 최대 4회 재시도)
   - `git push -u origin claude/stoic-wright-s0l2rn`

4. **PR 생성** — GitHub MCP `mcp__github__create_pull_request`
   - owner `actorjoon0001-glitch`, repo `seum-home-planner`, head 작업 브랜치, base `main`
   - 제목/본문은 한국어. 본문 끝에 다음을 넣는다:
     ```
     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     https://claude.ai/code/session_01Bxgd5zxfawC3gjQbMBUDuZ
     ```

5. **스쿼시 머지** — `mcp__github__merge_pull_request` 로 `merge_method: "squash"`

6. **브랜치 재정렬** — 머지된 main을 브랜치에 반영해 다음 작업 기반을 최신화한다.
   - `git fetch origin main && git reset --hard origin/main && git push -f -u origin claude/stoic-wright-s0l2rn`

7. **보고** — 머지된 PR 번호와 반영된 변경 요약을 한국어로 사용자에게 알린다.
   Netlify가 몇 분 내 자동 배포되며 새로고침(Ctrl+Shift+R)으로 확인 가능함을 안내한다.

## 주의

- 사용자가 명시적으로 요청하지 않는 한 이 브랜치/워크플로 외의 다른 브랜치로 푸시하지 않는다.
- 만약 이 브랜치의 PR이 이미 머지되어 있고 새 작업이라면, 최신 main에서 브랜치를
  다시 시작한 뒤(같은 이름 유지) 새 PR로 올린다. 이미 머지된 히스토리 위에 쌓지 않는다.
- 여러 병렬 세션이 main을 앞서 나갈 수 있다. 푸시 거부(non-fast-forward) 시 로컬이 최신
  main 기반이면 `git push -f`로 해결한다.
