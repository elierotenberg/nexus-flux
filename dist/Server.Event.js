'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { desc = parent = getter = undefined; _again = false; var object = _x,
    property = _x2,
    receiver = _x3; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _remutable = require('remutable');

require('babel/polyfill');
var _ = require('lodash');
var should = require('should');
var Promise = (global || window).Promise = require('bluebird');
var __DEV__ = process.env.NODE_ENV !== 'production';
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === 'object';
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}

var Event = (function () {
  function Event() {
    _classCallCheck(this, Event);

    if (__DEV__) {
      this.should.have.property('_toJS').which.is.a.Function;
      this.constructor.should.have.property('fromJS').which.is.a.Function;
      this.constructor.should.have.property('t').which.is.a.Function;
    }
    Object.assign(this, {
      _json: null,
      _js: null });
  }

  _createClass(Event, [{
    key: 'toJS',
    value: function toJS() {
      if (this._js === null) {
        this._js = {
          t: this.constructor.t(),
          j: this._toJS() };
      }
      return this._js;
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      if (this._json === null) {
        this._json = JSON.stringify(this.toJS());
      }
      return this._json;
    }
  }], [{
    key: 'fromJSON',
    value: function fromJSON(json) {
      var _JSON$parse = JSON.parse(json);

      var t = _JSON$parse.t;
      var j = _JSON$parse.j;

      return Event._[t].fromJS(j);
    }
  }]);

  return Event;
})();

var Update = (function (_Event) {
  function Update(_ref) {
    var path = _ref.path;
    var patch = _ref.patch;

    _classCallCheck(this, Update);

    if (__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(_remutable.Patch);
    }
    _get(Object.getPrototypeOf(Update.prototype), 'constructor', this).call(this);
    Object.assign(this, { path: path, patch: patch });
  }

  _inherits(Update, _Event);

  _createClass(Update, [{
    key: '_toJS',
    value: function _toJS() {
      return {
        p: this.path,
        u: this.patch.toJS() };
    }
  }], [{
    key: 't',
    value: function t() {
      return 'u';
    }
  }, {
    key: 'fromJS',
    value: function fromJS(_ref2) {
      var p = _ref2.p;
      var u = _ref2.u;

      if (__DEV__) {
        p.should.be.a.String;
        u.should.be.an.Object;
      }
      return new Update({ path: p, patch: _remutable.Patch.fromJS(u) });
    }
  }]);

  return Update;
})(Event);

var Delete = (function (_Event2) {
  function Delete(_ref3) {
    var path = _ref3.path;

    _classCallCheck(this, Delete);

    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Delete.prototype), 'constructor', this).call(this);
    Object.assign(this, { path: path });
  }

  _inherits(Delete, _Event2);

  _createClass(Delete, [{
    key: '_toJS',
    value: function _toJS() {
      return { p: this.path };
    }
  }], [{
    key: 't',
    value: function t() {
      return 'd';
    }
  }, {
    key: 'fromJS',
    value: function fromJS(_ref4) {
      var p = _ref4.p;

      if (__DEV__) {
        p.should.be.a.String;
      }
      return new Delete({ path: p });
    }
  }]);

  return Delete;
})(Event);

Event._ = {};
Event.Update = Event._[Update.t()] = Update;
Event.Delete = Event._[Delete.t()] = Delete;

exports['default'] = { Event: Event };
module.exports = exports['default'];