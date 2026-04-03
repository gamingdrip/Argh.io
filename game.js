const socket = io();
const otherPlayers = {};
const cannonballs = [];
let leaderboard = [];
let gameStarted = false;
let t = 0;
let tradeMenu = null;
let message = "";
let messageTimer = 0;
let showClanInput = false;
let clanInput = "";
let nameInput = "Pirate";
let nameActive = false;
let dayTime = 0;
let chests = [];
let selectedColor = "#8B4513";

const WORLD_W = 2400;
const WORLD_H = 1800;

const shipColors = [
  { color: "#8B4513", name: "Oak" },
  { color: "#1a1a2e", name: "Black" },
  { color: "#8B0000", name: "Crimson" },
  { color: "#2c5f2e", name: "Forest" },
  { color: "#4a4a8a", name: "Royal" },
  { color: "#8B6914", name: "Gold" },
];

socket.on("currentPlayers", function(players) {
  Object.keys(players).forEach(function(id) {
    if (id !== socket.id) otherPlayers[id] = players[id];
  });
});
socket.on("newPlayer", function(data) { otherPlayers[data.id] = data; });
socket.on("playerMoved", function(data) { otherPlayers[data.id] = data; });
socket.on("playerLeft", function(id) { delete otherPlayers[id]; });
socket.on("cannonball", function(ball) { cannonballs.push(ball); });
socket.on("leaderboard", function(data) { leaderboard = data; });
socket.on("chestsUpdate", function(data) { chests = data; });
socket.on("chestCollected", function(data) {
  chests = chests.map(function(c) {
    if (c.id === data.chestId) c.taken = true;
    return c;
  });
  if (data.playerId === socket.id) {
    ship.gold += data.gold;
    showMessage("Found treasure! +" + data.gold + "g!");
  }
});
socket.on("playerHit", function(data) {
  if (data.id === socket.id) { ship.health = data.health; showMessage("You got hit! HP: " + ship.health); }
  else if (otherPlayers[data.id]) otherPlayers[data.id].health = data.health;
});
socket.on("playerRespawn", function(data) {
  if (data.id === socket.id) { ship.x = data.x; ship.y = data.y; ship.health = 100; showMessage("You sank! Respawning..."); }
  else if (otherPlayers[data.id]) { otherPlayers[data.id].x = data.x; otherPlayers[data.id].y = data.y; otherPlayers[data.id].health = 100; }
});

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ship = { x: 1200, y: 900, speed: 3, angle: 0, gold: 200, cargo: [], name: "Pirate", clan: "", health: 100, drunk: 0, color: "#8B4513" };

const islands = [
  { x: 300,  y: 200,  r: 55, name: "Tortuga",     color: "#F5C842", goods: { Rum: 20,  Spices: 80,  Silk: 150 } },
  { x: 900,  y: 400,  r: 45, name: "Nassau",      color: "#F0B04A", goods: { Rum: 60,  Spices: 30,  Silk: 200 } },
  { x: 1600, y: 200,  r: 50, name: "Havana",      color: "#EFC555", goods: { Rum: 90,  Spices: 50,  Silk: 40  } },
  { x: 2100, y: 500,  r: 48, name: "Port Royal",  color: "#E8C84A", goods: { Rum: 40,  Spices: 90,  Silk: 100 } },
  { x: 400,  y: 1200, r: 52, name: "La Espanola", color: "#F2C04F", goods: { Rum: 70,  Spices: 20,  Silk: 180 } },
  { x: 1200, y: 1500, r: 44, name: "San Juan",    color: "#EFC555", goods: { Rum: 30,  Spices: 60,  Silk: 220 } },
  { x: 2000, y: 1400, r: 58, name: "Devil Isle",  color: "#C8A04A", goods: { Rum: 110, Spices: 110, Silk: 110 } },
  { x: 1100, y: 850,  r: 45, name: "Tavern Isle", color: "#C8860A", tavern: true },
];

const keys = {};
document.addEventListener("keydown", function(e) {
  keys[e.key] = true;
  if (!gameStarted && nameActive) {
    if (e.key === "Enter") startGame();
    else if (e.key === "Backspace") nameInput = nameInput.slice(0, -1);
    else if (e.key.length === 1 && nameInput.length < 16) nameInput += e.key;
    return;
  }
  if (!gameStarted) return;
  if (e.key === "e" || e.key === "E") tryTrade();
  if (e.key === "Escape") tradeMenu = null;
  if (showClanInput) {
    if (e.key === "Enter") { ship.clan = clanInput; showClanInput = false; showMessage("Joined clan: " + ship.clan); }
    else if (e.key === "Backspace") clanInput = clanInput.slice(0, -1);
    else if (e.key.length === 1 && clanInput.length < 12) clanInput += e.key;
  }
});
document.addEventListener("keyup", function(e) { keys[e.key] = false; });

canvas.addEventListener("click", function(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (800 / rect.width);
  const my = (e.clientY - rect.top) * (500 / rect.height);

  if (!gameStarted) {
    if (mx > 250 && mx < 550 && my > 200 && my < 240) { nameActive = true; return; }
    if (mx > 280 && mx < 520 && my > 370 && my < 420) { startGame(); return; }
    nameActive = false;
    shipColors.forEach(function(sc, i) {
      const bx = 210 + i * 66, by = 290;
      if (mx > bx && mx < bx + 56 && my > by && my < by + 56) selectedColor = sc.color;
    });
    return;
  }

  if (mx > 10 && mx < 120 && my > 80 && my < 104) { showClanInput = true; clanInput = ship.clan; return; }
  if (tradeMenu) {
    if (tradeMenu.tavern) {
      if (mx > 300 && mx < 500 && my > 260 && my < 300) drinkAtTavern();
      return;
    }
    Object.keys(tradeMenu.goods).forEach(function(item, i) {
      const by = 175 + i * 60;
      if (mx > 220 && mx < 310 && my > by + 28 && my < by + 56) buyItem(tradeMenu, item);
      if (mx > 320 && mx < 410 && my > by + 28 && my < by + 56) sellItem(tradeMenu, item);
    });
    return;
  }
  const cam = getCamera();
  const angle = Math.atan2((my + cam.y) - ship.y, (mx + cam.x) - ship.x);
  const ball = { id: Date.now(), ownerId: socket.id, x: ship.x, y: ship.y, angle: angle, speed: 6 };
  cannonballs.push(ball);
  socket.emit("shoot", ball);
});

const waves = [];
for (var i = 0; i < 120; i++) {
  waves.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, size: Math.random() * 20 + 10, speed: Math.random() * 0.5 + 0.2, phase: Math.random() * Math.PI * 2 });
}

const stars = [];
for (var i = 0; i < 80; i++) {
  stars.push({ x: Math.random() * 800, y: Math.random() * 500, size: Math.random() * 2 + 0.5 });
}

function startGame() {
  ship.name = nameInput || "Pirate";
  ship.color = selectedColor;
  gameStarted = true;
  socket.emit("join", { name: ship.name, shipColor: selectedColor });
}

function getNearIsland() {
  for (var i = 0; i < islands.length; i++) {
    const dx = ship.x - islands[i].x;
    const dy = ship.y - islands[i].y;
    if (Math.sqrt(dx * dx + dy * dy) < islands[i].r + 50) return islands[i];
  }
  return null;
}

function tryTrade() { const isl = getNearIsland(); if (isl) tradeMenu = isl; }

function buyItem(island, item) {
  const price = island.goods[item];
  if (ship.gold >= price) { ship.gold -= price; ship.cargo.push({ item: item, boughtAt: price }); showMessage("Bought " + item + " for " + price + "g!"); }
  else showMessage("Not enough gold!");
}

function sellItem(island, item) {
  const inCargo = ship.cargo.find(function(c) { return c.item === item; });
  if (!inCargo) { showMessage("You don't have " + item + "!"); return; }
  const sellPrice = island.goods[item];
  ship.gold += sellPrice;
  ship.cargo = ship.cargo.filter(function(c) { return c.item !== item; });
  showMessage("Sold " + item + " for " + sellPrice + "g! Profit: " + (sellPrice - inCargo.boughtAt) + "g");
}

function drinkAtTavern() {
  if (ship.gold >= 30) { ship.gold -= 30; ship.drunk = 300; showMessage("Yo ho ho! You are drunk! Speed boost!"); }
  else showMessage("Not enough gold to drink!");
}

function showMessage(msg) { message = msg; messageTimer = 180; }

function getDayColor() {
  const s = Math.sin(dayTime);
  if (s > 0.3) return { ocean: "#1a6fb5", ambient: 1.0 };
  if (s > -0.3) return { ocean: "#1a4a8a", ambient: 0.6 };
  return { ocean: "#0a1a3a", ambient: 0.3 };
}

function getCamera() {
  return {
    x: Math.max(0, Math.min(WORLD_W - 800, ship.x - 400)),
    y: Math.max(0, Math.min(WORLD_H - 500, ship.y - 250))
  };
}

function checkChests() {
  chests.forEach(function(chest) {
    if (chest.taken) return;
    const dx = ship.x - chest.x, dy = ship.y - chest.y;
    if (Math.sqrt(dx * dx + dy * dy) < 30) {
      socket.emit("collectChest", chest.id);
    }
  });
}

function update() {
  t += 0.02;
  dayTime += 0.001;
  if (!gameStarted) return;
  if (!tradeMenu && !showClanInput) {
    const spd = ship.drunk > 0 ? 5 : 3;
    if (keys["ArrowUp"] || keys["w"]) {
      const wobble = ship.drunk > 0 ? (Math.random() - 0.5) * 0.1 : 0;
      ship.x += Math.cos(ship.angle + wobble) * spd;
      ship.y += Math.sin(ship.angle + wobble) * spd;
    }
    if (keys["ArrowLeft"] || keys["a"]) ship.angle -= 0.05;
    if (keys["ArrowRight"] || keys["d"]) ship.angle += 0.05;
    ship.x = Math.max(50, Math.min(WORLD_W - 50, ship.x));
    ship.y = Math.max(50, Math.min(WORLD_H - 50, ship.y));
    if (ship.drunk > 0) ship.drunk--;
  }
  if (messageTimer > 0) messageTimer--;
  checkChests();
  for (var i = cannonballs.length - 1; i >= 0; i--) {
    cannonballs[i].x += Math.cos(cannonballs[i].angle) * cannonballs[i].speed;
    cannonballs[i].y += Math.sin(cannonballs[i].angle) * cannonballs[i].speed;
    if (cannonballs[i].x < 0 || cannonballs[i].x > WORLD_W || cannonballs[i].y < 0 || cannonballs[i].y > WORLD_H) cannonballs.splice(i, 1);
  }
  socket.emit("move", { x: ship.x, y: ship.y, angle: ship.angle, gold: ship.gold });
}

function drawOcean(cam) {
  const dc = getDayColor();
  ctx.fillStyle = ship.drunk > 0 ? "#2a4fb5" : dc.ocean;
  ctx.fillRect(0, 0, 800, 500);
  const nightAlpha = 1 - Math.max(0, Math.sin(dayTime));
  if (nightAlpha > 0.1) {
    stars.forEach(function(s) {
      ctx.save(); ctx.globalAlpha = nightAlpha * 0.8;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }
  waves.forEach(function(w) {
    const sx = w.x - cam.x, sy = w.y - cam.y;
    if (sx < -40 || sx > 840 || sy < -20 || sy > 520) return;
    const a = Math.sin(t * w.speed + w.phase) * 0.5 + 0.5;
    ctx.save(); ctx.globalAlpha = (0.15 + a * 0.2) * dc.ambient; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx - w.size / 2, sy); ctx.quadraticCurveTo(sx, sy - 6, sx + w.size / 2, sy); ctx.stroke();
    ctx.restore();
  });
  const sunX = (Math.cos(dayTime) * 0.5 + 0.5) * 800;
  const sunY = 60 - Math.sin(dayTime) * 80;
  if (Math.sin(dayTime) > -0.2) {
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.fillStyle = Math.sin(dayTime) > 0.3 ? "#FFE566" : "#FF7043";
    ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (nightAlpha > 0.3) {
    const moonX = (Math.cos(dayTime + Math.PI) * 0.5 + 0.5) * 800;
    const moonY = 60 - Math.sin(dayTime + Math.PI) * 80;
    ctx.save(); ctx.globalAlpha = nightAlpha * 0.9;
    ctx.fillStyle = "#fffde0"; ctx.beginPath(); ctx.arc(moonX, moonY, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (nightAlpha > 0.2) {
    ctx.save(); ctx.globalAlpha = nightAlpha * 0.35;
    ctx.fillStyle = "#000020"; ctx.fillRect(0, 0, 800, 500);
    ctx.restore();
  }
}

function drawChests(cam) {
  chests.forEach(function(chest) {
    if (chest.taken) return;
    const sx = chest.x - cam.x, sy = chest.y - cam.y;
    if (sx < -20 || sx > 820 || sy < -20 || sy > 520) return;
    const bob = Math.sin(t * 2 + chest.id) * 3;
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = "#C8A028";
    ctx.fillRect(-12, -8, 24, 7);
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(-2, -3, 4, 6);
    ctx.strokeStyle = "#5a4010"; ctx.lineWidth = 1.5;
    ctx.strokeRect(-12, -8, 24, 16);
    ctx.fillStyle = "#FFE47A"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center";
    ctx.fillText(chest.gold + "g", 0, -14);
    ctx.restore();
  });
}

function drawPirateOnDeck(sx, sy, angle, color) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  const bodyColor = color || "#8B4513";
  ctx.fillStyle = "#FDBCB4";
  ctx.beginPath(); ctx.arc(0, -14, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-3, -18, 6, 4);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-4, -10, 8, 8);
  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(-4, -2, 4, 6);
  ctx.fillRect(0, -2, 4, 6);
  ctx.restore();
}

function drawIslands(cam) {
  islands.forEach(function(isl) {
    const sx = isl.x - cam.x, sy = isl.y - cam.y;
    if (sx < -isl.r - 20 || sx > 800 + isl.r || sy < -isl.r - 20 || sy > 500 + isl.r) return;
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = "#7ED8FF";
    ctx.beginPath(); ctx.ellipse(sx, sy + isl.r * 0.1, isl.r * 1.4, isl.r * 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = isl.color; ctx.beginPath(); ctx.ellipse(sx, sy, isl.r, isl.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isl.tavern ? "#8B4513" : "#2d8c3c";
    ctx.beginPath(); ctx.ellipse(sx, sy - 5, isl.r * 0.65, isl.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center";
    ctx.fillText(isl.name, sx, sy + isl.r + 14);
    const dx = ship.x - isl.x, dy = ship.y - isl.y;
    if (Math.sqrt(dx * dx + dy * dy) < isl.r + 50) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(sx - 60, sy - isl.r - 35, 120, 28, 6); ctx.fill();
      ctx.fillStyle = "#FFE47A"; ctx.font = "12px Georgia";
      ctx.fillText(isl.tavern ? "Press E for tavern!" : "Press E to trade!", sx, sy - isl.r - 16);
    }
  });
}

function drawHealthBar(x, y, health) {
  ctx.fillStyle = "#333"; ctx.fillRect(x - 20, y - 38, 40, 5);
  ctx.fillStyle = health > 50 ? "#2ecc71" : "#e74c3c";
  ctx.fillRect(x - 20, y - 38, 40 * (health / 100), 5);
}

function drawShipShape(color, t, isPlayer) {
  const hull = color;
  const deck = shadeColor(color, 20);
  ctx.fillStyle = hull;
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-15, -10); ctx.lineTo(-20, 0); ctx.lineTo(-15, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = deck;
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shadeColor(color, -30); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
  ctx.fillStyle = "#F5F0E0";
  const sway = isPlayer ? Math.sin(t) * 2 : 0;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(14 + sway, 0, 0, 8); ctx.quadraticCurveTo(-3, 0, 0, -8); ctx.fill();
}

function shadeColor(color, percent) {
  var num = parseInt(color.replace("#", ""), 16);
  var r = Math.min(255, Math.max(0, (num >> 16) + percent));
  var g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  var b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function drawShips(cam) {
  Object.values(otherPlayers).forEach(function(p) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.angle);
    drawShipShape(p.shipColor || "#c0392b", t, false);
    drawPirateOnDeck(0, 0, 0, p.shipColor);
    ctx.rotate(-p.angle); ctx.fillStyle = "#fff"; ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
    ctx.fillText(p.name || "Pirate", 0, -28); ctx.restore();
    drawHealthBar(sx, sy, p.health || 100);
  });

  const wx = ship.drunk > 0 ? Math.sin(t * 8) * 3 : 0;
  const wy = ship.drunk > 0 ? Math.cos(t * 6) * 2 : 0;
  const sx = ship.x - cam.x + wx, sy = ship.y - cam.y + wy;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(ship.angle);
  drawShipShape(ship.color, t, true);
  drawPirateOnDeck(0, 0, 0, ship.color);
  ctx.rotate(-ship.angle); ctx.fillStyle = "#fff"; ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
  ctx.fillText(ship.clan ? "[" + ship.clan + "] " + ship.name : ship.name, 0, -28); ctx.restore();
  drawHealthBar(ship.x - cam.x, ship.y - cam.y, ship.health);
}

function drawCannonballs(cam) {
  cannonballs.forEach(function(ball) {
    const sx = ball.x - cam.x, sy = ball.y - cam.y;
    ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawLeaderboard() {
  if (leaderboard.length === 0) return;
  const lx = 10, ly = 115, lw = 160, lh = 30 + leaderboard.length * 22;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 8); ctx.fill();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "left";
  ctx.fillText("LEADERBOARD", lx + 10, ly + 18);
  leaderboard.forEach(function(p, i) {
    ctx.fillStyle = i === 0 ? "#FFD700" : "#fff";
    ctx.font = "11px Georgia";
    ctx.fillText((i + 1) + ". " + p.name + " - " + p.gold + "g", lx + 10, ly + 36 + i * 22);
  });
}

function drawMinimap() {
  const mx = 660, my = 350, mw = 130, mh = 100;
  ctx.fillStyle = "rgba(0,0,30,0.65)"; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 8); ctx.fill();
  ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 8); ctx.stroke();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center"; ctx.fillText("MINIMAP", mx + mw / 2, my + 12);
  islands.forEach(function(isl) {
    const ix = mx + (isl.x / WORLD_W) * mw, iy = my + (isl.y / WORLD_H) * mh;
    ctx.fillStyle = isl.color; ctx.beginPath(); ctx.arc(ix, iy, 4, 0, Math.PI * 2); ctx.fill();
  });
  chests.forEach(function(chest) {
    if (chest.taken) return;
    const cx = mx + (chest.x / WORLD_W) * mw, cy = my + (chest.y / WORLD_H) * mh;
    ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
  });
  const px = mx + (ship.x / WORLD_W) * mw, py = my + (ship.y / WORLD_H) * mh;
  ctx.fillStyle = "#ff4444"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
  Object.values(otherPlayers).forEach(function(p) {
    const ox = mx + (p.x / WORLD_W) * mw, oy = my + (p.y / WORLD_H) * mh;
    ctx.fillStyle = "#ff9900"; ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill();
  });
}

function drawTradeMenu() {
  if (!tradeMenu) return;
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.beginPath(); ctx.roundRect(200, 100, 400, 300, 12); ctx.fill();
  ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(200, 100, 400, 300, 12); ctx.stroke();
  if (tradeMenu.tavern) {
    ctx.fillStyle = "#FFE47A"; ctx.font = "bold 20px Georgia"; ctx.textAlign = "center"; ctx.fillText("Tavern Isle", 400, 140);
    ctx.fillStyle = "#fff"; ctx.font = "14px Georgia";
    ctx.fillText("Welcome sailor! Have a drink!", 400, 175);
    ctx.fillText("Rum costs 30 gold", 400, 205);
    ctx.fillText("Effect: Speed boost and wobble!", 400, 230);
    ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.roundRect(300, 260, 200, 40, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Georgia"; ctx.textAlign = "center"; ctx.fillText("Drink Rum - 30g", 400, 285);
    ctx.fillStyle = "#888"; ctx.font = "11px Georgia"; ctx.fillText("ESC to leave", 400, 360);
    return;
  }
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 18px Georgia"; ctx.textAlign = "center"; ctx.fillText(tradeMenu.name + " Market", 400, 135);
  ctx.fillStyle = "#aef"; ctx.font = "13px Georgia"; ctx.fillText("Gold: " + ship.gold, 400, 158);
  Object.keys(tradeMenu.goods).forEach(function(item, i) {
    const by = 175 + i * 60, price = tradeMenu.goods[item];
    const inCargo = ship.cargo.filter(function(c) { return c.item === item; }).length;
    ctx.fillStyle = "#fff"; ctx.font = "14px Georgia"; ctx.textAlign = "left"; ctx.fillText(item + "  " + price + "g  (have: " + inCargo + ")", 225, by + 20);
    ctx.fillStyle = "#2a9d2a"; ctx.beginPath(); ctx.roundRect(220, by + 28, 90, 28, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center"; ctx.fillText("BUY " + price + "g", 265, by + 47);
    ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.roundRect(320, by + 28, 90, 28, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText("SELL " + price + "g", 365, by + 47);
  });
  ctx.fillStyle = "#888"; ctx.font = "11px Georgia"; ctx.textAlign = "center"; ctx.fillText("ESC to close", 400, 385);
}

function drawHUD() {
  const timeStr = Math.sin(dayTime) > 0.3 ? "Day" : Math.sin(dayTime) > -0.3 ? "Sunset" : "Night";
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(10, 10, 220, 36, 8); ctx.fill();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 13px Georgia"; ctx.textAlign = "left";
  ctx.fillText("ARGH.IO  |  Gold: " + ship.gold + "g  |  " + timeStr, 20, 33);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(10, 54, 150, 20, 6); ctx.fill();
  ctx.fillStyle = ship.health > 50 ? "#2ecc71" : "#e74c3c";
  ctx.beginPath(); ctx.roundRect(10, 54, 150 * (ship.health / 100), 20, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 11px Georgia"; ctx.textAlign = "center"; ctx.fillText("HP: " + ship.health, 85, 68);
  if (ship.drunk > 0) {
    ctx.fillStyle = "rgba(200,100,0,0.3)"; ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = "#FFE47A"; ctx.font = "bold 16px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Yo ho ho! Drunk! (" + Math.ceil(ship.drunk / 60) + "s)", 400, 30);
  }
  ctx.fillStyle = ship.clan ? "#1a6b1a" : "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(10, 80, 110, 24, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "11px Georgia"; ctx.textAlign = "center"; ctx.fillText(ship.clan ? "Clan: " + ship.clan : "[ + Join Clan ]", 65, 96);
  if (showClanInput) {
    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.roundRect(250, 220, 300, 60, 10); ctx.fill();
    ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(250, 220, 300, 60, 10); ctx.stroke();
    ctx.fillStyle = "#FFE47A"; ctx.font = "bold 13px Georgia"; ctx.textAlign = "center"; ctx.fillText("Enter clan name:", 400, 242);
    ctx.fillStyle = "#fff"; ctx.font = "15px Georgia"; ctx.fillText(clanInput + "|", 400, 266);
  }
  if (messageTimer > 0) {
    ctx.globalAlpha = Math.min(1, messageTimer / 30);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(200, 440, 400, 32, 8); ctx.fill();
    ctx.fillStyle = "#FFE47A"; ctx.font = "13px Georgia"; ctx.textAlign = "center"; ctx.fillText(message, 400, 461);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(10, 460, 280, 28, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "11px Georgia"; ctx.textAlign = "left";
  ctx.fillText("WASD sail  |  E trade  |  Click shoot", 20, 478);
}

function drawJoinScreen() {
  ctx.fillStyle = "#1a6fb5"; ctx.fillRect(0, 0, 800, 500);
  waves.slice(0, 40).forEach(function(w) {
    const a = Math.sin(t * w.speed + w.phase) * 0.5 + 0.5;
    ctx.save(); ctx.globalAlpha = 0.15 + a * 0.2; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w.x % 800 - w.size / 2, w.y % 500); ctx.quadraticCurveTo(w.x % 800, w.y % 500 - 6, w.x % 800 + w.size / 2, w.y % 500); ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.beginPath(); ctx.roundRect(180, 100, 440, 300, 16); ctx.fill();
  ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(180, 100, 440, 300, 16); ctx.stroke();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 32px Georgia"; ctx.textAlign = "center"; ctx.fillText("ARGH.IO", 400, 148);
  ctx.fillStyle = "#aef"; ctx.font = "13px Georgia"; ctx.fillText("Enter your pirate name:", 400, 178);
  ctx.fillStyle = nameActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)";
  ctx.beginPath(); ctx.roundRect(250, 186, 300, 36, 8); ctx.fill();
  ctx.strokeStyle = nameActive ? "#FFE47A" : "#888"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(250, 186, 300, 36, 8); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "16px Georgia"; ctx.textAlign = "center";
  ctx.fillText(nameInput + (nameActive ? "|" : ""), 400, 210);

  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center";
  ctx.fillText("Choose your ship color:", 400, 268);
  shipColors.forEach(function(sc, i) {
    const bx = 210 + i * 66, by = 276;
    ctx.fillStyle = sc.color;
    ctx.beginPath(); ctx.roundRect(bx, by, 56, 40, 6); ctx.fill();
    if (selectedColor === sc.color) {
      ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(bx, by, 56, 40, 6); ctx.stroke();
    }
    ctx.fillStyle = "#fff"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
    ctx.fillText(sc.name, bx + 28, by + 52);
  });

  ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.roundRect(280, 336, 240, 44, 10); ctx.fill();
  ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(280, 336, 240, 44, 10); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "bold 18px Georgia"; ctx.textAlign = "center"; ctx.fillText("SET SAIL!", 400, 364);
  ctx.fillStyle = "#aaa"; ctx.font = "11px Georgia"; ctx.fillText("Click name box to type, pick a color, then SET SAIL!", 400, 392);
}

function loop() {
  update();
  if (!gameStarted) { drawJoinScreen(); requestAnimationFrame(loop); return; }
  const cam = getCamera();
  drawOcean(cam);
  drawIslands(cam);
  drawChests(cam);
  drawShips(cam);
  drawCannonballs(cam);
  drawLeaderboard();
  drawMinimap();
  drawTradeMenu();
  drawHUD();
  requestAnimationFrame(loop);
}

loop();
