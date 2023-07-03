"use strict";

const debug = require("debug")("bfx:orderBook");

class OrderBook {
  constructor() {
    this.buyOrders = [];
    this.sellOrders = [];
  }

  init(book) {
    book.forEach((order) => this.addOrderToBook(order));
  }

  insertSorted(array, order, direction = 1) {
    //TODO: Should use a binary sort (running out of time)
    let index;
    for (index = 0; index < array.length; index++) {
      if (array[index].price < direction * order.price) {
        continue;
      } else {
        break;
      }
    }
    array.splice(index, 0, order);
  }

  addOrderToBook(order) {
    if (order.amount > 0) {
      this.insertSorted(this.buyOrders, order, -1);
    } else {
      this.insertSorted(this.sellOrders, order, 1);
    }
    debug("buy orders", this.buyOrders);
    debug("sell orders", this.sellOrders);
  }

  fulfillOrder(order) {
    const fulfilledOrders = [];
    let amountToFind = order.amount;

    if (amountToFind > 0) {
      debug(`Buy lookup for ${amountToFind} at ${order.price}`);
      debug("First Selling order:", this.sellOrders[0]);

      while (amountToFind > 0 && this.sellOrders.length > 0 && order.price >= this.sellOrders[0].price) {
        const matchingOrder = this.sellOrders.shift();

        debug("Matching order:", matchingOrder);

        if (amountToFind === -matchingOrder.amount) {
          debug("amount =");
          fulfilledOrders.push(matchingOrder);
          amountToFind = 0;
        } else if (amountToFind < -matchingOrder.amount) {
          debug("amount <");
          matchingOrder.amount += amountToFind;
          this.sellOrders.unshift(matchingOrder);
          amountToFind = 0;
        } else {
          debug("amount >");
          amountToFind += matchingOrder.amount;
          fulfilledOrders.push(matchingOrder);
        }

        debug("amount missing to find", amountToFind);
      }

      if (amountToFind === 0) {
        fulfilledOrders.push(order);
      }
    } else {
      debug(`Sell lookup for ${amountToFind} at ${order.price}`);
      debug("First Buying order:", this.buyOrders[0]);

      while (amountToFind < 0 && this.buyOrders.length > 0 && order.price <= this.buyOrders[0].price) {
        const matchingOrder = this.buyOrders.shift();

        debug("Matching order:", matchingOrder);

        if (amountToFind === -matchingOrder.amount) {
          debug("amount =");
          fulfilledOrders.push(matchingOrder);
          amountToFind = 0;
        } else if (amountToFind > -matchingOrder.amount) {
          debug("amount >");
          matchingOrder.amount += amountToFind;
          this.buyOrders.unshift(matchingOrder);
          amountToFind = 0;
        } else {
          debug("amount <");
          amountToFind += matchingOrder.amount;
          fulfilledOrders.push(matchingOrder);
        }

        debug("amount missing to find", amountToFind);
      }

      if (amountToFind === 0) {
        fulfilledOrders.push(order);
      }
    }

    return { fulfilledOrders, amountToFind };
  }

  placeMarketOrder(order) {
    const { fulfilledOrders, amountToFind } = this.fulfillOrder(order);

    debug("Fulfilled orders:", fulfilledOrders);

    if (amountToFind !== 0) {
      // Place the rest of the order that has not been fulfilled in the book
      order.amount = amountToFind;
      this.addOrderToBook(order);
    }

    return fulfilledOrders.length > 0;
  }

  getLength() {
    return this.buyOrders.length + this.sellOrders.length;
  }

  getAllOrders() {
    return [...this.buyOrders, ...this.sellOrders];
  }
}

module.exports = OrderBook;