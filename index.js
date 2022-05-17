const fs = require("fs");
const express = require("express");
const port = +process.argv[2] || 3000;

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCardsKey = "all_cards_zset";
const cardsForInsert = cards
  .map((c) => {
    return [0, JSON.stringify(c)];
  })
  .flat(1);

const cluster = require("cluster");
const totalCPUs = require("os").cpus().length;

if (cluster.isMaster) {
  console.log(`Number of CPUs is ${totalCPUs}`);
  console.log(`Master ${process.pid} is running`);

  // Fork workers to half the available CPUs
  for (let i = 0; i < totalCPUs / 2; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    console.log("Let's fork another worker!");
    cluster.fork();
  });
} else {
  const app = express();

  var initializeAllCards = (function () {
    var executed = false;
    return function () {
      if (executed) {
        return;
      }

      console.log("creating all cards zset");
      client.zadd(allCardsKey, ...cardsForInsert);
      console.log("all cards zset created");

      executed = true;
    };
  })();

  async function getMissingCard(key) {
    // Get the cards that the user hasn't seen yet
    const unseenCard = await client.eval(
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
      2,
      allCardsKey,
      key
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

  const Redis = require("ioredis");
  const client = new Redis({ enableAutoPipelining: true });

  client.on("error", (err) => console.log("Redis Client Error", err));

  client.on("ready", () => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Example app listening at http://0.0.0.0:${port}`);
    });
  });
}
