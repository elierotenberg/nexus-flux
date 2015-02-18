"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _defineProperty = function (obj, key, value) { return Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

require("babel/polyfill");
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
var _2 = require("../");

var Client = _2.Client;
var Server = _2.Server;
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
var WorkerClient = (function (Client) {
  function WorkerClient(worker) {
    var _this = this;
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    _classCallCheck(this, WorkerClient);

    if (__DEV__) {
      worker.should.be.an.instanceOf(window.Worker);
      salt.should.be.a.String;
    }
    _get(Object.getPrototypeOf(WorkerClient.prototype), "constructor", this).call(this);
    this._worker = worker;
    this._salt = salt;
    this._fetching = {};
    this._worker.addEventListener("message", this.receiveFromWorker);
    this.lifespan.onRelease(function () {
      _.each(_this._fetching, function (_ref) {
        var reject = _ref.reject;
        return reject(new Error("Client released"));
      });
      _this._worker.removeEventListener("message", _this.receiveFromWorker);
    });
  }

  _inherits(WorkerClient, Client);

  _prototypeProperties(WorkerClient, null, {
    fetch: {
      value: function fetch(path, hash) {
        var _this = this;
        if (this._fetching[path] === void 0) {
          this._fetching[path] = {
            promise: null,
            resolve: null,
            reject: null };
          this._fetching[path].promise = new Promise(function (resolve, reject) {
            _this._fetching[path].resolve = resolve;
            _this._fetching[path].reject = reject;
          });
          this._worker.postMessage(_defineProperty({}, this._salt, { t: FETCH, j: { hash: hash, path: path } }));
        }
        return this._fetching[path].promise;
      },
      writable: true,
      configurable: true
    },
    sendToServer: {
      value: function sendToServer(ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Client.Event);
        }
        this._worker.postMessage(_defineProperty({}, this._salt, { t: EVENT, js: ev.toJS() }));
      },
      writable: true,
      configurable: true
    },
    receiveFromWorker: {
      value: function receiveFromWorker(message) {
        if (_.isObject(message) && message[this._salt] !== void 0) {
          var _message$_salt = message[this._salt];
          var t = _message$_salt.t;
          var j = _message$_salt.j;
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
      },
      writable: true,
      configurable: true
    }
  });

  return WorkerClient;
})(Client);

/* jshint browser:false */

/* jshint worker:true */
var WorkerLink = (function (Link) {
  function WorkerLink(self, stores) {
    var _this = this;
    var salt = arguments[2] === undefined ? DEFAULT_SALT : arguments[2];
    _classCallCheck(this, WorkerLink);

    if (__DEV__) {
      self.should.be.an.Object;
      self.postMessage.should.be.a.Function;
      self.addEventListener.should.be.a.Function;
      stores.should.be.an.Object;
      salt.should.be.a.String;
    }
    _get(Object.getPrototypeOf(WorkerLink.prototype), "constructor", this).call(this);
    this._self = self;
    this._stores = stores;
    this._salt = salt;
    this._self.addEventListener("message", this.receiveFromWorker);
    this.lifespan.onRelease(function () {
      _this._self.removeEventListener("message", _this.receiveFromWorker);
      _this._self = null;
      _this._stores = null;
    });
  }

  _inherits(WorkerLink, Link);

  _prototypeProperties(WorkerLink, null, {
    sendToClient: {
      value: function sendToClient(ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Server.Event);
        }
        this._self.postMessage(_defineProperty({}, this._salt, { t: EVENT, js: ev.toJS() }));
      },
      writable: true,
      configurable: true
    },
    receiveFromWorker: {
      value: function receiveFromWorker(message) {
        if (_.isObject(message) && message[this._salt] !== void 0) {
          var _message$_salt = message[this._salt];
          var t = _message$_salt.t;
          var j = _message$_salt.j;
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
            if (this.stores[path] === void 0) {
              return this._self.postMessage(_defineProperty({}, this._salt, { t: PUBLISH, j: null }));
            }
            return this._self.postMessage(_defineProperty({}, this._salt, { t: PUBLISH, j: this.stores[path].toJS() }));
          }
          throw new TypeError("Unknown message type: " + message);
        }
      },
      writable: true,
      configurable: true
    }
  });

  return WorkerLink;
})(Link);

/* jshint worker:false */

/* jshint worker:true */
var WorkerServer = (function (Server) {
  function WorkerServer() {
    var _this = this;
    var stores = arguments[0] === undefined ? {} : arguments[0];
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    _classCallCheck(this, WorkerServer);

    if (__DEV__) {
      stores.should.be.an.Object;
      salt.should.be.a.String;
    }
    _get(Object.getPrototypeOf(WorkerServer.prototype), "constructor", this).call(this);
    this._salt = salt;
    this._stores = stores;
    this._link = new WorkerLink(self, this._stores, this._salt);
    this.acceptLink(this._link);
    this.lifespan.onRelease(function () {
      _this._stores = null;
      _this._link.release();
      _this._link = null;
    });
  }

  _inherits(WorkerServer, Server);

  return WorkerServer;
})(Server);

/* jshint worker:false */

module.exports = {
  Client: WorkerClient,
  Server: WorkerServer };