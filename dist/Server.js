"use strict";

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

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

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

var hashClientID = _interopRequire(require("./hashClientID"));

var EventEmitter = require("nexus-events").EventEmitter;
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
      value: function sendToClient(ev) {
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
      value: function acceptFromServer(receiveFromClient) {
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
      value: function receiveFromServer(ev) {
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
var Server = (function (EventEmitter) {
  function Server() {
    if (__DEV__) {
      this.constructor.should.not.be.exactly(Server); // ensure abstracts
      this.publish.should.not.be.exactly(Server.prototype.publish); // ensure virtual
    }
    _get(Object.getPrototypeOf(Server.prototype), "constructor", this).call(this);
    this.lifespan = new Lifespan();
    _.bindAll(this);
    this._stores = {};
    this._actions = {};
    this._links = {};
  }

  _inherits(Server, EventEmitter);

  _prototypeProperties(Server, null, {
    publish: {

      /**
       * @virtual
       */
      value: function publish(path, remutableConsumer) {
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
      value: function acceptLink(link) {
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
          _this2.emit("link:remove", { linkID: linkID });
          delete _this2._links[linkID];
        });
        this.emit("link:add", { linkID: linkID });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    receiveFromLink: {
      value: function receiveFromLink(linkID, ev) {
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
            return this._actions[ev.path].producer.dispatch(ev.params, hashClientID(this._links[linkID].clientID));
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
      value: function sendToLinks(ev) {
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
      value: (function (_Store) {
        var _StoreWrapper = function Store() {
          return _Store.apply(this, arguments);
        };

        _StoreWrapper.toString = function () {
          return _Store.toString();
        };

        return _StoreWrapper;
      })(function (path, lifespan) {
        var _this3 = this;
        if (__DEV__) {
          path.should.be.a.String;
          lifespan.should.be.an.instanceOf(Lifespan);
        }

        var _ref2 = this._stores[path] || (function () {
          var engine = new Store.Engine();
          var consumer = engine.createConsumer().onUpdate(function (consumer, patch) {
            _this3.publish(path, consumer);
            _this3.sendToLinks(new Server.Event.Update({ path: path, patch: patch }));
          }).onDelete(function () {
            return _this3.sendToLinks(new Server.Event.Delete({ path: path }));
          });
          // immediatly publish the (empty) store
          _this3.publish(path, engine.remutableConsumer);
          return _this3._stores[path] = { engine: engine, consumer: consumer };
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
      }),
      writable: true,
      enumerable: true,
      configurable: true
    },
    Action: {
      value: (function (_Action) {
        var _ActionWrapper = function Action() {
          return _Action.apply(this, arguments);
        };

        _ActionWrapper.toString = function () {
          return _Action.toString();
        };

        return _ActionWrapper;
      })(function (path, lifespan) {
        var _this4 = this;
        if (__DEV__) {
          path.should.be.a.String;
          lifespan.should.be.an.instanceOf(Lifespan);
        }

        var _ref3 = this._actions[path] || (function () {
          var engine = new Action.Engine();
          var producer = engine.createProducer();
          return _this4._actions[path] = {
            engine: engine,
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
      }),
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Server;
})(EventEmitter);

_Server = Server;

Object.assign(Server, { Event: Event, Link: Link, hashClientID: hashClientID });

module.exports = Server;