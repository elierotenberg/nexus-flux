'use strict';

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _Immutable = require('immutable');

var _Immutable2 = _interopRequireDefault(_Immutable);

var _Remutable = require('remutable');

var _Remutable2 = _interopRequireDefault(_Remutable);

var _Lifespan = require('lifespan');

var _Lifespan2 = _interopRequireDefault(_Lifespan);

var _Store = require('./Store');

var _Store2 = _interopRequireDefault(_Store);

var _Server = require('./Server.Event');

var _Server2 = _interopRequireDefault(_Server);

// we just need this reference for typechecks

var _Event = require('./Client.Event');

require('babel/polyfill');
var _ = require('lodash');
var should = require('should');
var Promise = (global || window).Promise = require('bluebird');
var __DEV__ = process.env.NODE_ENV !== 'production';
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === 'object';
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
var Patch = _Remutable2['default'].Patch;

/**
 * @abstract
 */

var Client = (function () {
  function Client() {
    var _this = this;

    _classCallCheck(this, Client);

    if (__DEV__) {
      this.constructor.should.not.be.exactly(Client); // ensure abstract
      this.fetch.should.not.be.exactly(Client.prototype.fetch); // ensure virtual
      this.sendToServer.should.not.be.exactly(Client.prototype.sendToServer); // ensure virtual
    }
    this.lifespan = new _Lifespan2['default']();
    this._stores = {};
    this._refetching = {};
    this._injected = null;
    this._prefetched = null;
    this.lifespan.onRelease(function () {
      _this._stores = null;
      _this._refetching = null;
      _this._injected = null;
      _this._prefetched = null;
    });
  }

  _createClass(Client, [{
    key: 'fetch',

    /**
     * @virtual
     */
    value: function fetch(path, hash) {
      if (__DEV__) {
        path.should.be.a.String;
        (hash === null || _.isNumber(hash)).should.be['true'];
      }
      throw new TypeError('Virtual method invocation');
    }
  }, {
    key: 'sendToServer',

    /**
     * @virtual
     */
    value: function sendToServer(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }
      throw new TypeError('Virtual method invocation');
    }
  }, {
    key: 'isPrefetching',
    get: function () {
      return this._prefetched !== null;
    }
  }, {
    key: 'getPrefetched',
    value: function getPrefetched(path) {
      if (__DEV__) {
        path.should.be.a.String;
        this.isPrefetching.should.be['true'];
        this._prefetched.should.have.property(path);
        this._prefetched[path].promise.isPending().should.be['false'];
      }
      return this._prefetched[path].head;
    }
  }, {
    key: 'startPrefetching',
    value: function startPrefetching() {
      if (__DEV__) {
        this.isPrefetching.should.not.be['true'];
      }
      this._prefetched = {};
    }
  }, {
    key: 'stopPrefetching',
    value: function stopPrefetching() {
      if (__DEV__) {
        this.isPrefetching.should.be['true'];
      }
      var prefetched = this._prefetched;
      return _.mapValues(prefetched, function (_ref) {
        var head = _ref.head;
        return head ? head.toJS() : void 0;
      });
    }
  }, {
    key: 'prefetch',
    value: function prefetch(path) {
      var _this2 = this;

      if (__DEV__) {
        path.should.be.a.String;
        this.isPrefetching.should.be['true'];
      }
      if (this._prefetched[path] === void 0) {
        (function () {
          var prefetched = {
            promise: null,
            head: null };
          prefetched.promise = _this2.fetch(path, null).then(function (_ref2) {
            var head = _ref2.head;
            return prefetched.head = head;
          })['catch'](function () {
            return prefetched.head = null;
          });
          _this2._prefetched[path] = prefetched;
        })();
      }
      return this._prefetched[path].promise;
    }
  }, {
    key: 'isInjecting',
    get: function () {
      return this._injected !== null;
    }
  }, {
    key: 'getInjected',
    value: function getInjected(path) {
      if (__DEV__) {
        path.should.be.a.String;
      }
      if (this._injected[path] !== void 0) {
        return this._injected[path];
      }
      return null;
    }
  }, {
    key: 'startInjecting',
    value: function startInjecting(injected) {
      if (__DEV__) {
        this.isInjecting.should.not.be['true'];
        injected.should.be.an.Object;
      }
      this._injected = _.mapValues(injected, function (js) {
        return new _Immutable2['default'].Map(js);
      });
    }
  }, {
    key: 'stopInjecting',
    value: function stopInjecting() {
      if (__DEV__) {
        this.isInjecting.should.be['true'];
      }
      this._injected = null;
    }
  }, {
    key: 'receiveFromServer',
    value: function receiveFromServer(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(_Server2['default'].Event);
      }
      if (ev instanceof _Server2['default'].Event.Update) {
        return this._update(ev.path, ev.patch);
      }
      if (ev instanceof _Server2['default'].Event.Delete) {
        return this._delete(ev.path);
      }
      throw new TypeError('Unknown event: ' + ev);
    }
  }, {
    key: 'findOrCreateStore',
    value: function findOrCreateStore(path) {
      if (__DEV__) {
        path.should.be.a.String;
      }
      if (this._stores[path] === void 0) {
        this.sendToServer(new Client.Event.Subscribe({ path: path }));
        var engine = new _Store2['default'].Engine(this.isInjecting ? this.getInjected(path) : void 0);
        this._stores[path] = {
          engine: engine,
          producer: engine.createProducer(),
          patches: {}, // initially we have no pending patches and we are not refetching
          refetching: false };
        this._refetch(path, null);
      }
      return this._stores[path];
    }
  }, {
    key: 'deleteStore',
    value: function deleteStore(path) {
      if (__DEV__) {
        path.should.be.a.String;
        this._stores.should.have.property(path);
        this._stores[path].consumers.should.be.exactly(0);
      }
      this._stores[path].producer.lifespan.release();
      this._stores[path].engine.lifespan.release();
      this.sendToServer(new Client.Event.Unsubscribe({ path: path }));
      delete this._stores[path];
    }
  }, {
    key: 'getStore',
    value: function getStore(path, lifespan) {
      var _this3 = this;

      // returns a Store consumer
      if (__DEV__) {
        path.should.be.a.String;
        lifespan.should.be.an.instanceOf(_Lifespan2['default']);
      }

      var _findOrCreateStore = this.findOrCreateStore(path);

      var engine = _findOrCreateStore.engine;

      var consumer = engine.createConsumer();
      consumer.lifespan.onRelease(function () {
        if (engine.consumers === 0) {
          _this3.deleteStore(path);
        }
      });
      lifespan.onRelease(consumer.lifespan.release);
      return consumer;
    }
  }, {
    key: 'dispatchAction',
    value: function dispatchAction(path) {
      var params = arguments[1] === undefined ? {} : arguments[1];

      if (__DEV__) {
        path.should.be.a.String;
        params.should.be.an.Object;
      }
      this.sendToServer(new Client.Event.Action({ path: path, params: params }));
    }
  }, {
    key: '_update',
    value: function _update(path, patch) {
      if (__DEV__) {
        path.should.be.a.String;
        patch.should.be.an.instanceOf(Patch);
      }
      if (this._stores[path] === void 0) {
        // dismiss if we are not interested anymore
        return null;
      }
      var _stores$path = this._stores[path];
      var producer = _stores$path.producer;
      var patches = _stores$path.patches;
      var refetching = _stores$path.refetching;
      var hash = producer.hash;
      var source = patch.source;
      var target = patch.target;

      if (hash === source) {
        // if the patch applies to our current version, apply it now
        return producer.apply(patch);
      } // we don't have a recent enough version, we need to refetch
      if (!refetching) {
        // if we arent already refetching, request a newer version (atleast newer than target)
        return this._refetch(path, target);
      } // if we are already refetching, store the patch for later
      patches[source] = patch;
    }
  }, {
    key: '_delete',
    value: function _delete(path) {
      if (__DEV__) {
        path.should.be.a.String;
      }
      if (this._stores[path] === void 0) {
        return;
      }
      var producer = this._stores[path].producer;

      producer['delete']();
    }
  }, {
    key: '_refetch',
    value: function _refetch(path, hash) {
      var _this4 = this;

      if (__DEV__) {
        path.should.be.a.String;
        (hash === null || _.isNumber(hash)).should.be['true'];
        this._stores.should.have.property(path);
      }
      this._stores[path].refetching = true;
      // we use the fetch method from the adapter
      return this.fetch(path, hash).then(function (remutable) {
        if (_this4._stores[path] === void 0) {
          // not interested anymore
          return;
        }
        if (__DEV__) {
          _this4._stores[path].refetching.should.be['true'];
        }
        _this4._stores[path].refetching = false;
        _this4._upgrade(path, remutable);
      });
    }
  }, {
    key: '_upgrade',
    value: function _upgrade(path, next) {
      if (__DEV__) {
        path.should.be.a.String;
        (next instanceof _Remutable2['default'] || next instanceof _Remutable2['default'].Consumer).should.be['true'];
      }
      if (this._stores[path] === void 0) {
        // not interested anymore
        return;
      }
      var _stores$path2 = this._stores[path];
      var engine = _stores$path2.engine;
      var producer = _stores$path2.producer;
      var patches = _stores$path2.patches;

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
    }
  }]);

  return Client;
})();

Object.assign(Client, { Event: _Event.Event });

exports['default'] = Client;
module.exports = exports['default'];