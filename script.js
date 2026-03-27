const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const muteButton = document.getElementById("muteButton");
const restartButton = document.getElementById("restartButton");
const topbar = document.querySelector(".topbar");
const mobileControls = document.querySelector(".mobile-controls");

const upBtn = document.getElementById("upBtn");
const downBtn = document.getElementById("downBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

function getViewportHeight() {
  if (window.visualViewport) {
    return window.visualViewport.height;
  }
  return window.innerHeight;
}

function resizeCanvas() {
  const isMobile = window.innerWidth <= 900;
  const controlsHeight = isMobile ? mobileControls.offsetHeight : 0;
  const viewportHeight = getViewportHeight();

  canvas.width = window.innerWidth;
  canvas.height = Math.max(
    220,
    Math.floor(viewportHeight - topbar.offsetHeight - controlsHeight)
  );
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 180);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvas);
}

const snakeSize = 20;
const baseSpeed = 2;
const minSnakeLength = 3;
const hudHeight = 54;
const maxNormalEggs = 12;
const countdownFramesTotal = 180;
const maxWoods = 10;
const maxLevel = 50;
const maxSpeedLevel = 15;

let currentSpeed = baseSpeed;
let eggsCollected = 0;
let score = 0;
let gameOver = false;
let gameWon = false;
let isMuted = false;

let direction = { x: currentSpeed, y: 0 };
let nextDirection = { x: currentSpeed, y: 0 };

let eggs = [];
let magicEggs = [];
let pinkEggs = [];
let woods = [];

let snake = [];
let growSegments = 0;
let bestScore = loadBestScore();

let gameStarted = false;
let waitingToStart = true;
let countdownActive = false;
let countdownTimer = countdownFramesTotal;

let currentLevel = 1;
let levelMessage = "";
let levelMessageTimer = 0;
let normalEggSpawnTimer = 0;
let goldenBirdLevelShown = 0;
let pinkBirdLevelShown = 0;
let frameCount = 0;

let swipeStartX = 0;
let swipeStartY = 0;
let swipeTracking = false;

const titleSnakeImage = new Image();
let titleSnakeLoaded = false;
titleSnakeImage.src = "snake-title.png";
titleSnakeImage.onload = () => {
  titleSnakeLoaded = true;
};

const goldenBird = {
  active: false,
  x: -80,
  y: 150,
  width: 42,
  height: 24,
  speed: 3.5,
  baseY: 150,
  progress: 0,
  eggsToDrop: 0,
  eggsDropped: 0,
  dropTimer: 0,
  caught: false
};

const pinkBird = {
  active: false,
  x: canvas.width + 80,
  y: 180,
  width: 44,
  height: 24,
  speed: 3.2,
  baseY: 180,
  progress: 0,
  eggDropped: false,
  woodDropped: false,
  woodTarget: null
};

// ---------- AUDIO ----------
let audioUnlocked = false;
let bgMusicInterval = null;

function unlockAudio() {
  audioUnlocked = true;
}

function playTone(type, fromFreq, toFreq, duration = 0.18, volume = 0.08, delay = 0) {
  if (isMuted || !audioUnlocked) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audioCtx = new AudioContextClass();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromFreq, audioCtx.currentTime + delay);
  oscillator.frequency.exponentialRampToValueAtTime(
    toFreq,
    audioCtx.currentTime + delay + duration
  );

  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + delay + duration
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start(audioCtx.currentTime + delay);
  oscillator.stop(audioCtx.currentTime + delay + duration);
}

function startBackgroundMusic() {
  if (bgMusicInterval || isMuted || !audioUnlocked) return;

  const pattern = [220, 277, 330, 277];
  let index = 0;

  bgMusicInterval = setInterval(() => {
    if (isMuted || !audioUnlocked || gameOver || gameWon) {
      stopBackgroundMusic();
      return;
    }
    const note = pattern[index % pattern.length];
    playTone("triangle", note, note * 0.99, 0.2, 0.025);
    index++;
  }, 320);
}

function stopBackgroundMusic() {
  if (bgMusicInterval) {
    clearInterval(bgMusicInterval);
    bgMusicInterval = null;
  }
}

function playSwallowSound(isMagic = false) {
  playTone(isMagic ? "sine" : "square", isMagic ? 580 : 320, isMagic ? 260 : 180, 0.12, 0.08);
}

function playPinkEggSound() {
  playTone("triangle", 700, 980, 0.18, 0.08);
}

function playGameOverSound() {
  playTone("triangle", 260, 90, 0.35, 0.09);
}

function playLevelUpSound() {
  if (isMuted || !audioUnlocked) return;
  playTone("triangle", 440, 440, 0.10, 0.06, 0.00);
  playTone("triangle", 554, 554, 0.10, 0.06, 0.08);
  playTone("triangle", 659, 659, 0.14, 0.06, 0.16);
}

function playBirdCaughtSound() {
  playTone("square", 300, 120, 0.18, 0.08);
}

function playWinSound() {
  if (isMuted || !audioUnlocked) return;
  playTone("triangle", 523, 523, 0.12, 0.06, 0.00);
  playTone("triangle", 659, 659, 0.12, 0.06, 0.12);
  playTone("triangle", 784, 784, 0.18, 0.06, 0.24);
}

function updateMuteButton() {
  muteButton.textContent = isMuted ? "🔇 Unmute" : "🔊 Mute";

  if (isMuted) {
    stopBackgroundMusic();
  } else if (audioUnlocked && !gameOver && !gameWon) {
    startBackgroundMusic();
  }
}

muteButton.addEventListener("click", () => {
  isMuted = !isMuted;
  updateMuteButton();
});

restartButton.addEventListener("click", () => {
  resetGame();

  if (document.activeElement) {
    document.activeElement.blur();
  }

  canvas.focus();
});

// ---------- STORAGE ----------
function loadBestScore() {
  const saved = localStorage.getItem("kingOfSnakesBestScore");
  return saved ? Number(saved) : 0;
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("kingOfSnakesBestScore", String(bestScore));
  }
}

// ---------- HELPERS ----------
function vibrateLight() {
  if (navigator.vibrate) {
    navigator.vibrate(20);
  }
}

function randomPosition() {
  return {
    x: Math.random() * (canvas.width - 180) + 90,
    y: Math.random() * (canvas.height - hudHeight - 180) + hudHeight + 90
  };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function spawnEggAt(pos) {
  eggs.push({ x: pos.x, y: pos.y });
}

function spawnRandomEgg() {
  if (eggs.length < maxNormalEggs) {
    spawnEggAt(randomPosition());
  }
}

function spawnMagicEggAt(pos) {
  magicEggs.push({
    x: pos.x,
    y: pos.y,
    glowSeed: Math.random() * Math.PI * 2
  });
}

function spawnPinkEggAt(pos) {
  pinkEggs = [{
    x: pos.x,
    y: pos.y,
    glowSeed: Math.random() * Math.PI * 2
  }];
}

function createWoodAt(pos) {
  if (woods.length >= maxWoods) return;
  woods.push({
    x: pos.x,
    y: pos.y,
    width: 18,
    height: 60
  });
}

function randomWoodPosition() {
  return {
    x: Math.random() * (canvas.width - 220) + 110,
    y: Math.random() * (canvas.height - hudHeight - 220) + hudHeight + 110
  };
}

function createInitialSnake() {
  const startX = canvas.width / 2;
  const startY = canvas.height / 2 + 80;
  const arr = [];

  for (let i = 0; i < 6; i++) {
    arr.push({ x: startX - i * snakeSize, y: startY });
  }
  return arr;
}

function createInitialEggs() {
  eggs = [];
  for (let i = 0; i < 8; i++) {
    spawnEggAt(randomPosition());
  }
}

function recalcLevelAndSpeed() {
  currentLevel = Math.min(maxLevel, Math.floor(eggsCollected / 10) + 1);
  const speedLevel = Math.min(currentLevel, maxSpeedLevel);
  currentSpeed = baseSpeed + (speedLevel - 1);

  if (direction.x > 0) direction = { x: currentSpeed, y: 0 };
  if (direction.x < 0) direction = { x: -currentSpeed, y: 0 };
  if (direction.y > 0) direction = { x: 0, y: currentSpeed };
  if (direction.y < 0) direction = { x: 0, y: -currentSpeed };

  if (nextDirection.x > 0) nextDirection = { x: currentSpeed, y: 0 };
  if (nextDirection.x < 0) nextDirection = { x: -currentSpeed, y: 0 };
  if (nextDirection.y > 0) nextDirection = { x: 0, y: currentSpeed };
  if (nextDirection.y < 0) nextDirection = { x: 0, y: -currentSpeed };
}

function shrinkSnakeByOne() {
  if (snake.length > minSnakeLength) {
    snake.pop();
  }
}

function hitSelf(head) {
  const safeSegmentsToSkip = Math.max(4, Math.ceil(snakeSize / Math.max(currentSpeed, 1)));

  for (let i = safeSegmentsToSkip; i < snake.length; i++) {
    if (distance(head, snake[i]) < snakeSize * 0.45) {
      return true;
    }
  }
  return false;
}

function hitsBird(head, bird) {
  if (!bird.active) return false;
  return distance(head, { x: bird.x, y: bird.y }) < 22;
}

function snakeHitsWood(head) {
  for (const wood of woods) {
    const dx = Math.abs(head.x - wood.x);
    const dy = Math.abs(head.y - wood.y);
    if (dx < 18 && dy < 34) {
      return true;
    }
  }
  return false;
}

function showLevelMessage(text) {
  levelMessage = text;
  levelMessageTimer = 140;
}

function checkLevelProgression() {
  const previousLevel = currentLevel;
  recalcLevelAndSpeed();

  if (currentLevel > previousLevel) {
    showLevelMessage(`Level ${currentLevel}`);
    playLevelUpSound();
  }

  if (currentLevel >= maxLevel) {
    gameWon = true;
    gameStarted = false;
    saveBestScore();
    stopBackgroundMusic();
    playWinSound();
  }
}

// ---------- RESET ----------
function resetGame() {
  resizeCanvas();

  currentSpeed = baseSpeed;
  eggsCollected = 0;
  score = 0;
  gameOver = false;
  gameWon = false;
  direction = { x: currentSpeed, y: 0 };
  nextDirection = { x: currentSpeed, y: 0 };

  eggs = [];
  magicEggs = [];
  pinkEggs = [];
  woods = [];

  snake = [];
  growSegments = 0;
  currentLevel = 1;
  levelMessage = "";
  levelMessageTimer = 0;
  normalEggSpawnTimer = 0;
  goldenBirdLevelShown = 0;
  pinkBirdLevelShown = 0;
  frameCount = 0;

  waitingToStart = true;
  countdownActive = false;
  countdownTimer = countdownFramesTotal;
  gameStarted = false;

  goldenBird.active = false;
  goldenBird.x = -80;
  goldenBird.y = 150;
  goldenBird.baseY = 150;
  goldenBird.progress = 0;
  goldenBird.eggsToDrop = 0;
  goldenBird.eggsDropped = 0;
  goldenBird.dropTimer = 0;
  goldenBird.caught = false;

  pinkBird.active = false;
  pinkBird.x = canvas.width + 80;
  pinkBird.y = 180;
  pinkBird.baseY = 180;
  pinkBird.progress = 0;
  pinkBird.eggDropped = false;
  pinkBird.woodDropped = false;
  pinkBird.woodTarget = null;

  stopBackgroundMusic();
  createInitialEggs();
}

function beginCountdown() {
  if (!waitingToStart || countdownActive || gameStarted) return;

  unlockAudio();
  waitingToStart = false;
  countdownActive = true;
  countdownTimer = countdownFramesTotal;

  if (!isMuted) {
    startBackgroundMusic();
  }

  canvas.focus();
}

function startActualGame() {
  countdownActive = false;
  snake = createInitialSnake();
  gameStarted = true;
  direction = { x: currentSpeed, y: 0 };
  nextDirection = { x: currentSpeed, y: 0 };
  canvas.focus();
}

// ---------- INPUT ----------
function setTouchDirection(dir) {
  if (!gameStarted || gameOver || gameWon) return;

  if (dir === "up" && direction.y === 0) {
    nextDirection = { x: 0, y: -currentSpeed };
  } else if (dir === "down" && direction.y === 0) {
    nextDirection = { x: 0, y: currentSpeed };
  } else if (dir === "left" && direction.x === 0) {
    nextDirection = { x: -currentSpeed, y: 0 };
  } else if (dir === "right" && direction.x === 0) {
    nextDirection = { x: currentSpeed, y: 0 };
  } else {
    return;
  }

  vibrateLight();
}

function bindTouch(btn, dir) {
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    setTouchDirection(dir);
    canvas.focus();
  }, { passive: false });

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    setTouchDirection(dir);
    canvas.focus();
  });
}

bindTouch(upBtn, "up");
bindTouch(downBtn, "down");
bindTouch(leftBtn, "left");
bindTouch(rightBtn, "right");

document.addEventListener("keydown", (e) => {
  if (waitingToStart && e.key === "Enter") {
    beginCountdown();
    return;
  }

  if (!gameStarted || gameOver || gameWon) {
    if ((gameOver || gameWon) && e.key.toLowerCase() === "r") {
      resetGame();
      canvas.focus();
    }
    return;
  }

  if (e.key === "ArrowUp" && direction.y === 0) {
    nextDirection = { x: 0, y: -currentSpeed };
  } else if (e.key === "ArrowDown" && direction.y === 0) {
    nextDirection = { x: 0, y: currentSpeed };
  } else if (e.key === "ArrowLeft" && direction.x === 0) {
    nextDirection = { x: -currentSpeed, y: 0 };
  } else if (e.key === "ArrowRight" && direction.x === 0) {
    nextDirection = { x: currentSpeed, y: 0 };
  }
});

function tryStartFromTap(e) {
  if (waitingToStart) {
    e.preventDefault();
    beginCountdown();
  }
}

canvas.addEventListener("touchstart", (e) => {
  const touch = e.touches[0];
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
  swipeTracking = true;

  if (waitingToStart) {
    e.preventDefault();
    beginCountdown();
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  if (!swipeTracking) return;
  swipeTracking = false;

  if (!gameStarted || gameOver || gameWon) return;

  const touch = e.changedTouches[0];
  const dx = touch.clientX - swipeStartX;
  const dy = touch.clientY - swipeStartY;

  const minSwipeDistance = 24;
  if (Math.abs(dx) < minSwipeDistance && Math.abs(dy) < minSwipeDistance) {
    return;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && direction.x === 0) {
      nextDirection = { x: currentSpeed, y: 0 };
      vibrateLight();
    } else if (dx < 0 && direction.x === 0) {
      nextDirection = { x: -currentSpeed, y: 0 };
      vibrateLight();
    }
  } else {
    if (dy > 0 && direction.y === 0) {
      nextDirection = { x: 0, y: currentSpeed };
      vibrateLight();
    } else if (dy < 0 && direction.y === 0) {
      nextDirection = { x: 0, y: -currentSpeed };
      vibrateLight();
    }
  }
}, { passive: true });

canvas.addEventListener("mousedown", tryStartFromTap);

document.addEventListener("touchstart", (e) => {
  if (waitingToStart) {
    e.preventDefault();
    beginCountdown();
  }
}, { passive: false });

// ---------- UPDATE ----------
function updateCountdown() {
  if (!countdownActive) return;
  countdownTimer--;
  if (countdownTimer <= 0) {
    startActualGame();
  }
}

function maybeSpawnNormalEggsDuringGame() {
  if (!gameStarted || gameOver || gameWon) return;

  normalEggSpawnTimer++;
  if (normalEggSpawnTimer >= 140) {
    normalEggSpawnTimer = 0;
    spawnRandomEgg();
  }
}

function maybeStartGoldenBird() {
  if (currentLevel > maxLevel) return;

  if (
    gameStarted &&
    !gameOver &&
    !gameWon &&
    currentLevel > 1 &&
    goldenBirdLevelShown !== currentLevel &&
    !goldenBird.active
  ) {
    goldenBird.active = true;
    goldenBirdLevelShown = currentLevel;
    goldenBird.x = -80;
    goldenBird.baseY = 130 + Math.random() * Math.max(60, canvas.height - 260);
    goldenBird.y = goldenBird.baseY;
    goldenBird.progress = 0;
    goldenBird.eggsToDrop = Math.floor(Math.random() * 4) + 2;
    goldenBird.eggsDropped = 0;
    goldenBird.dropTimer = 0;
    goldenBird.caught = false;
  }
}

function maybeStartPinkBird() {
  if (
    gameStarted &&
    !gameOver &&
    !gameWon &&
    currentLevel >= 2 &&
    currentLevel % 2 === 0 &&
    pinkBirdLevelShown !== currentLevel &&
    !pinkBird.active
  ) {
    pinkBird.active = true;
    pinkBirdLevelShown = currentLevel;
    pinkBird.x = canvas.width + 80;
    pinkBird.baseY = 150 + Math.random() * Math.max(50, canvas.height - 280);
    pinkBird.y = pinkBird.baseY;
    pinkBird.progress = 0;
    pinkBird.eggDropped = false;
    pinkBird.woodDropped = false;
    pinkBird.woodTarget = woods.length < maxWoods ? randomWoodPosition() : null;
  }
}

function updateGoldenBird() {
  if (!goldenBird.active) return;

  goldenBird.x += goldenBird.speed;
  goldenBird.progress += 0.05;
  goldenBird.y = goldenBird.baseY + Math.sin(goldenBird.progress) * 40;

  goldenBird.dropTimer++;

  if (
    !goldenBird.caught &&
    goldenBird.eggsDropped < goldenBird.eggsToDrop &&
    goldenBird.dropTimer >= 35 &&
    goldenBird.x > 40 &&
    goldenBird.x < canvas.width - 40
  ) {
    spawnMagicEggAt(randomPosition());
    goldenBird.eggsDropped++;
    goldenBird.dropTimer = 0;
  }

  if (goldenBird.x > canvas.width + 80) {
    goldenBird.active = false;
  }
}

function updatePinkBird() {
  if (!pinkBird.active) return;

  pinkBird.x -= pinkBird.speed;
  pinkBird.progress += 0.05;
  pinkBird.y = pinkBird.baseY + Math.sin(pinkBird.progress) * 35;

  if (!pinkBird.eggDropped && pinkBird.x < canvas.width * 0.65) {
    spawnPinkEggAt(randomPosition());
    pinkBird.eggDropped = true;
  }

  if (!pinkBird.woodDropped && pinkBird.x < canvas.width * 0.45) {
    if (pinkBird.woodTarget && woods.length < maxWoods) {
      createWoodAt(pinkBird.woodTarget);
    }
    pinkBird.woodDropped = true;
  }

  if (pinkBird.x < -80) {
    pinkBird.active = false;
  }
}

function endGame() {
  gameOver = true;
  saveBestScore();
  playGameOverSound();
  stopBackgroundMusic();
}

function updateGame() {
  if (gameOver || !gameStarted || gameWon) return;

  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  if (
    head.x < 0 ||
    head.y < hudHeight ||
    head.x > canvas.width - snakeSize ||
    head.y > canvas.height - snakeSize
  ) {
    endGame();
    return;
  }

  if (hitSelf(head)) {
    endGame();
    return;
  }

  if (snakeHitsWood(head)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (hitsBird(head, goldenBird) && !goldenBird.caught) {
    goldenBird.caught = true;
    goldenBird.active = false;
    playBirdCaughtSound();
  }

  if (hitsBird(head, pinkBird)) {
    pinkBird.active = false;
    playBirdCaughtSound();
  }

  let ateNormalEgg = false;

  for (let i = 0; i < eggs.length; i++) {
    if (distance(head, eggs[i]) < snakeSize) {
      eggs.splice(i, 1);
      score += 10;
      eggsCollected += 1;
      growSegments += 2;
      ateNormalEgg = true;
      checkLevelProgression();
      if (gameWon) return;
      playSwallowSound(false);
      break;
    }
  }

  for (let i = 0; i < magicEggs.length; i++) {
    if (distance(head, magicEggs[i]) < snakeSize) {
      magicEggs.splice(i, 1);

      const previousLevel = currentLevel;

      eggsCollected += 1;
      shrinkSnakeByOne();

      currentSpeed = Math.max(baseSpeed, currentSpeed - 1);

      if (direction.x > 0) direction = { x: currentSpeed, y: 0 };
      if (direction.x < 0) direction = { x: -currentSpeed, y: 0 };
      if (direction.y > 0) direction = { x: 0, y: currentSpeed };
      if (direction.y < 0) direction = { x: 0, y: -currentSpeed };

      if (nextDirection.x > 0) nextDirection = { x: currentSpeed, y: 0 };
      if (nextDirection.x < 0) nextDirection = { x: -currentSpeed, y: 0 };
      if (nextDirection.y > 0) nextDirection = { x: 0, y: currentSpeed };
      if (nextDirection.y < 0) nextDirection = { x: 0, y: -currentSpeed };

      currentLevel = Math.min(maxLevel, Math.floor(eggsCollected / 10) + 1);

      if (currentLevel > previousLevel) {
        showLevelMessage(`Level ${currentLevel}`);
        playLevelUpSound();
      }

      if (currentLevel >= maxLevel) {
        gameWon = true;
        gameStarted = false;
        saveBestScore();
        stopBackgroundMusic();
        playWinSound();
        return;
      }

      playSwallowSound(true);
      break;
    }
  }

  for (let i = 0; i < pinkEggs.length; i++) {
    if (distance(head, pinkEggs[i]) < snakeSize) {
      pinkEggs.splice(i, 1);

      eggsCollected += 20;
      score += 200;
      growSegments += 4;

      checkLevelProgression();
      if (gameWon) return;

      showLevelMessage(`Level ${currentLevel}`);
      playPinkEggSound();
      break;
    }
  }

  if (!ateNormalEgg) {
    if (growSegments > 0) {
      growSegments -= 1;
    } else {
      snake.pop();
    }
  }
}

function updateLevelMessage() {
  if (levelMessageTimer > 0) {
    levelMessageTimer--;
  } else {
    levelMessage = "";
  }
}

function update() {
  frameCount++;

  if (countdownActive) {
    updateCountdown();
  } else if (gameStarted && !gameWon) {
    maybeSpawnNormalEggsDuringGame();
    maybeStartGoldenBird();
    maybeStartPinkBird();
    updateGoldenBird();
    updatePinkBird();
    updateGame();
  }

  updateLevelMessage();
}

// ---------- DRAW ----------
function drawJungleBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0b2416");
  gradient.addColorStop(0.5, "#0a1e14");
  gradient.addColorStop(1, "#06140d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 120; i++) {
    const x = (i * 137) % canvas.width;
    const y = (i * 89) % canvas.height;
    const r = 18 + (i % 4) * 8;

    ctx.fillStyle =
      i % 2 === 0
        ? "rgba(20, 70, 40, 0.20)"
        : "rgba(10, 40, 20, 0.18)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCenterTitle() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 - 40;

  if (titleSnakeLoaded) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(titleSnakeImage, cx - 170, cy - 100, 340, 200);
    ctx.restore();
  } else {
    ctx.strokeStyle = "rgba(90, 180, 80, 0.35)";
    ctx.lineWidth = 24;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 130, cy + 30);
    ctx.bezierCurveTo(cx - 40, cy - 40, cx + 10, cy + 80, cx + 115, cy + 10);
    ctx.stroke();

    ctx.fillStyle = "rgba(130, 255, 110, 0.40)";
    ctx.beginPath();
    ctx.ellipse(cx + 130, cy + 5, 30, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = "54px Arial";
  ctx.textAlign = "center";
  ctx.fillText("King of Snakes", cx, cy + 115);
  ctx.textAlign = "left";
}

function drawTopHudBar() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(0, 0, canvas.width, hudHeight);

  ctx.strokeStyle = "rgba(100, 180, 120, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, hudHeight);
  ctx.lineTo(canvas.width, hudHeight);
  ctx.stroke();

  const isMobile = window.innerWidth <= 900;
  ctx.fillStyle = "white";
  ctx.font = isMobile ? "15px Arial" : "22px Arial";

  if (isMobile) {
    ctx.fillText(`S:${score}`, 12, 34);
    ctx.fillText(`B:${bestScore}`, 100, 34);
    ctx.fillText(`L:${snake.length || 0}`, 205, 34);
    ctx.fillText(`E:${eggsCollected}`, 290, 34);
    ctx.fillText(`V:${currentLevel}`, 390, 34);
  } else {
    ctx.fillText(`Score: ${score}`, 20, 35);
    ctx.fillText(`Best: ${bestScore}`, 180, 35);
    ctx.fillText(`Length: ${snake.length || 0}`, 350, 35);
    ctx.fillText(`Eggs: ${eggsCollected}`, 540, 35);
    ctx.fillText(`Speed: ${currentSpeed.toFixed(1)}`, 710, 35);
    ctx.fillText(`Level: ${currentLevel}`, 900, 35);
  }
}

function drawNormalEggs() {
  eggs.forEach((egg) => {
    ctx.fillStyle = "#f7f7f7";
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(egg.x - 2, egg.y - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(180,180,180,0.55)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
  });
}

function drawMagicEggs() {
  magicEggs.forEach((egg) => {
    const glow = 0.5 + 0.5 * Math.sin(frameCount * 0.08 + egg.glowSeed);

    ctx.save();
    ctx.shadowBlur = 18 + glow * 12;
    ctx.shadowColor = "rgba(255, 215, 0, 0.95)";

    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 14, 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.arc(egg.x - 2, egg.y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function drawPinkEggs() {
  pinkEggs.forEach((egg) => {
    const glow = 0.5 + 0.5 * Math.sin(frameCount * 0.1 + egg.glowSeed);

    ctx.save();
    ctx.shadowBlur = 18 + glow * 10;
    ctx.shadowColor = "rgba(255, 105, 180, 0.95)";

    ctx.fillStyle = "#ff69b4";
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffd1e8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 14, 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#fff0f7";
    ctx.beginPath();
    ctx.arc(egg.x - 2, egg.y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function drawWoods() {
  woods.forEach((wood) => {
    ctx.save();
    ctx.translate(wood.x, wood.y);

    ctx.fillStyle = "#7a7a7a";
    ctx.beginPath();
    ctx.roundRect(-wood.width / 2, -wood.height / 2, wood.width, wood.height, 8);
    ctx.fill();

    ctx.strokeStyle = "#5d5d5d";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#909090";
    ctx.fillRect(-3, -18, 6, 36);

    ctx.restore();
  });
}

function drawBird(bird, type = "gold") {
  let bodyColor = "#d4af37";
  let wingColor = "#f7d774";

  if (type === "pink") {
    bodyColor = "#ff69b4";
    wingColor = "#ffc0da";
  }

  const beakColor = "#f7c948";

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(bird.x, bird.y, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wingColor;
  ctx.beginPath();
  ctx.moveTo(bird.x - 4, bird.y);
  ctx.lineTo(bird.x - 24, bird.y - 10);
  ctx.lineTo(bird.x - 12, bird.y + 5);
  ctx.fill();

  ctx.fillStyle = beakColor;
  ctx.beginPath();
  ctx.moveTo(bird.x + 14, bird.y);
  ctx.lineTo(bird.x + 24, bird.y - 3);
  ctx.lineTo(bird.x + 24, bird.y + 3);
  ctx.fill();

  if (type === "pink" && !pinkBird.woodDropped && pinkBird.woodTarget) {
    ctx.fillStyle = "#8d8d8d";
    ctx.fillRect(bird.x + 24, bird.y - 12, 6, 24);
  }

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(bird.x + 8, bird.y - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake() {
  for (let i = snake.length - 1; i >= 0; i--) {
    const segment = snake[i];
    const cx = segment.x + snakeSize / 2;
    const cy = segment.y + snakeSize / 2;

    if (i === 0) {
      const headGradient = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 14);
      headGradient.addColorStop(0, "#a8ff60");
      headGradient.addColorStop(1, "#4a9d1a");

      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#173a12";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ff5a7a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx + 10, cy + 7);
      ctx.stroke();
    } else {
      const bodyGradient = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, 11);
      bodyGradient.addColorStop(0, "#66cc44");
      bodyGradient.addColorStop(1, "#2f7c22");

      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 11, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawStartOverlay() {
  if (!waitingToStart) return;

  drawCenterTitle();

  const startText = window.innerWidth <= 900 ? "Tap or Swipe to Start" : "Press Enter or Tap to Start";

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "42px Arial";
  ctx.textAlign = "center";
  ctx.fillText(startText, canvas.width / 2, canvas.height / 2 + 200);
  ctx.textAlign = "left";
}

function drawCountdown() {
  if (!countdownActive) return;

  const count = Math.max(1, Math.ceil(countdownTimer / 60));

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "84px Arial";
  ctx.textAlign = "center";
  ctx.fillText(String(count), canvas.width / 2, canvas.height / 2);

  ctx.font = "28px Arial";
  ctx.fillText("Get ready", canvas.width / 2, canvas.height / 2 + 55);
  ctx.textAlign = "left";
}

function drawLevelMessage() {
  if (!levelMessage) return;

  ctx.fillStyle = "rgba(255, 215, 0, 0.95)";
  ctx.font = "42px Arial";
  ctx.textAlign = "center";
  ctx.fillText(levelMessage, canvas.width / 2, 115);
  ctx.textAlign = "left";
}

function drawGameOver() {
  if (!gameOver) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 15);

  ctx.font = "28px Arial";
  ctx.fillText("Final Score: " + score, canvas.width / 2, canvas.height / 2 + 30);
  ctx.fillText("Press R or Restart", canvas.width / 2, canvas.height / 2 + 72);
  ctx.textAlign = "left";
}

function drawWinScreen() {
  if (!gameWon) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffe27a";
  ctx.font = "52px Arial";
  ctx.textAlign = "center";
  ctx.fillText("You Win!", canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.fillText(`Reached Level ${maxLevel}`, canvas.width / 2, canvas.height / 2 + 24);
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 64);
  ctx.fillText("Press R or Restart", canvas.width / 2, canvas.height / 2 + 104);
  ctx.textAlign = "left";
}

function draw() {
  drawJungleBackground();
  drawTopHudBar();
  drawNormalEggs();
  drawMagicEggs();
  drawPinkEggs();
  drawWoods();

  if (goldenBird.active && gameStarted) {
    drawBird(goldenBird, "gold");
  }

  if (pinkBird.active && gameStarted) {
    drawBird(pinkBird, "pink");
  }

  if (gameStarted) {
    drawSnake();
  }

  drawStartOverlay();
  drawCountdown();
  drawLevelMessage();
  drawGameOver();
  drawWinScreen();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

updateMuteButton();
resetGame();
gameLoop();
