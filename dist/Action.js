"use strict";

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
var _ref = require("lifespan");

var EventEmitter = _ref.EventEmitter;
var Producer = function Producer(emit) {
  if (__DEV__) {
    emit.should.be.a.Function;
  }
  _.bindAll(this);
  this.emit = emit;
};

Producer.prototype.dispatch = function (params) {
  this.emit("dispatch", params);
  return this;
};

var Consumer = function Consumer(on) {
  var _this = this;
  if (__DEV__) {
    on.should.be.a.Function;
  }
  _.bindAll(this);
  this.on = on;
  if (__DEV__) {
    this._hasOnDispatch = false;
    asap(function () {
      // check that handlers are immediatly set
      try {
        _this._hasOnDispatch.should.be.true;
      } catch (err) {
        console.warn("ActionConsumer: onDispatch handler should be set immediatly.");
      }
    });
  }
};

Consumer.prototype.onDispatch = function (fn) {
  if (__DEV__) {
    fn.should.be.a.Function;
  }
  this.on("dispatch", fn);
  if (__DEV__) {
    this._hasOnDispatch = true;
  }
  return this;
};

var Engine = function Engine() {
  _.bindAll(this);
  this.events = _.bindAll(new EventEmitter());
};

Engine.prototype.createProducer = function () {
  return new Producer(this.events.emit);
};

Engine.prototype.createConsumer = function (lifespan) {
  if (__DEV__) {
    lifespan.should.have.property("then").which.is.a.Function;
  }
  return new Consumer(_.bindAll(this.events.within(lifespan)).on);
};

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };