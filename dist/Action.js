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

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
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

var EventEmitter = require("nexus-events").EventEmitter;
var Lifespan = _interopRequire(require("lifespan"));

var EVENTS = { DISPATCH: "d" };
var _Engine = undefined;

var Producer = (function () {
  function Producer(engine) {
    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    _.bindAll(this);
    Object.assign(this, {
      _engine: engine,
      lifespan: new Lifespan() });
  }

  _prototypeProperties(Producer, null, {
    dispatch: {
      value: function dispatch(params, clientID) {
        if (__DEV__) {
          params.should.be.an.Object;
          if (clientID !== void 0) {
            clientID.should.be.a.String;
          }
        }
        this._engine.dispatch(params, clientID);
        return this;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Producer;
})();

var Consumer = (function () {
  function Consumer(engine) {
    var _this = this;
    if (__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: new Lifespan() });
    _.bindAll(this);

    if (__DEV__) {
      this._onDispatchHandlers = 0;
      asap(function () {
        // check that handlers are immediatly set
        try {
          _this._onDispatchHandlers.should.be.above(0);
        } catch (err) {
          console.warn("StoreConsumer: onDispatch handler should be set immediatly.");
        }
      });
    }
  }

  _prototypeProperties(Consumer, null, {
    onDispatch: {
      value: function onDispatch(fn) {
        if (__DEV__) {
          fn.should.be.a.Function;
        }
        this._engine.addListener(EVENTS.DISPATCH, fn, this.lifespan);
        if (__DEV__) {
          this._onDispatchHandlers = this._onDispatchHandlers + 1;
        }
        return this;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Consumer;
})();

var Engine = (function (EventEmitter) {
  function Engine() {
    var _this2 = this;
    _get(Object.getPrototypeOf(Engine.prototype), "constructor", this).call(this);
    this.lifespan = new Lifespan();
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
    this.lifespan.onRelease(function () {
      if (__DEV__) {
        _this2.consumers.should.be.exactly(0);
        _this2.producers.should.be.exactly(0);
      }
      _this2.consumers = null;
      _this2.producers = null;
    });
  }

  _inherits(Engine, EventEmitter);

  _prototypeProperties(Engine, null, {
    createProducer: {
      value: function createProducer() {
        var _this3 = this;
        var producer = new Producer(this);
        this.producers = this.producers + 1;
        producer.lifespan.onRelease(function () {
          return _this3.producers = _this3.producers - 1;
        });
        return producer;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    createConsumer: {
      value: function createConsumer() {
        var _this4 = this;
        var consumer = new Consumer(this);
        this.consumers = this.consumers + 1;
        consumer.lifespan.onRelease(function () {
          return _this4.consumers = _this4.consumers - 1;
        });
        return consumer;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    dispatch: {
      value: function dispatch(params, clientHash) {
        if (__DEV__) {
          params.should.be.an.Object;
          if (clientHash !== void 0) {
            clientHash.should.be.a.String;
          }
        }
        this.emit(EVENTS.DISPATCH, params, clientHash);
        return this;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Engine;
})(EventEmitter);

_Engine = Engine;

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };