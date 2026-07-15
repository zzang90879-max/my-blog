(() => {
  const GRID = 16;
  const CELL = 16; // canvas 내부 px, 16*16=256

  const canvas = document.getElementById('pixel-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('grid-overlay');
  const overlayCtx = overlay.getContext('2d');
  const palette = document.getElementById('palette');
  const eraserBtn = document.getElementById('eraser-btn');
  const customColorInput = document.getElementById('custom-color');
  const currentColorPreview = document.getElementById('current-color-preview');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');

  let pixels = new Array(GRID * GRID).fill(null);
  let currentColor = '#000000';
  let isDrawing = false;
  let lastCell = null;

  function drawGridOverlay() {
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    overlayCtx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      const pos = i * CELL + 0.5;
      overlayCtx.beginPath();
      overlayCtx.moveTo(pos, 0);
      overlayCtx.lineTo(pos, overlay.height);
      overlayCtx.stroke();
      overlayCtx.beginPath();
      overlayCtx.moveTo(0, pos);
      overlayCtx.lineTo(overlay.width, pos);
      overlayCtx.stroke();
    }
  }

  function drawCell(row, col, color) {
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    } else {
      ctx.clearRect(col * CELL, row * CELL, CELL, CELL);
    }
    pixels[row * GRID + col] = color;
  }

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

  function setCurrentColor(color) {
    currentColor = color;
    currentColorPreview.style.background = color || 'transparent';
    const swatches = palette.querySelectorAll('.swatch');
    swatches.forEach((sw) => {
      const isActive = !!color && sw.dataset.color === color;
      sw.setAttribute('aria-pressed', String(isActive));
    });
    eraserBtn.setAttribute('aria-pressed', String(color === null));
  }

  palette.addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch');
    if (!swatch || swatch === eraserBtn) return;
    setCurrentColor(swatch.dataset.color);
  });

  eraserBtn.addEventListener('click', () => {
    setCurrentColor(null);
  });

  customColorInput.addEventListener('input', (e) => {
    setCurrentColor(e.target.value);
  });

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    isDrawing = true;
    const { row, col } = getCellFromEvent(e);
    drawCell(row, col, currentColor);
    lastCell = { row, col };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    const { row, col } = getCellFromEvent(e);
    if (!lastCell || lastCell.row !== row || lastCell.col !== col) {
      drawCell(row, col, currentColor);
      lastCell = { row, col };
    }
  });

  function endDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    lastCell = null;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  canvas.addEventListener('pointerup', endDrawing);
  canvas.addEventListener('pointercancel', endDrawing);

  clearBtn.addEventListener('click', () => {
    pixels.fill(null);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  saveBtn.addEventListener('click', () => {
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

  drawGridOverlay();
  setCurrentColor(currentColor);
})();
