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

var LocalAdapter = require("../").LocalAdapter;
var Client = LocalAdapter.Client;
var Server = LocalAdapter.Server;


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
  var clock = server.Store("/clock", server.lifespan);
  clock.set("date", Date.now());
  var todoList = server.Store("/todoList", server.lifespan);

  server.lifespan.setInterval(function () {
    return clock.set("date", Date.now()).commit();
  }, 500); // update clock every 500ms

  server.Action("/addItem", server.lifespan).onDispatch(function (_ref, clientHash) {
    var name = _ref.name;
    var description = _ref.description;
    // register an Action handler
    if (todoList.get(name) !== void 0) {
      // ignore if we already know this task
      return;
    }
    console.log("" + clientHash + " added task " + name + " (" + description + ").");
    todoList.set(name, { description: description, clientHash: clientHash }).commit();
  });

  server.Action("/removeItem", server.lifespan).onDispatch(function (_ref2, clientHash) {
    var name = _ref2.name;
    if (todoList.working.get(name) === void 0) {
      return;
    }
    if (todoList.working.get(name).clientHash !== clientHash) {
      return;
    }
    console.log("removed item " + name);
    todoList.unset(name, void 0).commit();
  });

  server.lifespan.setTimeout(server.lifespan.release, 10000);
});

_.defer(function () {
  // client main
  var addItem = client.Action("/addItem", client.lifespan).dispatch;
  var removeItem = client.Action("/removeItem", client.lifespan).dispatch;

  client.Store("/clock", client.lifespan).onUpdate(function (_ref3) {
    var head = _ref3.head;
    console.log("clock tick", head.get("date"));
  }).onDelete(function () {
    console.log("clock deleted");
  });

  var todoListLifespan = new Lifespan();
  var todoList = client.Store("/todoList", todoListLifespan).onUpdate(function (_ref4, patch) {
    var head = _ref4.head;
    console.log("received todoList patch:", patch);
    console.log("todoList head is now:", head.toJS());
  }).onDelete(function () {
    console.log("todoList deleted");
  });

  addItem({ name: "Harder", description: "Code harder" });
  addItem({ name: "Better", description: "Code better" });
  client.lifespan.setTimeout(function () {
    return addItem({ name: "Faster", description: "Code Faster" });
  }, 1000).setTimeout(function () {
    return removeItem({ name: "Harder" });
  }, 2000).setTimeout(function () {
    return addItem({ name: "Stronger", description: "Code stronger" });
  }, 3000).setTimeout(function () {
    todoList.value.forEach(function (_ref5, name) {
      var description = _ref5.description;
      removeItem({ name: name });
    });
  }, 4000).setTimeout(todoListLifespan.release, 5000).setTimeout(client.lifespan.release, 6000);
});