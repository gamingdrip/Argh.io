const socket = io();
const otherPlayers = {};
const cannonballs = [];

socket.on("currentPlayers", (players) => {
  Object.keys(players).forEach(id => {
    if (id !== socket.id) otherPlayers[id] = players[id];
  });
});

socket.on("newPlayer", (data) => { otherPlayers[data.id] = data; });
socket.on("playerMoved", (data) => { otherPlayers[data.id] = data; });
socket.on("playerLeft", (id) => { delete otherPlayers[id]; });
socket.on("cannonball", (ball) => { cannonballs.push(ball); });
socket.on("playerHit", (data) => {
  if (data.id === socket.id) { ship.health = data.health; showMessage("You got hit! Health: " + ship.health); }
  else if (otherPlayers[data.id]) otherPlayers[data.id].health = data.health;
});
socket.on("playerRespawn", (data) => {
  if (data.id === socket.id) { ship.x = data.x; ship.y = data.y; ship.health = 100; showMessage("You sank! Respawning..."); }
  else if (otherPlayers[data.id]) { otherPlayers[data.id].x = data.x; otherPlayers[data.id].y = data.y; otherPlayers[data.id].health = 100; }
});

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ship = { x: 400, y: 250, speed: 3, angle: 0, gold: 200, cargo: [], name: "Blackbeard", clan: "", health: 100 };

const islands = [
  { x: 150, y: 100, r: 50, name: "Tortuga", color: "#F5C842", goods: { Rum: 20, Spices: 80, Silk: 150 } },
  { x: 650, y: 400, r: 40, name: "Nassau",  color: "#F0B04A", goods: { Rum: 60, Spices: 30, Silk: 200 } },
  { x: 680, y: 120, r: 45, name: "Havana",  color: "#EFC555", goods: { Rum: 90, Spices: 50, Silk: 40  } },
];

const keys = {};
document.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === "e" || e.key === "E") tryTrade();
  if (e.key === "Escape") tradeMenu = null;
});
document.addEventListener("keyup", e => keys[e.key] = false);

canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (800/rect.width);
  const my = (e.clientY - rect.top) * (500/rect.height);

  if (mx > 10 && mx < 120 && my > 54 && my < 78) { showClanInput = true; clanInput = ship.clan; return; }
  if (tradeMenu) {
    Object.keys(tradeMenu.goods).forEach((item, i) => {
      const by = 175 + i*60;
      if (mx > 220 && mx < 310 && my > by+28 && my < by+56) buyItem(tradeMenu, item);
      if (mx > 320 && mx < 410 && my > by+28 && my < by+56) sellItem(tradeMenu, item);
    });
    return;
  }

  // Shoot cannonball toward click
  const angle = Math.atan2(my - ship.y, mx - ship.x);
  const ball = { id: Date.now(), ownerId: socket.id, x: ship.x, y: ship.y, angle, speed: 6 };
  cannonballs.push(ball);
  socket.emit("shoot", ball);
});

let waves = [];
for(let i = 0; i < 40; i++) {
  waves.push({ x: Math.random()*800, y: Math.random()*500, size: Math.random()*20+10, speed: Math.random()*0.5+0.2, phase: Math.random()*Math.PI*2 });
}

let t = 0, tradeMenu = null, message = "", messageTimer = 0, showClanInput = false, clanInput = "";

function getNearIsland() {
  for (let isl of islands) {
    const dx = ship.x - isl.x, dy = ship.y - isl.y;
    if (Math.sqrt(dx*dx+dy*dy) < isl.r+50) return isl;
  }
  return null;
}

function tryTrade() { const isl = getNearIsland(); if (isl) tradeMenu = isl; }

function buyItem(island, item) {
  const price = island.goods[item];
  if (ship.gold >= price) { ship.gold -= price; ship.cargo.push({ item, boughtAt: price }); showMessage("Bought " + item + " for " + price + "g!"); }
  else showMessage("Not enough gold!");
}

function sellItem(island, item) {
  const inCargo = ship.cargo.find(c => c.item === item);
  if (!inCargo) { showMessage("You don't have " + item + "!"); return; }
  const sellPrice = island.goods[item];
  ship.gold += sellPrice;
  ship.cargo = ship.cargo.filter(c => c.item !== item);
  showMessage("Sold " + item + " for " + sellPrice + "g! Profit: " + (sellPrice - inCargo.boughtAt) + "g");
}

function showMessage(msg) { message = msg; messageTimer = 180; }

document.addEventListener("keydown", e => {
  if (showClanInput) {
    if (e.key === "Enter") { ship.clan = clanInput; showClanInput = false; showMessage("Joined clan: " + ship.clan); }
    else if (e.key === "Backspace") clanInput = clanInput.slice(0,-1);
    else if (e.key.length === 1 && clanInput.length < 12) clanInput += e.key;
  }
});

function update() {
  t += 0.02;
  if (!tradeMenu && !showClanInput) {
    if (keys["ArrowUp"] || keys["w"]) { ship.x += Math.cos(ship.angle)*ship.speed; ship.y += Math.sin(ship.angle)*ship.speed; }
    if (keys["ArrowLeft"] || keys["a"]) ship.angle -= 0.05;
    if (keys["ArrowRight"] || keys["d"]) ship.angle += 0.05;
    ship.x = Math.max(20, Math.min(780, ship.x));
    ship.y = Math.max(20, Math.min(480, ship.y));
  }
  if (messageTimer > 0) messageTimer--;

  // Update cannonballs
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    cannonballs[i].x += Math.cos(cannonballs[i].angle) * cannonballs[i].speed;
    cannonballs[i].y += Math.sin(cannonballs[i].angle) * cannonballs[i].speed;
    if (cannonballs[i].x < 0 || cannonballs[i].x > 800 || cannonballs[i].y < 0 || cannonballs[i].y > 500) {
      cannonballs.splice(i, 1);
    }
  }

  socket.emit("move", { x: ship.x, y: ship.y, angle: ship.angle });
}

function drawOcean() {
  ctx.fillStyle = "#1a6fb5";
  ctx.fillRect(0, 0, 800, 500);
  waves.forEach(w => {
    const a = Math.sin(t*w.speed+w.phase)*0.5+0.5;
    ctx.save(); ctx.globalAlpha = 0.15+a*0.2; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w.x-w.size/2, w.y); ctx.quadraticCurveTo(w.x, w.y-6, w.x+w.size/2, w.y); ctx.stroke();
    ctx.restore();
  });
}

function drawIslands() {
  islands.forEach(isl => {
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = "#7ED8FF";
    ctx.beginPath(); ctx.ellipse(isl.x, isl.y+isl.r*0.1, isl.r*1.4, isl.r*0.9, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = isl.color; ctx.beginPath(); ctx.ellipse(isl.x, isl.y, isl.r, isl.r*0.7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#2d8c3c"; ctx.beginPath(); ctx.ellipse(isl.x, isl.y-5, isl.r*0.65, isl.r*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center";
    ctx.fillText(isl.name, isl.x, isl.y+isl.r+14);
    const dx = ship.x-isl.x, dy = ship.y-isl.y;
    if (Math.sqrt(dx*dx+dy*dy) < isl.r+50) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(isl.x-60, isl.y-isl.r-35, 120, 28, 6); ctx.fill();
      ctx.fillStyle = "#FFE47A"; ctx.font = "12px Georgia"; ctx.fillText("Press E to trade!", isl.x, isl.y-isl.r-16);
    }
  });
}

function drawHealthBar(x, y, health) {
  ctx.fillStyle = "#333";
  ctx.fillRect(x - 20, y - 38, 40, 5);
  ctx.fillStyle = health > 50 ? "#2ecc71" : "#e74c3c";
  ctx.fillRect(x - 20, y - 38, 40 * (health/100), 5);
}

function drawShip() {
  // Draw other players
  Object.values(otherPlayers).forEach(p => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-15,-10); ctx.lineTo(-20,0); ctx.lineTo(-15,10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e74c3c"; ctx.beginPath(); ctx.ellipse(0,0,14,8,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#922b21"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.stroke();
    ctx.fillStyle = "#F5F0E0"; ctx.beginPath(); ctx.moveTo(0,-8); ctx.quadraticCurveTo(14,0,0,8); ctx.quadraticCurveTo(-3,0,0,-8); ctx.fill();
    ctx.rotate(-p.angle); ctx.fillStyle = "#fff"; ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
    ctx.fillText(p.name || "Pirate", 0, -28);
    ctx.restore();
    drawHealthBar(p.x, p.y, p.health || 100);
  });

  // Draw your ship
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle);
  ctx.fillStyle = "#8B4513"; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-15,-10); ctx.lineTo(-20,0); ctx.lineTo(-15,10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#A0522D"; ctx.beginPath(); ctx.ellipse(0,0,14,8,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#5C3010"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.stroke();
  ctx.fillStyle = "#F5F0E0"; ctx.beginPath(); ctx.moveTo(0,-8); ctx.quadraticCurveTo(14+Math.sin(t)*2,0,0,8); ctx.quadraticCurveTo(-3,0,0,-8); ctx.fill();
  ctx.rotate(-ship.angle); ctx.fillStyle = "#fff"; ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
  ctx.fillText(ship.clan ? "["+ship.clan+"] "+ship.name : ship.name, 0, -28);
  ctx.restore();
  drawHealthBar(ship.x, ship.y, ship.health);
}

function drawCannonballs() {
  cannonballs.forEach(ball => {
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#444";
    ctx.beginPath(); ctx.arc(ball.x - 1, ball.y - 1, 2, 0, Math.PI*2); ctx.fill();
  });
}

function drawMinimap() {
  const mx = 660, my = 350, mw = 130, mh = 100;
  ctx.fillStyle = "rgba(0,0,30,0.65)"; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 8); ctx.fill();
  ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 8); ctx.stroke();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center"; ctx.fillText("MINIMAP", mx+mw/2, my+12);
  islands.forEach(isl => {
    const ix = mx+(isl.x/800)*mw, iy = my+(isl.y/500)*mh;
    ctx.fillStyle = isl.color; ctx.beginPath(); ctx.arc(ix, iy, 5, 0, Math.PI*2); ctx.fill();
  });
  const px = mx+(ship.x/800)*mw, py = my+(ship.y/500)*mh;
  ctx.fillStyle = "#ff4444"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
}

function drawTradeMenu() {
  if (!tradeMenu) return;
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.beginPath(); ctx.roundRect(200, 100, 400, 300, 12); ctx.fill();
  ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(200, 100, 400, 300, 12); ctx.stroke();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 18px Georgia"; ctx.textAlign = "center"; ctx.fillText(tradeMenu.name+" Market", 400, 135);
  ctx.fillStyle = "#aef"; ctx.font = "13px Georgia"; ctx.fillText("Gold: "+ship.gold, 400, 158);
  Object.keys(tradeMenu.goods).forEach((item, i) => {
    const by = 175+i*60, price = tradeMenu.goods[item], inCargo = ship.cargo.filter(c => c.item===item).length;
    ctx.fillStyle = "#fff"; ctx.font = "14px Georgia"; ctx.textAlign = "left"; ctx.fillText(item+"  "+price+"g  (have: "+inCargo+")", 225, by+20);
    ctx.fillStyle = "#2a9d2a"; ctx.beginPath(); ctx.roundRect(220, by+28, 90, 28, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center"; ctx.fillText("BUY "+price+"g", 265, by+47);
    ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.roundRect(320, by+28, 90, 28, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText("SELL "+price+"g", 365, by+47);
  });
  ctx.fillStyle = "#888"; ctx.font = "11px Georgia"; ctx.textAlign = "center"; ctx.fillText("ESC to close", 400, 385);
}

function drawHUD() {
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(10, 10, 200, 36, 8); ctx.fill();
  ctx.fillStyle = "#FFE47A"; ctx.font = "bold 13px Georgia"; ctx.textAlign = "left"; ctx.fillText("ARGH.IO  |  Gold: "+ship.gold+"g", 20, 33);

  // Health bar
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(10, 54, 150, 20, 6); ctx.fill();
  ctx.fillStyle = ship.health > 50 ? "#2ecc71" : "#e74c3c";
  ctx.beginPath(); ctx.roundRect(10, 54, 150*(ship.health/100), 20, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
  ctx.fillText("HP: "+ship.health, 85, 68);

  ctx.fillStyle = ship.clan ? "#1a6b1a" : "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(10, 80, 110, 24, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "11px Georgia"; ctx.textAlign = "center"; ctx.fillText(ship.clan ? "Clan: "+ship.clan : "[ + Join Clan ]", 65, 96);

  if (showClanInput) {
    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.roundRect(250, 220, 300, 60, 10); ctx.fill();
    ctx.strokeStyle = "#FFE47A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(250, 220, 300, 60, 10); ctx.stroke();
    ctx.fillStyle = "#FFE47A"; ctx.font = "bold 13px Georgia"; ctx.textAlign = "center"; ctx.fillText("Enter clan name:", 400, 242);
    ctx.fillStyle = "#fff"; ctx.font = "15px Georgia"; ctx.fillText(clanInput+"|", 400, 266);
  }

  if (messageTimer > 0) {
    ctx.globalAlpha = Math.min(1, messageTimer/30);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(200, 440, 400, 32, 8); ctx.fill();
    ctx.fillStyle = "#FFE47A"; ctx.font = "13px Georgia"; ctx.textAlign = "center"; ctx.fillText(message, 400, 461);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(10, 460, 280, 28, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "11px Georgia"; ctx.textAlign = "left";
  ctx.fillText("WASD to sail  |  E to trade  |  Click to shoot", 20, 478);
}

function loop() {
  update(); drawOcean(); drawIslands(); drawShip(); drawCannonballs(); drawMinimap(); drawTradeMenu(); drawHUD();
  requestAnimationFrame(loop);
}

loop();
