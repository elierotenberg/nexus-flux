const Remutable = require('remutable');
const { Patch } = Remutable;
const { Duplex } = require('stream');

const Store = require('./Store');
const Action = require('./Action');
const Server = require('./Server');

const INT_MAX = 9007199254740992;

const ClientDuplex = through2.ctor({ objectMode: true, allowHalfOpen: false },
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
    this.push(new Client.Event.Close());
    this.resolve();
    done(null);
  }
);

const isAdapter(adapter) { // client adapter ducktyping
  // an adapter is just a Duplex stream which implements 'fetch'
  return (adapter instanceof Duplex) && _.isFunction(adapter.fetch);
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
    });

    adapter.pipe(this); // adapter sends us server events
    this.pipe(adapter); // we send adapter client events
    this.push(new Client.Event.Open({ clientID }));
  }

  Store(path, lifespan, autofetch = true) { // returns a Store consumer
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    const { engine } = this._stores[path] || (() => { // if we don't know this store yet, then subscribe
      this.push(new Client.Event.Subscribe({ path }));
      const engine = new Store.Engine();
      this._stores[path] = {
        engine,
        producer: engine.createProducer(),
        patches: {},         // initially we have no pending patches and we are not refetching
        refetching: false,
      };
      // refetch immediatly unless we are explicitly told not to
      if(autofetch) {
        this._refetch(path, null);
      }
      return this._stores[path];
    })();
    const consumer = engine.createConsumer();
    consumer.lifespan.then(() => { // Stores without consumers are removed
      if(engine.consumers === 0) { // if we don't have anymore consumers, then unsubscribe
        engine.release();
        this.push(new Client.Event.Unsbuscribe({ path }));
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
    const { hash } = producer.remutableConsumer;
    const { source, target } = patch;
    if(hash === source) { // if the patch applies to our current version, apply it now
      return producer.update(patch);
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
      target.should.be.a.String;
      this._stores.should.have.property(path);
    }
    this._stores[path].refetching = true;
    // we use the fetch method from the adapter
    this._fetch(path, target).then((remutable) => this._upgrade(path, remutable));
  }

  _upgrade(path, next) {
    if(__DEV__) {
      path.should.be.a.String;
      (next instanceof Remutable || next instanceof Remutable.Consumer).should.be.true;
    }
    if(this._stores[path] === void 0) { // not interested anymore
      return;
    }
    const { producer, patches } = this._stores[path];
    const prev = producer.remutableConsumer;
    if(prev.version > next.version) { // we already have a more recent version
      return;
    }
    // squash patches to create a single patch
    let squash = Patch.fromDiff(prev, next);
    while(patches[squash.target] !== void 0) {
      squash = Patch.combine(squash, patches[squash.target]);
    }
    const version = squash.t.v;
    // clean old patches
    _.each((patches), ({ t }, source) => {
      if(t.v <= version) {
        delete patches[source];
      }
    });
    producer.update(squash);
  }
}

class Event {
  constructor() {
    if(__DEV__) {
      this.should.have.property('toJS').which.is.a.Function;
      this.constructor.should.have.property('fromJS').which.is.a.Function;
    }
    Object.assign(this, {
      _json: null,
      _js: null,
    });
  }

  toJS() {
    if(this._js === null) {
      this._js = {
        t: this.constructor.t(),
        j: this._toJS(),
      };
    }
    return this._js;
  }

  toJSON() {
    if(this._json === null) {
      this._json = JSON.stringify(this.toJS());
    }
    return this._json;
  }

  static fromJSON(json) {
    const { t, j } = JSON.parse(json);
    return Event._[t].fromJS(j);
  }
}

class Open extends Event {
  constructor({ clientID }) {
    if(__DEV__) {
      clientID.should.be.a.String;
    }
    Object.assign(this, { clientID });
  }

  _toJS() {
    return { c: this.clientID };
  }

  static t() {
    return 'o';
  }

  static fromJS({ c }) {
    return new Open(c);
  }
}

class Close extends Event {
  _toJS() {
    return {};
  }

  static t() {
    return 'c';
  }

  static fromJS() {
    return new Close();
  }
}

class Subscribe extends Event {
  constructor(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    Object.assign(this, { path });
  }

  _toJS() {
    return { p: this.patch };
  }

  static t() {
    return 's';
  }

  static fromJS({ p }) {
    return new Subscribe(p);
  }
}

class Unsbuscribe extends Event {
  constructor(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    Object.assign(this, { path });
  }

  _toJS() {
    return { p: this.patch };
  }

  static t() {
    return 'u';
  }

  static fromJS({ p }) {
    return new Unsbuscribe(p);
  }
}

class Dispatch extends Event {
  constructor(path, params) {
    if(__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    Object.assign(this, { path, params });
  }

  _toJS() {
    return { p: this.path, a: this.params };
  }

  static t() {
    return 'd';
  }

  static fromJS({ p, a }) {
    return new Dispatch(p, a);
  }
}
Event._ = {};
Event.Open        = Event._[Open.t()]         = Open;
Event.Close       = Event._[Close.t()]        = Close;
Event.Subscribe   = Event._[Subscribe.t()]    = Subscribe;
Event.Unsbuscribe = Event._[Unsbuscribe.t()]  = Unsbuscribe;
Event.Dispatch    = Event._[Dispatch.t()]     = Dispatch;

module.exports = Object.assign(Client, { Event, isAdapter });
