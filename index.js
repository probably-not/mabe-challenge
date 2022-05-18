const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const client = require("redis").createClient();

const userIndexes = {};
const portmap = { 4001: [4002, 0, 50], 4002: [4001, 50, 99] };
const [oppositePort, baseIdx, maxIdx] = portmap[port] || [3000, 0, 100];
const [_myPort, _oppositeBaseIdx, oppositeMaxIdx] = portmap[port] || [
  3000, 0, 99,
];
console.log(oppositePort, baseIdx, maxIdx, oppositeMaxIdx);

const INCR = (userId) => {
  // Get the next index of the card that the user hasn't seen yet
  if (!userIndexes[userId]) {
    // Init
    userIndexes[userId] = baseIdx;
  }

  userIndexes[userId]++;
  return userIndexes[userId];
};

const getUnseenCard = async function (userId) {
  // Get the next index of the card that the user hasn't seen yet
  const idx = INCR(userId);

  // If we're within our owned indices we return it from memory
  if (idx - 1 < maxIdx) {
    client.INCR(`${port}:${userId}`); // No await so we don't block?
    return allCards[idx - 1];
  }

  return undefined;
};

const cardHandler = async (req, res, userId) => {
  unseenCard = await getUnseenCard(userId);

  // ALL CARDS is sent when all cards have been given to the user
  if (!unseenCard) {
    res.statusCode = 200;
    res.end(JSON.stringify({ id: "ALL CARDS" }));
    return;
  }

  res.statusCode = 200;
  res.end(unseenCard);
};

const http = require("turbo-http");
server = http.createServer();
const port = +process.argv[2] || 3000;
const baseUrl = `http://0.0.0.0:${port}`;

const router = async (req, res) => {
  if (req.url.startsWith("/card_add?")) {
    const userId = req.url.split("?id=")[1];
    await cardHandler(req, res, userId);
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ready: true }));
};

server.on("request", router);
client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
  });
});

client.connect();
