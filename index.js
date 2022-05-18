const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

let isMaster = true;
try {
  fs.writeFileSync("./master.lock", "1", { flag: "wx" });
} catch (err) {
  console.log("Master Lock Error", err);
  isMaster = false;
}

const shutdownHandler = (signal) => {
  console.log("starting shutdown, got signal " + signal);
  if (isMaster) {
    fs.unlinkSync("./master.lock");
  }
  process.exit(0);
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

const port = +process.argv[2] || 3000;
const portmapping = { 4001: 4002, 4002: 4001 };
const oppositePort = portmapping[port];
const isSingleton = !oppositePort;

const net = require("net");
const forwarder = net.createServer(function (from) {
  const to = net.createConnection({
    host: "0.0.0.0",
    port: oppositePort,
  });
  from.pipe(to);
  to.pipe(from);
});

const http = require("turbo-http");
server = http.createServer();

if (!isMaster && !isSingleton) {
  console.log(`Forwarding from ${port} to ${oppositePort}`);
  server = forwarder;
}

const client = require("redis").createClient();

client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
  });
});

const userIndexes = {};

const INCR = (userId) => {
  // Get the next index of the card that the user hasn't seen yet
  if (!userIndexes[userId]) {
    // Init
    userIndexes[userId] = 0;
  }

  userIndexes[userId]++;
  return userIndexes[userId];
};

const getUnseenCard = async (userId) => {
  const idx = INCR(userId);
  if (idx <= allCards.length) {
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
client.connect();
