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
var Remutable = _interopRequire(require("remutable"));

var Patch = Remutable.Patch;
var Lifespan = _interopRequire(require("lifespan"));

var Store = _interopRequire(require("./Store"));

var Action = _interopRequire(require("./Action"));

var Server = _interopRequire(require("./Server.Event"));

// we just need this reference for typechecks
var Event = require("./Client.Event").Event;


var INT_MAX = 9007199254740992;

/**
 * @abstract
 */
var Client = function Client() {
  var _this = this;
  var clientID = arguments[0] === undefined ? _.uniqueId("Client" + _.random(1, INT_MAX - 1)) : arguments[0];
  return (function () {
    if (__DEV__) {
      clientID.should.be.a.String;
      _this.constructor.should.not.be.exactly(Client); // ensure abstract
      _this.fetch.should.not.be.exactly(Client.prototype.fetch); // ensure virtual
      _this.sendToServer.should.not.be.exactly(Client.prototype.sendToServer); // ensure vri
    }
    _this.lifespan = new Lifespan();
    _.bindAll(_this);
    _this._clientID = clientID;
    _this._stores = {};
    _this._refetching = {};
    _this._actions = {};
    _this._prefetched = null;
    _this.lifespan.onRelease(function () {
      _this._clientID = null;
      _this._stores = null;
      _this._refetching = null;
      _this._actions = null;
      _this._prefetched = null;
    });

    _this.sendToServer(new Client.Event.Open({ clientID: clientID }));
  })();
};

/**
 * @virtual
 */
Client.prototype.fetch = function (path, hash) {
  if (__DEV__) {
    path.should.be.a.String;
    (hash === null || _.isString(hash)).should.be["true"];
  }
  throw new TypeError("Virtual method invocation");
};

/**
 * @virtual
 */
Client.prototype.sendToServer = function (ev) {
  if (__DEV__) {
    ev.should.be.an.instanceOf(Client.Event);
  }
  throw new TypeError("Virtual method invocation");
};

Client.prototype.receiveFromServer = function (ev) {
  if (__DEV__) {
    ev.should.be.an.instanceOf(Server.Event);
  }
  if (ev instanceof Server.Event.Update) {
    return this._update(ev.path, ev.patch);
  }
  if (ev instanceof Server.Event.Delete) {
    return this._delete(ev.path);
  }
  throw new TypeError("Unknown event: " + ev);
};

Client.prototype["import"] = function (prefetched) {
  if (__DEV__) {
    prefetched.should.be.an.Object;
    (this._prefetched === null).should.be["true"];
  }
  this._prefetched = _.mapValues(prefetched, function (js) {
    return Remutable.fromJS(js);
  });
  return this;
};

Client.prototype["export"] = function () {
  if (__DEV__) {
    (this._prefetched !== null).should.be["true"];
  }
  return _.mapValues(this._stores, function (val) {
    return val.remutable.toJS();
  });
};

// example usage: client.settle('/todoList', '/userList'), client.settle(paths), client.settle().
Client.prototype.settle = function () {
  var _this2 = this;
  var stores = [];

  for (var _key = 0; _key < arguments.length; _key++) {
    stores[_key] = arguments[_key];
  }

  // wait for all the initialization Promise to be either fullfilled or rejected; paths can be either null/void 0 (all stores), a single string (1 store), or an array of stores
  if (stores === void 0) {
    stores = Object.keys(this._stores);
  }
  if (__DEV__) {
    stores.should.be.an.Array;
  }
  if (_.isArray(stores[0])) {
    stores = stores[0];
  }
  return Promise.settle(_.map(stores, function (path) {
    return _this2._stores[path].initialized;
  }));
};

Client.prototype.Store = function (path, lifespan) {
  var _this3 = this;
  // returns a Store consumer
  if (__DEV__) {
    path.should.be.a.String;
    lifespan.should.be.an.instanceOf(Lifespan);
  }
  var _ref = this._stores[path] || (function () {
    // if we don't know this store yet, then subscribe
    _this3.sendToServer(new Client.Event.Subscribe({ path: path }));
    var prefetched = _this3._prefetched !== null && _this3._prefetched[path] !== void 0 ? _this3._prefetched[path] : null;
    var _engine = new Store.Engine(prefetched);
    var store = _this3._stores[path] = {
      engine: _engine,
      producer: _engine.createProducer(),
      patches: {}, // initially we have no pending patches and we are not refetching
      refetching: false,
      initialized: null };
    store.initialized = _this3._refetch(path, prefetched ? prefetched.hash : null);
    return _this3._stores[path];
  })();
  var engine = _ref.engine;
  var consumer = engine.createConsumer();
  consumer.lifespan.onRelease(function () {
    if (engine.consumers === 0) {
      _this3._stores[path].producer.lifespan.release();
      engine.lifespan.release();
      _this3.sendToServer(new Client.Event.Unsubscribe({ path: path }));
      delete _this3._stores[path];
    }
  });
  lifespan.onRelease(consumer.lifespan.release);
  return consumer;
};

Client.prototype.Action = function (path, lifespan) {
  var _this4 = this;
  // returns an Action producer
  if (__DEV__) {
    path.should.be.a.String;
    lifespan.should.be.an.instanceOf(Lifespan);
  }
  var _ref2 = this._actions[path] || (function () {
    // if we don't know this action yet, start observing it
    var _engine2 = new Action.Engine();
    return _this4._actions[path] = {
      engine: _engine2,
      consumer: _engine2.createConsumer().onDispatch(function (params) {
        return _this4.sendToServer(new Client.Event.Dispatch({ path: path, params: params }));
      }) };
  })();
  var engine = _ref2.engine;
  var producer = engine.createProducer();
  producer.lifespan.onRelease(function () {
    if (engine.producers === 0) {
      _this4._actions[path].consumer.lifespan.release();
      engine.lifespan.release();
      delete _this4._actions[path];
    }
  });
  lifespan.onRelease(producer.lifespan.release);
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
  var hash = producer.hash;
  var source = patch.source;
  var target = patch.target;
  if (hash === source) {
    // if the patch applies to our current version, apply it now
    return producer.apply(patch);
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
  var _this5 = this;
  if (__DEV__) {
    path.should.be.a.String;
    (target === null || _.isString(target)).should.be["true"];
    this._stores.should.have.property(path);
  }
  this._stores[path].refetching = true;
  // we use the fetch method from the adapter
  return this.fetch(path, target).then(function (remutable) {
    return _this5._upgrade(path, remutable);
  });
};

Client.prototype._upgrade = function (path, next) {
  if (__DEV__) {
    path.should.be.a.String;
    (next instanceof Remutable || next instanceof Remutable.Consumer).should.be["true"];
  }
  if (this._stores[path] === void 0) {
    // not interested anymore
    return;
  }
  var engine = this._stores[path].engine;
  var producer = this._stores[path].producer;
  var patches = this._stores[path].patches;
  var prev = engine.remutable;
  if (prev.version >= next.version) {
    // we already have a more recent version
    return;
  }
  // squash patches to create a single patch
  var squash = Patch.fromDiff(prev, next);
  while (patches[squash.target] !== void 0) {
    squash = Patch.combine(squash, patches[squash.target]);
  }
  var version = squash.to.v;
  // clean old patches
  _.each(patches, function (_ref3, source) {
    var to = _ref3.to;
    if (to.v <= version) {
      delete patches[source];
    }
  });
  producer.apply(squash);
};

Object.assign(Client, { Event: Event });

module.exports = Client;