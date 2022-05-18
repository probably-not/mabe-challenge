const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const completedUsers = {};
const allCardsForID = JSON.stringify({ id: "ALL CARDS" });

const getUnseenCard = function (userId, res) {
  // Early exit if completed
  if (completedUsers[userId]) {
    res.statusCode = 200;
    res.end(allCardsForID);
    return;
  }

  // Get the next index of the card that the user hasn't seen yet
  client.incr(userId, (err, idx) => {
    if (err) {
      console.log("Redis INCR Error", err);
      return;
    }
    if (idx <= allCards.length) {
      res.statusCode = 200;
      res.end(allCards[idx - 1]);
      return;
    }

    completedUsers[userId] = true;
    res.statusCode = 200;
    res.end(allCardsForID);
  });
};

const http = require("turbo-http");
server = http.createServer();
const port = +process.argv[2] || 3000;
const baseUrl = `http://0.0.0.0:${port}`;

const router = async (req, res) => {
  if (req.url.startsWith("/card_add?")) {
    const userId = req.url.split("?id=")[1];
    getUnseenCard(userId, res);
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ready: true }));
};

server.on("request", router);
const Redis = require("ioredis");
const client = new Redis({ enableAutoPipelining: true });
client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
  });
});
