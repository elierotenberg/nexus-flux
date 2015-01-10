"use strict";

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (child, parent) {
  if (typeof parent !== "function" && parent !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof parent);
  }
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
var asap = _interopRequire(require("asap"));

var EventEmitter = _interopRequire(require("./EventEmitter"));

var Remutable = _interopRequire(require("remutable"));

var Patch = Remutable.Patch;


var EVENTS = { UPDATE: "c", DELETE: "d" };

var _Engine = undefined;

var Producer = function Producer(engine) {
  var _this = this;
  if (__DEV__) {
    engine.should.be.an.instanceOf(_Engine);
  }
  _.bindAll(this);
  Object.assign(this, {
    engine: engine,
    lifespan: Promise.any([engine.lifespan, new Promise(function (resolve) {
      return _this.release = resolve;
    })]) });
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
};

Producer.prototype.set = function () {
  // set is chainable
  this.engine.remutableProducer.set.apply(this.engine.remutableProducer, arguments);
  return this;
};

var Consumer = function Consumer(engine) {
  var _this2 = this;
  if (__DEV__) {
    engine.should.be.an.instanceOf(_Engine);
  }
  var addListener = engine.addListener;
  var remutableConsumer = engine.remutableConsumer;
  var lifespan = engine.lifespan;
  Object.assign(this, {
    addListener: addListener,
    remutableConsumer: remutableConsumer,
    lifespan: Promise.any([lifespan, new Promise(function (resolve) {
      return _this2.release = resolve;
    })]) });
  _.bindAll(this);

  if (__DEV__) {
    this._onUpdateHandlers = 0;
    this._onDeleteHandlers = 0;
    asap(function () {
      // check that handlers are immediatly set
      try {
        _this2._onUpdateHandlers.should.be.above(0);
        _this2._onDeleteHandlers.should.be.above(0);
      } catch (err) {
        console.warn("StoreConsumer: both onUpdate and onDelete handlers should be set immediatly.");
      }
    });
  }
};

Consumer.prototype.onUpdate = function (fn) {
  if (__DEV__) {
    fn.should.be.a.Function;
  }
  this.addListener(EVENTS.UPDATE, fn, this.lifespan);
  if (__DEV__) {
    this._onUpdateHandlers = this._onUpdateHandlers + 1;
  }
  return this;
};

Consumer.prototype.onDelete = function (fn) {
  if (__DEV__) {
    fn.should.be.a.Function;
  }
  this.addListener(EVENTS.DELETE, fn, this.lifespan);
  if (__DEV__) {
    this._onDeleteHandlers = this._onDeleteHandlers + 1;
  }
  return this;
};

_prototypeProperties(Consumer, null, {
  value: {
    get: function () {
      return this.remutableConsumer.head;
    },
    enumerable: true
  }
});

var Engine = (function () {
  var _EventEmitter = EventEmitter;
  var Engine = function Engine(init) {
    var _this3 = this;
    init = init || {};
    if (__DEV__) {
      init.should.be.an.Object;
      _.each(init, function (val, key) {
        key.should.be.a.String;
      });
    }
    _get(Object.getPrototypeOf(Engine.prototype), "constructor", this).call(this);
    this.remutable = new Remutable(init);
    this.remutableProducer = this.remutable.createProducer();
    this.remutableConsumer = this.remutable.createConsumer();
    this.lifespan = new Promise(function (resolve) {
      return _this3.release = resolve;
    });
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
  };

  _inherits(Engine, _EventEmitter);

  Engine.prototype.createProducer = function () {
    var _this4 = this;
    var producer = new Producer(this);
    this.producers = this.producers + 1;
    producer.lifespan.then(function () {
      _this4.producers = _this4.producers - 1;
    });
    this.lifespan.then(function () {
      return producer.release();
    });
    return producer;
  };

  Engine.prototype.createConsumer = function () {
    var _this5 = this;
    var consumer = new Consumer(this);
    this.consumers = this.consumers + 1;
    consumer.lifespan.then(function () {
      _this5.consumers = _this5.consumers - 1;
    });
    this.lifespan.then(function () {
      return consumer.release();
    });
    return consumer;
  };

  Engine.prototype.apply = function (patch) {
    if (__DEV__) {
      patch.should.be.an.instanceOf(Patch);
    }
    this.remutable.apply(patch);
    this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
  };

  Engine.prototype.commit = function () {
    var patch = this.remutable.commit();
    this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
  };

  Engine.prototype["delete"] = function () {
    this.emit(EVENTS.DELETE);
    this.remutable = null;
    this.remutableProducer = null;
    this.remutableConsumer = null;
  };

  return Engine;
})();

_Engine = Engine;

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };