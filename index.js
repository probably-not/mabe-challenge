const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const http = require("turbo-http");
server = http.createServer();

const client = require("redis").createClient();
const subscriber = client.duplicate();

client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  subscriber.connect();
  console.log("connecting to subscriber");
});

subscriber.on("error", (err) =>
  console.log("Redis Subscriber Client Error", err)
);

subscriber.on("ready", () => {
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

const port = +process.argv[2] || 3000;
let isMaster = true;

const initializeIsMaster = (function () {
  var executed = false;
  return async function () {
    if (executed) {
      return;
    }

    const applied = await client.SETNX("is_master_mark", `${port}`);
    isMaster = applied;

    executed = true;
    if (isMaster) {
      await subscriber.subscribe("requested_users", (userId) => {
        const idx = INCR(userId);
        client.RPUSH("user_id:" + userId, idx.toString());
      });
    }
  };
})();

const getUnseenCardIdxFromMaster = async (userId) => {
  await client.publish("requested_users", userId);
  const res = await client.BRPOP("user_id:" + userId, 0);
  return parseInt(res.element, 10);
};

const getUnseenCard = async (userId) => {
  if (isMaster) {
    const idx = INCR(userId);
    if (idx <= allCards.length) {
      return allCards[idx - 1];
    }
    return undefined;
  }

  const idx = await getUnseenCardIdxFromMaster(userId);
  if (!idx) {
    return undefined;
  }

  if (idx <= allCards.length) {
    return allCards[idx - 1];
  }
  return undefined;
};

const cardHandler = async (req, res, userId) => {
  console.log("Master", isMaster, "received request");
  unseenCard = await getUnseenCard(userId);

  // ALL CARDS is sent when all cards have been given to the user
  if (!unseenCard) {
    res.statusCode = 200;
    res.end(JSON.stringify({ id: "ALL CARDS" }));
    return;
  }

  res.statusCode = 200;
  res.end(unseenCard);
  console.log("Master", isMaster, "completed request");
};

const router = async (req, res) => {
  if (req.url.startsWith("/card_add?")) {
    await initializeIsMaster(); // Needs to run when requests are live so that it doesn't get flushed by the tester
    const userId = req.url.split("?id=")[1];
    await cardHandler(req, res, userId);
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ready: true }));
};

server.on("request", router);
client.connect();
