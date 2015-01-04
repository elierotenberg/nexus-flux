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
var _ref = require("remutable");

var Patch = _ref.Patch;
var Event = function Event() {
  if (__DEV__) {
    this.should.have.property("_toJS").which.is.a.Function;
    this.constructor.should.have.property("fromJS").which.is.a.Function;
    this.constructor.should.have.property("t").which.is.a.Function;
  }
  Object.assign(this, {
    _json: null,
    _js: null });
};

Event.prototype.toJS = function () {
  if (this._js === null) {
    this._js = {
      t: this.constructor.t(),
      j: this._toJS() };
  }
  return this._js;
};

Event.prototype.toJSON = function () {
  if (this._json === null) {
    this._json = JSON.stringify(this.toJS());
  }
  return this._json;
};

Event.fromJSON = function (json) {
  var _ref2 = JSON.parse(json);

  var _t = _ref2.t;
  var j = _ref2.j;
  return Event._[_t].fromJS(j);
};

var Update = (function () {
  var _Event = Event;
  var Update = function Update(path, patch) {
    if (__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    _Event.call(this);
    Object.assign(this, { path: path, patch: patch });
  };

  _inherits(Update, _Event);

  Update.prototype._toJS = function () {
    return {
      p: this.path,
      u: this.patch.toJS() };
  };

  Update.t = function () {
    return "u";
  };

  Update.fromJS = function (_ref3) {
    var p = _ref3.p;
    var u = _ref3.u;
    if (__DEV__) {
      p.should.be.a.String;
      u.should.be.an.Object;
    }
    return new Update(p, Patch.fromJS(u));
  };

  return Update;
})();

var Delete = (function () {
  var _Event2 = Event;
  var Delete = function Delete(path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    _Event2.call(this);
    Object.assign(this, { path: path });
  };

  _inherits(Delete, _Event2);

  Delete.prototype._toJS = function () {
    return { p: this.patch };
  };

  Delete.t = function () {
    return "d";
  };

  Delete.fromJS = function (_ref4) {
    var p = _ref4.p;
    if (__DEV__) {
      p.should.be.a.String;
    }
    return new Delete(p);
  };

  return Delete;
})();

Event._ = {};
Event.Update = Event._[Update.t()] = Update;
Event.Delete = Event._[Delete.t()] = Delete;

module.exports = { Event: Event };