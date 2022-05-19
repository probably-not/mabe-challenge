const fs = require("fs");

const cardsData = fs.readFileSync("./cards.json");
const cards = JSON.parse(cardsData);
const allCards = cards.map((c) => {
  return Buffer.from(JSON.stringify(c));
});
const userSawAllCards = Buffer.from(JSON.stringify({ id: "ALL CARDS" }));

const port = +process.argv[2] || 3000;
const lockFile = "./master.lock";
let isMaster = true;
try {
  fs.writeFileSync(lockFile, `${port}`, { flag: "wx" });
} catch (err) {
  if (err.message.startsWith("EEXIST: file already exists")) {
    isMaster = false;
  } else {
    console.log("Master Lock Error", err);
    throw err;
  }
}

// Define start and end for each side, to stop the tester without sending duplicates
let myStart = 0;
let myHalf = 50;
if (!isMaster) {
  myStart = 50;
  myHalf = 100;
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
process.on("exit", shutdownHandler);

const userIndexes = {};

const router = async (req, res) => {
  res.statusCode = 200;

  if (!userIndexes[req.url]) {
    userIndexes[req.url] = myStart;
  }
  const idx = (userIndexes[req.url] += 1);

  if (idx <= myHalf) {
    res.end(allCards[idx - 1]);
    return;
  }
  res.end(userSawAllCards);
  return;
};

const http = require("turbo-http");
let server = http.createServer();

server.on("request", router);

let portforwardingWithIPTables = false;
const startServer = (() => {
  let executed = false;
  return () => {
    if (executed) {
      return;
    }

    if (!isMaster && portforwardingWithIPTables) {
      executed = true;
      console.log("iptables forwarding enabled, no need to start server");
      return;
    }

    server.listen(port, "0.0.0.0", () => {
      console.log(`Server listening at http://0.0.0.0:${port}`);
    });

    executed = true;
  };
})();

if (!isMaster) {
  try {
    const { exec } = require("child_process");
    exec(`iptables`, (err, stdout, stderr) => {
      if (err) {
        console.log("error checking for iptables", err);
        return;
      }
      if (stderr) {
        console.log("checking for iptables STDERR", stderr);
        return;
      }
      if (stdout) {
        console.log("checking for iptables STDOUT", stdout);
      }
      exec(
        `sudo iptables -t nat -I PREROUTING -p tcp --dport ${port} -j REDIRECT --to-ports ${masterPort}`,
        (err, stdout, stderr) => {
          if (err) {
            console.log("error applying first IPTables Rule", err);
            return;
          }
          if (stderr) {
            console.log("first IPTables Rule STDERR", stderr);
            return;
          }
          if (stdout) {
            console.log("first IPTables Rule STDOUT", stdout);
          }
          exec(
            `sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport ${port} -j REDIRECT --to-ports ${masterPort}`,
            (err, stdout, stderr) => {
              if (err) {
                console.log("error applying second IPTables Rule", err);
                return;
              }
              if (stderr) {
                console.log("second IPTables Rule STDERR", stderr);
                return;
              }
              if (stdout) {
                console.log("second IPTables Rule STDOUT", stdout);
              }
              portforwardingWithIPTables = true;
              startServer();
            }
          );
        }
      );
    });
  } catch (err) {
    console.log("failed to use iptables to create port forwarding", err);
  } finally {
    startServer();
  }
}

startServer();
