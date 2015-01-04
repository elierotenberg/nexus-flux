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
  var _ref = JSON.parse(json);

  var _t = _ref.t;
  var j = _ref.j;
  return Event._[_t].fromJS(j);
};

var Open = (function () {
  var _Event = Event;
  var Open = function Open(_ref2) {
    var clientID = _ref2.clientID;
    if (__DEV__) {
      clientID.should.be.a.String;
    }
    _Event.call(this);
    Object.assign(this, { clientID: clientID });
  };

  _inherits(Open, _Event);

  Open.prototype._toJS = function () {
    return { c: this.clientID };
  };

  Open.t = function () {
    return "o";
  };

  Open.fromJS = function (_ref3) {
    var c = _ref3.c;
    return new Open(c);
  };

  return Open;
})();

var Close = (function () {
  var _Event2 = Event;
  var Close = function Close() {
    if (_Event2) {
      _Event2.apply(this, arguments);
    }
  };

  _inherits(Close, _Event2);

  Close.prototype._toJS = function () {
    return {};
  };

  Close.t = function () {
    return "c";
  };

  Close.fromJS = function () {
    return new Close();
  };

  return Close;
})();

var Subscribe = (function () {
  var _Event3 = Event;
  var Subscribe = function Subscribe(path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    _Event3.call(this);
    Object.assign(this, { path: path });
  };

  _inherits(Subscribe, _Event3);

  Subscribe.prototype._toJS = function () {
    return { p: this.patch };
  };

  Subscribe.t = function () {
    return "s";
  };

  Subscribe.fromJS = function (_ref4) {
    var p = _ref4.p;
    return new Subscribe(p);
  };

  return Subscribe;
})();

var Unsbuscribe = (function () {
  var _Event4 = Event;
  var Unsbuscribe = function Unsbuscribe(path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    _Event4.call(this);
    Object.assign(this, { path: path });
  };

  _inherits(Unsbuscribe, _Event4);

  Unsbuscribe.prototype._toJS = function () {
    return { p: this.patch };
  };

  Unsbuscribe.t = function () {
    return "u";
  };

  Unsbuscribe.fromJS = function (_ref5) {
    var p = _ref5.p;
    return new Unsbuscribe(p);
  };

  return Unsbuscribe;
})();

var Dispatch = (function () {
  var _Event5 = Event;
  var Dispatch = function Dispatch(path, params) {
    if (__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    _Event5.call(this);
    Object.assign(this, { path: path, params: params });
  };

  _inherits(Dispatch, _Event5);

  Dispatch.prototype._toJS = function () {
    return { p: this.path, a: this.params };
  };

  Dispatch.t = function () {
    return "d";
  };

  Dispatch.fromJS = function (_ref6) {
    var p = _ref6.p;
    var a = _ref6.a;
    return new Dispatch(p, a);
  };

  return Dispatch;
})();

Event._ = {};
Event.Open = Event._[Open.t()] = Open;
Event.Close = Event._[Close.t()] = Close;
Event.Subscribe = Event._[Subscribe.t()] = Subscribe;
Event.Unsbuscribe = Event._[Unsbuscribe.t()] = Unsbuscribe;
Event.Dispatch = Event._[Dispatch.t()] = Dispatch;

module.exports = { Event: Event };