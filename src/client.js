"use strict";

const { setTimeout } = require("timers/promises");
const { PeerRPCClient } = require("grenache-nodejs-http");
const Link = require("grenache-nodejs-link");
const d = require("debug")("bfx:client");
const debug = (...args) => d(`${new Date().toISOString()}:`, ...args);

const networkIp = "127.0.0.1";
const link = new Link({
  grape: `http://${networkIp}:30001`
});
link.start();

const peerClient = new PeerRPCClient(link, {});
peerClient.init();

const clientId = `${networkIp}:1024`; // Change this to match the server's clientId
const lockManager = new LockManager();

const asklockManagerLock = async (clientId) => {
  return new Promise((resolve, reject) => {
    debug("Ask lockManager lock to all connected nodes");
    peerClient.map("lockManager:lock", clientId, { timeout: 10000 }, (err, data) => {
      if (err) {
        if (err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
          // We are the first node of the grape
          resolve();
          return;
        } else {
          console.error("lockManager:lock error:", err.message);
          reject(err);
          return;
        }
      }
      debug("lockManager:lock response:", data);
      resolve();
    });
  });
};

const releaselockManagerLock = async (clientId) => {
  return new Promise((resolve, reject) => {
    debug("Release lockManager lock for all connected nodes");
    peerClient.map("lockManager:unlock", clientId, { timeout: 10000 }, (err, data) => {
      if (err) {
        if (err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
          // We are the first node of the grape
          resolve();
          return;
        } else {
          console.error("lockManager:unlock error:", err.message);
          reject(err);
          return;
        }
      }
      debug("lockManager:unlock response:", data);
      resolve();
    });
  });
};

const syncOrderBook = async () => {
  return new Promise((resolve, reject) => {
    debug("Sync order book");
    peerClient.request("book:sync", {}, { timeout: 10000 }, (err, data) => {
      if (err) {
        if (err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
          // We are the first node of the grape
          // No orders to sync
          resolve();
          return;
        } else {
          console.error("book:sync error:", err.message);
          reject(err);
          return;
        }
      }
      // debug("book:sync response:", data);
      orderBook.init(data.orderBook);
      resolve();
    });
  });
};

const submitNewOrder = async (price, amount) => {
  // Wait for all locks to be released
  while (lockManager.isLocked()) {
    debug("Waiting for clients' locks to be released...");
    await setTimeout(100);
  }

  // Broadcast new order to all nodes
  return new Promise((resolve, reject) => {
    debug("Submit new order:", price, amount);
    peerClient.map("order:new", { price, amount }, { timeout: 10000 }, (err, data) => {
      if (err) {
        console.error("order:new error:", err.message);
        reject(err);
        return;
      }
      debug("order:new response:", data);
      resolve();
    });
  });
};

const randomlySubmitNewOrders = async () => {
  try {
    const random = Math.random();
    const delay = 1000 + Math.floor(random * 9000);
    const price = parseFloat((10000 + random * 100).toFixed(4));
    const amount = parseFloat((random < 0.5 ? -random : random / 2).toFixed(4));
    await setTimeout(delay);
    await submitNewOrder(price, amount);
  } catch (err) {
    console.error("submitNewOrder error:", err.message);
  }
  randomlySubmitNewOrders();
};

// Start Client
(async () => {
  try {
    // Ask all nodes to lock order submission while our client is synchronizing on the network
    await asklockManagerLock(clientId);

    // Announce client on all services
    link.startAnnouncing("order:new", 1024, {});
    link.startAnnouncing("lockManager:lock", 1024, {});
    link.startAnnouncing("lockManager:unlock", 1024, {});

    // Sync order book from another node on startup
    await syncOrderBook();
    debug(`Initial order book length: ${orderBook.getLength()}`);

    // Release lock as our client is fully connected and synced now
    await releaselockManagerLock(clientId);

    // Client can now be requested by others for synchronizing the order book
    link.startAnnouncing("book:sync", 1024, {});

    // Then we can start trading by randomly submitting new orders
    randomlySubmitNewOrders();
  } catch (e) {
    console.error("Error while starting trading client", e);
    process.exit(1);
  }
})();

// Handler to stop announcing on the grape when exiting
process.on("SIGINT", async () => {
  debug("Stopping client...");
  link.stopAnnouncing("order:new", 1024);
  link.stopAnnouncing("book:sync", 1024);
  link.stop();
  // Did not find a way to get stop confirmation before exiting, so waiting 2 seconds instead
  await setTimeout(2000);
  process.exit(0);
});