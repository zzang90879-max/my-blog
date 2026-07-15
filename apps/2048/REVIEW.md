# REVIEW: 2048 게임 웹앱

검증일: 2026-07-15
검증자: REVIEW 담당 에이전트 (BUILD 에이전트와 별개, 독립 검증)

## 검증 방법
1. `SPEC.md`와 `index.html` / `style.css` / `script.js` 코드 대조 검토
2. 이동/병합 회전 로직(`rotateBoardCW`/`rotateBoardCCW` + `getRotationsForDirection`)을 Node.js로 별도 추출해 4방향(left/up/right/down) 모두 단일 타일 이동 결과가 기대 좌표와 일치하는지 유닛 테스트로 확인
3. `.claude/launch.json`의 `static-server`(`npx serve -l 5500 .`)로 프리뷰 서버를 켜고 `http://localhost:5500/apps/2048/`에 접속해 실제 브라우저(Chromium 기반 프리뷰)에서 조작 검증
   - 키보드 방향키 입력 → 타일 이동/병합/점수 갱신을 DOM 상태(`.tile` 요소들의 `data-value`, `gridRowStart/ColumnStart`, `#score-value`, `#best-value`)를 JS로 읽어 확인
   - 반복 입력으로 보드를 끝까지 채워 Game Over 오버레이가 실제로 뜨는지, 최종 점수가 맞는지 확인
   - "새 게임" 버튼으로 재시작 시 점수/보드 초기화, BEST 유지 확인
   - 뷰포트를 375x812(모바일)로 리사이즈해 가로 스크롤 발생 여부, 보드/터치컨트롤 레이아웃 확인
   - 콘솔 에러 및 네트워크 요청(404 등) 확인

## 결과

### 1) SPEC 대비 구현
- 파일 구조(`index.html`/`style.css`/`script.js`, 블로그 공용 css/js 미참조) — 일치
- 상태 변수(`board`, `score`, `best`, `isGameOver`, `hasWon`, `keepPlayingAfterWin`) — 일치
- 초기화(빈칸 2곳에 90%/10% 확률로 2/4 스폰) — 일치
- 회전/전치 기반 "왼쪽 밀기" 통일 처리 — 일치, 4방향 모두 유닛 테스트로 정합성 확인
- 병합 시 한 타일당 최대 1회 병합, score 가산, 우측 패딩 — 코드 검토 및 실측으로 확인 (예: 2+2 → 4, score +4로 정상 반영)
- 변경 없으면 스폰 안 함 — `changedAny` 체크로 구현됨, 확인
- 승리 조건(정확히 2048 도달 시 오버레이, 계속하기/새 게임) — 코드 로직 확인(실측은 2048 도달까지 플레이가 비현실적이라 로직 검토로 대체, Game Over와 동일한 hidden 토글 메커니즘 공유 확인됨)
- 게임오버 판정(`canMove`: 빈칸 없음 + 인접 동일값 없음) — 실측: 보드를 꽉 채운 뒤 실제로 "Game Over" 오버레이 표시, 최종 점수(3448) 정상 표시
- 새 게임 시 best 유지, score/hasWon 초기화 — 실측 확인 (재시작 후 score=0, best=3448 유지)
- 점수판 UI(SCORE/BEST 박스, New Game 버튼, 힌트 텍스트, bump 애니메이션) — 존재 및 동작 확인
- localStorage 키 `2048-best-score` — 일치, 저장/로드 정상 동작
- 모바일 대응(viewport 메타, `touch-action: none`, touchstart/touchend 스와이프, 임계값 30px, 온스크린 방향 버튼, 44px 이상 터치 타깃, `clamp()` 폰트, `min(90vw, 420px)` 보드 크기) — 모두 구현됨. 375px 폭에서 `scrollWidth === clientWidth`로 가로 스크롤 없음 확인

### 2) 코드 리뷰
- 이동 로직, 병합 로직, 점수 계산, 스폰 로직에서 명백한 버그 없음
- 블로그의 `css/style.css`, `js/*.js`를 참조하지 않음 — `apps/2048/style.css`, `apps/2048/script.js`만 로드됨을 네트워크 요청으로도 재확인
- 오버레이 `hidden` 처리 시 `.overlay { display: flex }`와 충돌 가능성을 `.overlay[hidden] { display: none }` 규칙으로 명시적으로 해결해둔 점 확인(잠재적 흔한 실수를 피함)
- 사소한 설계상 특이사항(버그 아님): 2048 달성과 동시에 보드가 가득 차 더 이상 이동 불가능해지는 극단적 케이스에서는 그 턴에 Win 오버레이만 뜨고 Game Over 오버레이는 뜨지 않음(우선순위상 Win이 먼저 return). 사용자는 Win 오버레이에서 "새 게임"을 선택할 수 있으므로 실사용에 지장 없음 — 수정하지 않음.

### 3) 브라우저 실측 로그(요약)
- 초기 로드: 타일 2개 스폰, 콘솔 에러 없음
- ArrowLeft → 단일 타일이 좌측 끝으로 이동, 변경 있었으므로 새 타일 스폰됨
- ArrowUp → 같은 열의 2+2 타일이 4로 병합, score 0→4로 갱신
- 좌/상/우/하 반복 입력 100회 진행 → score 3448까지 정상 누적, best도 함께 갱신
- 보드 16칸이 가득 차고 인접 동일값 없는 상태에서 Game Over 오버레이 자동 표시, 최종 점수 텍스트 일치
- "새 게임" 클릭 → 보드 2타일로 초기화, score 0, best(3448) 유지, 오버레이 숨김
- 375x812 리사이즈 → 가로 스크롤 없음, 보드/터치 버튼 레이아웃 정상
- 전 과정에서 콘솔 에러 없음, 자체 리소스(index.html/style.css/script.js) 요청 모두 200 OK

## 수정 사항
없음. 발견된 버그 없어 apps/2048/ 내 파일을 수정하지 않았음.

## 최종 통과 여부
**통과 — 정상 동작 확인됨.** SPEC.md에 명시된 모든 필수 요구사항이 구현되어 있고, 실제 브라우저 조작(키보드 입력, 병합, 점수 갱신, 게임오버, 새 게임, 모바일 레이아웃)에서 모두 정상 동작을 확인했다. 코드 리뷰에서도 이동/회전/병합/스폰 로직에 결함을 찾지 못했다.
