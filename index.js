const fs = require("fs");
const port = +process.argv[2] || 3000;

const portmap = { 4001: 4002, 4002: 4001 };
const oppositePort = portmap[port];
let singleMode = false;
if (!oppositePort) {
  singleMode = true;
}

let isMaster = true;

const namedPipe = require("named-pipe");
if (isMaster) {
  namedPipe.mkfifoSync(`./${port}`);
  namedPipe.mkfifoSync(`./${oppositePort}`);
}

const wstream = fs.createWriteStream(`./${oppositePort}`);

const userChannel = {};
const net = require("net");
fs.open(
  `./${port}`,
  fs.constants.O_RDONLY | fs.constants.O_NONBLOCK,
  (err, fd) => {
    // Handle err
    if (err) {
      throw err;
    }
    const pipe = new net.Socket({ fd });
    // Now `pipe` is a stream that can be used for reading from the FIFO.
    pipe.on("data", (buf) => {
      data = buf.toString();
      if (isMaster) {
        const userId = data;
        const card = getUnseenCardInMemory(userId);
        wstream.write(JSON.stringify({ userId: userId, card: card }));
        return;
      }

      const { userId: userId, card: card } = JSON.parse(data);
      if (!userChannel[userId]) {
        userChannel[userId] = [card];
        return;
      }
      userChannel[userId].push(card);
    });
  }
);

const shutdownHandler = (signal) => {
  if (isMaster) {
    console.log("starting shutdown, got signal " + signal);
    console.log("erasing FIFO pipe");
    fs.unlinkSync(`./${port}`);
    fs.unlinkSync(`./${oppositePort}`);
    fs.unlinkSync(`./-m`);
    fs.unlinkSync(`./644`);
  }
  process.exit(0);
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const userCards = {};

const getUnseenCardInMemory = (userId) => {
  // First time seeing the user
  if (!userCards[userId]) {
    const firstCard = allCards[0];
    userCards[userId] = new Set([firstCard]);
    return firstCard;
  }

  // User already exists
  const difference = allCards.filter((c) => !userCards[userId].has(c));
  if (difference && difference.length > 0) {
    const nextCard = difference[0];
    userCards[userId].add(nextCard);
    return nextCard;
  }

  return null;
};

const getUnseenCard = (userId) => {
  if (isMaster) {
    return getUnseenCardInMemory(userId);
  }

  wstream.write(userId);
  const card = userChannel[userId].pop();
  return card;
};

const cardHandler = async (req, res, userId) => {
  const unseenCard = getUnseenCard(userId);

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

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});
