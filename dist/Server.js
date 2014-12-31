"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var _ = require("lodash");var should = require("should");var Promise = (global || window).Promise = require("bluebird");var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;__DEV__ ? Promise.longStackTraces() : void 0;var createEvents = require("strict-events");

var Client = require("./Client");

var EVENTS = {
  HANDSHAKE_ACK: "h",
  UPDATE: "u",
  DELETE: "d" };

var Events = createEvents(EVENTS);

var _Server = undefined;

var Store = function Store(path, server) {
  if (__DEV__) {
    path.should.be.a.String;
    server.should.be.an.instanceOf(_Server);
  }
};

Store.prototype.set = function (key, value) {
  if (__DEV__) {
    key.should.be.a.String;
  }
};

Store.prototype.commit = function () {};

_prototypeProperties(Store, null, {
  head: {
    get: function () {},
    enumerable: true
  },
  working: {
    get: function () {},
    enumerable: true
  }
});

var Action = function Action(path, server) {
  if (__DEV__) {
    path.should.be.a.String;
    server.should.be.an.instanceOf(_Server);
  }
};

Action.prototype.onDispatch = function (handler) {
  if (__DEV__) {
    handler.should.be.a.Function;
  }
};

var Server = function Server(_ref, opts) {
  if (opts === undefined) opts = {};
  var push = _ref.push;
  if (__DEV__) {
    push.should.be.a.Function;
    opts.should.be.an.Object;
  }
  _.bindAll(this);
  Object.assign(this, {
    _push: push,
    _stores: {},
    _actions: {} });
};

Server.prototype.open = function (clientSecret, _ref2) {
  var clientListener = _ref2.clientListener;
  var clientEmitter = _ref2.clientEmitter;
  if (__DEV__) {
    clientSecret.should.be.a.String;
    clientListener.should.be.an.instanceOf(Client.Events.Listener);
    clientEmitter.should.be.an.instanceOf(Client.Events.Emitter);
  }
};

Server.prototype.close = function (clientSecret) {
  if (__DEV__) {
    clientSecret.should.be.a.String;
  }
};

Server.prototype.Store = function (path) {
  if (__DEV__) {
    path.should.be.a.String;
  }
  if (this._stores[path] === void 0) {
    this._stores[path] = new Store(path, this);
  }
  return this._stores[path];
};

Server.prototype.Action = function (path) {
  if (__DEV__) {
    path.should.be.a.String;
  }
  if (this._actions[path] === void 0) {
    this._actions[path] = new Action(path, this);
  }
  return this._actions[path];
};

_Server = Server;

Object.assign(Server.prototype, {
  _push: null,
  _stores: null,
  _actions: null });

Object.assign(Server, { EVENTS: EVENTS, Events: Events });

module.exports = Server;