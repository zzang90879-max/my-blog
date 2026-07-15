(function () {
  "use strict";

  var SIZE = 4;
  var BEST_KEY = "2048-best-score";
  var WIN_VALUE = 2048;

  var board = [];
  var score = 0;
  var best = 0;
  var isGameOver = false;
  var hasWon = false;
  var keepPlayingAfterWin = false;

  var tilesEl = document.getElementById("tiles");
  var gridBgEl = document.getElementById("grid-bg");
  var scoreValueEl = document.getElementById("score-value");
  var bestValueEl = document.getElementById("best-value");
  var finalScoreEl = document.getElementById("final-score");
  var newGameBtn = document.getElementById("new-game-btn");
  var winOverlay = document.getElementById("win-overlay");
  var gameoverOverlay = document.getElementById("gameover-overlay");
  var keepPlayingBtn = document.getElementById("keep-playing-btn");
  var winRestartBtn = document.getElementById("win-restart-btn");
  var gameoverRestartBtn = document.getElementById("gameover-restart-btn");
  var boardContainer = document.getElementById("board-container");

  function createEmptyBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) {
      b.push([0, 0, 0, 0]);
    }
    return b;
  }

  function getEmptyCells() {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) {
          cells.push({ r: r, c: c });
        }
      }
    }
    return cells;
  }

  function spawnTile() {
    var empty = getEmptyCells();
    if (empty.length === 0) return false;
    var cell = empty[Math.floor(Math.random() * empty.length)];
    board[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  function loadBest() {
    var stored = localStorage.getItem(BEST_KEY);
    var n = stored ? parseInt(stored, 10) : 0;
    return isNaN(n) ? 0 : n;
  }

  function saveBest() {
    localStorage.setItem(BEST_KEY, String(best));
  }

  function updateScoreUI(bumped) {
    scoreValueEl.textContent = String(score);
    bestValueEl.textContent = String(best);
    if (bumped) {
      scoreValueEl.classList.remove("bump");
      // force reflow to restart animation
      void scoreValueEl.offsetWidth;
      scoreValueEl.classList.add("bump");
    }
  }

  function buildGridBg() {
    gridBgEl.innerHTML = "";
    for (var i = 0; i < SIZE * SIZE; i++) {
      var cell = document.createElement("div");
      cell.className = "grid-cell";
      gridBgEl.appendChild(cell);
    }
  }

  function render() {
    tilesEl.innerHTML = "";
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var value = board[r][c];
        if (value === 0) continue;
        var tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.value = String(value);
        if (value > WIN_VALUE) {
          tile.dataset.super = "1";
        }
        tile.style.gridRowStart = String(r + 1);
        tile.style.gridColumnStart = String(c + 1);
        tile.textContent = String(value);
        tilesEl.appendChild(tile);
      }
    }
  }

  function slideAndMergeRow(row) {
    var compacted = row.filter(function (v) { return v !== 0; });
    var merged = [];
    var gained = 0;
    var changed = false;

    for (var i = 0; i < compacted.length; i++) {
      if (i < compacted.length - 1 && compacted[i] === compacted[i + 1]) {
        var mergedValue = compacted[i] * 2;
        merged.push(mergedValue);
        gained += mergedValue;
        i++;
      } else {
        merged.push(compacted[i]);
      }
    }

    while (merged.length < SIZE) {
      merged.push(0);
    }

    for (var j = 0; j < SIZE; j++) {
      if (merged[j] !== row[j]) {
        changed = true;
        break;
      }
    }

    return { row: merged, gained: gained, changed: changed };
  }

  function rotateBoardCW(b) {
    var result = createEmptyBoard();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        result[c][SIZE - 1 - r] = b[r][c];
      }
    }
    return result;
  }

  function rotateBoardCCW(b) {
    var result = createEmptyBoard();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        result[SIZE - 1 - c][r] = b[r][c];
      }
    }
    return result;
  }

  // Normalize every direction to a "move left" operation via rotation.
  function getRotationsForDirection(direction) {
    switch (direction) {
      case "left":
        return 0;
      case "up":
        return 1; // rotate CCW once so "up" column becomes left row
      case "right":
        return 2;
      case "down":
        return 3;
      default:
        return 0;
    }
  }

  function rotateNTimesCW(b, times) {
    var result = b;
    for (var i = 0; i < times; i++) {
      result = rotateBoardCW(result);
    }
    return result;
  }

  function rotateNTimesCCW(b, times) {
    var result = b;
    for (var i = 0; i < times; i++) {
      result = rotateBoardCCW(result);
    }
    return result;
  }

  function move(direction) {
    if (isGameOver) return;
    if (hasWon && !keepPlayingAfterWin) return;

    var rotations = getRotationsForDirection(direction);
    var working = rotateNTimesCCW(board, rotations);

    var changedAny = false;
    var gainedTotal = 0;

    for (var r = 0; r < SIZE; r++) {
      var result = slideAndMergeRow(working[r]);
      working[r] = result.row;
      gainedTotal += result.gained;
      if (result.changed) changedAny = true;
    }

    var restored = rotateNTimesCW(working, rotations);

    if (!changedAny) {
      return;
    }

    board = restored;
    score += gainedTotal;
    if (score > best) {
      best = score;
      saveBest();
    }

    spawnTile();
    render();
    updateScoreUI(gainedTotal > 0);

    if (!hasWon && boardHasValue(WIN_VALUE)) {
      hasWon = true;
      showWinOverlay();
      return;
    }

    if (!canMove()) {
      isGameOver = true;
      showGameOverOverlay();
    }
  }

  function boardHasValue(target) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === target) return true;
      }
    }
    return false;
  }

  function canMove() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return true;
        if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
        if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
      }
    }
    return false;
  }

  function showWinOverlay() {
    winOverlay.hidden = false;
  }

  function hideWinOverlay() {
    winOverlay.hidden = true;
  }

  function showGameOverOverlay() {
    finalScoreEl.textContent = String(score);
    gameoverOverlay.hidden = false;
  }

  function hideGameOverOverlay() {
    gameoverOverlay.hidden = true;
  }

  function newGame() {
    board = createEmptyBoard();
    score = 0;
    isGameOver = false;
    hasWon = false;
    keepPlayingAfterWin = false;
    hideWinOverlay();
    hideGameOverOverlay();
    spawnTile();
    spawnTile();
    render();
    updateScoreUI(false);
  }

  function init() {
    best = loadBest();
    buildGridBg();
    newGame();
  }

  document.addEventListener("keydown", function (e) {
    var map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right"
    };
    var direction = map[e.key];
    if (!direction) return;
    e.preventDefault();
    move(direction);
  });

  newGameBtn.addEventListener("click", newGame);
  winRestartBtn.addEventListener("click", newGame);
  gameoverRestartBtn.addEventListener("click", newGame);
  keepPlayingBtn.addEventListener("click", function () {
    keepPlayingAfterWin = true;
    hideWinOverlay();
  });

  var touchStartX = 0;
  var touchStartY = 0;
  var touchActive = false;
  var SWIPE_THRESHOLD = 30;

  boardContainer.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length !== 1) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  boardContainer.addEventListener(
    "touchend",
    function (e) {
      if (!touchActive) return;
      touchActive = false;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - touchStartX;
      var dy = touch.clientY - touchStartY;
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

      if (absDx > absDy) {
        move(dx > 0 ? "right" : "left");
      } else {
        move(dy > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );

  var touchButtons = document.querySelectorAll(".touch-btn");
  for (var i = 0; i < touchButtons.length; i++) {
    touchButtons[i].addEventListener("click", function (e) {
      var dir = e.currentTarget.getAttribute("data-dir");
      if (dir) move(dir);
    });
  }

  init();
})();
