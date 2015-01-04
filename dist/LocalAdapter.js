"use strict";

var _inherits = function (child, parent) {
  child.prototype = Object.create(parent && parent.prototype, {
    constructor: {
      value: child,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (parent) child.__proto__ = parent;
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
}
var Client = require("./Client");
var Server = require("./Server");
var Remutable = require("remutable");

var ClientAdapter = (function () {
  var _Client$Adapter = Client.Adapter;
  var ClientAdapter = function ClientAdapter(buffer) {
    if (__DEV__) {
      buffer.should.be.an.Object;
    }
    _Client$Adapter.call(this);
    _.bindAll(this);
    this._buffer = buffer;
  };

  _inherits(ClientAdapter, _Client$Adapter);

  ClientAdapter.prototype.fetch = function (path, hash) {
    var _this = this;
    if (hash === undefined) hash = null;
    // ignore hash
    return Promise["try"](function () {
      if (__DEV__) {
        path.should.be.a.String;
        (_.isNull(hash) || _.isString(hash)).should.be.true;
        _this._buffer.should.have.property("hash");
      }
      return _this._buffer[path];
    });
  };

  return ClientAdapter;
})();

var ServerAdapter = (function () {
  var _Server$Adapter = Server.Adapter;
  var ServerAdapter = function ServerAdapter(buffer) {
    if (__DEV__) {
      buffer.should.be.an.Object;
    }
    _Server$Adapter.call(this);
    _.bindAll(this);
    this._buffer = buffer;
  };

  _inherits(ServerAdapter, _Server$Adapter);

  ServerAdapter.prototype.publish = function (path, consumer) {
    if (__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._buffer[path] = consumer;
  };

  ServerAdapter.prototype.onConnection = function (accept, lifespan) {
    if (__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    // no-op.
  };

  return ServerAdapter;
})();

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter };