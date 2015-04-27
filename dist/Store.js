'use strict';

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _asap = require('asap');

var _asap2 = _interopRequireDefault(_asap);

var _EventEmitter2 = require('nexus-events');

var _Lifespan = require('lifespan');

var _Lifespan2 = _interopRequireDefault(_Lifespan);

var _Remutable = require('remutable');

var _Remutable2 = _interopRequireDefault(_Remutable);

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

var EVENTS = { UPDATE: 'c', DELETE: 'd' };

var _Engine = undefined;

var Producer = (function () {
  function Producer(engine) {
    var _this = this;

    _classCallCheck(this, Producer);

    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: new _Lifespan2['default']() });
    _.bindAll(this, ['get', 'unset', 'set']);
    // proxy getters to engine.remutableProducers
    ['head', 'working', 'hash', 'version'].forEach(function (p) {
      return Object.defineProperty(_this, p, {
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
    value: function set() {
      // set is chainable
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
    Object.assign(this, {
      _engine: engine,
      lifespan: new _Lifespan2['default']() });
    _.bindAll(this, ['onUpdate', 'onDelete']);

    if (__DEV__) {
      this._onUpdateHandlers = 0;
      this._onDeleteHandlers = 0;
      _asap2['default'](function () {
        // check that handlers are immediatly set
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
    this.lifespan = new _Lifespan2['default']();
    this.remutable = new _Remutable2['default'](data);
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
})(_EventEmitter2.EventEmitter);

_Engine = Engine;

exports['default'] = { Consumer: Consumer, Producer: Producer, Engine: Engine };
module.exports = exports['default'];