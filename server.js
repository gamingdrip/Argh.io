const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const players = {};

io.on("connection", (socket) => {
  console.log("A pirate joined! ID: " + socket.id);

  players[socket.id] = {
    x: 400, y: 250, angle: 0,
    name: "Pirate", clan: "", gold: 200
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

  socket.on("disconnect", () => {
    console.log("A pirate left! ID: " + socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Argh.io server running at http://localhost:3000");
});