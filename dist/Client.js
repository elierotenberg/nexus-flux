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
var Remutable = require("remutable");
var Patch = Remutable.Patch;
var Store = require("./Store");
var Action = require("./Action");
var Server = require("./Server");

var _Adapter = undefined;

var Client = function Client(adapter) {
  if (__DEV__) {
    adapter.should.be.an.instanceOf(_Adapter);
  }
  this._adapter = adapter;
  this._stores = {};
  this._actions = {};
};

Client.prototype.within = function (lifespan) {
  var _this = this;
  return {
    createStore: function (path) {
      return _this.createStore(lifespan, path);
    },
    createAction: function (path) {
      return _this.createAction(lifespan, path);
    } };
};

Client.prototype.fetch = function (path) {
  return this._adapter.fetch(path);
};

Client.prototype.createStore = function (lifespan, path) {
  var _this2 = this;
  if (this._stores[path] === void 0) {
    this._stores[path] = {
      engine: new Store.Engine(),
      count: 0 };
    this._adapter.registerStore(path, this._stores[path].engine.createProducer());
  }
  this._stores[path].count = this._stores[path].count + 1;
  lifespan.then(function () {
    return _this2._uncreateStore(path);
  });
  return this._stores[path].engine.createConsumer(lifespan);
};

Client.prototype._uncreateStore = function (path) {
  if (__DEV__) {
    this._stores.should.have.property(path);
    this._stores[path].count.should.be.above(0);
  }
  this._stores[path].count = this._stores[path].count - 1;
  if (this._stores[path].count === 0) {
    this._adapter.unregisterStore(path);
    delete this._stores[path];
  }
};

Client.prototype.createAction = function (lifespan, path) {
  var _this3 = this;
  if (this._actions[path] === void 0) {
    (function () {
      var actionResolve = undefined;
      var actionLifespan = new Promise(function (resolve) {
        return actionResolve = resolve;
      });
      _this3._actions[path] = {
        engine: new Action.Engine(),
        count: 0,
        resolve: actionResolve };
      _this3._adapter.registerAction(path, _this3._actions[path].engine.createConsumer(actionLifespan));
    })();
  }
  this._actions[path].count = this._actions[path].count + 1;
  lifespan.then(function () {
    return _this3._uncreateAction(path);
  });
  return this._actions[path].engine.createProducer();
};

Client.prototype._uncreateAction = function (path) {
  if (__DEV__) {
    this._actions.should.have.property(path);
    this._actions[path].count.should.be.above(0);
  }
  this._actions[path].count = this._actions[path].count - 1;
  if (this._actions[path].count === 0) {
    this._adapter.unregisterAction(path);
    this._actions[path].resolve();
    delete this._actions[path];
  }
};

var Adapter = function Adapter(fetch, fromServer, toServer) {
  if (__DEV__) {
    fetch.should.be.a.Function;
    fromServer.should.have.property("addListener").which.is.a.Function;
    fromServer.should.have.property("removeListener").which.is.a.Function;
    toServer.should.have.property("emit").which.is.a.Function;
  }
  _.bindAll(this);
  this._fetch = fetch;
  this._fromServer = fromServer;
  this._toServer = toServer;
  this._stores = {};
  this._actions = {};
  this._fetching = {};
  this._fromServer.on(Server.Events.Patch, this.receivePatch).on(Server.Events.Delete, this.receiveDelete);
};

Adapter.prototype.registerStore = function (path, producer) {
  if (__DEV__) {
    path.should.be.a.String;
    producer.should.be.an.instanceOf(Store.Producer);
    this._stores.should.not.have.property(path);
  }
  this._stores[path] = producer;
  this._patches[path] = {};
  this._toServer.emit(Client.Events.Subscribe, path);
};

Adapter.prototype.unregisterStore = function (path) {
  if (__DEV__) {
    path.should.be.a.String;
    this._stores.should.have.property(path);
  }
  this._toServer.emit(Client.Events.Unsbuscribe, path);
  delete this._patches[path];
  delete this._stores[path];
};

Adapter.prototype.registerAction = function (path, consumer) {
  var _this4 = this;
  if (__DEV__) {
    path.should.be.a.String;
    consumer.should.be.an.instanceOf(Action.Consumer);
    this._actions.should.not.have.property(path);
  }
  this._actions[path] = consumer;
  consumer.onDispatch(function (params) {
    return _this4._toServer.emit(Client.Events.Dispatch, path, params);
  });
};

Adapter.prototype.unregisterAction = function (path) {
  if (__DEV__) {
    path.should.be.a;String;
    this._actions.should.have.property(path);
  }
  delete this._actions[path];
};

Adapter.prototype.receivePatch = function (path, patch) {
  if (__DEV__) {
    path.should.be.a.String;
    patch.should.be.an.instanceOf(Patch);
  }
  if (this._stores[path] === void 0) {
    // dismiss if we are not interested anymore
    return;
  }
  if (this._stores[path].remutableConsumer.hash === patch.source) {
    // if the patch match our current version, apply it
    return this._stores[path].update(patch);
  }
  if (this._refetching[path] === void 0) {
    // if we are not already refetching a fresher version, do it
    this.refetch(path, patch.target);
  } else {
    // if we are already fetching, store the patch for later use
    this._patches[path][patch.source] = patch;
  }
};

Adapter.prototype.receiveDelete = function (path) {
  if (__DEV__) {
    path.should.be.a.String;
  }
  if (this._stores[path] === void 0) {
    return;
  }
  this._stores[path]["delete"]();
};

Adapter.prototype.refetch = function (path, hash) {
  var _this5 = this;
  if (__DEV__) {
    this._refetching.should.not.have.property(path);
  }
  if (this._stores[path] === void 0) {
    return;
  }
  this._refetching[path] = this._fetch(path, hash).then(function (remutable) {
    return _this5.receiveRefetch(path, remutable);
  });
};

Adapter.prototype.receiveRefetch = function (path, remutable) {
  if (__DEV__) {
    path.should.be.a.String;
    (remutable instanceof Remutable || remutable instanceof Remutable.Consumer).should.be.true;
  }
  if (this._stores[path] === void 0) {
    return;
  }
  if (this._stores[path].remutableConsumer.version > remutable.version) {
    return;
  }
  var diff = Patch.fromDiff(this._stores[path].remutableConsumer, remutable);
  this._patches[path][diff.source] = diff;
  this.applyAllAvailablePatches(path);
};

Adapter.prototype.applyAllAvailablePatches = function (path) {
  var _this6 = this;
  if (__DEV__) {
    path.should.be.a.String;
    this._stores.should.have.property(path);
  }
  var hash = this._stores[path].remutableConsumer.hash;
  var patch = null;
  // recursively combine all matching patches into one big patch
  while (this._patches[path][hash] !== void 0) {
    var nextPatch = this._patches[path][hash];
    delete this._patches[path][hash];
    if (patch === null) {
      patch = nextPatch;
    } else {
      patch = Patch.combine(patch, nextPatch);
    }
    hash = patch.target;
  }
  // delete patches to older versions
  var version = patch.t.v;
  _.each(this._patches[path], function (patch, hash) {
    if (patch.t.v < version) {
      delete _this6._patches[path][hash];
    }
  });
  if (__DEV__) {
    _.size(this._patches[path]).should.be.exactly(0);
  }
  this._stores[path].update(patch);
};

_Adapter = Adapter;

Client.Adapter = Adapter;
Client.Events = {
  Subscribe: "s",
  Unsbuscribe: "u",
  Dispatch: "d" };

module.exports = Client;