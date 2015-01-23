import Immutable from 'immutable';
import Remutable from 'remutable';
const { Patch } = Remutable;
import Lifespan from 'lifespan';

import Store from './Store';
import Action from './Action';
import Server from './Server.Event'; // we just need this reference for typechecks
import { Event } from './Client.Event';

const INT_MAX = 9007199254740992;

/**
 * @abstract
 */
class Client {
  constructor(clientID = _.uniqueId(`Client${_.random(1, INT_MAX - 1)}`)) {
    if(__DEV__) {
      clientID.should.be.a.String;
      this.constructor.should.not.be.exactly(Client); // ensure abstract
      this.fetch.should.not.be.exactly(Client.prototype.fetch); // ensure virtual
      this.sendToServer.should.not.be.exactly(Client.prototype.sendToServer); // ensure virtual
    }
    this.lifespan = new Lifespan();
    _.bindAll(this);
    this._clientID = clientID;
    this._stores = {};
    this._refetching = {};
    this._actions = {};
    this._injected = null;
    this._prefetched = null;
    this.lifespan.onRelease(() => {
      this._clientID = null;
      this._stores = null;
      this._refetching = null;
      this._actions = null;
      this._injected = null;
      this._prefetched = null;
    });

    this.sendToServer(new Client.Event.Open({ clientID }));
  }

  /**
   * @virtual
   */
  fetch(path, hash) {
    if(__DEV__) {
      path.should.be.a.String;
      (hash === null || _.isString(hash)).should.be.true;
    }
    throw new TypeError('Virtual method invocation');
  }

  /**
   * @virtual
   */
  sendToServer(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    throw new TypeError('Virtual method invocation');
  }

  get isPrefetching() {
    return this._prefetched !== null;
  }

  getPrefetched(path) {
    if(__DEV__) {
      path.should.be.a.String;
      this.isPrefetching.should.be.true;
      this._prefetched.should.have.property(path);
      this._prefetched[path].promise.isPending().should.be.false;
    }
    return this._prefetched[path].head;
  }

  startPrefetching() {
    if(__DEV__) {
      this.isPrefetching.should.not.be.true;
    }
    this._prefetched = {};
  }

  stopPrefetching() {
    if(__DEV__) {
      this.isPrefetching.should.be.true;
    }
    const prefetched = this._prefetched;
    return _.mapValues(prefetched, ({ head }) => (head ? head.toJS() : void 0));
  }

  prefetch(path) {
    if(__DEV__) {
      path.should.be.a.String;
      this.isPrefetching.should.be.true;
    }
    if(this._prefetched[path] === void 0) {
      let prefetched = {
        promise: null,
        head: null,
      };
      prefetched.promise = this.fetch(path, null)
      .then(({ head }) => prefetched.head = head)
      .catch(() => prefetched.head = null);
      this._prefetched[path] = prefetched;
    }
    return this._prefetched[path].promise;
  }

  get isInjecting() {
    return this._injected !== null;
  }

  getInjected(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._injected[path] !== void 0) {
      return this._injected[path];
    }
    return null;
  }

  startInjecting(injected) {
    if(__DEV__) {
      this.isInjecting.should.not.be.true;
      injected.should.be.an.Object;
    }
    this._injected = _.mapValues(injected, (js) => Immutable.Map(js));
  }

  stopInjecting() {
    if(__DEV__) {
      this.isInjecting.should.be.true;
    }
    this._injected = null;
  }

  receiveFromServer(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    if(ev instanceof Server.Event.Update) {
      return this._update(ev.path, ev.patch);
    }
    if(ev instanceof Server.Event.Delete) {
      return this._delete(ev.path);
    }
    throw new TypeError(`Unknown event: ${ev}`);
  }

  Store(path, lifespan) { // returns a Store consumer
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.be.an.instanceOf(Lifespan);
    }
    const { engine } = this._stores[path] || (() => { // if we don't know this store yet, then subscribe
      this.sendToServer(new Client.Event.Subscribe({ path }));
      const engine = new Store.Engine(this.isInjecting ? this.inject(path) : null);
      this._stores[path] = {
        engine,
        producer: engine.createProducer(),
        patches: {},         // initially we have no pending patches and we are not refetching
        refetching: false,
      };
      this._refetch(path, null);
      return this._stores[path];
    })();
    const consumer = engine.createConsumer();
    consumer.lifespan.onRelease(() => {
      if(engine.consumers === 0) {
        this._stores[path].producer.lifespan.release();
        engine.lifespan.release();
        this.sendToServer(new Client.Event.Unsubscribe({ path }));
        delete this._stores[path];
      }
    });
    lifespan.onRelease(consumer.lifespan.release);
    return consumer;
  }

  Action(path, lifespan) { // returns an Action producer
    if(__DEV__) {
      path.should.be.a.String;
      lifespan.should.be.an.instanceOf(Lifespan);
    }
    const { engine } = this._actions[path] || (() => { // if we don't know this action yet, start observing it
      const engine = new Action.Engine();
      return this._actions[path] = {
        engine,
        consumer: engine.createConsumer()
        .onDispatch((params) => this.sendToServer(new Client.Event.Dispatch({ path, params }))),
      };
    })();
    const producer = engine.createProducer();
    producer.lifespan.onRelease(() => {
      if(engine.producers === 0) {
        this._actions[path].consumer.lifespan.release();
        engine.lifespan.release();
        delete this._actions[path];
      }
    });
    lifespan.onRelease(producer.lifespan.release);
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
    return this.fetch(path, target).then((remutable) => this._upgrade(path, remutable));
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

Object.assign(Client, { Event });

export default Client;
