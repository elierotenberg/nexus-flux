"use strict";

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (child, parent) {
  if (typeof parent !== "function" && parent !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof parent);
  }
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
var Remutable = _interopRequire(require("remutable"));

var Client = require("../").Client;
var Server = require("../").Server;
var Link = Server.Link;


var _LocalServer = undefined,
    _LocalLink = undefined;

var LocalClient = (function () {
  var _Client = Client;
  var LocalClient = function LocalClient(server, clientID) {
    var _this = this;
    if (__DEV__) {
      server.should.be.an.instanceOf(_LocalServer);
    }
    this._server = server;
    this._link = new _LocalLink(this);
    this._server.acceptLink(this._link);
    _get(Object.getPrototypeOf(LocalClient.prototype), "constructor", this).call(this, clientID);
    this.lifespan.onRelease(function () {
      _this._link.lifespan.release();
      _this._link = null;
    });
  };

  _inherits(LocalClient, _Client);

  LocalClient.prototype.sendToServer = function (ev) {
    this._link.receiveFromClient(ev);
  };

  LocalClient.prototype.fetch = function (path) {
    var _this2 = this;
    // just ignore hash
    return Promise["try"](function () {
      // fail if there is not such published path
      _this2._server["public"].should.have.property(path);
      return _this2._server["public"][path];
    });
  };

  return LocalClient;
})();

var LocalLink = (function () {
  var _Link = Link;
  var LocalLink = function LocalLink(client) {
    var _this3 = this;
    if (__DEV__) {
      client.should.be.an.instanceOf(LocalClient);
    }
    _get(Object.getPrototypeOf(LocalLink.prototype), "constructor", this).call(this);
    this._client = client;
    this.lifespan.onRelease(function () {
      client.lifespan.release();
      _this3._client = null;
    });
  };

  _inherits(LocalLink, _Link);

  LocalLink.prototype.sendToClient = function (ev) {
    this._client.receiveFromServer(ev);
  };

  return LocalLink;
})();

_LocalLink = LocalLink;

var LocalServer = (function () {
  var _Server = Server;
  var LocalServer = function LocalServer() {
    var _this4 = this;
    _get(Object.getPrototypeOf(LocalServer.prototype), "constructor", this).call(this);
    this["public"] = {};
    this.lifespan.onRelease(function () {
      return _this4["public"] = null;
    });
  };

  _inherits(LocalServer, _Server);

  LocalServer.prototype.publish = function (path, remutableConsumer) {
    if (__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this["public"][path] = remutableConsumer;
  };

  return LocalServer;
})();

_LocalServer = LocalServer;

module.exports = {
  Client: LocalClient,
  Server: LocalServer };