"use strict";

var _inherits = function (child, parent) {
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
var asap = require("asap");
var EventEmitter = require("./EventEmitter");
var Remutable = require("remutable");
var Patch = Remutable.Patch;


var EVENTS = { CHANGE: "c", DELETE: "d" };

var Producer = function Producer(emit, remutableConsumer, lifespan) {
  var _this = this;
  if (__DEV__) {
    emit.should.be.a.Function;
    remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    lifespan.should.have.property("then").which.is.a.Function;
  }
  _.bindAll(this);
  Object.assign(this, {
    emit: emit,
    remutableConsumer: remutableConsumer,
    lifespan: Promise.any([lifespan, new Promise(function (resolve) {
      return _this.release = resolve;
    })]) });
};

Producer.prototype.update = function (patch) {
  if (__DEV__) {
    patch.should.be.an.instanceOf(Patch);
  }
  this.emit(EVENTS.UPDATE, patch);
  return this;
};

Producer.prototype["delete"] = function () {
  this.emit(EVENTS.DELETE);
  return this;
};

var Consumer = function Consumer(addListener, remutableConsumer, lifespan) {
  var _this2 = this;
  if (__DEV__) {
    addListener.should.be.a.Function;
    remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    lifespan.should.have.property("then").which.is.a.Function;
  }
  _.bindAll(this);
  Object.assign(this, {
    addListener: addListener,
    remutableConsumer: remutableConsumer,
    lifespan: Promise.any([lifespan, new Promise(function (resolve) {
      return _this2.release = resolve;
    })]) });

  if (__DEV__) {
    this._onChangeHandlers = 0;
    this._onDeleteHandlers = 0;
    asap(function () {
      // check that handlers are immediatly set
      try {
        _this2._onChangeHandlers.should.be.above(0);
        _this2._onDeleteHandlers.should.be.above(0);
      } catch (err) {
        console.warn("StoreConsumer: both onChange and onDelete handlers should be set immediatly.");
      }
    });
  }
};

Consumer.prototype.onChange = function (fn) {
  if (__DEV__) {
    fn.should.be.a.Function;
  }
  this.addListener(EVENTS.CHANGE, fn, this.lifespan);
  if (__DEV__) {
    this._onChangeHandlers = this._onChangeHandlers + 1;
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
  var Engine = function Engine() {
    var _this3 = this;
    this.remutable = new Remutable();
    this.remutableConsumer = this.remutable.createConsumer();
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
    var producer = new Producer(this.emit, this.remutable.createConsumer(), this.lifespan);
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
    var consumer = new Consumer(this.addListener, this.remutableConsumer, this.lifespan);
    this.consumers = this.consumers + 1;
    consumer.lifespan.then(function () {
      _this5.consumers = _this5.consumers - 1;
    });
    this.lifespan.then(function () {
      return consumer.release();
    });
    return consumer;
  };

  Engine.prototype.update = function (patch) {
    if (__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
      patch.should.be.an.instanceOf(Patch);
      this.remutable.match(patch).should.be.true;
    }
    this.remutable.apply(patch);
    this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
    return this;
  };

  Engine.prototype["delete"] = function () {
    if (__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
    }
    this.remutable = null;
    this.remutableConsumer = null;
    this.emit(EVENTS.DELETE);
    return this;
  };

  return Engine;
})();

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };