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
}
var _ref = require("../");

var Client = _ref.Client;
var Server = _ref.Server;
var LocalAdapter = _ref.LocalAdapter;


// shared state
var state = { buffer: null, server: null };

_.defer(function () {
  // server main
  var server = new Server(new LocalAdapter.Server(state));
});

_.defer(function () {
  // client main
  var client = new Client(new LocalAdapter.Client(state));
  var todoList = client.Store("/todoList");
});