"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
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
var Remutable = _interopRequire(require("remutable"));

var Lifespan = _interopRequire(require("lifespan"));

var sha256 = _interopRequire(require("sha256"));

var Store = _interopRequire(require("./Store"));

var Action = _interopRequire(require("./Action"));

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
    if (__DEV__) {
      this.constructor.should.not.be.exactly(Link); // ensure abstracts
      this.sendToClient.should.not.be.exactly(Link.prototype.sendToClient); // ensure virtual
    }
    this.lifespan = new Lifespan();
    _.bindAll(this);
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
      value: function (ev) {
        // should forward the event to the associated client
        if (__DEV__) {
          ev.should.be.an.instanceOf(_Server.Event);
        }
        throw new TypeError("Virtual method invocation");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    acceptFromServer: {
      value: function (receiveFromClient) {
        // will be called by the server
        if (__DEV__) {
          receiveFromClient.should.be.a.Function;
        }
        this.receiveFromClient = receiveFromClient;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    receiveFromServer: {
      value: function (ev) {
        // will be called by server
        if (__DEV__) {
          ev.should.be.an.instanceOf(_Server.Event);
        }
        this.sendToClient(ev);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Link;
})();

/**
 * @abstract
 */
var Server = (function () {
  function Server() {
    if (__DEV__) {
      this.constructor.should.not.be.exactly(Server); // ensure abstracts
      this.publish.should.not.be.exactly(Server.prototype.publish); // ensure virtual
    }
    this.lifespan = new Lifespan();
    _.bindAll(this);
    this._stores = {};
    this._actions = {};
    this._links = {};
  }

  _prototypeProperties(Server, null, {
    publish: {

      /**
       * @virtual
       */
      value: function (path, remutableConsumer) {
        if (__DEV__) {
          path.should.be.a.String;
          remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
        }
        throw new TypeError("Virtual method invocation");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    acceptLink: {
      value: function (link) {
        var _this2 = this;
        if (__DEV__) {
          link.should.be.an.instanceOf(Link);
        }

        var linkID = _.uniqueId();
        this._links[linkID] = {
          link: link,
          subscriptions: {},
          clientID: null };
        link.acceptFromServer(function (ev) {
          return _this2.receiveFromLink(linkID, ev);
        });
        link.lifespan.onRelease(function () {
          delete _this2._links[linkID];
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    receiveFromLink: {
      value: function (linkID, ev) {
        if (__DEV__) {
          linkID.should.be.a.String;
          this._links.should.have.property(linkID);
          ev.should.be.an.instanceOf(Client.Event);
        }
        if (ev instanceof Client.Event.Open) {
          return this._links[linkID].clientID = ev.clientID;
        }
        if (ev instanceof Client.Event.Close) {
          return this._links[linkID].clientID = null;
        }
        if (ev instanceof Client.Event.Subscribe) {
          return this._links[linkID].subscriptions[ev.path] = null;
        }
        if (ev instanceof Client.Event.Unsubscribe) {
          if (this._links[linkID].subscriptions[ev.path] !== void 0) {
            delete this._links[linkID].subscriptions[ev.path];
            return;
          }
          return;
        }
        if (ev instanceof Client.Event.Dispatch) {
          if (this._links[linkID].clientID !== null && this._actions[ev.path] !== void 0) {
            // hash clientID. the action handlers shouldn't have access to it. (security issue)
            return this._actions[ev.path].producer.dispatch(ev.params, sha256(this._links[linkID].clientID));
          }
          return;
        }
        if (__DEV__) {
          throw new TypeError("Unknown Client.Event: " + ev);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    sendToLinks: {
      value: function (ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Server.Event);
        }
        if (ev instanceof Server.Event.Update || ev instanceof Server.Event.Delete) {
          return _.each(this._links, function (_ref) {
            var link = _ref.link;
            var subscriptions = _ref.subscriptions;
            if (subscriptions[ev.path] !== void 0) {
              link.receiveFromServer(ev);
            }
          });
        }
        if (__DEV__) {
          throw new TypeError("Unknown Server.Event type: " + ev);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    Store: {
      value: function (path, lifespan) {
        var _this3 = this;
        if (__DEV__) {
          path.should.be.a.String;
          lifespan.should.be.an.instanceOf(Lifespan);
        }

        var _ref2 = this._stores[path] || (function () {
          var _engine = new Store.Engine();
          var consumer = _engine.createConsumer().onUpdate(function (consumer, patch) {
            _this3.publish(path, consumer);
            _this3.sendToLinks(new Server.Event.Update({ path: path, patch: patch }));
          }).onDelete(function () {
            return _this3.sendToLinks(new Server.Event.Delete({ path: path }));
          });
          // immediatly publish the (empty) store
          _this3.publish(path, _engine.remutableConsumer);
          return _this3._stores[path] = { engine: _engine, consumer: consumer };
        })();
        var engine = _ref2.engine;
        var producer = engine.createProducer();
        producer.lifespan.onRelease(function () {
          if (engine.producers === 0) {
            _this3._stores[path].consumer.release();
            engine.lifespan.release();
            delete _this3._stores[path];
          }
        });
        lifespan.onRelease(producer.lifespan.release);
        return producer;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    Action: {
      value: function (path, lifespan) {
        var _this4 = this;
        if (__DEV__) {
          path.should.be.a.String;
          lifespan.should.be.an.instanceOf(Lifespan);
        }

        var _ref3 = this._actions[path] || (function () {
          var _engine2 = new Action.Engine();
          var producer = _engine2.createProducer();
          return _this4._actions[path] = {
            engine: _engine2,
            producer: producer };
        })();
        var engine = _ref3.engine;
        var consumer = engine.createConsumer();
        consumer.lifespan.onRelease(function () {
          if (engine.consumers === 0) {
            _this4._actions[path].producer.release();
            engine.lifespan.release();
            delete _this4._actions[path];
          }
        });
        lifespan.onRelease(consumer.lifespan.release);
        return consumer;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Server;
})();

_Server = Server;

Server.Event = Event;
Server.Link = Link;

module.exports = Server;