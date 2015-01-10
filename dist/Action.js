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

var EVENTS = { DISPATCH: "d" };

var Producer = function Producer(emit, lifespan) {
  var _this = this;
  if (__DEV__) {
    emit.should.be.a.Function;
    lifespan.should.have.property("then").which.is.a.Function;
  }
  Object.assign(this, {
    emit: emit,
    lifespan: Promise.any([lifespan, new Promise(function (resolve) {
      return _this.release = resolve;
    })]) });
  _.bindAll(this);
};

Producer.prototype.dispatch = function (params) {
  if (__DEV__) {
    params.should.be.an.Object;
  }
  this.emit(EVENTS.DISPATCH, params);
  return this;
};

var Consumer = function Consumer(addListener, lifespan) {
  var _this2 = this;
  if (__DEV__) {
    addListener.should.be.a.Function;
    lifespan.should.have.property("then").which.is.a.Function;
  }
  Object.assign(this, {
    addListener: addListener,
    lifespan: Promise.any([lifespan, new Promise(function (resolve) {
      return _this2.release = resolve;
    })]) });
  _.bindAll(this);

  if (__DEV__) {
    this._onDispatchHandlers = 0;
    asap(function () {
      // check that handlers are immediatly set
      try {
        _this2._onDispatchHandlers.should.be.above(0);
      } catch (err) {
        console.warn("StoreConsumer: onDispatch handler should be set immediatly.");
      }
    });
  }
};

Consumer.prototype.onDispatch = function (fn) {
  if (__DEV__) {
    fn.should.be.a.Function;
  }
  this.addListener(EVENTS.DISPATCH, fn, this.lifespan);
  if (__DEV__) {
    this._onDispatchHandlers = this._onDispatchHandlers + 1;
  }
  return this;
};

var Engine = (function () {
  var _EventEmitter = EventEmitter;
  var Engine = function Engine() {
    var _this3 = this;
    _get(Object.getPrototypeOf(Engine.prototype), "constructor", this).call(this);
    this.lifespan = new Promise(function (resolve) {
      return _this3.release = resolve;
    });
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
    this.addListener(EVENTS.UPDATE, this.update, this.lifespan);
    this.addListener(EVENTS.DELETE, this["delete"], this.lifespan);
  };

  _inherits(Engine, _EventEmitter);

  Engine.prototype.createProducer = function () {
    var _this4 = this;
    var producer = new Producer(this.emit, this.lifespan);
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
    var consumer = new Consumer(this.addListener, this.lifespan);
    this.consumers = this.consumers + 1;
    consumer.lifespan.then(function () {
      _this5.consumers = _this5.consumers - 1;
    });
    this.lifespan.then(function () {
      return consumer.release();
    });
    return consumer;
  };

  Engine.prototype.dispatch = function (params) {
    if (__DEV__) {
      params.should.be.an.Object;
    }
    this.emit(EVENTS.DISPATCH, params);
    return this;
  };

  return Engine;
})();

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };