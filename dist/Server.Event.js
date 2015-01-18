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
var Patch = require("remutable").Patch;
var Event = (function () {
  function Event() {
    if (__DEV__) {
      this.should.have.property("_toJS").which.is.a.Function;
      this.constructor.should.have.property("fromJS").which.is.a.Function;
      this.constructor.should.have.property("t").which.is.a.Function;
    }
    Object.assign(this, {
      _json: null,
      _js: null });
  }

  _prototypeProperties(Event, {
    fromJSON: {
      value: function fromJSON(json) {
        var _JSON$parse = JSON.parse(json);

        var t = _JSON$parse.t;
        var j = _JSON$parse.j;
        return Event._[t].fromJS(j);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    toJS: {
      value: function toJS() {
        if (this._js === null) {
          this._js = {
            t: this.constructor.t(),
            j: this._toJS() };
        }
        return this._js;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    toJSON: {
      value: function toJSON() {
        if (this._json === null) {
          this._json = JSON.stringify(this.toJS());
        }
        return this._json;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Event;
})();

var Update = (function (Event) {
  function Update(_ref) {
    var path = _ref.path;
    var patch = _ref.patch;
    if (__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    _get(Object.getPrototypeOf(Update.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path, patch: patch });
  }

  _inherits(Update, Event);

  _prototypeProperties(Update, {
    t: {
      value: function t() {
        return "u";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function fromJS(_ref2) {
        var p = _ref2.p;
        var u = _ref2.u;
        if (__DEV__) {
          p.should.be.a.String;
          u.should.be.an.Object;
        }
        return new Update(p, Patch.fromJS(u));
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function ToJS() {
        return {
          p: this.path,
          u: this.patch.toJS() };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Update;
})(Event);

var Delete = (function (Event) {
  function Delete(_ref3) {
    var path = _ref3.path;
    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Delete.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path });
  }

  _inherits(Delete, Event);

  _prototypeProperties(Delete, {
    t: {
      value: function t() {
        return "d";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function fromJS(_ref4) {
        var p = _ref4.p;
        if (__DEV__) {
          p.should.be.a.String;
        }
        return new Delete(p);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function ToJS() {
        return { p: this.patch };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Delete;
})(Event);

Event._ = {};
Event.Update = Event._[Update.t()] = Update;
Event.Delete = Event._[Delete.t()] = Delete;

module.exports = { Event: Event };