const fs = require("fs");
const crypto = require("crypto");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const port = +process.argv[2] || 3000;
let isMaster = true;

const initializeIsMaster = (function () {
  var executed = false;
  return async function () {
    if (executed) {
      return;
    }

    const applied = await client.SETNX("is_master_mark", "1");
    isMaster = applied;
    console.log("am i master?", port, isMaster);
    executed = true;
  };
})();

const userIndexes = {};

const getUnseenCard = async function (key) {
  // Get the next index of the card that the user hasn't seen yet
  if (!userIndexes[key]) {
    // Init
    userIndexes[key] = 0;
  }

  // INCR
  userIndexes[key]++;

  const idx = userIndexes[key];
  if (idx <= allCards.length) {
    return allCards[idx - 1];
  }
  completedUsers[userId] = true;
  return undefined;
};

const cardHandler = async (req, res, userId) => {
  // const reqid = crypto.randomUUID();
  // console.time(`${reqid} get unseen card`);
  unseenCard = await getUnseenCard(userId);
  // console.timeEnd(`${reqid} get unseen card`);

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
  await initializeIsMaster(); // Needs to run when requests are live so that it doesn't get flushed by the tester

  if (req.url.startsWith("/card_add?")) {
    const userId = req.url.split("?id=")[1];
    await cardHandler(req, res, userId);
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ready: true }));
};

server.on("request", router);
const client = require("redis").createClient();
client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
  });
});

client.connect();
