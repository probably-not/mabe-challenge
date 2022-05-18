const fs = require("fs");
const crypto = require("crypto");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const getUnseenCard = async function (userId) {
  // Get the next index of the card that the user hasn't seen yet
  const idx = await client.INCR(userId);
  if (idx <= allCards.length) {
    return allCards[idx - 1];
  }

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
const client = require("redis").createClient();
client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
  });
});

client.connect();
