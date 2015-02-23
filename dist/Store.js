"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

require("babel/polyfill");
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

var asap = _interopRequire(require("asap"));

var EventEmitter = require("nexus-events").EventEmitter;

var Lifespan = _interopRequire(require("lifespan"));

var Remutable = _interopRequire(require("remutable"));

var Patch = Remutable.Patch;

var EVENTS = { UPDATE: "c", DELETE: "d" };

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
      lifespan: new Lifespan() });
    _.bindAll(this, ["get", "unset", "set"]);
    // proxy getters to engine.remutableProducers
    ["head", "working", "hash", "version"].forEach(function (p) {
      return Object.defineProperty(_this, p, {
        enumerable: true,
        get: function () {
          return engine.remutableProducer[p];
        } });
    });
    // proxy methods to engine.remutableProducers
    ["rollback", "match"].forEach(function (m) {
      return _this[m] = engine.remutableProducer[m];
    });
    // proxy methods to engine
    ["apply", "commit", "delete"].forEach(function (m) {
      return _this[m] = engine[m];
    });
  }

  _prototypeProperties(Producer, null, {
    get: {
      value: function get(path) {
        if (__DEV__) {
          path.should.be.a.String;
        }
        return this.working.get(path);
      },
      writable: true,
      configurable: true
    },
    unset: {
      value: function unset(path) {
        if (__DEV__) {
          path.should.be.a.String;
        }
        return this.set(path, void 0);
      },
      writable: true,
      configurable: true
    },
    set: {
      value: function set() {
        // set is chainable
        this._engine.remutableProducer.set.apply(this._engine.remutableProducer, arguments);
        return this;
      },
      writable: true,
      configurable: true
    }
  });

  return Producer;
})();

var Consumer = (function () {
  function Consumer(engine) {
    var _this = this;

    _classCallCheck(this, Consumer);

    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: new Lifespan() });
    _.bindAll(this, ["onUpdate", "onDelete"]);

    if (__DEV__) {
      this._onUpdateHandlers = 0;
      this._onDeleteHandlers = 0;
      asap(function () {
        // check that handlers are immediatly set
        try {
          _this._onUpdateHandlers.should.be.above(0);
          _this._onDeleteHandlers.should.be.above(0);
        } catch (err) {
          console.warn("StoreConsumer: both onUpdate and onDelete handlers should be set immediatly.");
        }
      });
    }
  }

  _prototypeProperties(Consumer, null, {
    value: {
      get: function () {
        return this._engine.remutableConsumer.head;
      },
      configurable: true
    },
    onUpdate: {
      value: function onUpdate(fn) {
        if (__DEV__) {
          fn.should.be.a.Function;
        }
        this._engine.addListener(EVENTS.UPDATE, fn, this.lifespan);
        if (__DEV__) {
          this._onUpdateHandlers = this._onUpdateHandlers + 1;
        }
        return this;
      },
      writable: true,
      configurable: true
    },
    onDelete: {
      value: function onDelete(fn) {
        if (__DEV__) {
          fn.should.be.a.Function;
        }
        this._engine.addListener(EVENTS.DELETE, fn, this.lifespan);
        if (__DEV__) {
          this._onDeleteHandlers = this._onDeleteHandlers + 1;
        }
        return this;
      },
      writable: true,
      configurable: true
    }
  });

  return Consumer;
})();

var Engine = (function (EventEmitter) {
  function Engine() {
    var _this = this;

    var data = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Engine);

    _get(Object.getPrototypeOf(Engine.prototype), "constructor", this).call(this);
    this.lifespan = new Lifespan();
    this.remutable = new Remutable(data);
    _.bindAll(this, ["createProducer", "createConsumer", "apply", "commit", "delete"]);
    this.remutableProducer = this.remutable.createProducer();
    this.remutableConsumer = this.remutable.createConsumer();
    this.consumers = 0;
    this.producers = 0;
    this.lifespan.onRelease(function () {
      if (__DEV__) {
        _this.consumers.should.be.exactly(0);
        _this.producers.should.be.exactly(0);
      }
      _this.remutable = null;
      _this.remutableConsumer = null;
      _this.remutableProducer = null;
    });
  }

  _inherits(Engine, EventEmitter);

  _prototypeProperties(Engine, null, {
    createProducer: {
      value: function createProducer() {
        var _this = this;

        var producer = new Producer(this);
        this.producers = this.producers + 1;
        producer.lifespan.onRelease(function () {
          return _this.producers = _this.producers - 1;
        });
        return producer;
      },
      writable: true,
      configurable: true
    },
    createConsumer: {
      value: function createConsumer() {
        var _this = this;

        var consumer = new Consumer(this);
        this.consumers = this.consumers + 1;
        consumer.lifespan.onRelease(function () {
          return _this.consumers = _this.consumers - 1;
        });
        return consumer;
      },
      writable: true,
      configurable: true
    },
    apply: {
      value: function apply(patch) {
        if (__DEV__) {
          patch.should.be.an.instanceOf(Patch);
        }
        this.remutable.apply(patch);
        this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
      },
      writable: true,
      configurable: true
    },
    commit: {
      value: function commit() {
        var patch = this.remutable.commit();
        this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
      },
      writable: true,
      configurable: true
    },
    "delete": {
      value: function _delete() {
        this.emit(EVENTS.DELETE);
      },
      writable: true,
      configurable: true
    }
  });

  return Engine;
})(EventEmitter);

_Engine = Engine;

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };