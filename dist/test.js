"use strict";

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

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
var Lifespan = _interopRequire(require("lifespan"));

var Client = require("../Local").Client;
var Server = require("../Local").Server;


var server = new Server();
var client = new Client(server);

server.lifespan.onRelease(function () {
  return console.log("server released");
});
client.lifespan.onRelease(function () {
  return console.log("client released");
});

_.defer(function () {
  // server main
  var clock = server.Store("/clock", server.lifespan); // create a new store, initally empty ({})
  clock.set("date", Date.now()).commit(); // initialize it with a single field, date, and commit it immediatly
  var todoList = server.Store("/todoList", server.lifespan); // create another store, initially empty({})

  server.lifespan.setInterval(function () {
    return clock.set("date", Date.now()).commit();
  }, 500); // update clock every 500ms

  server.Action("/addItem", server.lifespan) // register a new action
  .onDispatch(function (_ref, clientHash) {
    var name = _ref.name;
    var description = _ref.description;
    // register an Action handler
    if (todoList.get(name) !== void 0) {
      // ignore if we already know this task
      return;
    }
    console.log("" + clientHash + " added task " + name + " (" + description + ").");
    todoList.set(name, { description: description, clientHash: clientHash }).commit(); // add an item to the todolist and commit
  });

  server.Action("/removeItem", server.lifespan) // register a new action
  .onDispatch(function (_ref2, clientHash) {
    var name = _ref2.name;
    // register another action handler
    if (todoList.working.get(name) === void 0) {
      // if we don't have this action, dismiss
      return;
    }
    if (todoList.working.get(name).clientHash !== clientHash) {
      // if this client hasn't set this item, dismiss
      return;
    }
    console.log("removed item " + name);
    todoList.unset(name, void 0).commit(); // remove the item and commit
  });

  server.lifespan.setTimeout(server.lifespan.release, 10000); // release the server in 10000ms
});

_.defer(function () {
  // client main
  var addItem = client.Action("/addItem", client.lifespan).dispatch; // register 2 actions dispachers
  var removeItem = client.Action("/removeItem", client.lifespan).dispatch;

  client.Store("/clock", client.lifespan) // subscribe to a store
  .onUpdate(function (_ref3) {
    var head = _ref3.head;
    // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
    console.log("clock tick", head.get("date"));
  }).onDelete(function () {
    // if its deleted, then do something appropriate
    console.log("clock deleted");
  });

  var todoListLifespan = new Lifespan(); // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  var todoList = client.Store("/todoList", todoListLifespan).onUpdate(function (_ref4, patch) {
    var head = _ref4.head;
    // when its updated, we can access not only the up-to-date head, but also the underlying patch object,
    console.log("received todoList patch:", patch); // if we want to do something with it (we can just ignore it as above)
    console.log("todoList head is now:", head.toJS());
  }).onDelete(function () {
    console.log("todoList deleted");
  });

  addItem({ name: "Harder", description: "Code harder" }); // dispatch some actions
  addItem({ name: "Better", description: "Code better" });
  client.lifespan.setTimeout(function () {
    return addItem({ name: "Faster", description: "Code Faster" });
  }, 1000) // add a new item in 1000ms
  .setTimeout(function () {
    return removeItem({ name: "Harder" });
  }, 2000) // remove an item in 2000ms
  .setTimeout(function () {
    return addItem({ name: "Stronger", description: "Code stronger" });
  }, 3000) // add an item in 3000ms
  .setTimeout(function () {
    return todoList.value.forEach(function (_ref5, name) {
      var description = _ref5.description;
      // remove every item in 4000
      removeItem({ name: name });
    });
  }, 4000).setTimeout(todoListLifespan.release, 5000) // release the subscriber in 5000ms
  .setTimeout(client.lifespan.release, 6000); // release the client in 6000ms
});