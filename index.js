const fs = require("fs");
const port = +process.argv[2] || 3000;

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

const cluster = require("cluster");
const totalCPUs = require("os").cpus().length;

if (cluster.isMaster) {
  console.log(`Number of CPUs is ${totalCPUs}`);
  console.log(`Master ${process.pid} is running`);

  for (let i = 0; i < totalCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    console.log("Let's fork another worker!");
    cluster.fork();
  });
} else {
  const express = require("express");
  const app = express();

  const client = require("redis").createClient();
  client.on("error", (err) => console.log("Redis Client Error", err));

  client.on("ready", () => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Example app listening at http://0.0.0.0:${port}`);
    });
  });

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

  app.get("/card_add", async (req, res) => {
    await initializeAllCards(); // Needs to run when requests are live so that it doesn't get flushed by the tester
    const key = "user_id:" + req.query.id;
    unseenCard = await getUnseenCard(key);

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
}
