"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
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
var Immutable = _interopRequire(require("immutable"));

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
var Client = (function () {
  function Client() {
    var _this = this;
    var clientID = arguments[0] === undefined ? _.uniqueId("Client" + _.random(1, INT_MAX - 1)) : arguments[0];
    return (function () {
      if (__DEV__) {
        clientID.should.be.a.String;
        _this.constructor.should.not.be.exactly(Client); // ensure abstract
        _this.fetch.should.not.be.exactly(Client.prototype.fetch); // ensure virtual
        _this.sendToServer.should.not.be.exactly(Client.prototype.sendToServer); // ensure virtual
      }
      _this.lifespan = new Lifespan();
      _.bindAll(_this);
      _this._clientID = clientID;
      _this._stores = {};
      _this._refetching = {};
      _this._actions = {};
      _this._injected = null;
      _this._prefetched = null;
      _this.lifespan.onRelease(function () {
        _this._clientID = null;
        _this._stores = null;
        _this._refetching = null;
        _this._actions = null;
        _this._injected = null;
        _this._prefetched = null;
      });

      _this.sendToServer(new Client.Event.Open({ clientID: clientID }));
    })();
  }

  _prototypeProperties(Client, null, {
    fetch: {

      /**
       * @virtual
       */
      value: function fetch(path, hash) {
        if (__DEV__) {
          path.should.be.a.String;
          (hash === null || _.isString(hash)).should.be["true"];
        }
        throw new TypeError("Virtual method invocation");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    sendToServer: {

      /**
       * @virtual
       */
      value: function sendToServer(ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Client.Event);
        }
        throw new TypeError("Virtual method invocation");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    isPrefetching: {
      get: function () {
        return this._prefetched !== null;
      },
      enumerable: true,
      configurable: true
    },
    getPrefetched: {
      value: function getPrefetched(path) {
        if (__DEV__) {
          path.should.be.a.String;
          this.isPrefetching.should.be["true"];
          this._prefetched.should.have.property(path);
          this._prefetched[path].promise.isPending().should.be["false"];
        }
        return this._prefetched[path].head;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    startPrefetching: {
      value: function startPrefetching() {
        if (__DEV__) {
          this.isPrefetching.should.not.be["true"];
        }
        this._prefetched = {};
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stopPrefetching: {
      value: function stopPrefetching() {
        if (__DEV__) {
          this.isPrefetching.should.be["true"];
        }
        var prefetched = this._prefetched;
        return _.mapValues(prefetched, function (_ref) {
          var head = _ref.head;
          return head ? head.toJS() : void 0;
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    prefetch: {
      value: function prefetch(path) {
        var _this2 = this;
        if (__DEV__) {
          path.should.be.a.String;
          this.isPrefetching.should.be["true"];
        }
        if (this._prefetched[path] === void 0) {
          (function () {
            var prefetched = {
              promise: null,
              head: null };
            prefetched.promise = _this2.fetch(path, null).then(function (_ref2) {
              var head = _ref2.head;
              return prefetched.head = head;
            })["catch"](function () {
              return prefetched.head = null;
            });
            _this2._prefetched[path] = prefetched;
          })();
        }
        return this._prefetched[path].promise;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    isInjecting: {
      get: function () {
        return this._injected !== null;
      },
      enumerable: true,
      configurable: true
    },
    getInjected: {
      value: function getInjected(path) {
        if (__DEV__) {
          path.should.be.a.String;
        }
        if (this._injected[path] !== void 0) {
          return this._injected[path];
        }
        return null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    startInjecting: {
      value: function startInjecting(injected) {
        if (__DEV__) {
          this.isInjecting.should.not.be["true"];
          injected.should.be.an.Object;
        }
        this._injected = _.mapValues(injected, function (js) {
          return Immutable.Map(js);
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stopInjecting: {
      value: function stopInjecting() {
        if (__DEV__) {
          this.isInjecting.should.be["true"];
        }
        this._injected = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    receiveFromServer: {
      value: function receiveFromServer(ev) {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    Store: {
      value: (function (_Store) {
        var _StoreWrapper = function Store() {
          return _Store.apply(this, arguments);
        };

        _StoreWrapper.toString = function () {
          return _Store.toString();
        };

        return _StoreWrapper;
      })(function (path, lifespan) {
        var _this3 = this;
        // returns a Store consumer
        if (__DEV__) {
          path.should.be.a.String;
          lifespan.should.be.an.instanceOf(Lifespan);
        }
        var _ref3 = this._stores[path] || (function () {
          // if we don't know this store yet, then subscribe
          _this3.sendToServer(new Client.Event.Subscribe({ path: path }));
          var engine = new Store.Engine(_this3.isInjecting ? _this3.getInjected(path) : null);
          _this3._stores[path] = {
            engine: engine,
            producer: engine.createProducer(),
            patches: {}, // initially we have no pending patches and we are not refetching
            refetching: false };
          _this3._refetch(path, null);
          return _this3._stores[path];
        })();
        var engine = _ref3.engine;
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
      }),
      writable: true,
      enumerable: true,
      configurable: true
    },
    Action: {
      value: (function (_Action) {
        var _ActionWrapper = function Action() {
          return _Action.apply(this, arguments);
        };

        _ActionWrapper.toString = function () {
          return _Action.toString();
        };

        return _ActionWrapper;
      })(function (path, lifespan) {
        var _this4 = this;
        // returns an Action producer
        if (__DEV__) {
          path.should.be.a.String;
          lifespan.should.be.an.instanceOf(Lifespan);
        }
        var _ref4 = this._actions[path] || (function () {
          // if we don't know this action yet, start observing it
          var engine = new Action.Engine();
          return _this4._actions[path] = {
            engine: engine,
            consumer: engine.createConsumer().onDispatch(function (params) {
              return _this4.sendToServer(new Client.Event.Dispatch({ path: path, params: params }));
            }) };
        })();
        var engine = _ref4.engine;
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
      }),
      writable: true,
      enumerable: true,
      configurable: true
    },
    _update: {
      value: function Update(path, patch) {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _delete: {
      value: function Delete(path) {
        if (__DEV__) {
          path.should.be.a.String;
        }
        if (this._stores[path] === void 0) {
          return;
        }
        var producer = this._stores[path].producer;
        producer["delete"]();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _refetch: {
      value: function Refetch(path, target) {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _upgrade: {
      value: function Upgrade(path, next) {
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
        _.each(patches, function (_ref5, source) {
          var to = _ref5.to;
          if (to.v <= version) {
            delete patches[source];
          }
        });
        producer.apply(squash);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Client;
})();

Object.assign(Client, { Event: Event });

module.exports = Client;