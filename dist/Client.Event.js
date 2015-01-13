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
      value: function (json) {
        var _JSON$parse = JSON.parse(json);

        var _t = _JSON$parse.t;
        var j = _JSON$parse.j;
        return Event._[_t].fromJS(j);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    toJS: {
      value: function () {
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
      value: function () {
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

var Open = (function (Event) {
  function Open(_ref) {
    var clientID = _ref.clientID;
    if (__DEV__) {
      clientID.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Open.prototype), "constructor", this).call(this);
    Object.assign(this, { clientID: clientID });
  }

  _inherits(Open, Event);

  _prototypeProperties(Open, {
    t: {
      value: function () {
        return "o";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function (_ref2) {
        var c = _ref2.c;
        return new Open(c);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function () {
        return { c: this.clientID };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Open;
})(Event);

var Close = (function (Event) {
  function Close() {
    if (Object.getPrototypeOf(Close) !== null) {
      Object.getPrototypeOf(Close).apply(this, arguments);
    }
  }

  _inherits(Close, Event);

  _prototypeProperties(Close, {
    t: {
      value: function () {
        return "c";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function () {
        return new Close();
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function () {
        return {};
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Close;
})(Event);

var Subscribe = (function (Event) {
  function Subscribe(_ref3) {
    var path = _ref3.path;
    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Subscribe.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path });
  }

  _inherits(Subscribe, Event);

  _prototypeProperties(Subscribe, {
    t: {
      value: function () {
        return "s";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function (_ref4) {
        var p = _ref4.p;
        return new Subscribe(p);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function () {
        return { p: this.patch };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Subscribe;
})(Event);

var Unsubscribe = (function (Event) {
  function Unsubscribe(_ref5) {
    var path = _ref5.path;
    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Unsubscribe.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path });
  }

  _inherits(Unsubscribe, Event);

  _prototypeProperties(Unsubscribe, {
    t: {
      value: function () {
        return "u";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function (_ref6) {
        var p = _ref6.p;
        return new Unsubscribe(p);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function () {
        return { p: this.patch };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Unsubscribe;
})(Event);

var Dispatch = (function (Event) {
  function Dispatch(_ref7) {
    var path = _ref7.path;
    var params = _ref7.params;
    if (__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    _get(Object.getPrototypeOf(Dispatch.prototype), "constructor", this).call(this);
    Object.assign(this, { path: path, params: params });
  }

  _inherits(Dispatch, Event);

  _prototypeProperties(Dispatch, {
    t: {
      value: function () {
        return "d";
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fromJS: {
      value: function (_ref8) {
        var p = _ref8.p;
        var a = _ref8.a;
        return new Dispatch(p, a);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    _toJS: {
      value: function () {
        return { p: this.path, a: this.params };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Dispatch;
})(Event);

Event._ = {};
Event.Open = Event._[Open.t()] = Open;
Event.Close = Event._[Close.t()] = Close;
Event.Subscribe = Event._[Subscribe.t()] = Subscribe;
Event.Unsubscribe = Event._[Unsubscribe.t()] = Unsubscribe;
Event.Dispatch = Event._[Dispatch.t()] = Dispatch;

module.exports = { Event: Event };