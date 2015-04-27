import { Client, Server } from '../';
const { Link } = Server;
import Remutable from 'remutable';

// constants for the communication 'protocol'/convention
const FETCH = 'f';
const PUBLISH = 'p';
const EVENT = 'e';

// this is a just a disambiguation salt; this is by no mean a
// cryptosecure password or anything else. its fine to leave it
// plaintext here.
// any malicious script running from the same domain will be able
// to eavesdrop regardless.
const DEFAULT_SALT = '__KqsrQBNHfkTYQ8mWadEDwfKM';

/* jshint browser:true */
class WorkerClient extends Client {
  constructor(worker, salt = DEFAULT_SALT) {
    if(__DEV__) {
      worker.should.be.an.instanceOf(window.Worker);
      salt.should.be.a.String;
    }
    super();
    this._worker = worker;
    this._salt = salt;
    this._fetching = {};
    this._worker.addEventListener('message', this.receiveFromWorker);
    this.lifespan.onRelease(() => {
      _.each(this._fetching, ({ reject }) => reject(new Error('Client released')));
      this._worker.removeEventListener('message', this.receiveFromWorker);
    });
  }

  fetch(path, hash) {
    if(this._fetching[path] === void 0) {
      this._fetching[path] = {
        promise: null,
        resolve: null,
        reject: null,
      };
      this._fetching[path].promise = new Promise((resolve, reject) => {
        this._fetching[path].resolve = resolve;
        this._fetching[path].reject = reject;
      });
      this._worker.postMessage({ [this._salt]: { t: FETCH, j: { hash, path } } });
    }
    return this._fetching[path].promise;
  }

  sendToServer(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this._worker.postMessage({ [this._salt]: { t: EVENT, js: ev.toJS() } });
  }

  _receivePublish(j) {
    const { path } = j;
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._fetching[path] !== void 0) {
      if(j === null) {
        this._fetching[path].reject(new Error(`Couldn't fetch store`));
      }
      else {
        this._fetching[path].resolve(Remutable.fromJS(j).createConsumer());
      }
      delete this._fetching[path];
    }
    return null;
  }

  _receiveEvent(j) {
    const ev = Server.Event.fromJS(j);
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    return this.receiveFromServer(ev);
  }

  receiveFromWorker(message) {
    if(_.isObject(message) && message[this._salt] !== void 0) {
      const { t, j } = message[this._salt];
      if(t === PUBLISH) {
        return this._receivePublish(j);
      }
      if(t === EVENT) {
        return this._receiveEvent(j);
      }
      throw new TypeError(`Unknown message type: ${message}`);
    }
  }
}
/* jshint browser:false */

/* jshint worker:true */
class WorkerLink extends Link {
  constructor(self, stores, salt = DEFAULT_SALT) {
    if(__DEV__) {
      self.should.be.an.Object;
      self.postMessage.should.be.a.Function;
      self.addEventListener.should.be.a.Function;
      stores.should.be.an.Object;
      salt.should.be.a.String;
    }
    super();
    this._self = self;
    this._stores = stores;
    this._salt = salt;
    this._self.addEventListener('message', this.receiveFromWorker);
    this.lifespan.onRelease(() => {
      this._self.removeEventListener('message', this.receiveFromWorker);
      this._self = null;
      this._stores = null;
    });
  }

  sendToClient(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this._self.postMessage({ [this._salt]: { t: EVENT, js: ev.toJS() } });
  }

  _receivePublish(j) {
    const ev = Client.Event.fromJS(j);
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
      return this.receiveFromClient(ev);
    }
    return null;
  }

  _receiveFetch(j) {
    const { path } = j;
    if(this.stores[path] === void 0) {
      return this._self.postMessage({ [this._salt]: { t: PUBLISH, j: null } });
    }
    return this._self.postMessage({ [this._salt]: { t: PUBLISH, j: this.stores[path].toJS() } });
  }

  receiveFromWorker(message) {
    if(_.isObject(message) && message[this._salt] !== void 0) {
      const { t, j } = message[this._salt];
      if(t === EVENT) {
        return this._receivePublish(j);
      }
      if(t === FETCH) {
        return this._receiveFetch(j);
      }
      throw new TypeError(`Unknown message type: ${message}`);
    }
  }
}
/* jshint worker:false */

/* jshint worker:true */
class WorkerServer extends Server {
  constructor(stores = {}, salt = DEFAULT_SALT) {
    if(__DEV__) {
      stores.should.be.an.Object;
      salt.should.be.a.String;
    }
    super();
    this._salt = salt;
    this._stores = stores;
    this._link = new WorkerLink(self, this._stores, this._salt);
    this.acceptLink(this._link);
    this.lifespan.onRelease(() => {
      this._stores = null;
      this._link.release();
      this._link = null;
    });
  }
}
/* jshint worker:false */

export default {
  Client: WorkerClient,
  Server: WorkerServer,
};
