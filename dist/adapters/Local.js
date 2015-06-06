'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _2 = require('../');

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
var Link = _2.Server.Link;

var _LocalServer = undefined;
var _LocalLink = undefined;

var LocalClient = (function (_Client) {
  function LocalClient(server) {
    var _this = this;

    _classCallCheck(this, LocalClient);

    if (__DEV__) {
      server.should.be.an.instanceOf(_LocalServer);
    }
    _get(Object.getPrototypeOf(LocalClient.prototype), 'constructor', this).call(this);
    this._server = server;
    this._link = new _LocalLink(this);
    this._server.acceptLink(this._link);
    this.lifespan.onRelease(function () {
      _this._link.lifespan.release();
      _this._link = null;
    });
  }

  _inherits(LocalClient, _Client);

  _createClass(LocalClient, [{
    key: 'sendToServer',
    value: function sendToServer(ev) {
      this._link.receiveFromClient(ev);
    }
  }, {
    key: 'fetch',

    // implements
    // ignore hash
    value: function fetch(path) {
      var _this2 = this;

      // fail if there is not such published path
      return Promise['try'](function () {
        _this2._server.stores.should.have.property(path);
        return _this2._server.stores[path];
      });
    }
  }]);

  return LocalClient;
})(_2.Client);

var LocalLink = (function (_Link) {
  function LocalLink(client) {
    var _this3 = this;

    _classCallCheck(this, LocalLink);

    if (__DEV__) {
      client.should.be.an.instanceOf(LocalClient);
    }
    _get(Object.getPrototypeOf(LocalLink.prototype), 'constructor', this).call(this);
    this._client = client;
    this.lifespan.onRelease(function () {
      client.lifespan.release();
      _this3._client = null;
    });
  }

  _inherits(LocalLink, _Link);

  _createClass(LocalLink, [{
    key: 'sendToClient',
    value: function sendToClient(ev) {
      this._client.receiveFromServer(ev);
    }
  }]);

  return LocalLink;
})(Link);

_LocalLink = LocalLink;

var LocalServer = (function (_Server) {
  function LocalServer() {
    var _this4 = this;

    var stores = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, LocalServer);

    if (__DEV__) {
      stores.should.be.an.Object;
    }
    _get(Object.getPrototypeOf(LocalServer.prototype), 'constructor', this).call(this);
    this.stores = stores;
    this.lifespan.onRelease(function () {
      return _this4.stores = null;
    });
  }

  _inherits(LocalServer, _Server);

  return LocalServer;
})(_2.Server);

_LocalServer = LocalServer;

exports['default'] = {
  Client: LocalClient,
  Server: LocalServer
};
module.exports = exports['default'];