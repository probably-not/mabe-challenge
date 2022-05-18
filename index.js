const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const client = require("redis").createClient();

const getUnseenCard = async function (key) {
  // Get the next index of the card that the user hasn't seen yet
  const idx = await client.INCR(key);
  if (idx <= allCards.length) {
    return allCards[idx - 1];
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
