"use strict";

const image = document.getElementById("preview");
const board = document.getElementById("board");
const guides = document.getElementById("guides");
const tray = document.getElementById("tray");
const difficulty = document.getElementById("difficulty");
const restartButton = document.getElementById("restart");
const statusText = document.getElementById("status");
const progressText = document.getElementById("progress");
const timerText = document.getElementById("timer");
const trayCountText = document.getElementById("tray-count");
const musicSettings = document.querySelector(".music-settings");
const musicTrackSelect = document.getElementById("music-track");
const shuffleMusicButton = document.getElementById("shuffle-music");
const toggleMusicButton = document.getElementById("toggle-music");
const musicVolume = document.getElementById("music-volume");
const musicVolumeValue = document.getElementById("music-volume-value");
const effectVolume = document.getElementById("effect-volume");
const effectVolumeValue = document.getElementById("effect-volume-value");
const musicStatus = document.getElementById("music-status");
const openYoutubeLink = document.getElementById("open-youtube");
const youtubePlayerContainer = document.getElementById("youtube-player");

const levels = {
  easy: { columns: 4, rows: 3, total: 12 },
  normal: { columns: 5, rows: 4, total: 20 },
  hard: { columns: 6, rows: 6, total: 36 },
};

const musicTracks = [
  { id: "8hU-ZOgsbCM", name: "canfull / 平葵" },
  { id: "bIiIrXM7BUA", name: "BANG BANG BANG - Chainsaw Man Song" },
  { id: "r1Eb1qnqLzA", name: "ขึ้นใจ (3am call)" },
];

let pieces = [];
let placedCount = 0;
let elapsedSeconds = 0;
let timerInterval = null;
let activeDrag = null;
let gameReady = false;
let gameBoardWidth = 0;
let gameBoardHeight = 0;
let resizeFrame = null;
let youtubeApiPromise = null;
let youtubePlayerPromise = null;
let youtubePlayer = null;
let placementAudioContext = null;
let selectedTrackId = "";

const mobileLayoutQuery = window.matchMedia("(max-width: 860px)");
musicSettings.open = !mobileLayoutQuery.matches;
mobileLayoutQuery.addEventListener("change", (event) => {
  musicSettings.open = !event.matches;
});

function setStatus(message, state = "") {
  statusText.textContent = message;
  statusText.classList.toggle("is-won", state === "won");
  statusText.classList.toggle("is-error", state === "error");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateTimer() {
  timerText.textContent = formatTime(elapsedSeconds);
}

function updateMusicVolume() {
  const volume = Number(musicVolume.value);
  musicVolumeValue.value = `${volume}%`;
  musicVolumeValue.textContent = `${volume}%`;
  if (youtubePlayer) {
    youtubePlayer.setVolume(volume);
  }
}

function updateEffectVolume() {
  const volume = Number(effectVolume.value);
  effectVolumeValue.value = `${volume}%`;
  effectVolumeValue.textContent = `${volume}%`;
}

function setMusicStatus(message, state = "") {
  musicStatus.textContent = message;
  musicStatus.classList.toggle("is-error", state === "error");
}

function getTrackName(videoId) {
  return musicTracks.find((track) => track.id === videoId)?.name ?? "เพลง";
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error("โหลด YouTube Player API ไม่สำเร็จ"));
    };
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.append(script);
  });
  return youtubeApiPromise;
}

function createYouTubePlayer() {
  if (youtubePlayer) {
    return Promise.resolve(youtubePlayer);
  }
  if (youtubePlayerPromise) {
    return youtubePlayerPromise;
  }

  youtubePlayerPromise = new Promise((resolve, reject) => {
    const playerVars = { autoplay: 0, controls: 1, playsinline: 1, rel: 0 };
    if (window.location.origin.startsWith("http")) {
      playerVars.origin = window.location.origin;
    }

    let readyTimeout;
    const clearReadyTimeout = () => window.clearTimeout(readyTimeout);
    readyTimeout = window.setTimeout(() => {
      youtubePlayerPromise = null;
      reject(new Error("YouTube player ใช้เวลาตอบสนองนานเกินไป"));
    }, 15000);

    const player = new window.YT.Player("youtube-player", {
      width: "100%",
      height: "200",
      playerVars,
      events: {
        onReady(event) {
          clearReadyTimeout();
          youtubePlayer = event.target;
          toggleMusicButton.disabled = false;
          updateMusicVolume();
          if (selectedTrackId) {
            event.target.cueVideoById(selectedTrackId);
            toggleMusicButton.textContent = "เล่นเพลง";
            setMusicStatus(`พร้อมเล่น${getTrackName(selectedTrackId)} กดปุ่มเล่นเพลง`);
          }
          resolve(youtubePlayer);
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.BUFFERING) {
            toggleMusicButton.textContent = "กำลังโหลด...";
            setMusicStatus(`กำลังโหลด${getTrackName(selectedTrackId)}`);
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            toggleMusicButton.textContent = "หยุดเพลง";
            setMusicStatus(`กำลังเล่น${getTrackName(selectedTrackId)}`);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            toggleMusicButton.textContent = "เล่นเพลงต่อ";
            setMusicStatus("หยุดเพลงชั่วคราว");
          } else if (event.data === window.YT.PlayerState.ENDED) {
            toggleMusicButton.textContent = "เล่นอีกครั้ง";
            setMusicStatus("เพลงจบแล้ว");
          } else if (event.data === window.YT.PlayerState.CUED) {
            toggleMusicButton.textContent = "เล่นเพลง";
            setMusicStatus(`พร้อมเล่น${getTrackName(selectedTrackId)} กดปุ่มเล่นเพลง`);
          }
        },
        onError(event) {
          clearReadyTimeout();
          youtubePlayerPromise = null;
          toggleMusicButton.disabled = false;
          toggleMusicButton.textContent = "ลองเล่นอีกครั้ง";
          const message = event.data === 101 || event.data === 150
            ? "วิดีโอนี้ไม่อนุญาตให้เล่นบนเว็บไซต์"
            : event.data === 153
              ? "YouTube ต้องการข้อมูลอ้างอิงเว็บไซต์ ลองเปิดเกมผ่านเว็บเซิร์ฟเวอร์"
              : event.data === 5
                ? "เบราว์เซอร์เล่นวิดีโอนี้ไม่ได้ ลองเปิดใน YouTube แทน"
              : `เล่นเพลงนี้ไม่ได้ (รหัส ${event.data})`;
          setMusicStatus(message, "error");
          openYoutubeLink.hidden = false;
          reject(new Error(message));
        },
      },
    });
    void player;
  });
  return youtubePlayerPromise;
}

function playTrack(videoId) {
  selectedTrackId = videoId;
  musicTrackSelect.value = videoId;
  youtubePlayerContainer.hidden = false;
  openYoutubeLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  openYoutubeLink.hidden = false;
  if (youtubePlayer) {
    youtubePlayer.setVolume(Number(musicVolume.value));
    toggleMusicButton.textContent = "กำลังโหลด...";
    setMusicStatus(`กำลังเปิด${getTrackName(videoId)}`);
    youtubePlayer.loadVideoById(videoId);
    return;
  }

  toggleMusicButton.disabled = true;
  setMusicStatus("กำลังเตรียมเครื่องเล่น เมื่อพร้อมแล้วกดปุ่มเล่นเพลง");
  void initializeYouTubePlayer(videoId);
}

async function initializeYouTubePlayer(videoId) {
  try {
    await loadYouTubeApi();
    if (selectedTrackId !== videoId) {
      return;
    }
    await createYouTubePlayer();
  } catch (error) {
    console.error("Unable to play the selected YouTube track.", error);
    if (selectedTrackId === videoId) {
      setMusicStatus(`${error.message} ตรวจสอบอินเทอร์เน็ต หรือเปิดเพลงจาก YouTube`, "error");
    }
  }
}

function shuffleTrack() {
  const otherTracks = musicTracks.filter((track) => track.id !== selectedTrackId);
  const choices = otherTracks.length > 0 ? otherTracks : musicTracks;
  const track = choices[Math.floor(Math.random() * choices.length)];
  playTrack(track.id);
}

function toggleMusicPlayback() {
  if (!youtubePlayer) {
    if (selectedTrackId) {
      setMusicStatus("กำลังเตรียมเครื่องเล่นเพลง...");
      void initializeYouTubePlayer(selectedTrackId);
    } else {
      setMusicStatus("เลือกเพลงหรือกดสุ่มเพลงก่อน");
    }
    return;
  }

  if (youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) {
    youtubePlayer.pauseVideo();
  } else {
    youtubePlayer.playVideo();
  }
}

function playPlacementSound() {
  const volume = Number(effectVolume.value) / 100;
  if (volume === 0) {
    return;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }
  if (!placementAudioContext) {
    placementAudioContext = new AudioContextConstructor();
  }

  void placementAudioContext.resume().then(() => {
    const oscillator = placementAudioContext.createOscillator();
    const gain = placementAudioContext.createGain();
    const startTime = placementAudioContext.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, startTime);
    oscillator.frequency.setValueAtTime(880, startTime + 0.07);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume * 0.18, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
    oscillator.connect(gain);
    gain.connect(placementAudioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.21);
  }).catch((error) => {
    console.error("Unable to play the puzzle placement sound.", error);
  });
}

function edgeDirection(row, column, salt) {
  const value = Math.sin((row + 1) * 127.1 + (column + 1) * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value) < 0.5;
}

function traceEdge(context, x, y, endX, endY, normalX, normalY, direction, tabSize) {
  const dx = endX - x;
  const dy = endY - y;
  const bump = tabSize * direction * 0.78;
  const point = (fraction, outward = 0) => [
    x + dx * fraction + normalX * bump * outward,
    y + dy * fraction + normalY * bump * outward,
  ];
  const [startX, startY] = point(0.3);
  context.lineTo(startX, startY);

  const [p1x, p1y] = point(0.38, 0.2);
  const [c1x, c1y] = point(0.32);
  context.quadraticCurveTo(c1x, c1y, p1x, p1y);

  const [p2x, p2y] = point(0.46, 1);
  const [c2x, c2y] = point(0.39, 1);
  context.quadraticCurveTo(c2x, c2y, p2x, p2y);

  const [p3x, p3y] = point(0.54, 1);
  const [c3x, c3y] = point(0.5, 1);
  context.quadraticCurveTo(c3x, c3y, p3x, p3y);

  const [p4x, p4y] = point(0.62, 0.2);
  const [c4x, c4y] = point(0.61, 1);
  context.quadraticCurveTo(c4x, c4y, p4x, p4y);

  const [p5x, p5y] = point(0.7);
  const [c5x, c5y] = point(0.68);
  context.quadraticCurveTo(c5x, c5y, p5x, p5y);
  context.lineTo(endX, endY);
}

function makePiecePath(context, piece, tabSize) {
  const x = tabSize;
  const y = tabSize;
  const right = x + piece.width;
  const bottom = y + piece.height;
  const { row, column } = piece;

  context.beginPath();
  context.moveTo(x, y);
  const topDirection = row === 0 ? 0 : (edgeDirection(row - 1, column, 1) ? -1 : 1);
  const rightDirection = column === piece.columns - 1 ? 0 : (edgeDirection(row, column, 2) ? 1 : -1);
  const bottomDirection = row === piece.rows - 1 ? 0 : (edgeDirection(row, column, 1) ? 1 : -1);
  const leftDirection = column === 0 ? 0 : (edgeDirection(row, column - 1, 2) ? -1 : 1);
  traceEdge(context, x, y, right, y, 0, -1, topDirection, tabSize);
  traceEdge(context, right, y, right, bottom, 1, 0, rightDirection, tabSize);
  traceEdge(context, right, bottom, x, bottom, 0, 1, bottomDirection, tabSize);
  traceEdge(context, x, bottom, x, y, -1, 0, leftDirection, tabSize);
  context.closePath();
}

function makePieceCanvas(piece, boardWidth, boardHeight, tileWidth, tileHeight, tabSize) {
  const canvas = document.createElement("canvas");
  const canvasWidth = Math.ceil(tileWidth + tabSize * 2);
  const canvasHeight = Math.ceil(tileHeight + tabSize * 2);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.className = "piece";
  canvas.setAttribute("role", "button");
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute("aria-label", `ชิ้นส่วนแถวที่ ${piece.row + 1} คอลัมน์ที่ ${piece.column + 1}`);
  canvas.dataset.pieceId = String(piece.id);

  const context = canvas.getContext("2d");
  makePiecePath(context, piece, tabSize);
  context.save();
  context.clip();
  context.drawImage(
    image,
    tabSize - piece.column * tileWidth,
    tabSize - piece.row * tileHeight,
    boardWidth,
    boardHeight,
  );
  context.restore();

  makePiecePath(context, piece, tabSize);
  context.lineWidth = 1.5;
  context.strokeStyle = "rgba(255, 255, 255, 0.88)";
  context.stroke();
  canvas.dataset.tabSize = String(tabSize);
  canvas.dataset.tileWidth = String(tileWidth);
  canvas.dataset.tileHeight = String(tileHeight);
  return canvas;
}

function makeGuides(rows, columns) {
  guides.replaceChildren();
  guides.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  guides.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  for (let index = 0; index < rows * columns; index += 1) {
    const cell = document.createElement("div");
    cell.className = "guide-cell";
    guides.append(cell);
  }
}

function makeTraySlots(count) {
  tray.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const slot = document.createElement("div");
    slot.className = "tray-slot";
    slot.dataset.slot = String(index);
    tray.append(slot);
  }
}

function getEmptyTraySlot() {
  return Array.from(tray.children).find((slot) => slot.childElementCount === 0);
}

function returnPieceToTray(canvas) {
  const emptySlot = getEmptyTraySlot();
  if (!emptySlot) {
    throw new Error("No empty tray slot is available for the puzzle piece.");
  }
  canvas.classList.remove("is-dragging");
  canvas.style.position = "";
  canvas.style.left = "";
  canvas.style.top = "";
  canvas.style.width = "";
  canvas.style.height = "";
  canvas.style.zIndex = "";
  canvas.style.maxWidth = "";
  canvas.style.maxHeight = "";
  canvas.style.transform = "";
  emptySlot.append(canvas);
}

function finishGame() {
  clearInterval(timerInterval);
  timerInterval = null;
  setStatus(`ต่อภาพสำเร็จ! ใช้เวลา ${formatTime(elapsedSeconds)}`, "won");
}

function startTimer(initialSeconds = 0) {
  clearInterval(timerInterval);
  elapsedSeconds = initialSeconds;
  updateTimer();
  timerInterval = window.setInterval(() => {
    elapsedSeconds += 1;
    updateTimer();
  }, 1000);
}

function startGame({ preserveState = false } = {}) {
  if (!gameReady) {
    return;
  }
  const placedIds = preserveState
    ? new Set(pieces.filter((piece) => piece.placed).map((piece) => piece.id))
    : new Set();
  const remainingIds = preserveState
    ? pieces.filter((piece) => !piece.placed).map((piece) => piece.id)
    : [];
  const previousElapsedSeconds = elapsedSeconds;
  clearInterval(timerInterval);
  activeDrag = null;
  placedCount = 0;
  const level = levels[difficulty.value];
  const boardRect = board.getBoundingClientRect();
  const boardWidth = boardRect.width;
  const boardHeight = boardRect.height;
  const tileWidth = boardWidth / level.columns;
  const tileHeight = boardHeight / level.rows;
  const tabSize = Math.max(8, Math.min(tileWidth, tileHeight) * 0.18);

  board.querySelectorAll(".piece").forEach((piece) => piece.remove());
  tray.replaceChildren();
  makeGuides(level.rows, level.columns);
  makeTraySlots(level.total);
  trayCountText.textContent = `${level.total} ชิ้น`;

  pieces = [];
  for (let row = 0; row < level.rows; row += 1) {
    for (let column = 0; column < level.columns; column += 1) {
      pieces.push({
        id: row * level.columns + column,
        row,
        column,
        rows: level.rows,
        columns: level.columns,
        width: tileWidth,
        height: tileHeight,
      });
    }
  }

  if (preserveState && remainingIds.length > 0) {
    const remainingOrder = new Map(remainingIds.map((id, index) => [id, index]));
    pieces.sort((first, second) => {
      if (placedIds.has(first.id)) {
        return placedIds.has(second.id) ? first.id - second.id : 1;
      }
      if (placedIds.has(second.id)) {
        return -1;
      }
      return remainingOrder.get(first.id) - remainingOrder.get(second.id);
    });
  } else {
    for (let index = pieces.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pieces[index], pieces[swapIndex]] = [pieces[swapIndex], pieces[index]];
    }
  }

  const slots = Array.from(tray.children);
  let trayIndex = 0;
  pieces.forEach((piece, index) => {
    const canvas = makePieceCanvas(piece, boardWidth, boardHeight, tileWidth, tileHeight, tabSize);
    piece.canvas = canvas;
    piece.placed = placedIds.has(piece.id);
    if (piece.placed) {
      canvas.style.position = "absolute";
      canvas.style.left = `${piece.column * tileWidth - tabSize}px`;
      canvas.style.top = `${piece.row * tileHeight - tabSize}px`;
      canvas.style.zIndex = "1";
      canvas.style.maxWidth = "none";
      canvas.style.maxHeight = "none";
      board.append(canvas);
      placedCount += 1;
    } else {
      slots[trayIndex].append(canvas);
      trayIndex += 1;
    }
  });
  progressText.textContent = `${placedCount} / ${level.total}`;
  gameBoardWidth = boardWidth;
  gameBoardHeight = boardHeight;
  if (placedCount === level.total) {
    finishGame();
  } else {
    setStatus(preserveState && placedCount > 0 ? "ปรับกระดานตามหน้าจอแล้ว เล่นต่อได้เลย" : "ลากชิ้นส่วนไปวางบนกระดาน");
    startTimer(preserveState ? previousElapsedSeconds : 0);
  }
}

function refreshGameAfterResize() {
  if (!gameReady || activeDrag) {
    return;
  }
  const { width, height } = board.getBoundingClientRect();
  if (Math.abs(width - gameBoardWidth) > 1 || Math.abs(height - gameBoardHeight) > 1) {
    startGame({ preserveState: pieces.length > 0 });
  }
}

function scheduleResizeRefresh() {
  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame);
  }
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    refreshGameAfterResize();
  });
}

function onPointerDown(event) {
  const canvas = event.target.closest(".piece");
  if (!(canvas instanceof HTMLCanvasElement) || canvas.parentElement === tray || canvas.classList.contains("is-dragging")) {
    return;
  }
  const piece = pieces.find((candidate) => candidate.canvas === canvas);
  if (!piece || piece.placed) {
    return;
  }

  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const stageRect = document.querySelector(".game-stage").getBoundingClientRect();
  const pointerX = event.clientX - stageRect.left;
  const pointerY = event.clientY - stageRect.top;
  const anchorX = (event.clientX - rect.left) * scaleX;
  const anchorY = (event.clientY - rect.top) * scaleY;

  canvas.classList.add("is-dragging");
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  canvas.style.left = `${pointerX - anchorX}px`;
  canvas.style.top = `${pointerY - anchorY}px`;
  canvas.style.transform = "none";
  canvas.style.position = "absolute";
  document.querySelector(".game-stage").append(canvas);
  activeDrag = { canvas, piece, anchorX, anchorY, pointerId: event.pointerId };
}

function onPointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }
  const stageRect = document.querySelector(".game-stage").getBoundingClientRect();
  activeDrag.canvas.style.left = `${event.clientX - stageRect.left - activeDrag.anchorX}px`;
  activeDrag.canvas.style.top = `${event.clientY - stageRect.top - activeDrag.anchorY}px`;
}

function onPointerUp(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const { canvas, piece } = activeDrag;
  const stage = document.querySelector(".game-stage");
  const stageRect = stage.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const tabSize = Number(canvas.dataset.tabSize);
  const tileWidth = Number(canvas.dataset.tileWidth);
  const tileHeight = Number(canvas.dataset.tileHeight);
  const targetLeft = boardRect.left - stageRect.left + piece.column * tileWidth - tabSize;
  const targetTop = boardRect.top - stageRect.top + piece.row * tileHeight - tabSize;
  const left = Number.parseFloat(canvas.style.left);
  const top = Number.parseFloat(canvas.style.top);
  const tolerance = Math.min(tileWidth, tileHeight) * 0.36;

  activeDrag = null;
  canvas.classList.remove("is-dragging");
  if (Math.abs(left - targetLeft) <= tolerance && Math.abs(top - targetTop) <= tolerance) {
    canvas.style.position = "absolute";
    canvas.style.left = `${piece.column * tileWidth - tabSize}px`;
    canvas.style.top = `${piece.row * tileHeight - tabSize}px`;
    canvas.style.zIndex = "1";
    canvas.style.maxWidth = "none";
    canvas.style.maxHeight = "none";
    board.append(canvas);
    piece.placed = true;
    placedCount += 1;
    playPlacementSound();
    progressText.textContent = `${placedCount} / ${pieces.length}`;
    if (placedCount === pieces.length) {
      finishGame();
    } else {
      setStatus("ถูกต้อง! เลือกชิ้นส่วนถัดไป");
    }
    scheduleResizeRefresh();
    return;
  }
  returnPieceToTray(canvas);
  scheduleResizeRefresh();
}

restartButton.addEventListener("click", startGame);
difficulty.addEventListener("change", startGame);
musicTrackSelect.addEventListener("change", () => {
  if (musicTrackSelect.value) {
    void playTrack(musicTrackSelect.value);
  } else {
    selectedTrackId = "";
    if (youtubePlayer) {
      youtubePlayer.stopVideo();
    }
    youtubePlayerContainer.hidden = true;
    openYoutubeLink.hidden = true;
    setMusicStatus("ยังไม่ได้เลือกเพลง");
  }
});
shuffleMusicButton.addEventListener("click", shuffleTrack);
toggleMusicButton.addEventListener("click", toggleMusicPlayback);
musicVolume.addEventListener("input", updateMusicVolume);
effectVolume.addEventListener("input", updateEffectVolume);
document.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("orientationchange", scheduleResizeRefresh);
window.addEventListener("resize", scheduleResizeRefresh);
if (typeof ResizeObserver === "function") {
  const boardResizeObserver = new ResizeObserver(scheduleResizeRefresh);
  boardResizeObserver.observe(board);
}

image.addEventListener("load", () => {
  gameReady = true;
  board.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  startGame();
}, { once: true });

image.addEventListener("error", () => {
  restartButton.disabled = true;
  difficulty.disabled = true;
  setStatus("ไม่สามารถโหลด car.jpeg ได้ กรุณาตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เดียวกับหน้าเกม", "error");
}, { once: true });

if (image.complete && image.naturalWidth > 0) {
  gameReady = true;
  board.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  startGame();
}

updateMusicVolume();
updateEffectVolume();
if (window.location.protocol === "file:") {
  setMusicStatus("เพลงอาจเล่นไม่ได้เมื่อเปิดไฟล์โดยตรง ปิดหน้านี้แล้วเปิด PLAY-GAME.bat");
}
