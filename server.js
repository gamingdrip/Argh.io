const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const players = {};
const cannonballs = [];

io.on("connection", (socket) => {
  console.log("A pirate joined! ID: " + socket.id);

  players[socket.id] = {
    x: 400, y: 250, angle: 0,
    name: "Pirate", clan: "", gold: 200, health: 100
  };

  socket.emit("currentPlayers", players);
  socket.broadcast.emit("newPlayer", { id: socket.id, ...players[socket.id] });

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      socket.broadcast.emit("playerMoved", { id: socket.id, ...players[socket.id] });
    }
  });

  socket.on("shoot", (data) => {
    const ball = {
      id: Date.now() + Math.random(),
      ownerId: socket.id,
      x: data.x, y: data.y,
      angle: data.angle,
      speed: 6
    };
    cannonballs.push(ball);
    io.emit("cannonball", ball);
  });

  socket.on("disconnect", () => {
    console.log("A pirate left! ID: " + socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

setInterval(() => {
  cannonballs.forEach((ball, i) => {
    ball.x += Math.cos(ball.angle) * ball.speed;
    ball.y += Math.sin(ball.angle) * ball.speed;

    Object.keys(players).forEach(id => {
      if (id === ball.ownerId) return;
      const dx = players[id].x - ball.x;
      const dy = players[id].y - ball.y;
      if (Math.sqrt(dx*dx + dy*dy) < 20) {
        players[id].health -= 20;
        io.emit("playerHit", { id, health: players[id].health });
        cannonballs.splice(i, 1);
        if (players[id].health <= 0) {
          players[id].health = 100;
          players[id].x = Math.random() * 600 + 100;
          players[id].y = Math.random() * 400 + 50;
          io.emit("playerRespawn", { id, x: players[id].x, y: players[id].y });
        }
      }
    });

    if (ball.x < 0 || ball.x > 800 || ball.y < 0 || ball.y > 500) {
      cannonballs.splice(i, 1);
    }
  });
}, 1000 / 60);

server.listen(3000, () => {
  console.log("Argh.io server running at http://localhost:3000");
});
