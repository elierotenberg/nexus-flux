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

var Subscribe = (function (_Event) {
  function Subscribe(_ref) {
    var path = _ref.path;

    _classCallCheck(this, Subscribe);

    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Subscribe.prototype), 'constructor', this).call(this);
    _Object$assign(this, { path: path });
  }

  _inherits(Subscribe, _Event);

  _createClass(Subscribe, [{
    key: '_toJS',
    value: function _toJS() {
      return { p: this.path };
    }
  }], [{
    key: 't',
    value: function t() {
      return 's';
    }
  }, {
    key: 'fromJS',
    value: function fromJS(_ref2) {
      var p = _ref2.p;

      return new Subscribe({ path: p });
    }
  }]);

  return Subscribe;
})(Event);

var Unsubscribe = (function (_Event2) {
  function Unsubscribe(_ref3) {
    var path = _ref3.path;

    _classCallCheck(this, Unsubscribe);

    if (__DEV__) {
      path.should.be.a.String;
    }
    _get(Object.getPrototypeOf(Unsubscribe.prototype), 'constructor', this).call(this);
    _Object$assign(this, { path: path });
  }

  _inherits(Unsubscribe, _Event2);

  _createClass(Unsubscribe, [{
    key: '_toJS',
    value: function _toJS() {
      return { p: this.patch };
    }
  }], [{
    key: 't',
    value: function t() {
      return 'u';
    }
  }, {
    key: 'fromJS',
    value: function fromJS(_ref4) {
      var p = _ref4.p;

      return new Unsubscribe({ path: p });
    }
  }]);

  return Unsubscribe;
})(Event);

var Action = (function (_Event3) {
  function Action(_ref5) {
    var path = _ref5.path;
    var params = _ref5.params;

    _classCallCheck(this, Action);

    if (__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    _get(Object.getPrototypeOf(Action.prototype), 'constructor', this).call(this);
    _Object$assign(this, { path: path, params: params });
  }

  _inherits(Action, _Event3);

  _createClass(Action, [{
    key: '_toJS',
    value: function _toJS() {
      return {
        p: this.path,
        a: this.params };
    }
  }], [{
    key: 't',
    value: function t() {
      return 'd';
    }
  }, {
    key: 'fromJS',
    value: function fromJS(_ref6) {
      var p = _ref6.p;
      var a = _ref6.a;

      return new Action({
        path: p,
        params: a });
    }
  }]);

  return Action;
})(Event);

Event._ = {};
Event.Subscribe = Event._[Subscribe.t()] = Subscribe;
Event.Unsubscribe = Event._[Unsubscribe.t()] = Unsubscribe;
Event.Action = Event._[Action.t()] = Action;

exports['default'] = { Event: Event };
module.exports = exports['default'];