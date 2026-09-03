const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let width, height;
function resize() {
  width = canvas.width = window.innerWidth * devicePixelRatio;
  height = canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---- state ----
let mood = "calm";
let brushSize = 6;
let fadeAmount = 0.06;

let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };
let lastPointer = { ...pointer };

const particles = [];

// ---- audio reactivity ----
let micEnabled = false;
let audioCtx, analyser, dataArray, micStream;
let audioLevel = 0;
let bassLevel = 0,
  midLevel = 0,
  trebleLevel = 0;
let runningAvg = 0;
let lastBurstTime = 0;

const MOOD_CONFIG = {
  calm: {
    hueBase: 190,
    hueSpread: 60,
    speedJitter: 0.4,
    life: 90,
    perMove: 2,
    sizeMul: 1.4,
    glow: 18,
    saturation: 70,
    lightness: 65,
  },
  chaotic: {
    hueBase: 0,
    hueSpread: 360,
    speedJitter: 4.5,
    life: 40,
    perMove: 6,
    sizeMul: 1,
    glow: 10,
    saturation: 95,
    lightness: 58,
  },
  symmetrical: {
    hueBase: 280,
    hueSpread: 140,
    speedJitter: 0.8,
    life: 70,
    perMove: 1,
    sizeMul: 1.2,
    glow: 22,
    saturation: 80,
    lightness: 62,
  },
};

const SYMMETRY_FOLDS = 8;

class Particle {
  constructor(x, y, vx, vy, hue, size, life, glow, saturation, lightness) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.hue = hue;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.glow = glow;
    this.saturation = saturation;
    this.lightness = lightness;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life -= 1;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.1, this.size * t), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${t})`;
    ctx.shadowColor = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${t})`;
    ctx.shadowBlur = this.glow * t;
    ctx.fill();
  }
}

function spawnAt(x, y, dx, dy) {
  const cfg = MOOD_CONFIG[mood];
  const audioBoost = micEnabled ? audioLevel : 0;
  const perMove = cfg.perMove + (micEnabled ? Math.round(audioBoost * 4) : 0);
  for (let i = 0; i < perMove; i++) {
    const angleJitter = (Math.random() - 0.5) * cfg.speedJitter;
    const vx = dx * 0.2 + (Math.random() - 0.5) * cfg.speedJitter + angleJitter;
    const vy = dy * 0.2 + (Math.random() - 0.5) * cfg.speedJitter + angleJitter;
    // bass warms the palette toward red/orange, treble cools it toward blue
    const hue = cfg.hueBase + Math.random() * cfg.hueSpread + bassLevel * 50 - trebleLevel * 35;
    const size = (brushSize + Math.random() * brushSize * 0.6) * cfg.sizeMul * (1 + audioBoost * 1.8);
    const glow = cfg.glow * (1 + audioBoost);
    particles.push(
      new Particle(x, y, vx, vy, hue, size, cfg.life, glow, cfg.saturation, cfg.lightness)
    );
  }
}

function triggerAudioBurst(level) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const count = Math.round(16 + level * 40);
  const hueBase = 200 - bassLevel * 160 + trebleLevel * 80;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + level * 10 + Math.random() * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const hue = hueBase + (Math.random() - 0.5) * 60;
    const size = (brushSize * 1.2 + Math.random() * brushSize) * (1 + level);
    particles.push(new Particle(cx, cy, vx, vy, hue, size, 60 + level * 40, 25 + level * 20, 85, 60));
  }
}

function spawn(x, y, dx, dy) {
  if (mood !== "symmetrical") {
    spawnAt(x, y, dx, dy);
    return;
  }
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const rx = x - cx;
  const ry = y - cy;
  const radius = Math.hypot(rx, ry);
  const baseAngle = Math.atan2(ry, rx);
  const speed = Math.hypot(dx, dy);
  const moveAngle = Math.atan2(dy, dx);

  for (let k = 0; k < SYMMETRY_FOLDS; k++) {
    const rot = (k * Math.PI * 2) / SYMMETRY_FOLDS;
    const angle = baseAngle + rot;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    const vAngle = moveAngle + rot;
    const vx = Math.cos(vAngle) * speed;
    const vy = Math.sin(vAngle) * speed;
    spawnAt(px, py, vx, vy);
  }
}

// ---- pointer handling ----
function setPointer(x, y) {
  lastPointer = pointer;
  pointer = { x, y, active: true };
  const dx = pointer.x - lastPointer.x;
  const dy = pointer.y - lastPointer.y;
  spawn(pointer.x, pointer.y, dx, dy);
}

canvas.addEventListener("mousemove", (e) => setPointer(e.clientX, e.clientY));
canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) setPointer(t.clientX, t.clientY);
  },
  { passive: false }
);
canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  if (t) {
    lastPointer = { x: t.clientX, y: t.clientY };
    pointer = { x: t.clientX, y: t.clientY, active: true };
  }
});

// ---- animation loop ----
function tick() {
  updateAudio();

  ctx.fillStyle = `rgba(5, 5, 10, ${fadeAmount})`;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(ctx);
    if (p.life <= 0) particles.splice(i, 1);
  }

  ctx.shadowBlur = 0;
  requestAnimationFrame(tick);
}
tick();

// ---- UI wiring ----
document.querySelectorAll(".mood-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mood = btn.dataset.mood;
  });
});

const sizeSlider = document.getElementById("sizeSlider");
const sizeVal = document.getElementById("sizeVal");
sizeSlider.addEventListener("input", () => {
  brushSize = Number(sizeSlider.value);
  sizeVal.textContent = brushSize;
});

const fadeSlider = document.getElementById("fadeSlider");
const fadeVal = document.getElementById("fadeVal");
fadeSlider.addEventListener("input", () => {
  fadeAmount = Number(fadeSlider.value) / 100;
  fadeVal.textContent = fadeSlider.value;
});

document.getElementById("clearBtn").addEventListener("click", () => {
  ctx.fillStyle = "#05050a";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  particles.length = 0;
});

// ---- mic reactivity ----
const micBtn = document.getElementById("micBtn");
const micStatus = document.getElementById("micStatus");
const meterFill = document.getElementById("meterFill");

async function enableMic() {
  micStatus.textContent = "Requesting microphone access...";
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    micEnabled = true;
    micBtn.textContent = "Disable mic";
    micBtn.classList.add("active");
    micStatus.textContent = "Listening — sound is shaping the ink.";
  } catch (err) {
    micEnabled = false;
    micStatus.textContent = "Microphone access denied or unavailable.";
  }
}

function disableMic() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (audioCtx) audioCtx.close();
  micEnabled = false;
  audioLevel = bassLevel = midLevel = trebleLevel = 0;
  meterFill.style.width = "0%";
  micBtn.textContent = "Enable mic";
  micBtn.classList.remove("active");
  micStatus.textContent = "Mic reactivity is off.";
}

micBtn.addEventListener("click", () => {
  if (!micEnabled) enableMic();
  else disableMic();
});

function updateAudio() {
  if (!micEnabled || !analyser) return;
  analyser.getByteFrequencyData(dataArray);

  const len = dataArray.length;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += dataArray[i];
  audioLevel = sum / len / 255;

  const third = Math.floor(len / 3);
  let bSum = 0,
    mSum = 0,
    tSum = 0;
  for (let i = 0; i < third; i++) bSum += dataArray[i];
  for (let i = third; i < third * 2; i++) mSum += dataArray[i];
  for (let i = third * 2; i < len; i++) tSum += dataArray[i];
  bassLevel = bSum / third / 255;
  midLevel = mSum / third / 255;
  trebleLevel = tSum / (len - third * 2) / 255;

  meterFill.style.width = Math.min(100, audioLevel * 140) + "%";

  runningAvg += (audioLevel - runningAvg) * 0.06;
  const now = performance.now();
  if (audioLevel > runningAvg * 1.35 && audioLevel > 0.12 && now - lastBurstTime > 180) {
    triggerAudioBurst(audioLevel);
    lastBurstTime = now;
  }
}

const panel = document.getElementById("panel");
const toggleBtn = document.getElementById("toggleBtn");
toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("hidden");
});
