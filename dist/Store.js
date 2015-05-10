'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _get = function get(_x2, _x3, _x4) { var _again = true; _function: while (_again) { desc = parent = getter = undefined; _again = false; var object = _x2,
    property = _x3,
    receiver = _x4; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x2 = parent; _x3 = property; _x4 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _asap = require('asap');

var _asap2 = _interopRequireDefault(_asap);

var _nexusEvents = require('nexus-events');

var _lifespan = require('lifespan');

var _lifespan2 = _interopRequireDefault(_lifespan);

var _remutable = require('remutable');

var _remutable2 = _interopRequireDefault(_remutable);

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
var Patch = _remutable2['default'].Patch;

var EVENTS = { UPDATE: 'c', DELETE: 'd' };

var _Engine = undefined;

var Producer = (function () {
  function Producer(engine) {
    var _this2 = this;

    _classCallCheck(this, Producer);

    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: new _lifespan2['default']() });
    _.bindAll(this, ['get', 'unset', 'set']);
    // proxy getters to engine.remutableProducers
    ['head', 'working', 'hash', 'version'].forEach(function (p) {
      return Object.defineProperty(_this2, p, {
        enumerable: true,
        get: function get() {
          return engine.remutableProducer[p];
        } });
    });
    // proxy methods to engine.remutableProducers
    ['rollback', 'match'].forEach(function (m) {
      return _this2[m] = engine.remutableProducer[m];
    });
    // proxy methods to engine
    ['apply', 'commit', 'delete'].forEach(function (m) {
      return _this2[m] = engine[m];
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
    var _this3 = this;

    _classCallCheck(this, Consumer);

    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: new _lifespan2['default']() });
    _.bindAll(this, ['onUpdate', 'onDelete']);

    if (__DEV__) {
      this._onUpdateHandlers = 0;
      this._onDeleteHandlers = 0;
      // check that handlers are immediatly set
      _asap2['default'](function () {
        try {
          _this3._onUpdateHandlers.should.be.above(0);
          _this3._onDeleteHandlers.should.be.above(0);
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
    var _this4 = this;

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
        _this4.consumers.should.be.exactly(0);
        _this4.producers.should.be.exactly(0);
      }
      _this4.remutable = null;
      _this4.remutableConsumer = null;
      _this4.remutableProducer = null;
    });
  }

  _inherits(Engine, _EventEmitter);

  _createClass(Engine, [{
    key: 'createProducer',
    value: function createProducer() {
      var _this5 = this;

      var producer = new Producer(this);
      this.producers = this.producers + 1;
      producer.lifespan.onRelease(function () {
        return _this5.producers = _this5.producers - 1;
      });
      return producer;
    }
  }, {
    key: 'createConsumer',
    value: function createConsumer() {
      var _this6 = this;

      var consumer = new Consumer(this);
      this.consumers = this.consumers + 1;
      consumer.lifespan.onRelease(function () {
        return _this6.consumers = _this6.consumers - 1;
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