"use strict";

require("6to5/polyfill");var _ = require("lodash");var should = require("should");var Promise = (global || window).Promise = require("bluebird");var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;__DEV__ ? Promise.longStackTraces() : void 0;var createEvents = require("strict-events");

var Server = require("./Server");

var EVENTS = {
  HANDSHAKE: "h",
  SUBSCRIBE: "s",
  UNSUBSCRIBE: "u",
  DISPATCH: "d" };

var Events = createEvents(EVENTS);

var _Client = undefined;

var Store = function Store(path, client) {
  if (__DEV__) {
    path.should.be.a.String;
    client.should.be.an.instanceOf(_Client);
  }
};

Store.prototype.fetch = function () {};

Store.prototype.onChange = function (handler) {
  if (__DEV__) {
    handler.should.be.a.Function;
  }
};

Store.prototype.onDelete = function (handler) {
  if (__DEV__) {
    handler.should.be.a.Function;
  }
};

var Action = function Action(name, client) {
  if (__DEV__) {
    name.should.be.a.String;
    client.should.be.an.instanceOf(_Client);
  }
};

Action.prototype.dispatch = function (params) {
  if (params === undefined) params = {};
  if (__DEV__) {
    params.should.be.an.Object;
  }
};

var Client = function Client(_ref, opts) {
  if (opts === undefined) opts = {};
  var pull = _ref.pull;
  if (__DEV__) {
    pull.should.be.a.Function;
    opts.should.be.an.Object;
  }
  _.bindAll(this);
  Object.assign(this, {
    _pull: pull,
    _stores: {},
    _actions: {} });
};

Client.prototype.open = function (serverSecret, _ref2) {
  var serverListener = _ref2.serverListener;
  var serverEmitter = _ref2.serverEmitter;
  if (__DEV__) {
    serverListener.should.be.an.instanceOf(Server.Events.Listener);
    serverEmitter.should.be.an.instanceOf(Server.Events.Emitter);
  }
};

Client.prototype.close = function (_ref3) {
  var serverSecret = _ref3.serverSecret;
  if (__DEV__) {
    serverSecret.should.be.a.String;
  }
};

Client.prototype.Store = function (path) {
  if (__DEV__) {
    path.should.be.a.String;
  }
  if (this._stores[path] === void 0) {
    this._stores[path] = new Store(path, this);
  }
  return this._stores[path];
};

Client.prototype.Action = function (path) {
  if (__DEV__) {
    path.should.be.a.String;
  }
  if (this._actions[path] === void 0) {
    this._actions[path] = new Action(path, this);
  }
  return this._actions[path];
};

_Client = Client;

Object.assign(Client.prototype, {
  _pull: null,
  _stores: null,
  _actions: null });

Object.assign(Events, { EVENTS: EVENTS, Events: Events });

module.exports = Client;