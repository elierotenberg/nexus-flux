"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

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

var Remutable = _interopRequire(require("remutable"));

var Lifespan = _interopRequire(require("lifespan"));

var EventEmitter = require("nexus-events").EventEmitter;

var Client = _interopRequire(require("./Client.Event"));

// we just need this reference for typechecks

var Event = require("./Server.Event").Event;

var _Server = undefined;

/**
 * @abstract
 */

var Link = (function () {
  function Link() {
    var _this = this;

    _classCallCheck(this, Link);

    if (__DEV__) {
      this.constructor.should.not.be.exactly(Link); // ensure abstracts
      this.sendToClient.should.not.be.exactly(Link.prototype.sendToClient); // ensure virtual
    }
    this.lifespan = new Lifespan();
    this.receiveFromClient = null; // will be set by the server; should be called when received client events, to forward them to the server
    this.lifespan.onRelease(function () {
      _this.receiveFromClient = null;
    });
  }

  _prototypeProperties(Link, null, {
    sendToClient: {

      /**
       * @virtual
       */

      value: function sendToClient(ev) {
        // should forward the event to the associated client
        if (__DEV__) {
          ev.should.be.an.instanceOf(_Server.Event);
        }
        throw new TypeError("Virtual method invocation");
      },
      writable: true,
      configurable: true
    },
    acceptFromServer: {
      value: function acceptFromServer(receiveFromClient) {
        // will be called by the server
        if (__DEV__) {
          receiveFromClient.should.be.a.Function;
        }
        this.receiveFromClient = receiveFromClient;
      },
      writable: true,
      configurable: true
    },
    receiveFromServer: {
      value: function receiveFromServer(ev) {
        // will be called by server
        if (__DEV__) {
          ev.should.be.an.instanceOf(_Server.Event);
        }
        this.sendToClient(ev);
      },
      writable: true,
      configurable: true
    }
  });

  return Link;
})();

var Server = (function (EventEmitter) {
  function Server() {
    var _this = this;

    _classCallCheck(this, Server);

    _get(Object.getPrototypeOf(Server.prototype), "constructor", this).call(this);
    this.lifespan = new Lifespan();
    this._links = {};
    this._subscriptions = {};
    this.lifespan.onRelease(function () {
      _.each(_this._links, function (_ref, linkID) {
        var link = _ref.link;
        var subscriptions = _ref.subscriptions;

        _.each(subscriptions, function (path) {
          return _this.unsubscribe(linkID, path);
        });
        link.lifespan.release();
      });
      _this._links = null;
      _this._subscriptions = null;
    });
  }

  _inherits(Server, EventEmitter);

  _prototypeProperties(Server, null, {
    dispatchAction: {
      value: function dispatchAction(path, params) {
        var _this = this;

        return Promise["try"](function () {
          if (__DEV__) {
            path.should.be.a.String;
            params.should.be.an.Object;
          }
          _this.emit("action", { path: path, params: params });
        });
      },
      writable: true,
      configurable: true
    },
    dispatchUpdate: {
      value: function dispatchUpdate(path, patch) {
        var _this = this;

        if (__DEV__) {
          path.should.be.a.String;
          patch.should.be.an.instanceOf(Remutable.Patch);
        }
        if (this._subscriptions[path] !== void 0) {
          (function () {
            var ev = new Server.Event.Update({ path: path, patch: patch });
            _.each(_this._subscriptions[path], function (link) {
              link.receiveFromServer(ev);
            });
          })();
        }
        return this;
      },
      writable: true,
      configurable: true
    },
    subscribe: {
      value: function subscribe(linkID, path) {
        if (__DEV__) {
          linkID.should.be.a.String;
          path.should.be.a.String;
          this._links.should.have.property(linkID);
        }
        if (this._subscriptions[path] === void 0) {
          this._subscriptions[path] = {};
        }
        this._subscriptions[path][linkID] = this._links[linkID].link;
        if (this._links[linkID].subscriptions[path] === void 0) {
          this._links[linkID].subscriptions[path] = path;
        }
        return this;
      },
      writable: true,
      configurable: true
    },
    unsubscribe: {
      value: function unsubscribe(linkID, path) {
        if (__DEV__) {
          linkID.should.be.a.String;
          path.should.be.a.String;
          this._links.should.have.property(linkID);
          this._links[linkID].subscriptions.should.have.property(path);
          this._subscriptions.should.have.property(path);
          this._subscriptions[path].should.have.property(linkID);
        }
        delete this._links[linkID].subscriptions[path];
        delete this._subscriptions[path][linkID];
        if (_.size(this._subscriptions[path]) === 0) {
          delete this._subscriptions[path];
        }
      },
      writable: true,
      configurable: true
    },
    acceptLink: {
      value: function acceptLink(link) {
        var _this = this;

        if (__DEV__) {
          link.should.be.an.instanceOf(Link);
        }

        var linkID = _.uniqueId();
        this._links[linkID] = {
          link: link,
          subscriptions: {} };
        link.acceptFromServer(function (ev) {
          return _this.receiveFromLink(linkID, ev);
        });
        link.lifespan.onRelease(function () {
          _.each(_this._links[linkID].subscriptions, function (path) {
            return _this.unsubscribe(linkID, path);
          });
          delete _this._links[linkID];
        });
      },
      writable: true,
      configurable: true
    },
    receiveFromLink: {
      value: function receiveFromLink(linkID, ev) {
        if (__DEV__) {
          linkID.should.be.a.String;
          this._links.should.have.property(linkID);
          ev.should.be.an.instanceOf(Client.Event);
        }
        if (ev instanceof Client.Event.Subscribe) {
          return this.subscribe(linkID, ev.path);
        }
        if (ev instanceof Client.Event.Unsubscribe) {
          return this.unsubscribe(linkID, ev.path);
        }
        if (ev instanceof Client.Event.Action) {
          return this.dispatchAction(ev.path, ev.params);
        }
        if (__DEV__) {
          throw new TypeError("Unknown Client.Event: " + ev);
        }
      },
      writable: true,
      configurable: true
    }
  });

  return Server;
})(EventEmitter);

_Server = Server;

Object.assign(Server, { Event: Event, Link: Link });

module.exports = Server;