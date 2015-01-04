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
var through = require("through2");
var Remutable = require("remutable");

var Store = require("./Store");
var Action = require("./Action");
var Client = require("./Client.Event"); // we just need this reference for typechecks
var Event = require("./Server.Event").Event; // jshint ignore:line

var ServerDuplex = through.ctor({ objectMode: true, allowHalfOpen: false }, function receiveFromLink(_ref, enc, done) {
  var clientID = _ref.clientID;
  var ev = _ref.ev;
  try {
    if (__DEV__) {
      clientID.should.be.a.String;
      ev.should.be.an.instanceOf(Client.Event);
    }
  } catch (err) {
    return done(err);
  }
  this._receive({ clientID: clientID, ev: ev });
  return done(null);
}, function flush(done) {
  this.release();
  done(null);
});

var Server = (function () {
  var _ServerDuplex = ServerDuplex;
  var Server = function Server(adapter) {
    var _this = this;
    if (__DEV__) {
      adapter.should.be.an.instanceOf(Server.Adapter);
      this.should.have.property("pipe").which.is.a.Function;
    }
    _ServerDuplex.call(this);
    _.bindAll(this);
    this._stores = {};
    this._actions = {};
    this._publish = adapter;
    this.lifespan = new Promise(function (resolve) {
      return _this.release = resolve;
    });
    if (adapter.onConnection && _.isFunction(adapter.onConnection)) {
      adapter.onConnection(this.accept, this.lifespan);
    }
  };

  _inherits(Server, _ServerDuplex);

  Server.prototype.accept = function (link) {
    if (__DEV__) {
      link.should.have.property("pipe").which.is.a.Function;
    }
    var subscriptions = {};
    var clientID = null;

    link.pipe(through.obj(function (ev, enc, done) {
      // filter & pipe client events to the server
      if (__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }

      if (ev instanceof Client.Event.Open) {
        clientID = ev.clientID;
        return done(null, { clientID: clientID, ev: ev });
      }
      if (ev instanceof Client.Event.Close) {
        clientID = null;
        return done(null, { clientID: clientID, ev: ev });
      }
      if (ev instanceof Client.Event.Subscribe) {
        subscriptions[ev.path] = true;
        return done(null);
      }
      if (ev instanceof Client.Event.Unsubscribe) {
        if (subscriptions[ev.path]) {
          delete subscriptions[ev.path];
        }
        return done(null);
      }
      if (ev instanceof Client.Event.Dispatch) {
        if (clientID !== null) {
          return done(null, { clientID: clientID, ev: ev });
        }
        return done(null);
      }
      return done(new TypeError("Unknown Client.Event: " + ev));
    })).pipe(this);

    this.pipe(through.obj(function (ev, enc, done) {
      // filter & pipe server events to the client
      if (__DEV__) {
        ev.should.be.an.instanceOf(Server.Event);
      }

      if (ev instanceof Server.Event.Update) {
        if (subscriptions[ev.path]) {
          return done(null, ev);
        }
        return done(null);
      }
      if (ev instanceof Server.Event.Delete) {
        if (subscriptions[ev.path]) {
          return done(null, ev);
        }
        return done(null);
      }
      return done(new TypeError("Unknown Server.Event: " + ev));
    })).pipe(link);

    return link;
  };

  Server.prototype._send = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.write(ev);
  };

  Server.prototype._receive = function (_ref2) {
    var clientID = _ref2.clientID;
    var ev = _ref2.ev;
    if (__DEV__) {
      clientID.should.be.a.String;
      ev.should.be.an.instanceOf(Client.Event);
    }
  };

  Server.prototype.Store = function (path, lifespan) {
    var _this2 = this;
    if (__DEV__) {
      path.should.be.a.String;
    }

    var _ref3 = this._stores[path] || (function () {
      var _engine = new Store.Engine();
      var consumer = _engine.createConsumer().onUpdate(function (consumer, patch) {
        _this2._publish(path, consumer);
        _this2._send(new Server.Event.Update({ path: path, patch: patch }));
      }).onDelete(function () {
        return _this2._send(new Server.Event.Delete({ path: path }));
      });
      // immediatly publish the (empty) store
      _this2._publish(path, consumer);
      return _this2._stores[path] = { engine: _engine, consumer: consumer };
    })();
    var engine = _ref3.engine;
    var producer = engine.createProducer();
    producer.lifespan.then(function () {
      if (engine.producers === 0) {
        engine.release();
        delete _this2._stores[path];
      }
    });
    lifespan.then(producer.release);
    return producer;
  };

  Server.prototype.Action = function (path, lifespan) {
    var _this3 = this;
    if (__DEV__) {
      path.should.be.a.String;
    }

    var _ref4 = this._actions[path] || function () {
      var _engine2 = new Action.Engine();
      return _this3._actions[path] = {
        engine: _engine2,
        producer: _engine2.createProducer() };
    };
    var engine = _ref4.engine;
    var consumer = engine.createConsumer();
    consumer.lifespan.then(function () {
      if (engine.consumers === 0) {
        engine.release();
        delete _this3._actions[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  };

  return Server;
})();

var Adapter = function Adapter() {
  if (__DEV__) {
    this.should.have.property("publish").which.is.a.Function.and.is.not.exactly(Adapter.prototype.publish);
    this.should.have.property("onConnection").which.is.a.Function.and.is.not.exactly(Adapter.prototype.onConnection);
  }
};

Adapter.prototype.publish = function (path, consumer) {
  if (__DEV__) {
    path.should.be.an.instanceOf(path);
    consumer.should.be.an["instanceof"](Remutable.Consumer);
  }
  throw new TypeError("Server.Adapter should implement publish(path: String, remutable: Remutable): void 0");
};

Adapter.prototype.onConnection = function (accept, lifespan) {
  if (__DEV__) {
    accept.should.be.a.Function;
    lifespan.should.have.property("then").which.is.a.Function;
  }
  throw new TypeError("Server.Adapter should implement onConnection(fn: Function(client: Duplex): void 0, lifespan: Promise): void 0");
};

Server.Event = Event;
Server.Adapter = Adapter;

module.exports = Server;