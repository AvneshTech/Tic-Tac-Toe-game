// ── DOM refs ──────────────────────────────
const boxes        = document.querySelectorAll(".box");
const resetBtn     = document.getElementById("reset-btn");
const clearBtn     = document.getElementById("clear-btn");
const newBtn       = document.getElementById("new-btn");
const overlay      = document.getElementById("overlay");
const resultMsg    = document.getElementById("result-msg");
const resultIcon   = document.getElementById("result-icon");
const currentTurn  = document.getElementById("current-turn");
const dotX         = document.getElementById("dot-x");
const dotO         = document.getElementById("dot-o");
const xScoreEl     = document.getElementById("x-score");
const oScoreEl     = document.getElementById("o-score");
const drawScoreEl  = document.getElementById("draw-score");
const scoreCardX   = document.getElementById("score-x");
const scoreCardO   = document.getElementById("score-o");
const soundBtn     = document.getElementById("sound-btn");
const soundIcon    = document.getElementById("sound-icon");
const pvpBtn       = document.getElementById("pvp-btn");
const aiBtn        = document.getElementById("ai-btn");

// ── State ─────────────────────────────────
let turnX      = true;        // true = X's turn, false = O's turn
let soundOn    = true;
let aiMode     = false;
let gameOver   = false;
let scores     = { X: 0, O: 0, D: 0 };
let board      = Array(9).fill("");

// ── Win patterns ──────────────────────────
const WIN_PATTERNS = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // cols
  [0,4,8],[2,4,6]            // diags
];

function getCurrentPlayer() {
  return turnX ? "X" : "O";
}

function isAiTurn() {
  return aiMode && !turnX;
}

function switchTurn() {
  turnX = !turnX;
  updateTurnUI();
}

function isBoardFull(boardState = board) {
  return boardState.every((cell) => cell !== "");
}

function getWinner(b) {
  for (const [a, bb, c] of WIN_PATTERNS) {
    if (b[a] && b[a] === b[bb] && b[bb] === b[c]) return b[a];
  }
  return null;
}

// ── Audio (Web Audio API) ─────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

function playTone(freq, type = "sine", duration = 0.12, gain = 0.18) {
  if (!soundOn) return;
  try {
    const ac  = getCtx();
    const osc = ac.createOscillator();
    const gn  = ac.createGain();
    osc.connect(gn); gn.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gn.gain.setValueAtTime(gain, ac.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(); osc.stop(ac.currentTime + duration);
  } catch (_) {}
}

const sounds = {
  clickX:  () => playTone(660, "square", 0.08, 0.15),
  clickO:  () => playTone(440, "sine",   0.1,  0.15),
  win:     () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => playTone(f, "sine", 0.2, 0.2), i * 90)
    );
  },
  draw:    () => [300, 250].forEach((f, i) =>
    setTimeout(() => playTone(f, "sawtooth", 0.15, 0.1), i * 120)
  ),
};

// ── Mode switching ────────────────────────
pvpBtn.addEventListener("click", () => {
  aiMode = false;
  pvpBtn.classList.add("active");
  aiBtn.classList.remove("active");
  document.getElementById("score-o").querySelector(".score-label").textContent = "PLAYER O";
  resetGame();
});

aiBtn.addEventListener("click", () => {
  aiMode = true;
  aiBtn.classList.add("active");
  pvpBtn.classList.remove("active");
  document.getElementById("score-o").querySelector(".score-label").textContent = "AI (O)";
  resetGame();
});

// ── Sound toggle ──────────────────────────
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundIcon.textContent = soundOn ? "🔊" : "🔇";
});

// ── Render turn indicator ─────────────────
function updateTurnUI() {
  const sym = turnX ? "X" : "O";
  currentTurn.textContent = sym;
  currentTurn.className = `turn-symbol ${turnX ? "x-color" : "o-color"}`;
  dotX.classList.toggle("active", turnX);
  dotO.classList.toggle("active", !turnX);
  scoreCardX.classList.toggle("active-player", turnX);
  scoreCardO.classList.toggle("active-player", !turnX);
}

// ── Handle a move ─────────────────────────
function makeMove(index, player) {
  if (board[index] !== "" || gameOver) return false;

  board[index] = player;
  const box = boxes[index];
  box.textContent = player;
  box.classList.add(player === "X" ? "played-x" : "played-o", "pop-in");
  box.disabled = true;

  // Remove pop-in class after animation
  box.addEventListener("animationend", () => box.classList.remove("pop-in"), { once: true });

  if (player === "X") sounds.clickX(); else sounds.clickO();
  return true;
}

// ── Box click handler ─────────────────────
boxes.forEach((box) => {
  box.addEventListener("click", () => {
    if (gameOver || isAiTurn()) return;

    const idx = Number(box.dataset.index);
    const player = getCurrentPlayer();
    if (!makeMove(idx, player)) return;

    if (checkWinner()) return;

    if (aiMode) {
      turnX = false;
      updateTurnUI();
      disableAllBoxes();
      setTimeout(aiMove, 450);
    } else {
      switchTurn();
    }
  });
});

// ── AI Move (Minimax) ─────────────────────
function aiMove() {
  const best = minimax(board, false);
  makeMove(best.index, "O");

  if (!checkWinner()) {
    turnX = true;
    updateTurnUI();
    enableEmptyBoxes();
  }
}

function minimax(b, isMaximising) {
  const win = getWinner(b);
  if (win === "X") return { score: -10 };
  if (win === "O") return { score:  10 };
  if (b.every(c => c !== "")) return { score: 0 };

  const moves = [];
  b.forEach((cell, i) => {
    if (cell !== "") return;
    const newBoard = [...b];
    newBoard[i] = isMaximising ? "O" : "X";
    const result = minimax(newBoard, !isMaximising);
    moves.push({ index: i, score: result.score });
  });

  return isMaximising
    ? moves.reduce((best, m) => m.score > best.score ? m : best, { score: -Infinity })
    : moves.reduce((best, m) => m.score < best.score ? m : best, { score:  Infinity });
}

function checkWinner() {
  const winner = getWinner(board);
  if (winner) {
    handleWin(winner, WIN_PATTERNS.find(([a, b, c]) => board[a] === winner && board[b] === winner && board[c] === winner));
    return true;
  }

  if (isBoardFull()) {
    handleDraw();
    return true;
  }

  return false;
}

function handleWin(winner, pattern) {
  gameOver = true;
  sounds.win();
  pattern.forEach(i => boxes[i].classList.add("winner-cell"));
  scores[winner]++;
  bumpScore(winner);

  resultIcon.textContent = winner === "X" ? "🏆" : aiMode ? "🤖" : "🏆";
  resultMsg.textContent = aiMode && winner === "O"
    ? "AI Wins! Better luck next time."
    : `Player ${winner} Wins!`;
  setTimeout(() => overlay.classList.remove("hide"), 900);
}

function handleDraw() {
  gameOver = true;
  sounds.draw();
  scores.D++;
  bumpScore("D");

  resultIcon.textContent = "🤝";
  resultMsg.textContent = "It's a Draw!";
  setTimeout(() => overlay.classList.remove("hide"), 500);
}

// ── Score bump animation ──────────────────
function bumpScore(player) {
  const el = player === "X" ? xScoreEl : player === "O" ? oScoreEl : drawScoreEl;
  el.textContent = scores[player];
  el.classList.remove("score-bump");
  void el.offsetWidth;   // reflow to restart animation
  el.classList.add("score-bump");
}

// ── Box helpers ───────────────────────────
function disableAllBoxes() {
  boxes.forEach(b => b.disabled = true);
}
function enableEmptyBoxes() {
  boxes.forEach((b, i) => {
    if (board[i] === "") b.disabled = false;
  });
}

// ── Reset (new round, keep scores) ───────
function resetGame() {
  board      = Array(9).fill("");
  turnX      = true;
  gameOver   = false;
  overlay.classList.add("hide");

  boxes.forEach(box => {
    box.textContent = "";
    box.disabled    = false;
    box.className   = "box";   // removes all state classes
  });

  updateTurnUI();
}

// ── Clear all scores ──────────────────────
function clearScores() {
  scores = { X: 0, O: 0, D: 0 };
  xScoreEl.textContent    = "0";
  oScoreEl.textContent    = "0";
  drawScoreEl.textContent = "0";
  resetGame();
}

// ── Event listeners ───────────────────────
newBtn.addEventListener("click",   resetGame);
resetBtn.addEventListener("click", resetGame);
clearBtn.addEventListener("click", clearScores);

// ── Init ──────────────────────────────────
updateTurnUI();


