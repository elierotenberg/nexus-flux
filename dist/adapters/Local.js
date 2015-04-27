'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _Client$Server = require('../');

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
var Link = _Client$Server.Server.Link;

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
    value: function fetch(path) {
      var _this2 = this;

      // just ignore hash
      return Promise['try'](function () {
        // fail if there is not such published path
        _this2._server.stores.should.have.property(path);
        return _this2._server.stores[path];
      });
    }
  }]);

  return LocalClient;
})(_Client$Server.Client);

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
})(_Client$Server.Server);

_LocalServer = LocalServer;

exports['default'] = {
  Client: LocalClient,
  Server: LocalServer };
module.exports = exports['default'];