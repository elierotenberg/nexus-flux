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
var Patch = Remutable.Patch;
var through = require("through2");

var Store = require("./Store");
var Action = require("./Action");
var Server = require("./Server.Event"); // we just need this reference for typechecks
var Event = require("./Client.Event").Event; // jshint ignore:line

var INT_MAX = 9007199254740992;

var _Client = undefined;

var ClientDuplex = through.ctor({ objectMode: true, allowHalfOpen: false }, function receive(ev, enc, done) {
  // server send a client (through adapter)
  if (__DEV__) {
    ev.should.be.an.instanceOf(Server.Event);
  }
  if (ev instanceof Server.Event.Update) {
    this._update(ev.path, ev.patch);
    return done(null);
  }
  if (ev instanceof Server.Event.Delete) {
    this._delete(ev.path);
    return done(null);
  }
  done(new TypeError("Unknown event: " + ev));
}, function flush(done) {
  // server is done sending (through adapter)
  this.push(new _Client.Event.Close());
  this.resolve();
  done(null);
});

function isAdapter(adapter) {
  // client adapter ducktyping
  // an adapter is just a Duplex stream which implements 'fetch'
  return adapter.should.have.property("pipe").which.is.a.Function && _.isFunction(adapter.fetch);
}

var Client = (function () {
  var _ClientDuplex = ClientDuplex;
  var Client = function Client(adapter, clientID) {
    var _this = this;
    if (clientID === undefined) clientID = _.uniqueId("Client" + _.random(1, INT_MAX - 1));
    return (function () {
      if (__DEV__) {
        isAdapter(adapter).should.be.true;
        clientID.should.be.a.String;
      }
      _ClientDuplex.call(_this);
      _.bindAll(_this);

      Object.assign(_this, {
        clientID: clientID,
        lifespan: new Promise(function (resolve) {
          return _this.resolve = resolve;
        }),
        _stores: {},
        _refetching: {},
        _actions: {},
        _fetch: adapter.fetch });

      adapter.pipe(_this); // adapter sends us server events
      _this.pipe(adapter); // we send adapter client events

      _this.push(new Client.Event.Open({ clientID: clientID }));
    })();
  };

  _inherits(Client, _ClientDuplex);

  Client.prototype.Store = function (path, lifespan, autofetch) {
    var _this2 = this;
    if (autofetch === undefined) autofetch = true;
    // returns a Store consumer
    if (__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    var _ref = this._stores[path] || (function () {
      // if we don't know this store yet, then subscribe
      _this2.push(new Client.Event.Subscribe({ path: path }));
      var _engine = new Store.Engine();
      _this2._stores[path] = {
        engine: _engine,
        producer: _engine.createProducer(),
        patches: {}, // initially we have no pending patches and we are not refetching
        refetching: false };
      // refetch immediatly unless we are explicitly told not to
      if (autofetch) {
        _this2._refetch(path, null);
      }
      return _this2._stores[path];
    })();
    var engine = _ref.engine;
    var consumer = engine.createConsumer();
    consumer.lifespan.then(function () {
      // Stores without consumers are removed
      if (engine.consumers === 0) {
        // if we don't have anymore consumers, then unsubscribe
        engine.release();
        _this2.push(new Client.Event.Unsbuscribe({ path: path }));
        delete _this2._stores[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  };

  Client.prototype.Action = function (path, lifespan) {
    var _this3 = this;
    // returns an Action producer
    if (__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    var _ref2 = this._actions[path] || (function () {
      // if we don't know this action yet, start observing it
      var _engine2 = new Action.Engine();
      return _this3._actions[path] = {
        engine: _engine2,
        consumer: _engine2.createConsumer().onDispatch(function (params) {
          return _this3.push(new Client.Event.Dispatch({ path: path, params: params }));
        }) };
    })();
    var engine = _ref2.engine;
    var producer = engine.createProducer();
    producer.lifespan.then(function () {
      // Actions without producers are removed
      if (engine.producers === 0) {
        // when we don't have anymore producers, we stop observing it
        engine.release();
        delete _this3._actions[path];
      }
    });
    lifespan.then(producer.release);
    return producer;
  };

  Client.prototype._update = function (path, patch) {
    if (__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    if (this._stores[path] === void 0) {
      // dismiss if we are not interested anymore
      return;
    }
    var producer = this._stores[path].producer;
    var patches = this._stores[path].patches;
    var refetching = this._stores[path].refetching;
    var hash = producer.remutableConsumer.hash;
    var source = patch.source;
    var target = patch.target;
    if (hash === source) {
      // if the patch applies to our current version, apply it now
      return producer.update(patch);
    } // we don't have a recent enough version, we need to refetch
    if (!refetching) {
      // if we arent already refetching, request a newer version (atleast >= target)
      return this._refetch(path, target);
    } // if we are already refetching, store the patch for later
    patches[source] = patch;
  };

  Client.prototype._delete = function (path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    if (this._stores[path] === void 0) {
      return;
    }
    var producer = this._stores[path].producer;
    producer["delete"]();
  };

  Client.prototype._refetch = function (path, target) {
    var _this4 = this;
    if (__DEV__) {
      path.should.be.a.String;
      target.should.be.a.String;
      this._stores.should.have.property(path);
    }
    this._stores[path].refetching = true;
    // we use the fetch method from the adapter
    this._fetch(path, target).then(function (remutable) {
      return _this4._upgrade(path, remutable);
    });
  };

  Client.prototype._upgrade = function (path, next) {
    if (__DEV__) {
      path.should.be.a.String;
      (next instanceof Remutable || next instanceof Remutable.Consumer).should.be.true;
    }
    if (this._stores[path] === void 0) {
      // not interested anymore
      return;
    }
    var producer = this._stores[path].producer;
    var patches = this._stores[path].patches;
    var prev = producer.remutableConsumer;
    if (prev.version > next.version) {
      // we already have a more recent version
      return;
    }
    // squash patches to create a single patch
    var squash = Patch.fromDiff(prev, next);
    while (patches[squash.target] !== void 0) {
      squash = Patch.combine(squash, patches[squash.target]);
    }
    var version = squash.t.v;
    // clean old patches
    _.each(patches, function (_ref3, source) {
      var t = _ref3.t;
      if (t.v <= version) {
        delete patches[source];
      }
    });
    producer.update(squash);
  };

  return Client;
})();

_Client = Client;

Object.assign(Client, { Event: Event, isAdapter: isAdapter });

module.exports = Client;