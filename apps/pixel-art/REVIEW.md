# REVIEW: 픽셀 아트 에디터

- 검증자: REVIEW 단계 독립 에이전트 (BUILD 담당과 별개)
- 검증 일시: 2026-07-15
- 검증 환경: `npx serve -l 5500 .` 정적 서버 + 브라우저(프리뷰), 데스크톱 뷰 및 375x812 모바일 뷰

## 1. SPEC.md 대비 구현 비교

`apps/pixel-art/index.html`, `style.css`, `script.js`를 SPEC.md와 항목별로 대조했다.

| 항목 | SPEC | 구현 | 일치 여부 |
|---|---|---|---|
| 파일 구조 | index.html/style.css/script.js, 블로그 공용 css/js 미참조 | 3개 파일만 존재, `<link>`/`<script>` 모두 상대경로(`style.css`, `script.js`)로 자체 참조. 블로그 `css/style.css`, `js/*.js` 참조 없음 | 일치 |
| 캔버스 3-layer 구성 | checkerboard(div) + #pixel-canvas + #grid-overlay, absolute/inset:0 | 동일 구조로 구현, `#grid-overlay`에 `pointer-events:none` 적용 | 일치 |
| 해상도/상수 | GRID=16, CELL=16, canvas 256x256 | 동일 | 일치 |
| 데이터 모델 | `pixels` 배열 + `drawCell` (fillRect/clearRect) | 동일 로직 | 일치 |
| 좌표 변환 | `getCellFromEvent` (getBoundingClientRect 기반 스케일 보정) | SPEC 코드와 사실상 동일 | 일치 |
| Pointer Events 처리 | pointerdown/move/up/cancel, setPointerCapture, touch-action:none | 동일하게 구현, `hasPointerCapture` 가드 후 `releasePointerCapture` 추가(SPEC보다 견고함) | 일치(개선) |
| 팔레트 16색 + 커스텀 색상 + 현재색 미리보기 | 필수 | 16개 스와치 + `#custom-color` + `#current-color-preview` 모두 구현 | 일치 |
| 지우개 | 포함 권장, 🧹 이모지 | `#eraser-btn`(🧹)로 구현, `currentColor=null` → clearRect | 일치 |
| 전체 지우기 | confirm 선택사항 | confirm 없이 즉시 지움(SPEC이 명시적으로 허용한 생략) | 일치 |
| PNG 저장 | toBlob + createObjectURL + a[download] | SPEC 코드와 동일 | 일치 |
| 모바일 대응 | viewport meta, touch-action:none, 반응형 캔버스, 44px 버튼, 32~36px 스와치 | 모두 구현, 380px 이하 미디어쿼리로 스와치 32px 축소 추가 | 일치 |
| 범위 밖 기능 미포함 | Undo/Redo, localStorage, 배경색 저장, 애니메이션, 줌 | 모두 미구현(범위 준수) | 일치 |

구현이 SPEC의 예시 코드와 거의 동일한 수준으로 충실히 반영되어 있음을 확인했다.

## 2. 브라우저 실동작 검증

정적 서버(`http://localhost:5500/apps/pixel-art/index.html`)에서 실제 로드 후 아래 항목을 확인했다.

- **초기 로딩**: 콘솔 에러 없음. 다크 테마 레이아웃 정상 렌더링(제목/힌트/캔버스/체크보드/팔레트/버튼).
- **클릭으로 픽셀 칠하기**: `dispatchEvent(new PointerEvent('pointerdown'/'pointerup'))`로 셀 중심 좌표를 정밀 계산해 클릭 → 정확히 해당 셀(16x16 서브픽셀 256개)만 지정한 색으로 채워짐을 `getImageData`로 확인.
- **드래그로 여러 픽셀 칠하기**: (5,0)→(5,5)까지 pointerdown 후 5회 pointermove → 정확히 (5,0)~(5,5) 6개 셀만 칠해짐(같은 셀 중복 방지 로직도 정상).
- **팔레트 색상 전환**: 파랑 스와치 클릭 → 이후 그리기 색이 파랑으로 바뀌고 `aria-pressed="true"`, 현재색 미리보기 배경도 `rgb(0,0,255)`로 갱신됨.
- **커스텀 색상**: `#custom-color`에 `#123456` 설정 후 `input` 이벤트 발생 → 그리기 색이 해당 값(rgb(18,52,86))으로 반영되고, 기존 활성 스와치의 `aria-pressed`는 자동으로 `false`로 해제됨.
- **지우개**: 지우개 클릭 시 `aria-pressed="true"`로 활성화, 기존에 칠했던 셀을 클릭하면 alpha=0(완전 투명)으로 정확히 지워짐. 다른 스와치 클릭 시 지우개 `aria-pressed`는 다시 `false`로 해제됨.
- **전체 지우기**: 클릭 시 캔버스의 모든 서브픽셀 alpha가 0으로 초기화됨을 확인.
- **PNG 저장**: `document.createElement('a')`를 가로채 확인한 결과, `save-btn` 클릭 시 `blob:` URL과 `download="pixel-art.png"` 속성을 가진 앵커가 생성되고 클릭되어 다운로드가 정상적으로 트리거됨.
- **모바일 뷰포트(375x812)**: 레이아웃이 1열로 정상 배치되고 `document.documentElement.scrollWidth(375) === clientWidth(375)`로 가로 스크롤 없음을 확인. 팔레트 스와치 줄바꿈, 버튼 크기 모두 정상.
- **콘솔 에러**: 전 과정에서 콘솔 에러/경고 없음.

### 참고: 자동화 클릭 툴 아티팩트
검증 초반 `computer` 툴의 좌표 클릭(마우스 이동 시뮬레이션 포함)으로 테스트했을 때, 클릭 지점 사이 이동 경로를 따라 의도치 않은 낙서가 그려지는 현상이 관찰되었다. 이를 `dispatchEvent(PointerEvent)`로 정밀 재현한 결과, `pointerup` 이후 `isDrawing`이 정확히 `false`로 리셋되고 후속 `pointermove`(pointerdown 없이)는 그리기를 유발하지 않음을 확인했다. 즉 이는 앱 로직의 결함이 아니라 자동화 툴이 클릭 사이에 실제 마우스 이동 이벤트를 발생시키며 생긴 아티팩트였다. 실사용(클릭/터치)에는 영향 없음.

## 3. 코드 리뷰

- 좌표 변환, 지우개, 팔레트 상태 동기화 로직에서 명백한 버그 없음.
- `endDrawing`에서 `canvas.hasPointerCapture(e.pointerId)` 가드 후 `releasePointerCapture` 호출 — SPEC 코드보다 방어적으로 구현되어 있어 개선점으로 판단, 별도 수정 불필요.
- 블로그 공용 리소스(`css/style.css`, `js/app.js` 등) 참조 없음 — 완전 자체 완결형으로 격리되어 있음을 확인.
- `drawGridOverlay`의 격자선이 `i*CELL+0.5` 오프셋으로 그려져 캔버스 우측/하단 끝 선이 반 픽셀 클리핑될 수 있으나(SPEC 예시 코드와 동일한 방식), 시각적으로 무시 가능한 수준이며 기능에 영향 없어 수정하지 않음.

## 4. 수정 사항

이번 검증에서 **코드 수정 없음**. 발견된 문제가 없어 `apps/pixel-art/` 내 파일은 변경하지 않았다.

## 5. 최종 결론

**정상 동작 확인됨 (PASS)** — SPEC.md에 기술된 모든 요구사항이 실제 구현에 반영되어 있고, 클릭/드래그 그리기, 팔레트 전환, 지우개, 커스텀 색상, 전체 지우기, PNG 저장, 모바일 반응형 레이아웃이 브라우저에서 모두 의도대로 동작함을 확인했다. 콘솔 에러 없음, 블로그 다른 파일과의 결합 없음.
