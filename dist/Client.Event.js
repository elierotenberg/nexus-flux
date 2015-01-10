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
  var _JSON$parse = JSON.parse(json);

  var _t = _JSON$parse.t;
  var j = _JSON$parse.j;
  return Event._[_t].fromJS(j);
};

var Open = (function () {
  var _Event = Event;
  var Open = function Open(_ref) {
    var clientID = _ref.clientID;
    if (__DEV__) {
      clientID.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Open.prototype), "constructor", this).call(this);
    Object.assign(this, { clientID: clientID });
  };

  _inherits(Open, _Event);

  Open.prototype._toJS = function () {
    return { c: this.clientID };
  };

  Open.t = function () {
    return "o";
  };

  Open.fromJS = function (_ref2) {
    var c = _ref2.c;
    return new Open(c);
  };

  return Open;
})();

var Close = (function () {
  var _Event2 = Event;
  var Close = function Close() {
    if (Object.getPrototypeOf(Close) !== null) {
      Object.getPrototypeOf(Close).apply(this, arguments);
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
  var Subscribe = function Subscribe(_ref3) {
    var path = _ref3.path;
    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Subscribe.prototype), "constructor", this).call(this);
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

var Unsubscribe = (function () {
  var _Event4 = Event;
  var Unsubscribe = function Unsubscribe(_ref5) {
    var path = _ref5.path;
    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Unsubscribe.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path });
  };

  _inherits(Unsubscribe, _Event4);

  Unsubscribe.prototype._toJS = function () {
    return { p: this.patch };
  };

  Unsubscribe.t = function () {
    return "u";
  };

  Unsubscribe.fromJS = function (_ref6) {
    var p = _ref6.p;
    return new Unsubscribe(p);
  };

  return Unsubscribe;
})();

var Dispatch = (function () {
  var _Event5 = Event;
  var Dispatch = function Dispatch(_ref7) {
    var path = _ref7.path;
    var params = _ref7.params;
    if (__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    _get(Object.getPrototypeOf(Dispatch.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path, params: params });
  };

  _inherits(Dispatch, _Event5);

  Dispatch.prototype._toJS = function () {
    return { p: this.path, a: this.params };
  };

  Dispatch.t = function () {
    return "d";
  };

  Dispatch.fromJS = function (_ref8) {
    var p = _ref8.p;
    var a = _ref8.a;
    return new Dispatch(p, a);
  };

  return Dispatch;
})();

Event._ = {};
Event.Open = Event._[Open.t()] = Open;
Event.Close = Event._[Close.t()] = Close;
Event.Subscribe = Event._[Subscribe.t()] = Subscribe;
Event.Unsubscribe = Event._[Unsubscribe.t()] = Unsubscribe;
Event.Dispatch = Event._[Dispatch.t()] = Dispatch;

module.exports = { Event: Event };