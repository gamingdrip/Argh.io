const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const players = {};
const cannonballs = [];
let chests = [];

function spawnChests() {
  chests = [];
  for (var i = 0; i < 15; i++) {
    chests.push({
      id: i,
      x: Math.random() * 2200 + 100,
      y: Math.random() * 1600 + 100,
      gold: Math.floor(Math.random() * 80) + 20,
      taken: false
    });
  }
}
spawnChests();

io.on("connection", function(socket) {
  socket.on("join", function(data) {
    players[socket.id] = {
      x: Math.random() * 600 + 100,
      y: Math.random() * 300 + 100,
      angle: 0,
      name: data.name || "Pirate",
      clan: "",
      gold: 200,
      health: 100,
      shipColor: data.shipColor || "#8B4513"
    };
    socket.emit("currentPlayers", players);
    socket.emit("chestsUpdate", chests);
    socket.broadcast.emit("newPlayer", Object.assign({ id: socket.id }, players[socket.id]));
  });

  socket.on("move", function(data) {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      players[socket.id].gold = data.gold;
      socket.broadcast.emit("playerMoved", Object.assign({ id: socket.id }, players[socket.id]));
    }
  });

  socket.on("collectChest", function(chestId) {
    var chest = chests.find(function(c) { return c.id === chestId && !c.taken; });
    if (chest && players[socket.id]) {
      chest.taken = true;
      players[socket.id].gold += chest.gold;
      io.emit("chestCollected", { chestId: chestId, playerId: socket.id, gold: chest.gold });
      setTimeout(function() {
        chest.x = Math.random() * 2200 + 100;
        chest.y = Math.random() * 1600 + 100;
        chest.gold = Math.floor(Math.random() * 80) + 20;
        chest.taken = false;
        io.emit("chestsUpdate", chests);
      }, 10000);
    }
  });

  socket.on("shoot", function(data) {
    var ball = { id: Date.now(), ownerId: socket.id, x: data.x, y: data.y, angle: data.angle, speed: 6 };
    cannonballs.push(ball);
    io.emit("cannonball", ball);
  });

  socket.on("disconnect", function() {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

setInterval(function() {
  var leaderboard = Object.values(players)
    .sort(function(a, b) { return b.gold - a.gold; })
    .slice(0, 5)
    .map(function(p) { return { name: p.name, gold: p.gold }; });
  io.emit("leaderboard", leaderboard);

  for (var i = cannonballs.length - 1; i >= 0; i--) {
    var ball = cannonballs[i];
    ball.x += Math.cos(ball.angle) * ball.speed;
    ball.y += Math.sin(ball.angle) * ball.speed;
    Object.keys(players).forEach(function(id) {
      if (id === ball.ownerId) return;
      var dx = players[id].x - ball.x;
      var dy = players[id].y - ball.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        players[id].health -= 20;
        io.emit("playerHit", { id: id, health: players[id].health });
        cannonballs.splice(i, 1);
        if (players[id].health <= 0) {
          players[id].health = 100;
          players[id].x = Math.random() * 600 + 100;
          players[id].y = Math.random() * 400 + 50;
          io.emit("playerRespawn", { id: id, x: players[id].x, y: players[id].y });
        }
      }
    });
    if (ball.x < 0 || ball.x > 2400 || ball.y < 0 || ball.y > 1800) cannonballs.splice(i, 1);
  }
}, 2000);

server.listen(3000, function() {
  console.log("Argh.io server running at http://localhost:3000");
});
