'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _defineProperty = require('babel-runtime/helpers/define-property')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _2 = require('../');

var _remutable = require('remutable');

var _remutable2 = _interopRequireDefault(_remutable);

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

// constants for the communication 'protocol'/convention
var FETCH = 'f';
var PUBLISH = 'p';
var EVENT = 'e';

// this is a just a disambiguation salt; this is by no mean a
// cryptosecure password or anything else. its fine to leave it
// plaintext here.
// any malicious script running from the same domain will be able
// to eavesdrop regardless.
var DEFAULT_SALT = '__KqsrQBNHfkTYQ8mWadEDwfKM';

/* jshint browser:true */

var WorkerClient = (function (_Client) {
  function WorkerClient(worker) {
    var _this = this;

    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];

    _classCallCheck(this, WorkerClient);

    if (__DEV__) {
      worker.should.be.an.instanceOf(window.Worker);
      salt.should.be.a.String;
    }
    _get(Object.getPrototypeOf(WorkerClient.prototype), 'constructor', this).call(this);
    this._worker = worker;
    this._salt = salt;
    this._fetching = {};
    this._worker.addEventListener('message', this.receiveFromWorker);
    this.lifespan.onRelease(function () {
      _.each(_this._fetching, function (_ref) {
        var reject = _ref.reject;
        return reject(new Error('Client released'));
      });
      _this._worker.removeEventListener('message', _this.receiveFromWorker);
    });
  }

  _inherits(WorkerClient, _Client);

  _createClass(WorkerClient, [{
    key: 'fetch',
    value: function fetch(path, hash) {
      var _this2 = this;

      if (this._fetching[path] === void 0) {
        this._fetching[path] = {
          promise: null,
          resolve: null,
          reject: null
        };
        this._fetching[path].promise = new Promise(function (resolve, reject) {
          _this2._fetching[path].resolve = resolve;
          _this2._fetching[path].reject = reject;
        });
        this._worker.postMessage(_defineProperty({}, this._salt, { t: FETCH, j: { hash: hash, path: path } }));
      }
      return this._fetching[path].promise;
    }
  }, {
    key: 'sendToServer',
    value: function sendToServer(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(_2.Client.Event);
      }
      this._worker.postMessage(_defineProperty({}, this._salt, { t: EVENT, js: ev.toJS() }));
    }
  }, {
    key: '_receivePublish',
    value: function _receivePublish(j) {
      var path = j.path;

      if (__DEV__) {
        path.should.be.a.String;
      }
      if (this._fetching[path] !== void 0) {
        if (j === null) {
          this._fetching[path].reject(new Error('Couldn\'t fetch store'));
        } else {
          this._fetching[path].resolve(_remutable2['default'].fromJS(j).createConsumer());
        }
        delete this._fetching[path];
      }
      return null;
    }
  }, {
    key: '_receiveEvent',
    value: function _receiveEvent(j) {
      var ev = _2.Server.Event.fromJS(j);
      if (__DEV__) {
        ev.should.be.an.instanceOf(_2.Server.Event);
      }
      return this.receiveFromServer(ev);
    }
  }, {
    key: 'receiveFromWorker',
    value: function receiveFromWorker(message) {
      if (_.isObject(message) && message[this._salt] !== void 0) {
        var _message$_salt = message[this._salt];
        var t = _message$_salt.t;
        var j = _message$_salt.j;

        if (t === PUBLISH) {
          return this._receivePublish(j);
        }
        if (t === EVENT) {
          return this._receiveEvent(j);
        }
        throw new TypeError('Unknown message type: ' + message);
      }
    }
  }]);

  return WorkerClient;
})(_2.Client);

/* jshint browser:false */

/* jshint worker:true */

var WorkerLink = (function (_Link) {
  function WorkerLink(self, stores) {
    var _this3 = this;

    var salt = arguments[2] === undefined ? DEFAULT_SALT : arguments[2];

    _classCallCheck(this, WorkerLink);

    if (__DEV__) {
      self.should.be.an.Object;
      self.postMessage.should.be.a.Function;
      self.addEventListener.should.be.a.Function;
      stores.should.be.an.Object;
      salt.should.be.a.String;
    }
    _get(Object.getPrototypeOf(WorkerLink.prototype), 'constructor', this).call(this);
    this._self = self;
    this._stores = stores;
    this._salt = salt;
    this._self.addEventListener('message', this.receiveFromWorker);
    this.lifespan.onRelease(function () {
      _this3._self.removeEventListener('message', _this3.receiveFromWorker);
      _this3._self = null;
      _this3._stores = null;
    });
  }

  _inherits(WorkerLink, _Link);

  _createClass(WorkerLink, [{
    key: 'sendToClient',
    value: function sendToClient(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(_2.Server.Event);
      }
      this._self.postMessage(_defineProperty({}, this._salt, { t: EVENT, js: ev.toJS() }));
    }
  }, {
    key: '_receivePublish',
    value: function _receivePublish(j) {
      var ev = _2.Client.Event.fromJS(j);
      if (__DEV__) {
        ev.should.be.an.instanceOf(_2.Client.Event);
        return this.receiveFromClient(ev);
      }
      return null;
    }
  }, {
    key: '_receiveFetch',
    value: function _receiveFetch(j) {
      var path = j.path;

      if (this.stores[path] === void 0) {
        return this._self.postMessage(_defineProperty({}, this._salt, { t: PUBLISH, j: null }));
      }
      return this._self.postMessage(_defineProperty({}, this._salt, { t: PUBLISH, j: this.stores[path].toJS() }));
    }
  }, {
    key: 'receiveFromWorker',
    value: function receiveFromWorker(message) {
      if (_.isObject(message) && message[this._salt] !== void 0) {
        var _message$_salt2 = message[this._salt];
        var t = _message$_salt2.t;
        var j = _message$_salt2.j;

        if (t === EVENT) {
          return this._receivePublish(j);
        }
        if (t === FETCH) {
          return this._receiveFetch(j);
        }
        throw new TypeError('Unknown message type: ' + message);
      }
    }
  }]);

  return WorkerLink;
})(Link);

/* jshint worker:false */

/* jshint worker:true */

var WorkerServer = (function (_Server) {
  function WorkerServer() {
    var _this4 = this;

    var stores = arguments[0] === undefined ? {} : arguments[0];
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];

    _classCallCheck(this, WorkerServer);

    if (__DEV__) {
      stores.should.be.an.Object;
      salt.should.be.a.String;
    }
    _get(Object.getPrototypeOf(WorkerServer.prototype), 'constructor', this).call(this);
    this._salt = salt;
    this._stores = stores;
    this._link = new WorkerLink(self, this._stores, this._salt);
    this.acceptLink(this._link);
    this.lifespan.onRelease(function () {
      _this4._stores = null;
      _this4._link.release();
      _this4._link = null;
    });
  }

  _inherits(WorkerServer, _Server);

  return WorkerServer;
})(_2.Server);

/* jshint worker:false */

exports['default'] = {
  Client: WorkerClient,
  Server: WorkerServer
};
module.exports = exports['default'];