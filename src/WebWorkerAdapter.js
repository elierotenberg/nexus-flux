const Client = require('./Client');
const Server = require('./Server');
const EventEmitter = require('./EventEmitter');
const Remutable = require('remutable');
const { Duplex } = require('stream');

// constants for the communication 'protocol'/convention
const FETCH = 'f';
const PROVIDE = 'p';
const EVENT = 'e';

// just a disambiguation salt, avoiding
// messing with other stuff by mistake.
// this is by no means a password or a security feature.
const salt = '__NqnLKaw8NrAt';

class ClientAdapter extends Client.Adapter {
  constructor(worker) {
    if(__DEV__) {
      window.should.have.property('Worker').which.is.a.Function;
      worker.should.be.an.instanceOf(window.Worker);
    }
    super();
    _.bindAll(this);
    this._worker = worker;
    this.on('data', this._forwardToWorker);
    this._worker.onmessage = this._receiveFromWorker;
    this._fetching = {};
  }

  fetch(path, hash) { // ignore hash
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._fetching[path] === void 0) {
      let resolve;
      const promise = new Promise((_resolve) => resolve = _resolve);
      this._fetching[path] = { resolve, promise };
      this._worker.postMessage({ [salt]: [FETCH, path] }); // salt the message to make is distinguishable
    }
    return this._fetching[path];
  }

  _receiveFromWorker({ data }) {
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
        return this.write(Server.Event.fromJS(payload));
      }
      if(__DEV__) {
        throw new TypeError(`Unknown message type: ${type}`);
      }
    }
  }

  _forwardToWorker(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this._worker.postMessage({ [salt]: [EVENT, ev.toJS()]});
  }
}

class Link extends Duplex { // represents a client connection from the servers' point of view
  constructor(buffer) {
    if(__DEV__) {
      buffer.should.be.an.Object;
    }
    this._buffer = buffer;
    this.on('data', this._forwardToClient);
    self.onmessage = this._receiveFromClient;
  }

  _receiveFromClient({ data }) {
    if(_.isObject(data) && data[salt] !== void 0) {
      const [type, payload] = data[salt];
      if(type === FETCH) {
        if(__DEV__) {
          payload.should.be.a.String;
        }
        if(this._buffer[payload] !== void 0) {
          return self.postMessage({ [salt]: [PROVIDE, { path: payload, js: this._buffer[payload] }]);
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
        return this.write(Client.Event.fromJS(payload));
      }
      if(__DEV__) {
        throw new TypeError(`Unknown message type: ${type}`);
      }
    }
  }

  _forwardToClient(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    return this.write({ [salt]: [EVENT, ev.toJS()]});
  }
}

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
    _.defer(() => accept(new Link(this._data)));
  }
}

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter,
};
