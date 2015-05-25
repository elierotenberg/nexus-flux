'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _Object$assign = require('babel-runtime/core-js/object/assign')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _remutable = require('remutable');

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
    _Object$assign(this, {
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
    _Object$assign(this, { path: path, patch: patch });
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
    _Object$assign(this, { path: path });
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