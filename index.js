const fs = require("fs");
const crypto = require("crypto");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return JSON.stringify(c);
});

const userIndexes = {};

const INCR = (userId) => {
  // Get the next index of the card that the user hasn't seen yet
  if (!userIndexes[userId]) {
    // Init
    userIndexes[userId] = 0;
  }

  userIndexes[userId]++;
  return userIndexes[userId];
};

const port = +process.argv[2] || 3000;
let isMaster = true;

const turbo = require("turbo-net");
const tcpServer = turbo.createServer(function (socket) {
  socket.read(Buffer.alloc(32 * 1024), function onread(err, buf, _read) {
    if (err) {
      console.log("Socket Read Error", err);
      return;
    }

    const data = buf.toString();
    const userId = data.split("\n")[0];
    userUnseenCardIdx = INCR(userId);
    const out = Buffer.from(userUnseenCardIdx.toString(), "utf8");

    socket.write(out, out.length, function (err) {
      if (err) {
        console.log("Socket Write Error", err);
        return;
      }
      socket.read(buf, onread);
    });
  });
});

let tcpSocket;

const initializeTCP = (() => {
  var executed = false;
  return async function () {
    if (executed) {
      return;
    }

    await connectServerAndClient();
    executed = true;
  };
})();

const initializeIsMaster = (function () {
  var executed = false;
  return async function () {
    if (executed) {
      return;
    }

    const applied = await client.SETNX("is_master_mark", "1");
    isMaster = applied;
    executed = true;
  };
})();

const getUnseenCardIdxFromMaster = async (userId) => {
  return await readFromConnectionWrapper(userId);
};

const connectServerAndClient = () => {
  return new Promise((resolve, reject) => {
    if (isMaster) {
      tcpServer.listen(8080, function () {
        console.log(`TCP Server listening at http://0.0.0.0:8080`);
      });
      tcpServer.on("listening", () => {
        resolve(true);
      });
      return;
    }

    tcpSocket = turbo.connect(8080);
    tcpSocket.on("connect", () => {
      console.log(`TCP Client connected to http://0.0.0.0:8080`);
      resolve(true);
    });
  });
};

const readFromConnectionWrapper = (userId) => {
  return new Promise((resolve, reject) => {
    tcpSocket.write(Buffer.from(userId + "\n"));
    tcpSocket.read(Buffer.alloc(10), (err, buf, _read) => {
      if (err) {
        console.log("Client Socket Read Error", err);
        reject(err);
        return;
      }

      const data = buf.toString();
      const parsed = parseInt(data, 10);
      resolve(parsed);
    });
  });
};

const getUnseenCard = async (userId) => {
  if (isMaster) {
    const idx = INCR(userId);
    if (idx <= allCards.length) {
      return allCards[idx - 1];
    }
    return undefined;
  }

  const idx = await getUnseenCardIdxFromMaster(userId);
  if (!idx) {
    return undefined;
  }

  if (idx <= allCards.length) {
    return allCards[idx - 1];
  }
  return undefined;
};

const cardHandler = async (req, res, userId) => {
  unseenCard = await getUnseenCard(userId);

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

const router = async (req, res) => {
  if (req.url.startsWith("/card_add?")) {
    await initializeIsMaster(); // Needs to run when requests are live so that it doesn't get flushed by the tester
    await initializeTCP(); // Needs to run when requests are live so that it doesn't get flushed by the tester
    const userId = req.url.split("?id=")[1];
    await cardHandler(req, res, userId);
    return;
  }

  res.statusCode = 200;
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
