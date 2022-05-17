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
const allCardsKey = "all_cards_zset";

var initializeAllCards = (function () {
  var executed = false;
  return function () {
    if (executed) {
      return;
    }

    console.log("creating all cards zset");
    cards.forEach((card) => {
      client.ZADD(allCardsKey, {
        score: 0,
        value: JSON.stringify(card),
      });
    });
    console.log("all cards zset created");

    executed = true;
  };
})();

async function getMissingCard(key) {
  // Get the cards that the user hasn't seen yet
  const unseenCards = await client.ZDIFF([allCardsKey, key]);
  return unseenCards;
}

app.get("/card_add", async (req, res) => {
  initializeAllCards(); // Needs to run when requests are live so that it doesn't get flushed by the tester

  const key = "user_id:" + req.query.id;
  let missingCard = "";

  unseenCards = await getMissingCard(key);

  // ALL CARDS is sent when all cards have been given to the user
  if (!unseenCards || unseenCards.length === 0) {
    res.send({ id: "ALL CARDS" });
    return;
  }

  for (let index = 0; index < unseenCards.length; index++) {
    const tryCard = unseenCards[index];
    // Try to acquire the card so we can send it
    result = await client.ZADD(key, { score: 0, value: tryCard }, "NX");

    // If we couldn't acquire it, then someone else has already shown that use this card, so we try another card.
    if (result === 0) {
      continue;
    }
    missingCard = tryCard;
    break;
  }

  if (missingCard === "") {
    res.send({ id: "ALL CARDS" });
    return;
  }

  res.send(missingCard);
});

app.get("/ready", async (req, res) => {
  res.send({ ready: true });
});

client.connect();
