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
var Remutable = require("remutable");
var Patch = Remutable.Patch;
var Producer = function Producer(emit, remutableConsumer) {
  if (__DEV__) {
    emit.should.be.a.Function;
    remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
  }
  _.bindAll(this);
  this.emit = emit;
  this.remutableConsumer = remutableConsumer;
};

Producer.prototype.update = function (patch) {
  if (__DEV__) {
    patch.should.be.an.instanceOf(Patch);
  }
  this.emit("update", patch);
  return this;
};

Producer.prototype["delete"] = function () {
  this.emit("delete");
  return this;
};

var Consumer = function Consumer(on, remutableConsumer) {
  var _this = this;
  if (__DEV__) {
    on.should.be.a.Function;
    remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
  }
  _.bindAll(this);
  this.on = on;
  this.remutableConsumer = remutableConsumer;

  if (__DEV__) {
    this._hasOnChange = false;
    this._hasOnDelete = false;
    asap(function () {
      // check that handlers are immediatly set
      try {
        _this._hasOnChange.should.be.true;
        _this._hasOnDelete.should.be.true;
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
  this.on("change", fn);
  if (__DEV__) {
    this._hasOnChange = true;
  }
  return this;
};

Consumer.prototype.onDelete = function (fn) {
  if (__DEV__) {
    fn.should.be.a.Function;
  }
  this.on("delete", fn);
  if (__DEV__) {
    this._hasOnDelete = true;
  }
  return this;
};

var Engine = function Engine() {
  this.remutable = new Remutable();
  this.consumer = this.remutable.createConsumer();
  _.bindAll(this);
  this.events = _.bindAll(new EventEmitter()).on("update", this.update).on("delete", this["delete"]);
};

Engine.prototype.createProducer = function () {
  return new Producer(this.events.emit, this.remutable.createConsumer());
};

Engine.prototype.createConsumer = function (lifespan) {
  if (__DEV__) {
    this.remutable.should.be.an.instanceOf(Remutable);
    lifespan.should.have.property("then").which.is.a.Function;
  }
  return new Consumer(_.bindAll(this.events.within(lifespan)).on, this.consumer);
};

Engine.prototype.update = function (patch) {
  if (__DEV__) {
    this.remutable.should.be.an.instanceOf(Remutable);
    patch.should.be.an.instanceOf(Patch);
    this.remutable.match(patch).should.be.true;
  }
  this.remutable.apply(patch);
  this.events.emit("change", this.consumer, patch);
};

Engine.prototype["delete"] = function () {
  if (__DEV__) {
    this.remutable.should.be.an.instanceOf(Remutable);
  }
  this.remutable = null;
  this.events.emit("delete");
};

module.exports = { Consumer: Consumer, Producer: Producer, Engine: Engine };