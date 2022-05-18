const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return Buffer.from(JSON.stringify(c));
});
const allCardsLength = allCards.length;
const userSawAllCards = Buffer.from(JSON.stringify({ id: "ALL CARDS" }));

const port = +process.argv[2] || 3000;
const lockFile = "./master.lock";
let isMaster = true;
try {
  fs.writeFileSync(lockFile, `${port}`, { flag: "wx" });
} catch (err) {
  console.log("Master Lock Error", err);
  isMaster = false;
}

let masterPort;
if (!isMaster) {
  masterPortStr = fs.readFileSync(lockFile, "utf8");
  masterPort = parseInt(masterPortStr, 10);
  fs.unlinkSync(lockFile);
}

const shutdownHandler = (signal) => {
  console.log("starting shutdown, got signal " + signal);
  if (isMaster) {
    try {
      fs.unlinkSync(lockFile);
    } catch (err) {
      console.log(
        "failed to delete lockfile probably because it's already been deleted",
        err
      );
    }
  }
  process.exit(0);
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

const net = require("net");
const stream = require("stream");
const turbo = require("turbo-net");
const forwarder = turbo.createServer(function (socket) {
  socket.read(Buffer.alloc(32 * 1024), function onread(err, buf, _read) {
    if (err) {
      console.log("Socket read error", err);
    }

    const to = net.createConnection({
      host: "0.0.0.0",
      port: masterPort,
    });

    const from = stream.Duplex.from(buf);
    from.pipe(to);
    to.pipe(from);
  });
});

const http = require("turbo-http");
server = http.createServer();

if (!isMaster) {
  console.log(`Forwarding from ${port} to ${masterPort}`);
  server = forwarder;
}

const client = require("redis").createClient();

client.on("error", (err) => console.log("Redis Client Error", err));

client.on("ready", () => {
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

  return (userIndexes[userId] += 1);
};

const router = async (req, res) => {
  res.statusCode = 200;

  if (req.url.startsWith("/card_add?")) {
    const userId = req.url.split("?id=")[1];
    const idx = INCR(userId);
    if (idx <= allCardsLength) {
      res.end(allCards[idx - 1]);
      return;
    }
    res.end(userSawAllCards);
    return;
  }

  res.end(JSON.stringify({ ready: true }));
};

server.on("request", router);
client.connect();
