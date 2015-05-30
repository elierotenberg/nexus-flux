'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _Object$assign = require('babel-runtime/core-js/object/assign')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _asap = require('asap');

var _asap2 = _interopRequireDefault(_asap);

var _nexusEvents = require('nexus-events');

var _lifespan = require('lifespan');

var _lifespan2 = _interopRequireDefault(_lifespan);

var _remutable = require('remutable');

var _remutable2 = _interopRequireDefault(_remutable);

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
var Patch = _remutable2['default'].Patch;

var EVENTS = { UPDATE: 'c', DELETE: 'd' };

var _Engine = undefined;

var Producer = (function () {
  function Producer(engine) {
    var _this = this;

    _classCallCheck(this, Producer);

    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    _Object$assign(this, {
      _engine: engine,
      lifespan: new _lifespan2['default']() });
    _.bindAll(this, ['get', 'unset', 'set']);
    // proxy getters to engine.remutableProducers
    ['head', 'working', 'hash', 'version'].forEach(function (p) {
      return _Object$defineProperty(_this, p, {
        enumerable: true,
        get: function get() {
          return engine.remutableProducer[p];
        } });
    });
    // proxy methods to engine.remutableProducers
    ['rollback', 'match'].forEach(function (m) {
      return _this[m] = engine.remutableProducer[m];
    });
    // proxy methods to engine
    ['apply', 'commit', 'delete'].forEach(function (m) {
      return _this[m] = engine[m];
    });
  }

  _createClass(Producer, [{
    key: 'get',
    value: function get(path) {
      if (__DEV__) {
        path.should.be.a.String;
      }
      return this.working.get(path);
    }
  }, {
    key: 'unset',
    value: function unset(path) {
      if (__DEV__) {
        path.should.be.a.String;
      }
      return this.set(path, void 0);
    }
  }, {
    key: 'set',

    // chainable
    value: function set() {
      this._engine.remutableProducer.set.apply(this._engine.remutableProducer, arguments);
      return this;
    }
  }]);

  return Producer;
})();

var Consumer = (function () {
  function Consumer(engine) {
    var _this2 = this;

    _classCallCheck(this, Consumer);

    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    _Object$assign(this, {
      _engine: engine,
      lifespan: new _lifespan2['default']() });
    _.bindAll(this, ['onUpdate', 'onDelete']);

    if (__DEV__) {
      this._onUpdateHandlers = 0;
      this._onDeleteHandlers = 0;
      // check that handlers are immediatly set
      _asap2['default'](function () {
        try {
          _this2._onUpdateHandlers.should.be.above(0);
          _this2._onDeleteHandlers.should.be.above(0);
        } catch (err) {
          console.warn('StoreConsumer: both onUpdate and onDelete handlers should be set immediatly.');
        }
      });
    }
  }

  _createClass(Consumer, [{
    key: 'value',
    get: function () {
      return this._engine.remutableConsumer.head;
    }
  }, {
    key: 'onUpdate',
    value: function onUpdate(fn) {
      if (__DEV__) {
        fn.should.be.a.Function;
      }
      this._engine.addListener(EVENTS.UPDATE, fn, this.lifespan);
      if (__DEV__) {
        this._onUpdateHandlers = this._onUpdateHandlers + 1;
      }
      return this;
    }
  }, {
    key: 'onDelete',
    value: function onDelete(fn) {
      if (__DEV__) {
        fn.should.be.a.Function;
      }
      this._engine.addListener(EVENTS.DELETE, fn, this.lifespan);
      if (__DEV__) {
        this._onDeleteHandlers = this._onDeleteHandlers + 1;
      }
      return this;
    }
  }]);

  return Consumer;
})();

var Engine = (function (_EventEmitter) {
  function Engine() {
    var _this3 = this;

    var data = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Engine);

    _get(Object.getPrototypeOf(Engine.prototype), 'constructor', this).call(this);
    this.lifespan = new _lifespan2['default']();
    this.remutable = new _remutable2['default'](data);
    _.bindAll(this, ['createProducer', 'createConsumer', 'apply', 'commit', 'delete']);
    this.remutableProducer = this.remutable.createProducer();
    this.remutableConsumer = this.remutable.createConsumer();
    this.consumers = 0;
    this.producers = 0;
    this.lifespan.onRelease(function () {
      if (__DEV__) {
        _this3.consumers.should.be.exactly(0);
        _this3.producers.should.be.exactly(0);
      }
      _this3.remutable = null;
      _this3.remutableConsumer = null;
      _this3.remutableProducer = null;
    });
  }

  _inherits(Engine, _EventEmitter);

  _createClass(Engine, [{
    key: 'createProducer',
    value: function createProducer() {
      var _this4 = this;

      var producer = new Producer(this);
      this.producers = this.producers + 1;
      producer.lifespan.onRelease(function () {
        return _this4.producers = _this4.producers - 1;
      });
      return producer;
    }
  }, {
    key: 'createConsumer',
    value: function createConsumer() {
      var _this5 = this;

      var consumer = new Consumer(this);
      this.consumers = this.consumers + 1;
      consumer.lifespan.onRelease(function () {
        return _this5.consumers = _this5.consumers - 1;
      });
      return consumer;
    }
  }, {
    key: 'apply',
    value: function apply(patch) {
      if (__DEV__) {
        patch.should.be.an.instanceOf(Patch);
      }
      this.remutable.apply(patch);
      this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
    }
  }, {
    key: 'commit',
    value: function commit() {
      var patch = this.remutable.commit();
      this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
    }
  }, {
    key: 'delete',
    value: function _delete() {
      this.emit(EVENTS.DELETE);
    }
  }]);

  return Engine;
})(_nexusEvents.EventEmitter);

_Engine = Engine;

exports['default'] = { Consumer: Consumer, Producer: Producer, Engine: Engine };
module.exports = exports['default'];