"use strict";

var _defineProperty = function (obj, key, value) {
  return Object.defineProperty(obj, key, {
    value: value,
    enumerable: true,
    configurable: true,
    writable: true
  });
};

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

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
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
var Client = require("../").Client;
var Server = require("../").Server;
var Link = Server.Link;
var Remutable = _interopRequire(require("remutable"));

// constants for the communication 'protocol'/convention
var FETCH = "f";
var PUBLISH = "p";
var EVENT = "e";

// this is a just a disambiguation salt; this is by no mean a
// cryptosecure password or anything else. its fine to leave it
// plaintext here.
// any malicious script running from the same domain will be able
// to eavesdrop regardless.
var DEFAULT_SALT = "__KqsrQBNHfkTYQ8mWadEDwfKM";

/* jshint browser:true */
var WorkerClient = (function () {
  var _Client = Client;
  var WorkerClient = function WorkerClient(worker) {
    var _this = this;
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    return (function () {
      if (__DEV__) {
        worker.should.be.an.instanceOf(window.Worker);
        salt.should.be.a.String;
      }
      _get(Object.getPrototypeOf(WorkerClient.prototype), "constructor", _this).call(_this);
      _this._worker = worker;
      _this._salt = salt;
      _this._fetching = {};
      _this._worker.addEventListener("message", _this.receiveFromWorker);
      _this.lifespan.onRelease(function () {
        _.each(_this._fetching, function (_ref) {
          var reject = _ref.reject;
          return reject(new Error("Client released"));
        });
        _this._worker.removeEventListener("message", _this.receiveFromWorker);
      });
    })();
  };

  _inherits(WorkerClient, _Client);

  WorkerClient.prototype.fetch = function (path, hash) {
    var _this2 = this;
    if (this._fetching[path] === void 0) {
      this._fetching[path] = {
        promise: null,
        resolve: null,
        reject: null };
      this._fetching[path].promise = new Promise(function (resolve, reject) {
        _this2._fetching[path].resolve = resolve;
        _this2._fetching[path].reject = reject;
      });
      this._worker.postMessage(_defineProperty({}, this._salt, { t: FETCH, j: { hash: hash, path: path } }));
    }
    return this._fetching[path].promise;
  };

  WorkerClient.prototype.sendToServer = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this._worker.postMessage(_defineProperty({}, this._salt, { t: EVENT, js: ev.toJS() }));
  };

  WorkerClient.prototype.receiveFromWorker = function (message) {
    if (_.isObject(message) && message[this._salt] !== void 0) {
      var t = message[this._salt].t;
      var j = message[this._salt].j;
      if (t === PUBLISH) {
        var path = j.path;
        if (__DEV__) {
          path.should.be.a.String;
        }
        if (this._fetching[path] !== void 0) {
          if (j === null) {
            this._fetching[path].reject(new Error("Couldn't fetch store"));
          } else {
            this._fetching[path].resolve(Remutable.fromJS(j).createConsumer());
          }
          delete this._fetching[path];
        }
        return;
      }
      if (t === EVENT) {
        var ev = Server.Event.fromJS(j);
        if (__DEV__) {
          ev.should.be.an.instanceOf(Server.Event);
        }
        return this.receiveFromServer(ev);
      }
      throw new TypeError("Unknown message type: " + message);
    }
  };

  return WorkerClient;
})();

/* jshint browser:false */

/* jshint worker:true */
var WorkerLink = (function () {
  var _Link = Link;
  var WorkerLink = function WorkerLink(self, pub) {
    var _this3 = this;
    var salt = arguments[2] === undefined ? DEFAULT_SALT : arguments[2];
    return (function () {
      if (__DEV__) {
        self.should.be.an.Object;
        self.postMessage.should.be.a.Function;
        self.addEventListener.should.be.a.Function;
        public.should.be.an.Object;
        salt.should.be.a.String;
      }
      _get(Object.getPrototypeOf(WorkerLink.prototype), "constructor", _this3).call(_this3);
      _this3._self = self;
      _this3._public = pub;
      _this3._salt = salt;
      _this3._self.addEventListener("message", _this3.receiveFromWorker);
      _this3.lifespan.onRelease(function () {
        _this3._self.removeEventListener("message", _this3.receiveFromWorker);
        _this3._self = null;
        _this3._public = null;
      });
    })();
  };

  _inherits(WorkerLink, _Link);

  WorkerLink.prototype.sendToClient = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this._self.postMessage(_defineProperty({}, this._salt, { t: EVENT, js: ev.toJS() }));
  };

  WorkerLink.prototype.receiveFromWorker = function (message) {
    if (_.isObject(message) && message[this._salt] !== void 0) {
      var t = message[this._salt].t;
      var j = message[this._salt].j;
      if (t === EVENT) {
        var ev = Client.Event.fromJS(j);
        if (__DEV__) {
          ev.should.be.an.instanceOf(Client.Event);
          return this.receiveFromClient(ev);
        }
        return;
      }
      if (t === FETCH) {
        var path = j.path;
        if (this["public"][path] === void 0) {
          return this._self.postMessage(_defineProperty({}, this._salt, { t: PUBLISH, j: null }));
        }
        return this._self.postMessage(_defineProperty({}, this._salt, { t: PUBLISH, j: this["public"][path].toJS() }));
      }
      throw new TypeError("Unknown message type: " + message);
    }
  };

  return WorkerLink;
})();

/* jshint worker:false */

/* jshint worker:true */
var WorkerServer = (function () {
  var _Server = Server;
  var WorkerServer = function WorkerServer() {
    var _this4 = this;
    var salt = arguments[0] === undefined ? DEFAULT_SALT : arguments[0];
    return (function () {
      if (__DEV__) {
        salt.should.be.a.String;
      }
      _get(Object.getPrototypeOf(WorkerServer.prototype), "constructor", _this4).call(_this4);
      _this4._salt = salt;
      _this4._public = {};
      _this4._link = new WorkerLink(self, _this4._public, _this4._salt);
      _this4.acceptLink(_this4._link);
      _this4.lifespan.onRelease(function () {
        _this4._public = null;
        _this4._link.release();
        _this4._link = null;
      });
    })();
  };

  _inherits(WorkerServer, _Server);

  WorkerServer.prototype.publish = function (path, remutableConsumer) {
    if (__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._public[path] = remutableConsumer;
  };

  return WorkerServer;
})();

/* jshint worker:false */

module.exports = {
  Client: WorkerClient,
  Server: WorkerServer };