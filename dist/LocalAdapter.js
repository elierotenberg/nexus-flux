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
var Remutable = require("remutable");
var through = require("through2");
var _ref = require("events");

var EventEmitter = _ref.EventEmitter;


var Client = require("./Client");
var Server = require("./Server");

// Client -> ClientAdapter -> Link -> Server
// Server -> Link -> ClientAdapter -> Client

var CONNECTION = "c"; // connection event name

var _ServerAdapter = undefined;

var ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false }, function receiveFromClient(clientEvent, enc, done) {
  // receive from Client
  try {
    if (__DEV__) {
      clientEvent.should.be.an.instanceOf(Client.Event);
    }
  } catch (err) {
    return done(err);
  }
  this._sendToLink(clientEvent);
  return done(null);
});

var ClientAdapter = (function () {
  var _ClientAdapterDuplex = ClientAdapterDuplex;
  var ClientAdapter = function ClientAdapter(state) {
    if (__DEV__) {
      state.should.be.an.Object;
      state.should.have.property("buffer").which.is.an.Object;
      state.should.have.property("server").which.is.an.instanceOf(_ServerAdapter);
    }
    _ClientAdapterDuplex.call(this); // will be piped to and from the client
    _.bindAll(this);
    this._buffer = state.buffer;
    this.link = through.obj(function receiveFromServer(serverEvent, enc, done) {
      try {
        if (__DEV__) {
          serverEvent.should.be.an.instanceOf(Server.Event);
        }
      } catch (err) {
        return done(err);
      }
      return this._sendToClient(serverEvent);
    }); // will be pipe to and from server
    state.server.connect(this.link); // immediatly connect
  };

  _inherits(ClientAdapter, _ClientAdapterDuplex);

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

  ClientAdapter.prototype._sendToClient = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.push(ev);
  };

  ClientAdapter.prototype._sendToLink = function (ev) {
    if (__DEV__) {
      ev.should.an.instanceOf(Client.Event);
    }
    this.link.push(ev);
  };

  return ClientAdapter;
})();

var ServerAdapter = (function () {
  var _Server$Adapter = Server.Adapter;
  var ServerAdapter = function ServerAdapter(state) {
    if (__DEV__) {
      state.should.be.an.Object;
      state.should.have.property("buffer");
      state.should.have.property("server");
      (state.buffer === null).should.be.ok;
      (state.server === null).should.be.ok;
    }
    _Server$Adapter.call(this);
    _.bindAll(this);
    state.buffer = this._buffer = {};
    state.server = this;
    this._events = new EventEmitter();
  };

  _inherits(ServerAdapter, _Server$Adapter);

  ServerAdapter.prototype.publish = function (path, consumer) {
    if (__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._buffer[path] = consumer;
  };

  ServerAdapter.prototype.connect = function (link) {
    this._events.emit(CONNECTION, link);
  };

  ServerAdapter.prototype.onConnection = function (accept, lifespan) {
    if (__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    this._events.addListener(CONNECTION, accept, lifespan);
  };

  return ServerAdapter;
})();

_ServerAdapter = ServerAdapter;

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter };