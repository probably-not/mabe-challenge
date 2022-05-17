const fs = require("fs");
const port = +process.argv[2] || 3000;

const portmap = { 4001: 4002, 4002: 4001, 3000: 3001 };
const oppositePort = portmap[port];

let isMaster = true;
fs.writeFile("./master.lock", `${port}`, { flag: "wx" }, function (err) {
  if (err) {
    console.log("File write error", err);
    isMaster = false;
    return;
  }
  isMaster = true;
});

const shutdownHandler = (signal) => {
  console.log("starting shutdown, got signal " + signal);
  if (isMaster) {
    fs.unlinkSync("./master.lock");
  }
  process.exit(0);
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const userCards = {};

const getUnseenCard = async function (userId) {
  // Get the cards that the user hasn't seen yet

  // First time seeing the user
  if (!userCards[userId]) {
    const firstCard = allCards[0];
    userCards[userId] = new Set([firstCard]);
    return firstCard;
  }

  // User already exists
  const difference = allCards.filter((c) => !userCards[userId].has(c));
  if (difference && difference.length > 0) {
    const nextCard = difference[0];
    userCards[userId].add(nextCard);
    return nextCard;
  }

  return undefined;
};

const cardHandler = async (req, res, userId) => {
  const key = "user_id:" + userId;
  unseenCard = await getUnseenCard(key);

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

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});
