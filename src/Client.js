const Remutable = require('remutable');
const { Patch } = Remutable;
const { Duplex } = require('stream');

const Store = require('./Store');
const Action = require('./Action');
const Server = require('./Server');

let _Link;

const INT_MAX = 9007199254740992;

// Client is a Duplex stream:
// - Writable is a stream of Server.Event objects
// - Readable is a stream of Client.Event objects
class Client extends Duplex {
  constructor(clientID = _.uniqueId(`Client${_.random(1, INT_MAX - 1)}`)) {
    if(__DEV__) {
      clientID.should.be.a.String;
      asap(() => {
        try {
          this._fetch.should.be.a.Function;
        }
        catch(err) {
          console.warn(`Client#use(fetch) should be called immediatly after instanciation.`);
        }
      });
    }

    super({
      allowHalfOpen: true,
      objectMode: true,
    });

    _.bindAll(this);

    Object.assign(this, {
      clientID,
      lifespan: new Promise((resolve) => this.on('end', resolve)),
      _stores: {},
      _refetching: {},
      _actions: {},
      _fetch: null,
    });

    this.on('data', this._receive);
    this._send(new Client.Event.Open({ clientID }));
    this.lifespan.then(() => this._send(new Client.Event.Close()));
  }

  use(fetch) {
    if(__DEV__) {
      fetch.should.be.an.Function;
    }
    this._fetch = fetch;
    return this;
  }

  Store(path, lifespan) {
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    const { engine } = this._stores[path] || (() => {
      this._send(new Client.Event.Subscribe({ path }));
      const engine = new Store.Engine();
      return this._stores[path] = {
        engine,
        producer: engine.createProducer(),
        patches: {},
        refetching: false,
      };
    })();
    const consumer = engine.createConsumer();
    consumer.lifespan.then(() => { // Stores without consumers are removed
      if(engine.consumers === 0) {
        engine.release();
        this._send(new Client.Event.Unsbuscribe({ path }));
        delete this._stores[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  }

  Action(path, lifespan) {
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    const { engine } = this._actions[path] || (() => {
      const engine = new Action.Engine();
      return this._actions[path] = {
        engine,
        consumer: engine.createConsumer()
        .onDispatch((params) => this._send(new Client.Event.Dispatch({ path, params }))),
      };
    })();
    const producer = engine.createProducer();
    producer.lifespan.then(() => { // Actions without producers are removed
      if(engine.producers === 0) {
        engine.release();
        delete this._actions[path];
      }
    });
    lifespan.then(producer.release);
    return producer;
  }

  _send(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this.write(ev);
  }

  _receive(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    if(ev instanceof Server.Event.Update) {
      return this._update(ev.path, ev.patch);
    }
    if(ev instanceof Server.Event.Delete) {
      return this._delete(ev.path);
    }
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
    this.fetch(path, target).then((remutable) => this._upgrade(path, remutable));
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
    if(__DEV__) {
      Event._shortName.should.have.ownProperty(json);
    }
    return new Event._shortName[t](p);
  }

  static _register(shortName, longName, Ctor) {
    if(__DEV__) {
      shortName.should.be.a.String;
      shortName.length.should.be.exactly(1);
      longName.should.be.a.String;
      Event._shortName.should.not.have.property(shortName);
      Event.should.not.have.property(longName);
      Ctor.should.be.a.Function;
    }
    Event[longName] = Ctor;
    Event._shortName[shortName] = Ctor;
    Ctor.prototype.t = shortName;
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
    return Events._[t].fromJS(j);
  }
}

class Open extends Event {
  constructor(clientID) {
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
    return { p: this.path, a: params };
  }

  static t() {
    return 'd';
  }

  static fromJS({ p, a }) {
    return new Dispatch(p, a);
  }
}

Event.Open        = Event._[Open.t()]         = Open;
Event.Close       = Event._[Close.t()]        = Close;
Event.Subscribe   = Event._[Subscribe.t()]    = Subscribe;
Event.Unsbuscribe = Event._[Unsbuscribe.t()]  = Unsbuscribe;
Event.Dispatch    = Event._[Dispatch.t()]     = Dispatch;

Client.Event = Event;

module.exports = Client;
