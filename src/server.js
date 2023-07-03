"use strict";

const { PeerRPCServer } = require("grenache-nodejs-http");
const Link = require("grenache-nodejs-link");
const OrderBook = require("./orderBook");
const LockManager = require("../lockmanager");
const d = require("debug")("bfx:client");
const debug = (...args) => d(`${new Date().toISOString()}:`, ...args);

const networkIp = "127.0.0.1";
const link = new Link({
  grape: `http://${networkIp}:30001`
});
link.start();

const peerServer = new PeerRPCServer(link, { timeout: 300000 });
peerServer.init();

const port = 1024 + Math.floor(Math.random() * 1000);
const clientId = `${networkIp}:${port}`; // use address/port as clientId as it is unique in the network
const service = peerServer.transport("server");
service.listen(port);
debug(`Server listening on port ${port}`);

const orderBook = new OrderBook();
const lockManager = new LockManager();

service.on("request", (rid, key, payload, handler) => {
  switch (key) {
    case "lockManager:lock":
      lockManager.lockClient(payload);
      handler.reply(null, { success: true });
      break;
    case "lockManager:unlock":
      lockManager.unlockClient(payload);
      handler.reply(null, { success: true });
      break;
    case "book:sync":
      handler.reply(null, { orderBook: orderBook.getAllOrders() });
      break;
    case "order:new":
      debug("Received new order:", payload.price, payload.amount);
      const order = {
        ...payload,
        id: rid
      };
      const isFulfilled = orderBook.placeMarketOrder(order);
      debug(`Market order fulfilled?`, isFulfilled);
      debug(`Order book length: ${orderBook.getLength()}`);
      handler.reply(null, { success: true, isFulfilled, nbOrders: orderBook.getLength() });
      break;
    default:
      debug(`Unknown request type: ${key}`);
  }
});

const waitForClientToBeRegistered = async (clientId) => {
  let isClientRegistered = false;
  let nbTry = 0;
  do {
    try {
      await new Promise((resolve, reject) => {
        debug(`Lookup for current client #${nbTry}`);
        link.lookup("order:new", { timeout: 10000 }, (err, data) => {
          if (err) {
            console.error("Lookup error:", err.message);
            reject(err);
            return;
          }
          debug("Lookup response:", data);
          isClientRegistered = data.includes(clientId);
          resolve();
        });
      });
    } catch (e) {
      debug("Error in lookup", e.message);
    }
    nbTry++;
    await setTimeout(10000); // Can take a long time for a new node to be discoverable by the network
  } while (!isClientRegistered && nbTry < 100);

  if (!isClientRegistered) throw new Error("Unable to find client registered on the Grape");
};

// Start Server
(async () => {
  try {
    // Announce client on all services
    link.startAnnouncing("order:new", service.port, {});
    link.startAnnouncing("lockManager:lock", service.port, {});
    link.startAnnouncing("lockManager:unlock", service.port, {});
    // Ensure our client is accessible to others
    await waitForClientToBeRegistered(clientId);

    debug(`Initial order book length: ${orderBook.getLength()}`);

    // Client can now be requested by others for synchronizing the order book
    link.startAnnouncing("book:sync", service.port, {});

    // Release lock as our client is fully connected and synced now
    lockManager.releaseLock(clientId);
  } catch (e) {
    console.error("Error while starting trading server", e);
    process.exit(1);
  }
})();

// Handler to stop announcing on the grape when exiting
process.on("SIGINT", async () => {
  debug("Stopping server...");
  link.stopAnnouncing("order:new", service.port);
  link.stopAnnouncing("book:sync", service.port);
  link.stop();
  // Did not find a way to get stop confirmation before exiting, so waiting 2 seconds instead
  await setTimeout(2000);
  process.exit(0);
});
