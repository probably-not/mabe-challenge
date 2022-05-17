const fs = require("fs");
const polkadot = require("polkadot");
const port = +process.argv[2] || 3000;

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCardsKey = "all_cards_zset";
const cardsForInsert = cards.map((c) => {
  return { score: 0, value: JSON.stringify(c) };
});

var initializeAllCards = (function () {
  var executed = false;
  return function () {
    if (executed) {
      return;
    }

    console.log("creating all cards zset");
    client.ZADD(allCardsKey, cardsForInsert);
    console.log("all cards zset created");

    executed = true;
  };
})();

async function getMissingCard(key) {
  // Get the cards that the user hasn't seen yet
  const unseenCard = await client.EVAL(
    `
    local unseen = redis.call('zdiff', 2, KEYS[1], KEYS[2])
    if #unseen == 0 then
      return nil
    end

    local res = redis.call('zadd', KEYS[2], 0, unseen[1])
    if res == 0 then
      return nil
    end
  
    return unseen[1]
    `,
    { keys: [allCardsKey, key] }
  );

  return unseenCard;
}

const app = polkadot(async (req, res) => {
  if (req.path === "/ready") {
    res.statusCode = 200;
    res.end(JSON.stringify({ ready: true }));
    return;
  }

  if (req.path === "/card_add") {
    initializeAllCards(); // Needs to run when requests are live so that it doesn't get flushed by the tester
    const key = "user_id:" + req.query.id;
    unseenCard = await getMissingCard(key);

    // ALL CARDS is sent when all cards have been given to the user
    if (!unseenCard) {
      res.statusCode = 200;
      res.end(JSON.stringify({ id: "ALL CARDS" }));
      return;
    }

    res.statusCode = 200;
    res.end(unseenCard);
  }
});

const client = require("redis").createClient();
client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Example app listening at http://0.0.0.0:${port}`);
  });
});

client.connect();
