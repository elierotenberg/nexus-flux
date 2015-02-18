"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

require("babel/polyfill");
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
var Lifespan = _interopRequire(require("lifespan"));

var Remutable = _interopRequire(require("remutable"));

var _adaptersLocal = require("./adapters/Local");

var Client = _adaptersLocal.Client;
var Server = _adaptersLocal.Server;
var hash = _interopRequire(require("sha256"));

var stores = {};

var server = new Server(stores);
var client = new Client(server);

server.lifespan.onRelease(function () {
  return console.log("server released");
});
client.lifespan.onRelease(function () {
  return console.log("client released");
});

_.defer(function () {
  // server main
  // initialize several stores
  var clock = stores["/clock"] = new Remutable({
    date: Date.now() });
  var todoList = stores["/todoList"] = new Remutable({});

  server.lifespan.setInterval(function () {
    server.dispatchUpdate("/clock", clock.set("date", Date.now()).commit());
  }, 500); // update clock every 500ms

  var actions = {
    "/addItem": function (_ref) {
      var name = _ref.name;
      var description = _ref.description;
      var ownerKey = _ref.ownerKey;
      var item = { name: name, description: description, ownerHash: hash(ownerKey) };
      if (todoList.get(name) !== void 0) {
        return;
      }
      server.dispatchUpdate("/todoList", todoList.set(name, item).commit());
    },
    "/removeItem": function (_ref) {
      var name = _ref.name;
      var ownerKey = _ref.ownerKey;
      var item = todoList.get(name);
      if (item === void 0) {
        return;
      }
      var ownerHash = item.ownerHash;
      if (hash(ownerKey) !== ownerHash) {
        return;
      }
      server.dispatchUpdate("/todoList", todoList.set(name, void 0).commit());
    } };

  server.on("action", function (_ref) {
    var path = _ref.path;
    var params = _ref.params;
    if (actions[path] !== void 0) {
      actions[path](params);
    }
  }, server.lifespan);

  server.lifespan.setTimeout(server.lifespan.release, 10000); // release the server in 10000ms
});

_.defer(function () {
  // client main
  var ownerKey = hash("" + Date.now() + ":" + _.random());
  client.getStore("/clock", client.lifespan) // subscribe to a store
  .onUpdate(function (_ref) {
    var head = _ref.head;
    // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
    console.log("clock tick", head.get("date"));
  }).onDelete(function () {
    // if its deleted, then do something appropriate
    console.log("clock deleted");
  });

  var todoListLifespan = new Lifespan(); // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  var todoList = client.getStore("/todoList", todoListLifespan).onUpdate(function (_ref, patch) {
    var head = _ref.head;
    // when its updated, we can access not only the up-to-date head, but also the underlying patch object,
    console.log("received todoList patch:", patch); // if we want to do something with it (we can just ignore it as above)
    console.log("todoList head is now:", head.toJS());
  }).onDelete(function () {
    console.log("todoList deleted");
  });

  client.dispatchAction("/addItem", { name: "Harder", description: "Code harder", ownerKey: ownerKey }); // dispatch some actions
  client.dispatchAction("/addItem", { name: "Better", description: "Code better", ownerKey: ownerKey });
  client.lifespan.setTimeout(function () {
    return client.dispatchAction("/addItem", { name: "Faster", description: "Code Faster", ownerKey: ownerKey });
  }, 1000) // add a new item in 1000ms
  .setTimeout(function () {
    return client.dispatchAction("/removeItem", { name: "Harder", ownerKey: ownerKey });
  }, 2000) // remove an item in 2000ms
  .setTimeout(function () {
    return client.dispatchAction("/addItem", { name: "Stronger", description: "Code stronger", ownerKey: ownerKey });
  }, 3000) // add an item in 3000ms
  .setTimeout(function () {
    return todoList.value.forEach(function (_ref, name) {
      var description = _ref.description;
      // remove every item in 4000
      client.dispatchAction("/removeItem", { name: name, ownerKey: ownerKey });
    });
  }, 4000).setTimeout(todoListLifespan.release, 5000) // release the subscriber in 5000ms
  .setTimeout(client.lifespan.release, 6000); // release the client in 6000ms
});