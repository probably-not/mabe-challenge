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

async function getMissingCard(key) {
  // Get the cards that the user has already seen
  const userCards = await client.zRange(key, 0, -1);
  let allCards = [...cards];

  // Remove each card that the user has already seen
  userCards.forEach((userCard, idx) => {
    allCards = allCards.filter(function (value, index, arr) {
      return JSON.parse(userCard).id !== value.id;
    });
  });

  // Return one of the cards left
  return allCards.pop();
}

app.get("/card_add", async (req, res) => {
  const key = "user_id:" + req.query.id;
  let missingCard = "";

  while (true) {
    missingCard = await getMissingCard(key);

    // ALL CARDS is sent when all cards have been given to the user
    if (missingCard === undefined) {
      res.send({ id: "ALL CARDS" });
      return;
    }

    // Try to acquire the card so we can send it
    result = await client.ZADD(
      key,
      { score: 0, value: JSON.stringify(missingCard) },
      "NX"
    );

    // If we couldn't acquire it, then someone else has already shown that use this card, so we try another card.
    if (result === 0) {
      continue;
    }

    break;
  }

  res.send(missingCard);
});

app.get("/ready", async (req, res) => {
  res.send({ ready: true });
});

client.connect();
