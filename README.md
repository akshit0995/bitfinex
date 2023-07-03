## Files
server.js: Implements the server-side logic for handling requests and managing the order book.
client.js: Implements the client-side logic for interacting with the server and placing market orders.
lockmanager.js: Provides the functionality for locking and unlocking clients using a mutex.
orderbook.js: Implements the order book data structure and operations.

## Prerequisites
Before running the application, ensure you have the following prerequisites installed:
Node.js

## Installation
Clone projet
git clone https://github.com/akshit0995/bitfinex.git

Install Project Dependencies
Retreive all project dependencies using npm.
npm install

Setting up the DHT
npm i -g grenache-grape

## Boot two grape servers
grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'

## Note
Due to time constraints, I was unable to test the code on the actual servers. However, I have previous experience working on a similar problem during my tenure at Blocakgemini Infotech, which gave me a fair idea of how these things work. I have completed as much coding as possible within the given time frame. I apologize for any issues in the implementation.

If given more time, I would have completed the remaining tasks, performed thorough testing on the server, and addressed any issues found during the testing phase.
