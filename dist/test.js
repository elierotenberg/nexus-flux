"use strict";

require("6to5/polyfill");
var _ = require("lodash");
var should = require("should");
var Promise = (global || window).Promise = require("bluebird");
var __DEV__ = process.env.NODE_ENV !== "production";
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === "object";
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
var Client = require("../").Client;
var Server = require("../").Server;
var LocalAdapter = require("../").LocalAdapter;


// shared state
var state = { buffer: null, server: null };

_.defer(function () {
  // server main
  // this Promise represents the lifespan of the server; it resolves when the server dies.
  var release = undefined;
  var lifespan = new Promise(function (resolve) {
    return release = resolve;
  });
  // insanciate the server, make it publish to the shared state
  var server = new Server(new LocalAdapter.Server(state));
  // create a new store at the '/clock' path
  var clock = server.Store("/clock", lifespan);
  // create a new store at the '/list' path
  var list = server.Store("/list", lifespan);
  // initialize the list store with { length: 0 } and immediatly commit
  list.set("length", 0).commit();
  var i = setInterval(function () {
    // every 1 sec, perform some updates and commit them immediatly
    clock.set("date", Date.now()).commit(); // commit per store
    list.set("" + list.head.get("length"), _.random(0, 10)).set("length", list.head.get("length") + 1).commit(); // this commit will be relatively lightweight and its size is not related to the size of the list
  }, 1000);
  // whenever the server dies, clear this loop
  lifespan.then(function () {
    return clearInterval(i);
  });

  setTimeout(release, 11000); // at some point in the future, shutdown the server
});

_.defer(function () {
  // client main
  // this Promise repesents the lifespan of the client
  var release = undefined;
  var lifespan = new Promise(function (resolve) {
    return release = resolve;
  });
  // instanciate the client, make it fetch from the shared state
  var client = new Client(new LocalAdapter.Client(state));
  // subscribe to the store at the '/clock' path
  client.Store("/clock", lifespan).onUpdate(function (_ref) {
    var head = _ref.head;
    // whenever it updates, print the new value
    console.warn("new date", head.get("date"));
  }).onDelete(function () {
    // wheneve its deleted, print it
    console.warn("deleted date");
  });

  // subscribe to the store at the '/list' path
  client.Store("/list", lifespan).onUpdate(function (_ref2, patch) {
    var head = _ref2.head;
    // whenever it update, print the new value and the serialized patch object
    console.warn("new list", head, patch.toJSON());
  }).onDelete(function () {
    // whenever its deleted, print it
    console.warn("deleted list");
  });

  setTimeout(release, 10000); // at some point in the future, shutdown the client
});