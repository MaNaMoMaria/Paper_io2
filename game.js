const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const gameTitle = document.getElementById('game-title');
const startBtn = document.getElementById('start-btn');
const exitBtn = document.getElementById('exit-btn');
const speedValEl = document.getElementById('speed-val');
const leaderboardEl = document.getElementById('leaderboard');

// Offscreen Buffer for Masking
const maskCanvas = document.createElement('canvas');
maskCanvas.width = canvas.width;
maskCanvas.height = canvas.height;
const maskCtx = maskCanvas.getContext('2d');

// --- Image Assets System ---
const images = {
  city1: new Image(),
  city2: new Image(),
  city3: new Image(),
  diamondGold: new Image(),     // DiamondGold01.png
  diamondRed: new Image(),      // DiamondRed01.png
  diamondTurquoise: new Image() // DiamondTurquoise01.png
};

function loadImage(imgObject, src) {
  return new Promise((resolve) => {
    imgObject.onload = () => resolve(true);
    imgObject.onerror = () => {
      console.warn(`Could not load image at path: ${src}. Make sure the file exists in the folder!`);
      resolve(false);
    };
    imgObject.src = src;
  });
}

// Fallback Canvas Texture
function createFallbackTexture(color1, color2) {
  const c = document.createElement('canvas');
  c.width = canvas.width; 
  c.height = canvas.height;
  const cx = c.getContext('2d');
  cx.fillStyle = color1;
  cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = color2;
  for (let x = 0; x < c.width; x += 40) {
    for (let y = 0; y < c.height; y += 40) {
      if ((x + y) % 80 === 0) cx.fillRect(x, y, 38, 38);
    }
  }
  return c;
}

// Audio System
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'lose') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {}
}

const GRID = 5;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;

let grid = [];
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let gameActive = false;

// تنظیمات بازیکنان و اتصال به تصاویر جدید الماس‌ها
const players = [
  {
    id: 1,
    name: 'Capital Kingdom (You)',
    x: 250,
    y: 250,
    baseSpeed: 1.2,
    speed: 1.2,
    maxSpeed: 3.5,
    angle: 0,
    color: '#0284c7',
    trailColor: '#0284c7',
    alive: true,
    isOutside: false,
    trail: [],
    isBot: false,
    imageAsset: images.city3,
    diamondAsset: images.diamondTurquoise, // استفاده از عکس جدید
    fallback: createFallbackTexture('#0284c7', '#0369a1')
  },
  {
    id: 2,
    name: 'Ocean Coast (Bot 1)',
    x: canvas.width - 250,
    y: 250,
    baseSpeed: 1.0,
    speed: 1.0,
    maxSpeed: 3.0,
    angle: Math.PI,
    color: '#ef4444',
    trailColor: '#ef4444',
    alive: true,
    isOutside: false,
    trail: [],
    isBot: true,
    aiState: 'IN_BASE',
    expeditionDist: 0,
    targetDist: 100,
    imageAsset: images.city2,
    diamondAsset: images.diamondRed, // استفاده از عکس جدید
    fallback: createFallbackTexture('#ef4444', '#dc2626')
  },
  {
    id: 3,
    name: 'Winter Realm (Bot 2)',
    x: canvas.width / 2,
    y: canvas.height - 200,
    baseSpeed: 1.0,
    speed: 1.0,
    maxSpeed: 3.0,
    angle: -Math.PI / 2,
    color: '#eab308',
    trailColor: '#eab308',
    alive: true,
    isOutside: false,
    trail: [],
    isBot: true,
    aiState: 'IN_BASE',
    expeditionDist: 0,
    targetDist: 100,
    imageAsset: images.city1,
    diamondAsset: images.diamondGold, // استفاده از عکس جدید
    fallback: createFallbackTexture('#eab308', '#ca8a04')
  }
];

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

startBtn.addEventListener('click', async () => {
  // بارگذاری دقیق تصاویر جدید با پسوند _2.jpg
  await Promise.all([
    loadImage(images.city1, 'images/City01.png'),
    loadImage(images.city2, 'images/City02.png'),
    loadImage(images.city3, 'images/City03.png'),
    loadImage(images.diamondGold, 'images/DiamondGold01.png'),
    loadImage(images.diamondRed, 'images/DiamondRed01.png'),
    loadImage(images.diamondTurquoise, 'images/DiamondTurquoise01.png')
  ]);
  
  initGame();
});

exitBtn.addEventListener('click', () => {
  location.reload();
});

function initGame() {
  grid = Array(COLS).fill(0).map(() => Array(ROWS).fill(0));

  players[0].x = 250; players[0].y = 250;
  players[0].speed = players[0].baseSpeed;
  players[0].alive = true; players[0].isOutside = false; players[0].trail = [];

  players[1].x = canvas.width - 250; players[1].y = 250;
  players[1].speed = players[1].baseSpeed;
  players[1].alive = true; players[1].isOutside = false; players[1].trail = [];

  players[2].x = canvas.width / 2; players[2].y = canvas.height - 200;
  players[2].speed = players[2].baseSpeed;
  players[2].alive = true; players[2].isOutside = false; players[2].trail = [];

  for (let p of players) {
    initCircularTerritory(p, 18);
  }

  overlay.classList.remove('active');
  exitBtn.style.display = 'none';
  gameActive = true;
  requestAnimationFrame(gameLoop);
}

function initCircularTerritory(entity, radiusGrid) {
  const cx = Math.floor(entity.x / GRID);
  const cy = Math.floor(entity.y / GRID);

  for (let x = cx - radiusGrid; x <= cx + radiusGrid; x++) {
    for (let y = cy - radiusGrid; y <= cy + radiusGrid; y++) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
        if (Math.hypot(x - cx, y - cy) <= radiusGrid) {
          grid[x][y] = entity.id;
        }
      }
    }
  }
}

function updateBotAI(bot) {
  if (!bot.isOutside) {
    bot.aiState = 'IN_BASE';
    bot.expeditionDist = 0;
  }

  if (bot.aiState === 'IN_BASE') {
    if (Math.random() < 0.05) bot.angle += (Math.random() - 0.5) * 1.5;
    if (bot.isOutside) {
      bot.aiState = 'EXPEDITION';
      bot.targetDist = Math.floor(Math.random() * 120) + 60;
    }
  } else if (bot.aiState === 'EXPEDITION') {
    bot.expeditionDist += bot.speed;
    bot.angle += (Math.random() - 0.5) * 0.1;

    if (bot.expeditionDist >= bot.targetDist || 
        bot.x < 50 || bot.x > canvas.width - 50 || bot.y < 50 || bot.y > canvas.height - 50) {
      bot.aiState = 'RETURNING';
    }
  } else if (bot.aiState === 'RETURNING') {
    let target = findNearestTerritoryCell(bot);
    if (target) {
      let targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      let diff = Math.atan2(Math.sin(targetAngle - bot.angle), Math.cos(targetAngle - bot.angle));
      bot.angle += diff * 0.15;
    }
  }
}

function findNearestTerritoryCell(bot) {
  const gx = Math.floor(bot.x / GRID);
  const gy = Math.floor(bot.y / GRID);
  let minDist = Infinity;
  let target = null;

  for (let x = Math.max(0, gx - 30); x < Math.min(COLS, gx + 30); x += 2) {
    for (let y = Math.max(0, gy - 30); y < Math.min(ROWS, gy + 30); y += 2) {
      if (grid[x][y] === bot.id) {
        let d = Math.hypot(x * GRID - bot.x, y * GRID - bot.y);
        if (d < minDist) {
          minDist = d;
          target = { x: x * GRID, y: y * GRID };
        }
      }
    }
  }
  return target;
}

function updatePlayers() {
  for (let p of players) {
    if (!p.alive) {
      if (p.isBot) respawnBotSafely(p);
      continue;
    }

    if (!p.isBot) {
      let dx = mouse.x - p.x;
      let dy = mouse.y - p.y;
      if (Math.hypot(dx, dy) > 6) p.angle = Math.atan2(dy, dx);
    } else {
      updateBotAI(p);
    }

    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    handleEntityState(p);
  }

  checkCollisions();
}

function respawnBotSafely(bot) {
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) if (grid[x][y] === bot.id) grid[x][y] = 0;
  }

  let rx = Math.floor(Math.random() * (canvas.width - 200)) + 100;
  let ry = Math.floor(Math.random() * (canvas.height - 200)) + 100;

  bot.x = rx; bot.y = ry;
  bot.speed = bot.baseSpeed;
  bot.alive = true; bot.isOutside = false; bot.trail = [];
  initCircularTerritory(bot, 15);
}

function handleEntityState(p) {
  if (p.x < 5 || p.x > canvas.width - 5 || p.y < 5 || p.y > canvas.height - 5) {
    killPlayer(p);
    return;
  }

  const gx = Math.floor(p.x / GRID);
  const gy = Math.floor(p.y / GRID);

  if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
    if (grid[gx][gy] !== p.id) {
      p.isOutside = true;
      p.trail.push({ x: gx, y: gy });
    } else if (p.isOutside) {
      p.isOutside = false;
      captureTerritory(p);
    }
  }
}

function killPlayer(p) {
  p.alive = false;
  p.trail = [];
  playSound('lose');
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) if (grid[x][y] === p.id) grid[x][y] = 0;
  }
}

function checkCollisions() {
  for (let attacker of players) {
    if (!attacker.alive) continue;
    const gx = Math.floor(attacker.x / GRID);
    const gy = Math.floor(attacker.y / GRID);

    for (let victim of players) {
      if (!victim.alive) continue;
      if (attacker.id !== victim.id && victim.trail.length > 0) {
        for (let pt of victim.trail) {
          if (Math.abs(pt.x - gx) <= 1 && Math.abs(pt.y - gy) <= 1) {
            killPlayer(victim);
            break;
          }
        }
      }
    }
  }
}

function captureTerritory(p) {
  for (let pt of p.trail) {
    if (pt.x >= 0 && pt.x < COLS && pt.y >= 0 && pt.y < ROWS) {
      grid[pt.x][pt.y] = p.id;
    }
  }
  p.trail = [];

  let visited = Array(COLS).fill(false).map(() => Array(ROWS).fill(false));
  let queue = [];

  for (let x = 0; x < COLS; x++) {
    if (grid[x][0] !== p.id) queue.push({ x, y: 0 });
    if (grid[x][ROWS - 1] !== p.id) queue.push({ x, y: ROWS - 1 });
  }
  for (let y = 0; y < ROWS; y++) {
    if (grid[0][y] !== p.id) queue.push({ x: 0, y });
    if (grid[COLS - 1][y] !== p.id) queue.push({ x: COLS - 1, y });
  }

  while (queue.length > 0) {
    let { x, y } = queue.pop();
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS || visited[x][y] || grid[x][y] === p.id) continue;
    visited[x][y] = true;
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }

  let newlyCaptured = 0;
  let totalTerritoryCount = 0;
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (grid[x][y] === p.id) totalTerritoryCount++;
      if (!visited[x][y] && grid[x][y] !== p.id) {
        grid[x][y] = p.id;
        newlyCaptured++;
        totalTerritoryCount++;
      }
    }
  }

  if (newlyCaptured > 0) {
    const totalMapSize = COLS * ROWS;
    const territoryRatio = totalTerritoryCount / totalMapSize;
    
    p.speed = Math.min(p.maxSpeed, p.baseSpeed + (territoryRatio * 2.5));

    if (!p.isBot) {
      playSound('capture');
      speedValEl.innerText = p.speed.toFixed(1) + 'x';
    }
  }
}

function updateLeaderboard() {
  const total = COLS * ROWS;
  let html = '';
  for (let p of players) {
    let c = 0;
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) if (grid[x][y] === p.id) c++;
    }
    let pct = ((c / total) * 100).toFixed(1);

    if (pct >= 35.0 && gameActive) {
      gameActive = false;
      gameTitle.innerText = p.isBot ? p.name + ' Won!' : 'VICTORY! Realm Captured';
      overlay.classList.add('active');
      exitBtn.style.display = 'block';
    }

    html += '<div style="margin-bottom: 8px;">' +
      '<div class="leader-row" style="color:' + p.color + '">' +
        '<span>' + p.name + '</span><span>' + pct + '%</span>' +
      '</div>' +
      '<div class="progress-bar-bg">' +
        '<div class="progress-bar-fill" style="width: ' + Math.min(pct * 2.8, 100) + '%; background: ' + p.color + ';"></div>' +
      '</div>' +
    '</div>';
  }
  leaderboardEl.innerHTML = html;
}

function drawMaskedTerritories() {
  for (let p of players) {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    maskCtx.fillStyle = '#ffffff';
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (grid[x][y] === p.id) {
          maskCtx.fillRect(x * GRID, y * GRID, GRID, GRID);
        }
      }
    }

    maskCtx.globalCompositeOperation = 'source-in';
    
    if (p.imageAsset.complete && p.imageAsset.naturalWidth !== 0) {
      maskCtx.drawImage(p.imageAsset, 0, 0, maskCanvas.width, maskCanvas.height);
    } else {
      maskCtx.drawImage(p.fallback, 0, 0);
    }
    
    maskCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(maskCanvas, 0, 0);
  }
}

function draw() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMaskedTerritories();

  for (let p of players) {
    if (!p.alive) continue;

    // رسم دنباله بازیکن
    ctx.fillStyle = p.trailColor;
    for (let pt of p.trail) ctx.fillRect(pt.x * GRID, pt.y * GRID, GRID, GRID);

    // رسم عکس الماس اختصاصی به عنوان آیکون بازیکن
    if (p.diamondAsset && p.diamondAsset.complete && p.diamondAsset.naturalWidth !== 0) {
      ctx.drawImage(p.diamondAsset, p.x - 15, p.y - 15, 30, 30);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function gameLoop() {
  if (!gameActive) return;
  updatePlayers();
  updateLeaderboard();
  draw();

  if (!players[0].alive) {
    gameActive = false;
    gameTitle.innerText = 'GAME OVER';
    overlay.classList.add('active');
    exitBtn.style.display = 'block';
  } else {
    requestAnimationFrame(gameLoop);
  }
}