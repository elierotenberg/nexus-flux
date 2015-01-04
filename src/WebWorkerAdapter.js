const Client = require('./Client');
const Server = require('./Server');
const Remutable = require('remutable');
const through = require('through2');

// Client.Events:
// Client -> Adapter -> (worker.postMessage -> worker.onmessage) -> Server.Link -> Server
// Server.Events:
// Server -> Server.Link -> (worker.postMessage -> window.onmessage) -> Adapter -> Client

// constants for the communication 'protocol'/convention
const FETCH = 'f';
const PROVIDE = 'p';
const EVENT = 'e';

// just a disambiguation salt, avoiding
// messing with other stuff by mistake.
// this is by no means a password or a security feature.
const salt = '__NqnLKaw8NrAt';

const ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receiveFromClient(ev, enc, done) { // Client -> Adapter
    try {
      if(__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }
      this._worker.postMessage({ [salt]: [EVENT, ev.toJS()]}); // Client.Adapter (us) -> Server.Link (them)
    }
    catch(err) {
      return done(err);
    }
    return done(null);
  }
);

class ClientAdapter extends ClientAdapterDuplex {
  constructor(worker) {
    if(__DEV__) {
      window.should.have.property('Worker').which.is.a.Function;
      worker.should.be.an.instanceOf(window.Worker);
    }
    super();
    _.bindAll(this);
    this._worker = worker;
    this._worker.onmessage = this._receiveFromWorker; // Server.Link (them) -> Client.Adapter (us)
    this._fetching = {};
  }

  fetch(path, hash) { // ignore hash
    return Promise.try(() => {
      if(__DEV__) {
        path.should.be.a.String;
        (_.isNull(hash) || _.isString(hash)).should.be.true;
      }

      if(this._fetching[path] === void 0) {
        let resolve;
        const promise = new Promise((_resolve) => resolve = _resolve);
        this._fetching[path] = { resolve, promise };
        this._worker.postMessage({ [salt]: [FETCH, path] }); // salt the message to make is distinguishable
      }
      return this._fetching[path];
    });
  }

  _receiveFromWorker({ data }) { // Server.Link (them) -> Client.Adapter (us)
    if(_.isObject(data) && data[salt] !== void 0) { // don't catch messages from other stuff by mistake
      const [type, payload] = data[salt];
      if(type === PROVIDE) {
        if(__DEV__) {
          payload.should.be.an.Object;
          payload.should.have.property('path').which.is.a.String;
          payload.should.have.property('js').which.is.an.Object;
        }
        if(this._fetching[payload.path] !== void 0) {
          return this._fetching[payload.path].resolve(Remutable.fromJS(payload.js));
        }
        return;
      }
      if(type === EVENT) {
        if(__DEV__) {
          payload.should.be.an.Object;
        }
        return this.push(Server.Event.fromJS(payload)); // Client.Adapter (us) -> Client
      }
      if(__DEV__) {
        throw new TypeError(`Unknown message type: ${type}`);
      }
    }
  }
}
/* jshint worker:true */

const LinkDuplex = through.ctor({ objectMode: true, allowHalfOpen: true },
  function receiveFromServer(ev, enc, done) { // Server (them) -> Server.Link (us)
    try {
      if(__DEV__) {
        ev.should.be.an.instanceOf(Server.Event);
      }
      this.push({ [salt]: [EVENT, ev.toJS()] });
    }
    catch(err) {
      return done(err);
    }
    return done(null);
  }
);

class Link extends LinkDuplex { // represents a client connection from the servers' point of view
  constructor(buffer) {
    if(__DEV__) {
      buffer.should.be.an.Object;
    }
    super();
    this._buffer = buffer;
    self.onmessage = this._receiveFromClient; // Client.Adapter (them) -> Server.Link (us)
  }

  _receiveFromClient({ data }) { // Client.Adapter (them) -> Server.Link (us)
    if(_.isObject(data) && data[salt] !== void 0) {
      const [type, payload] = data[salt];
      if(type === FETCH) {
        if(__DEV__) {
          payload.should.be.a.String;
        }
        if(this._buffer[payload] !== void 0) {
          return self.postMessage({ [salt]: [PROVIDE, { path: payload, js: this._buffer[payload] }] }); // Server.Link (us) -> Client.Adapter (them)
        }
        if(__DEV__) {
          throw new Error(`No such store: ${payload}`);
        }
        return;
      }
      if(type === EVENT) {
        if(__DEV__) {
          payload.should.be.an.Object;
        }
        return this.push(Client.Event.fromJS(payload)); // Server.Link (us) -> Server (them)
      }
      if(__DEV__) {
        throw new TypeError(`Unknown message type: ${type}`);
      }
    }
  }
}
/* jshint worker:false */

/* jshint worker:true */
class ServerAdapter extends Server.Adapter {
  constructor() {
    if(__DEV__) {
      self.should.have.property('onmessage').which.is.a.Function;
    }
    super();
    _.bindAll(this);
    this._data = {};
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.consumer);
    }
    this._data[path] = consumer;
  }

  onConnection(accept, lifespan) { // as soon as the server binds it, pass it a new instance
    if(__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    _.defer(() => accept(new Link(this._data)));
  }
}
/* jshint worker:false */

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter,
};
