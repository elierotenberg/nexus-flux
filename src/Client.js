import Remutable from 'remutable';
const { Patch } = Remutable;
import through from 'through2';

import Store from './Store';
import Action from './Action';
import Server from './Server.Event'; // we just need this reference for typechecks
import { Event } from './Client.Event';

const INT_MAX = 9007199254740992;

let _Client;

const ClientDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receive(ev, enc, done) { // server send a client (through adapter)
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    if(ev instanceof Server.Event.Update) {
      this._update(ev.path, ev.patch);
      return done(null);
    }
    if(ev instanceof Server.Event.Delete) {
      this._delete(ev.path);
      return done(null);
    }
    done(new TypeError(`Unknown event: ${ev}`));
  },
  function flush(done) { // server is done sending (through adapter)
    this.push(new _Client.Event.Close());
    this.resolve();
    done(null);
  }
);

function isAdapter(adapter) { // client adapter ducktyping
  // an adapter is just a Duplex stream which implements 'fetch'
  return (adapter.should.have.property('pipe').which.is.a.Function) && _.isFunction(adapter.fetch);
}

class Client extends ClientDuplex {
  constructor(adapter, clientID = _.uniqueId(`Client${_.random(1, INT_MAX - 1)}`)) {
    if(__DEV__) {
      isAdapter(adapter).should.be.true;
      clientID.should.be.a.String;
    }
    super();
    _.bindAll(this);

    Object.assign(this, {
      clientID,
      lifespan: new Promise((resolve) => this.resolve = resolve),
      _stores: {},
      _refetching: {},
      _actions: {},
      _fetch: adapter.fetch,
      _prefetched: null,
    });

    adapter.pipe(this); // adapter sends us server events
    this.pipe(adapter); // we send adapter client events

    this.push(new Client.Event.Open({ clientID }));
  }

  import(prefetched) {
    if(__DEV__) {
      prefetched.should.be.an.Object;
      (this._prefetched === null).should.be.true;
    }
    this._prefetched = _.mapValues(prefetched, (js) => Remutable.fromJS(js));
    return this;
  }

  export() {
    if(__DEV__) {
      (this._prefetched !== null).should.be.true;
    }
    return _.mapValues(this._stores, (val) => val.remutable.toJS());
  }

  // example usage: client.settle('/todoList', '/userList'), client.settle(paths), client.settle().
  settle(...stores) { // wait for all the initialization Promise to be either fullfilled or rejected; paths can be either null/void 0 (all stores), a single string (1 store), or an array of stores
    if(stores === void 0) {
      stores = Object.keys(this._stores);
    }
    if(__DEV__) {
      stores.should.be.an.Array;
    }
    if(_.isArray(stores[0])) {
      stores = stores[0];
    }
    return Promise.settle(_.map(stores, (path) => this._stores[path].initialized));
  }

  Store(path, lifespan) { // returns a Store consumer
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    const { engine } = this._stores[path] || (() => { // if we don't know this store yet, then subscribe
      this.push(new Client.Event.Subscribe({ path }));
      const prefetched = this._prefetched !== null && this._prefetched[path] !== void 0 ? this._prefetched[path] : null;
      const engine = new Store.Engine(prefetched);
      const store = this._stores[path] = {
        engine,
        producer: engine.createProducer(),
        patches: {},         // initially we have no pending patches and we are not refetching
        refetching: false,
        initialized: null,
      };
      store.initialized = this._refetch(path, prefetched ? prefetched.hash : null);
      return this._stores[path];
    })();
    const consumer = engine.createConsumer();
    consumer.lifespan.then(() => { // Stores without consumers are removed
      if(engine.consumers === 0) { // if we don't have anymore consumers, then unsubscribe
        engine.release();
        this.push(new Client.Event.Unsubscribe({ path }));
        delete this._stores[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  }

  Action(path, lifespan) { // returns an Action producer
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    const { engine } = this._actions[path] || (() => { // if we don't know this action yet, start observing it
      const engine = new Action.Engine();
      return this._actions[path] = {
        engine,
        consumer: engine.createConsumer()
        .onDispatch((params) => this.push(new Client.Event.Dispatch({ path, params }))),
      };
    })();
    const producer = engine.createProducer();
    producer.lifespan.then(() => { // Actions without producers are removed
      if(engine.producers === 0) { // when we don't have anymore producers, we stop observing it
        engine.release();
        delete this._actions[path];
      }
    });
    lifespan.then(producer.release);
    return producer;
  }

  _update(path, patch) {
    if(__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    if(this._stores[path] === void 0) { // dismiss if we are not interested anymore
      return;
    }
    const { producer, patches, refetching } = this._stores[path];
    const { hash } = producer;
    const { source, target } = patch;
    if(hash === source) { // if the patch applies to our current version, apply it now
      return producer.apply(patch);
    } // we don't have a recent enough version, we need to refetch
    if(!refetching) { // if we arent already refetching, request a newer version (atleast >= target)
      return this._refetch(path, target);
    } // if we are already refetching, store the patch for later
    patches[source] = patch;
  }

  _delete(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._stores[path] === void 0) {
      return;
    }
    const { producer } = this._stores[path];
    producer.delete();
  }

  _refetch(path, target) {
    if(__DEV__) {
      path.should.be.a.String;
      (target === null || _.isString(target)).should.be.true;
      this._stores.should.have.property(path);
    }
    this._stores[path].refetching = true;
    // we use the fetch method from the adapter
    return this._fetch(path, target).then((remutable) => this._upgrade(path, remutable));
  }

  _upgrade(path, next) {
    if(__DEV__) {
      path.should.be.a.String;
      (next instanceof Remutable || next instanceof Remutable.Consumer).should.be.true;
    }
    if(this._stores[path] === void 0) { // not interested anymore
      return;
    }
    const { engine, producer, patches } = this._stores[path];
    const prev = engine.remutable;
    if(prev.version >= next.version) { // we already have a more recent version
      return;
    }
    // squash patches to create a single patch
    let squash = Patch.fromDiff(prev, next);
    while(patches[squash.target] !== void 0) {
      squash = Patch.combine(squash, patches[squash.target]);
    }
    const version = squash.to.v;
    // clean old patches
    _.each((patches), ({ to }, source) => {
      if(to.v <= version) {
        delete patches[source];
      }
    });
    producer.apply(squash);
  }
}

_Client = Client;

Object.assign(Client, { Event, isAdapter });

export default Client;
