"use strict";

var _slice = Array.prototype.slice;
var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
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

// My custom implementation of EventEmitter, with fast & easy listener removal for when tons of listeners are set.
var EventEmitter = function EventEmitter(debug) {
  var _this = this;
  if (debug === undefined) debug = __DEV__;
  return (function () {
    _this._listeners = {};
    _this._debug = debug;
    _.bindAll(_this);
  })();
};

EventEmitter.prototype.addListener = function (ev, fn, lifespan) {
  var _this2 = this;
  if (__DEV__) {
    ev.should.be.a.String;
    fn.should.be.a.Function;
    lifespan.should.have.property("then").which.is.a.Function;
  }
  if (this._listeners[ev] === void 0) {
    this._listeners[ev] = {};
  }
  var ln = _.uniqueId();
  this._listeners[ev][ln] = fn;
  lifespan.then(function () {
    return _this2._removeListener(ev, ln);
  });
  return this;
};

EventEmitter.prototype._removeListener = function (ev, ln) {
  if (__DEV__) {
    ev.should.be.a.String;
    ln.should.be.a.String;
    this._listeners.should.have.property(ev);
    this._listeners[ev].should.have.property(ln);
  }
  delete this._listeners[ev][ln];
  if (_.size(this._listeners[ev]) === 0) {
    delete this._listeners[ev];
  }
};

EventEmitter.prototype.emit = function (ev) {
  var args = _slice.call(arguments, 1);

  if (__DEV__) {
    ev.should.be.a.String;
  }
  if (this._listeners[ev] !== void 0) {
    _.each(this._listeners[ev], function (fn) {
      return fn.apply(null, _toArray(args));
    });
  } else if (this._debug) {
    console.warn("Emitting event " + ev + " " + args + " without listeners, this may be a bug.");
  }
};

module.exports = EventEmitter;