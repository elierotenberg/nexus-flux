"use strict";

var _slicedToArray = function (arr, i) {
  if (Array.isArray(arr)) {
    return arr;
  } else {
    var _arr = [];

    for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) {
      _arr.push(_step.value);

      if (i && _arr.length === i) break;
    }

    return _arr;
  }
};

var _defineProperty = function (obj, key, value) {
  return Object.defineProperty(obj, key, {
    value: value,
    enumerable: true,
    configurable: true,
    writable: true
  });
};

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
var Client = require("./Client");
var Server = require("./Server");
var Remutable = require("remutable");
var through = require("through2");

// Client.Events:
// Client -> Adapter -> (worker.postMessage -> worker.onmessage) -> Server.Link -> Server
// Server.Events:
// Server -> Server.Link -> (worker.postMessage -> window.onmessage) -> Adapter -> Client

// constants for the communication 'protocol'/convention
var FETCH = "f";
var PROVIDE = "p";
var EVENT = "e";

// just a disambiguation salt, avoiding
// messing with other stuff by mistake.
// this is by no means a password or a security feature.
var salt = "__NqnLKaw8NrAt";

var ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false }, function receiveFromClient(ev, enc, done) {
  // Client -> Adapter
  try {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this._worker.postMessage(_defineProperty({}, salt, [EVENT, ev.toJS()])); // Client.Adapter (us) -> Server.Link (them)
  } catch (err) {
    return done(err);
  }
  return done(null);
});

var ClientAdapter = (function () {
  var _ClientAdapterDuplex = ClientAdapterDuplex;
  var ClientAdapter = function ClientAdapter(worker) {
    if (__DEV__) {
      window.should.have.property("Worker").which.is.a.Function;
      worker.should.be.an.instanceOf(window.Worker);
    }
    _ClientAdapterDuplex.call(this);
    _.bindAll(this);
    this._worker = worker;
    this._worker.onmessage = this._receiveFromWorker; // Server.Link (them) -> Client.Adapter (us)
    this._fetching = {};
  };

  _inherits(ClientAdapter, _ClientAdapterDuplex);

  ClientAdapter.prototype.fetch = function (path, hash) {
    var _this = this;
    // ignore hash
    return Promise["try"](function () {
      if (__DEV__) {
        path.should.be.a.String;
        (_.isNull(hash) || _.isString(hash)).should.be.true;
      }

      if (_this._fetching[path] === void 0) {
        (function () {
          var resolve = undefined;
          var promise = new Promise(function (_resolve) {
            return resolve = _resolve;
          });
          _this._fetching[path] = { resolve: resolve, promise: promise };
          _this._worker.postMessage(_defineProperty({}, salt, [FETCH, path])); // salt the message to make is distinguishable
        })();
      }
      return _this._fetching[path];
    });
  };

  ClientAdapter.prototype._receiveFromWorker = function (_ref5) {
    var data = _ref5.data;
    // Server.Link (them) -> Client.Adapter (us)
    if (_.isObject(data) && data[salt] !== void 0) {
      // don't catch messages from other stuff by mistake
      var _data$salt = _slicedToArray(data[salt], 2);

      var type = _data$salt[0];
      var payload = _data$salt[1];
      if (type === PROVIDE) {
        if (__DEV__) {
          payload.should.be.an.Object;
          payload.should.have.property("path").which.is.a.String;
          payload.should.have.property("js").which.is.an.Object;
        }
        if (this._fetching[payload.path] !== void 0) {
          return this._fetching[payload.path].resolve(Remutable.fromJS(payload.js));
        }
        return;
      }
      if (type === EVENT) {
        if (__DEV__) {
          payload.should.be.an.Object;
        }
        return this.push(Server.Event.fromJS(payload)); // Client.Adapter (us) -> Client
      }
      if (__DEV__) {
        throw new TypeError("Unknown message type: " + type);
      }
    }
  };

  return ClientAdapter;
})();

/* jshint worker:true */

var LinkDuplex = through.ctor({ objectMode: true, allowHalfOpen: true }, function receiveFromServer(ev, enc, done) {
  // Server (them) -> Server.Link (us)
  try {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.push(_defineProperty({}, salt, [EVENT, ev.toJS()]));
  } catch (err) {
    return done(err);
  }
  return done(null);
});

var Link = (function () {
  var _LinkDuplex = LinkDuplex;
  var Link = ( // represents a client connection from the servers' point of view
    function Link(buffer) {
      if (__DEV__) {
        buffer.should.be.an.Object;
      }
      _LinkDuplex.call(this);
      this._buffer = buffer;
      self.onmessage = this._receiveFromClient; // Client.Adapter (them) -> Server.Link (us)
    }
  );

  _inherits(Link, _LinkDuplex);

  Link.prototype._receiveFromClient = function (_ref6) {
    var data = _ref6.data;
    // Client.Adapter (them) -> Server.Link (us)
    if (_.isObject(data) && data[salt] !== void 0) {
      var _data$salt2 = _slicedToArray(data[salt], 2);

      var type = _data$salt2[0];
      var payload = _data$salt2[1];
      if (type === FETCH) {
        if (__DEV__) {
          payload.should.be.a.String;
        }
        if (this._buffer[payload] !== void 0) {
          return self.postMessage(_defineProperty({}, salt, [PROVIDE, { path: payload, js: this._buffer[payload] }])); // Server.Link (us) -> Client.Adapter (them)
        }
        if (__DEV__) {
          throw new Error("No such store: " + payload);
        }
        return;
      }
      if (type === EVENT) {
        if (__DEV__) {
          payload.should.be.an.Object;
        }
        return this.push(Client.Event.fromJS(payload)); // Server.Link (us) -> Server (them)
      }
      if (__DEV__) {
        throw new TypeError("Unknown message type: " + type);
      }
    }
  };

  return Link;
})();

/* jshint worker:false */

/* jshint worker:true */
var ServerAdapter = (function () {
  /* jshint worker:false */ /* jshint worker:true */var _Server$Adapter = Server.Adapter;
  var ServerAdapter = function ServerAdapter() {
    if (__DEV__) {
      self.should.have.property("onmessage").which.is.a.Function;
    }
    _Server$Adapter.call(this);
    _.bindAll(this);
    this._data = {};
  };

  _inherits(ServerAdapter, _Server$Adapter);

  ServerAdapter.prototype.publish = function (path, consumer) {
    if (__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.consumer);
    }
    this._data[path] = consumer;
  };

  ServerAdapter.prototype.onConnection = function (accept, lifespan) {
    var _this2 = this;
    // as soon as the server binds it, pass it a new instance
    if (__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    _.defer(function () {
      return accept(new Link(_this2._data));
    });
  };

  return ServerAdapter;
})();

/* jshint worker:false */

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter };