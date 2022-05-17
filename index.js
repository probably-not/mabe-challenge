const fs = require("fs");
const express = require("express");
const app = express();
const port = +process.argv[2] || 3000;

const client = require("redis").createClient();
client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Example app listening at http://0.0.0.0:${port}`);
  });
});

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCardsKey = "all_cards_set";
const cardsForInsert = cards.map((c) => {
  return JSON.stringify(c);
});

var initializeAllCards = (function () {
  var executed = false;
  return function () {
    if (executed) {
      return;
    }

    console.log("creating all cards set");
    client.SADD(allCardsKey, cardsForInsert);
    console.log("all cards set created");

    executed = true;
  };
})();

async function getMissingCard(key) {
  // Get the cards that the user hasn't seen yet
  const unseenCard = await client.EVAL(
    `
    local unseen = redis.call('sdiff', KEYS[1], KEYS[2])
    if #unseen == 0 then
      return nil
    end

    local res = redis.call('sadd', KEYS[2], 0, unseen[1])
    if res == 0 then
      return nil
    end
  
    return unseen[1]
    `,
    { keys: [allCardsKey, key] }
  );

  return unseenCard;
}

app.get("/card_add", async (req, res) => {
  initializeAllCards(); // Needs to run when requests are live so that it doesn't get flushed by the tester
  const key = "user_id:" + req.query.id;
  unseenCard = await getMissingCard(key);

  // ALL CARDS is sent when all cards have been given to the user
  if (!unseenCard) {
    res.send({ id: "ALL CARDS" });
    return;
  }

  res.send(unseenCard);
});

app.get("/ready", async (req, res) => {
  res.send({ ready: true });
});

client.connect();
