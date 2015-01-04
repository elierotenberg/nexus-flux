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
var Remutable = require("remutable");
var Patch = Remutable.Patch;
var _ref = require("stream");

var Duplex = _ref.Duplex;


var Store = require("./Store");
var Action = require("./Action");
var Server = require("./Server");

var INT_MAX = 9007199254740992;

var Client = (function () {
  var _Duplex = Duplex;
  var Client = function Client(adapter, clientID) {
    var _this = this;
    if (clientID === undefined) clientID = _.uniqueId("Client" + _.random(1, INT_MAX - 1));
    return (function () {
      if (__DEV__) {
        adapter.should.be.an.instanceOf(Client.Adapter);
        clientID.should.be.a.String;
      }

      _Duplex.call(_this, {
        allowHalfOpen: false,
        objectMode: true });

      _.bindAll(_this);

      Object.assign(_this, {
        clientID: clientID,
        lifespan: new Promise(function (resolve) {
          return _this.resolve = resolve;
        }),
        _stores: {},
        _refetching: {},
        _actions: {},
        _fetch: adapter.fetch });

      adapter.pipe(_this, { end: true }); // adapter.write -> this.read; if adapter.end(), then this.on('end')
      _this.pipe(adapter, { end: true }); // this.write -> adapter.read; if this.end(), then adapter.on('end')

      _this.on("data", _this._receive);
      _this._send(new Client.Event.Open({ clientID: clientID }));

      var finished = false;

      _this.on("end", function () {
        if (!finished) {
          _this._send(new Client.Event.Close());
        }
      });

      _this.on("finish", function () {
        finished = true;
        _this.resolve();
      });
    })();
  };

  _inherits(Client, _Duplex);

  Client.prototype.Store = function (path, lifespan) {
    var _this2 = this;
    if (__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    var _ref2 = this._stores[path] || (function () {
      _this2._send(new Client.Event.Subscribe({ path: path }));
      var _engine = new Store.Engine();
      return _this2._stores[path] = {
        engine: _engine,
        producer: _engine.createProducer(),
        patches: {},
        refetching: false };
    })();
    var engine = _ref2.engine;
    var consumer = engine.createConsumer();
    consumer.lifespan.then(function () {
      // Stores without consumers are removed
      if (engine.consumers === 0) {
        engine.release();
        _this2._send(new Client.Event.Unsbuscribe({ path: path }));
        delete _this2._stores[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  };

  Client.prototype.Action = function (path, lifespan) {
    var _this3 = this;
    if (__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    var _ref3 = this._actions[path] || (function () {
      var _engine2 = new Action.Engine();
      return _this3._actions[path] = {
        engine: _engine2,
        consumer: _engine2.createConsumer().onDispatch(function (params) {
          return _this3._send(new Client.Event.Dispatch({ path: path, params: params }));
        }) };
    })();
    var engine = _ref3.engine;
    var producer = engine.createProducer();
    producer.lifespan.then(function () {
      // Actions without producers are removed
      if (engine.producers === 0) {
        engine.release();
        delete _this3._actions[path];
      }
    });
    lifespan.then(producer.release);
    return producer;
  };

  Client.prototype._send = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this.write(ev);
  };

  Client.prototype._receive = function (ev) {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    if (ev instanceof Server.Event.Update) {
      return this._update(ev.path, ev.patch);
    }
    if (ev instanceof Server.Event.Delete) {
      return this._delete(ev.path);
    }
  };

  Client.prototype._update = function (path, patch) {
    if (__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    if (this._stores[path] === void 0) {
      // dismiss if we are not interested anymore
      return;
    }
    var producer = this._stores[path].producer;
    var patches = this._stores[path].patches;
    var refetching = this._stores[path].refetching;
    var hash = producer.remutableConsumer.hash;
    var source = patch.source;
    var target = patch.target;
    if (hash === source) {
      // if the patch applies to our current version, apply it now
      return producer.update(patch);
    } // we don't have a recent enough version, we need to refetch
    if (!refetching) {
      // if we arent already refetching, request a newer version (atleast >= target)
      return this._refetch(path, target);
    } // if we are already refetching, store the patch for later
    patches[source] = patch;
  };

  Client.prototype._delete = function (path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    if (this._stores[path] === void 0) {
      return;
    }
    var producer = this._stores[path].producer;
    producer["delete"]();
  };

  Client.prototype._refetch = function (path, target) {
    var _this4 = this;
    if (__DEV__) {
      path.should.be.a.String;
      target.should.be.a.String;
      this._stores.should.have.property(path);
    }
    this._stores[path].refetching = true;
    this.fetch(path, target).then(function (remutable) {
      return _this4._upgrade(path, remutable);
    });
  };

  Client.prototype._upgrade = function (path, next) {
    if (__DEV__) {
      path.should.be.a.String;
      (next instanceof Remutable || next instanceof Remutable.Consumer).should.be.true;
    }
    if (this._stores[path] === void 0) {
      // not interested anymore
      return;
    }
    var producer = this._stores[path].producer;
    var patches = this._stores[path].patches;
    var prev = producer.remutableConsumer;
    if (prev.version > next.version) {
      // we already have a more recent version
      return;
    }
    // squash patches to create a single patch
    var squash = Patch.fromDiff(prev, next);
    while (patches[squash.target] !== void 0) {
      squash = Patch.combine(squash, patches[squash.target]);
    }
    var version = squash.t.v;
    // clean old patches
    _.each(patches, function (_ref4, source) {
      var t = _ref4.t;
      if (t.v <= version) {
        delete patches[source];
      }
    });
    producer.update(squash);
  };

  return Client;
})();

var Adapter = (function () {
  var _Duplex2 = Duplex;
  var Adapter = function Adapter() {
    if (__DEV__) {
      this.should.have.property("fetch").which.is.a.Function.and.is.not.exactly(Adapter.prototype.fetch);
    }
    _Duplex2.call(this, {
      allowHalfOpen: false,
      objectMode: true });
  };

  _inherits(Adapter, _Duplex2);

  Adapter.prototype.fetch = function (path, hash) {
    if (hash === undefined) hash = null;
    if (__DEV__) {
      path.should.be.a.String;
      (_.isNull(hash) || _.isString(hash)).should.be.true;
    }
    throw new TypeError("Client.Adapter should implement fetch(path: String): Promise(Remutable)");
  };

  return Adapter;
})();

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

var Open = (function () {
  var _Event = Event;
  var Open = function Open(_ref6) {
    var clientID = _ref6.clientID;
    if (__DEV__) {
      clientID.should.be.a.String;
    }
    Object.assign(this, { clientID: clientID });
  };

  _inherits(Open, _Event);

  Open.prototype._toJS = function () {
    return { c: this.clientID };
  };

  Open.t = function () {
    return "o";
  };

  Open.fromJS = function (_ref7) {
    var c = _ref7.c;
    return new Open(c);
  };

  return Open;
})();

var Close = (function () {
  var _Event2 = Event;
  var Close = function Close() {
    if (_Event2) {
      _Event2.apply(this, arguments);
    }
  };

  _inherits(Close, _Event2);

  Close.prototype._toJS = function () {
    return {};
  };

  Close.t = function () {
    return "c";
  };

  Close.fromJS = function () {
    return new Close();
  };

  return Close;
})();

var Subscribe = (function () {
  var _Event3 = Event;
  var Subscribe = function Subscribe(path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    Object.assign(this, { path: path });
  };

  _inherits(Subscribe, _Event3);

  Subscribe.prototype._toJS = function () {
    return { p: this.patch };
  };

  Subscribe.t = function () {
    return "s";
  };

  Subscribe.fromJS = function (_ref8) {
    var p = _ref8.p;
    return new Subscribe(p);
  };

  return Subscribe;
})();

var Unsbuscribe = (function () {
  var _Event4 = Event;
  var Unsbuscribe = function Unsbuscribe(path) {
    if (__DEV__) {
      path.should.be.a.String;
    }
    Object.assign(this, { path: path });
  };

  _inherits(Unsbuscribe, _Event4);

  Unsbuscribe.prototype._toJS = function () {
    return { p: this.patch };
  };

  Unsbuscribe.t = function () {
    return "u";
  };

  Unsbuscribe.fromJS = function (_ref9) {
    var p = _ref9.p;
    return new Unsbuscribe(p);
  };

  return Unsbuscribe;
})();

var Dispatch = (function () {
  var _Event5 = Event;
  var Dispatch = function Dispatch(path, params) {
    if (__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    Object.assign(this, { path: path, params: params });
  };

  _inherits(Dispatch, _Event5);

  Dispatch.prototype._toJS = function () {
    return { p: this.path, a: this.params };
  };

  Dispatch.t = function () {
    return "d";
  };

  Dispatch.fromJS = function (_ref10) {
    var p = _ref10.p;
    var a = _ref10.a;
    return new Dispatch(p, a);
  };

  return Dispatch;
})();

Event._ = {};
Event.Open = Event._[Open.t()] = Open;
Event.Close = Event._[Close.t()] = Close;
Event.Subscribe = Event._[Subscribe.t()] = Subscribe;
Event.Unsbuscribe = Event._[Unsbuscribe.t()] = Unsbuscribe;
Event.Dispatch = Event._[Dispatch.t()] = Dispatch;

Client.Adapter = Adapter;
Client.Event = Event;

module.exports = Client;