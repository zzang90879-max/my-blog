# 픽셀 아트 에디터 웹앱 - SPEC

## 개요
- 이름: 픽셀 아트 에디터 (pixel-art)
- 설명: 16x16 격자에 클릭/드래그로 도트를 찍어 그림을 그리고 PNG로 저장하는 미니 에디터
- 위치: /apps/pixel-art/ (블로그의 다른 파일은 건드리지 않음, 완전 자체 완결)
- 라이브러리: 없음 (순수 HTML/CSS/JS, CDN 불필요)

## 파일 구조
```
apps/pixel-art/
  index.html   # 마크업 (헤더, 캔버스 래퍼, 팔레트, 액션 버튼)
  style.css    # 스타일 (반응형, 모바일 대응, 다크 테마)
  script.js    # 상태 관리 + 그리기 로직 + 입력 처리 + PNG 저장
```
- 파일명은 저장소 컨벤션(index.html 등 소문자)을 따름.
- 블로그 공용 css/js(css/style.css, js/*.js)는 import하지 않음. apps/pixel-art/ 내부 파일만 참조.

## 격자/캔버스 구현 방식: `<canvas>` 채택
DOM grid(16x16 개별 div/버튼)와 `<canvas>` 두 가지를 검토했다.

- DOM grid 방식: 구현은 직관적이지만 PNG로 저장하려면 DOM을 별도 렌더링 라이브러리(html2canvas 등) 없이는 이미지화하기 어렵다. 외부 라이브러리 없이 저장 기능을 구현하기 힘듦.
- canvas 방식: `canvas.toBlob()` / `toDataURL()`로 라이브러리 없이 즉시 PNG 저장이 가능하고, 픽셀 단위 fillRect로 그리기 로직도 단순하다.

→ **canvas 채택**. PNG 저장 요구사항을 라이브러리 없이 만족시키는 것이 결정적 이유.

### 캔버스 레이어 구성 (3-layer)
캔버스 자체를 export용 원본으로 그대로 쓰기 위해, 그리드 선(격자 안내선)은 데이터 캔버스에 직접 그리지 않고 별도 오버레이로 분리한다. 그래야 "저장 버튼 클릭 = 현재 데이터 캔버스를 그대로 PNG화"로 export 로직이 단순해진다.

```
.canvas-wrap (position: relative, 정사각형)
  ├── .checkerboard (배경 div, 투명 픽셀을 시각적으로 표시하는 체크무늬 CSS 배경)
  ├── #pixel-canvas   (데이터 캔버스, 실제 그림 데이터 - 이것만 export에 사용)
  └── #grid-overlay   (격자 안내선 캔버스, pointer-events: none, 정적 렌더링 1회)
```

- `#pixel-canvas`, `#grid-overlay`는 `position: absolute; inset: 0;`로 완전히 겹침.
- `#grid-overlay`는 `pointer-events: none`이라 모든 마우스/터치 이벤트는 자연스럽게 `#pixel-canvas`로 전달됨 (별도 이벤트 위임 불필요).
- 캔버스 내부 해상도: `width=256 height=256` (16셀 × 16px). CSS로는 `width: min(90vw, 360px); aspect-ratio: 1/1;`로 반응형 확대, `image-rendering: pixelated;`로 확대 시에도 셀 경계가 흐려지지 않게 함.
- 셀 크기 상수: `const GRID = 16; const CELL = 16; // canvas 내부 px, 16*16=256`

### 데이터 모델
```js
// pixels[row*GRID+col] = 색상 문자열(hex) 또는 null(투명/미채색)
let pixels = new Array(GRID * GRID).fill(null);
```
- `drawCell(row, col, color)`: color가 있으면 `ctx.fillStyle=color; ctx.fillRect(col*CELL, row*CELL, CELL, CELL)`, 없으면(지우개) `ctx.clearRect(...)`로 해당 셀만 투명 처리.
- 전체 다시 그리기가 필요한 경우(초기화 등)는 `ctx.clearRect(0,0,256,256)` 후 필요 시 배열 순회로 재렌더링.

## 그리기 인터랙션
마우스와 터치를 분리 처리하지 않고 **Pointer Events(pointerdown/pointermove/pointerup/pointercancel)** 로 통일 처리한다. 이렇게 하면 mousedown+mousemove와 touchstart+touchmove를 각각 구현할 필요가 없다.

- `#pixel-canvas`에 `style.touchAction = 'none'`을 적용해 드래그 그리기 중 페이지 스크롤/핀치줌이 발생하지 않도록 함(2048의 `touch-action: none` 패턴과 동일).
- `pointerdown`: `canvas.setPointerCapture(e.pointerId)` 호출 → 좌표를 셀 인덱스로 변환 → 해당 셀 채색 → `isDrawing = true`, `lastCell = {row, col}` 기록.
- `pointermove`: `isDrawing`이 true일 때만 좌표→셀 변환, 이전에 칠한 셀(`lastCell`)과 다르면 채색 후 `lastCell` 갱신(같은 셀 반복 호출로 인한 불필요한 재작업 방지).
- `pointerup` / `pointercancel`: `isDrawing = false`, `releasePointerCapture(e.pointerId)`.
- 좌표→셀 변환 함수:
```js
function getCellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const col = Math.min(GRID - 1, Math.max(0, Math.floor(x / CELL)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor(y / CELL)));
  return { row, col };
}
```
- 캔버스 CSS 표시 크기와 내부 해상도(256x256)가 다를 수 있으므로 `getBoundingClientRect()` 기반 스케일 보정이 필수.

## 색상 팔레트 UI
- 기본 팔레트: 16색 스와치 버튼(`<button class="swatch" data-color="#000000">` 형태)을 그리드로 배치. 예시 색상: 검정, 흰색, 빨강, 주황, 노랑, 연두, 초록, 청록, 하늘색, 파랑, 남색, 보라, 자홍, 분홍, 갈색, 회색.
- 커스텀 색상: `<input type="color" id="custom-color">`를 팔레트 옆에 배치. 값 변경(`input` 이벤트) 시 `currentColor`를 해당 값으로 설정하고, 팔레트의 활성 스와치 표시를 해제하여 "커스텀 색상 사용 중" 상태를 나타냄.
- 현재 선택된 색 표시:
  - 활성 스와치에 `aria-pressed="true"` + CSS 아웃라인/체크 표시로 강조.
  - 별도로 헤더 근처에 현재 색상을 크게 보여주는 미리보기 박스(`#current-color-preview`, 배경색 = currentColor)를 두어 스와치를 눈으로 찾지 않아도 지금 무슨 색으로 그리는지 바로 확인 가능하게 함.
- 지우개(eraser): 팔레트 끝에 특수 스와치로 포함 권장(과하지 않은 범위이므로 생략하지 않고 포함). 클릭 시 `currentColor = null`로 설정, 이후 그리기는 `clearRect`로 해당 셀을 투명화. 스와치 아이콘은 체크무늬 배경 또는 지우개 이모지(🧹)로 표시.

## 전체 지우기(Clear) 버튼
포함한다. `#clear-btn` 클릭 시:
- `pixels.fill(null)`
- `ctx.clearRect(0, 0, 256, 256)`
- 되돌리기 기능은 범위 밖이므로, 실수 방지를 위해 가벼운 `confirm('전체 그림을 지울까요?')` 확인 절차를 두는 것을 권장(과하면 생략 가능 — 캔버스가 작아 다시 그리는 비용이 낮으므로 confirm 없이 즉시 지워도 무방).

## PNG 저장 방식
16x16을 그대로 저장하면 이미지가 너무 작으므로(1px=1px), 캔버스 내부 해상도 자체를 이미 **16배 업스케일된 256x256**으로 설계했다(위 "격자/캔버스 구현 방식" 참조). 따라서 별도의 오프스크린 업스케일 캔버스 없이, 화면에 그리는 `#pixel-canvas`가 곧 export 원본이 된다.

```js
document.getElementById('save-btn').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixel-art.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
});
```
- `canvas.toBlob` + `URL.createObjectURL` + `a[download]` 방식 채택 (toDataURL보다 대용량에 유리하고 비동기라 메인 스레드 블로킹이 적음; 256x256 정도면 toDataURL도 무방하지만 toBlob을 기본으로 채택).
- 미채색 셀은 `clearRect`만 사용했으므로 alpha=0 상태 그대로 유지되어, 저장된 PNG에서도 배경이 흰색으로 덮이지 않고 투명하게 저장된다(그리기 도구 특성상 투명 배경 유지가 자연스러운 기본값). 흰 배경으로 채워 저장하고 싶은 경우는 향후 "배경색 지정 후 저장" 옵션으로 확장 가능(이번 범위 밖).
- 파일명은 고정값 `pixel-art.png` (타임스탬프 등 부가 로직은 범위 밖, 필요시 나중에 확장).

## 모바일 지원 방법
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`로 핀치줌 방지(2048과 동일 패턴).
- `#pixel-canvas`에 `touch-action: none`을 적용해 드래그 그리기 중 페이지 스크롤이 함께 일어나지 않도록 함.
- Pointer Events를 사용하므로 마우스/터치/펜 입력이 코드 분기 없이 동일하게 동작.
- 반응형 레이아웃: 캔버스는 `width: min(90vw, 360px); aspect-ratio: 1/1;`로 화면 폭에 맞춰 축소, `image-rendering: pixelated`로 확대해도 각 셀 경계가 흐려지지 않음.
- 팔레트 스와치는 최소 32~36px 크기, `flex-wrap: wrap` 또는 CSS grid로 배치해 좁은 화면에서도 줄바꿈되며 터치하기 쉽게 함.
- 액션 버튼(저장, 전체 지우기)은 2048과 동일하게 최소 44px 터치 타깃 확보.
- 전체 레이아웃은 세로 1열(flex-direction: column)을 기본으로 하여 모바일/데스크톱 모두 동일 구조로 단순화(필요시 넓은 화면에서 팔레트를 캔버스 옆으로 배치하는 media query는 선택 사항, 생략 가능).

## 외부 라이브러리 사용 여부
사용하지 않음. Canvas API, Pointer Events, `<input type="color">` 모두 브라우저 네이티브 기능만으로 요구사항을 충족하므로 CLAUDE.md의 "외부 라이브러리 최소화" 원칙에 따라 라이브러리/CDN 없이 순수 HTML/CSS/JS로 구현한다.

## 시각 스타일 참고 (선택)
apps/2048/style.css의 다크 테마와 톤을 맞추는 것을 권장하되 필수는 아님. 픽셀 아트 도구 특성상 체크무늬 투명 배경, 밝은 팔레트 스와치 대비를 위해 어두운 배경을 유지하는 편이 시각적으로 자연스럽다.

## 구현 범위 밖 (Nice to have, 생략 가능)
- Undo/Redo 기능
- 저장/불러오기(localStorage에 그림 임시 저장)
- 배경색 지정 후 저장(현재는 투명 배경 고정)
- 여러 프레임(애니메이션) 지원
- 확대/축소(zoom) 인터랙션
