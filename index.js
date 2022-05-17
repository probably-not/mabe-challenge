const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCardsKey = "all_cards_set";
const cardsForInsert = cards.map((c) => {
  return JSON.stringify(c);
});

const crypto = require("crypto");
const getSHA1 = function (input) {
  return crypto.createHash("sha1").update(input).digest("hex");
};

const atomicDiffLua = `
local unseen = redis.call('sdiff', KEYS[1], KEYS[2])
if #unseen == 0 then
  return nil
end

local res = redis.call('sadd', KEYS[2], 0, unseen[1])
if res == 0 then
  return nil
end

return unseen[1]
`;

const atomicDiffSha1 = getSHA1(atomicDiffLua);

const initializeAllCards = (function () {
  var executed = false;
  return async function () {
    if (executed) {
      return;
    }

    await Promise.all([
      client.SADD(allCardsKey, cardsForInsert),
      client.SCRIPT_LOAD(atomicDiffLua),
    ]);
    executed = true;
  };
})();

const getUnseenCard = async function (key) {
  // Get the cards that the user hasn't seen yet
  const unseenCard = await client.EVALSHA(atomicDiffSha1, {
    keys: [allCardsKey, key],
  });

  return unseenCard ? unseenCard.toString() : undefined;
};

const cardHandler = async (req, res, userId) => {
  await initializeAllCards(); // Needs to run when requests are live so that it doesn't get flushed by the tester
  const key = "user_id:" + userId;
  unseenCard = await getUnseenCard(key);

  // ALL CARDS is sent when all cards have been given to the user
  if (!unseenCard) {
    res.writeHead(200);
    res.end(JSON.stringify({ id: "ALL CARDS" }));
    return;
  }

  res.writeHead(200);
  res.end(unseenCard);
};

const http = require("http");
server = http.createServer();
const port = +process.argv[2] || 3000;
const baseUrl = `http://0.0.0.0:${port}`;

const router = async (req, res) => {
  parsed = new URL(req.url, baseUrl);
  if (parsed.pathname === "/card_add") {
    await cardHandler(req, res, parsed.searchParams.get("id"));
    return;
  }

  res.writeHead(200);
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
