"use strict";

class LockManager {
  constructor() {
    this.lockedClients = new Set();
  }

  lockClient(clientId) {
    this.lockedClients.add(clientId);
  }

  unlockClient(clientId) {
    this.lockedClients.delete(clientId);
  }

  isLocked() {
    return this.lockedClients.size > 0;
  }
}

module.exports = LockManager;