"use strict";

var _inherits = function (child, parent) {
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
}
var _ref = require("stream");

var Duplex = _ref.Duplex;
var through = require("through2");
var Remutable = require("remutable");
var Patch = Remutable.Patch;


var Store = require("./Store");
var Action = require("./Action");
var Client = require("./Client");

var Server = (function () {
  var _Duplex = Duplex;
  var Server = function Server(adapter) {
    var _this = this;
    if (__DEV__) {
      adapter.should.be.an.instanceOf(Server.Adapter);
    }
    this._stores = {};
    this._actions = {};
    this._publish = adapter;
    this.lifespan = new Promise(function (resolve) {
      return _this.release = resolve;
    });
    this.on("data", this._receive);
    this.on("end", this.release);
    if (adapter.onConnection && _.isFunction(adapter.onConnection)) {
      adapter.onConnection(this.accept, this.lifespan);
    }
  };

  _inherits(Server, _Duplex);

  Server.prototype.accept = function (link) {
    if (__DEV__) {
      link.should.be.an.instanceOf(Duplex);
      link.should.have.property("pipe").which.is.a.Function;
    }
    var subscriptions = {};
    var clientID = null;

    link.pipe(through.obj(function (ev, enc, done) {
      // filter & pipe client events to the server
      if (__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }

      if (ev instanceof Client.Event.Open) {
        clientID = ev.clientID;
        return done(null, { clientID: clientID, ev: ev });
      }
      if (ev instanceof Client.Event.Close) {
        clientID = null;
        return done(null, { clientID: clientID, ev: ev });
      }
      if (ev instanceof Client.Event.Subscribe) {
        subscriptions[ev.path] = true;
        return done(null);
      }
      if (ev instanceof Client.Event.Unsubscribe) {
        if (subscriptions[ev.path]) {
          delete subscriptions[ev.path];
        }
        return done(null);
      }
      if (ev instanceof Client.Event.Dispatch) {
        if (clientID !== null) {
          return done(null, { clientID: clientID, ev: ev });
        }
        return done(null);
      }
      return done(new TypeError("Unknown Client.Event: " + ev));
    })).pipe(this);

    this.pipe(through.obj(function (ev, enc, done) {
      // filter & pipe server events to the client
      if (__DEV__) {
        ev.should.be.an.instanceOf(Server.Event);
      }

      if (ev instanceof Server.Event.Update) {
        if (subscriptions[ev.path]) {
          return done(null, ev);
        }
        return done(null);
      }
      if (ev instanceof Server.Event.Delete) {
        if (subscriptions[ev.path]) {
          return done(null, ev);
        }
        return done(null);
      }
      return done(new TypeError("Unknown Server.Event: " + ev));
    })).pipe(link);

    return link;
  };

  Server.prototype._send = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.write(ev);
  };

  Server.prototype._receive = function (_ref2) {
    var clientID = _ref2.clientID;
    var ev = _ref2.ev;
    if (__DEV__) {
      clientID.should.be.a.String;
      ev.should.be.an.instanceOf(Client.Event);
    }
  };

  Server.prototype.Store = function (path, lifespan) {
    var _this2 = this;
    if (__DEV__) {
      path.should.be.a.String;
    }

    var _ref3 = this._stores[path] || (function () {
      var _engine = new Store.Engine();
      var consumer = _engine.createConsumer().onUpdate(function (consumer, patch) {
        _this2._publish(path, consumer);
        _this2._send(new Server.Event.Update({ path: path, patch: patch }));
      }).onDelete(function () {
        return _this2._send(new Server.Event.Delete({ path: path }));
      });
      // immediatly publish the (empty) store
      _this2._publish(path, consumer);
      return _this2._stores[path] = { engine: _engine, consumer: consumer };
    })();
    var engine = _ref3.engine;
    var producer = engine.createProducer();
    producer.lifespan.then(function () {
      if (engine.producers === 0) {
        engine.release();
        delete _this2._stores[path];
      }
    });
    lifespan.then(producer.release);
    return producer;
  };

  Server.prototype.Action = function (path, lifespan) {
    var _this3 = this;
    if (__DEV__) {
      path.should.be.a.String;
    }

    var _ref4 = this._actions[path] || function () {
      var _engine2 = new Action.Engine();
      return _this3._actions[path] = {
        engine: _engine2,
        producer: _engine2.createProducer() };
    };
    var engine = _ref4.engine;
    var consumer = engine.createConsumer();
    consumer.lifespan.then(function () {
      if (engine.consumers === 0) {
        engine.release();
        delete _this3._actions[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  };

  return Server;
})();

var Adapter = function Adapter() {
  if (__DEV__) {
    this.should.have.property("publish").which.is.a.Function.and.is.not.exactly(Adapter.prototype.publish);
    this.should.have.property("onConnection").which.is.a.Function.and.is.not.exactly(Adapter.prototype.onConnection);
  }
};

Adapter.prototype.publish = function (path, consumer) {
  if (__DEV__) {
    path.should.be.an.instanceOf(path);
    consumer.should.be.an["instanceof"](Remutable.Consumer);
  }
  throw new TypeError("Server.Adapter should implement publish(path: String, remutable: Remutable): void 0");
};

Adapter.prototype.onConnection = function (accept, lifespan) {
  if (__DEV__) {
    accept.should.be.a.Function;
    lifespan.should.have.property("then").which.is.a.Function;
  }
  throw new TypeError("Server.Adapter should implement onConnection(fn: Function(client: Duplex): void 0, lifespan: Promise): void 0");
};

var Event = function Event() {
  if (__DEV__) {
    this.should.have.property("toJS").which.is.a.Function;
    this.constructor.should.have.property("fromJS").which.is.a.Function;
  }
  Object.assign(this, {
    _json: null,
    _js: null });
};

Event.prototype.toJS = function () {
  if (this._js === null) {
    this._js = {
      t: this.constructor.t(),
      j: this._toJS() };
  }
  return this._js;
};

Event.prototype.toJSON = function () {
  if (this._json === null) {
    this._json = JSON.stringify(this.toJS());
  }
  return this._json;
};

Event.fromJSON = function (json) {
  var _ref5 = JSON.parse(json);

  var _t = _ref5.t;
  var j = _ref5.j;
  return Event._[_t].fromJS(j);
};

var Update = (function () {
  var _Event = Event;
  var Update = function Update(path, patch) {
    if (__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    _Event.call(this);
    Object.assign(this, { path: path, patch: patch });
  };

  _inherits(Update, _Event);

  Update.prototype._toJS = function () {
    return {
      p: this.path,
      u: this.patch.toJS() };
  };

  Update.t = function () {
    return "u";
  };

  Update.fromJS = function (_ref6) {
    var p = _ref6.p;
    var u = _ref6.u;
    if (__DEV__) {
      p.should.be.a.String;
      u.should.be.an.Object;
    }
    return new Update(p, Patch.fromJS(u));
  };

  return Update;
})();

var Delete = (function () {
  var _Event2 = Event;
  var Delete = function Delete(path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    _Event2.call(this);
    Object.assign(this, { path: path });
  };

  _inherits(Delete, _Event2);

  Delete.prototype._toJS = function () {
    return { p: this.patch };
  };

  Delete.t = function () {
    return "d";
  };

  Delete.fromJS = function (_ref7) {
    var p = _ref7.p;
    if (__DEV__) {
      p.should.be.a.String;
    }
    return new Delete(p);
  };

  return Delete;
})();

Event._ = {};
Event.Update = Event._[Update.t()] = Update;
Event.Delete = Event._[Delete.t()] = Delete;

Server.Event = Event;
Server.Adapter = Adapter;

module.exports = Server;