const Remutable = require('remutable');
const { Patch } = Remutable;
const { Duplex } = require('stream');

const Store = require('./Store');
const Action = require('./Action');
const Server = require('./Server');

let _Adapter;

const INT_MAX = 9007199254740992;

// Client is a Duplex stream:
// - Writable is a stream of Server.Events objects
// - Readable is a stream of Client.Events objects
class Client extends Duplex {
  constructor(fetch, clientID = `Client${_.random(1, INT_MAX - 1)}`) {
    if(__DEV__) {
      fetch.should.be.a.Function;
    }
    super({
      allowHalfOpen: true,
      objectMode: true,
    });
    this._adapter = new Adapter(fetch, clientID, this);
    this._stores = {};
    this._actions = {};
  }

  within(lifespan) {
    return {
      Store: (path) => this.Store(lifespan, path),
      Action: (path) => this.Action(lifespan, path),
    };
  }

  fetch(path) {
    return this._adapter.fetch(path);
  }

  Store(lifespan, path) {
    if(this._stores[path] === void 0) {
      this._stores[path] = {
        engine: new Store.Engine(),
        count: 0,
      };
      this._adapter.registerStore(path, this._stores[path].engine.createProducer());
    }
    this._stores[path].count = this._stores[path].count + 1;
    lifespan.then(() => this._uncreateStore(path));
    return this._stores[path].engine.createConsumer(lifespan);
  }

  _uncreateStore(path) {
    if(__DEV__) {
      this._stores.should.have.property(path);
      this._stores[path].count.should.be.above(0);
    }
    this._stores[path].count = this._stores[path].count - 1;
    if(this._stores[path].count === 0) {
      this._adapter.unregisterStore(path);
      delete this._stores[path];
    }
  }

  Action(lifespan, path) {
    if(this._actions[path] === void 0) {
      let actionResolve;
      const actionLifespan = new Promise((resolve) => actionResolve = resolve);
      this._actions[path] = {
        engine: new Action.Engine(),
        count: 0,
        resolve: actionResolve,
      };
      this._adapter.registerAction(path, this._actions[path].engine.createConsumer(actionLifespan));
    }
    this._actions[path].count = this._actions[path].count + 1;
    lifespan.then(() => this._uncreateAction(path));
    return this._actions[path].engine.createProducer();
  }

  _uncreateAction(path) {
    if(__DEV__) {
      this._actions.should.have.property(path);
      this._actions[path].count.should.be.above(0);
    }
    this._actions[path].count = this._actions[path].count - 1;
    if(this._actions[path].count === 0) {
      this._adapter.unregisterAction(path);
      this._actions[path].resolve();
      delete this._actions[path];
    }
  }
}

class Adapter {
  constructor(fetch, clientID, stream) {
    if(__DEV__) {
      fetch.should.be.a.Function;
      clientID.should.be.a.String;
      stream.should.be.an.instanceOf(Client);
    }
    _.bindAll(this);
    this._fetch = fetch;
    this._stream = stream;
    this._clientID = as;
    this._stores = {};
    this._actions = {};
    this._fetching = {};
    this._stream.on('data', this.receive);
    this.send(new Client.Events.ClientID({ clientID }));
  }

  fetch(path, hash = null) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    // should return a Promise for a remutable
    return this._fetch(path, hash);
  }

  registerStore(path, producer) {
    if(__DEV__) {
      path.should.be.a.String;
      producer.should.be.an.instanceOf(Store.Producer);
      this._stores.should.not.have.property(path);
    }
    this._stores[path] = producer;
    this._patches[path] = {};
    this._toServer.emit(Client.Events.Subscribe, path);
  }

  unregisterStore(path) {
    if(__DEV__) {
      path.should.be.a.String;
      this._stores.should.have.property(path);
    }
    this._toServer.emit(Client.Events.Unsbuscribe, path);
    delete this._patches[path];
    delete this._stores[path];
  }

  registerAction(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Action.Consumer);
      this._actions.should.not.have.property(path);
    }
    this._actions[path] = consumer;
    consumer.onDispatch((params) => this._toServer.emit(Client.Events.Dispatch, path, params));
  }

  unregisterAction(path) {
    if(__DEV__) {
      path.should.be.a;String;
      this._actions.should.have.property(path);
    }
    delete this._actions[path];
  }

  receive(event) {
    if(__DEV__) {
      event.should.be.an.instanceof(Server.Events);
    }
    if(event instanceof Server.Events.Patch) {
      return this.receivePatch(event.path, event.patch);
    }
    if(event instanceof Server.Events.Delete) {
      return this.receiveDelete(event.path);
    }
    if(__DEV__) {
      throw new Error(`Unknown Server Event: ${event}`);
    }
  }

  send(event) {
    if(__DEV__) {
      event.should.be.an.instanceOf(Client.Events);
    }
    this._stream.write(event);
  }

  receivePatch(path, patch) {
    if(__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    if(this._stores[path] === void 0) { // dismiss if we are not interested anymore
      return;
    }
    if(this._stores[path].remutableConsumer.hash === patch.source) { // if the patch match our current version, apply it
      return this._stores[path].update(patch);
    }
    if(this._refetching[path] === void 0) { // if we are not already refetching a fresher version, do it
      this.refetch(path, patch.target);
    }
    else { // if we are already fetching, store the patch for later use
      this._patches[path][patch.source] = patch;
    }
  }

  receiveDelete(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._stores[path] === void 0) {
      return;
    }
    this._stores[path].delete();
  }

  refetch(path, hash) {
    if(__DEV__) {
      this._refetching.should.not.have.property(path);
    }
    if(this._stores[path] === void 0) {
      return;
    }
    this._refetching[path] = this.fetch(path, hash)
    .then((remutable) => this.receiveRefetch(path, remutable));
  }

  receiveRefetch(path, remutable) {
    if(__DEV__) {
      path.should.be.a.String;
      (remutable instanceof Remutable || remutable instanceof Remutable.Consumer).should.be.true;
    }
    if(this._stores[path] === void 0) {
      return;
    }
    if(this._stores[path].remutableConsumer.version > remutable.version) {
      return;
    }
    const diff = Patch.fromDiff(this._stores[path].remutableConsumer, remutable);
    this._patches[path][diff.source] = diff;
    this.applyAllAvailablePatches(path);
  }

  applyAllAvailablePatches(path) {
    if(__DEV__) {
      path.should.be.a.String;
      this._stores.should.have.property(path);
    }
    let hash = this._stores[path].remutableConsumer.hash;
    let patch = null;
    // recursively combine all matching patches into one big patch
    while(this._patches[path][hash] !== void 0) {
      const nextPatch = this._patches[path][hash];
      delete this._patches[path][hash];
      if(patch === null) {
        patch = nextPatch;
      }
      else {
        patch = Patch.combine(patch, nextPatch);
      }
      hash = patch.target;
    }
    // delete patches to older versions
    const version = patch.t.v;
    _.each(this._patches[path], (patch, hash) => {
      if(patch.t.v < version) {
        delete this._patches[path][hash];
      }
    });
    if(__DEV__) {
      _.size(this._patches[path]).should.be.exactly(0);
    }
    this._stores[path].update(patch);
  }
}

class Events {
  constructor() {
    this._s = null;
  }

  get t() {
    return null;
  }

  get p() {
    return {};
  }

  stringify() {
    if(this._s === null) {
      this._s = JSON.stringify({ t: this.t, p: this.p });
    }
    return this._s;
  }

  static parse(json) {
    const { t, p } = JSON.parse(json);
    return new Events._shortName[t](p);
  }

  static _register(shortName, longName, constructor) {
    if(__DEV__) {
      shortName.should.be.a.String;
      shortName.length.should.be.exactly(1);
      longName.should.be.a.String;
      Events._shortName.should.not.have.property(shortName);
      Events.should.not.have.property(longName);
    }
    Object.assign(Events, { [longName]: constructor });
    Object.assign(Events._shortName, { [shortName]: constructor });
    Object.assign(constructor.prototype, { t: () => shortName });
  }
}

Object.assign(Events, { _shortName: {} });

class ClientID extends Events {
  constructor({ clientID }) {
    if(__DEV__) {
      clientID.should.be.a.String;
    }
    super();
    this.p = { clientID };
  }

  get clientID() {
    return this.p.clientID;
  }
}

Events._register('c', 'ClientID', ClientID);

class Subscribe extends Events {
  constructor({ path }) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    super();
    this.p = { path };
  }

  get path() {
    return this.p.path;
  }
}

Events._register('s', 'Subscribe', Subscribe);

class Unsbuscribe extends Events {
  constructor({ path }) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    super();
    this.p = { path };
  }

  get path() {
    return this.p.path;
  }
}

Events._register('u', 'Unsbuscribe', Unsbuscribe);

class Dispatch extends Events {
  constructor({ action, params }) {
    if(__DEV__) {
      action.should.be.a.String;
    }
    super();
    this.p = { action, params };
  }

  get action() {
    return this.p.action;
  }

  get params() {
    return this.p.params;
  }
}

Events._register('d', 'Dispatch', Dispatch);

_Adapter = Adapter;

Object.assign(Client, { Adapter, Events });

module.exports = Client;
