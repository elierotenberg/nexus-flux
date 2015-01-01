const Virtual = require('virtual');
const Remutable = require('remutable');
const { Patch } = Remutable;
const Store = require('./Store');
const Action = require('./Action');

let _Adapter;

class Client {
  constructor(adapter) {
    if(__DEV__) {
      adapter.should.be.an.instanceOf(_Adapter);
    }
    this._adapter = adapter;
    this._stores = {};
    this._actions = {};
  }

  within(lifespan) {
    return {
      createStore: (path) => this.createStore(lifespan, path),
      createAction: (path) => this.createAction(lifespan, path),
    };
  }

  fetch(path) {
    return this._adapter.fetch(path);
  }

  createStore(lifespan, path) {
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

  createAction(lifespan, path) {
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


// fetch(path, hash): Promise(Remutable)
// where the promised remutable should be at least as recent as hash

// subscribe(path): void 0
// fire & forget subscribe

// unsubscribe(path): void 0
// fire & forget unsubscribe

// dispatch(path, params): void 0
// fire & forget dispatch
const _AbstractAdapter = Virtual('fetch', 'subscribe', 'unsubscribe', 'dispatch');

class Adapter extends _AbstractAdapter {
  constructor() {
    super();
    this._stores = {};
    this._actions = {};
    this._fetching = {};
  }

  registerStore(path, producer) {
    if(__DEV__) {
      path.should.be.a.String;
      producer.should.be.an.instanceOf(Store.Producer);
      this._stores.should.not.have.property(path);
    }
    this._stores[path] = producer;
    this.subscribe(path);
  }

  unregisterStore(path) {
    if(__DEV__) {
      path.should.be.a.String;
      this._stores.should.have.property(path);
    }
    this.unsubscribe(path);
    delete this._stores[path];
  }

  registerAction(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Action.Consumer);
      this._actions.should.not.have.property(path);
    }
    this._actions[path] = consumer;
    consumer.onDispatch((params) => this.dispatch(path, params));
  }

  unregisterAction(path) {
    if(__DEV__) {
      path.should.be.a;String;
      this._actions.should.have.property(path);
    }
    delete this._actions[path];
  }

  receivePatch(path, patch) {
    if(__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    if(this._stores[path] === void 0) { // dismiss if we are not interested anymote
      return;
    }
    if(this._patches[path] === void 0) {
      this._patches[path] = {};
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

_Adapter = Adapter;

Client.Adapter = Adapter;

module.exports = Client;
